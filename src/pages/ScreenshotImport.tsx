import { useEffect, useState, type ChangeEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, ImagePlus, Loader2, Sparkles, Check, AlertTriangle, RotateCcw } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useJournals } from '../lib/journals'
import { useTradeActions } from '../lib/useTrades'
import { compressImage } from '../lib/image'
import { extractTradeFromImage, type ExtractedTrade } from '../lib/extractTrade'
import { formatMoney, formatR } from '../lib/trades'
import { SESSION_TIMES, LOOKBACKS, lookbackColor } from '../lib/lookback'
import type { Trade, TradeSide, TradeStatus } from '../types'

const ASSETS = ['NQ', 'MNQ', 'ES', 'MES', 'YM', 'MYM'] as const
const POINT_VALUE: Record<string, number> = { NQ: 20, ES: 50, MNQ: 2, MES: 5, YM: 5, MYM: 0.5 }

function num(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

type Stage = 'idle' | 'extracting' | 'confirm'

export default function ScreenshotImport() {
  const { user } = useAuth()
  const { active } = useJournals()
  const { addTrade } = useTradeActions()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const presetDate = searchParams.get('date') // YYYY-MM-DD, e.g. from the calendar

  const [stage, setStage] = useState<Stage>('idle')
  const [image, setImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mock, setMock] = useState(false)
  const [uncertain, setUncertain] = useState<string[]>([])
  const [confidence, setConfidence] = useState(1)
  const [dragging, setDragging] = useState(false)

  const [form, setForm] = useState({
    day: presetDate ?? new Date().toISOString().slice(0, 10),
    time: '16:30' as (typeof SESSION_TIMES)[number],
    exactTime: '',
    useExact: false,
    lookback: '',
    symbol: 'MNQ',
    side: 'LONG' as TradeSide,
    qty: '',
    entry: '',
    exit: '',
    target: '',
    stoploss: '',
    peak: '',
    timeframe: '',
    notes: '',
  })
  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  // Switching session time swaps the lookback set — keep the selection by position.
  function setTime(tm: (typeof SESSION_TIMES)[number]) {
    setForm((f) => {
      const idx = LOOKBACKS[f.time].indexOf(f.lookback)
      return { ...f, time: tm, lookback: idx >= 0 ? LOOKBACKS[tm][idx] : '' }
    })
  }

  // Mark the outcome → fill the exit price from the plan: win=target, loss=stop, break-even=entry.
  function markOutcome(kind: 'WIN' | 'LOSS' | 'BE') {
    set('exit', kind === 'WIN' ? form.target : kind === 'LOSS' ? form.stoploss : form.entry)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const file = Array.from(e.dataTransfer.files).find((f) => f.type.startsWith('image/'))
    if (file) ingest(file)
  }

  async function ingest(file: File) {
    setError(null)
    setStage('extracting')
    try {
      const dataUrl = await compressImage(file)
      setImage(dataUrl)
      const { trade, mock: isMock } = await extractTradeFromImage(dataUrl)
      applyExtraction(trade)
      setMock(isMock)
      setStage('confirm')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'החילוץ נכשל')
      setStage(image ? 'confirm' : 'idle')
    }
  }

  function applyExtraction(t: ExtractedTrade) {
    const s = (t.symbol && (ASSETS as readonly string[]).includes(t.symbol) ? t.symbol : 'MNQ') as string
    const isSession = t.time && (SESSION_TIMES as readonly string[]).includes(t.time)
    setForm((f) => ({
      ...f,
      day: t.date ?? f.day,
      time: (isSession ? t.time : '16:30') as (typeof SESSION_TIMES)[number],
      exactTime: t.time && !isSession ? t.time : '',
      useExact: Boolean(t.time && !isSession),
      symbol: s,
      side: t.side ?? 'LONG',
      entry: t.entry != null ? String(t.entry) : '',
      exit: t.exit != null ? String(t.exit) : '',
      target: t.target != null ? String(t.target) : '',
      stoploss: t.stoploss != null ? String(t.stoploss) : '',
      timeframe: t.timeframe ?? '',
    }))
    setUncertain(t.uncertain_fields ?? [])
    setConfidence(typeof t.confidence === 'number' ? t.confidence : 1)
  }

  function handleFiles(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) ingest(file)
  }

  // Paste-to-import while on the upload step.
  useEffect(() => {
    if (stage !== 'idle') return
    function onPaste(e: ClipboardEvent) {
      const item = Array.from(e.clipboardData?.items ?? []).find((i) => i.type.startsWith('image/'))
      const file = item?.getAsFile()
      if (file) ingest(file)
    }
    window.addEventListener('paste', onPaste)
    return () => window.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  // --- live calc (same engine as the manual form) ---
  const pv = POINT_VALUE[form.symbol] ?? 0
  const entryN = num(form.entry)
  const exitN = num(form.exit)
  const qtyN = num(form.qty)
  const stopN = num(form.stoploss)
  const dir = form.side === 'LONG' ? 1 : -1
  const pnl =
    entryN != null && exitN != null && qtyN != null
      ? Math.round((exitN - entryN) * dir * qtyN * pv * 100) / 100
      : null
  const riskPts = entryN != null && stopN != null ? Math.abs(entryN - stopN) : null
  const rMultiple =
    entryN != null && exitN != null && riskPts
      ? Math.round((((exitN - entryN) * dir) / riskPts) * 100) / 100
      : null
  const status: TradeStatus = pnl == null ? 'WASH' : pnl > 0 ? 'WIN' : pnl < 0 ? 'LOSS' : 'WASH'

  function reset() {
    setStage('idle')
    setImage(null)
    setError(null)
    setUncertain([])
  }

  function save() {
    if (entryN == null) return setError('צריך מחיר כניסה')
    setError(null)
    const time = form.useExact && form.exactTime ? form.exactTime : form.time
    const payload: Trade = {
      id: crypto.randomUUID(),
      user_id: (user?.id as string) ?? 'demo-user',
      account_id: active.id,
      date: `${form.day}T${time}`,
      symbol: form.symbol,
      market: 'FUTURES',
      side: form.side,
      status,
      qty: qtyN ?? 0,
      entry: entryN,
      exit: exitN,
      exits: exitN != null ? [exitN] : null,
      target: num(form.target),
      stoploss: stopN,
      entry_total: null,
      exit_total: null,
      return_amount: pnl ?? 0,
      return_percent: null,
      r_multiple: rMultiple,
      hold_time: null,
      confidence: null,
      lookback: form.lookback || null,
      peak_price: num(form.peak),
      tags: null,
      notes: form.notes.trim() || null,
      mood: null,
      discipline_score: null,
      executions: null,
      images: image ? [image] : null,
    }
    addTrade(payload)
    navigate(`/app/trades/${payload.id}`)
  }

  const field = 'flex flex-col gap-1.5'
  const unsure = (name: string) => uncertain.includes(name)
  const ring = (name: string) => (unsure(name) ? 'ring-1 ring-accent/60' : '')
  const Flag = ({ name }: { name: string }) =>
    unsure(name) ? (
      <span className="flex items-center gap-1 text-[11px] font-medium text-accent">
        <AlertTriangle className="h-3 w-3" /> בדוק
      </span>
    ) : null
  const sideBtn = (on: boolean, tone: 'win' | 'loss') =>
    `flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
      on
        ? tone === 'win'
          ? 'border-win/50 bg-win/15 text-win'
          : 'border-loss/50 bg-loss/15 text-loss'
        : 'border-white/10 text-muted hover:text-ink'
    }`
  const timeBtn = (on: boolean) =>
    `flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
      on ? 'border-accent/50 bg-accent/15 text-accent' : 'border-white/10 text-muted hover:text-ink'
    }`
  const outcomeBtn = (on: boolean, tone: 'win' | 'loss' | 'wash') =>
    `flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
      on
        ? tone === 'win'
          ? 'border-win/50 bg-win/15 text-win'
          : tone === 'loss'
            ? 'border-loss/50 bg-loss/15 text-loss'
            : 'border-accent/50 bg-accent/15 text-accent'
        : 'border-white/10 text-muted hover:text-ink'
    }`
  const activeOutcome: 'WIN' | 'LOSS' | 'BE' | null =
    form.exit === ''
      ? null
      : form.exit === form.target
        ? 'WIN'
        : form.exit === form.stoploss
          ? 'LOSS'
          : form.exit === form.entry
            ? 'BE'
            : null

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Link to="/app/trades" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowRight className="h-4 w-4" /> חזרה לעסקאות
      </Link>

      <div className="flex items-center gap-2">
        <Sparkles className="h-6 w-6 text-accent" />
        <div>
          <h1 className="text-2xl font-bold">עסקה מתמונה</h1>
          <p className="text-muted">העלה צילום מסך של העסקה — נמלא את הפרטים אוטומטית, ואתה מאשר.</p>
        </div>
      </div>

      {stage === 'idle' && (
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`card flex cursor-pointer flex-col items-center justify-center gap-3 border-dashed py-16 text-center transition-colors ${
            dragging ? 'border-accent bg-accent/10' : 'hover:border-accent/50'
          }`}
        >
          <ImagePlus className={`h-10 w-10 ${dragging ? 'text-accent' : 'text-muted'}`} />
          <div className="text-lg font-semibold">{dragging ? 'שחרר כדי להעלות' : 'גרור לכאן, לחץ לבחירה, או הדבק (⌘V)'}</div>
          <div className="text-sm text-muted">צילום מסך של הגרף עם כלי הפוזיציה</div>
          <input type="file" accept="image/*" className="hidden" onChange={handleFiles} />
        </label>
      )}

      {stage === 'extracting' && (
        <div className="card flex flex-col items-center justify-center gap-3 py-16 text-center">
          {image && <img src={image} alt="" className="mb-2 max-h-48 rounded-xl border border-white/[0.06] object-contain" />}
          <Loader2 className="h-8 w-8 animate-spin text-accent" />
          <div className="font-semibold">קורא את התמונה…</div>
          <div className="text-sm text-muted">מחלץ סימבול, כיוון, כניסה, סטופ ויעד</div>
        </div>
      )}

      {stage === 'confirm' && (
        <div className="grid gap-5 lg:grid-cols-2">
          {/* Image side */}
          <div className="space-y-3">
            <div className="card p-2">
              {image && <img src={image} alt="צילום העסקה" className="w-full rounded-lg object-contain" />}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div
                className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium ${
                  confidence >= 0.8
                    ? 'bg-win/15 text-win'
                    : confidence >= 0.5
                      ? 'bg-accent/15 text-accent'
                      : 'bg-loss/15 text-loss'
                }`}
              >
                <Sparkles className="h-4 w-4" /> ביטחון החילוץ: {Math.round(confidence * 100)}%
              </div>
              <button onClick={reset} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
                <RotateCcw className="h-4 w-4" /> תמונה אחרת
              </button>
            </div>
            {mock && (
              <p className="rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs text-accent">
                מצב הדגמה: החילוץ הוא דמה. חבר את Supabase + מפתח כדי להפעיל את Claude Vision האמיתי.
              </p>
            )}
            {uncertain.length > 0 && (
              <p className="text-xs text-muted">
                שדות מסומנים ב<span className="text-accent">בדוק</span> — המודל לא היה בטוח בהם, כדאי לאמת.
              </p>
            )}
          </div>

          {/* Editable fields side */}
          <div className="card space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className={field}>
                <span className="field-label mb-0">תאריך</span>
                <input type="date" dir="ltr" className={`input ${ring('date')}`} value={form.day} onChange={(e) => set('day', e.target.value)} />
                <Flag name="date" />
              </label>

              <div className={field}>
                <div className="flex items-center justify-between">
                  <span className="field-label mb-0">שעה</span>
                  <Flag name="time" />
                </div>
                {form.useExact ? (
                  <input type="time" dir="ltr" className="input" value={form.exactTime} onChange={(e) => set('exactTime', e.target.value)} />
                ) : (
                  <div className="flex gap-2">
                    {SESSION_TIMES.map((tm) => (
                      <button key={tm} type="button" onClick={() => setTime(tm)} className={timeBtn(form.time === tm)}>
                        {tm}
                      </button>
                    ))}
                  </div>
                )}
                <label className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                  <input type="checkbox" checked={form.useExact} onChange={(e) => set('useExact', e.target.checked)} />
                  שעה מדויקת מהתמונה
                </label>
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
                        style={{ borderColor: on ? c : `${c}59`, color: on ? '#0A0C10' : c, backgroundColor: on ? c : `${c}14` }}
                      >
                        {lb}
                      </button>
                    )
                  })}
                </div>
              </div>

              <label className={field}>
                <span className="field-label mb-0">סימבול</span>
                <select dir="ltr" className={`input ${ring('symbol')}`} value={form.symbol} onChange={(e) => set('symbol', e.target.value)}>
                  {ASSETS.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <Flag name="symbol" />
              </label>

              <div className={field}>
                <div className="flex items-center justify-between">
                  <span className="field-label mb-0">כיוון</span>
                  <Flag name="side" />
                </div>
                <div className={`flex gap-2 rounded-xl ${ring('side')}`}>
                  <button type="button" onClick={() => set('side', 'LONG')} className={sideBtn(form.side === 'LONG', 'win')}>Long</button>
                  <button type="button" onClick={() => set('side', 'SHORT')} className={sideBtn(form.side === 'SHORT', 'loss')}>Short</button>
                </div>
              </div>

              <label className={field}>
                <span className="field-label mb-0">כמות (חוזים)</span>
                <input type="number" step="any" dir="ltr" className="input" value={form.qty} onChange={(e) => set('qty', e.target.value)} />
              </label>
              <label className={field}>
                <span className="field-label mb-0">מחיר כניסה</span>
                <input type="number" step="any" dir="ltr" className={`input ${ring('entry')}`} value={form.entry} onChange={(e) => set('entry', e.target.value)} />
                <Flag name="entry" />
              </label>

              <div className={`${field} sm:col-span-2`}>
                <span className="field-label mb-0">תוצאת העסקה (קובעת את מחיר היציאה)</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => markOutcome('WIN')} className={outcomeBtn(activeOutcome === 'WIN', 'win')}>הצליחה</button>
                  <button type="button" onClick={() => markOutcome('LOSS')} className={outcomeBtn(activeOutcome === 'LOSS', 'loss')}>נכשלה</button>
                  <button type="button" onClick={() => markOutcome('BE')} className={outcomeBtn(activeOutcome === 'BE', 'wash')}>ברייק אוין</button>
                </div>
              </div>

              <label className={field}>
                <span className="field-label mb-0">מחיר יציאה</span>
                <input type="number" step="any" dir="ltr" className={`input ${ring('exit')}`} value={form.exit} onChange={(e) => set('exit', e.target.value)} />
                <Flag name="exit" />
              </label>
              <label className={field}>
                <span className="field-label mb-0">יעד</span>
                <input type="number" step="any" dir="ltr" className={`input ${ring('target')}`} value={form.target} onChange={(e) => set('target', e.target.value)} />
                <Flag name="target" />
              </label>

              <label className={field}>
                <span className="field-label mb-0">סטופ</span>
                <input type="number" step="any" dir="ltr" className={`input ${ring('stoploss')}`} value={form.stoploss} onChange={(e) => set('stoploss', e.target.value)} />
                <Flag name="stoploss" />
              </label>
              <label className={field}>
                <span className="field-label mb-0">שיא הרווח — מחיר שיא (אופציונלי)</span>
                <input type="number" step="any" dir="ltr" className="input" value={form.peak} onChange={(e) => set('peak', e.target.value)} placeholder="המחיר המקסימלי לטובתך" />
              </label>
              <label className={`${field} sm:col-span-2`}>
                <span className="field-label mb-0">הערות</span>
                <input className="input" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="אופציונלי" />
              </label>
            </div>

            {/* Auto-computed results */}
            <div className="grid grid-cols-3 gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
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
                <div className={`mt-1 text-lg font-bold ${status === 'WIN' ? 'text-win' : status === 'LOSS' ? 'text-loss' : 'text-muted'}`}>{status}</div>
              </div>
            </div>

            {error && <p className="text-sm text-loss">{error}</p>}

            <button onClick={save} className="btn-primary w-full justify-center">
              <Check className="h-4 w-4" /> שמור עסקה
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
