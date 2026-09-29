import { useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ArrowUpRight, ArrowDownRight, CalendarRange, ChevronDown, TrendingUp, Lightbulb, X } from 'lucide-react'
import { useJournals } from '../lib/journals'
import { useTrades } from '../lib/useTrades'
import { CHART_MOVE_LABEL } from '../lib/chartMove'
import { computeAnalytics, filterTradesByRange, type Bucket } from '../lib/analytics'
import { computeStats, formatPct } from '../lib/trades'
import { formatPnl, inUnit, useUnit } from '../lib/unit'
import { useGlobalFilter } from '../lib/globalFilter'
import { MIN_WHATIF, whatIfGrid } from '../lib/whatIf'
import { breakevenStats } from '../lib/breakeven'
import { tradeDays } from '../lib/tradeDays'
import { levelStats } from '../lib/levels'
import { GlobalFilterButton, GlobalFilterChips, GlobalFilterPanel } from '../components/GlobalFilter'
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
const money = (v: number) => formatPnl(v) // $ or points, per the journal's unit switch
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
      {isMoney ? formatPnl(value) : `${up ? '+' : ''}${value.toFixed(Math.abs(value) >= 10 ? 0 : 1)}${suffix}`}
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

/** "מה אם": every stop × target combination, replayed from each trade's MFE / MAE. */
function WhatIf({ trades }: { trades: Parameters<typeof whatIfGrid>[0] }) {
  const w = useMemo(() => whatIfGrid(trades), [trades])
  const fmt = (r: number) => `${r > 0 ? '+' : ''}${r.toFixed(2)}R`
  return (
    <Block
      className="mt-3"
      title="מה אם: יעד וסטופ"
      desc="כל עסקה משוחזרת מה-MFE / MAE שלה (מ-Pine), ב-R של הסטופ המקורי שלה, כך ש-NQ ו-ES נספרים יחד. שורה = גודל סטופ (פי כמה מהמקורי), עמודה = יעד ב-R. בכל תא: התוחלת לעסקה ב-R ואחוז ההצלחה. ניצחון = ה-MFE הגיע ליעד לפני שה'נגד עד השיא' עבר את הסטופ; הפסד = ה-MAE עבר את הסטופ; אחרת העסקה נסגרה כמו שנסגרה. כשאי אפשר לדעת (למשל יעד רחוק מהיעד המקורי שכבר נלקח) — נספר 0R. כשגם יעד וגם סטופ היו אפשריים — נספר הפסד. התא הטוב ביותר מודגש."
      hint={<span className="tag">{w.n} עסקאות</span>}
    >
      {w.cells.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="h-8 border-b border-border text-[13px] text-muted [&>th]:px-1.5 [&>th]:font-normal">
                <th className="text-right">סטופ \ יעד</th>
                {w.cells[0].map((c) => (
                  <th key={c.targetR} className="num !text-left">{c.targetR}R</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {w.cells.map((row) => (
                <tr key={row[0].stopMult} className="border-b border-[#f1f0ed] [&>td]:px-1.5 [&>td]:py-1.5">
                  <td className="whitespace-nowrap text-[13px]">
                    ×{row[0].stopMult}
                    {row[0].stopMult === 1 && <span className="text-muted"> (המקורי)</span>}
                  </td>
                  {row.map((c) => {
                    const top = w.best === c
                    return (
                      <td key={c.targetR} className={`text-left ${top ? 'rounded bg-tag-green' : ''}`}>
                        <div className={`num font-semibold ${c.expectancy > 0 ? 'text-win' : c.expectancy < 0 ? 'text-loss' : 'text-muted'}`}>{fmt(c.expectancy)}</div>
                        <div className="num text-[11px] text-muted">{Math.round(c.winRate * 100)}%</div>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {w.best && (
            <p className="mt-3 text-[13px] text-muted">
              הכי טוב: סטופ <b className="num text-ink">×{w.best.stopMult}</b> ויעד <b className="num text-ink">{w.best.targetR}R</b> —{' '}
              <b className="num text-ink">{fmt(w.best.expectancy)}</b> לעסקה, <b className="num text-ink">{Math.round(w.best.winRate * 100)}%</b> הצלחה.
            </p>
          )}
        </div>
      ) : (
        <EmptyNote text={`צריך לפחות ${MIN_WHATIF} עסקאות עם MFE / MAE, סטופ ויציאה. הם נשמרים אוטומטית מהשורה "MFE / MAE" בדוח של Pine Logs.`} />
      )}
    </Block>
  )
}

/** Break-even: how often it kicks in, what it did to the result, and — when Pine reports it — what it cost or saved. */
function Breakeven({ trades }: { trades: Parameters<typeof breakevenStats>[0] }) {
  const b = useMemo(() => breakevenStats(trades), [trades])
  const r = (v: number | null) => (v == null ? '—' : `${v > 0 ? '+' : ''}${v.toFixed(2)}R`)
  const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`)
  return (
    <Block
      className="mt-3"
      title="ניתוח ברייק-איבן"
      desc="מהשורה 'ברייק-איבן' בדוח של Pine: באילו עסקאות הברייק-איבן הופעל, איך הן נגמרו, ותוך כמה דקות הוא הופעל. 'הגיעו לפני כן' = כמה עסקאות שחזרו ל-0 הלכו קודם בעדך (MFE ב-R). מה היה קורה בלי ברייק-איבן אי אפשר לחשב מה-MFE/MAE (הם נגמרים ביציאה) — רק האינדיקטור יודע, דרך השורה 'תוצאה בלי ברייק-איבן'."
    >
      {b ? (
        <>
          <p className="text-[14px]">
            הופעל ב-<b className="num">{b.on.count}</b> מתוך <b className="num">{b.on.count + b.off.count}</b> עסקאות: <b className="num">{b.endedAtBe}</b> חזרו ל-0,{' '}
            <b className="num">{b.wonAnyway}</b> בכל זאת הגיעו לרווח.
            {b.beExitMfeR != null && (
              <>
                {' '}אלה שחזרו ל-0 הגיעו לפני כן בממוצע ל-<b className="num">{r(b.beExitMfeR)}</b> בעדך.
              </>
            )}
          </p>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="h-8 border-b border-border text-right text-[13px] text-muted [&>th]:px-1.5 [&>th]:font-normal">
                <th />
                <th className="!text-left">עסקאות</th>
                <th className="!text-left">אחוז הצלחה</th>
                <th className="!text-left">R ממוצע</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['הופעל', b.on],
                  ['לא הופעל', b.off],
                ] as const
              ).map(([label, g]) => (
                <tr key={label} className="h-9 border-b border-[#f1f0ed] [&>td]:px-1.5">
                  <td className="font-medium">{label}</td>
                  <td className="num text-left">{g.count}</td>
                  <td className="num text-left">{pct(g.winRate)}</td>
                  <td className="num text-left">{r(g.avgR)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {b.byMinutes.length > 0 && (
            <table className="mt-4 w-full text-sm">
              <thead>
                <tr className="h-8 border-b border-border text-right text-[13px] text-muted [&>th]:px-1.5 [&>th]:font-normal">
                  <th>הופעל אחרי</th>
                  <th className="!text-left">עסקאות</th>
                  <th className="!text-left">חזרו ל-0</th>
                  <th className="!text-left">הגיעו לרווח</th>
                </tr>
              </thead>
              <tbody>
                {b.byMinutes.map((m) => (
                  <tr key={m.label} className="h-9 border-b border-[#f1f0ed] [&>td]:px-1.5">
                    <td>{m.label}</td>
                    <td className="num text-left">{m.count}</td>
                    <td className="num text-left">{m.endedAtBe}</td>
                    <td className="num text-left">{m.won}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 text-[13px] text-muted">
            {b.without ? (
              <>
                לפי Pine, ב-<b className="num text-ink">{b.without.count}</b> עסקאות עם ברייק-איבן: <b className="num text-ink">{r(b.without.withR)}</b> איתו מול{' '}
                <b className="num text-ink">{r(b.without.withoutR)}</b> בלעדיו — הברייק-איבן{' '}
                <b className={`num ${b.without.withR >= b.without.withoutR ? 'text-win' : 'text-loss'}`}>
                  {b.without.withR >= b.without.withoutR ? 'חסך' : 'עלה'} {Math.abs(b.without.withR - b.without.withoutR).toFixed(2)}R
                </b>
                .
              </>
            ) : (
              'כדי לדעת כמה הברייק-איבן חסך או עלה — הוסיפו לדוח של Pine את השורה "תוצאה בלי ברייק-איבן: טרגט +60".'
            )}
          </p>
        </>
      ) : (
        <EmptyNote text="עדיין אין עסקאות עם נתון ברייק-איבן. הוא נשמר אוטומטית מהשורה 'ברייק-איבן' בדוח של Pine Logs." />
      )}
    </Block>
  )
}

/** Pine's levels around the entry (Td, Tny, …) and the lookback touch — how the trades did around them. */
function Levels({ trades }: { trades: Parameters<typeof levelStats>[0] }) {
  const rows = useMemo(() => levelStats(trades), [trades])
  const touch = useMemo(() => {
    const g = (v: boolean) => {
      const ts = trades.filter((t) => t.lb_touch === v)
      const w = ts.filter((t) => t.return_amount > 0).length
      const l = ts.filter((t) => t.return_amount < 0).length
      return { count: ts.length, winRate: w + l ? w / (w + l) : null }
    }
    return { yes: g(true), no: g(false) }
  }, [trades])
  const pct = (v: number | null) => (v == null ? '—' : `${Math.round(v * 100)}%`)
  const hasTouch = touch.yes.count + touch.no.count > 0
  return (
    <Block
      className="mt-3"
      title="יעדים ונגיעה בלוקבק"
      desc="מהדוח של Pine. רמה נחשבת יעד רק כשהיא בכיוון העסקה ובמרחק של 1:3 ומעלה (פי 3 מהסטופ) — רמות קרובות יותר לא נספרות כאן ולא במסננים (בדף העסקה הן מסומנות 'פחות מ-1:3'). לכל רמה: בכמה עסקאות היא הייתה יעד, כמה רחוק בממוצע (ב-R), כמה פעמים המחיר הגיע אליה עד סוף היום (בעסקה לפי ה-MFE, אחריה לפי מהלך הגרף), ואחוז ההצלחה כשהיא הייתה יעד מול כשלא. נגיעה בלוקבק = האם המחיר נגע בלוקבק לפני שעת ההזדמנות."
    >
      {rows.length || hasTouch ? (
        <>
          {hasTouch && (
            <p className="text-[14px]">
              נגיעה בלוקבק לפני ההזדמנות: <b>כן</b> <b className="num">{pct(touch.yes.winRate)}</b> הצלחה (
              <span className="num">{touch.yes.count}</span>) · <b>לא</b> <b className="num">{pct(touch.no.winRate)}</b> הצלחה (
              <span className="num">{touch.no.count}</span>)
            </p>
          )}
          {rows.length > 0 && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="h-8 border-b border-border text-right text-[13px] text-muted [&>th]:px-1.5 [&>th]:font-normal">
                    <th>רמה</th>
                    <th className="!text-left">יעד 1:3+</th>
                    <th className="!text-left">מרחק ממוצע</th>
                    <th className="!text-left">המחיר הגיע</th>
                    <th className="!text-left">הצלחה כיעד</th>
                    <th className="!text-left">הצלחה בלי</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((x) => (
                    <tr key={x.name} className="h-9 border-b border-[#f1f0ed] [&>td]:px-1.5">
                      <td dir="ltr" className="text-right font-medium">{x.name}</td>
                      <td className="num text-left">
                        {x.on}/{x.of}
                      </td>
                      <td className="num text-left">{x.avgR == null ? '—' : `${x.avgR.toFixed(1)}R`}</td>
                      <td className="num text-left">{x.reachKnown ? pct(x.reached / x.reachKnown) : '—'}</td>
                      <td className="num text-left">
                        {pct(x.withIt.winRate)} <span className="text-faint">({x.withIt.n})</span>
                      </td>
                      <td className="num text-left">
                        {pct(x.without.winRate)} <span className="text-faint">({x.without.n})</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="mt-3 text-[13px] text-muted">
            רק רמות בכיוון העסקה במרחק 1:3 ומעלה. "הצלחה כיעד" / "הצלחה בלי" — אחוז הצלחה (בסוגריים: עסקאות שהוכרעו) כשהרמה הייתה יעד, מול כשלא הייתה (חסרה, בצד השני, או פחות מ-1:3).
          </p>
        </>
      ) : (
        <EmptyNote text="עדיין אין עסקאות עם יעדים או נגיעה בלוקבק. הם נשמרים אוטומטית מהשורות 'יעדים (מרחק מהכניסה)' ו'נגיעה בלוקבק' בדוח של Pine Logs." />
      )}
    </Block>
  )
}

/** Days without a trade, counted over every Mon–Fri between the first and the last trade. Closed until opened. */
function NoTradeDays({ trades }: { trades: Parameters<typeof tradeDays>[0] }) {
  const d = useMemo(() => tradeDays(trades), [trades])
  const [open, setOpen] = useState(false)
  if (!d) return null
  const pctOfDays = (n: number, of: number) => (of ? `${Math.round((n / of) * 100)}%` : '—')
  const dm = (iso: string) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`
  return (
    <Block
      className="mt-12"
      title="ימים בלי עסקה"
      desc="כל יום ב׳–ו׳ בין העסקה הראשונה לאחרונה נחשב יום מסחר (מניחים שהבאק-טסט עבר על כל יום; חגים ייספרו כימים בלי עסקה), ומתוכם — באילו הייתה עסקה. עוזר לדעת כמה הזדמנויות לצפות בחודש ובאילו ימים בשבוע הן נדירות. מתעדכן לפי הסינון והתקופה."
      hint={
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[13px] text-muted transition-colors hover:bg-surface hover:text-ink"
        >
          <span className="num">{d.without.length}</span> ימים בלי עסקה
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      }
    >
      {open && (
        <>
          <p className="text-[14px]">
            עסקה ב-<b className="num">{d.withTrade}</b> מתוך <b className="num">{d.tradingDays}</b> ימים (<b className="num">{pctOfDays(d.withTrade, d.tradingDays)}</b>) ·{' '}
            <b className="num">{d.without.length}</b> ימים בלי עסקה · בממוצע <b className="num">{d.perMonth.toFixed(1)}</b> ימים עם עסקה בחודש.
          </p>
          <p className="mt-1 text-[13px] text-muted">
            {d.bySession.map((s, i) => (
              <span key={s.session}>
                {i > 0 && ' · '}הזדמנות <span className="num">{s.session}</span>: <b className="num text-ink">{s.days}</b> ימים
              </span>
            ))}
          </p>
          <table className="mt-3 w-full text-sm">
            <thead>
              <tr className="h-8 border-b border-border text-right text-[13px] text-muted [&>th]:px-1.5 [&>th]:font-normal">
                <th>יום</th>
                <th className="!text-left">ימי מסחר</th>
                <th className="!text-left">עם עסקה</th>
                <th className="!text-left">%</th>
              </tr>
            </thead>
            <tbody>
              {d.byWeekday.map((w) => (
                <tr key={w.label} className="h-9 border-b border-[#f1f0ed] [&>td]:px-1.5">
                  <td>{w.label}</td>
                  <td className="num text-left">{w.days}</td>
                  <td className="num text-left">{w.withTrade}</td>
                  <td className="num text-left">{pctOfDays(w.withTrade, w.days)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {d.without.length > 0 && (
            <div className="mt-3">
              <div className="mb-1.5 text-[12px] text-muted">הימים האחרונים בלי עסקה</div>
              <div className="flex flex-wrap gap-1.5">
                {d.without.slice(0, 12).map((iso) => (
                  <span key={iso} className="tag num !text-[12px]">{dm(iso)}</span>
                ))}
                {d.without.length > 12 && <span className="text-[12px] text-faint">ועוד {d.without.length - 12}</span>}
              </div>
            </div>
          )}
        </>
      )}
    </Block>
  )
}

/* ---- Page ------------------------------------------------------------ */

export default function Analytics() {
  const { active } = useJournals()
  const { trades: rawTrades, loading } = useTrades()
  const unit = useUnit()
  // Every P&L on this page in the chosen unit ($ / points) — display only, never saved.
  const trades = useMemo(() => inUnit(rawTrades, unit), [rawTrades, unit])
  const [range, setRange] = useState<RangeKey>('all')
  const [customMonths, setCustomMonths] = useState<Set<string>>(new Set())
  const [showRange, setShowRange] = useState(false)
  const [custYear, setCustYear] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // The global filter (all pages) — then this page's own date range below.
  const { filtered: scoped, activeCount } = useGlobalFilter(trades)

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
    if (usingCustom) return scoped.filter((t) => customMonths.has(t.date.slice(0, 7)))
    return filterTradesByRange(scoped, from, to)
  }, [scoped, range, customMonths]) // eslint-disable-line react-hooks/exhaustive-deps
  const a = useMemo(() => computeAnalytics(filtered), [filtered])
  const prev = useMemo(() => {
    if (usingCustom || !from || !to) return null
    const span = to.getTime() - from.getTime()
    const pTrades = filterTradesByRange(scoped, new Date(from.getTime() - span), new Date(from.getTime() - 1))
    return pTrades.length ? computeStats(pTrades) : null
  }, [scoped, range, customMonths]) // eslint-disable-line react-hooks/exhaustive-deps

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
        <GlobalFilterButton open={showFilters} onToggle={() => setShowFilters((s) => !s)} />
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
      {activeCount > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-2">
          <GlobalFilterChips trades={trades} />
        </div>
      )}
      {showFilters && (
        <div className="animate-[fade-up_.3s_var(--ease-out-expo)_both] max-h-[60vh] overflow-y-auto pb-1 pt-3">
          <GlobalFilterPanel trades={trades} />
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
          {activeCount > 0 ? 'אין עסקאות שתואמות לסינון ולטווח שנבחרו. נסה להסיר חלק מהסינונים.' : 'אין עסקאות בטווח שנבחר. נסה טווח רחב יותר.'}
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
          format={(v) => formatPnl(v, false)}
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
          של <b className="num text-ink">{formatPnl(a.avgDailyPnl)}</b> ליום.
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
          format={(v) => formatPnl(v, false)}
          compact
        />
      ),
    },
  ]

  const facts = [
    { k: 'ניצחון ממוצע', v: formatPnl(a.avgWin), c: 'text-win' },
    { k: 'הפסד ממוצע', v: formatPnl(-a.avgLoss), c: 'text-loss' },
    { k: 'Payoff', v: a.payoff ? a.payoff.toFixed(2) : '—' },
    { k: 'Drawdown מקסימלי', v: formatPnl(-a.maxDrawdown), c: 'text-loss' },
    { k: 'העסקה הטובה', v: formatPnl(a.bestTrade), c: 'text-win' },
    { k: 'העסקה הגרועה', v: formatPnl(a.worstTrade), c: 'text-loss' },
    { k: 'רצף ניצחונות', v: `${a.maxWinStreak}` },
    { k: 'רצף הפסדים', v: `${a.maxLossStreak}` },
    { k: 'ימי מסחר', v: `${a.tradingDays}` },
    { k: 'אחוז ימים ירוקים', v: formatPct(a.dayWinRate) },
    { k: 'ממוצע יומי', v: formatPnl(a.avgDailyPnl), c: a.avgDailyPnl >= 0 ? 'text-win' : 'text-loss' },
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
              ['Drawdown מקס׳', formatPnl(-a.maxDrawdown)],
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
            <span className="tag tag-red num mr-auto">מקס׳ {formatPnl(-a.maxDrawdown)}</span>
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
              החודש הכי טוב: <b>{bestMonth.label}</b> (<span className="num">{formatPnl(bestMonth.value)}</span>). היום הכי רווחי: <b>{WEEKDAY_FULL[bestDay.label] ?? bestDay.label}</b>.
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
        <Block
          className="mt-3"
          title="אחוז הצלחה לפי שבוע בחודש"
          desc="אחוז ההצלחה בכל שבוע בחודש (שבוע 1 עד 5), לפי מה שסומן בעסקה או יובא מ-Pine Logs. נספרות רק עסקאות שיש בהן שבוע. הפס = אחוז ההצלחה, ומתחת לשם מספר העסקאות. הקו האפור = 50%."
          hint={<span className="tag">אחוז הצלחה</span>}
        >
          {a.byWeekOfMonth.length ? (
            <BarRows rows={winRateRows(a.byWeekOfMonth)} format={(v) => `${v}%`} domain={[0, 100]} reference={50} referenceLabel="50%" />
          ) : (
            <EmptyNote text="עדיין לא סומן שבוע בחודש בעסקאות. בחרו שבוע באזור ההקשר בטופס העסקה, או ייבאו מ-Pine Logs." />
          )}
        </Block>
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
          {a.lookbackSize.map((s) => (
            <Block
              key={s.asset}
              title={`${s.asset} · אחוז הצלחה לפי גודל Lookback`}
              desc={`אחוז ההצלחה ב-${s.asset} (כולל M${s.asset}) לפי גודל ה-Lookback בנקודות, בטווחים של 0–1, 1–2, 2–3 ו-3 ומעלה. מתחת: הגודל הממוצע בעסקאות מנצחות מול מפסידות. נספרות רק עסקאות שיש בהן גודל Lookback (מ-Pine Logs או שהוזן ידנית). הקו האפור = 50%.`}
              hint={<span className="tag">אחוז הצלחה</span>}
            >
              {s.buckets.length ? (
                <>
                  <BarRows rows={winRateRows(s.buckets)} format={(v) => `${v}%`} domain={[0, 100]} reference={50} referenceLabel="50%" compact />
                  <p className="mt-3 text-[13px] text-muted">
                    גודל ממוצע: מנצחות <b className="num text-win">{s.avgWin != null ? s.avgWin.toFixed(2) : '—'}</b> נק׳ · מפסידות{' '}
                    <b className="num text-loss">{s.avgLoss != null ? s.avgLoss.toFixed(2) : '—'}</b> נק׳
                  </p>
                </>
              ) : (
                <EmptyNote text={`עדיין אין עסקאות ${s.asset} עם גודל Lookback. הוא נשמר אוטומטית מ-Pine Logs, ואפשר להזין אותו ידנית בטופס העסקה.`} />
              )}
            </Block>
          ))}
        </div>
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
          title="אחוז הצלחה לפי סוג יום"
          desc="אחוז ההצלחה לפי סוג היום: Main, Semi או ATH. נקבע מ-Pine Logs או נבחר בטופס העסקה, מעל ההערות. נספרות רק עסקאות שיש בהן סוג יום. הפס = אחוז ההצלחה, ומתחת לשם מספר העסקאות. הקו האפור = 50%."
          hint={<span className="tag">אחוז הצלחה</span>}
        >
          {a.byDayKind.length ? (
            <BarRows rows={winRateRows(a.byDayKind)} format={(v) => `${v}%`} domain={[0, 100]} reference={50} referenceLabel="50%" />
          ) : (
            <EmptyNote text="עדיין אין עסקאות עם סוג יום. בחרו Main / Semi / ATH מעל ההערות בטופס העסקה, או ייבאו מ-Pine Logs." />
          )}
        </Block>
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
        <Block
          className="mt-3"
          title="מהלך גרף לפי טיימפריים"
          desc="כמה נקודות המחיר הלך בעד העסקה ונגדה בכל גרף (לפי סגירת נר), בממוצע, בנפרד לעסקאות מנצחות ולמפסידות. עוזר לראות באיזה טיימפריים המנצחות רצות בלי לחזור, וכמה המפסידות הספיקו ללכת בעדכם לפני שנסגרו. נספרות רק עסקאות שיובאו מ-Pine Logs עם נתון מהלך גרף."
          hint={<span className="tag">ממוצע בנקודות</span>}
        >
          {a.chartMove.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="h-8 text-[13px] text-muted [&>th]:px-1.5 [&>th]:font-normal">
                    <th />
                    <th colSpan={2} className="border-b border-border !font-semibold text-win">
                      מנצחות
                    </th>
                    <th colSpan={2} className="border-b border-border !font-semibold text-loss">
                      מפסידות
                    </th>
                  </tr>
                  <tr className="h-8 border-b border-border text-right text-[13px] text-muted [&>th]:px-1.5 [&>th]:font-normal">
                    <th>גרף</th>
                    <th className="!text-left">בעד</th>
                    <th className="!text-left">נגד</th>
                    <th className="!text-left">בעד</th>
                    <th className="!text-left">נגד</th>
                  </tr>
                </thead>
                <tbody>
                  {a.chartMove.map((r) => (
                    <tr key={r.tf} className="h-9 border-b border-[#f1f0ed] [&>td]:px-1.5">
                      <td className="font-medium">{CHART_MOVE_LABEL[r.tf]}</td>
                      <td className="num text-left">{r.win ? r.win.for.toFixed(2) : '—'}</td>
                      <td className="num text-left text-muted">{r.win ? r.win.against.toFixed(2) : '—'}</td>
                      <td className="num text-left">{r.loss ? r.loss.for.toFixed(2) : '—'}</td>
                      <td className="num text-left text-muted">{r.loss ? r.loss.against.toFixed(2) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[12px] text-muted">
                מבוסס על <span className="num">{Math.max(...a.chartMove.map((r) => r.win?.count ?? 0))}</span> מנצחות ו-
                <span className="num">{Math.max(...a.chartMove.map((r) => r.loss?.count ?? 0))}</span> מפסידות עם נתון מהלך גרף.
              </p>
            </div>
          ) : (
            <EmptyNote text="עדיין אין עסקאות עם נתון מהלך גרף. הוא נשמר אוטומטית בעסקאות שמיובאות מ-Pine Logs." />
          )}
        </Block>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {a.excursions.map((x) => {
            const n = (v: number | null | undefined) => (v == null ? '—' : v.toFixed(2))
            return (
              <Block
                key={x.asset}
                title={`${x.asset} · MFE / MAE`}
                desc={`במהלך העסקה (לפי פתיל, מ-Pine Logs), ב-${x.asset} (כולל M${x.asset}): MFE = כמה המחיר הלך בעדך לכל היותר, MAE = כמה הלך נגדך לכל היותר, "נגד עד השיא" = כמה הלך נגדך לפני שהגיע ל-MFE. ממוצעים בנקודות, מנצחות מול מפסידות. יעילות יציאה = כמה אחוז מה-MFE לקחת בפועל במנצחות. MAE מול סטופ = עד כמה המנצחות התקרבו לסטופ.`}
                hint={<span className="tag">ממוצע בנקודות</span>}
              >
                {x.win || x.loss ? (
                  <>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="h-8 border-b border-border text-right text-[13px] text-muted [&>th]:px-1.5 [&>th]:font-normal">
                          <th />
                          <th className="!text-left !font-semibold text-win">מנצחות</th>
                          <th className="!text-left !font-semibold text-loss">מפסידות</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(
                          [
                            ['MFE · בעד', 'mfe'],
                            ['MAE · נגד', 'mae'],
                            ['נגד עד השיא', 'maeToPeak'],
                          ] as const
                        ).map(([label, k]) => (
                          <tr key={k} className="h-9 border-b border-[#f1f0ed] [&>td]:px-1.5">
                            <td className="font-medium">{label}</td>
                            <td className="num text-left">{n(x.win?.[k])}</td>
                            <td className="num text-left">{n(x.loss?.[k])}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="mt-3 text-[13px] text-muted">
                      יעילות יציאה: <b className="num text-ink">{x.captured == null ? '—' : `${Math.round(x.captured)}%`}</b> מה-MFE · MAE
                      מול סטופ במנצחות: <b className="num text-ink">{x.maeOfStop == null ? '—' : `${Math.round(x.maeOfStop)}%`}</b>
                    </p>
                    <p className="mt-1 text-[12px] text-faint">
                      מבוסס על <span className="num">{x.win?.count ?? 0}</span> מנצחות ו-<span className="num">{x.loss?.count ?? 0}</span> מפסידות.
                    </p>
                  </>
                ) : (
                  <EmptyNote text={`עדיין אין עסקאות ${x.asset} עם MFE / MAE. הוא נשמר אוטומטית מהשורה "MFE / MAE" בדוח של Pine Logs.`} />
                )}
              </Block>
            )
          })}
        </div>
        <WhatIf trades={filtered} />
        <Breakeven trades={filtered} />
        <Levels trades={filtered} />
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

      {/* ---- Days without a trade: last, collapsed ---- */}
      <NoTradeDays trades={filtered} />
    </div>
  )
}
