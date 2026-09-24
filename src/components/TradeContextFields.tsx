import type { Liquidity, Zone } from '../types'

// ICT context selectors shared by the manual and image trade forms:
//  - which side's liquidity was taken (buyside / sellside)
//  - dealing-range position at entry (premium / deadzone / discount)

const LIQUIDITY: { v: Liquidity; label: string; tone: 'accent' | 'muted' }[] = [
  { v: 'buyside', label: 'Buyside', tone: 'accent' },
  { v: 'sellside', label: 'Sellside', tone: 'accent' },
  { v: 'none', label: 'לא נלקחה', tone: 'muted' },
]
const ZONES: { v: Zone; label: string; tone: 'loss' | 'muted' | 'win' }[] = [
  { v: 'premium', label: 'Premium', tone: 'loss' },
  { v: 'deadzone', label: 'Deadzone', tone: 'muted' },
  { v: 'discount', label: 'Discount', tone: 'win' },
]

const BTN = 'h-10 flex-1 rounded-md border text-sm font-medium transition-all active:scale-[0.98]'
const OFF = 'border-border text-[#5f5e5b] hover:bg-surface'
const ON: Record<'accent' | 'win' | 'loss' | 'muted', string> = {
  accent: 'border-transparent bg-tag-blue font-semibold text-tag-blue-fg',
  win: 'border-transparent bg-tag-green font-semibold text-tag-green-fg',
  loss: 'border-transparent bg-tag-red font-semibold text-tag-red-fg',
  muted: 'border-transparent bg-tag-gray font-semibold text-tag-gray-fg',
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
                aria-pressed={on}
                onClick={() => onLiquidity(on ? null : o.v)}
                className={`${BTN} ${on ? ON[o.tone] : OFF}`}
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
                aria-pressed={on}
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
