import { useEffect, useMemo, useState, type ChangeEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ArrowRight, ClipboardPaste, Upload, Check, AlertTriangle, Pencil, RotateCcw } from 'lucide-react'
import { PageTitle } from '../components/PageTitle'
import { useAuth } from '../lib/auth'
import { useJournals } from '../lib/journals'
import { useTrades, useTradeActions } from '../lib/useTrades'
import { parsePineLogs, pineNotes, pineTags, type PineTrade } from '../lib/pineLog'
import { computePartials } from '../lib/partials'
import { cleanSymbol, formatMoney, formatR } from '../lib/trades'
import { LOOKBACKS } from '../lib/lookback'
import { BIASES, BIAS_FULL_LABEL } from '../lib/bias'
import type { Bias, Liquidity, Trade, Zone } from '../types'

const POINT_VALUE: Record<string, number> = { NQ: 20, ES: 50, MNQ: 2, MES: 5, YM: 5, MYM: 0.5 }
const QTY_KEY = 'pine-import-qty'

const RESULT_TAG: Record<PineTrade['result'], { label: string; cls: string }> = {
  target: { label: 'טרגט', cls: 'tag-green' },
  stop: { label: 'סטופ', cls: 'tag-red' },
  be: { label: 'ברייק-איבן', cls: 'tag-gray' },
  eod: { label: 'נסגר בסוף היום', cls: 'tag-blue' },
  unfilled: { label: 'לא מולא', cls: 'tag-gray' },
  unknown: { label: 'לא ידוע', cls: 'tag-yellow' },
}
const LIQ: { v: Liquidity; label: string }[] = [
  { v: 'buyside', label: 'Buyside' },
  { v: 'sellside', label: 'Sellside' },
  { v: 'none', label: 'לא נלקחה' },
]
const ZONE_LABEL: Record<Zone, string> = { premium: 'Premium', deadzone: 'Deadzone', discount: 'Discount' }

// A report for a trade that's already in the journal never creates a second
// copy. It may only fill fields the existing trade has empty — never overwrite
// what's there, and never touch identity, fills or P&L.
const LOCKED_FIELDS = new Set<string>([
  'id', 'user_id', 'account_id', 'date', 'symbol', 'market', 'side', 'status', 'qty',
  'entry', 'exit', 'exits', 'entry_total', 'exit_total', 'return_amount', 'return_percent',
  'r_multiple', 'hold_time', 'executions', 'images', 'created_at', 'updated_at',
])
const FIELD_LABEL: Record<string, string> = {
  target: 'יעד',
  stoploss: 'סטופ',
  lookback: 'Lookback',
  lookback_size: 'גודל Lookback',
  liquidity: 'נזילות',
  week_of_month: 'שבוע בחודש',
  zone: 'אזור',
  bias: 'ביאס',
  chart_move: 'מהלך גרף',
  tags: 'תגיות',
  notes: 'הערות',
}
const isEmpty = (v: unknown) => v == null || v === '' || (Array.isArray(v) && v.length === 0)

/** Fields the report adds to an existing trade (only ones it has empty). */
function newDataFor(existing: Trade, next: Trade): Partial<Trade> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(next)) {
    if (LOCKED_FIELDS.has(k) || isEmpty(v)) continue
    if (isEmpty((existing as unknown as Record<string, unknown>)[k])) out[k] = v
  }
  return out as Partial<Trade>
}

// Editable copy of a parsed report (numbers as strings for the inputs).
interface Row {
  t: PineTrade
  on: boolean
  existing: Trade | null // already in this journal (same day, session, side, symbol)
  editing: boolean
  entry: string
  stop: string
  target: string
  exit: string
  qty: string
  lookback: string
  bias: Bias | null
  zone: Zone | null
  liquidity: Liquidity | null
}

const str = (n: number | null) => (n == null ? '' : String(n))
const num = (v: string) => {
  const n = Number(v)
  return v.trim() !== '' && Number.isFinite(n) ? n : null
}

function readQty(): string {
  try {
    return localStorage.getItem(QTY_KEY) || '1'
  } catch {
    return '1'
  }
}

