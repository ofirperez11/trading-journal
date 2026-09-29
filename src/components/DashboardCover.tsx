import { useMemo, useState } from 'react'
import { Image as ImageIcon, X } from 'lucide-react'
import { useTrades } from '../lib/useTrades'
import { imageUrl } from '../lib/trades'

// Whoever closes the cover keeps it closed (this browser) until they bring it back.
const HIDDEN_KEY = 'tj_cover_hidden'
function readHidden(): boolean {
  try {
    return localStorage.getItem(HIDDEN_KEY) === '1'
  } catch {
    return false
  }
}

/**
 * Full-width page cover for the dashboard — the chart screenshot of the most
 * recent trade that has one. Falls back to a quiet neutral band. Can be closed;
 * while closed the image isn't loaded at all.
 */
export function DashboardCover() {
  const { trades } = useTrades()
  const [hidden, setHidden] = useState(readHidden)
  const src = useMemo(() => {
    const t = [...trades]
      .filter((x) => x.images && x.images.length > 0)
      .sort((a, b) => b.date.localeCompare(a.date))[0]
    return t ? imageUrl(t.images![0]) : null
  }, [trades])

  const toggle = (next: boolean) => {
    setHidden(next)
    try {
      if (next) localStorage.setItem(HIDDEN_KEY, '1')
      else localStorage.removeItem(HIDDEN_KEY)
    } catch {
      // storage blocked — the choice just lasts for this visit
    }
  }

  if (hidden) {
    return (
      <div className="flex justify-end px-5 pt-3 sm:px-10">
        <button
          onClick={() => toggle(false)}
          className="flex items-center gap-1.5 rounded-md px-2 py-1 text-[13px] text-muted transition-colors hover:bg-surface hover:text-ink"
        >
          <ImageIcon className="h-3.5 w-3.5" />
          הצג תמונת כותרת
        </button>
      </div>
    )
  }

  return (
    <div className="group relative h-[140px] overflow-hidden bg-[#e9e8e4] sm:h-[200px]">
      {src && (
        <img
          src={src}
          alt=""
          className="h-full w-full animate-[fade-up_0.8s_ease_both] object-cover"
          style={{ objectPosition: '50% 32%', filter: 'saturate(0.85)' }}
        />
      )}
      <button
        onClick={() => toggle(true)}
        aria-label="סגור תמונת כותרת"
        title="סגור תמונת כותרת"
        className="absolute left-3 top-3 flex items-center gap-1 rounded-md bg-bg/85 px-2 py-1 text-[13px] text-muted shadow-[0_0_0_1px_#e3e2e0] backdrop-blur-sm transition-colors hover:text-ink sm:opacity-0 sm:transition-opacity sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
      >
        <X className="h-3.5 w-3.5" />
        הסתר
      </button>
    </div>
  )
}
