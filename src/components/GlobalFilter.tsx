import { useMemo, useState, type ReactNode } from 'react'
import { SlidersHorizontal, Trophy, X } from 'lucide-react'
import type { Trade } from '../types'
import { FACETS, RANGE_FACETS, rangeStops } from '../lib/facets'
import { useGlobalFilter } from '../lib/globalFilter'
import { MIN_TRADES, bestFilters } from '../lib/bestFilters'
import { firstTradesOnly } from '../lib/firstTrade'
import { formatR } from '../lib/trades'
import { FirstTradeToggle } from './FirstTradeToggle'
import { RangeFilter } from './RangeFilter'

// The global filter's pieces (src/lib/globalFilter.ts), shared by the dashboard,
// trades, analytics and calendar pages so they look and behave the same.

/** "סינון" button with the active count; a "ראשונה בלבד" tag when the first-trade rule is on. */
export function GlobalFilterButton({ open, onToggle, extraCount = 0 }: { open: boolean; onToggle: () => void; extraCount?: number }) {
  const { activeCount, firstOnly } = useGlobalFilter()
  const count = activeCount + extraCount
  return (
    <>
      <button
        onClick={onToggle}
        aria-expanded={open}
        className={`flex h-9 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-sm transition-colors ${
          count > 0 ? 'border-accent/40 bg-accent/[0.07] font-semibold text-accent' : 'border-border hover:bg-surface'
        }`}
      >
        <SlidersHorizontal className="h-4 w-4" />
        <span className="hidden sm:inline">סינון</span>
        {count > 0 && <span className="num rounded bg-accent px-1.5 text-xs font-bold text-white">{count}</span>}
      </button>
      {firstOnly && (
        <button onClick={onToggle} className="tag tag-blue shrink-0 !py-0.5 !text-[12px] !font-semibold" title="רק עסקה ראשונה בכל הזדמנות">
          ראשונה בלבד
        </button>
      )}
    </>
  )
}

/** The filter menu. `children` = the page's own groups (e.g. symbol / year / month on the trades page). */
export function GlobalFilterPanel({ trades, children }: { trades: Trade[]; children?: ReactNode }) {
  const g = useGlobalFilter()
  const chip = (on: boolean) =>
    `tag cursor-pointer !px-2.5 !py-0.5 !text-[13px] transition-colors ${on ? '!bg-ink !text-white' : 'hover:!bg-[#d9d8d5]'}`
  return (
    <div className="grid gap-4 rounded-lg border border-border bg-surface/60 p-4 sm:grid-cols-2">
      <p className="text-[12px] text-muted sm:col-span-2">הסינון חל על כל העמודים: דשבורד, עסקאות, אנליטיקה ולוח שנה.</p>
      <FirstTradeToggle on={g.firstOnly} onChange={g.setFirstOnly} />
      <BestFilters trades={trades} />
      {children}
      {FACETS.map((f) => {
        const opts = f.options(trades)
        if (!opts.length) return null
        return (
          <div key={f.key}>
            <div className="mb-2 text-xs font-semibold text-muted">{f.label}</div>
            <div className="flex flex-wrap gap-1.5">
              {opts.map((o) => (
                <button key={o.v} onClick={() => g.toggleFacet(f.key, o.v)} aria-pressed={g.facetSel[f.key].has(o.v)} className={chip(g.facetSel[f.key].has(o.v))}>
                  {o.label}
                </button>
              ))}
            </div>
          </div>
        )
      })}
      {RANGE_FACETS.map((f) => (
        <RangeFilter key={f.key} label={f.label} sizes={rangeStops(trades, f)} value={g.ranges[f.key]} onChange={(r) => g.setRange(f.key, r)} />
      ))}
      {g.activeCount > 0 && (
        <div className="sm:col-span-2">
          <button onClick={g.clear} className="text-[13px] text-muted hover:text-loss">
            נקה סינון
          </button>
        </div>
      )}
    </div>
  )
}

