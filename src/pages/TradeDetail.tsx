import { useEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowRight,
  X,
  Pencil,
  Trash2,
  Copy,
  BookMarked,
  Check,
  Calendar,
  Clock,
  ArrowUpDown,
  Crosshair,
  LogOut,
  Hash,
  Target,
  ShieldAlert,
  Timer,
  Droplets,
  Layers,
  Sigma,
  StickyNote,
  ImageIcon,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import { useTrade, useTradeActions } from '../lib/useTrades'
import { useJournals } from '../lib/journals'
import { formatMoney, imageUrl, formatR, formatTradeDateTime, cleanSymbol } from '../lib/trades'
import { lookbackColor } from '../lib/lookback'
import { PriceMap } from '../components/PriceMap'
import { CountUp } from '../components/CountUp'
import type { Account, Zone, Liquidity } from '../types'

const ZONE_LABEL: Record<Zone, string> = { premium: 'Premium', deadzone: 'Deadzone', discount: 'Discount' }
const ZONE_TAG: Record<Zone, string> = { premium: 'tag-red', deadzone: '', discount: 'tag-green' }
const LIQ_LABEL: Record<Liquidity, string> = { buyside: 'Buyside', sellside: 'Sellside', none: 'לא נלקחה' }
const LIQ_TAG: Record<Liquidity, string> = { buyside: 'tag-blue', sellside: 'tag-orange', none: '' }
const Empty = () => <span className="text-faint">ריק</span>

/** One property row: icon + label on the right, value on the left. */
function Prop({ icon: Icon, label, children }: { icon: typeof Calendar; label: string; children: ReactNode }) {
  return (
    <div className="grid min-h-[36px] grid-cols-[140px_minmax(0,1fr)] items-center gap-2 rounded-md px-1.5 text-sm transition-colors hover:bg-[#f7f6f3]">
      <span className="flex items-center gap-2 text-muted">
        <Icon className="h-4 w-4 shrink-0 text-faint" strokeWidth={1.75} />
        {label}
      </span>
      <span className="min-w-0 py-1.5">{children}</span>
    </div>
  )
}

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
  const [lightbox, setLightbox] = useState<number | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [dupOpen, setDupOpen] = useState(false)
  const [dupDone, setDupDone] = useState<string | null>(null)

  const images = trade?.images ?? []

  // Auto-clear the "duplicated" confirmation after a moment.
  useEffect(() => {
    if (!dupDone) return
    const t = setTimeout(() => setDupDone(null), 2500)
    return () => clearTimeout(t)
  }, [dupDone])

  // Lightbox keys: Escape closes, arrows page through the screenshots.
  useEffect(() => {
    if (lightbox == null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightbox(null)
      if (e.key === 'ArrowLeft') setLightbox((i) => (i == null ? i : (i + 1) % images.length))
      if (e.key === 'ArrowRight') setLightbox((i) => (i == null ? i : (i - 1 + images.length) % images.length))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [lightbox, images.length])

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-muted">טוען…</div>
  }
  if (!trade) {
    return (
      <div className="callout">
        העסקה לא נמצאה.{' '}
        <Link to="/app/trades" className="text-accent hover:underline">
          חזרה לרשימה
        </Link>
      </div>
    )
  }

  const pnl = trade.return_amount
  const tone = pnl > 0 ? 'win' : pnl < 0 ? 'loss' : 'muted'
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

  const riskPts = trade.stoploss != null ? Math.abs(trade.entry - trade.stoploss) : null
  const rewardPts = trade.target != null ? Math.abs(trade.target - trade.entry) : null
  const plannedRR = riskPts && rewardPts ? rewardPts / riskPts : null

  const action = 'flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm text-[#5f5e5b] transition-colors hover:bg-surface hover:text-ink'

  return (
    <div>
      {/* Top: back + actions */}
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
              className="rounded-md bg-loss px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
            >
              מחק
            </button>
            <button onClick={() => setConfirming(false)} className="rounded-md px-3 py-1.5 text-xs text-muted hover:text-ink">
              ביטול
            </button>
          </div>
        ) : dupDone ? (
          <span className="flex items-center gap-1 text-sm font-medium text-win">
            <Check className="h-4 w-4" /> שוכפלה ל{dupDone}
          </span>
        ) : (
          <div className="flex items-center gap-0.5">
            {otherJournals.length > 0 && (
              <div className="relative">
                <button onClick={() => setDupOpen((o) => !o)} className={action} aria-expanded={dupOpen}>
                  <Copy className="h-4 w-4" /> שכפל
                </button>
                {dupOpen && (
                  <>
                    <div className="fixed inset-0 z-20" onClick={() => setDupOpen(false)} />
                    <div className="panel absolute left-0 z-30 mt-1 w-56 origin-top animate-zoom-in overflow-hidden p-1 text-right shadow-[0_12px_32px_-12px_rgba(15,15,15,.3)]">
                      <div className="px-2.5 py-1.5 text-xs font-semibold text-muted">שכפל ליומן</div>
                      {otherJournals.map((jr) => (
                        <button
                          key={jr.id}
                          onClick={() => duplicateTo(jr)}
                          className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-sm hover:bg-surface"
                        >
                          <BookMarked className="h-4 w-4 shrink-0 text-muted" />
                          <span className="truncate">{jr.name}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
            <Link to={`/app/trades/${trade.id}/edit`} state={backState} className={action}>
              <Pencil className="h-4 w-4" /> ערוך
            </Link>
            <button onClick={() => setConfirming(true)} className={`${action} hover:!text-loss`}>
              <Trash2 className="h-4 w-4" /> מחק
            </button>
          </div>
        )}
      </div>

      {/* Title block */}
      <header className="block-in mt-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="page-title">{cleanSymbol(trade.symbol)}</h1>
            <span className={`tag ${trade.side === 'LONG' ? 'tag-blue' : 'tag-purple'} !text-sm`}>
              {trade.side === 'LONG' ? 'לונג' : 'שורט'}
            </span>
            <span className={`tag ${tone === 'win' ? 'tag-green' : tone === 'loss' ? 'tag-red' : ''} !text-sm`}>
              {trade.status === 'WIN' ? 'Win' : trade.status === 'LOSS' ? 'Loss' : 'BE'}
            </span>
          </div>
          <p className="mt-1 text-muted">{formatTradeDateTime(trade.date)}</p>
        </div>
        <div className="text-left">
          <div className={`text-[40px] font-bold leading-none text-${tone}`} dir="ltr">
            <CountUp value={pnl} format={(n) => formatMoney(n)} durationMs={900} />
          </div>
          <div className="num mt-1 text-sm font-semibold text-muted">{formatR(trade.r_multiple)}</div>
        </div>
      </header>

      {/* Trade map */}
      <section className="panel block-in mt-6 px-5 pb-4 pt-4" style={{ '--i': 1 } as React.CSSProperties}>
        <div className="mb-3 flex items-center gap-2 text-sm">
          <h2 className="font-semibold">מפת העסקה</h2>
          <span className="text-muted">
            {riskPts != null && (
              <>
                סיכון <b className="num text-ink">{riskPts}</b> נק׳
              </>
            )}
            {plannedRR != null && (
              <>
                {' '}· יחס מתוכנן <b className="num text-ink">1:{plannedRR.toFixed(1)}</b>
              </>
            )}
          </span>
        </div>
        <PriceMap side={trade.side} entry={trade.entry} stop={trade.stoploss} target={trade.target} exits={exits} />
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
        {/* Properties */}
        <div className="block-in flex flex-col" style={{ '--i': 2 } as React.CSSProperties}>
          <Prop icon={Calendar} label="תאריך">
            <span>{formatTradeDateTime(trade.date).split(' · ')[0]}</span>
          </Prop>
          <Prop icon={Clock} label="שעה">
            <span className="num">{trade.date.slice(11, 16) || '—'}</span>
          </Prop>
          <Prop icon={ArrowUpDown} label="כיוון">
            <span className={`tag ${trade.side === 'LONG' ? 'tag-blue' : 'tag-purple'}`}>{trade.side === 'LONG' ? 'לונג' : 'שורט'}</span>
          </Prop>
          <Prop icon={Crosshair} label="כניסה">
            <span className="num font-medium">{trade.entry}</span>
          </Prop>
          {isPartial ? (
            exits.map((e, i) => (
              <Prop key={i} icon={LogOut} label={`יציאה ${i + 1}`}>
                <span className="num font-medium">{e}</span>
              </Prop>
            ))
          ) : (
            <Prop icon={LogOut} label="יציאה">
              {exits[0] != null ? <span className="num font-medium">{exits[0]}</span> : <Empty />}
            </Prop>
          )}
          <Prop icon={Hash} label="כמות">
            <span className="num">{trade.qty}</span>
          </Prop>
          <Prop icon={Target} label="יעד">
            {trade.target != null ? <span className="num">{trade.target}</span> : <Empty />}
          </Prop>
          <Prop icon={ShieldAlert} label="סטופ">
            {trade.stoploss != null ? <span className="num">{trade.stoploss}</span> : <Empty />}
          </Prop>
          <Prop icon={Timer} label="Lookback">
            {trade.lookback ? (
              <span className={`tag num ${lookbackColor(trade.lookback) === '#5B9DF9' ? 'tag-blue' : 'tag-red'}`} dir="ltr">
                {trade.lookback}
              </span>
            ) : (
              <Empty />
            )}
          </Prop>
          <Prop icon={Droplets} label="נזילות">
            {trade.liquidity ? <span className={`tag ${LIQ_TAG[trade.liquidity]}`}>{LIQ_LABEL[trade.liquidity]}</span> : <Empty />}
          </Prop>
          <Prop icon={Layers} label="אזור">
            {trade.zone ? <span className={`tag ${ZONE_TAG[trade.zone]}`}>{ZONE_LABEL[trade.zone]}</span> : <Empty />}
          </Prop>
          <Prop icon={Sigma} label="R-Multiple">
            <span className="num font-semibold">{formatR(trade.r_multiple)}</span>
          </Prop>

          {/* Notes */}
          <div className="mt-5">
            <h2 className="mb-2 flex items-center gap-2 text-[15px] font-semibold">
              <StickyNote className="h-4 w-4 text-faint" /> הערות
            </h2>
            {trade.notes ? (
              <p className="whitespace-pre-wrap leading-relaxed text-[#37352f]">{trade.notes}</p>
            ) : (
              <Link to={`/app/trades/${trade.id}/edit`} state={backState} className="text-sm text-faint hover:text-ink">
                אין הערות. לחץ כדי להוסיף.
              </Link>
            )}
          </div>

          {/* Executions */}
          {trade.executions && trade.executions.length > 0 && (
            <div className="mt-6">
              <h2 className="mb-2 text-[15px] font-semibold">ביצועים (Executions)</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="h-8 border-b border-border text-right text-[13px] text-muted [&>th]:px-1.5 [&>th]:font-normal">
                    <th>פעולה</th>
                    <th className="!text-left">כמות</th>
                    <th className="!text-left">מחיר</th>
                  </tr>
                </thead>
                <tbody>
                  {trade.executions.map((e, i) => (
                    <tr key={i} className="h-9 border-b border-[#f1f0ed] [&>td]:px-1.5">
                      <td>
                        <span className={`tag ${e.action === 'BUY' ? 'tag-blue' : 'tag-orange'}`}>{e.action}</span>
                      </td>
                      <td className="num text-left text-muted">{String(e.qty)}</td>
                      <td className="num text-left font-medium">{String(e.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Screenshots */}
        <div className="block-in lg:sticky lg:top-16 lg:self-start" style={{ '--i': 3 } as React.CSSProperties}>
          {images.length > 0 ? (
            <div className="flex flex-col gap-3">
              {images.map((img, i) => (
                <button
                  key={img}
                  type="button"
                  onClick={() => setLightbox(i)}
                  className="group block cursor-zoom-in overflow-hidden rounded-[10px] border border-border bg-surface"
                  aria-label={`הגדל צילום מסך ${i + 1}`}
                >
                  <img
                    src={imageUrl(img)}
                    alt={`צילום מסך ${i + 1} של העסקה`}
                    className="max-h-[520px] w-full object-contain transition-transform duration-500 group-hover:scale-[1.015]"
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          ) : (
            <Link
              to={`/app/trades/${trade.id}/edit`}
              state={backState}
              className="flex h-56 flex-col items-center justify-center gap-2 rounded-[10px] border border-dashed border-border text-sm text-faint transition-colors hover:border-accent/40 hover:text-ink"
            >
              <ImageIcon className="h-6 w-6" />
              אין צילום מסך. לחץ כדי להוסיף.
            </Link>
          )}
        </div>
      </div>

      {/* Lightbox */}
      {lightbox != null && images[lightbox] && (
        <div
          className="fixed inset-0 z-50 flex animate-zoom-in items-center justify-center bg-black/85 p-4 backdrop-blur-sm sm:p-10"
          onClick={() => setLightbox(null)}
          role="dialog"
          aria-label="צילום מסך מוגדל"
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            className="absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20"
            aria-label="סגור"
          >
            <X className="h-5 w-5" />
          </button>
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setLightbox((lightbox - 1 + images.length) % images.length)
                }}
                className="absolute right-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label="הקודם"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setLightbox((lightbox + 1) % images.length)
                }}
                className="absolute left-4 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label="הבא"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
            </>
          )}
          <img
            src={imageUrl(images[lightbox])}
            alt="צילום מסך של העסקה"
            className="max-h-full max-w-full rounded-xl object-contain shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  )
}
