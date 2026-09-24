import { useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight, ArrowDownRight, CalendarRange, ChevronDown, TrendingUp, Lightbulb, X } from 'lucide-react'
import { useJournals } from '../lib/journals'
import { useTrades } from '../lib/useTrades'
import { computeAnalytics, filterTradesByRange, type Bucket } from '../lib/analytics'
import { computeStats, formatMoney, formatPct } from '../lib/trades'
import { CountUp } from '../components/CountUp'
import { PageTitle } from '../components/PageTitle'
import { LineChart, Columns, BarRows, SplitBar, CHART, useInView, type Row } from '../components/charts'

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
const MONTHS_SHORT = ['ינו׳', 'פבר׳', 'מרץ', 'אפר׳', 'מאי', 'יוני', 'יולי', 'אוג׳', 'ספט׳', 'אוק׳', 'נוב׳', 'דצמ׳']
const WEEKDAY_FULL: Record<string, string> = {
  'א׳': 'ראשון', 'ב׳': 'שני', 'ג׳': 'שלישי', 'ד׳': 'רביעי', 'ה׳': 'חמישי', 'ו׳': 'שישי', 'ש׳': 'שבת',
}
const monthLabel = (ym: string) => `${MONTHS_HE[Number(ym.slice(5, 7)) - 1]} ${ym.slice(0, 4)}`
/** "02/26" → "פבר׳ 26" */
const shortMonth = (mmYY: string) => `${MONTHS_SHORT[Number(mmYY.slice(0, 2)) - 1]} ${mmYY.slice(3)}`
const money = (v: number) => formatMoney(v)
const pctOf = (b: Bucket) => (b.winRate != null ? `${Math.round(b.winRate * 100)}%` : '—')

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

/* ---- Small building blocks ------------------------------------------- */

