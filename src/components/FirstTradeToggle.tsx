// On/off switch for the "first trade per opportunity" rule (src/lib/firstTrade.ts).
export function FirstTradeToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label
      className={`flex cursor-pointer items-start gap-2.5 rounded-md border p-3 transition-colors sm:col-span-2 ${
        on ? 'border-accent/40 bg-accent/[0.07]' : 'border-border hover:bg-surface'
      }`}
    >
      <input type="checkbox" className="mt-0.5 h-4 w-4 shrink-0 accent-[#2383e2]" checked={on} onChange={(e) => onChange(e.target.checked)} />
      <span>
        <span className={`block text-sm font-semibold ${on ? 'text-accent' : ''}`}>רק עסקה ראשונה בכל הזדמנות</span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-muted">
          ב-16:30 וב-17:00 נספרת רק העסקה שמולאה ראשונה (NQ או ES; באותה דקה — NQ). הצלחה ב-16:30 מסיימת את היום. נשאר דלוק עד
          שמכבים.
        </span>
      </span>
    </label>
  )
}
