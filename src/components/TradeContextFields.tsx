import type { Liquidity, Zone } from '../types'

// ICT context selectors shared by the manual and image trade forms:
//  - which side's liquidity was taken (buyside / sellside)
//  - dealing-range position at entry (premium / deadzone / discount)

const LIQUIDITY: { v: Liquidity; label: string }[] = [
  { v: 'buyside', label: 'Buyside' },
  { v: 'sellside', label: 'Sellside' },
]
const ZONES: { v: Zone; label: string; tone: 'loss' | 'muted' | 'win' }[] = [
  { v: 'premium', label: 'Premium', tone: 'loss' },
  { v: 'deadzone', label: 'Deadzone', tone: 'muted' },
  { v: 'discount', label: 'Discount', tone: 'win' },
]

const BTN = 'flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors'
const OFF = 'border-black/[0.12] text-muted hover:text-ink'
const ON: Record<'accent' | 'win' | 'loss' | 'muted', string> = {
  accent: 'border-accent/50 bg-accent/15 text-accent',
  win: 'border-win/50 bg-win/15 text-win',
  loss: 'border-loss/50 bg-loss/15 text-loss',
  muted: 'border-ink/30 bg-black/[0.06] text-ink',
}

export function TradeContextFields({
  liquidity,
  zone,
  onLiquidity,
  onZone,
}: {
  liquidity: Liquidity | null
  zone: Zone | null
  onLiquidity: (v: Liquidity | null) => void
  onZone: (v: Zone | null) => void
}) {
  return (
    <>
      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="field-label mb-0">נזילות שנלקחה</span>
        <div className="flex gap-2">
          {LIQUIDITY.map((o) => {
            const on = liquidity === o.v
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => onLiquidity(on ? null : o.v)}
                className={`${BTN} ${on ? ON.accent : OFF}`}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex flex-col gap-1.5 sm:col-span-2">
        <span className="field-label mb-0">אזור (Dealing Range)</span>
        <div className="flex gap-2">
          {ZONES.map((o) => {
            const on = zone === o.v
            return (
              <button
                key={o.v}
                type="button"
                onClick={() => onZone(on ? null : o.v)}
                className={`${BTN} ${on ? ON[o.tone] : OFF}`}
              >
                {o.label}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
