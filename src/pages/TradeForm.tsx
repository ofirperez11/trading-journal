import { useState, type ChangeEvent, type FormEvent } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { ArrowRight, ImagePlus, X, Loader2 } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useJournals } from '../lib/journals'
import { useTrade, useTradeActions } from '../lib/useTrades'
import { imageUrl, cleanSymbol, formatMoney, formatR } from '../lib/trades'
import { compressImage } from '../lib/image'
import { SESSION_TIMES as TIMES, LOOKBACKS, lookbackColor } from '../lib/lookback'
import { computePartials, seedExits } from '../lib/partials'
import { ExitsField } from '../components/ExitsField'
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
      <div className="card text-center text-muted">
        העסקה לא נמצאה. <Link to="/app/trades" className="text-accent-2 hover:underline">חזרה</Link>
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
    peak: trade?.peak_price != null ? String(trade.peak_price) : '',
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

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (entryN == null) return setError('צריך מחיר כניסה')
    if (!form.day) return setError('צריך תאריך')
    setError(null)

    const payload: Trade = {
      id: editing && trade ? trade.id : crypto.randomUUID(),
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
      peak_price: num(form.peak),
      tags: trade?.tags ?? null,
      notes: form.notes.trim() || null,
      mood: trade?.mood ?? null,
      discipline_score: trade?.discipline_score ?? null,
      executions: calc.executions ?? trade?.executions ?? null,
      images: images.length ? images : null,
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
  const sideBtn = (active: boolean, tone: 'win' | 'loss') =>
    `flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
      active
        ? tone === 'win'
          ? 'border-win/50 bg-win/15 text-win'
          : 'border-loss/50 bg-loss/15 text-loss'
        : 'border-black/[0.12] text-muted hover:text-ink'
    }`
  const timeBtn = (active: boolean) =>
    `flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
      active ? 'border-accent/50 bg-accent/15 text-accent' : 'border-black/[0.12] text-muted hover:text-ink'
    }`

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <Link to={editing && trade ? `/app/trades/${trade.id}` : newBackTo} state={backState} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowRight className="h-4 w-4" /> {editing ? 'חזרה לעסקה' : newBackLabel}
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{editing ? 'עריכת עסקה' : 'עסקה חדשה'}</h1>
        <p className="text-muted">ביומן: {active.name}</p>
      </div>

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className={field}>
            <span className="field-label mb-0">תאריך</span>
            <input type="date" dir="ltr" className="input" value={form.day} onChange={(e) => set('day', e.target.value)} />
          </label>
          <div className={field}>
            <span className="field-label mb-0">שעה</span>
            <div className="flex gap-2">
              {TIMES.map((tm) => (
                <button key={tm} type="button" onClick={() => setTime(tm)} className={timeBtn(form.time === tm)}>
                  {tm}
                </button>
              ))}
            </div>
          </div>

          <div className={`${field} sm:col-span-2`}>
            <span className="field-label mb-0">Lookback (מודל כניסה)</span>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {LOOKBACKS[form.time].map((lb) => {
                const c = lookbackColor(lb)
                const on = form.lookback === lb
                return (
                  <button
                    key={lb}
                    type="button"
                    dir="ltr"
                    onClick={() => set('lookback', on ? '' : lb)}
                    className="rounded-xl border py-2.5 text-sm font-semibold transition-all"
                    style={{
                      borderColor: on ? c : `${c}59`,
                      color: on ? '#0A0C10' : c,
                      backgroundColor: on ? c : `${c}14`,
                    }}
                  >
                    {lb}
                  </button>
                )
              })}
            </div>
          </div>

          <label className={field}>
            <span className="field-label mb-0">סימבול</span>
            <select dir="ltr" className="input" value={form.symbol} onChange={(e) => set('symbol', e.target.value)}>
              {ASSETS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>

          <div className={field}>
            <span className="field-label mb-0">כיוון</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => set('side', 'LONG')} className={sideBtn(form.side === 'LONG', 'win')}>
                Long
              </button>
              <button type="button" onClick={() => set('side', 'SHORT')} className={sideBtn(form.side === 'SHORT', 'loss')}>
                Short
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
            <div className="input flex items-center num text-muted" dir="ltr">{calc.totalQty || '—'}</div>
          </div>

          <label className={`${field} sm:col-span-2`}>
            <span className="field-label mb-0">שיא פוטנציאל — נקודות מהכניסה (אופציונלי)</span>
            <input type="number" step="any" dir="ltr" className="input" value={form.peak} onChange={(e) => set('peak', e.target.value)} placeholder="כמה נקודות העסקה הגיעה לטובתך מהכניסה" />
          </label>

          {/* Auto-computed results */}
          <div className="sm:col-span-2">
            <div className="mb-1 flex items-center justify-between">
              <span className="field-label mb-0">תוצאה (מחושב אוטומטית)</span>
              <span className="num text-[11px] text-muted">ערך נקודה ל-{form.symbol}: ${pv}</span>
            </div>
            <div className="grid grid-cols-3 gap-3 rounded-xl border border-black/[0.08] bg-black/[0.02] p-3">
              <div>
                <div className="stat-label">P&amp;L</div>
                <div className={`num mt-1 text-lg font-bold ${pnl == null ? 'text-muted' : pnl >= 0 ? 'text-win' : 'text-loss'}`}>
                  {pnl == null ? '—' : formatMoney(pnl)}
                </div>
              </div>
              <div>
                <div className="stat-label">R-Multiple</div>
                <div className="num mt-1 text-lg font-bold">{rMultiple == null ? '—' : formatR(rMultiple)}</div>
              </div>
              <div>
                <div className="stat-label">סטטוס</div>
                <div className={`mt-1 text-lg font-bold ${status === 'WIN' ? 'text-win' : status === 'LOSS' ? 'text-loss' : 'text-muted'}`}>
                  {status}
                </div>
              </div>
            </div>
          </div>

          <div className="sm:col-span-2">
            <span className="field-label">צילומי מסך</span>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {images.map((src, i) => (
                <div key={i} className="group relative overflow-hidden rounded-xl border border-black/[0.08] bg-black/20">
                  <img src={imageUrl(src)} alt="" className="h-24 w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeImage(i)}
                    aria-label="הסר תמונה"
                    className="absolute left-1 top-1 flex h-6 w-6 items-center justify-center rounded-md bg-black/60 text-ink opacity-0 transition-opacity hover:bg-loss/80 group-hover:opacity-100"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
              <label className="flex h-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-black/[0.15] text-xs text-muted transition-colors hover:border-accent/50 hover:text-ink">
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
          </div>

          <label className={`${field} sm:col-span-2`}>
            <span className="field-label mb-0">הערות</span>
            <textarea rows={3} className="input resize-none" value={form.notes} onChange={(e) => set('notes', e.target.value)} />
          </label>
        </div>

        {error && <p className="text-sm text-loss">{error}</p>}

        <div className="flex items-center justify-end gap-2 border-t border-black/[0.08] pt-4">
          <Link to={editing && trade ? `/app/trades/${trade.id}` : newBackTo} state={backState} className="btn-ghost">
            ביטול
          </Link>
          <button type="submit" className="btn-primary">
            {editing ? 'שמור שינויים' : 'הוסף עסקה'}
          </button>
        </div>
      </form>
    </div>
  )
}
