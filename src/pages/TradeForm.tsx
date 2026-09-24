import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, ImagePlus, X, Loader2 } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useJournals } from '../lib/journals'
import { useTrade, useTradeActions } from '../lib/useTrades'
import { imageUrl, cleanSymbol, formatMoney, formatR } from '../lib/trades'
import { compressImage } from '../lib/image'
import { uploadTradeImages } from '../lib/uploadImages'
import { isSupabaseConfigured } from '../lib/supabase'
import { SESSION_TIMES as TIMES, LOOKBACKS, lookbackColor } from '../lib/lookback'
import { computePartials, seedExits } from '../lib/partials'
import { ExitsField } from '../components/ExitsField'
import { PriceMap } from '../components/PriceMap'
import { TradeContextFields } from '../components/TradeContextFields'
import type { Trade, TradeSide } from '../types'

// Tradable assets and their dollar value per 1.0 index point, per contract.
const ASSETS = ['NQ', 'MNQ', 'ES', 'MES', 'YM', 'MYM'] as const
const POINT_VALUE: Record<string, number> = { NQ: 20, ES: 50, MNQ: 2, MES: 5, YM: 5, MYM: 0.5 }

function num(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export default function TradeForm() {
  const { id } = useParams()
  const editing = Boolean(id)
  const { trade, loading } = useTrade(id)

  if (editing && loading) {
    return <div className="flex h-64 items-center justify-center text-muted">טוען…</div>
  }
  if (editing && !trade) {
    return (
      <div className="callout">
        העסקה לא נמצאה. <Link to="/app/trades" className="text-accent hover:underline">חזרה</Link>
      </div>
    )
  }
  return <TradeFormInner key={id ?? 'new'} trade={trade} editing={editing} />
}

function TradeFormInner({ trade, editing }: { trade: Trade | null; editing: boolean }) {
  const { user } = useAuth()
  const { active } = useJournals()
  const { addTrade, updateTrade } = useTradeActions()
  const navigate = useNavigate()
  const location = useLocation()
  // A return target (e.g. the calendar month) threaded through from TradeDetail
  // so editing preserves where the user came from.
  const backState = (location.state as { backTo?: string; backLabel?: string } | null) ?? null
  // For a NEW trade, "back"/"cancel" follow the caller's target (e.g. calendar);
  // for an edit they go back to the trade being edited.
  const newBackTo = backState?.backTo ?? '/app/trades'
  const newBackLabel = backState?.backLabel ?? 'חזרה לעסקאות'
  const [searchParams] = useSearchParams()
  const presetDate = searchParams.get('date') // YYYY-MM-DD, e.g. from the calendar

  const seedSymbol = (() => {
    const c = trade?.symbol ? cleanSymbol(trade.symbol) : 'MNQ'
    return (ASSETS as readonly string[]).includes(c) ? c : 'MNQ'
  })()

  const [form, setForm] = useState(() => ({
    day: (trade?.date ?? (presetDate ? `${presetDate}T00:00` : new Date().toISOString())).slice(0, 10),
    time: (trade?.date?.slice(11, 16) === '17:00' ? '17:00' : '16:30') as (typeof TIMES)[number],
    lookback: trade?.lookback ?? '',
    liquidity: trade?.liquidity ?? null,
    zone: trade?.zone ?? null,
    bias: trade?.bias ?? null,
    symbol: seedSymbol,
    side: (trade?.side ?? 'LONG') as TradeSide,
    entry: trade?.entry != null ? String(trade.entry) : '',
    exits: seedExits(trade),
    target: trade?.target != null ? String(trade.target) : '',
    stoploss: trade?.stoploss != null ? String(trade.stoploss) : '',
    notes: trade?.notes ?? '',
  }))
  const [error, setError] = useState<string | null>(null)
  const [images, setImages] = useState<string[]>(trade?.images ?? [])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  // Switching session time swaps the lookback set — keep the selection by
  // position (e.g. 10:30 ↔ 11:00), or clear it if none was chosen.
  function setTime(tm: (typeof TIMES)[number]) {
    setForm((f) => {
      const idx = LOOKBACKS[f.time].indexOf(f.lookback)
      return { ...f, time: tm, lookback: idx >= 0 ? LOOKBACKS[tm][idx] : '' }
    })
  }

  // --- live auto-calculations -------------------------------------------
  const pv = POINT_VALUE[form.symbol] ?? 0
  const entryN = num(form.entry)
  const stopN = num(form.stoploss)
  const calc = computePartials({
    entry: entryN,
    side: form.side,
    pv,
    stop: stopN,
    exits: form.exits,
    dateTime: `${form.day}T${form.time}`,
  })
  const { pnl, rMultiple, status } = calc

  async function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!files.length) return
    setUploading(true)
    try {
      const encoded = await Promise.all(files.map((f) => compressImage(f)))
      setImages((prev) => [...prev, ...encoded])
    } catch {
      setError('לא הצלחתי לטעון את התמונה')
    } finally {
      setUploading(false)
    }
  }

  function removeImage(index: number) {
    setImages((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (entryN == null) return setError('צריך מחיר כניסה')
    if (!form.day) return setError('צריך תאריך')
    if (saving) return
    setError(null)

    const id = editing && trade ? trade.id : crypto.randomUUID()
    // Upload screenshots to Storage (keep base64 only in demo mode).
    let finalImages: string[] | null = images.length ? images : null
    if (images.length && isSupabaseConfigured) {
      setSaving(true)
      finalImages = await uploadTradeImages(images, (user?.id as string) ?? 'demo-user', id)
      setSaving(false)
    }

    const payload: Trade = {
      id,
      // Preserve the trade's owner on edit (never steal ownership); new trades
      // belong to the journal's owner so shared-journal entries stay visible to them.
      user_id: editing && trade ? trade.user_id : (active?.user_id ?? (user?.id as string) ?? 'demo-user'),
      account_id: editing && trade ? trade.account_id : active.id,
      date: `${form.day}T${form.time}`,
      symbol: form.symbol,
      market: trade?.market ?? 'FUTURES',
      side: form.side,
      status,
      qty: calc.totalQty,
      entry: entryN,
      exit: calc.exitLast,
      exits: calc.exitPrices.length ? calc.exitPrices : trade?.exits ?? null,
      target: num(form.target),
      stoploss: stopN,
      entry_total: trade?.entry_total ?? null,
      exit_total: trade?.exit_total ?? null,
      return_amount: pnl ?? 0,
      return_percent: trade?.return_percent ?? null,
      r_multiple: rMultiple,
      hold_time: trade?.hold_time ?? null,
      confidence: trade?.confidence ?? null,
      lookback: form.lookback || null,
      liquidity: form.liquidity,
      zone: form.zone,
      bias: form.bias,
      tags: trade?.tags ?? null,
      notes: form.notes.trim() || null,
      mood: trade?.mood ?? null,
      discipline_score: trade?.discipline_score ?? null,
      executions: calc.executions ?? trade?.executions ?? null,
      images: finalImages,
    }

    if (editing && trade) {
      updateTrade(trade.id, payload)
      navigate(`/app/trades/${trade.id}`, { state: backState })
    } else {
      addTrade(payload)
      // From the calendar: go straight back there; otherwise to the new trade.
      navigate(backState?.backTo ?? `/app/trades/${payload.id}`)
    }
  }

  const field = 'flex flex-col gap-1.5'
  const choice = (on: boolean, onCls: string) =>
    `h-10 flex-1 rounded-md border text-sm font-medium transition-all active:scale-[0.98] ${
      on ? `${onCls} border-transparent font-semibold` : 'border-border text-[#5f5e5b] hover:bg-surface'
    }`
  const pnlTone = pnl == null ? 'text-faint' : pnl > 0 ? 'text-win' : pnl < 0 ? 'text-loss' : 'text-muted'
  const backHref = editing && trade ? `/app/trades/${trade.id}` : newBackTo
  const submitLabel = saving ? 'שומר…' : editing ? 'שמור שינויים' : 'הוסף עסקה'

  const result = (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-2">
        <div>
          <div className="text-[12px] text-muted">P&amp;L</div>
          <div className={`num text-xl font-bold ${pnlTone}`}>{pnl == null ? '—' : formatMoney(pnl)}</div>
        </div>
        <div>
          <div className="text-[12px] text-muted">R</div>
          <div className="num text-xl font-bold">{rMultiple == null ? '—' : formatR(rMultiple)}</div>
        </div>
        <div>
          <div className="text-[12px] text-muted">סטטוס</div>
          <div className="mt-1">
            {pnl == null ? (
              <span className="text-faint">—</span>
            ) : (
              <span className={`tag ${status === 'WIN' ? 'tag-green' : status === 'LOSS' ? 'tag-red' : ''}`}>
                {status === 'WIN' ? 'Win' : status === 'LOSS' ? 'Loss' : 'BE'}
              </span>
            )}
          </div>
        </div>
      </div>
      <PriceMap
        side={form.side}
        entry={entryN}
        stop={stopN}
        target={num(form.target)}
        exits={calc.exitPrices}
      />
      <div className="flex justify-between text-[12px] text-muted">
        <span>
          כמות כוללת: <b className="num text-ink">{calc.totalQty || '—'}</b>
        </span>
        <span>ערך נקודה ל-{form.symbol}: <b className="num text-ink">${pv}</b></span>
      </div>
    </div>
  )

  return (
    <div className="pb-24 lg:pb-0">
      <Link to={backHref} state={backState} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowRight className="h-4 w-4" /> {editing ? 'חזרה לעסקה' : newBackLabel}
      </Link>

      <header className="block-in mt-5">
        <h1 className="page-title">{editing ? 'עריכת עסקה' : 'עסקה חדשה'}</h1>
        <p className="mt-1 text-muted">ביומן: {active.name}</p>
      </header>

      <form onSubmit={handleSubmit} className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="flex flex-col">
          {/* 1 · When */}
          <FormSection n={1} title="מתי">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className={field}>
                <span className="field-label mb-0">תאריך</span>
                <input type="date" dir="ltr" className="input" value={form.day} onChange={(e) => set('day', e.target.value)} />
              </label>
              <div className={field}>
                <span className="field-label mb-0">שעה</span>
                <div className="flex gap-2">
                  {TIMES.map((tm) => (
                    <button key={tm} type="button" aria-pressed={form.time === tm} onClick={() => setTime(tm)} className={`num ${choice(form.time === tm, 'bg-ink text-white')}`}>
                      {tm}
                    </button>
                  ))}
                </div>
              </div>
              <div className={`${field} sm:col-span-2`}>
                <span className="field-label mb-0">Lookback (מודל כניסה)</span>
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
                  {LOOKBACKS[form.time].map((lb) => {
                    const blue = lookbackColor(lb) === '#5B9DF9'
                    const on = form.lookback === lb
                    return (
                      <button
                        key={lb}
                        type="button"
                        dir="ltr"
                        aria-pressed={on}
                        onClick={() => set('lookback', on ? '' : lb)}
                        className={`h-10 rounded-md text-sm font-semibold transition-all active:scale-[0.97] ${
                          on
                            ? blue
                              ? 'bg-[#2b7fd0] text-white shadow-[0_2px_8px_-2px_rgba(43,127,208,.5)]'
                              : 'bg-[#c9503d] text-white shadow-[0_2px_8px_-2px_rgba(201,80,61,.5)]'
                            : blue
                              ? 'bg-tag-blue text-tag-blue-fg hover:brightness-95'
                              : 'bg-tag-red text-tag-red-fg hover:brightness-95'
                        }`}
                      >
                        {lb}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </FormSection>

          {/* 2 · The trade */}
          <FormSection n={2} title="העסקה">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className={`${field} sm:col-span-2`}>
                <span className="field-label mb-0">סימבול</span>
                <div className="grid grid-cols-6 gap-2">
                  {ASSETS.map((s) => (
                    <button key={s} type="button" aria-pressed={form.symbol === s} onClick={() => set('symbol', s)} className={choice(form.symbol === s, 'bg-ink text-white')}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div className={`${field} sm:col-span-2`}>
                <span className="field-label mb-0">כיוון</span>
                <div className="flex gap-2">
                  <button type="button" aria-pressed={form.side === 'LONG'} onClick={() => set('side', 'LONG')} className={choice(form.side === 'LONG', 'bg-tag-blue text-tag-blue-fg')}>
                    Long · לונג
                  </button>
                  <button type="button" aria-pressed={form.side === 'SHORT'} onClick={() => set('side', 'SHORT')} className={choice(form.side === 'SHORT', 'bg-tag-purple text-tag-purple-fg')}>
                    Short · שורט
                  </button>
                </div>
              </div>
              <label className={field}>
                <span className="field-label mb-0">מחיר כניסה</span>
                <input id="tf-entry" type="number" step="any" dir="ltr" className="input" value={form.entry} onChange={(e) => set('entry', e.target.value)} />
              </label>
              <label className={field}>
                <span className="field-label mb-0">סטופ</span>
                <input id="tf-stop" type="number" step="any" dir="ltr" className="input" value={form.stoploss} onChange={(e) => set('stoploss', e.target.value)} />
              </label>

              <ExitsField value={form.exits} onChange={(rows) => set('exits', rows)} />

              <label className={field}>
                <span className="field-label mb-0">יעד</span>
                <input type="number" step="any" dir="ltr" className="input" value={form.target} onChange={(e) => set('target', e.target.value)} />
              </label>
              <div className={field}>
                <span className="field-label mb-0">כמות כוללת (מחושב)</span>
                <div className="input flex items-center bg-surface num text-muted" dir="ltr">{calc.totalQty || '—'}</div>
              </div>
            </div>
          </FormSection>

          {/* 3 · Context */}
          <FormSection n={3} title="הקשר">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TradeContextFields
                liquidity={form.liquidity}
                zone={form.zone}
                bias={form.bias}
                onLiquidity={(v) => set('liquidity', v)}
                onZone={(v) => set('zone', v)}
                onBias={(v) => set('bias', v)}
              />
            </div>
          </FormSection>

          {/* 4 · Screenshots + notes */}
          <FormSection n={4} title="צילומים והערות">
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.map((src, i) => (
                <div key={i} className="group relative overflow-hidden rounded-lg border border-border bg-surface">
                  <img src={imageUrl(src)} alt={`צילום מסך ${i + 1}`} className="h-24 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    aria-label="הסר תמונה"
                    className="absolute left-1 top-1 flex h-7 w-7 items-center justify-center rounded-md bg-white/90 text-ink shadow opacity-0 transition-opacity hover:text-loss focus:opacity-100 group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[#d3d1cb] text-xs text-muted transition-colors hover:border-accent/50 hover:bg-accent/[0.03] hover:text-ink">
                {uploading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <ImagePlus className="h-5 w-5" />
                    הוסף תמונה
                  </>
                )}
                <input type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} disabled={uploading} />
              </label>
            </div>
            <label className={`${field} mt-4`}>
              <span className="field-label mb-0">הערות</span>
              <textarea rows={4} className="input resize-y" placeholder="מה ראית? למה נכנסת? מה למדת?" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </label>
          </FormSection>

          {error && <p className="mt-4 rounded-md bg-tag-red px-3 py-2 text-sm text-tag-red-fg">{error}</p>}
        </div>

        {/* Live result — sticky side panel on desktop */}
        <aside className="hidden lg:block">
          <div className="panel sticky top-16 flex flex-col gap-4 p-5">
            <h2 className="text-[15px] font-semibold">תוצאה · מחושב אוטומטית</h2>
            {result}
            <div className="flex gap-2 border-t border-border pt-4">
              <button type="submit" disabled={saving} className="btn-primary flex-1 !py-2">
                {submitLabel}
              </button>
              <Link to={backHref} state={backState} className="btn-ghost !py-2">
                ביטול
              </Link>
            </div>
          </div>
        </aside>

        {/* Phone: result + save pinned to the bottom */}
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className={`num text-lg font-bold leading-tight ${pnlTone}`}>{pnl == null ? '—' : formatMoney(pnl)}</div>
              <div className="num text-xs text-muted">{rMultiple == null ? 'R —' : formatR(rMultiple)}</div>
            </div>
            <Link to={backHref} state={backState} className="btn-ghost">
              ביטול
            </Link>
            <button type="submit" disabled={saving} className="btn-primary">
              {submitLabel}
            </button>
          </div>
        </div>
      </form>

      {/* Phone: the live result sits after the form, above the pinned bar */}
      <section className="panel mt-6 p-4 lg:hidden">
        <h2 className="mb-3 text-[15px] font-semibold">תוצאה · מחושב אוטומטית</h2>
        {result}
      </section>
    </div>
  )
}

function FormSection({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="block-in border-t border-border py-6 first:border-t-0 first:pt-0" style={{ '--i': n } as React.CSSProperties}>
      <h2 className="mb-4 flex items-center gap-2.5 text-[17px] font-semibold">
        <span className="num flex h-6 w-6 items-center justify-center rounded-md bg-surface text-xs font-bold text-muted">{n}</span>
        {title}
      </h2>
      {children}
    </section>
  )
}
