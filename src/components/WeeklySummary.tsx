import { useMemo, useState } from 'react'
import { useJournals } from '../lib/journals'
import { useTrades } from '../lib/useTrades'
import { monthlyWeekSummary, type WeekRow } from '../lib/analytics'
import { formatPct } from '../lib/trades'

const NOTES_KEY = 'tj_week_notes'

const signCls = (v: number) => (v > 0 ? 'text-win' : v < 0 ? 'text-loss' : 'text-muted')
const signed = (v: number) => `${v > 0 ? '+' : ''}${v}`

function points(r: WeekRow, fam: string) {
  const p = r.points[fam]
  if (p === undefined) return <span className="text-muted/40">—</span>
  return <span className={signCls(p)}>{signed(p)}</span>
}

export function WeeklySummary() {
  const { active } = useJournals()
  const { trades, loading } = useTrades()
  const { families, months } = useMemo(() => monthlyWeekSummary(trades), [trades])
  const years = useMemo(
    () => [...new Set(months.map((m) => m.month.slice(0, 4)))].sort().reverse(),
    [months],
  )
  const [year, setYear] = useState<string | null>(null)
  const [notes, setNotes] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem(NOTES_KEY) || '{}') as Record<string, string>
    } catch {
      return {}
    }
  })

  const activeYear = year && years.includes(year) ? year : years[0]
  // All months of the selected year, latest first (December at the top → January).
  const yearMonths = months
    .filter((m) => m.month.startsWith(activeYear ?? ''))
    .sort((a, b) => b.month.localeCompare(a.month))

  function setNote(weekKey: string, value: string) {
    const k = `${active.id}::${weekKey}`
    const next = { ...notes, [k]: value }
    setNotes(next)
    localStorage.setItem(NOTES_KEY, JSON.stringify(next))
  }

  if (loading) return null
  if (!activeYear || yearMonths.length === 0) {
    return <div className="card py-12 text-center text-sm text-muted">אין עדיין עסקאות להצגה ביומן הזה.</div>
  }

  const head = 'whitespace-nowrap px-4 py-3 text-center font-mono text-[11px] font-semibold uppercase tracking-wider'
  const cell = 'whitespace-nowrap px-4 py-3.5 text-center text-[15px]'
  const monthAgg = 'whitespace-nowrap border-r border-white/[0.06] bg-white/[0.03] px-4 py-3.5 text-center align-middle font-bold'

  return (
    <div className="card">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <span className="font-mono text-sm font-semibold uppercase tracking-wider text-muted">
          שנת {activeYear}
        </span>
        <select
          value={activeYear}
          onChange={(e) => setYear(e.target.value)}
          className="input w-auto py-1.5 text-sm"
        >
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="border-b border-white/[0.06] text-muted">
              <th className={head}>חודש</th>
              <th className={`${head} text-right`}>תאריך</th>
              <th className={head}>שבוע</th>
              <th className={head}>עסקאות</th>
              <th className={head}>מצליחה</th>
              <th className={head}>מפסידה</th>
              {families.map((f) => (
                <th key={`w-${f}`} className={head}>
                  נק׳ {f}
                </th>
              ))}
              <th className={head}>הצלחה שבועי</th>
              <th className={head}>R שבועי</th>
              <th className={`${head} border-r border-white/[0.06] bg-white/[0.03]`}>הצלחה חודשי</th>
              {families.map((f) => (
                <th key={`m-${f}`} className={`${head} bg-white/[0.03]`}>
                  {f} חודשי
                </th>
              ))}
              <th className={`${head} bg-white/[0.03]`}>R חודשי</th>
              <th className={`${head} text-right`}>הערות</th>
            </tr>
          </thead>
          <tbody>
            {yearMonths.map((m) => {
              const t = m.total
              const monthName = m.label.split(' ')[0]
              return m.weeks.map((r, i) => (
                <tr
                  key={r.key}
                  className={
                    i === 0
                      ? 'border-t-2 border-white/[0.09] hover:bg-white/[0.02]'
                      : 'border-t border-white/[0.03] hover:bg-white/[0.02]'
                  }
                >
                  {i === 0 && (
                    <td
                      rowSpan={m.weeks.length}
                      className="whitespace-nowrap border-l border-white/[0.06] bg-white/[0.02] px-4 text-center align-middle text-lg font-bold"
                    >
                      {monthName}
                    </td>
                  )}
                  <td className={`${cell} font-mono text-xs text-muted`} dir="ltr">{r.dateRange}</td>
                  <td className={`${cell} font-medium`}>{`שבוע ${r.weekNo}`}</td>
                  <td className={`${cell} num`}>{r.trades}</td>
                  <td className={`${cell} num text-win`}>{r.winners}</td>
                  <td className={`${cell} num text-loss`}>{r.losers}</td>
                  {families.map((f) => (
                    <td key={`w-${f}`} className={`${cell} num`}>
                      {points(r, f)}
                    </td>
                  ))}
                  <td className={`${cell} num`}>{formatPct(r.winRate)}</td>
                  <td className={`${cell} num ${signCls(r.rSum)}`}>{signed(r.rSum)}R</td>

                  {i === 0 && (
                    <>
                      <td className={`${monthAgg} num text-lg`} rowSpan={m.weeks.length}>
                        {formatPct(t.winRate)}
                      </td>
                      {families.map((f) => (
                        <td key={`m-${f}`} className={`${monthAgg} num text-lg`} rowSpan={m.weeks.length}>
                          {points(t, f)}
                        </td>
                      ))}
                      <td className={`${monthAgg} num text-lg ${signCls(t.rSum)}`} rowSpan={m.weeks.length}>
                        {signed(t.rSum)}R
                      </td>
                    </>
                  )}

                  <td className="px-4 py-2 text-right">
                    <input
                      value={notes[`${active.id}::${r.key}`] ?? ''}
                      onChange={(e) => setNote(r.key, e.target.value)}
                      placeholder="הערה…"
                      className="w-full min-w-[10rem] rounded-md bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted/40 focus:bg-white/[0.04]"
                    />
                  </td>
                </tr>
              ))
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
