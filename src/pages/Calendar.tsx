import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Plus, X, Sparkles } from 'lucide-react'
import { useTrades } from '../lib/useTrades'
import { formatMoney, cleanSymbol } from '../lib/trades'
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

const cellTint: Record<Exclude<Outcome, null>, string> = {
  win: 'border-win/30 bg-win/[0.09] hover:bg-win/[0.14]',
  loss: 'border-loss/30 bg-loss/[0.09] hover:bg-loss/[0.14]',
  wash: 'border-accent/30 bg-accent/[0.09] hover:bg-accent/[0.14]',
}
const netText: Record<Exclude<Outcome, null>, string> = {
  win: 'text-win',
  loss: 'text-loss',
  wash: 'text-accent',
}

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

  function shift(delta: number) {
    let m = month + delta
    let y = year
    if (m < 0) { m = 11; y -= 1 }
    if (m > 11) { m = 0; y += 1 }
    goToMonth(y, m)
  }

  const todayKey = ymd(new Date())

  if (loading) return <div className="flex h-64 items-center justify-center text-muted">טוען…</div>

  return (
    <div>
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-2xl font-bold">לוח שנה</h1>
      </div>

      {/* Calendar is an LTR island: Sun→Sat left-to-right, weekly summary on the right — like the reference. */}
      <div dir="ltr" className="select-none">
        {/* Month controls */}
        <div className="mb-4 flex items-center justify-center gap-3">
          <button
            onClick={() => shift(-1)}
            aria-label="חודש קודם"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.12] bg-black/[0.03] text-ink transition-colors hover:bg-black/[0.06]"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="flex gap-2">
            <select
              value={month}
              onChange={(e) => goToMonth(year, Number(e.target.value))}
              className="input w-auto py-1.5 text-sm"
            >
              {MONTHS_HE.map((m, i) => (
                <option key={m} value={i}>{m}</option>
              ))}
            </select>
            <select
              value={year}
              onChange={(e) => goToMonth(Number(e.target.value), month)}
              className="input w-auto py-1.5 text-sm"
            >
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button
            onClick={() => shift(1)}
            aria-label="חודש הבא"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-black/[0.12] bg-black/[0.03] text-ink transition-colors hover:bg-black/[0.06]"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        {/* Weekday header */}
        <div className="mb-2 flex gap-2">
          {WEEKDAYS.map((d) => (
            <div key={d} className="flex-1 text-center font-mono text-xs font-semibold uppercase tracking-wider text-muted">
              {d}
            </div>
          ))}
          <div className="w-36 shrink-0 text-center font-mono text-xs font-semibold uppercase tracking-wider text-muted">
            סיכום שבועי
          </div>
        </div>

        {/* Weeks */}
        <div className="flex flex-col gap-2">
          {weeks.map((week, wi) => {
            const wk = week.reduce(
              (acc, d) => {
                const a = byDay.get(ymd(d))
                if (a) { acc.net += a.net; acc.count += a.count; acc.wins += a.wins; acc.losses += a.losses; acc.rSum += a.rSum }
                return acc
              },
              { net: 0, count: 0, wins: 0, losses: 0, rSum: 0 },
            )
            return (
              <div key={wi} className="flex gap-2">
                {week.map((d) => {
                  const key = ymd(d)
                  const a = byDay.get(key)
                  const oc = outcomeOf(a?.net ?? 0, a?.count ?? 0)
                  const inMonth = d.getMonth() === month
                  const isToday = key === todayKey
                  return (
                    <button
                      key={key}
                      onClick={() => setSelected(key)}
                      className={`flex h-28 flex-1 flex-col rounded-xl border p-2 text-left transition-colors ${
                        oc ? cellTint[oc] : 'border-black/[0.08] bg-surface/40 hover:bg-black/[0.03]'
                      } ${isToday ? 'ring-1 ring-accent/60' : ''}`}
                    >
                      <span className={`text-sm font-medium ${inMonth ? 'text-ink' : 'text-muted/40'}`}>
                        {d.getDate()}
                      </span>
                      {a && (
                        <span className="mt-auto flex flex-col items-center gap-0.5 pb-1 text-center">
                          <span className={`num text-sm font-bold ${oc ? netText[oc] : ''}`}>
                            {formatMoney(a.net)}
                          </span>
                          <span className="text-[11px] text-muted">
                            {a.count === 1 ? 'עסקה' : `${a.count} עסקאות`}
                          </span>
                        </span>
                      )}
                    </button>
                  )
                })}
                {/* Weekly summary */}
                <div className="flex w-36 shrink-0 flex-col justify-center rounded-xl px-2 text-center">
                  {wk.count > 0 && (
                    <>
                      <span className={`num text-base font-bold ${wk.net > 0 ? 'text-win' : wk.net < 0 ? 'text-loss' : 'text-accent'}`}>
                        {formatMoney(wk.net)}
                      </span>
                      <span className={`num mt-0.5 text-xs font-semibold ${wk.rSum > 0 ? 'text-win' : wk.rSum < 0 ? 'text-loss' : 'text-muted'}`}>
                        {wk.rSum > 0 ? '+' : ''}{Math.round(wk.rSum * 10) / 10}R
                      </span>
                      <span className="mt-1 flex items-center justify-center gap-1.5 text-[11px]">
                        <span className="rounded bg-win/15 px-1.5 py-0.5 font-semibold text-win num">{wk.wins}</span>
                        <span className="rounded bg-loss/15 px-1.5 py-0.5 font-semibold text-loss num">{wk.losses}</span>
                      </span>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selected && (
        <DayPanel
          dateKey={selected}
          trades={trades.filter((t) => t.date.slice(0, 10) === selected)}
          onClose={() => setSelected(null)}
          onOpenTrade={(id) =>
            navigate(`/app/trades/${id}`, {
              state: { backTo: `/app/calendar?y=${year}&m=${month}`, backLabel: 'חזרה ליומן' },
            })
          }
          onAddTrade={() =>
            navigate(`/app/trades/new?date=${selected}`, {
              state: { backTo: `/app/calendar?y=${year}&m=${month}`, backLabel: 'חזרה ליומן' },
            })
          }
          onAddImage={() =>
            navigate(`/app/trades/from-image?date=${selected}`, {
              state: { backTo: `/app/calendar?y=${year}&m=${month}`, backLabel: 'חזרה ליומן' },
            })
          }
        />
      )}
    </div>
  )
}

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
  const heading = `${d} ${MONTHS_HE[m - 1]} ${y}`

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-black/[0.08] bg-surface p-5 shadow-2xl"
      >
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold">{heading}</h2>
            {trades.length > 0 && (
              <span className={`num text-sm font-semibold ${net > 0 ? 'text-win' : net < 0 ? 'text-loss' : 'text-accent'}`}>
                {formatMoney(net)} · {trades.length === 1 ? 'עסקה אחת' : `${trades.length} עסקאות`}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="סגור"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-black/[0.05] hover:text-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {sorted.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">אין עסקאות ביום זה.</p>
        ) : (
          <div className="space-y-2">
            {sorted.map((t) => {
              const isWin = t.return_amount > 0
              const isLoss = t.return_amount < 0
              return (
                <button
                  key={t.id}
                  onClick={() => onOpenTrade(t.id)}
                  className="flex w-full items-center gap-3 rounded-xl border border-black/[0.08] bg-black/[0.02] px-3 py-2.5 text-right transition-colors hover:bg-black/[0.04]"
                >
                  <span className="num text-xs text-muted" dir="ltr">{t.date.slice(11, 16)}</span>
                  <span className="font-mono text-sm font-semibold">{cleanSymbol(t.symbol)}</span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                      t.side === 'LONG' ? 'bg-win/15 text-win' : 'bg-loss/15 text-loss'
                    }`}
                  >
                    {t.side === 'LONG' ? 'Long' : 'Short'}
                  </span>
                  <span className={`num mr-auto font-bold ${isWin ? 'text-win' : isLoss ? 'text-loss' : 'text-muted'}`}>
                    {formatMoney(t.return_amount)}
                  </span>
                </button>
              )
            })}
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            onClick={onAddTrade}
            className="flex items-center justify-center gap-2 rounded-xl border border-black/[0.12] bg-black/[0.03] py-2.5 text-sm font-semibold text-ink transition-colors hover:bg-black/[0.06]"
          >
            <Plus className="h-4 w-4" /> עסקה חדשה
          </button>
          <button
            onClick={onAddImage}
            className="flex items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/15 py-2.5 text-sm font-semibold text-accent transition-colors hover:bg-accent/25"
          >
            <Sparkles className="h-4 w-4" /> מתמונה
          </button>
        </div>
      </div>
    </div>
  )
}
