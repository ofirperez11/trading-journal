import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  ImagePlus,
  Download,
  PenLine,
  Lightbulb,
  LineChart,
  Table2,
  LayoutGrid,
  Columns3,
} from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useJournals } from '../lib/journals'
import { useTrades } from '../lib/useTrades'
import {
  computeStats,
  buildEquityCurve,
  formatMoney,
  formatPct,
  formatR,
  cleanSymbol,
  imageUrl,
} from '../lib/trades'
import { EquityCurve } from '../components/EquityCurve'
import { CountUp } from '../components/CountUp'
import type { Trade } from '../types'

const MONTHS_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]
const WEEKDAYS_HE = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת']
const WEEKDAYS_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳']

// Trade dates are wall-clock strings — read the parts, never shift timezones.
const ymdOf = (iso: string) => iso.slice(0, 10)
const shortDate = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.${iso.slice(0, 4)}`
const weekdayOf = (iso: string) =>
  new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10))).getDay()

type Tone = 'green' | 'red' | 'gray'
const toneOf = (pnl: number): Tone => (pnl > 0 ? 'green' : pnl < 0 ? 'red' : 'gray')
const resultLabel: Record<Tone, string> = { green: 'Win', red: 'Loss', gray: 'BE' }
const pnlText: Record<Tone, string> = { green: 'text-win', red: 'text-loss', gray: 'text-muted' }

type View = 'table' | 'gallery' | 'board'

export default function Dashboard() {
  const { user } = useAuth()
  const { active } = useJournals()
  const { trades, loading } = useTrades()
  const name =
    (user?.user_metadata?.display_name as string | undefined) ?? user?.email?.split('@')[0] ?? 'Trader'

  const { stats, equity } = useMemo(
    () => ({ stats: computeStats(trades), equity: buildEquityCurve(trades) }),
    [trades],
  )

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-muted">טוען את העסקאות שלך…</div>
  }

  if (trades.length === 0) {
    return (
      <div className="space-y-6">
        <PageHeader title={active.name} subtitle={`שלום, ${name}`} />
        <div className="callout">
          <Lightbulb className="mt-1 h-5 w-5 shrink-0 text-[#cb912f]" />
          <span>
            היומן "{active.name}" עדיין ריק. כאן תופיע הסקירה ברגע שיהיו עסקאות: אפשר להוסיף עסקה ידנית,
            לנתח צילום מסך או לייבא CSV מ-Tradovate.
          </span>
        </div>
        <QuickActions />
      </div>
    )
  }

  const sorted = [...trades].sort((a, b) => b.date.localeCompare(a.date))
  const first = sorted[sorted.length - 1]
  const last = sorted[0]
  const symbols = [...new Set(trades.map((t) => cleanSymbol(t.symbol)))].slice(0, 4)

  return (
    <div>
      <PageHeader
        title={active.name}
        subtitle={`שלום, ${name}. הנה איפה אתה עומד.`}
        props={[
          {
            k: 'שווקים',
            v: (
              <span className="flex flex-wrap gap-1.5">
                {symbols.map((s, i) => (
                  <span key={s} className={`tag ${['tag-blue', 'tag-purple', 'tag-pink', 'tag-brown'][i]}`}>
                    {s}
                  </span>
                ))}
              </span>
            ),
          },
          {
            k: 'תקופה',
            v: (
              <span>
                {MONTHS_HE[Number(first.date.slice(5, 7)) - 1]} {first.date.slice(0, 4)} ←{' '}
                {MONTHS_HE[Number(last.date.slice(5, 7)) - 1]} {last.date.slice(0, 4)} ·{' '}
                <span className="num">{stats.totalTrades}</span> עסקאות
              </span>
            ),
          },
        ]}
      />

      <LinkBar />

      <div className="mt-7 grid gap-7 lg:grid-cols-[270px_minmax(0,1fr)]">
        <div className="flex flex-col gap-6">
          <div className="block-in" style={{ '--i': 3 } as React.CSSProperties}>
            <QuickActions />
          </div>
          <PerformanceRadar trades={trades} stats={stats} />
        </div>

        <div className="flex min-w-0 flex-col gap-5">
          <Kpis stats={stats} />
          <MonthCalendar trades={trades} initial={last.date} />
        </div>
      </div>

      <Insight trades={trades} stats={stats} />

      <section className="block-in mt-8" style={{ '--i': 6 } as React.CSSProperties}>
        <div className="mb-2 flex items-center gap-2">
          <LineChart className="h-5 w-5 text-win" />
          <h2 className="text-xl">עקומת הון</h2>
          <span className="tag mr-auto">P&amp;L מצטבר · {stats.totalTrades} עסקאות</span>
        </div>
        <div className="panel p-4">
          <EquityCurve data={equity} height={260} format={(n) => formatMoney(n)} draw />
        </div>
      </section>

      <RecentTrades trades={sorted} />
    </div>
  )
}

/* ------------------------------------------------------------------------ */

function PageHeader({
  title,
  subtitle,
  props = [],
}: {
  title: string
  subtitle: string
  props?: { k: string; v: React.ReactNode }[]
}) {
  return (
    <header>
      <div className="block-in -mt-[72px] mb-4 flex h-[78px] w-[78px] items-center justify-center rounded-[14px] bg-bg shadow-[0_0_0_1px_#ededeb,0_6px_16px_-8px_rgba(15,15,15,.25)]">
        <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#2f855a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M3 3v18h18" />
          <path d="M7 15l4-4 3 3 6-7" />
        </svg>
      </div>
      <h1 className="page-title block-in" style={{ '--i': 1 } as React.CSSProperties}>
        {title}
      </h1>
      <p className="block-in mt-1 text-muted" style={{ '--i': 1 } as React.CSSProperties}>
        {subtitle}
      </p>
      {props.length > 0 && (
        <dl
          className="block-in mt-4 grid grid-cols-[110px_minmax(0,1fr)] gap-y-1.5 text-sm"
          style={{ '--i': 2 } as React.CSSProperties}
        >
          {props.map((p) => (
            <div key={p.k} className="contents">
              <dt className="text-muted">{p.k}</dt>
              <dd>{p.v}</dd>
            </div>
          ))}
        </dl>
      )}
    </header>
  )
}

const LINKS = [
  { to: '/app/analytics', label: 'אנליטיקה', color: '#9065b0' },
  { to: '/app/trades', label: 'מאגר עסקאות', color: '#337ea9' },
  { to: '/app/calendar', label: 'לוח שנה', color: '#cb912f' },
  { to: '/app/summary', label: 'סיכום שבועי', color: '#d9730d' },
  { to: '/app/journal', label: 'יומן אישי', color: '#c14c8a' },
]

function LinkBar() {
  return (
    <nav
      aria-label="עמודי היומן"
      className="block-in mt-6 grid grid-cols-2 gap-1 rounded-lg border border-border p-1 sm:grid-cols-5"
      style={{ '--i': 2 } as React.CSSProperties}
    >
      {LINKS.map((l) => (
        <Link
          key={l.to}
          to={l.to}
          className="flex h-9 items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors hover:bg-[#f1f1ef]"
        >
          <span className="h-2 w-2 rounded-sm" style={{ background: l.color }} />
          {l.label}
        </Link>
      ))}
    </nav>
  )
}

function QuickActions() {
  const items = [
    { to: '/app/trades/new', label: 'עסקה חדשה', icon: Plus },
    { to: '/app/trades/from-image', label: 'עסקה מצילום מסך', icon: ImagePlus },
    { to: '/app/import', label: 'ייבוא CSV', icon: Download },
    { to: '/app/journal', label: 'כתיבה ביומן', icon: PenLine },
  ]
  return (
    <section>
      <h2 className="mb-1.5 text-[15px] font-semibold">פעולות מהירות</h2>
      <div className="flex flex-col">
        {items.map((it) => (
          <Link
            key={it.to}
            to={it.to}
            className="flex h-9 items-center gap-2.5 rounded-md px-2 text-sm transition-colors hover:bg-[#f1f1ef]"
          >
            <it.icon className="h-4 w-4 text-muted" strokeWidth={2} />
            {it.label}
          </Link>
        ))}
      </div>
    </section>
  )
}

function Kpis({ stats }: { stats: ReturnType<typeof computeStats> }) {
  const cards = [
    {
      label: 'Net P&L',
      ico: '$',
      tag: 'tag-green',
      value: <CountUp value={stats.netPnl} format={(n) => formatMoney(n)} />,
      cls: stats.netPnl >= 0 ? 'text-win' : 'text-loss',
      sub: `${stats.totalTrades} עסקאות`,
    },
    {
      label: 'אחוז הצלחה',
      ico: '%',
      tag: 'tag-blue',
      value: formatPct(stats.winRate),
      sub: `${stats.wins}W · ${stats.losses}L`,
    },
    {
      label: 'Profit Factor',
      ico: 'PF',
      tag: 'tag-purple',
      value: stats.profitFactor ? stats.profitFactor.toFixed(2) : '—',
      sub: 'רווח גולמי / הפסד גולמי',
    },
    {
      label: 'ניצחון / הפסד',
      ico: '×',
      tag: 'tag-yellow',
      value: stats.avgWinLossRatio ? stats.avgWinLossRatio.toFixed(2) : '—',
      sub: `${formatMoney(stats.avgWin)} / ${formatMoney(-stats.avgLoss)}`,
    },
  ]
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {cards.map((c, i) => (
        <div
          key={c.label}
          className="panel block-in flex flex-col gap-1 px-4 py-3.5"
          style={{ '--i': 3 + i * 0.5 } as React.CSSProperties}
        >
          <div className="flex items-center justify-between text-[13px] text-muted">
            <span>{c.label}</span>
            <span className={`tag ${c.tag} h-5 min-w-5 justify-center !px-1 text-[11px] font-bold`}>{c.ico}</span>
          </div>
          <div className={`num text-right text-2xl font-bold ${c.cls ?? ''}`}>{c.value}</div>
          <div className="num text-right text-xs text-faint">{c.sub}</div>
        </div>
      ))}
    </div>
  )
}

/* ---- Performance radar ------------------------------------------------- */

function PerformanceRadar({ trades, stats }: { trades: Trade[]; stats: ReturnType<typeof computeStats> }) {
  const greenMonths = useMemo(() => {
    const m = new Map<string, number>()
    for (const t of trades) m.set(t.date.slice(0, 7), (m.get(t.date.slice(0, 7)) ?? 0) + t.return_amount)
    const vals = [...m.values()]
    return { green: vals.filter((v) => v > 0).length, total: vals.length }
  }, [trades])

  const axes = [
    { label: 'אחוז הצלחה', v: stats.winRate, show: formatPct(stats.winRate) },
    { label: 'Profit Factor', v: Math.min((stats.profitFactor ?? 0) / 8, 1), show: stats.profitFactor?.toFixed(2) ?? '—' },
    { label: 'ניצחון/הפסד', v: Math.min((stats.avgWinLossRatio ?? 0) / 6, 1), show: stats.avgWinLossRatio?.toFixed(2) ?? '—' },
    {
      label: 'חודשים ירוקים',
      v: greenMonths.total ? greenMonths.green / greenMonths.total : 0,
      show: `${greenMonths.green}/${greenMonths.total}`,
    },
    { label: 'רצף ניצחונות', v: Math.min(stats.maxWinStreak / 10, 1), show: String(stats.maxWinStreak) },
  ]
  const cx = 150
  const cy = 118
  const R = 72
  const pt = (i: number, f: number) => {
    const a = ((-90 + i * 72) * Math.PI) / 180
    return [cx + Math.cos(a) * R * f, cy + Math.sin(a) * R * f] as const
  }
  const poly = (f: (i: number) => number) => axes.map((_, i) => pt(i, f(i)).join(',')).join(' ')

  return (
    <section
      className="panel block-in flex flex-col items-center p-4"
      style={{ '--i': 4 } as React.CSSProperties}
    >
      <h2 className="self-start text-[15px] font-semibold">פרופיל ביצועים</h2>
      <svg width="300" height="244" viewBox="0 0 300 244" className="max-w-full" style={{ direction: 'ltr' }} role="img" aria-label="פרופיל ביצועים">
        <g fill="none" stroke="#e3e2e0">
          {[1, 0.66, 0.33].map((f) => (
            <polygon key={f} points={poly(() => f)} />
          ))}
          {axes.map((_, i) => {
            const [x, y] = pt(i, 1)
            return <line key={i} x1={cx} y1={cy} x2={x} y2={y} />
          })}
        </g>
        <polygon
          points={poly((i) => Math.max(axes[i].v, 0.04))}
          fill="#2f855a"
          fillOpacity={0.2}
          stroke="#2f855a"
          strokeWidth={2}
          strokeLinejoin="round"
          className="origin-center [transform-box:fill-box]"
          style={{ animation: 'fade-up .9s var(--ease-out-expo) .3s both' }}
        />
        {axes.map((a, i) => {
          const [x, y] = pt(i, 1.28)
          return (
            <text key={a.label} x={x} y={y} textAnchor="middle" fontSize="11" fill="#5f5e5b">
              <tspan x={x} dy={i === 0 ? -2 : 2}>{a.label}</tspan>
              <tspan x={x} dy="13" fontWeight={700} fill="#37352f">{a.show}</tspan>
            </text>
          )
        })}
      </svg>
    </section>
  )
}

/* ---- Month calendar ---------------------------------------------------- */

function MonthCalendar({ trades, initial }: { trades: Trade[]; initial: string }) {
  const [ym, setYm] = useState({ y: Number(initial.slice(0, 4)), m: Number(initial.slice(5, 7)) - 1 })

  const byDay = useMemo(() => {
    const map = new Map<string, { net: number; count: number }>()
    for (const t of trades) {
      const k = ymdOf(t.date)
      const a = map.get(k) ?? { net: 0, count: 0 }
      a.net += t.return_amount
      a.count += 1
      map.set(k, a)
    }
    return map
  }, [trades])

  const pad = (n: number) => String(n).padStart(2, '0')
  const firstDow = new Date(ym.y, ym.m, 1).getDay()
  const daysIn = new Date(ym.y, ym.m + 1, 0).getDate()
  const weeks = Math.ceil((firstDow + daysIn) / 7)
  const today = new Date()
  const isToday = (d: number) =>
    today.getFullYear() === ym.y && today.getMonth() === ym.m && today.getDate() === d

  let monthNet = 0
  const rows: { cells: ({ d: number; agg?: { net: number; count: number } } | null)[]; net: number; count: number }[] = []
  for (let w = 0; w < weeks; w++) {
    const cells: ({ d: number; agg?: { net: number; count: number } } | null)[] = []
    let net = 0
    let count = 0
    for (let c = 0; c < 7; c++) {
      const d = w * 7 + c - firstDow + 1
      if (d < 1 || d > daysIn) {
        cells.push(null)
        continue
      }
      const agg = byDay.get(`${ym.y}-${pad(ym.m + 1)}-${pad(d)}`)
      if (agg) {
        net += agg.net
        count += agg.count
      }
      cells.push({ d, agg })
    }
    monthNet += net
    rows.push({ cells, net, count })
  }

  const step = (delta: number) =>
    setYm(({ y, m }) => {
      const n = m + delta
      return { y: y + Math.floor(n / 12), m: ((n % 12) + 12) % 12 }
    })

  const cellTone: Record<Tone, string> = {
    green: 'bg-tag-green text-tag-green-fg',
    red: 'bg-tag-red text-tag-red-fg',
    gray: 'bg-tag-gray text-tag-gray-fg',
  }

  return (
    <section className="panel block-in overflow-hidden" style={{ '--i': 5 } as React.CSSProperties}>
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2.5">
        <button onClick={() => step(-1)} aria-label="חודש קודם" className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-[#f1f1ef]">
          <ChevronRight className="h-4 w-4" />
        </button>
        <h2 className="min-w-[96px] text-center text-[15px] font-semibold">
          {MONTHS_HE[ym.m]} {ym.y}
        </h2>
        <button onClick={() => step(1)} aria-label="חודש הבא" className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-[#f1f1ef]">
          <ChevronLeft className="h-4 w-4" />
        </button>
        <span className="mr-auto text-[13px] text-muted">החודש</span>
        <span className={`tag num font-semibold ${monthNet > 0 ? 'tag-green' : monthNet < 0 ? 'tag-red' : ''}`}>
          {formatMoney(monthNet)}
        </span>
      </div>
      <div className="grid grid-cols-8 border-b border-border text-xs text-muted">
        {WEEKDAYS_SHORT.map((d) => (
          <span key={d} className="px-2 py-1.5">{d}</span>
        ))}
        <span className="bg-surface px-2 py-1.5 font-semibold">שבוע</span>
      </div>
      <div className="grid grid-cols-8">
        {rows.map((row, w) => (
          <div key={w} className="contents">
            {row.cells.map((c, i) => {
              const tone = c?.agg ? toneOf(c.agg.net) : null
              return (
                <div
                  key={i}
                  className={`flex h-[64px] flex-col gap-0.5 border-b border-l border-[#f1f1ef] px-2 py-1.5 transition-shadow hover:shadow-[inset_0_0_0_1.5px_rgba(55,53,47,.2)] sm:h-[72px] ${tone ? cellTone[tone] : ''}`}
                  style={{ animation: `fade-up .4s var(--ease-out-expo) ${0.25 + (w * 8 + i) * 0.012}s both` }}
                >
                  {c && (
                    <>
                      <span
                        className={`num text-right text-xs ${isToday(c.d) ? 'font-bold text-[#eb5757]' : tone ? '' : 'text-muted'}`}
                      >
                        {c.d}
                      </span>
                      {c.agg && (
                        <>
                          <span className="hidden text-[11px] sm:block">{c.agg.count} עסקאות</span>
                          <span className="num text-right text-[12px] font-semibold sm:text-[13px]">
                            {formatMoney(c.agg.net)}
                          </span>
                        </>
                      )}
                    </>
                  )}
                </div>
              )
            })}
            <div className="flex h-[64px] flex-col justify-end gap-0.5 border-b border-[#f1f1ef] bg-surface px-2 py-1.5 sm:h-[72px]">
              {row.count > 0 && (
                <>
                  <span className="hidden text-[11px] text-muted sm:block">{row.count} עסקאות</span>
                  <span className={`num text-right text-[12px] font-semibold sm:text-[13px] ${pnlText[toneOf(row.net)]}`}>
                    {formatMoney(row.net)}
                  </span>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

/* ---- Insight callout --------------------------------------------------- */

function Insight({ trades, stats }: { trades: Trade[]; stats: ReturnType<typeof computeStats> }) {
  const days = useMemo(() => {
    const agg = new Map<number, { w: number; l: number }>()
    for (const t of trades) {
      const d = weekdayOf(t.date)
      const a = agg.get(d) ?? { w: 0, l: 0 }
      if (t.return_amount > 0) a.w++
      else if (t.return_amount < 0) a.l++
      agg.set(d, a)
    }
    return [...agg.entries()]
      .filter(([, a]) => a.w + a.l >= 5)
      .map(([d, a]) => ({ d, wr: a.w / (a.w + a.l) }))
      .sort((a, b) => b.wr - a.wr)
  }, [trades])

  if (days.length < 2) return null
  const best = days[0]
  const worst = days[days.length - 1]
  return (
    <div className="callout block-in mt-7" style={{ '--i': 6 } as React.CSSProperties}>
      <Lightbulb className="mt-1 h-5 w-5 shrink-0 text-[#cb912f]" />
      <span>
        ימי <b>{WEEKDAYS_HE[best.d]}</b> הם הטובים שלך ({formatPct(best.wr)} הצלחה) וימי{' '}
        <b>{WEEKDAYS_HE[worst.d]}</b> החלשים ({formatPct(worst.wr)}).
        {stats.avgWinLossRatio && stats.avgWinLossRatio > 1 && (
          <>
            {' '}עסקה מנצחת ממוצעת (<span className="num">{formatMoney(stats.avgWin, false)}</span>) גדולה פי{' '}
            {stats.avgWinLossRatio.toFixed(1)} ממפסידה (<span className="num">{formatMoney(stats.avgLoss, false)}</span>).
          </>
        )}
      </span>
    </div>
  )
}

/* ---- Recent trades (database block with views) ------------------------- */

function RecentTrades({ trades }: { trades: Trade[] }) {
  const [view, setView] = useState<View>('table')
  const recent = trades.slice(0, 8)
  const withShots = trades.filter((t) => t.images && t.images.length > 0).slice(0, 8)

  const tabs: { id: View; label: string; icon: typeof Table2 }[] = [
    { id: 'table', label: 'טבלה', icon: Table2 },
    { id: 'gallery', label: 'גלריה', icon: LayoutGrid },
    { id: 'board', label: 'לפי תוצאה', icon: Columns3 },
  ]

  return (
    <section className="block-in mt-10" style={{ '--i': 7 } as React.CSSProperties}>
      <h2 className="mb-2 text-2xl">עסקאות אחרונות</h2>
      <div className="flex items-center gap-1 border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setView(t.id)}
            aria-pressed={view === t.id}
            className={`-mb-px flex h-9 items-center gap-1.5 border-b-2 px-2.5 text-sm font-medium transition-colors ${
              view === t.id ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            <t.icon className="h-4 w-4" />
            {t.label}
          </button>
        ))}
        <Link to="/app/trades" className="mr-auto rounded-md px-2 py-1 text-sm text-muted hover:bg-[#f1f1ef]">
          לכל העסקאות
        </Link>
        <Link to="/app/trades/new" className="btn-primary !py-1">
          חדש
        </Link>
      </div>

      <div key={view} className="animate-[fade-up_.35s_var(--ease-out-expo)_both]">
        {view === 'table' && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="h-9 border-b border-border text-right text-[13px] text-muted">
                  <th className="px-2 font-normal">תאריך</th>
                  <th className="px-2 font-normal">נכס</th>
                  <th className="px-2 font-normal">כיוון</th>
                  <th className="px-2 font-normal">שעה</th>
                  <th className="px-2 font-normal">תוצאה</th>
                  <th className="px-2 font-normal">R</th>
                  <th className="px-2 font-normal">P&amp;L</th>
                  <th className="px-2 font-normal">חוזים</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((t) => {
                  const tone = toneOf(t.return_amount)
                  const time = t.date.slice(11, 16)
                  return (
                    <tr key={t.id} className="h-10 border-b border-[#f1f1ef] transition-colors hover:bg-surface">
                      <td className="px-2">
                        <Link to={`/app/trades/${t.id}`} className="num hover:underline">
                          {shortDate(t.date)}
                        </Link>
                      </td>
                      <td className="px-2 font-semibold">{cleanSymbol(t.symbol)}</td>
                      <td className="px-2">
                        <span className={`tag ${t.side === 'LONG' ? 'tag-blue' : 'tag-purple'}`}>
                          {t.side === 'LONG' ? 'לונג' : 'שורט'}
                        </span>
                      </td>
                      <td className="px-2">
                        {time && <span className={`tag num ${time === '16:30' ? 'tag-yellow' : 'tag-orange'}`}>{time}</span>}
                      </td>
                      <td className="px-2">
                        <span className={`tag tag-${tone === 'gray' ? 'gray' : tone}`}>{resultLabel[tone]}</span>
                      </td>
                      <td className="num px-2 text-right text-[#5f5e5b]">{formatR(t.r_multiple)}</td>
                      <td className={`num px-2 text-right font-semibold ${pnlText[tone]}`}>{formatMoney(t.return_amount)}</td>
                      <td className="num px-2 text-right text-[#5f5e5b]">{t.qty}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {view === 'gallery' && (
          <div className="grid grid-cols-2 gap-3.5 pt-4 md:grid-cols-4">
            {withShots.length === 0 && <p className="col-span-full py-8 text-center text-muted">אין עדיין עסקאות עם צילום מסך.</p>}
            {withShots.map((t) => {
              const tone = toneOf(t.return_amount)
              return (
                <Link
                  key={t.id}
                  to={`/app/trades/${t.id}`}
                  className="panel overflow-hidden transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-10px_rgba(15,15,15,.25)]"
                >
                  <img
                    src={imageUrl(t.images![0])}
                    alt={`צילום מסך: ${cleanSymbol(t.symbol)} ${shortDate(t.date)}`}
                    loading="lazy"
                    className="h-36 w-full border-b border-border bg-surface object-cover"
                    style={{ objectPosition: '50% 30%' }}
                  />
                  <div className="flex flex-col gap-2 px-3 py-2.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-semibold">
                        {cleanSymbol(t.symbol)} · <span className="num">{shortDate(t.date).slice(0, 5)}</span>
                      </span>
                      <span className={`num font-bold ${pnlText[tone]}`}>{formatMoney(t.return_amount)}</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className={`tag ${t.side === 'LONG' ? 'tag-blue' : 'tag-purple'}`}>
                        {t.side === 'LONG' ? 'לונג' : 'שורט'}
                      </span>
                      <span className={`tag tag-${tone === 'gray' ? 'gray' : tone}`}>{resultLabel[tone]}</span>
                      <span className="tag num">{formatR(t.r_multiple)}</span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}

        {view === 'board' && (
          <div className="grid gap-3.5 pt-4 md:grid-cols-3">
            {(['green', 'red', 'gray'] as Tone[]).map((tone) => {
              const items = recent.filter((t) => toneOf(t.return_amount) === tone)
              return (
                <div key={tone} className="flex flex-col gap-2 rounded-lg bg-surface p-2.5">
                  <div className="flex items-center gap-2 text-sm">
                    <span className={`tag tag-${tone === 'gray' ? 'gray' : tone} font-medium`}>{resultLabel[tone]}</span>
                    <span className="num text-muted">{items.length}</span>
                  </div>
                  {items.map((t) => (
                    <Link
                      key={t.id}
                      to={`/app/trades/${t.id}`}
                      className="flex justify-between rounded-md bg-bg px-3 py-2.5 text-sm shadow-[0_0_0_1px_#ededeb] transition-all hover:-translate-y-px hover:shadow-[0_0_0_1px_#ededeb,0_4px_12px_-6px_rgba(15,15,15,.2)]"
                    >
                      <span>
                        <b>{cleanSymbol(t.symbol)}</b> <span className="num text-muted">{shortDate(t.date).slice(0, 5)}</span>
                      </span>
                      <span className={`num font-semibold ${pnlText[tone]}`}>{formatMoney(t.return_amount)}</span>
                    </Link>
                  ))}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
