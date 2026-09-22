import { useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight, ArrowDownRight, Info, CalendarRange, ChevronDown } from 'lucide-react'
import { useJournals } from '../lib/journals'
import { useTrades } from '../lib/useTrades'
import { computeAnalytics, filterTradesByRange } from '../lib/analytics'
import { computeStats, formatMoney, formatPct } from '../lib/trades'
import { EquityCurve } from '../components/EquityCurve'
import { BarChart } from '../components/BarChart'
import { HBars } from '../components/HBars'
import { Donut } from '../components/Donut'
import { CountUp } from '../components/CountUp'

type RangeKey = 'all' | 'ytd' | '90' | '30' | 'mtd' | 'lastmonth'
const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'all', label: 'הכל' },
  { key: 'ytd', label: 'השנה' },
  { key: '90', label: '90 יום' },
  { key: '30', label: '30 יום' },
  { key: 'mtd', label: 'החודש' },
  { key: 'lastmonth', label: 'חודש קודם' },
]

const MONTHS_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]
const monthLabel = (ym: string) => `${MONTHS_HE[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
        active ? 'border-accent/50 bg-accent/10 text-accent' : 'border-black/[0.12] text-muted hover:text-ink'
      }`}
    >
      {children}
    </button>
  )
}

function rangeFor(key: RangeKey): { from: Date | null; to: Date | null } {
  const now = new Date()
  const to = now
  switch (key) {
    case 'all':
      return { from: null, to: null }
    case 'ytd':
      return { from: new Date(now.getFullYear(), 0, 1), to }
    case '90':
      return { from: new Date(now.getTime() - 90 * 864e5), to }
    case '30':
      return { from: new Date(now.getTime() - 30 * 864e5), to }
    case 'mtd':
      return { from: new Date(now.getFullYear(), now.getMonth(), 1), to }
    case 'lastmonth':
      return {
        from: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        to: new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59),
      }
  }
}

// Info "i" button whose explanation renders in a portal, so it can never be
// clipped or hidden behind a neighbouring card's stacking context.
function InfoPopover({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const w = 288
      const left = Math.max(12, Math.min(r.right - w, window.innerWidth - w - 12))
      setPos({ top: r.bottom + 8, left })
    }
    setOpen((o) => !o)
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={toggle}
        aria-label="הסבר על הגרף"
        className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-black/[0.15] text-muted transition-colors hover:border-black/[0.35] hover:text-ink"
      >
        <Info className="h-3 w-3" />
      </button>
      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} />
            <div
              className="fixed z-[56] w-72 animate-zoom-in rounded-xl border border-black/[0.12] bg-surface-2 p-3.5 text-right text-xs leading-relaxed text-muted shadow-panel"
              style={{ top: pos.top, left: pos.left }}
            >
              {text}
            </div>
          </>,
          document.body,
        )}
    </>
  )
}

function EmptyNote({ text }: { text: string }) {
  return <div className="py-8 text-center text-sm leading-relaxed text-muted">{text}</div>
}

