import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Plus, Sparkles, SlidersHorizontal, X } from 'lucide-react'
import { useTrades } from '../lib/useTrades'
import { formatMoney, formatR, cleanSymbol } from '../lib/trades'
import { SideIndicator } from '../components/SideIndicator'
import type { TradeSide, TradeStatus } from '../types'

const MONTHS_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]
const STATUS_LABEL: Record<TradeStatus, string> = { WIN: 'רווח', LOSS: 'הפסד', WASH: 'Wash' }

const GRID =
  'grid grid-cols-[1fr_auto] gap-2 sm:grid-cols-[92px_56px_60px_64px_72px_72px_64px_70px_66px_52px_90px] sm:justify-between'

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`num rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? 'border-accent/50 bg-accent/15 text-accent' : 'border-black/[0.12] text-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

export default function Trades() {
  const { trades, loading } = useTrades()
  const [query, setQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [symbolSel, setSymbolSel] = useState<Set<string>>(new Set())
  const [statusSel, setStatusSel] = useState<Set<TradeStatus>>(new Set())
  const [sideSel, setSideSel] = useState<Set<TradeSide>>(new Set())
  const [monthSel, setMonthSel] = useState<Set<string>>(new Set())
  const [filterYear, setFilterYear] = useState<string | null>(null)

  // Facet options derived from the current journal's trades.
  const symbols = useMemo(
    () => [...new Set(trades.map((t) => cleanSymbol(t.symbol)))].sort(),
    [trades],
  )
  const months = useMemo(
    () => [...new Set(trades.map((t) => t.date.slice(0, 7)))].sort().reverse(),
    [trades],
  )
  const years = useMemo(
    () => [...new Set(trades.map((t) => t.date.slice(0, 4)))].sort().reverse(),
    [trades],
  )
  const activeYear = filterYear && years.includes(filterYear) ? filterYear : years[0]
  const monthsForYear = months.filter((m) => m.startsWith(activeYear ?? ''))

  const activeCount = symbolSel.size + statusSel.size + sideSel.size + monthSel.size

  const rows = useMemo(() => {
    return trades
      .filter((t) => {
        if (symbolSel.size && !symbolSel.has(cleanSymbol(t.symbol))) return false
        if (statusSel.size && !statusSel.has(t.status)) return false
        if (sideSel.size && !sideSel.has(t.side)) return false
        if (monthSel.size && !monthSel.has(t.date.slice(0, 7))) return false
        if (query && !t.symbol.toLowerCase().includes(query.toLowerCase())) return false
        return true
      })
      // Newest first. Sort on the raw string (tz-independent) so the order
      // matches the displayed date exactly.
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [trades, symbolSel, statusSel, sideSel, monthSel, query])

  function toggle<T>(setFn: (s: Set<T>) => void, cur: Set<T>, val: T) {
    const next = new Set(cur)
    next.has(val) ? next.delete(val) : next.add(val)
    setFn(next)
  }
  function clearAll() {
    setSymbolSel(new Set())
    setStatusSel(new Set())
    setSideSel(new Set())
    setMonthSel(new Set())
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-muted">טוען עסקאות…</div>
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">עסקאות</h1>
          <p className="text-muted">{rows.length} מתוך {trades.length} עסקאות</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to="/app/trades/from-image" className="btn-secondary">
            <Sparkles className="h-4 w-4" /> מתמונה
          </Link>
          <Link to="/app/trades/new" className="btn-primary">
            <Plus className="h-4 w-4" /> עסקה חדשה
          </Link>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => setShowFilters((s) => !s)}
          className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
            showFilters || activeCount > 0
              ? 'border-accent/50 bg-accent/10 text-accent'
              : 'border-black/[0.12] bg-black/[0.02] text-muted hover:text-ink'
          }`}
        >
          <SlidersHorizontal className="h-4 w-4" />
          סינון
          {activeCount > 0 && (
            <span className="num flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-bold text-bg">
              {activeCount}
            </span>
          )}
        </button>
        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חפש סימבול…"
            className="input w-56 pr-9"
          />
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="card space-y-4">
          <FacetGroup label="סימבול">
            {symbols.map((s) => (
              <Chip key={s} active={symbolSel.has(s)} onClick={() => toggle(setSymbolSel, symbolSel, s)}>{s}</Chip>
            ))}
          </FacetGroup>
          <FacetGroup label="סטטוס">
            {(['WIN', 'LOSS', 'WASH'] as TradeStatus[]).map((s) => (
              <Chip key={s} active={statusSel.has(s)} onClick={() => toggle(setStatusSel, statusSel, s)}>{STATUS_LABEL[s]}</Chip>
            ))}
          </FacetGroup>
          <FacetGroup label="כיוון">
            {(['LONG', 'SHORT'] as TradeSide[]).map((s) => (
              <Chip key={s} active={sideSel.has(s)} onClick={() => toggle(setSideSel, sideSel, s)}>{s === 'LONG' ? 'Long' : 'Short'}</Chip>
            ))}
          </FacetGroup>
          <FacetGroup label="שנה">
            {years.map((y) => (
              <Chip key={y} active={activeYear === y} onClick={() => setFilterYear(y)}>{y}</Chip>
            ))}
          </FacetGroup>
          <FacetGroup label="חודש">
            {monthsForYear.map((m) => (
              <Chip key={m} active={monthSel.has(m)} onClick={() => toggle(setMonthSel, monthSel, m)}>
                {MONTHS_HE[Number(m.slice(5, 7)) - 1]}
              </Chip>
            ))}
          </FacetGroup>
          {activeCount > 0 && (
            <button onClick={clearAll} className="inline-flex items-center gap-1 text-sm text-muted hover:text-loss">
              <X className="h-4 w-4" /> נקה סינון ({activeCount})
            </button>
          )}
        </div>
      )}

      {/* Table */}
      <div className="panel overflow-hidden">
        <div className="overflow-x-auto">
          <div className="sm:min-w-[880px]">
            <div className={`${GRID} border-b border-black/[0.08] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted`}>
              <span>תאריך</span>
              <span className="hidden sm:block">סימבול</span>
              <span className="hidden sm:block">כיוון</span>
              <span className="hidden sm:block">סטטוס</span>
              <span className="hidden text-left sm:block">כניסה</span>
              <span className="hidden text-left sm:block">יציאה</span>
              <span className="hidden text-left sm:block">יציאה 2</span>
              <span className="hidden text-left sm:block">Lookback</span>
              <span className="hidden text-left sm:block">שיא</span>
              <span className="hidden text-left sm:block">R</span>
              <span className="text-left">P&amp;L</span>
            </div>
            <div className="divide-y divide-black/[0.06]">
              {rows.map((t) => {
                const win = t.return_amount > 0
                return (
                  <Link
                    key={t.id}
                    to={`/app/trades/${t.id}`}
                    className={`${GRID} group items-center px-4 py-3 text-sm transition-colors hover:bg-black/[0.03]`}
                  >
                    <span className="text-muted">
                      <span className="num block">{`${t.date.slice(8, 10)}/${t.date.slice(5, 7)}/${t.date.slice(2, 4)}`}</span>
                      {t.date.length >= 16 && (
                        <span className="num block text-xs text-muted/70">{t.date.slice(11, 16)}</span>
                      )}
                    </span>
                    <span className="hidden font-medium sm:block">{t.symbol}</span>
                    <span className="hidden sm:block">
                      <SideIndicator side={t.side} />
                    </span>
                    <span className={`hidden text-xs font-medium sm:block ${t.status === 'WIN' ? 'text-win' : t.status === 'LOSS' ? 'text-loss' : 'text-muted'}`}>
                      {t.status}
                    </span>
                    <span className="hidden text-left num text-muted sm:block">{t.entry}</span>
                    <span className="hidden text-left num text-muted sm:block">{t.exits?.[0] ?? '—'}</span>
                    <span className="hidden text-left num sm:block">
                      {t.exits && t.exits.length > 1 ? (
                        <span className="text-accent-2">{t.exits[1]}</span>
                      ) : (
                        <span className="text-muted/40">—</span>
                      )}
                    </span>
                    <span className="hidden text-left num text-muted sm:block" dir="ltr">
                      {t.lookback ?? <span className="text-muted/40">—</span>}
                    </span>
                    <span className="hidden text-left num text-muted sm:block">
                      {t.peak_price ?? <span className="text-muted/40">—</span>}
                    </span>
                    <span className="hidden text-left num sm:block">
                      {t.r_multiple != null ? formatR(t.r_multiple).replace('R', '') : '—'}
                    </span>
                    <span className={`text-left font-semibold num ${win ? 'text-win' : t.return_amount < 0 ? 'text-loss' : 'text-muted'}`}>
                      {formatMoney(t.return_amount)}
                    </span>
                  </Link>
                )
              })}
              {rows.length === 0 && (
                <div className="px-4 py-12 text-center text-muted">
                  {trades.length === 0 ? 'היומן הזה עדיין ריק.' : 'לא נמצאו עסקאות שתואמות לסינון.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FacetGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="field-label mb-2">{label}</div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  )
}
