import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowRight, X } from 'lucide-react'
import { useTrade } from '../lib/useTrades'
import { formatMoney, imageUrl, formatR } from '../lib/trades'
import { SideIndicator } from '../components/SideIndicator'

export default function TradeDetail() {
  const { id } = useParams()
  const { trade, loading } = useTrade(id)
  const [lightbox, setLightbox] = useState<string | null>(null)

  // Close the lightbox on Escape.
  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setLightbox(null)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox])

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-muted">טוען…</div>
  }
  if (!trade) {
    return (
      <div className="card text-center">
        <p className="text-muted">העסקה לא נמצאה.</p>
        <Link to="/app/trades" className="mt-3 inline-block text-accent-2 hover:underline">חזרה לרשימה</Link>
      </div>
    )
  }

  const win = trade.return_amount > 0
  const exits = trade.exits ?? (trade.exit != null ? [trade.exit] : [])
  const isPartial = exits.length > 1

  const fields: { label: string; value: string }[] = [
    { label: 'כניסה', value: String(trade.entry) },
    ...(isPartial
      ? exits.map((e, i) => ({ label: `יציאה ${i + 1}`, value: String(e) }))
      : [{ label: 'יציאה', value: exits[0] != null ? String(exits[0]) : '—' }]),
    { label: 'כמות', value: String(trade.qty) },
    { label: 'יעד', value: trade.target != null ? String(trade.target) : '—' },
    { label: 'סטופ', value: trade.stoploss != null ? String(trade.stoploss) : '—' },
    { label: 'R-Multiple', value: formatR(trade.r_multiple) },
  ]

  return (
    <div className="space-y-5">
      <Link to="/app/trades" className="inline-flex items-center gap-1 text-sm text-muted hover:text-white">
        <ArrowRight className="h-4 w-4" /> חזרה לעסקאות
      </Link>

      {/* Header */}
      <div className="card">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold">{trade.symbol}</h1>
            <SideIndicator side={trade.side} animate />
            <span className={`text-sm font-medium ${trade.status === 'WIN' ? 'text-win' : trade.status === 'LOSS' ? 'text-loss' : 'text-muted'}`}>
              {trade.status}
            </span>
          </div>
          <div className="text-left">
            <div className={`text-3xl font-bold tabular-nums ${win ? 'text-win' : trade.return_amount < 0 ? 'text-loss' : 'text-muted'}`}>
              {formatMoney(trade.return_amount)}
            </div>
            <div className="text-sm text-muted">
              {new Date(trade.date).toLocaleString('he-IL', { dateStyle: 'long', timeStyle: 'short' })}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {fields.map((f) => (
            <div key={f.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="stat-label">{f.label}</div>
              <div className="mt-1 text-lg font-bold tabular-nums">{f.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Notes */}
      {trade.notes && (
        <div className="card">
          <h2 className="mb-2 font-semibold">הערות</h2>
          <p className="whitespace-pre-wrap text-muted">{trade.notes}</p>
        </div>
      )}

      {/* Executions */}
      {trade.executions && trade.executions.length > 0 && (
        <div className="card">
          <h2 className="mb-3 font-semibold">Executions</h2>
          <div className="space-y-1 text-sm">
            {trade.executions.map((e, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-white/[0.03]">
                <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${e.action === 'BUY' ? 'bg-win/10 text-win' : 'bg-loss/10 text-loss'}`}>
                  {e.action}
                </span>
                <div className="flex items-center gap-4 text-muted">
                  <span className="tabular-nums">qty {String(e.qty)}</span>
                  <span className="tabular-nums text-white">@ {String(e.price)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Images */}
      {trade.images && trade.images.length > 0 && (
        <div className="card">
          <h2 className="mb-3 font-semibold">צילומי מסך</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {trade.images.map((img) => (
              <button
                key={img}
                type="button"
                onClick={() => setLightbox(imageUrl(img))}
                className="group block cursor-zoom-in overflow-hidden rounded-2xl border border-white/[0.06] bg-black/20"
              >
                <img
                  src={imageUrl(img)}
                  alt="trade screenshot"
                  className="max-h-[460px] w-full object-contain transition-transform duration-300 group-hover:scale-[1.02]"
                  loading="lazy"
                />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lightbox popup */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex animate-zoom-in items-center justify-center bg-black/85 p-4 backdrop-blur-sm sm:p-8"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="סגור"
          >
            <X className="h-5 w-5" />
          </button>
          <img
            src={lightbox}
            alt="trade screenshot"
            className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
