import { useEffect, useState, type ChangeEvent } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowRight, ImagePlus, Loader2, Sparkles, Check, AlertTriangle, RotateCcw } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useJournals } from '../lib/journals'
import { useTradeActions } from '../lib/useTrades'
import { compressImage } from '../lib/image'
import { uploadTradeImages } from '../lib/uploadImages'
import { isSupabaseConfigured } from '../lib/supabase'
import { extractTradeFromImage, type ExtractedTrade } from '../lib/extractTrade'
import { formatMoney, formatR } from '../lib/trades'
import { SESSION_TIMES, LOOKBACKS, lookbackColor } from '../lib/lookback'
import { computePartials, type ExitRow } from '../lib/partials'
import { ExitsField } from '../components/ExitsField'
import { TradeContextFields } from '../components/TradeContextFields'
import { PriceMap } from '../components/PriceMap'
import type { Trade, TradeSide, Liquidity, Zone } from '../types'

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
  const location = useLocation()
  // Return target threaded from the calendar so a saved trade lands back there.
  const backState = (location.state as { backTo?: string; backLabel?: string } | null) ?? null
  const backTo = backState?.backTo ?? '/app/trades'
  const backLabel = backState?.backLabel ?? 'חזרה לעסקאות'
  const [searchParams] = useSearchParams()
  const presetDate = searchParams.get('date') // YYYY-MM-DD, e.g. from the calendar

  const [stage, setStage] = useState<Stage>('idle')
  const [image, setImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mock, setMock] = useState(false)
  const [uncertain, setUncertain] = useState<string[]>([])
  const [confidence, setConfidence] = useState(1)
  const [dragging, setDragging] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    day: presetDate ?? new Date().toISOString().slice(0, 10),
    time: '16:30' as (typeof SESSION_TIMES)[number],
    exactTime: '',
    useExact: false,
    lookback: '',
    symbol: 'MNQ',
    side: 'LONG' as TradeSide,
    entry: '',
    exits: [{ price: '', qty: '' }] as ExitRow[],
    target: '',
    stoploss: '',
    liquidity: null as Liquidity | null,
    zone: null as Zone | null,
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

  // Mark the outcome → fill the FIRST exit's price from the plan: win=target, loss=stop, break-even=entry.
  function markOutcome(kind: 'WIN' | 'LOSS' | 'BE') {
    const price = kind === 'WIN' ? form.target : kind === 'LOSS' ? form.stoploss : form.entry
    setForm((f) => ({ ...f, exits: f.exits.map((r, i) => (i === 0 ? { ...r, price } : r)) }))
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
      exits: [{ price: t.exit != null ? String(t.exit) : '', qty: '' }],
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
  const stopN = num(form.stoploss)
  const calcTime = form.useExact && form.exactTime ? form.exactTime : form.time
  const calc = computePartials({
    entry: entryN,
    side: form.side,
    pv,
    stop: stopN,
    exits: form.exits,
    dateTime: `${form.day}T${calcTime}`,
  })
  const { pnl, rMultiple, status } = calc

  function reset() {
    setStage('idle')
    setImage(null)
    setError(null)
    setUncertain([])
  }

  async function save() {
    if (entryN == null) return setError('צריך מחיר כניסה')
    if (saving) return
    setError(null)
    const id = crypto.randomUUID()
    // Upload the screenshot to Storage (base64 only in demo mode).
    let finalImages: string[] | null = image ? [image] : null
    if (image && isSupabaseConfigured) {
      setSaving(true)
      finalImages = await uploadTradeImages([image], (user?.id as string) ?? 'demo-user', id)
      setSaving(false)
    }
    const payload: Trade = {
      id,
      user_id: (active?.user_id ?? (user?.id as string) ?? 'demo-user'),
      account_id: active.id,
      date: `${form.day}T${calcTime}`,
      symbol: form.symbol,
      market: 'FUTURES',
      side: form.side,
      status,
      qty: calc.totalQty,
      entry: entryN,
      exit: calc.exitLast,
      exits: calc.exitPrices.length ? calc.exitPrices : null,
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
      liquidity: form.liquidity,
      zone: form.zone,
      tags: null,
      notes: form.notes.trim() || null,
      mood: null,
      discipline_score: null,
      executions: calc.executions,
      images: finalImages,
    }
    addTrade(payload)
    navigate(backState?.backTo ?? `/app/trades/${payload.id}`)
  }

  const field = 'flex flex-col gap-1.5'
  const unsure = (name: string) => uncertain.includes(name)
  // Fields the extractor wasn't sure about get a yellow ring + a "בדוק" tag.
  const ring = (name: string) => (unsure(name) ? '!border-[#e9c46a] ring-[3px] ring-[#fdecc8]' : '')
  const Flag = ({ name }: { name: string }) =>
    unsure(name) ? (
      <span className="tag tag-yellow !py-0 !text-[11px] !font-semibold">
        <AlertTriangle className="h-3 w-3" /> בדוק
      </span>
    ) : null
  const choice = (on: boolean, onCls: string) =>
    `h-10 flex-1 rounded-md border text-sm font-medium transition-all active:scale-[0.98] ${
      on ? `${onCls} border-transparent font-semibold` : 'border-border text-[#5f5e5b] hover:bg-surface'
    }`
  const firstExit = form.exits[0]?.price ?? ''
  const activeOutcome: 'WIN' | 'LOSS' | 'BE' | null =
    firstExit === ''
      ? null
      : firstExit === form.target
        ? 'WIN'
        : firstExit === form.stoploss
          ? 'LOSS'
          : firstExit === form.entry
            ? 'BE'
            : null
  const pnlTone = pnl == null ? 'text-faint' : pnl > 0 ? 'text-win' : pnl < 0 ? 'text-loss' : 'text-muted'
  const stepIdx = stage === 'idle' ? 0 : stage === 'extracting' ? 1 : 2
  const confTag = confidence >= 0.8 ? 'tag-green' : confidence >= 0.5 ? 'tag-yellow' : 'tag-red'

  return (
    <div className={stage === 'confirm' ? 'pb-24 lg:pb-0' : ''}>
      <Link to={backTo} className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowRight className="h-4 w-4" /> {backLabel}
      </Link>

      <header className="block-in mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-bg text-[#9065b0] shadow-[0_0_0_1px_#ededeb,0_4px_12px_-6px_rgba(15,15,15,.2)]">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="page-title">עסקה מתמונה</h1>
          <p className="mt-1 text-muted">העלה צילום מסך של העסקה. נמלא את הפרטים אוטומטית, ואתה מאשר. ביומן: {active.name}</p>
        </div>
        {/* Stepper */}
        <ol className="flex items-center gap-2 text-sm" aria-label="שלבים">
          {['העלאה', 'קריאה', 'אישור'].map((label, i) => (
            <li key={label} className="flex items-center gap-2">
              {i > 0 && <span className={`h-px w-6 transition-colors duration-500 ${i <= stepIdx ? 'bg-ink' : 'bg-border'}`} />}
              <span
                aria-current={i === stepIdx ? 'step' : undefined}
                className={`num flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors duration-300 ${
                  i < stepIdx ? 'bg-win text-white' : i === stepIdx ? 'bg-ink text-white' : 'bg-surface text-faint'
                }`}
              >
                {i < stepIdx ? <Check className="h-3.5 w-3.5" /> : i + 1}
              </span>
              <span className={i === stepIdx ? 'font-semibold' : 'text-muted'}>{label}</span>
            </li>
          ))}
        </ol>
      </header>

      {error && stage !== 'confirm' && <p className="mt-4 rounded-md bg-tag-red px-3 py-2 text-sm text-tag-red-fg">{error}</p>}

      {stage === 'idle' && (
        <label
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`block-in group mt-6 flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-6 py-20 text-center transition-all duration-300 ${
            dragging ? 'scale-[1.01] border-accent bg-accent/[0.05]' : 'border-[#d3d1cb] hover:border-accent/50 hover:bg-[#fbfbfa]'
          }`}
          style={{ '--i': 1 } as React.CSSProperties}
        >
          <span
            className={`flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300 ${
              dragging ? '-translate-y-1 bg-accent text-white' : 'bg-surface text-muted group-hover:-translate-y-1 group-hover:text-accent'
            }`}
          >
            <ImagePlus className="h-8 w-8" />
          </span>
          <div className="text-lg font-semibold">{dragging ? 'שחרר כדי להעלות' : 'גרור צילום מסך לכאן'}</div>
          <div className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted">
            <span>או</span>
            <span className="rounded-md border border-border bg-bg px-2 py-0.5 font-medium text-ink">לחץ לבחירה</span>
            <span>או הדבק</span>
            <kbd className="num rounded-md border border-border bg-surface px-1.5 py-0.5 text-[12px] font-semibold text-ink">⌘V</kbd>
          </div>
          <div className="text-[13px] text-faint">צילום מסך של הגרף עם כלי הפוזיציה (כניסה, סטופ ויעד גלויים)</div>
          <input type="file" accept="image/*" className="hidden" onChange={handleFiles} />
        </label>
      )}

      {stage === 'extracting' && (
        <div className="mt-6 flex flex-col items-center gap-4 py-6 text-center">
          {image && (
            <div className="relative overflow-hidden rounded-xl border border-border">
              <img src={image} alt="צילום העסקה בזמן קריאה" className="max-h-80 object-contain" />
              {/* Scanning line */}
              <div className="pointer-events-none absolute inset-x-0 top-0 h-16 animate-[scan_1.6s_ease-in-out_infinite] bg-gradient-to-b from-transparent via-accent/25 to-transparent" />
              <div className="pointer-events-none absolute inset-0 bg-white/20" />
            </div>
          )}
          <div className="flex items-center gap-2 font-semibold">
            <Loader2 className="h-5 w-5 animate-spin text-accent" /> קורא את התמונה…
          </div>
          <div className="text-sm text-muted">מחלץ סימבול, כיוון, כניסה, סטופ ויעד</div>
        </div>
      )}

      {stage === 'confirm' && (
        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
          {/* Image + result side (sticky on desktop) */}
          <div className="flex flex-col gap-3 lg:sticky lg:top-16 lg:self-start">
            <div className="overflow-hidden rounded-[10px] border border-border bg-surface">
              {image && <img src={image} alt="צילום העסקה" className="max-h-[440px] w-full object-contain" />}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className={`tag ${confTag} !py-0.5 !text-[13px] !font-semibold`}>
                <Sparkles className="h-3.5 w-3.5" /> ביטחון החילוץ: <span className="num">{Math.round(confidence * 100)}%</span>
              </span>
              <button onClick={reset} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-muted hover:bg-surface hover:text-ink">
                <RotateCcw className="h-4 w-4" /> תמונה אחרת
              </button>
            </div>
            {mock && (
              <p className="callout !text-[13px]">
                מצב הדגמה: החילוץ הוא דמה. חבר את Supabase + מפתח כדי להפעיל את Claude Vision האמיתי.
              </p>
            )}
            {uncertain.length > 0 && (
              <p className="text-[13px] text-muted">
                שדות שמסומנים ב-<span className="tag tag-yellow !py-0 !text-[11px] !font-semibold">בדוק</span> הם שדות שהמודל לא היה בטוח בהם. כדאי לאמת אותם.
              </p>
            )}

            <div className="panel mt-2 hidden flex-col gap-4 p-5 lg:flex">
              <h2 className="text-[15px] font-semibold">תוצאה · מחושב אוטומטית</h2>
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
              <PriceMap side={form.side} entry={entryN} stop={stopN} target={num(form.target)} exits={calc.exitPrices} />
              {error && <p className="rounded-md bg-tag-red px-3 py-2 text-sm text-tag-red-fg">{error}</p>}
              <button onClick={save} disabled={saving} className="btn-primary w-full !py-2">
                <Check className="h-4 w-4" /> {saving ? 'שומר…' : 'שמור עסקה'}
              </button>
            </div>
          </div>

          {/* Editable fields */}
          <div className="flex flex-col">
            <Section n={1} title="מתי">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <label className={field}>
                  <span className="flex items-center gap-2">
                    <span className="field-label mb-0">תאריך</span>
                    <Flag name="date" />
                  </span>
                  <input type="date" dir="ltr" className={`input ${ring('date')}`} value={form.day} onChange={(e) => set('day', e.target.value)} />
                </label>
                <div className={field}>
                  <span className="flex items-center gap-2">
                    <span className="field-label mb-0">שעה</span>
                    <Flag name="time" />
                  </span>
                  {form.useExact ? (
                    <input type="time" dir="ltr" className="input" value={form.exactTime} onChange={(e) => set('exactTime', e.target.value)} />
                  ) : (
                    <div className="flex gap-2">
                      {SESSION_TIMES.map((tm) => (
                        <button key={tm} type="button" aria-pressed={form.time === tm} onClick={() => setTime(tm)} className={`num ${choice(form.time === tm, 'bg-ink text-white')}`}>
                          {tm}
                        </button>
                      ))}
                    </div>
                  )}
                  <label className="mt-0.5 flex cursor-pointer items-center gap-1.5 text-[13px] text-muted">
                    <input type="checkbox" className="h-4 w-4 accent-[#2383e2]" checked={form.useExact} onChange={(e) => set('useExact', e.target.checked)} />
                    שעה מדויקת מהתמונה
                  </label>
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
            </Section>

            <Section n={2} title="העסקה">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className={`${field} sm:col-span-2`}>
                  <span className="flex items-center gap-2">
                    <span className="field-label mb-0">סימבול</span>
                    <Flag name="symbol" />
                  </span>
                  <div className={`grid grid-cols-6 gap-2 rounded-md ${unsure('symbol') ? 'ring-[3px] ring-[#fdecc8]' : ''}`}>
                    {ASSETS.map((sym) => (
                      <button key={sym} type="button" aria-pressed={form.symbol === sym} onClick={() => set('symbol', sym)} className={choice(form.symbol === sym, 'bg-ink text-white')}>
                        {sym}
                      </button>
                    ))}
                  </div>
                </div>
                <div className={`${field} sm:col-span-2`}>
                  <span className="flex items-center gap-2">
                    <span className="field-label mb-0">כיוון</span>
                    <Flag name="side" />
                  </span>
                  <div className={`flex gap-2 rounded-md ${unsure('side') ? 'ring-[3px] ring-[#fdecc8]' : ''}`}>
                    <button type="button" aria-pressed={form.side === 'LONG'} onClick={() => set('side', 'LONG')} className={choice(form.side === 'LONG', 'bg-tag-blue text-tag-blue-fg')}>
                      Long · לונג
                    </button>
                    <button type="button" aria-pressed={form.side === 'SHORT'} onClick={() => set('side', 'SHORT')} className={choice(form.side === 'SHORT', 'bg-tag-purple text-tag-purple-fg')}>
                      Short · שורט
                    </button>
                  </div>
                </div>
                <label className={field}>
                  <span className="flex items-center gap-2">
                    <span className="field-label mb-0">מחיר כניסה</span>
                    <Flag name="entry" />
                  </span>
                  <input type="number" step="any" dir="ltr" className={`input ${ring('entry')}`} value={form.entry} onChange={(e) => set('entry', e.target.value)} />
                </label>
                <label className={field}>
                  <span className="flex items-center gap-2">
                    <span className="field-label mb-0">סטופ</span>
                    <Flag name="stoploss" />
                  </span>
                  <input type="number" step="any" dir="ltr" className={`input ${ring('stoploss')}`} value={form.stoploss} onChange={(e) => set('stoploss', e.target.value)} />
                </label>
                <label className={`${field} sm:col-span-2`}>
                  <span className="flex items-center gap-2">
                    <span className="field-label mb-0">יעד</span>
                    <Flag name="target" />
                  </span>
                  <input type="number" step="any" dir="ltr" className={`input ${ring('target')}`} value={form.target} onChange={(e) => set('target', e.target.value)} />
                </label>

                <div className={`${field} sm:col-span-2`}>
                  <span className="field-label mb-0">איך העסקה נגמרה? (ממלא את מחיר היציאה הראשונה)</span>
                  <div className="flex gap-2">
                    <button type="button" aria-pressed={activeOutcome === 'WIN'} onClick={() => markOutcome('WIN')} className={choice(activeOutcome === 'WIN', 'bg-tag-green text-tag-green-fg')}>
                      הצליחה · ביעד
                    </button>
                    <button type="button" aria-pressed={activeOutcome === 'LOSS'} onClick={() => markOutcome('LOSS')} className={choice(activeOutcome === 'LOSS', 'bg-tag-red text-tag-red-fg')}>
                      נכשלה · בסטופ
                    </button>
                    <button type="button" aria-pressed={activeOutcome === 'BE'} onClick={() => markOutcome('BE')} className={choice(activeOutcome === 'BE', 'bg-tag-gray text-tag-gray-fg')}>
                      ברייק אוין
                    </button>
                  </div>
                </div>

                <ExitsField value={form.exits} onChange={(rows) => set('exits', rows)} />

                <div className={field}>
                  <span className="field-label mb-0">כמות כוללת (מחושב)</span>
                  <div className="input flex items-center bg-surface num text-muted" dir="ltr">{calc.totalQty || '—'}</div>
                </div>
              </div>
            </Section>

            <Section n={3} title="הקשר והערות">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <TradeContextFields
                  liquidity={form.liquidity}
                  zone={form.zone}
                  onLiquidity={(v) => set('liquidity', v)}
                  onZone={(v) => set('zone', v)}
                />
                <label className={`${field} sm:col-span-2`}>
                  <span className="field-label mb-0">הערות</span>
                  <textarea rows={3} className="input resize-y" value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="אופציונלי" />
                </label>
              </div>
            </Section>

            {/* Phone: result after the form */}
            <section className="panel mt-2 flex flex-col gap-3 p-4 lg:hidden">
              <h2 className="text-[15px] font-semibold">תוצאה · מחושב אוטומטית</h2>
              <PriceMap side={form.side} entry={entryN} stop={stopN} target={num(form.target)} exits={calc.exitPrices} />
              {error && <p className="rounded-md bg-tag-red px-3 py-2 text-sm text-tag-red-fg">{error}</p>}
            </section>
          </div>

          {/* Phone: result + save pinned to the bottom */}
          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:hidden">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <div className={`num text-lg font-bold leading-tight ${pnlTone}`}>{pnl == null ? '—' : formatMoney(pnl)}</div>
                <div className="num text-xs text-muted">{rMultiple == null ? 'R —' : formatR(rMultiple)}</div>
              </div>
              <button onClick={save} disabled={saving} className="btn-primary">
                <Check className="h-4 w-4" /> {saving ? 'שומר…' : 'שמור עסקה'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
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