function ChartCard({ title, desc, hint, children }: { title: string; desc: string; hint?: string; children: ReactNode }) {
  return (
    <div className="card">
      <div className="mb-5 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold">{title}</h2>
          <InfoPopover text={desc} />
        </div>
        {hint && <span className="pill shrink-0">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function Delta({ value, money }: { value: number; money?: boolean }) {
  if (!Number.isFinite(value) || Math.abs(value) < 1e-9) return null
  const up = value > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-semibold ${up ? 'text-win' : 'text-loss'}`}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {money ? formatMoney(value) : `${up ? '+' : ''}${value.toFixed(value % 1 === 0 ? 0 : 1)}`}
    </span>
  )
}

export default function Analytics() {
  const { active } = useJournals()
  const { trades, loading } = useTrades()
  const [range, setRange] = useState<RangeKey>('all')
  const [customMonths, setCustomMonths] = useState<Set<string>>(new Set())
  const [showRange, setShowRange] = useState(false)
  const [custYear, setCustYear] = useState<string | null>(null)

  const usingCustom = customMonths.size > 0
  const years = useMemo(
    () => [...new Set(trades.map((t) => t.date.slice(0, 4)))].sort().reverse(),
    [trades],
  )
  const activeYear = custYear && years.includes(custYear) ? custYear : years[0]
  const monthsForYear = useMemo(
    () => [...new Set(trades.map((t) => t.date.slice(0, 7)))].filter((m) => m.startsWith(activeYear ?? '')).sort().reverse(),
    [trades, activeYear],
  )

  const { from, to } = usingCustom ? { from: null, to: null } : rangeFor(range)
  const filtered = useMemo(() => {
    if (usingCustom) return trades.filter((t) => customMonths.has(t.date.slice(0, 7)))
    return filterTradesByRange(trades, from, to)
  }, [trades, range, customMonths]) // eslint-disable-line react-hooks/exhaustive-deps
  const a = useMemo(() => computeAnalytics(filtered), [filtered])
  const prev = useMemo(() => {
    if (usingCustom || !from || !to) return null
    const span = to.getTime() - from.getTime()
    const pTrades = filterTradesByRange(trades, new Date(from.getTime() - span), new Date(from.getTime() - 1))
    return pTrades.length ? computeStats(pTrades) : null
  }, [trades, range, customMonths]) // eslint-disable-line react-hooks/exhaustive-deps

  const currentLabel = usingCustom
    ? customMonths.size === 1
      ? monthLabel([...customMonths][0])
      : `${customMonths.size} חודשים`
    : RANGES.find((r) => r.key === range)?.label ?? 'הכל'

  function toggleMonth(m: string) {
    const next = new Set(customMonths)
    next.has(m) ? next.delete(m) : next.add(m)
    setCustomMonths(next)
  }

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-muted">טוען אנליטיקה…</div>
  }

  const header = (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">אנליטיקה</h1>
          <p className="text-muted">
            ניתוח מעמיק · {active.name}
            {prev && <span className="text-xs"> · השוואה מול התקופה הקודמת</span>}
          </p>
        </div>
        <button
          onClick={() => setShowRange((s) => !s)}
          className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition-colors ${
            showRange || usingCustom
              ? 'border-accent/50 bg-accent/10 text-accent'
              : 'border-black/[0.12] bg-white text-ink hover:bg-black/[0.03]'
          }`}
        >
          <CalendarRange className="h-4 w-4" />
          {currentLabel}
          <ChevronDown className={`h-4 w-4 transition-transform ${showRange ? 'rotate-180' : ''}`} />
        </button>
      </div>
      {showRange && (
        <div className="card space-y-4">
          <div>
            <div className="field-label mb-2">תקופות אחרונות</div>
            <div className="flex flex-wrap gap-2">
              {RANGES.map((r) => (
                <Chip
                  key={r.key}
                  active={!usingCustom && range === r.key}
                  onClick={() => { setRange(r.key); setCustomMonths(new Set()) }}
                >
                  {r.label}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="field-label mb-2">חודשים ספציפיים</div>
            <div className="mb-2 flex flex-wrap gap-2">
              {years.map((y) => (
                <Chip key={y} active={activeYear === y} onClick={() => setCustYear(y)}>{y}</Chip>
              ))}
            </div>
            <div className="flex flex-wrap gap-2 border-t border-black/[0.06] pt-3">
              {monthsForYear.map((m) => (
                <Chip key={m} active={customMonths.has(m)} onClick={() => toggleMonth(m)}>
                  {MONTHS_HE[Number(m.slice(5, 7)) - 1]}
                </Chip>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )

  if (filtered.length === 0) {
    return (
      <div className="space-y-5">
        {header}
        <div className="card py-16 text-center text-muted">אין עסקאות בטווח שנבחר.</div>
      </div>
    )
  }

  const hero = [
    { label: 'Net P&L', count: a.netPnl, fmt: (n: number) => formatMoney(n), cls: a.netPnl >= 0 ? 'text-win' : 'text-loss', sub: `${a.totalTrades} עסקאות`, delta: prev ? <Delta value={a.netPnl - prev.netPnl} money /> : null },
    { label: 'Win Rate', count: a.winRate, fmt: (n: number) => formatPct(n), cls: '', sub: `${a.wins}W / ${a.losses}L`, delta: prev ? <Delta value={(a.winRate - prev.winRate) * 100} /> : null },
    { label: 'Profit Factor', count: a.profitFactor ?? 0, fmt: (n: number) => n.toFixed(2), cls: '', sub: 'רווח / הפסד גולמי', empty: a.profitFactor == null, delta: prev && prev.profitFactor != null && a.profitFactor != null ? <Delta value={a.profitFactor - prev.profitFactor} /> : null },
    { label: 'Expectancy', count: a.expectancy, fmt: (n: number) => formatMoney(n), cls: a.expectancy >= 0 ? 'text-win' : 'text-loss', sub: 'תוחלת לעסקה', delta: prev ? <Delta value={a.expectancy - prev.expectancy} money /> : null },
  ]

  const secondary = [
    { label: 'Avg Win', value: formatMoney(a.avgWin), cls: 'text-win' },
    { label: 'Avg Loss', value: formatMoney(-a.avgLoss), cls: 'text-loss' },
    { label: 'Payoff', value: a.payoff ? a.payoff.toFixed(2) : '—', cls: '' },
    { label: 'Max Drawdown', value: formatMoney(-a.maxDrawdown), cls: 'text-loss' },
    { label: 'Best Trade', value: formatMoney(a.bestTrade), cls: 'text-win' },
    { label: 'Worst Trade', value: formatMoney(a.worstTrade), cls: 'text-loss' },
    { label: 'Win Streak', value: `${a.maxWinStreak}`, cls: 'text-win' },
    { label: 'Loss Streak', value: `${a.maxLossStreak}`, cls: 'text-loss' },
    { label: 'ימי מסחר', value: `${a.tradingDays}`, cls: '' },
    { label: 'הצלחת ימים', value: formatPct(a.dayWinRate), cls: '' },
    { label: 'ממוצע יומי', value: formatMoney(a.avgDailyPnl), cls: a.avgDailyPnl >= 0 ? 'text-win' : 'text-loss' },
    { label: 'ימים +/-', value: `${a.winningDays}/${a.losingDays}`, cls: '' },
  ]

  const winLossSegments = [
    { label: 'זכיות', value: a.wins, color: '#3FCF8E' },
    { label: 'הפסדים', value: a.losses, color: '#F26D6D' },
    { label: 'תיקו', value: a.washes, color: '#6B7280' },
  ]

  const STOP_COLORS = ['#0066cc', '#5ac8fa', '#c7c7cc']
  const STOP_DESC: Record<string, string> = {
    MNQ: 'פילוח עסקאות ה-MNQ לפי גודל הסטופ שהשתמשת בו — 15 נקודות מול 20 נקודות. כל פלח בעוגה מראה כמה עסקאות נסגרו עם אותו סטופ, ולצידו אחוז ההצלחה של אותו סטופ. כך תוכל לראות עם איזה גודל סטופ אתה רווחי יותר. במרכז — אחוז ההצלחה הכולל ב-MNQ.',
    MES: 'פילוח עסקאות ה-MES לפי גודל הסטופ — 3 נקודות מול 4 נקודות. כל פלח מראה כמה עסקאות נסגרו עם אותו סטופ ואת אחוז ההצלחה שלו, כדי לזהות איזה גודל סטופ עובד לך טוב יותר. במרכז — אחוז ההצלחה הכולל ב-MES.',
    YM: 'פילוח עסקאות ה-YM לפי גודל הסטופ, עם אחוז ההצלחה לכל סטופ. כרגע אין עדיין עסקאות YM — הכרטיס יתמלא אוטומטית ברגע שתתעד עסקאות בנכס הזה.',
  }

  return (
    <div className="space-y-5">
      {header}

      {/* Hero KPIs */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {hero.map((c) => (
          <div key={c.label} className="card">
            <div className="stat-label">{c.label}</div>
            <div className={`stat-value ${c.cls}`}>{c.empty ? '—' : <CountUp value={c.count} format={c.fmt} />}</div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-xs text-muted">
              <span>{c.sub}</span>
              {c.delta}
            </div>
          </div>
        ))}
      </div>

      {/* Secondary stats */}
      <div className="card">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {secondary.map((s) => (
            <div key={s.label} className="rounded-xl border border-black/[0.08] bg-black/[0.02] p-3">
              <div className="stat-label">{s.label}</div>
              <div className={`num mt-1 text-lg font-bold ${s.cls}`}>{s.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Equity */}
      <ChartCard
        title="Equity Curve"
        desc="הרווח המצטבר (P&L) של החשבון לאורך כל העסקאות, לפי הסדר הכרונולוגי שלהן. קו עולה = החשבון צומח; ירידות מראות תקופות הפסד. העבר את העכבר על הגרף כדי לראות את הסכום המצטבר בכל נקודה."
        hint={`${a.totalTrades} עסקאות`}
      >
        <EquityCurve data={a.equity} labels={a.equityLabels} format={(n) => formatMoney(n)} height={240} draw />
      </ChartCard>

      {/* Composition */}
      <div className="grid gap-4 lg:grid-cols-3">
        <ChartCard
          title="פילוח תוצאות"
          desc="חלוקת כל העסקאות לשלוש קבוצות: זכיות (רווח), הפסדים, ותיקו (wash — יצאת באפס). במרכז העוגה מופיע אחוז ההצלחה הכולל. עוזר לראות במבט מהיר את היחס בין עסקאות מנצחות למפסידות."
        >
          <Donut segments={winLossSegments} centerValue={formatPct(a.winRate)} centerLabel="Win Rate" size={150} />
        </ChartCard>
        <ChartCard
          title="לונג מול שורט"
          desc="השוואת הרווח/הפסד בין עסקאות לונג (קנייה) לעסקאות שורט (מכירה בחסר), כולל מספר העסקאות ואחוז ההצלחה בכל כיוון. מגלה אם אתה חזק יותר בכיוון מסוים."
        >
          <HBars items={a.bySide} format={(v) => formatMoney(v)} />
        </ChartCard>
        <ChartCard
          title="לפי נכס"
          desc="הרווח/הפסד הכולל בכל נכס שנסחר (למשל MNQ מול MES), עם מספר העסקאות ואחוז ההצלחה בכל אחד. עוזר לזהות באיזה נכס אתה הכי רווחי."
        >
          <HBars items={a.bySymbol} format={(v) => formatMoney(v)} />
        </ChartCard>
      </div>

      {/* Entry-model (lookback) performance */}
      <ChartCard
        title="לפי מודל כניסה (Lookback)"
        desc="ביצועי כל מודל כניסה שתייגתם: העמודה = תוחלת ב-R לעסקה, והאחוז שלצידה = אחוז ההצלחה. מודל עם R שלילי (אדום) או אחוז הצלחה נמוך הוא מודל חלש — כדאי להימנע ממנו או להוריד בו מינוף. מתמלא ככל שתעדכנו את שדה ה-Lookback בעסקאות."
      >
        {a.byLookback.length ? (
          <HBars items={a.byLookback} format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(2)}R`} />
        ) : (
          <EmptyNote text="עדיין לא תויגו מודלי כניסה. עדכנו את שדה ה-Lookback בעסקאות כדי לראות אילו מודלים חזקים ואילו חלשים." />
        )}
      </ChartCard>

      {/* Win rate by stop, per asset */}
      <div className="grid gap-4 lg:grid-cols-3">
        {['MNQ', 'MES', 'YM'].map((asset) => {
          const s = a.stopByAsset[asset]
          return (
            <ChartCard key={asset} title={`${asset} — הצלחה לפי סטופ`} desc={STOP_DESC[asset]}>
              {s && s.total > 0 ? (
                <Donut
                  legendBelow
                  segments={s.buckets.map((b, i) => ({
                    label: `סטופ ${b.stop} נק׳`,
                    value: b.count,
                    color: STOP_COLORS[i % STOP_COLORS.length],
                    sub: `${Math.round(b.winRate * 100)}% הצלחה · ${b.count} עסקאות`,
                  }))}
                  centerValue={formatPct(s.winRate)}
                  centerLabel={asset}
                  size={140}
                />
              ) : (
                <div className="flex h-[150px] items-center justify-center text-sm text-muted">
                  אין עדיין עסקאות ב-{asset}
                </div>
              )}
            </ChartCard>
          )
        })}
      </div>

      {/* Charts grid */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartCard
          title="P&L לפי חודש"
          desc="הרווח/הפסד נטו בכל חודש קלנדרי. עוזר לזהות מגמות לאורך זמן ולראות אם אתה משתפר מחודש לחודש. ירוק = חודש רווחי, אדום = חודש מפסיד. אם יש הרבה חודשים אפשר לגלול את הגרף הצידה."
        >
          <BarChart items={a.byMonth} format={(v) => formatMoney(v)} height={150} />
        </ChartCard>

        <ChartCard
          title="Drawdown"
          desc="כמה החשבון נמצא מתחת לשיא הגבוה ביותר שלו, בכל נקודת זמן. זהו מדד הסיכון/כאב: ככל שהגרף רדוד יותר — ניהול הסיכון טוב יותר. הערך המקסימלי הוא הירידה הגדולה ביותר שחווית."
          hint={`מקס׳ ${formatMoney(-a.maxDrawdown)}`}
        >
          <EquityCurve data={a.drawdown} labels={a.equityLabels} format={(n) => formatMoney(n)} height={150} color="#F26D6D" draw />
        </ChartCard>

        <ChartCard
          title="P&L לפי יום בשבוע"
          desc="הרווח/הפסד הכולל בכל יום בשבוע (א׳–ש׳). עוזר לזהות אם יש ימים שבהם אתה עקבית רווחי או מפסיד, כדי להתמקד בימים החזקים."
        >
          <BarChart items={a.byWeekday} format={(v) => formatMoney(v)} />
        </ChartCard>

        <ChartCard
          title="P&L לפי שעת מסחר"
          desc="הרווח/הפסד הכולל לפי שעת הכניסה לעסקה. מגלה באילו שעות ביום אתה הכי רווחי (ובאילו כדאי להימנע ממסחר)."
        >
          <BarChart items={a.byHour} format={(v) => formatMoney(v)} />
        </ChartCard>
      </div>
    </div>
  )
}
