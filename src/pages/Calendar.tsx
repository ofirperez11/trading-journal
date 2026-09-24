import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, X, Sparkles, CalendarDays } from 'lucide-react'
import { useTrades } from '../lib/useTrades'
import { formatMoney, cleanSymbol, formatR } from '../lib/trades'
import { PageTitle } from '../components/PageTitle'
import { compactMoney } from '../components/charts'
import type { Trade } from '../types'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS_HE = [
  'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
  'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר',
]

const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

type Outcome = 'win' | 'loss' | 'wash' | null
function outcomeOf(net: number, count: number): Outcome {
  if (count === 0) return null
  if (net > 0) return 'win'
  if (net < 0) return 'loss'
  return 'wash'
}

// Day tint: tag colours; bigger days read a step stronger.
const cellTint: Record<Exclude<Outcome, null>, [string, string]> = {
  win: ['bg-tag-green/70 hover:bg-tag-green', 'bg-[#c3e2c7] hover:bg-[#b5dbba]'],
  loss: ['bg-tag-red/70 hover:bg-tag-red', 'bg-[#fccfc6] hover:bg-[#f9c2b7]'],
  wash: ['bg-tag-gray/70 hover:bg-tag-gray', 'bg-tag-gray/70 hover:bg-tag-gray'],
}
const netText: Record<Exclude<Outcome, null>, string> = {
  win: 'text-tag-green-fg',
  loss: 'text-tag-red-fg',
  wash: 'text-muted',
}
const signCls = (v: number) => (v > 0 ? 'text-win' : v < 0 ? 'text-loss' : 'text-muted')

interface DayAgg {
  net: number
  count: number
  wins: number
  losses: number
  rSum: number
}

