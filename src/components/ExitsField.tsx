import { Plus, X } from 'lucide-react'
import type { ExitRow } from '../lib/partials'

/**
 * Editor for one or more partial exits — each row is an exit price + the number
 * of contracts closed at it. "+" adds a row; rows past the first can be removed.
 */
export function ExitsField({ value, onChange }: { value: ExitRow[]; onChange: (rows: ExitRow[]) => void }) {
  const update = (i: number, key: keyof ExitRow, v: string) =>
    onChange(value.map((r, idx) => (idx === i ? { ...r, [key]: v } : r)))
  const add = () => onChange([...value, { price: '', qty: '' }])
  const remove = (i: number) => onChange(value.length > 1 ? value.filter((_, idx) => idx !== i) : value)
  const multi = value.length > 1

  return (
    <div className="sm:col-span-2">
      <span className="field-label mb-0">יציאות</span>
      <div className="mt-1.5 space-y-2">
        {value.map((r, i) => (
          <div key={i} className="flex animate-[fade-up_.3s_var(--ease-out-expo)_both] items-end gap-2">
            <label className="flex-1">
              <span className="text-[12px] text-muted">{multi ? `יציאה ${i + 1} · מחיר` : 'מחיר יציאה'}</span>
              <input
                type="number"
                step="any"
                dir="ltr"
                className="input mt-1"
                value={r.price}
                onChange={(e) => update(i, 'price', e.target.value)}
              />
            </label>
            <label className="w-28">
              <span className="text-[12px] text-muted">חוזים</span>
              <input
                type="number"
                step="any"
                dir="ltr"
                className="input mt-1"
                value={r.qty}
                onChange={(e) => update(i, 'qty', e.target.value)}
              />
            </label>
            <button
              type="button"
              onClick={() => remove(i)}
              aria-label="הסר יציאה"
              disabled={!multi}
              className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-tag-red hover:text-loss disabled:invisible"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={add}
        className="mt-2 inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm font-medium text-accent transition-colors hover:bg-accent/[0.07]"
      >
        <Plus className="h-4 w-4" /> הוסף יציאה (Partial)
      </button>
    </div>
  )
}