export default function PineImport() {
  const { user } = useAuth()
  const { active } = useJournals()
  const { trades } = useTrades()
  const { addTrades, updateTrade } = useTradeActions()
  const navigate = useNavigate()

  const [text, setText] = useState('')
  const [rows, setRows] = useState<Row[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [defQty, setDefQty] = useState(readQty)

  const existingByKey = useMemo(() => {
    const m = new Map<string, Trade>()
    for (const t of trades) {
      const k = `${t.date.slice(0, 16)}|${t.side}|${cleanSymbol(t.symbol)}`
      if (!m.has(k)) m.set(k, t)
    }
    return m
  }, [trades])

  function load(raw: string) {
    setError(null)
    const parsed = parsePineLogs(raw)
    if (!parsed.length) {
      setRows(null)
      setError('לא נמצאו עסקאות בטקסט. ודא שהעתקת את ההודעות מ-Pine Logs (או את קובץ ה-CSV שלהן).')
      return
    }
    setRows(
      parsed.map((t) => {
        const existing = existingByKey.get(`${t.day}T${t.session}|${t.side}|${t.symbol}`) ?? null
        return {
          t,
          on: t.result !== 'unfilled',
          existing,
          editing: false,
          entry: str(t.entry),
          stop: str(t.stop),
          target: str(t.target),
          exit: str(t.exit),
          qty: defQty,
          lookback: t.lookback ?? '',
          bias: t.bias,
          zone: t.zone,
          liquidity: t.liquidity,
        }
      }),
    )
  }

  // Several CSVs at once: a new Replay start clears Pine Logs, so each session is
  // exported separately. Overlapping days collapse in the parser.
  async function onFiles(files: File[]) {
    try {
      const texts = await Promise.all(files.map((f) => f.text()))
      load(texts.join('\n'))
    } catch {
      setError('לא הצלחתי לקרוא את הקבצים')
    }
  }
  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (files.length) onFiles(files)
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files ?? [])
    if (files.length) onFiles(files)
    else {
      const t = e.dataTransfer.getData('text')
      if (t) {
        setText(t)
        load(t)
      }
    }
  }

  // Remember the default contract size between imports.
  useEffect(() => {
    try {
      localStorage.setItem(QTY_KEY, defQty)
    } catch {
      /* private mode — keep the in-memory value */
    }
  }, [defQty])

  function patch(i: number, p: Partial<Row>) {
    setRows((rs) => rs && rs.map((r, j) => (j === i ? { ...r, ...p } : r)))
  }
  function applyQtyToAll(q: string) {
    setDefQty(q)
    setRows((rs) => rs && rs.map((r) => ({ ...r, qty: q })))
  }

  function calcRow(r: Row) {
    const pv = POINT_VALUE[r.t.symbol] ?? 0
    return computePartials({
      entry: num(r.entry),
      side: r.t.side,
      pv,
      stop: num(r.stop),
      exits: r.exit ? [{ price: r.exit, qty: r.qty }] : [],
      dateTime: `${r.t.day}T${r.t.session}`,
    })
  }

  function buildTrades(rs: Row[]): Trade[] {
    return rs.map((r) => {
      const calc = calcRow(r)
      return {
        id: crypto.randomUUID(),
        user_id: active?.user_id ?? (user?.id as string) ?? 'demo-user',
        account_id: active.id,
        date: `${r.t.day}T${r.t.session}`,
        symbol: r.t.symbol,
        market: 'FUTURES',
        side: r.t.side,
        status: calc.status,
        qty: calc.totalQty,
        entry: num(r.entry)!,
        exit: calc.exitLast,
        exits: calc.exitPrices.length ? calc.exitPrices : null,
        target: num(r.target),
        stoploss: num(r.stop),
        entry_total: null,
        exit_total: null,
        return_amount: calc.pnl ?? 0,
        return_percent: null,
        r_multiple: calc.rMultiple,
        hold_time: null,
        confidence: null,
        lookback: r.lookback || null,
        lookback_size: r.t.lookbackSize,
        liquidity: r.liquidity,
        zone: r.zone,
        bias: r.bias,
        chart_move: r.t.chartMove,
        tags: pineTags(r.t),
        notes: pineNotes(r.t),
        mood: null,
        discipline_score: null,
        executions: calc.executions,
        images: null,
      }
    })
  }

  /** For a row already in the journal: what it would add (empty → nothing to do). */
  const updateFor = (r: Row) => (r.existing ? newDataFor(r.existing, buildTrades([r])[0]) : null)

  const selected = rows?.filter((r) => r.on && (!r.existing || Object.keys(updateFor(r)!).length > 0)) ?? []
  const toAdd = selected.filter((r) => !r.existing)
  const toUpdate = selected.filter((r) => r.existing)

  function save() {
    if (!rows || !selected.length) return
    const bad = toAdd.find((r) => num(r.entry) == null)
    if (bad) return setError(`חסר מחיר כניסה בעסקה של ${bad.t.day}`)
    if (toAdd.length) addTrades(buildTrades(toAdd))
    for (const r of toUpdate) updateTrade(r.existing!.id, updateFor(r)!)
    navigate('/app/trades')
  }

  const choice = (on: boolean) =>
    `h-8 flex-1 rounded-md border px-2 text-[13px] font-medium transition-all active:scale-[0.98] ${
      on ? 'border-transparent bg-tag-blue font-semibold text-tag-blue-fg' : 'border-border text-[#5f5e5b] hover:bg-surface'
    }`

  return (
    <div className={rows ? 'pb-24 lg:pb-0' : ''}>
      <Link to="/app/trades" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink">
        <ArrowRight className="h-4 w-4" /> חזרה לעסקאות
      </Link>
      <div className="mt-5">
        <PageTitle
          icon={ClipboardPaste}
          color="#9065b0"
          title="עסקאות מ-Pine Logs"
          subtitle={<>הדבק את ההודעות שהאינדיקטור כתב ב-Pine Logs (או גרור את קובץ ה-CSV שלהן). ביומן: {active.name}</>}
        />
      </div>

      {error && (
        <p className="mt-4 flex items-center gap-2 rounded-md bg-tag-red px-3 py-2 text-sm text-tag-red-fg">
          <AlertTriangle className="h-4 w-4 shrink-0" /> {error}
        </p>
      )}

      {!rows && (
        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={`block-in mt-6 flex flex-col gap-3 rounded-xl border-2 border-dashed p-4 transition-colors ${
            dragging ? 'border-accent bg-accent/[0.05]' : 'border-[#d3d1cb]'
          }`}
        >
          <textarea
            dir="rtl"
            rows={12}
            className="input min-h-[240px] resize-y font-mono !text-[13px] leading-relaxed"
            placeholder={'הדבק כאן (⌘V) את ההודעות מ-Pine Logs…\n\n══════════════════════════\n📝 LONG 16:30 · 23.9.2026\nתאריך: 23.9.2026\n…'}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onPaste={(e) => {
              const t = e.clipboardData.getData('text')
              if (t) {
                e.preventDefault()
                setText(t)
                load(t)
              }
            }}
          />
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={() => load(text)} disabled={!text.trim()} className="btn-primary">
              <ClipboardPaste className="h-4 w-4" /> קרא עסקאות
            </button>
            <label className="btn-ghost cursor-pointer">
              <Upload className="h-4 w-4" /> קבצי CSV מ-Pine Logs
              <input type="file" multiple accept=".csv,.txt,text/csv,text/plain" className="hidden" onChange={handleFile} />
            </label>
            <span className="text-[13px] text-faint">אפשר לגרור כמה קבצי CSV יחד (אחד מכל סשן Replay). ימים שחוזרים על עצמם מאוחדים אוטומטית.</span>
          </div>
        </div>
      )}

      {rows && (
        <div className="mt-6 flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm">
              <span className="text-muted">חוזים לעסקה</span>
              <input
                type="number"
                min={1}
                step={1}
                dir="ltr"
                className="input !h-9 w-20"
                value={defQty}
                onChange={(e) => applyQtyToAll(e.target.value)}
              />
            </label>
            <span className="text-[13px] text-faint">האינדיקטור לא יודע כמה חוזים — הרווח בדולרים מחושב לפי המספר הזה.</span>
            <div className="flex-1" />
            <button
              onClick={() => {
                setRows(null)
                setError(null)
              }}
              className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-muted hover:bg-surface hover:text-ink"
            >
              <RotateCcw className="h-4 w-4" /> הדבקה אחרת
            </button>
          </div>

          {rows.map((r, i) => {
            const calc = calcRow(r)
            const adds = updateFor(r)
            const addLabels = adds ? Object.keys(adds).map((k) => FIELD_LABEL[k] ?? k) : []
            const locked = r.existing != null && addLabels.length === 0
            const on = r.on && !locked
            const res = RESULT_TAG[r.t.result]
            const pnlTone = calc.pnl == null ? 'text-faint' : calc.pnl > 0 ? 'text-win' : calc.pnl < 0 ? 'text-loss' : 'text-muted'
            return (
              <section
                key={r.t.key}
                className={`panel block-in flex flex-col gap-3 p-4 transition-opacity ${on ? '' : 'opacity-60'}`}
                style={{ '--i': Math.min(i + 1, 8) } as React.CSSProperties}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[#2383e2]"
                    checked={on}
                    disabled={locked}
                    onChange={(e) => patch(i, { on: e.target.checked })}
                    aria-label={r.existing ? 'לעדכן את העסקה הקיימת' : 'לשמור את העסקה הזו'}
                  />
                  <span className="num font-semibold" dir="ltr">
                    {r.t.day.split('-').reverse().join('.')}
                  </span>
                  <span className="num tag">{r.t.session}</span>
                  <span className={`tag ${r.t.side === 'LONG' ? 'tag-blue' : 'tag-purple'} !font-semibold`}>{r.t.side}</span>
                  <span className="tag">{r.t.symbol}</span>
                  <span className={`tag ${res.cls} !font-semibold`}>
                    {res.label}
                    {r.t.resultPts != null && <span className="num" dir="ltr">{r.t.resultPts > 0 ? '+' : ''}{r.t.resultPts}</span>}
                  </span>
                  {r.existing &&
                    (locked ? (
                      <span className="tag tag-yellow !font-semibold">כבר ביומן · אין נתון חדש</span>
                    ) : (
                      <span className="tag tag-blue !font-semibold">כבר ביומן · יתעדכן: {addLabels.join(', ')}</span>
                    ))}
                  <div className="flex-1" />
                  <span className={`num text-lg font-bold ${pnlTone}`}>{calc.pnl == null ? '—' : formatMoney(calc.pnl)}</span>
                  <span className="num text-sm text-muted">{formatR(calc.rMultiple)}</span>
                </div>

                <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-sm sm:grid-cols-4">
                  <Info label="כניסה" value={r.entry} ltr />
                  <Info label="סטופ" value={r.stop} ltr />
                  <Info label="יעד" value={r.target} ltr />
                  <Info label="יציאה" value={r.exit || '—'} ltr />
                  <Info label="Lookback" value={r.lookback || '—'} ltr />
                  <Info label="מילוי" value={r.t.fillTime ?? '—'} ltr />
                  <Info label="אזור" value={r.zone ? ZONE_LABEL[r.zone] : '—'} />
                  <Info label="סוג יום" value={r.t.dayKind || '—'} />
                  <div className="col-span-2 sm:col-span-4">
                    <Info label="ביאס" value={r.bias ? BIAS_FULL_LABEL[r.bias] : '—'} />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <span className="flex items-center gap-2 text-[12px] text-muted">
                    נזילות שנלקחה
                    {r.t.liquidityGuessed && (
                      <span className="tag tag-yellow !py-0 !text-[11px] !font-semibold" title={r.t.liqRaw}>
                        <AlertTriangle className="h-3 w-3" /> שני הצדדים נלקחו — נבחר לפי הכיוון, בדוק
                      </span>
                    )}
                  </span>
                  <div className="flex gap-2">
                    {LIQ.map((o) => (
                      <button
                        key={o.v}
                        type="button"
                        aria-pressed={r.liquidity === o.v}
                        onClick={() => patch(i, { liquidity: r.liquidity === o.v ? null : o.v })}
                        className={choice(r.liquidity === o.v)}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>

                {r.t.warnings.length > 0 && (
                  <p className="flex items-center gap-2 rounded-md bg-tag-yellow px-3 py-1.5 text-[13px] text-tag-yellow-fg">
                    <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {r.t.warnings.join(' · ')}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => patch(i, { editing: !r.editing })}
                  className="inline-flex items-center gap-1 self-start text-[13px] text-muted hover:text-ink"
                >
                  <Pencil className="h-3.5 w-3.5" /> {r.editing ? 'סגור עריכה' : 'עריכה'}
                </button>

                {r.editing && (
                  <div className="grid grid-cols-2 gap-3 border-t border-border pt-3 sm:grid-cols-4">
                    <Edit label="כניסה" value={r.entry} onChange={(v) => patch(i, { entry: v })} />
                    <Edit label="סטופ" value={r.stop} onChange={(v) => patch(i, { stop: v })} />
                    <Edit label="יעד" value={r.target} onChange={(v) => patch(i, { target: v })} />
                    <Edit label="יציאה" value={r.exit} onChange={(v) => patch(i, { exit: v })} />
                    <Edit label="חוזים" value={r.qty} onChange={(v) => patch(i, { qty: v })} />
                    <label className="flex flex-col gap-1">
                      <span className="text-[12px] text-muted">Lookback</span>
                      <select className="input !h-9" value={r.lookback} onChange={(e) => patch(i, { lookback: e.target.value })}>
                        <option value="">—</option>
                        {LOOKBACKS[r.t.session].map((lb) => (
                          <option key={lb} value={lb}>{lb}</option>
                        ))}
                      </select>
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[12px] text-muted">אזור</span>
                      <select className="input !h-9" value={r.zone ?? ''} onChange={(e) => patch(i, { zone: (e.target.value || null) as Zone | null })}>
                        <option value="">—</option>
                        {(Object.keys(ZONE_LABEL) as Zone[]).map((z) => (
                          <option key={z} value={z}>{ZONE_LABEL[z]}</option>
                        ))}
                      </select>
                    </label>
                    <label className="col-span-2 flex flex-col gap-1 sm:col-span-4">
                      <span className="text-[12px] text-muted">ביאס (זוג HTF)</span>
                      <select className="input !h-9" value={r.bias ?? ''} onChange={(e) => patch(i, { bias: (e.target.value || null) as Bias | null })}>
                        <option value="">—</option>
                        {BIASES.map((b) => (
                          <option key={b.v} value={b.v}>{b.desc} · {b.label}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                )}
              </section>
            )
          })}

          <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-bg/95 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-3 backdrop-blur lg:static lg:border-0 lg:bg-transparent lg:p-0">
            <button onClick={save} disabled={!selected.length} className="btn-primary w-full !py-2 lg:w-auto">
              <Check className="h-4 w-4" />
              {toAdd.length > 0 && `שמור ${toAdd.length} ${toAdd.length === 1 ? 'עסקה' : 'עסקאות'} ליומן`}
              {toAdd.length > 0 && toUpdate.length > 0 && ' · '}
              {toUpdate.length > 0 && `עדכן ${toUpdate.length} ${toUpdate.length === 1 ? 'קיימת' : 'קיימות'}`}
              {!selected.length && 'אין מה לשמור'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Info({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <div className="flex min-w-0 items-baseline gap-1.5">
      <span className="shrink-0 text-[12px] text-muted">{label}</span>
      <span className={`truncate font-medium ${ltr ? 'num' : ''}`} dir={ltr ? 'ltr' : undefined}>
        {value}
      </span>
    </div>
  )
}

function Edit({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] text-muted">{label}</span>
      <input type="number" step="any" dir="ltr" className="input !h-9" value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}
