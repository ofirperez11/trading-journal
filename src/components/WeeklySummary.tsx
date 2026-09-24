import { useMemo, useState } from 'react'
import { Download } from 'lucide-react'
import { useJournals } from '../lib/journals'
import { useTrades } from '../lib/useTrades'
import { monthlyWeekSummary, type WeekRow } from '../lib/analytics'
import { downloadCsv } from '../lib/csv'
import { formatPct } from '../lib/trades'
import { Columns, CHART } from './charts'

const NOTES_KEY = 'tj_week_notes'

const signCls = (v: number) => (v > 0 ? 'text-win' : v < 0 ? 'text-loss' : 'text-muted')
const signed = (v: number) => `${v > 0 ? '+' : ''}${v}`

function points(r: WeekRow, fam: string) {
  const p = r.points[fam]
  if (p === undefined) return <span className="text-[#d3d1cb]">—</span>
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

  // Export the selected year's weekly table to CSV.
  function exportCsv() {
    const headers = ['חודש', 'שבוע', 'תאריך', 'עסקאות', 'מצליחה', 'מפסידה', ...families.map((f) => `נק׳ ${f}`), 'הצלחה שבועי', 'R שבועי']
    const data = yearMonths.flatMap((m) =>
      m.weeks.map((r) => [
        m.label,
        `שבוע ${r.weekNo}`,
        r.dateRange,
        r.trades,
        r.trades ? r.winners : '',
        r.trades ? r.losers : '',
        ...families.map((f) => (r.trades && r.points[f] !== undefined ? r.points[f] : '')),
        r.trades ? `${Math.round(r.winRate * 100)}%` : '',
        r.trades ? r.rSum : '',
      ]),
    )
    downloadCsv(`${active.name}-summary-${activeYear}.csv`, headers, data)
  }

  if (loading) return null
  if (!activeYear || yearMonths.length === 0) {
    return <div className="callout">אין עדיין עסקאות להצגה ביומן הזה.</div>
  }

  // Year at a glance: monthly R, oldest → newest.
  const yearChart = [...yearMonths]
    .reverse()
    .map((m) => ({
      label: m.label.split(' ')[0].slice(0, 3),
      value: m.total.rSum,
      count: m.total.trades,
      winRate: m.total.winners + m.total.losers ? m.total.winRate : undefined,
    }))
  const yearR = yearMonths.reduce((s, m) => s + m.total.rSum, 0)
  const yearTrades = yearMonths.reduce((s, m) => s + m.total.trades, 0)

  const head = 'whitespace-nowrap px-3 py-2.5 text-center text-[12px] font-medium text-muted'
  const cell = 'whitespace-nowrap px-3 py-2.5 text-center text-sm'
  const monthAgg = 'whitespace-nowrap border-r border-border bg-surface px-3 py-2.5 text-center align-middle text-base font-bold'
  const Dash = () => <span className="text-[#d3d1cb]">—</span>

  return (
    <div>
      {/* Toolbar: year tabs + export */}
      <div className="flex flex-wrap items-center gap-1 border-b border-border">
        {years.map((y) => (
          <button
            key={y}
            onClick={() => setYear(y)}
            aria-pressed={activeYear === y}
            className={`num -mb-px h-9 border-b-2 px-3 text-sm font-medium transition-colors ${
              activeYear === y ? 'border-ink text-ink' : 'border-transparent text-muted hover:text-ink'
            }`}
          >
            {y}
          </button>
        ))}
        <button onClick={exportCsv} className="mr-auto mb-1 flex h-8 items-center gap-1.5 rounded-md px-2 text-sm text-muted hover:bg-surface hover:text-ink">
          <Download className="h-4 w-4" /> ייצוא
        </button>
      </div>

      {/* Year at a glance */}
      <div className="panel mt-4 p-5">
        <div className="mb-3 flex flex-wrap items-baseline gap-x-4 gap-y-1">
          <h2 className="text-[15px] font-semibold">R לפי חודש · {activeYear}</h2>
          <span className="text-sm text-muted">
            סה״כ <b className={`num ${signCls(yearR)}`}>{signed(Math.round(yearR * 10) / 10)}R</b> ב-<b className="num text-ink">{yearTrades}</b> עסקאות
          </span>
        </div>
        <Columns
          items={yearChart}
          format={(v) => `${v > 0 ? '+' : ''}${Math.round(v * 10) / 10}R`}
          height={120}
          colorOf={(b) => (b.value >= 0 ? CHART.win : CHART.loss)}
        />
      </div>

      <div className="mt-4 overflow-x-auto rounded-[10px] border border-border">
        <table className="w-full min-w-[900px] border-collapse">
          <thead>
            <tr className="border-b border-border">
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
              <th className={`${head} border-r border-border bg-surface`}>הצלחה חודשי</th>
              {families.map((f) => (
                <th key={`m-${f}`} className={`${head} bg-surface`}>
                  {f} חודשי
                </th>
              ))}
              <th className={`${head} bg-surface`}>R חודשי</th>
              <th className={`${head} text-right`}>הערות</th>
            </tr>
          </thead>
          <tbody>
            {yearMonths.map((m, mi) => {
              const t = m.total
              const monthName = m.label.split(' ')[0]
              return m.weeks.map((r, i) => (
                <tr
                  key={r.key}
                  className={`transition-colors hover:bg-[#fbfbfa] ${i === 0 ? 'border-t-2 border-border' : 'border-t border-[#f1f0ed]'} ${r.trades ? '' : 'text-faint'}`}
                  style={{ animation: `fade-up .4s var(--ease-out-expo) ${Math.min(mi, 6) * 60 + i * 20}ms both` }}
                >
                  {i === 0 && (
                    <td rowSpan={m.weeks.length} className="whitespace-nowrap border-l border-border px-4 text-center align-middle">
                      <div className="text-base font-bold text-ink">{monthName}</div>
                      <span className={`tag num mt-1 !font-semibold ${t.rSum > 0 ? 'tag-green' : t.rSum < 0 ? 'tag-red' : ''}`}>
                        {signed(t.rSum)}R
                      </span>
                    </td>
                  )}
                  <td className={`${cell} num text-[13px] text-muted`} dir="ltr">
                    {r.dateRange}
                  </td>
                  <td className={cell}>{`שבוע ${r.weekNo}`}</td>
                  <td className={`${cell} num`}>{r.trades || <Dash />}</td>
                  <td className={`${cell} num text-win`}>{r.trades ? r.winners : <Dash />}</td>
                  <td className={`${cell} num text-loss`}>{r.trades ? r.losers : <Dash />}</td>
                  {families.map((f) => (
                    <td key={`w-${f}`} className={`${cell} num`}>
                      {r.trades ? points(r, f) : <Dash />}
                    </td>
                  ))}
                  <td className={`${cell} num`}>{r.trades ? formatPct(r.winRate) : <Dash />}</td>
                  <td className={`${cell} num font-semibold ${signCls(r.rSum)}`}>{r.trades ? `${signed(r.rSum)}R` : <Dash />}</td>

                  {i === 0 && (
                    <>
                      <td className={`${monthAgg} num`} rowSpan={m.weeks.length}>
                        {formatPct(t.winRate)}
                      </td>
                      {families.map((f) => (
                        <td key={`m-${f}`} className={`${monthAgg} num`} rowSpan={m.weeks.length}>
                          {points(t, f)}
                        </td>
                      ))}
                      <td className={`${monthAgg} num ${signCls(t.rSum)}`} rowSpan={m.weeks.length}>
                        {signed(t.rSum)}R
                      </td>
                    </>
                  )}

                  <td className="px-2 py-1 text-right">
                    <input
                      value={notes[`${active.id}::${r.key}`] ?? ''}
                      onChange={(e) => setNote(r.key, e.target.value)}
                      placeholder="הערה…"
                      aria-label={`הערה לשבוע ${r.weekNo} ב${monthName}`}
                      className="w-full min-w-[10rem] rounded-md bg-transparent px-2 py-1.5 text-sm text-ink outline-none transition-colors placeholder:text-[#d3d1cb] hover:bg-surface focus:bg-surface"
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
