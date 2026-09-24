import { Fragment, useMemo, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import {
  Search,
  Plus,
  Sparkles,
  SlidersHorizontal,
  X,
  Download,
  BookOpen,
  Table2,
  LayoutGrid,
  Camera,
  ChevronDown,
  ImageOff,
} from 'lucide-react'
import { useTrades } from '../lib/useTrades'
import { useJournals } from '../lib/journals'
import { formatMoney, formatR, cleanSymbol, imageUrl, computeStats, formatPct } from '../lib/trades'
import { downloadCsv } from '../lib/csv'
import { lookbackColor } from '../lib/lookback'
import { BIAS_LABEL } from '../lib/bias'
import { PageTitle } from '../components/PageTitle'
import type { Trade, TradeSide, TradeStatus } from '../types'

const MONTHS_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]
const STATUS_LABEL: Record<TradeStatus, string> = { WIN: 'Win', LOSS: 'Loss', WASH: 'BE' }
const STATUS_TAG: Record<TradeStatus, string> = { WIN: 'tag-green', LOSS: 'tag-red', WASH: '' }
const csv = (s: string | null) => (s ? s.split(',').filter(Boolean) : [])
const LIQ_LABEL: Record<string, string> = { buyside: 'Buyside', sellside: 'Sellside', none: 'לא נלקחה' }
const LIQ_TAG: Record<string, string> = { buyside: 'tag-blue', sellside: 'tag-orange', none: '' }
const ZONE_LABEL: Record<string, string> = { premium: 'Premium', deadzone: 'Deadzone', discount: 'Discount' }
const ZONE_TAG: Record<string, string> = { premium: 'tag-red', deadzone: '', discount: 'tag-green' }