export default function Calendar() {
  const { trades, loading } = useTrades()
  const navigate = useNavigate()

  // Group trades by day (YYYY-MM-DD).
  const byDay = useMemo(() => {
    const m = new Map<string, DayAgg>()
    for (const t of trades) {
      const key = t.date.slice(0, 10)
      const a = m.get(key) ?? { net: 0, count: 0, wins: 0, losses: 0, rSum: 0 }
      a.net += t.return_amount
      a.count += 1
      if (t.return_amount > 0) a.wins += 1
      else if (t.return_amount < 0) a.losses += 1
      a.rSum += t.r_multiple ?? (t.return_amount < 0 ? -1 : 0)
      m.set(key, a)
    }
    return m
  }, [trades])

  const years = useMemo(() => {
    const set = new Set<number>()
    for (const t of trades) set.add(Number(t.date.slice(0, 4)))
    // Always offer a range of past years (and next year) so an empty journal can
    // still navigate back — e.g. to start a 2024/2025 backtest.
    const now = new Date().getFullYear()
    for (let y = now - 6; y <= now + 1; y++) set.add(y)
    return [...set].sort((a, b) => a - b)
  }, [trades])

  // Default to the latest month that has trades (recomputed once trades load),
  // unless the user has navigated to another month.
  const latest = useMemo(() => {
    let mx = ''
    for (const t of trades) if (t.date > mx) mx = t.date
    const d = mx ? new Date(mx) : new Date()
    return { year: d.getFullYear(), month: d.getMonth() }
  }, [trades])
  // Keep the viewed month in the URL (?y&m) so returning from a trade lands
  // back on the same month instead of resetting to the latest.
  const [searchParams, setSearchParams] = useSearchParams()
  const pY = searchParams.get('y')
  const pM = searchParams.get('m')
  const hasParam = pY != null && pM != null
  const year = hasParam ? Number(pY) : latest.year
  const month = hasParam ? Number(pM) : latest.month
  const goToMonth = (y: number, m: number) => setSearchParams({ y: String(y), m: String(m) })
  const [selected, setSelected] = useState<string | null>(null)

  const weeks = useMemo(() => {
    const first = new Date(year, month, 1)
    const last = new Date(year, month + 1, 0)
    const cursor = new Date(year, month, 1 - first.getDay()) // back up to Sunday
    const out: Date[][] = []
    while (true) {
      const week: Date[] = []
      for (let i = 0; i < 7; i++) {
        week.push(new Date(cursor))
        cursor.setDate(cursor.getDate() + 1)
      }
      out.push(week)
      if (cursor > last) break
    }
    return out
  }, [year, month])

  // Month-level summary (days inside the viewed month only).
  const monthStats = useMemo(() => {
    let net = 0
    let count = 0
    let greenDays = 0
    let redDays = 0
    let rSum = 0
    let best: { key: string; net: number } | null = null
    for (const [key, a] of byDay) {
      if (!key.startsWith(`${year}-${pad(month + 1)}`)) continue
      net += a.net
      count += a.count
      rSum += a.rSum
      if (a.net > 0) greenDays++
      else if (a.net < 0) redDays++
      if (!best || a.net > best.net) best = { key, net: a.net }
    }
    // A "big" day is at least 1.5× the month's average absolute day.
    const days = [...byDay.entries()].filter(([k]) => k.startsWith(`${year}-${pad(month + 1)}`))
    const avgAbs = days.length ? days.reduce((s, [, a]) => s + Math.abs(a.net), 0) / days.length : 0
    return { net, count, greenDays, redDays, rSum, best, bigAt: avgAbs * 1.5 }
  }, [byDay, year, month])

  function shift(delta: number) {
    let m = month + delta
    let y = year
    if (m < 0) {
      m = 11
      y -= 1
    }
    if (m > 11) {
      m = 0
      y += 1
    }
    goToMonth(y, m)
  }

  const todayKey = ymd(new Date())
  const backState = { backTo: `/app/calendar?y=${year}&m=${month}`, backLabel: 'חזרה ללוח השנה' }

  if (loading) return <div className="flex h-64 items-center justify-center text-muted">טוען…</div>

  const navBtn = 'flex h-9 w-9 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink'

  return (
    <div>
      <PageTitle
        icon={CalendarDays}
        color="#cb912f"
        title="לוח שנה"
        subtitle="כל יום מסחר במבט אחד. לחץ על יום כדי לראות את העסקאות או להוסיף עסקה."
      />

      {/* Month controls + month summary */}
      <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="flex items-center gap-1">
          <button onClick={() => shift(-1)} aria-label="חודש קודם" className={navBtn}>
            <ChevronRight className="h-5 w-5" />
          </button>
          <h2 className="min-w-[150px] text-center text-2xl">
            {MONTHS_HE[month]} {year}
          </h2>
          <button onClick={() => shift(1)} aria-label="חודש הבא" className={navBtn}>
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => goToMonth(new Date().getFullYear(), new Date().getMonth())}
            className="mr-1 h-8 rounded-md border border-border px-2.5 text-[13px] text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            היום
          </button>
          <label className="sr-only" htmlFor="cal-month">חודש</label>
          <select id="cal-month" value={month} onChange={(e) => goToMonth(year, Number(e.target.value))} className="mr-1 hidden h-8 rounded-md border border-border bg-bg px-2 text-[13px] text-muted sm:block">
            {MONTHS_HE.map((m, i) => (
              <option key={m} value={i}>{m}</option>
            ))}
          </select>
          <label className="sr-only" htmlFor="cal-year">שנה</label>
          <select id="cal-year" value={year} onChange={(e) => goToMonth(Number(e.target.value), month)} className="hidden h-8 rounded-md border border-border bg-bg px-2 text-[13px] text-muted sm:block">
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <dl className="mr-auto flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted">החודש</dt>
            <dd className={`num text-lg font-bold ${signCls(monthStats.net)}`}>{monthStats.count ? formatMoney(monthStats.net) : '—'}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted">עסקאות</dt>
            <dd className="num font-semibold">{monthStats.count}</dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted">ימים</dt>
            <dd className="flex gap-1">
              <span className="tag tag-green num !font-semibold">{monthStats.greenDays}</span>
              <span className="tag tag-red num !font-semibold">{monthStats.redDays}</span>
            </dd>
          </div>
          <div className="flex items-baseline gap-1.5">
            <dt className="text-muted">סה״כ</dt>
            <dd className={`num font-semibold ${signCls(monthStats.rSum)}`}>{monthStats.count ? formatR(Math.round(monthStats.rSum * 10) / 10) : '—'}</dd>
          </div>
        </dl>
      </div>

      {/* Calendar is an LTR island: Sun→Sat left-to-right, weekly summary on the right — like the reference. */}
      <div dir="ltr" key={`${year}-${month}`} className="mt-4 select-none overflow-hidden rounded-[10px] border border-border">
        <div className="grid grid-cols-7 border-b border-border bg-bg sm:grid-cols-[repeat(7,minmax(0,1fr))_128px]">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2 text-[12px] font-medium text-muted">
              {d}
            </div>
          ))}
          <div className="hidden border-l border-border bg-surface px-3 py-2 text-right text-[12px] font-semibold text-muted sm:block">
            סיכום שבועי
          </div>
        </div>

        {weeks.map((week, wi) => {
          const wk = week.reduce(
            (acc, d) => {
              const a = byDay.get(ymd(d))
              if (a) {
                acc.net += a.net
                acc.count += a.count
                acc.wins += a.wins
                acc.losses += a.losses
                acc.rSum += a.rSum
              }
              return acc
            },
            { net: 0, count: 0, wins: 0, losses: 0, rSum: 0 },
          )
          return (
            <div key={wi} className="grid grid-cols-7 border-b border-border last:border-b-0 sm:grid-cols-[repeat(7,minmax(0,1fr))_128px]">
              {week.map((d, di) => {
                const key = ymd(d)
                const a = byDay.get(key)
                const oc = outcomeOf(a?.net ?? 0, a?.count ?? 0)
                const inMonth = d.getMonth() === month
                const isToday = key === todayKey
                const big = a && Math.abs(a.net) >= monthStats.bigAt && monthStats.bigAt > 0
                return (
                  <button
                    key={key}
                    onClick={() => setSelected(key)}
                    aria-label={`${d.getDate()} ${MONTHS_HE[d.getMonth()]}${a ? `, ${formatMoney(a.net)}, ${a.count} עסקאות` : ''}`}
                    className={`group relative flex h-[68px] flex-col border-r border-border p-1.5 text-left transition-colors [&:nth-child(7)]:border-r-0 sm:h-[104px] sm:p-2 sm:[&:nth-child(7)]:border-r ${
                      oc ? cellTint[oc][big ? 1 : 0] : inMonth ? 'bg-bg hover:bg-[#f7f6f3]' : 'bg-[#fbfbfa] hover:bg-[#f7f6f3]'
                    }`}
                    style={{ animation: `fade-up .35s var(--ease-out-expo) ${(wi * 7 + di) * 12}ms both` }}
                  >
                    <span className="flex items-center justify-between">
                      <span
                        className={`flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[12px] ${
                          isToday ? 'bg-[#eb5757] font-semibold text-white' : inMonth ? 'text-ink' : 'text-[#c7c6c3]'
                        }`}
                      >
                        {d.getDate()}
                      </span>
                      {!a && inMonth && <Plus className="h-3.5 w-3.5 text-faint opacity-0 transition-opacity group-hover:opacity-100" />}
                    </span>
                    {a && oc && (
                      <span className="mt-auto flex flex-col gap-0.5">
                        <span className={`num text-[11px] font-bold sm:text-[15px] ${netText[oc]}`}>
                          <span className="sm:hidden">{a.net > 0 ? '+' : ''}{compactMoney(a.net)}</span>
                          <span className="hidden sm:inline">{formatMoney(a.net)}</span>
                        </span>
                        <span dir="rtl" className={`hidden text-left text-[11px] sm:block ${netText[oc]} opacity-75`}>
                          {a.count === 1 ? 'עסקה אחת' : `${a.count} עסקאות`} · <span className="num">{Math.round(a.rSum * 10) / 10}R</span>
                        </span>
                      </span>
                    )}
                  </button>
                )
              })}
              {/* Weekly summary */}
              <div dir="rtl" className="hidden flex-col justify-center gap-1 border-l border-border bg-surface px-3 sm:flex">
                {wk.count > 0 ? (
                  <>
                    <span className={`num text-[15px] font-bold ${signCls(wk.net)}`}>{formatMoney(wk.net)}</span>
                    <span className={`num text-[12px] font-semibold ${signCls(wk.rSum)}`}>
                      {wk.rSum > 0 ? '+' : ''}
                      {Math.round(wk.rSum * 10) / 10}R
                    </span>
                    <span className="flex gap-1">
                      <span className="tag tag-green num !px-1.5 !text-[11px] !font-semibold">{wk.wins}</span>
                      <span className="tag tag-red num !px-1.5 !text-[11px] !font-semibold">{wk.losses}</span>
                    </span>
                  </>
                ) : (
                  <span className="text-[12px] text-faint">—</span>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {selected && (
        <DayPanel
          dateKey={selected}
          trades={trades.filter((t) => t.date.slice(0, 10) === selected)}
          onClose={() => setSelected(null)}
          onOpenTrade={(id) => navigate(`/app/trades/${id}`, { state: backState })}
          onAddTrade={() => navigate(`/app/trades/new?date=${selected}`, { state: backState })}
          onAddImage={() => navigate(`/app/trades/from-image?date=${selected}`, { state: backState })}
        />
      )}
    </div>
  )
}

/** Side peek (slides in from the page's leading edge) with the day's trades. */
function DayPanel({
  dateKey,
  trades,
  onClose,
  onOpenTrade,
  onAddTrade,
  onAddImage,
}: {
  dateKey: string
  trades: Trade[]
  onClose: () => void
  onOpenTrade: (id: string) => void
  onAddTrade: () => void
  onAddImage: () => void
}) {
  const sorted = [...trades].sort((a, b) => a.date.localeCompare(b.date))
  const net = trades.reduce((s, t) => s + t.return_amount, 0)
  const [y, m, d] = dateKey.split('-').map(Number)
  const weekday = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'][new Date(y, m - 1, d).getDay()]
  const heading = `${d} ב${MONTHS_HE[m - 1]} ${y}`

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-label={heading}>
      <div onClick={onClose} className="absolute inset-0 animate-[fade-up_.2s_ease_both] bg-black/25" />
      <div className="absolute inset-y-0 left-0 flex w-full max-w-md animate-[peek_.35s_var(--ease-out-expo)_both] flex-col border-r border-border bg-bg shadow-[12px_0_40px_-12px_rgba(15,15,15,.25)]">
        <div className="flex items-start justify-between border-b border-border px-5 py-4">
          <div>
            <div className="text-[13px] text-muted">יום {weekday}</div>
            <h2 className="text-xl">{heading}</h2>
            {trades.length > 0 && (
              <div className="mt-1 flex items-center gap-2 text-sm">
                <span className={`tag num !font-semibold ${net > 0 ? 'tag-green' : net < 0 ? 'tag-red' : ''}`}>{formatMoney(net)}</span>
                <span className="text-muted">{trades.length === 1 ? 'עסקה אחת' : `${trades.length} עסקאות`}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} aria-label="סגור" className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {sorted.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">אין עסקאות ביום זה.</p>
          ) : (
            <div className="flex flex-col">
              {sorted.map((t, i) => {
                const tone = t.return_amount > 0 ? 'text-win' : t.return_amount < 0 ? 'text-loss' : 'text-muted'
                return (
                  <button
                    key={t.id}
                    onClick={() => onOpenTrade(t.id)}
                    className="flex w-full items-center gap-3 rounded-md px-2 py-3 text-right transition-colors hover:bg-surface"
                    style={{ animation: `fade-up .35s var(--ease-out-expo) ${100 + i * 50}ms both` }}
                  >
                    <span className="num w-11 text-[13px] text-muted">{t.date.slice(11, 16)}</span>
                    <span className="font-semibold">{cleanSymbol(t.symbol)}</span>
                    <span className={`tag ${t.side === 'LONG' ? 'tag-blue' : 'tag-purple'}`}>{t.side === 'LONG' ? 'לונג' : 'שורט'}</span>
                    {t.lookback && <span className="tag num" dir="ltr">{t.lookback}</span>}
                    <span className="mr-auto text-left">
                      <span className={`num block font-bold ${tone}`}>{formatMoney(t.return_amount)}</span>
                      <span className="num block text-[11px] text-muted">{formatR(t.r_multiple)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 border-t border-border p-4">
          <button onClick={onAddTrade} className="btn-ghost !py-2">
            <Plus className="h-4 w-4" /> עסקה חדשה
          </button>
          <button onClick={onAddImage} className="btn-primary !py-2">
            <Sparkles className="h-4 w-4" /> מתמונה
          </button>
        </div>
      </div>
    </div>
  )
}