/** The active global selections as removable chips — so a filtered page always says so. */
export function GlobalFilterChips({ trades }: { trades: Trade[] }) {
  const g = useGlobalFilter()
  const chips = [
    ...FACETS.flatMap((f) => {
      const opts = f.options(trades)
      return [...g.facetSel[f.key]].map((v) => ({
        id: `${f.key}:${v}`,
        label: `${f.label}: ${opts.find((o) => o.v === v)?.label ?? v}`,
        remove: () => g.toggleFacet(f.key, v),
      }))
    }),
    ...RANGE_FACETS.flatMap((f) => {
      const r = g.ranges[f.key]
      return r ? [{ id: f.key, label: `${f.label}: ${r[0]}–${r[1]} נק׳`, remove: () => g.setRange(f.key, null) }] : []
    }),
  ]
  if (!chips.length) return null
  return (
    <>
      {chips.map((c) => (
        <button key={c.id} onClick={c.remove} className="tag tag-blue group !py-0.5 !text-[13px]" aria-label={`הסר סינון ${c.label}`}>
          {c.label}
          <X className="h-3 w-3 opacity-60 group-hover:opacity-100" />
        </button>
      ))}
    </>
  )
}

/** Button + active chips + menu in one row — for pages without a filter bar of their own. */
export function GlobalFilterBar({ trades, className = '' }: { trades: Trade[]; className?: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className={className}>
      <div className="flex flex-wrap items-center gap-1.5">
        <GlobalFilterButton open={open} onToggle={() => setOpen((o) => !o)} />
        <GlobalFilterChips trades={trades} />
      </div>
      {open && (
        <div className="mt-3 animate-[fade-up_.3s_var(--ease-out-expo)_both]">
          <GlobalFilterPanel trades={trades} />
        </div>
      )}
    </div>
  )
}

/** "הכי מצליח": the 5 filters (one value or a pair) with the highest win rate; a click applies one. */
function BestFilters({ trades }: { trades: Trade[] }) {
  const g = useGlobalFilter()
  const [open, setOpen] = useState(false)
  // Searched on every trade (the first-trade rule still applies) — not on the current selection.
  const best = useMemo(() => (open ? bestFilters(g.firstOnly ? firstTradesOnly(trades) : trades) : []), [open, trades, g.firstOnly])
  return (
    <div className="sm:col-span-2">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm transition-colors ${
          open ? 'border-accent/40 bg-accent/[0.07] font-semibold text-accent' : 'border-border hover:bg-surface'
        }`}
      >
        <Trophy className="h-4 w-4" />
        הכי מצליח
      </button>
      {open && (
        <div className="mt-2 rounded-md border border-border bg-bg p-2">
          <p className="px-1 pb-1.5 text-[12px] text-muted">
            הסינונים (ערך אחד או צמד) עם אחוז ההצלחה הגבוה ביותר, מתוך קבוצות של {MIN_TRADES} עסקאות לפחות. לחיצה מפעילה את הסינון.
          </p>
          {best.length === 0 ? (
            <p className="px-1 py-2 text-sm text-muted">אין עדיין מספיק עסקאות: צריך לפחות {MIN_TRADES} באותה קבוצה.</p>
          ) : (
            <ol className="flex flex-col gap-1">
              {best.map((b, i) => (
                <li key={b.picks.map((p) => p.key + p.v).join('&')}>
                  <button
                    onClick={() => g.select(b.picks)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-right text-sm transition-colors hover:bg-surface"
                  >
                    <span className="num w-4 shrink-0 text-faint">{i + 1}</span>
                    <span className="min-w-0 flex-1 truncate">{b.picks.map((p) => p.label).join(' + ')}</span>
                    <span className={`num shrink-0 font-semibold ${b.winRate >= 0.5 ? 'text-win' : 'text-loss'}`}>{Math.round(b.winRate * 100)}%</span>
                    <span className="num shrink-0 text-[12px] text-muted">
                      {b.count} עסקאות{b.avgR != null ? ` · ${formatR(Math.round(b.avgR * 100) / 100)}` : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
        </div>
      )}
    </div>
  )
}