const pnlCls = (v: number) => (v > 0 ? 'text-win' : v < 0 ? 'text-loss' : 'text-muted')
const sideTag = (s: TradeSide) => (s === 'LONG' ? 'tag-blue' : 'tag-purple')
const sideLabel = (s: TradeSide) => (s === 'LONG' ? 'לונג' : 'שורט')
const dateShort = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(2, 4)}`
const monthTitle = (ym: string) => `${MONTHS_HE[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`
const Dash = () => <span className="text-[#d3d1cb]">—</span>

type View = 'table' | 'gallery'

export default function Trades() {
  const { trades, loading } = useTrades()
  const { active } = useJournals()
  const [showFilters, setShowFilters] = useState(false)

  // Filters (and the view) live in the URL so returning from a trade restores the exact view.
  const [searchParams, setSearchParams] = useSearchParams()
  const query = searchParams.get('q') ?? ''
  const view: View = searchParams.get('view') === 'gallery' ? 'gallery' : 'table'
  const grouped = searchParams.get('group') !== 'none'
  const symbolSel = useMemo(() => new Set(csv(searchParams.get('sym'))), [searchParams])
  const statusSel = useMemo(() => new Set(csv(searchParams.get('status')) as TradeStatus[]), [searchParams])
  const sideSel = useMemo(() => new Set(csv(searchParams.get('side')) as TradeSide[]), [searchParams])
  const monthSel = useMemo(() => new Set(csv(searchParams.get('months'))), [searchParams])
  const yearSel = useMemo(() => new Set(csv(searchParams.get('years'))), [searchParams])

  const setParams = (mut: (p: URLSearchParams) => void) => {
    const next = new URLSearchParams(searchParams)
    mut(next)
    setSearchParams(next, { replace: true })
  }
  const toggleParam = (key: string, val: string) => {
    const cur = new Set(csv(searchParams.get(key)))
    cur.has(val) ? cur.delete(val) : cur.add(val)
    setParams((p) => (cur.size ? p.set(key, [...cur].join(',')) : p.delete(key)))
  }

  // Facet options derived from the current journal's trades.
  const symbols = useMemo(() => [...new Set(trades.map((t) => cleanSymbol(t.symbol)))].sort(), [trades])
  const months = useMemo(() => [...new Set(trades.map((t) => t.date.slice(0, 7)))].sort().reverse(), [trades])
  const years = useMemo(() => [...new Set(trades.map((t) => t.date.slice(0, 4)))].sort().reverse(), [trades])
  // Months to show in the facet: those of the selected years, else the latest year.
  const monthsForYear = yearSel.size
    ? months.filter((m) => yearSel.has(m.slice(0, 4)))
    : months.filter((m) => m.startsWith(years[0] ?? ''))
  const multiYear = new Set(monthsForYear.map((m) => m.slice(0, 4))).size > 1

  const activeCount = symbolSel.size + statusSel.size + sideSel.size + monthSel.size + yearSel.size
  const qs = searchParams.toString() // current filters, for the trade's "back" target
  const backState = { backTo: qs ? `/app/trades?${qs}` : '/app/trades', backLabel: 'חזרה לעסקאות' }

  const rows = useMemo(() => {
    return (
      trades
        .filter((t) => {
          if (symbolSel.size && !symbolSel.has(cleanSymbol(t.symbol))) return false
          if (statusSel.size && !statusSel.has(t.status)) return false
          if (sideSel.size && !sideSel.has(t.side)) return false
          if (yearSel.size && !yearSel.has(t.date.slice(0, 4))) return false
          if (monthSel.size && !monthSel.has(t.date.slice(0, 7))) return false
          if (query && !t.symbol.toLowerCase().includes(query.toLowerCase())) return false
          return true
        })
        // Newest first. Sort on the raw string (tz-independent) so the order
        // matches the displayed date exactly.
        .sort((a, b) => b.date.localeCompare(a.date))
    )
  }, [trades, symbolSel, statusSel, sideSel, yearSel, monthSel, query])

  // Summary of what's on screen — the filter answers a question, this is the answer.
  const summary = useMemo(() => {
    const s = computeStats(rows)
    const rs = rows.filter((t) => t.r_multiple != null)
    const avgR = rs.length ? rs.reduce((a, t) => a + (t.r_multiple ?? 0), 0) / rs.length : null
    return { ...s, avgR }
  }, [rows])

  // Month groups (rows are already newest-first).
  const groups = useMemo(() => {
    const out: { ym: string; trades: Trade[]; net: number }[] = []
    for (const t of rows) {
      const ym = t.date.slice(0, 7)
      let g = out[out.length - 1]
      if (!g || g.ym !== ym) {
        g = { ym, trades: [], net: 0 }
        out.push(g)
      }
      g.trades.push(t)
      g.net += t.return_amount
    }
    return out
  }, [rows])

  function clearAll() {
    setParams((p) => {
      p.delete('sym')
      p.delete('status')
      p.delete('side')
      p.delete('years')
      p.delete('months')
    })
  }

  // Export the currently-visible (filtered) rows to CSV.
  function exportCsv() {
    const headers = ['תאריך', 'שעה', 'סימבול', 'כיוון', 'סטטוס', 'כניסה', 'יציאה', 'יציאה 2', 'כמות', 'יעד', 'סטופ', 'Lookback', 'נזילות', 'אזור', 'ביאס', 'R', 'P&L', 'הערות']
    const data = rows.map((t) => [
      `${t.date.slice(8, 10)}/${t.date.slice(5, 7)}/${t.date.slice(0, 4)}`,
      t.date.slice(11, 16),
      t.symbol,
      t.side,
      t.status,
      t.entry,
      t.exits?.[0] ?? t.exit ?? '',
      t.exits && t.exits.length > 1 ? t.exits[1] : '',
      t.qty,
      t.target ?? '',
      t.stoploss ?? '',
      t.lookback ?? '',
      t.liquidity ?? '',
      t.zone ?? '',
      t.bias ? BIAS_LABEL[t.bias] : '',
      t.r_multiple ?? '',
      t.return_amount,
      t.notes ?? '',
    ])
    downloadCsv(`${active.name}-עסקאות-${new Date().toISOString().slice(0, 10)}.csv`, headers, data)
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-muted">טוען עסקאות…</div>
  }

  // Active filters as removable chips.
  const chips: { key: string; val: string; label: string }[] = [
    ...[...symbolSel].map((v) => ({ key: 'sym', val: v, label: v })),
    ...[...statusSel].map((v) => ({ key: 'status', val: v, label: STATUS_LABEL[v] })),
    ...[...sideSel].map((v) => ({ key: 'side', val: v, label: sideLabel(v) })),
    ...[...yearSel].sort().map((v) => ({ key: 'years', val: v, label: v })),
    ...[...monthSel].sort().map((v) => ({ key: 'months', val: v, label: monthTitle(v) })),
  ]

  const facet = (on: boolean) =>
    `tag cursor-pointer !px-2.5 !py-0.5 !text-[13px] transition-colors ${on ? '!bg-ink !text-white' : 'hover:!bg-[#d9d8d5]'}`

  return (
    <div>
      <PageTitle
        icon={BookOpen}
        color="#337ea9"
        title="עסקאות"
        subtitle={
          <>
            <span className="num">{rows.length}</span> מתוך <span className="num">{trades.length}</span> עסקאות · {active.name}
          </>
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <button onClick={exportCsv} disabled={rows.length === 0} className="btn-ghost">
              <Download className="h-4 w-4" /> ייצוא
            </button>
            <Link to="/app/trades/from-image" className="btn-ghost">
              <Sparkles className="h-4 w-4" /> מתמונה
            </Link>
            <Link to="/app/trades/new" className="btn-primary">
              <Plus className="h-4 w-4" /> עסקה חדשה
            </Link>
          </div>
        }
      />

      {/* Summary of the current selection */}
      <div
        className="block-in mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4"
        style={{ '--i': 1 } as React.CSSProperties}
      >
        {[
          { k: 'P&L נטו', v: formatMoney(summary.netPnl), c: pnlCls(summary.netPnl) },
          { k: 'אחוז הצלחה', v: rows.length ? formatPct(summary.winRate) : '—', sub: `${summary.wins}W · ${summary.losses}L` },
          { k: 'R ממוצע', v: summary.avgR != null ? formatR(summary.avgR) : '—' },
          { k: 'תוחלת לעסקה', v: rows.length ? formatMoney(summary.expectancy) : '—', c: pnlCls(summary.expectancy) },
        ].map((s) => (
          <div key={s.k} className="flex flex-col gap-0.5 bg-bg px-4 py-3 sm:flex-row sm:items-baseline sm:justify-between sm:gap-2">
            <span className="text-[13px] text-muted">{s.k}</span>
            <span className={`num text-lg font-bold ${s.c ?? ''}`}>{s.v}</span>
          </div>
        ))}
      </div>

      {/* Database toolbar: views · filter · search */}
      <div className="mt-6 flex flex-wrap items-center gap-1 border-b border-border">
        {([
          { id: 'table', label: 'טבלה', icon: Table2 },
          { id: 'gallery', label: 'גלריה', icon: LayoutGrid },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setParams((p) => (t.id === 'table' ? p.delete('view') : p.set('view', t.id)))}
            aria-pressed={view === t.id}
            className={`-mb-px flex h-9 items-center gap-1.5 border-b-2 px-2.5 text-sm font-medium transition-colors ${
              view === t.id ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}

        <div className="mr-auto flex items-center gap-1 pb-1">
          {view === 'table' && (
            <button
              onClick={() => setParams((p) => (grouped ? p.set('group', 'none') : p.delete('group')))}
              aria-pressed={grouped}
              className={`hidden h-8 items-center rounded-md px-2 text-sm transition-colors sm:flex ${grouped ? 'text-accent' : 'text-muted hover:bg-surface'}`}
            >
              קיבוץ לפי חודש
            </button>
          )}
          <button
            onClick={() => setShowFilters((s) => !s)}
            aria-expanded={showFilters}
            className={`flex h-8 items-center gap-1.5 rounded-md px-2 text-sm transition-colors ${
              activeCount > 0 ? 'text-accent' : 'text-muted hover:bg-surface'
            }`}
          >
            <SlidersHorizontal className="h-4 w-4" />
            סינון
            {activeCount > 0 && <span className="num rounded bg-accent px-1.5 text-xs font-bold text-white">{activeCount}</span>}
          </button>
          <label className="relative flex items-center">
            <Search className="pointer-events-none absolute right-2 h-4 w-4 text-muted" />
            <input
              value={query}
              onChange={(e) => setParams((p) => (e.target.value ? p.set('q', e.target.value) : p.delete('q')))}
              placeholder="חיפוש סימבול"
              aria-label="חיפוש סימבול"
              className="h-8 w-32 rounded-md bg-transparent pr-8 text-sm outline-none transition-all placeholder:text-faint focus:w-44 focus:bg-surface"
            />
          </label>
        </div>
      </div>

      {/* Active filter chips */}
      {chips.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 py-2.5">
          {chips.map((c) => (
            <button
              key={c.key + c.val}
              onClick={() => toggleParam(c.key, c.val)}
              className="tag tag-blue group !py-0.5 !text-[13px]"
              aria-label={`הסר סינון ${c.label}`}
            >
              {c.label}
              <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
            </button>
          ))}
          <button onClick={clearAll} className="px-1 text-[13px] text-muted hover:text-loss">
            נקה הכל
          </button>
        </div>
      )}

      {/* Filter panel */}
      {showFilters && (
        <div className="animate-[fade-up_.3s_var(--ease-out-expo)_both] mt-3 grid gap-4 rounded-lg border border-border bg-surface/60 p-4 sm:grid-cols-2">
          <FacetGroup label="סימבול">
            {symbols.map((s) => (
              <button key={s} className={facet(symbolSel.has(s))} onClick={() => toggleParam('sym', s)}>{s}</button>
            ))}
          </FacetGroup>
          <FacetGroup label="תוצאה">
            {(['WIN', 'LOSS', 'WASH'] as TradeStatus[]).map((s) => (
              <button key={s} className={facet(statusSel.has(s))} onClick={() => toggleParam('status', s)}>{STATUS_LABEL[s]}</button>
            ))}
          </FacetGroup>
          <FacetGroup label="כיוון">
            {(['LONG', 'SHORT'] as TradeSide[]).map((s) => (
              <button key={s} className={facet(sideSel.has(s))} onClick={() => toggleParam('side', s)}>{sideLabel(s)}</button>
            ))}
          </FacetGroup>
          <FacetGroup label="שנה">
            {years.map((y) => (
              <button key={y} className={`num ${facet(yearSel.has(y))}`} onClick={() => toggleParam('years', y)}>{y}</button>
            ))}
          </FacetGroup>
          <div className="sm:col-span-2">
            <FacetGroup label="חודש">
              {monthsForYear.map((m) => (
                <button key={m} className={facet(monthSel.has(m))} onClick={() => toggleParam('months', m)}>
                  {MONTHS_HE[Number(m.slice(5, 7)) - 1]}
                  {multiYear ? <span className="num"> {m.slice(2, 4)}</span> : ''}
                </button>
              ))}
            </FacetGroup>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="py-16 text-center text-muted">
          {trades.length === 0 ? 'היומן הזה עדיין ריק.' : 'לא נמצאו עסקאות שתואמות לסינון.'}
        </div>
      ) : view === 'gallery' ? (
        <Gallery rows={rows} backState={backState} />
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="w-full min-w-[1160px] text-sm">
              <thead>
                <tr className="h-9 border-b border-border text-right text-[13px] text-muted [&>th]:px-2 [&>th]:font-normal">
                  <th>תאריך</th>
                  <th>סימבול</th>
                  <th>כיוון</th>
                  <th>תוצאה</th>
                  <th className="!text-left">כניסה</th>
                  <th className="!text-left">יציאה</th>
                  <th className="!text-left">יציאה 2</th>
                  <th>Lookback</th>
                  <th>נזילות</th>
                  <th>אזור</th>
                  <th>ביאס</th>
                  <th className="!text-left">R</th>
                  <th className="!text-left">P&amp;L</th>
                </tr>
              </thead>
              <tbody>
                {(grouped ? groups : [{ ym: '', trades: rows, net: 0 }]).map((g, gi) => (
                  <Fragment key={g.ym || 'all'}>
                    {grouped && (
                      <tr className="border-b border-border">
                        <td colSpan={13} className="px-2 pb-2 pt-5">
                          <div className="flex items-center gap-2">
                            <ChevronDown className="h-4 w-4 text-muted" />
                            <span className="font-semibold">{monthTitle(g.ym)}</span>
                            <span className="num text-muted">{g.trades.length}</span>
                            <span className={`tag num !font-semibold ${g.net > 0 ? 'tag-green' : g.net < 0 ? 'tag-red' : ''}`}>
                              {formatMoney(g.net)}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                    {g.trades.map((t, i) => (
                      <TableRow key={t.id} t={t} backState={backState} delay={gi === 0 ? Math.min(i, 14) : -1} />
                    ))}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Phone: one card per trade */}
          <div className="flex flex-col sm:hidden">
            {groups.map((g) => (
              <Fragment key={g.ym}>
                <div className="flex items-center gap-2 px-1 pb-1.5 pt-4 text-sm">
                  <span className="font-semibold">{monthTitle(g.ym)}</span>
                  <span className="num text-muted">{g.trades.length}</span>
                  <span className={`tag num mr-auto !font-semibold ${g.net > 0 ? 'tag-green' : g.net < 0 ? 'tag-red' : ''}`}>{formatMoney(g.net)}</span>
                </div>
                {g.trades.map((t) => (
                  <Link
                    key={t.id}
                    to={`/app/trades/${t.id}`}
                    state={backState}
                    className="flex items-center gap-3 border-b border-[#f1f0ed] px-1 py-3 active:bg-surface"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold">{cleanSymbol(t.symbol)}</span>
                        <span className={`tag ${sideTag(t.side)}`}>{sideLabel(t.side)}</span>
                        <span className={`tag ${STATUS_TAG[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                      </div>
                      <div className="num mt-0.5 text-right text-xs text-muted">
                        {dateShort(t.date)} · {t.date.slice(11, 16)}
                        {t.lookback && ` · ${t.lookback}`}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className={`num font-bold ${pnlCls(t.return_amount)}`}>{formatMoney(t.return_amount)}</div>
                      <div className="num text-xs text-muted">{formatR(t.r_multiple)}</div>
                    </div>
                  </Link>
                ))}
              </Fragment>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function TableRow({ t, backState, delay }: { t: Trade; backState: object; delay: number }) {
  const navigate = useNavigate()
  const hasShot = !!t.images?.length
  return (
    <tr
      // The whole row opens the trade; the date cell is the keyboard-focusable link.
      onClick={() => navigate(`/app/trades/${t.id}`, { state: backState })}
      className="group h-11 cursor-pointer border-b border-[#f1f0ed] transition-colors hover:bg-[#f7f6f3] [&>td]:px-2"
      style={delay >= 0 ? { animation: `fade-up .45s var(--ease-out-expo) ${delay * 25}ms both` } : undefined}
    >
      <td>
        <Link to={`/app/trades/${t.id}`} state={backState} className="flex items-baseline gap-2" onClick={(e) => e.stopPropagation()}>
          <span className="num font-medium text-ink group-hover:underline">{dateShort(t.date)}</span>
          {t.date.length >= 16 && <span className="num text-xs text-muted">{t.date.slice(11, 16)}</span>}
          {hasShot && <Camera className="h-3.5 w-3.5 self-center text-faint" aria-label="יש צילום מסך" />}
        </Link>
      </td>
      <td className="font-semibold">{t.symbol}</td>
      <td>
        <span className={`tag ${sideTag(t.side)}`}>{sideLabel(t.side)}</span>
      </td>
      <td>
        <span className={`tag ${STATUS_TAG[t.status]}`}>{STATUS_LABEL[t.status]}</span>
      </td>
      <td className="num text-left text-[#5f5e5b]">{t.entry}</td>
      <td className="num text-left text-[#5f5e5b]">{t.exits?.[0] ?? <Dash />}</td>
      <td className="num text-left">{t.exits && t.exits.length > 1 ? <span className="font-medium text-accent">{t.exits[1]}</span> : <Dash />}</td>
      <td>
        {t.lookback ? (
          <span className={`tag num ${lookbackColor(t.lookback) === '#5B9DF9' ? 'tag-blue' : 'tag-red'}`} dir="ltr">
            {t.lookback}
          </span>
        ) : (
          <Dash />
        )}
      </td>
      <td>{t.liquidity ? <span className={`tag ${LIQ_TAG[t.liquidity]}`}>{LIQ_LABEL[t.liquidity]}</span> : <Dash />}</td>
      <td>{t.zone ? <span className={`tag ${ZONE_TAG[t.zone]}`}>{ZONE_LABEL[t.zone]}</span> : <Dash />}</td>
      <td className="max-w-[150px]">
        {t.bias ? (
          <span className="tag tag-purple max-w-full truncate" title={BIAS_LABEL[t.bias]}>
            {BIAS_LABEL[t.bias]}
          </span>
        ) : (
          <Dash />
        )}
      </td>
      <td className="num text-left text-[#5f5e5b]">{t.r_multiple != null ? formatR(t.r_multiple) : <Dash />}</td>
      <td className={`num text-left font-semibold ${pnlCls(t.return_amount)}`}>{formatMoney(t.return_amount)}</td>
    </tr>
  )
}

function Gallery({ rows, backState }: { rows: Trade[]; backState: object }) {
  // Render in pages so 300 screenshots don't all decode at once.
  const [limit, setLimit] = useState(24)
  const shown = rows.slice(0, limit)
  return (
    <div className="pt-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {shown.map((t, i) => (
          <Link
            key={t.id}
            to={`/app/trades/${t.id}`}
            state={backState}
            className="panel overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-10px_rgba(15,15,15,.25)]"
            style={{ animation: `fade-up .45s var(--ease-out-expo) ${Math.min(i % 24, 12) * 30}ms both` }}
          >
            {t.images?.length ? (
              <img
                src={imageUrl(t.images[0])}
                alt={`צילום מסך: ${cleanSymbol(t.symbol)} ${dateShort(t.date)}`}
                loading="lazy"
                className="h-36 w-full border-b border-border bg-surface object-cover"
                style={{ objectPosition: '50% 30%' }}
              />
            ) : (
              <div className="flex h-36 items-center justify-center border-b border-border bg-surface text-faint">
                <ImageOff className="h-6 w-6" />
              </div>
            )}
            <div className="flex flex-col gap-2 px-3 py-2.5">
              <div className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-semibold">
                  {cleanSymbol(t.symbol)} · <span className="num">{dateShort(t.date)}</span>
                </span>
                <span className={`num shrink-0 font-bold ${pnlCls(t.return_amount)}`}>{formatMoney(t.return_amount)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <span className={`tag ${sideTag(t.side)}`}>{sideLabel(t.side)}</span>
                <span className={`tag ${STATUS_TAG[t.status]}`}>{STATUS_LABEL[t.status]}</span>
                {t.r_multiple != null && <span className="tag num">{formatR(t.r_multiple)}</span>}
                {t.lookback && <span className="tag num" dir="ltr">{t.lookback}</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
      {limit < rows.length && (
        <div className="mt-6 flex justify-center">
          <button onClick={() => setLimit((l) => l + 24)} className="btn-ghost">
            הצג עוד ({rows.length - limit})
          </button>
        </div>
      )}
    </div>
  )
}

function FacetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-xs font-semibold text-muted">{label}</div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  )
}