// "?" button whose explanation renders in a portal, so a neighbouring
// block's stacking context can never clip it.
function InfoPopover({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const [pos, setPos] = useState({ top: 0, left: 0 })

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const w = 300
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
        aria-label="מה הגרף הזה מראה?"
        aria-expanded={open}
        className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-faint transition-colors hover:bg-[#efeeec] hover:text-ink"
      >
        ?
      </button>
      {open &&
        createPortal(
          <>
            <div className="fixed inset-0 z-[55]" onClick={() => setOpen(false)} />
            <div
              role="dialog"
              className="fixed z-[56] w-[300px] animate-zoom-in rounded-lg border border-border bg-bg p-3.5 text-right text-[13px] leading-relaxed text-[#5f5e5b] shadow-[0_12px_32px_-12px_rgba(15,15,15,.3)]"
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

function Delta({ value, money: isMoney, suffix = '' }: { value: number; money?: boolean; suffix?: string }) {
  if (!Number.isFinite(value) || Math.abs(value) < 1e-9) return null
  const up = value > 0
  return (
    <span
      title="מול התקופה הקודמת באותו אורך"
      className={`inline-flex items-center gap-0.5 rounded px-1 text-[12px] font-semibold tabular-nums ${
        up ? 'bg-tag-green text-tag-green-fg' : 'bg-tag-red text-tag-red-fg'
      }`}
      dir="ltr"
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {isMoney ? formatMoney(value) : `${up ? '+' : ''}${value.toFixed(Math.abs(value) >= 10 ? 0 : 1)}${suffix}`}
    </span>
  )
}

/** A section of the report: title, one-line takeaway, content. Fades in on scroll. */
function Section({ title, insight, children }: { title: string; insight?: ReactNode; children: ReactNode }) {
  const [ref, seen] = useInView<HTMLElement>()
  return (
    <section
      ref={ref}
      className="mt-12"
      style={{
        opacity: seen ? 1 : 0,
        transform: seen ? 'none' : 'translateY(14px)',
        transition: 'opacity .6s var(--ease-out-expo), transform .6s var(--ease-out-expo)',
      }}
    >
      <h2 className="text-[22px]">{title}</h2>
      {insight && (
        <p className="mt-1 flex items-start gap-2 text-[15px] text-[#5f5e5b]">
          <Lightbulb className="mt-[3px] h-4 w-4 shrink-0 text-[#cb912f]" />
          <span>{insight}</span>
        </p>
      )}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Block({
  title,
  desc,
  hint,
  children,
  className = '',
}: {
  title: string
  desc: string
  hint?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`panel p-5 ${className}`}>
      <div className="mb-4 flex items-center gap-1.5">
        <h3 className="text-[15px] font-semibold">{title}</h3>
        <InfoPopover text={desc} />
        {hint && <span className="mr-auto">{hint}</span>}
      </div>
      {children}
    </div>
  )
}

function EmptyNote({ text }: { text: string }) {
  return <div className="py-6 text-center text-sm leading-relaxed text-muted">{text}</div>
}

/* ---- Page ------------------------------------------------------------ */

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
    () => [...new Set(trades.map((t) => t.date.slice(0, 7)))].filter((m) => m.startsWith(activeYear ?? '')).sort(),
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

  const segBtn = (on: boolean) =>
    `h-8 shrink-0 whitespace-nowrap rounded-md px-3 text-sm transition-colors ${on ? 'bg-bg font-semibold text-ink shadow-[0_0_0_1px_#e3e2e0,0_1px_2px_rgba(15,15,15,.06)]' : 'text-muted hover:text-ink'}`

  const filterBar = (
    <div className="sticky top-11 z-20 -mx-5 mt-6 border-b border-border bg-bg/90 px-5 py-2 backdrop-blur sm:-mx-10 sm:px-10 lg:-mx-16 lg:px-16">
      <div className="flex items-center gap-2">
        <div role="group" aria-label="טווח זמן" className="flex min-w-0 flex-1 sm:flex-none gap-0.5 overflow-x-auto rounded-lg bg-[#f1f0ed] p-0.5 [scrollbar-width:none]">
          {RANGES.map((r) => (
            <button
              key={r.key}
              aria-pressed={!usingCustom && range === r.key}
              onClick={() => {
                setRange(r.key)
                setCustomMonths(new Set())
              }}
              className={segBtn(!usingCustom && range === r.key)}
            >
              {r.label}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowRange((s) => !s)}
          aria-expanded={showRange}
          aria-label="בחירת חודשים"
          className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-sm transition-colors ${
            usingCustom ? 'border-accent/40 bg-accent/[0.07] font-semibold text-accent' : 'border-border hover:bg-surface'
          }`}
        >
          <CalendarRange className="h-4 w-4" />
          <span className={usingCustom ? '' : 'hidden sm:inline'}>{usingCustom ? currentLabel : 'בחירת חודשים'}</span>
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showRange ? 'rotate-180' : ''}`} />
        </button>
        {usingCustom && (
          <button
            onClick={() => setCustomMonths(new Set())}
            aria-label="נקה בחירת חודשים"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        <span className="mr-auto hidden text-[13px] text-muted sm:inline">
          <span className="num font-semibold text-ink">{filtered.length}</span> עסקאות
          {prev && ' · מול התקופה הקודמת'}
        </span>
      </div>
      {showRange && (
        <div className="animate-[fade-up_.3s_var(--ease-out-expo)_both] pb-1 pt-3">
          <div className="mb-2 flex flex-wrap gap-1.5">
            {years.map((y) => (
              <button key={y} onClick={() => setCustYear(y)} className={`tag num cursor-pointer !px-2.5 !py-0.5 ${activeYear === y ? '!bg-ink !text-white' : 'hover:!bg-[#d9d8d5]'}`}>
                {y}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {monthsForYear.map((m) => (
              <button
                key={m}
                onClick={() => toggleMonth(m)}
                aria-pressed={customMonths.has(m)}
                className={`tag cursor-pointer !px-2.5 !py-0.5 transition-colors ${customMonths.has(m) ? 'tag-blue !font-semibold' : 'hover:!bg-[#d9d8d5]'}`}
              >
                {MONTHS_HE[Number(m.slice(5, 7)) - 1]}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const header = (
    <>
      <PageTitle icon={TrendingUp} color="#9065b0" title="אנליטיקה" subtitle={`ניתוח מעמיק · ${active.name}`} />
      {filterBar}
    </>
  )

  if (filtered.length === 0) {
    return (
      <div>
        {header}
        <div className="callout mt-8">
          <Lightbulb className="mt-1 h-5 w-5 shrink-0 text-[#cb912f]" />
          אין עסקאות בטווח שנבחר. נסה טווח רחב יותר.
        </div>
      </div>
    )
  }

  /* --- derived views & takeaways --- */
  const months = a.byMonth.map((b) => ({ ...b, label: shortMonth(b.label), mm: b.label.slice(0, 2), yy: b.label.slice(3) }))
  const bestMonth = months.length ? months.reduce((b, m) => (m.value > b.value ? m : b)) : null
  const greenMonths = months.filter((m) => m.value > 0).length
  const weekdays = a.byWeekday.filter((b) => b.count > 0)
  const bestDay = weekdays.length ? weekdays.reduce((b, d) => (d.value > b.value ? d : b)) : null
  const hours = a.byHour.map((b) => ({ ...b, label: `${b.label}:00` }))
  const bestHour = hours.length ? hours.reduce((b, h) => (h.value > b.value ? h : b)) : null

  const sideRows: Row[] = a.bySide.map((b) => ({
    label: b.label === 'LONG' ? 'לונג' : 'שורט',
    value: b.value,
    sub: `${b.count} עסקאות · ${pctOf(b)} הצלחה`,
  }))
  const strongerSide = a.bySide.length === 2 && a.bySide[0].count && a.bySide[1].count
    ? (a.bySide[0].value >= a.bySide[1].value ? 'לונג' : 'שורט')
    : null
  const symbolRows: Row[] = a.bySymbol.map((b) => ({ label: b.label, value: b.value, sub: `${b.count} עסקאות · ${pctOf(b)} הצלחה` }))
  const lookbackRows: Row[] = a.byLookback.map((b) => ({ label: b.label, value: b.value, sub: `${b.count} עסקאות · ${pctOf(b)} הצלחה` }))
  const winRateRows = (bs: Bucket[]): Row[] =>
    bs.map((b) => ({ label: b.label, value: b.value, sub: `${b.count} עסקאות`, color: b.value >= 50 ? CHART.win : CHART.loss }))

  const rDist = a.rDistribution
  const rTotal = rDist.reduce((s, b) => s + b.count, 0)
  const bigWins = rDist.slice(5).reduce((s, b) => s + b.count, 0) // ≥ 2R

  const heroStats = [
    {
      label: 'אחוז הצלחה',
      desc: 'כמה מהעסקאות (מתוך מנצחות + מפסידות) נסגרו ברווח. עסקאות ב-0 לא נספרות באחוז, אבל מופיעות בפס.',
      value: <CountUp value={a.winRate} format={formatPct} />,
      delta: prev ? <Delta value={(a.winRate - prev.winRate) * 100} suffix="%" /> : null,
      body: (
        <SplitBar
          parts={[
            { label: 'זכיות', value: a.wins, color: CHART.win },
            { label: 'הפסדים', value: a.losses, color: CHART.loss },
            { label: 'תיקו', value: a.washes, color: CHART.neutral },
          ]}
        />
      ),
    },
    {
      label: 'Profit Factor',
      desc: 'כל הרווחים חלקי כל ההפסדים. מעל 1 = אסטרטגיה רווחית; מעל 2 = חזקה מאוד.',
      value: a.profitFactor == null ? '—' : <CountUp value={a.profitFactor} format={(n) => n.toFixed(2)} />,
      delta: prev && prev.profitFactor != null && a.profitFactor != null ? <Delta value={a.profitFactor - prev.profitFactor} /> : null,
      body: (
        <BarRows
          rows={[
            { label: 'רווח גולמי', value: a.grossProfit, color: CHART.win },
            { label: 'הפסד גולמי', value: a.grossLoss, color: CHART.loss },
          ]}
          format={(v) => formatMoney(v, false)}
          compact
        />
      ),
    },
    {
      label: 'תוחלת לעסקה',
      desc: 'כמה אתה מרוויח בממוצע על כל עסקה, כולל המפסידות. זה המספר שאומר אם יש לך יתרון.',
      value: <CountUp value={a.expectancy} format={money} />,
      cls: a.expectancy >= 0 ? 'text-win' : 'text-loss',
      delta: prev ? <Delta value={a.expectancy - prev.expectancy} money /> : null,
      body: (
        <p className="text-[13px] leading-relaxed text-muted">
          על פני <b className="num text-ink">{a.totalTrades}</b> עסקאות ב-<b className="num text-ink">{a.tradingDays}</b> ימי מסחר, ממוצע
          של <b className="num text-ink">{formatMoney(a.avgDailyPnl)}</b> ליום.
        </p>
      ),
    },
    {
      label: 'ניצחון / הפסד ממוצע',
      desc: 'Payoff: גודל עסקה מנצחת ממוצעת חלקי גודל עסקה מפסידה ממוצעת. מעל 2 אומר שאתה יכול להפסיד ברוב העסקאות ועדיין להרוויח.',
      value: a.payoff ? <CountUp value={a.payoff} format={(n) => `${n.toFixed(2)}×`} /> : '—',
      delta: null,
      body: (
        <BarRows
          rows={[
            { label: 'ניצחון ממוצע', value: a.avgWin, color: CHART.win },
            { label: 'הפסד ממוצע', value: a.avgLoss, color: CHART.loss },
          ]}
          format={(v) => formatMoney(v, false)}
          compact
        />
      ),
    },
  ]

  const facts = [
    { k: 'ניצחון ממוצע', v: formatMoney(a.avgWin), c: 'text-win' },
    { k: 'הפסד ממוצע', v: formatMoney(-a.avgLoss), c: 'text-loss' },
    { k: 'Payoff', v: a.payoff ? a.payoff.toFixed(2) : '—' },
    { k: 'Drawdown מקסימלי', v: formatMoney(-a.maxDrawdown), c: 'text-loss' },
    { k: 'העסקה הטובה', v: formatMoney(a.bestTrade), c: 'text-win' },
    { k: 'העסקה הגרועה', v: formatMoney(a.worstTrade), c: 'text-loss' },
    { k: 'רצף ניצחונות', v: `${a.maxWinStreak}` },
    { k: 'רצף הפסדים', v: `${a.maxLossStreak}` },
    { k: 'ימי מסחר', v: `${a.tradingDays}` },
    { k: 'אחוז ימים ירוקים', v: formatPct(a.dayWinRate) },
    { k: 'ממוצע יומי', v: formatMoney(a.avgDailyPnl), c: a.avgDailyPnl >= 0 ? 'text-win' : 'text-loss' },
    { k: 'ימים ירוקים / אדומים', v: `${a.winningDays} / ${a.losingDays}` },
  ]

  const STOP_DESC: Record<string, string> = {
    MNQ: 'פילוח עסקאות ה-MNQ לפי גודל הסטופ שהשתמשת בו (15 מול 20 נקודות). לכל סטופ: אחוז ההצלחה (הפס) וכמה עסקאות נסגרו איתו. הקו האפור = 50%. למעלה: אחוז ההצלחה הכולל ב-MNQ.',
    MES: 'פילוח עסקאות ה-MES לפי גודל הסטופ (3 מול 4 נקודות). לכל סטופ: אחוז ההצלחה וכמה עסקאות. הקו האפור = 50%. למעלה: אחוז ההצלחה הכולל ב-MES.',
    YM: 'פילוח עסקאות ה-YM לפי גודל הסטופ, עם אחוז ההצלחה לכל סטופ. הכרטיס יתמלא אוטומטית ברגע שתתעד עסקאות YM.',
  }

  return (
    <div>
      {header}

      {/* ---- 1. Where you stand ---- */}
      <section className="mt-8 grid gap-6 xl:grid-cols-[260px_minmax(0,1fr)]">
        <div className="block-in flex flex-col gap-2" style={{ '--i': 1 } as React.CSSProperties}>
          <div className="text-[13px] font-medium text-muted">רווח נקי · {currentLabel}</div>
          <div
            className={`text-[52px] font-bold leading-none tracking-tight ${a.netPnl >= 0 ? 'text-win' : 'text-loss'}`}
            dir="ltr"
            style={{ textAlign: 'right' }}
          >
            <CountUp value={a.netPnl} format={money} />
          </div>
          {prev && (
            <div className="flex items-center gap-2 text-[13px] text-muted">
              <Delta value={a.netPnl - prev.netPnl} money /> מול התקופה הקודמת
            </div>
          )}
          <dl className="mt-4 flex flex-col border-t border-border text-sm">
            {[
              ['עסקאות', `${a.totalTrades}`],
              ['חודשים ירוקים', `${greenMonths} / ${months.length}`],
              ['Drawdown מקס׳', formatMoney(-a.maxDrawdown)],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between border-b border-border py-2">
                <dt className="text-muted">{k}</dt>
                <dd className="num font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="block-in panel p-5" style={{ '--i': 2 } as React.CSSProperties}>
          <div className="mb-3 flex items-center gap-1.5">
            <h2 className="text-[15px] font-semibold">עקומת הון</h2>
            <InfoPopover text="הרווח המצטבר (P&L) של החשבון לאורך כל העסקאות, לפי הסדר הכרונולוגי. קו עולה = החשבון צומח. העבר את העכבר על הגרף כדי לראות את הסכום המצטבר בכל עסקה." />
          </div>
          <LineChart data={a.equity} labels={a.equityLabels} format={money} height={230} showXAxis={false} />
          <div className="mb-2 mt-5 flex items-center gap-1.5">
            <h3 className="text-[13px] font-semibold text-[#5f5e5b]">Drawdown · מתחת לשיא</h3>
            <InfoPopover text="כמה החשבון נמצא מתחת לשיא הגבוה ביותר שלו, בכל נקודת זמן. זה מדד הכאב: ככל שהגרף רדוד יותר, ניהול הסיכון טוב יותר. הנקודה המסומנת היא הירידה הגדולה ביותר שחווית." />
            <span className="tag tag-red num mr-auto">מקס׳ {formatMoney(-a.maxDrawdown)}</span>
          </div>
          <LineChart data={a.drawdown} labels={a.equityLabels} format={money} height={90} color={CHART.loss} mode="underwater" />
        </div>
      </section>

      {/* ---- 2. Your edge ---- */}
      <Section
        title="היתרון שלך"
        insight={
          a.payoff && a.payoff > 1 ? (
            <>
              אתה צודק ב-<b>{formatPct(a.winRate)}</b> מהעסקאות, אבל עסקה מנצחת גדולה פי <b className="num">{a.payoff.toFixed(1)}</b> ממפסידה.
              זה מה שמייצר את הרווח.
            </>
          ) : (
            <>ההפסדים הממוצעים גדולים מהרווחים הממוצעים. כדאי לבדוק את גודל הסטופ ואת נקודות היציאה.</>
          )
        }
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {heroStats.map((s) => (
            <div key={s.label} className="panel flex flex-col gap-3 p-4">
              <div className="flex items-center gap-1 text-[13px] text-muted">
                {s.label}
                <InfoPopover text={s.desc} />
                <span className="mr-auto">{s.delta}</span>
              </div>
              <div className={`text-[28px] font-bold leading-none ${s.cls ?? ''}`} dir="ltr" style={{ textAlign: 'right' }}>
                {s.value}
              </div>
              <div className="mt-auto">{s.body}</div>
            </div>
          ))}
        </div>

        <div className="panel mt-3 grid gap-x-8 px-5 py-2 sm:grid-cols-2 lg:grid-cols-3">
          {facts.map((f) => (
            <div key={f.k} className="flex items-center justify-between border-b border-[#f1f0ed] py-2.5 text-sm last:border-0 sm:[&:nth-last-child(-n+2)]:border-0 lg:[&:nth-last-child(-n+3)]:border-0">
              <span className="text-muted">{f.k}</span>
              <span className={`num font-semibold ${f.c ?? ''}`}>{f.v}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ---- 3. When you make money ---- */}
      <Section
        title="מתי אתה מרוויח"
        insight={
          bestMonth && bestDay && bestHour ? (
            <>
              החודש הכי טוב: <b>{bestMonth.label}</b> (<span className="num">{formatMoney(bestMonth.value)}</span>). היום הכי רווחי: <b>{WEEKDAY_FULL[bestDay.label] ?? bestDay.label}</b>.
              השעה הכי רווחית: <b className="num">{bestHour.label}</b>.
            </>
          ) : undefined
        }
      >
        <Block
          title="P&L לפי חודש"
          desc="הרווח/הפסד נטו בכל חודש קלנדרי. עוזר לזהות מגמות לאורך זמן ולראות אם אתה משתפר מחודש לחודש. ירוק = חודש רווחי, אדום = חודש מפסיד. החודש הטוב והגרוע מסומנים במספר; העבר עכבר על עמודה לפרטים."
          hint={<span className="tag num">{greenMonths}/{months.length} חודשים ירוקים</span>}
        >
          <Columns
            items={months}
            format={money}
            height={200}
            minSlot={26}
            tick={(_, i) => (
              <>
                {MONTHS_SHORT[Number(months[i].mm) - 1].replace('׳', '')}
                {(i === 0 || months[i].mm === '01') && <span className="block font-semibold text-ink">20{months[i].yy}</span>}
              </>
            )}
          />
        </Block>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Block
            title="P&L לפי יום בשבוע"
            desc="הרווח/הפסד הכולל בכל יום בשבוע. מגלה אם יש ימים שבהם אתה עקבי ברווח או בהפסד, כדי להתמקד בימים החזקים. בריחוף: מספר העסקאות ואחוז ההצלחה ביום."
          >
            <Columns items={weekdays} format={money} height={160} />
          </Block>
          <Block
            title="P&L לפי שעת כניסה"
            desc="הרווח/הפסד הכולל לפי שעת הכניסה לעסקה (שעון ישראל). מגלה באילו שעות אתה הכי רווחי ובאילו כדאי להימנע ממסחר."
          >
            <Columns items={hours} format={money} height={160} />
          </Block>
        </div>
      </Section>

      {/* ---- 4. What works ---- */}
      <Section
        title="מה עובד לך"
        insight={
          strongerSide ? (
            <>
              ה<b>{strongerSide}</b> שלך רווחי יותר
              {a.bySymbol[0] && (
                <>
                  , והנכס הכי רווחי הוא <b>{a.bySymbol[0].label}</b>
                </>
              )}
              {a.byLookback[0] && (
                <>
                  . מודל הכניסה החזק: <b>{a.byLookback[0].label}</b> (<span className="num">{a.byLookback[0].value > 0 ? '+' : ''}{a.byLookback[0].value.toFixed(2)}R</span> לעסקה)
                </>
              )}
              .
            </>
          ) : undefined
        }
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <Block
            title="לונג מול שורט"
            desc="השוואת הרווח/הפסד בין עסקאות לונג לעסקאות שורט, כולל מספר העסקאות ואחוז ההצלחה בכל כיוון. מגלה אם אתה חזק יותר בכיוון מסוים."
          >
            <BarRows rows={sideRows} format={money} />
          </Block>
          <Block
            title="לפי נכס"
            desc="הרווח/הפסד הכולל בכל נכס שנסחר (למשל MNQ מול MES), עם מספר העסקאות ואחוז ההצלחה בכל אחד. עוזר לזהות באיזה נכס אתה הכי רווחי."
          >
            <BarRows rows={symbolRows} format={money} />
          </Block>
        </div>
        <Block
          className="mt-3"
          title="לפי מודל כניסה (Lookback)"
          desc="ביצועי כל מודל כניסה שתייגתם: הפס = תוחלת ב-R לעסקה, ומתחת לשם: מספר העסקאות ואחוז ההצלחה. מודל עם R שלילי (אדום) או אחוז הצלחה נמוך הוא מודל חלש: כדאי להימנע ממנו או להוריד בו מינוף. מתמלא ככל שתעדכנו את שדה ה-Lookback בעסקאות."
          hint={<span className="tag">תוחלת ב-R</span>}
        >
          {lookbackRows.length ? (
            <BarRows rows={lookbackRows} format={(v) => `${v > 0 ? '+' : ''}${v.toFixed(2)}R`} />
          ) : (
            <EmptyNote text="עדיין לא תויגו מודלי כניסה. עדכנו את שדה ה-Lookback בעסקאות כדי לראות אילו מודלים חזקים ואילו חלשים." />
          )}
        </Block>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <Block
            title="לפי לקיחת נזילות"
            desc="אחוז ההצלחה לפי מה שסומן בשדה הנזילות: Buyside, Sellside או 'לא נלקחה'. נספרות רק עסקאות שסימנתם בהן נזילות; עסקאות ללא סימון לא נכנסות לחישוב. הקו האפור = 50%."
            hint={<span className="tag">אחוז הצלחה</span>}
          >
            {a.byLiquidity.length ? (
              <BarRows rows={winRateRows(a.byLiquidity)} format={(v) => `${v}%`} domain={[0, 100]} reference={50} referenceLabel="50%" />
            ) : (
              <EmptyNote text="עדיין לא תויג שדה הנזילות בעסקאות. סמנו Buyside / Sellside / לא נלקחה בעסקאות כדי לראות את ההשוואה." />
            )}
          </Block>
          <Block
            title="אחוז הצלחה לפי אזור וכיוון"
            desc="מתוך העסקאות שבהן סומן אזור בלבד: אחוז ההצלחה של לונג ב-Premium / Deadzone / Discount, מול שורט בכל אזור. הקו האפור = 50%. עוזר לזהות מאיזה אזור וכיוון אתם הכי מדויקים (למשל לונג מ-Discount מול שורט מ-Premium)."
            hint={<span className="tag">אחוז הצלחה</span>}
          >
            {a.byZone.length ? (
              <BarRows rows={winRateRows(a.byZone)} format={(v) => `${v}%`} domain={[0, 100]} reference={50} referenceLabel="50%" />
            ) : (
              <EmptyNote text="עדיין לא תויג שדה האזור בעסקאות. סמנו Premium / Deadzone / Discount בעסקאות כדי לראות את הפילוח לפי כיוון." />
            )}
          </Block>
        </div>
        <Block
          className="mt-3"
          title="אחוז הצלחה לפי ביאס"
          desc="אחוז ההצלחה לפי זוג ה-HTF (הביאס) שסומן בעסקה. נספרות רק עסקאות שסימנתם בהן ביאס. הפס = אחוז ההצלחה, ומתחת לשם מספר העסקאות. הקו האפור = 50%. עוזר לזהות אילו זוגות ביאס הכי מדויקים ומאילו כדאי להיזהר."
          hint={<span className="tag">אחוז הצלחה</span>}
        >
          {a.byBias.length ? (
            <BarRows rows={winRateRows(a.byBias)} format={(v) => `${v}%`} domain={[0, 100]} reference={50} referenceLabel="50%" />
          ) : (
            <EmptyNote text="עדיין לא תויג שדה הביאס בעסקאות. סמנו ביאס בעסקאות כדי לראות את הפילוח." />
          )}
        </Block>
      </Section>

      {/* ---- 5. Risk & stops ---- */}
      <Section
        title="סיכון וסטופים"
        insight={
          rTotal > 0 ? (
            <>
              <b className="num">{bigWins}</b> מתוך <b className="num">{rTotal}</b> עסקאות ({formatPct(bigWins / rTotal)}) הניבו <b>2R ומעלה</b>. הן
              שמממנות את כל ההפסדים הקטנים.
            </>
          ) : undefined
        }
      >
        <Block
          title="התפלגות R"
          desc="כמה עסקאות נסגרו בכל טווח של R (רווח או הפסד ביחס לסיכון). אדום = הפסד, ירוק = רווח. התפלגות בריאה: רוב ההפסדים סביב ‎-1R, וזנב ימני של עסקאות גדולות."
        >
          <Columns
            items={rDist}
            format={(v) => `${v}`}
            height={150}
            colorOf={(_, i) => (i < 3 ? CHART.loss : CHART.win)}
            meta={(b) => `${rTotal ? Math.round((b.count / rTotal) * 100) : 0}% מהעסקאות`}
          />
        </Block>
        <div className="mt-3 grid gap-3 lg:grid-cols-3">
          {['MNQ', 'MES', 'YM'].map((asset) => {
            const s = a.stopByAsset[asset]
            return (
              <Block
                key={asset}
                title={`${asset} · הצלחה לפי סטופ`}
                desc={STOP_DESC[asset]}
                hint={s && s.total > 0 ? <span className="tag num font-semibold">{formatPct(s.winRate)} כולל</span> : undefined}
              >
                {s && s.total > 0 ? (
                  <BarRows
                    rows={s.buckets.map((b) => ({
                      label: `סטופ ${b.stop} נק׳`,
                      value: Math.round(b.winRate * 100),
                      sub: `${b.count} עסקאות · ${Math.round((b.count / s.total) * 100)}%`,
                      color: b.winRate >= 0.5 ? CHART.win : CHART.loss,
                    }))}
                    format={(v) => `${v}%`}
                    domain={[0, 100]}
                    reference={50}
                    referenceLabel="50%"
                    compact
                  />
                ) : (
                  <EmptyNote text={`אין עדיין עסקאות ב-${asset}`} />
                )}
              </Block>
            )
          })}
        </div>
      </Section>
    </div>
  )
}
