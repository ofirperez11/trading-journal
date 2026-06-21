import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search } from 'lucide-react'
import { useTrades } from '../lib/useTrades'
import { formatMoney, formatR } from '../lib/trades'
import { SideIndicator } from '../components/SideIndicator'
import type { TradeStatus } from '../types'

type Filter = 'ALL' | TradeStatus

const filters: { key: Filter; label: string }[] = [
  { key: 'ALL', label: 'הכל' },
  { key: 'WIN', label: 'רווח' },
  { key: 'LOSS', label: 'הפסד' },
  { key: 'WASH', label: 'Wash' },
]

export default function Trades() {
  const { trades, loading } = useTrades()
  const [filter, setFilter] = useState<Filter>('ALL')
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    return trades.filter((t) => {
      if (filter !== 'ALL' && t.status !== filter) return false
      if (query && !t.symbol.toLowerCase().includes(query.toLowerCase())) return false
      return true
    })
  }, [trades, filter, query])

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-muted">טוען עסקאות…</div>
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">עסקאות</h1>
        <p className="text-muted">{rows.length} מתוך {trades.length} עסקאות</p>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-xl border border-white/[0.06] bg-white/[0.02] p-1">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                filter === f.key ? 'bg-white/[0.08] text-white' : 'text-muted hover:text-white'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
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

      {/* Table */}
      <div className="panel overflow-hidden">
        <div className="grid grid-cols-[1fr_auto] gap-2 border-b border-white/[0.06] px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted sm:grid-cols-[100px_1fr_70px_70px_80px_80px_80px_60px_100px]">
          <span>תאריך</span>
          <span className="hidden sm:block">סימבול</span>
          <span className="hidden sm:block">כיוון</span>
          <span className="hidden sm:block">סטטוס</span>
          <span className="hidden text-left sm:block">כניסה</span>
          <span className="hidden text-left sm:block">יציאה</span>
          <span className="hidden text-left sm:block">יציאה 2</span>
          <span className="hidden text-left sm:block">R</span>
          <span className="text-left">P&amp;L</span>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {rows.map((t) => {
            const win = t.return_amount > 0
            return (
              <Link
                key={t.id}
                to={`/app/trades/${t.id}`}
                className="group grid grid-cols-[1fr_auto] items-center gap-2 px-4 py-3 text-sm transition-colors hover:bg-white/[0.03] sm:grid-cols-[100px_1fr_70px_70px_80px_80px_80px_60px_100px]"
              >
                <span className="text-muted">
                  {new Date(t.date).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' })}
                </span>
                <span className="hidden font-medium sm:block">{t.symbol}</span>
                <span className="hidden sm:block">
                  <SideIndicator side={t.side} />
                </span>
                <span className={`hidden text-xs font-medium sm:block ${t.status === 'WIN' ? 'text-win' : t.status === 'LOSS' ? 'text-loss' : 'text-muted'}`}>
                  {t.status}
                </span>
                <span className="hidden text-left tabular-nums text-muted sm:block">{t.entry}</span>
                <span className="hidden text-left tabular-nums text-muted sm:block">{t.exits?.[0] ?? '—'}</span>
                <span className="hidden text-left tabular-nums sm:block">
                  {t.exits && t.exits.length > 1 ? (
                    <span className="text-accent-2">{t.exits[1]}</span>
                  ) : (
                    <span className="text-muted/40">—</span>
                  )}
                </span>
                <span className="hidden text-left tabular-nums sm:block">
                  {t.r_multiple != null ? formatR(t.r_multiple).replace('R', '') : '—'}
                </span>
                <span className={`text-left font-semibold tabular-nums ${win ? 'text-win' : t.return_amount < 0 ? 'text-loss' : 'text-muted'}`}>
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
  )
}
