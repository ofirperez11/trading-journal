import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import { ArrowRight, X, Pencil, Trash2, Copy, BookMarked, Check } from 'lucide-react'
import { useTrade, useTradeActions } from '../lib/useTrades'
import { useJournals } from '../lib/journals'
import { formatMoney, imageUrl, formatR, formatTradeDateTime } from '../lib/trades'
import { SideIndicator } from '../components/SideIndicator'
import { BIAS_LABEL } from '../lib/bias'
import type { Account, Zone, Liquidity } from '../types'

const ZONE_LABEL: Record<Zone, string> = { premium: 'Premium', deadzone: 'Deadzone', discount: 'Discount' }
const LIQ_LABEL: Record<Liquidity, string> = { buyside: 'Buyside', sellside: 'Sellside', none: 'לא נלקחה' }

export default function TradeDetail() {
  const { id } = useParams()
  const { trade, loading } = useTrade(id)
  const { deleteTrade, addTrade } = useTradeActions()
  const { journals } = useJournals()
  const navigate = useNavigate()
  const location = useLocation()
  // Where "back" goes: the caller (e.g. the calendar) can pass a return target
  // in navigation state; otherwise default to the trades list.
  const backState = location.state as { backTo?: string; backLabel?: string } | null
  const backTo = backState?.backTo ?? '/app/trades'
  const backLabel = backState?.backLabel ?? 'חזרה לעסקאות'
  const [lightbox, setLightbox] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [dupOpen, setDupOpen] = useState(false)
  const [dupDone, setDupDone] = useState<string | null>(null)

  // Auto-clear the "duplicated" confirmation after a moment.
  useEffect(() => {
    if (!dupDone) return
    const t = setTimeout(() => setDupDone(null), 2500)
    return () => clearTimeout(t)
  }, [dupDone])

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

  // Every journal the user can access (their own + shared), except the one this
  // trade already lives in — so a trade can be copied between any of them.
  const otherJournals = journals.filter((jr) => jr.id !== trade.account_id)
  function duplicateTo(jr: Account) {
    // The copy belongs to the target journal's owner (so a shared journal's owner
    // still sees it); editor RLS lets a shared editor insert it.
    addTrade({ ...trade!, id: crypto.randomUUID(), account_id: jr.id, user_id: jr.user_id })
    setDupOpen(false)
    setDupDone(jr.name)
  }

  const fields: { label: string; value: string }[] = [
    { label: 'כניסה', value: String(trade.entry) },
    ...(isPartial
      ? exits.map((e, i) => ({ label: `יציאה ${i + 1}`, value: String(e) }))
      : [{ label: 'יציאה', value: exits[0] != null ? String(exits[0]) : '—' }]),
    { label: 'כמות', value: String(trade.qty) },
    { label: 'יעד', value: trade.target != null ? String(trade.target) : '—' },
    { label: 'סטופ', value: trade.stoploss != null ? String(trade.stoploss) : '—' },
    ...(trade.lookback ? [{ label: 'Lookback', value: trade.lookback }] : []),
    ...(trade.liquidity ? [{ label: 'נזילות', value: LIQ_LABEL[trade.liquidity] }] : []),
    ...(trade.zone ? [{ label: 'אזור', value: ZONE_LABEL[trade.zone] }] : []),
    ...(trade.bias ? [{ label: 'ביאס', value: BIAS_LABEL[trade.bias] }] : []),
    { label: 'R-Multiple', value: formatR(trade.r_multiple) },
  ]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link to={backTo} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
          <ArrowRight className="h-4 w-4" /> {backLabel}
        </Link>
        {confirming ? (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted">למחוק את העסקה?</span>
            <button
              onClick={() => {
                deleteTrade(trade.id)
                navigate(backTo)
              }}
              className="rounded-lg bg-loss/20 px-3 py-1.5 text-xs font-semibold text-loss hover:bg-loss/30"
            >
              מחק
            </button>
            <button onClick={() => setConfirming(false)} className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-ink">
              ביטול
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {dupDone ? (
              <span className="flex items-center gap-1 text-sm font-medium text-win">
                <Check className="h-4 w-4" /> שוכפלה ל{dupDone}
              </span>
            ) : (
              <>
                {otherJournals.length > 0 && (
                  <div className="relative">
                    <button onClick={() => setDupOpen((o) => !o)} className="btn-ghost px-3 py-2 text-sm">
                      <Copy className="h-4 w-4" /> שכפל
                    </button>
                    {dupOpen && (
                      <>
                        <div className="fixed inset-0 z-20" onClick={() => setDupOpen(false)} />
                        <div className="panel absolute left-0 z-30 mt-2 w-56 origin-top animate-zoom-in overflow-hidden p-1 text-right">
                          <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
                            שכפל ליומן
                          </div>
                          {otherJournals.map((jr) => (
                            <button
                              key={jr.id}
                              onClick={() => duplicateTo(jr)}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-black/[0.04]"
                            >
                              <BookMarked className="h-4 w-4 shrink-0 text-accent-2" />
                              <span className="truncate">{jr.name}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}
                <Link to={`/app/trades/${trade.id}/edit`} state={backState} className="btn-ghost px-3 py-2 text-sm">
                  <Pencil className="h-4 w-4" /> ערוך
                </Link>
                <button onClick={() => setConfirming(true)} className="btn-ghost px-3 py-2 text-sm text-loss hover:text-loss">
                  <Trash2 className="h-4 w-4" /> מחק
                </button>
              </>
            )}
          </div>
        )}
      </div>

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
            <div className={`text-3xl font-bold num ${win ? 'text-win' : trade.return_amount < 0 ? 'text-loss' : 'text-muted'}`}>
              {formatMoney(trade.return_amount)}
            </div>
            <div className="text-sm text-muted">
              {formatTradeDateTime(trade.date)}
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {fields.map((f) => (
            <div key={f.label} className="rounded-2xl border border-black/[0.08] bg-black/[0.02] p-3">
              <div className="stat-label">{f.label}</div>
              <div className="mt-1 text-lg font-bold num">{f.value}</div>
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
              <div key={i} className="flex items-center justify-between rounded-lg px-3 py-2 hover:bg-black/[0.03]">
                <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${e.action === 'BUY' ? 'bg-win/10 text-win' : 'bg-loss/10 text-loss'}`}>
                  {e.action}
                </span>
                <div className="flex items-center gap-4 text-muted">
                  <span className="num">qty {String(e.qty)}</span>
                  <span className="num text-ink">@ {String(e.price)}</span>
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
                className="group block cursor-zoom-in overflow-hidden rounded-2xl border border-black/[0.08] bg-black/20"
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
