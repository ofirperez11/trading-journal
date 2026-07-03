import { useEffect, useState } from 'react'
import { Download, Loader2, Check, AlertTriangle, Image as ImageIcon } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useJournals } from '../lib/journals'
import { toDbRow } from '../lib/useTrades'
import { normalizeTrade } from '../lib/trades'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import type { Trade } from '../types'

type Phase = 'idle' | 'loading' | 'importing' | 'done' | 'error'
type ImgPhase = 'idle' | 'working' | 'done' | 'error'

const TEN_YEARS = 315360000

// A stable fingerprint to match a bundled trade to its imported DB row
// (the DB rows got fresh uuids on import). Uses only direct columns.
function sig(t: Trade): string {
  return [t.date.slice(0, 16), t.symbol, t.side, t.qty, t.return_amount, t.stoploss ?? '', t.target ?? ''].join('|')
}

export default function ImportHistory() {
  const { user } = useAuth()
  const { active } = useJournals()

  const [phase, setPhase] = useState<Phase>('idle')
  const [cloudCount, setCloudCount] = useState<number | null>(null)
  const [progress, setProgress] = useState(0)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState<string | null>(null)

  const [imgPhase, setImgPhase] = useState<ImgPhase>('idle')
  const [imgProgress, setImgProgress] = useState(0)
  const [imgTotal, setImgTotal] = useState(0)
  const [imgError, setImgError] = useState<string | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    supabase
      .from('trades')
      .select('id', { count: 'exact', head: true })
      .eq('account_id', active.id)
      .then(({ count }) => setCloudCount(count ?? 0))
  }, [active.id])

  async function runImport() {
    if (!user) return
    setError(null)
    setPhase('loading')
    try {
      const res = await fetch('/demo/trades.json')
      if (!res.ok) throw new Error('לא הצלחתי לטעון את קובץ ההיסטוריה')
      const raw = (await res.json()) as Record<string, unknown>[]
      const rows = raw.map((r) => {
        const { id: _id, images: _img, ...rest } = normalizeTrade(r)
        void _id
        void _img
        return { ...toDbRow(rest), user_id: user.id, account_id: active.id, images: null }
      })
      setTotal(rows.length)
      setProgress(0)
      setPhase('importing')
      const BATCH = 50
      for (let i = 0; i < rows.length; i += BATCH) {
        const chunk = rows.slice(i, i + BATCH)
        const { error: insErr } = await supabase.from('trades').insert(chunk)
        if (insErr) throw new Error(insErr.message)
        setProgress(Math.min(i + chunk.length, rows.length))
      }
      setCloudCount((c) => (c ?? 0) + rows.length)
      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setPhase('error')
    }
  }

  async function migrateImages() {
    if (!user) return
    setImgError(null)
    setImgPhase('working')
    try {
      // 1. Bundled trades that carry screenshots.
      const res = await fetch('/demo/trades.json')
      if (!res.ok) throw new Error('לא הצלחתי לטעון את קובץ ההיסטוריה (יש להריץ מקומית)')
      const rawTrades = (await res.json()) as Record<string, unknown>[]
      const bundled = rawTrades.map(normalizeTrade).filter((t) => t.images && t.images.length)

      // 2. Map each DB trade's signature → id (multi, to handle identical trades).
      const { data: dbRows, error: dbErr } = await supabase.from('trades').select('*').eq('account_id', active.id)
      if (dbErr) throw new Error(dbErr.message)
      const idsBySig = new Map<string, string[]>()
      for (const r of dbRows ?? []) {
        const t = normalizeTrade(r as Record<string, unknown>)
        const k = sig(t)
        const arr = idsBySig.get(k) ?? []
        arr.push(t.id)
        idsBySig.set(k, arr)
      }

      const targets = bundled.filter((t) => (idsBySig.get(sig(t))?.length ?? 0) > 0)
      setImgTotal(targets.length)
      setImgProgress(0)

      let done = 0
      for (const t of targets) {
        const tradeId = idsBySig.get(sig(t))!.shift()! // consume one id
        const urls: string[] = []
        for (const path of t.images ?? []) {
          const imgRes = await fetch(`/demo/${path}`)
          if (!imgRes.ok) continue
          const blob = await imgRes.blob()
          const filename = path.split('/').pop() || `${crypto.randomUUID()}.webp`
          const storagePath = `${user.id}/${tradeId}/${filename}`
          const { error: upErr } = await supabase.storage
            .from('trade-images')
            .upload(storagePath, blob, { contentType: blob.type || 'image/webp', upsert: true })
          if (upErr) throw new Error(`העלאה נכשלה: ${upErr.message}`)
          const { data: signed, error: signErr } = await supabase.storage
            .from('trade-images')
            .createSignedUrl(storagePath, TEN_YEARS)
          if (signErr) throw new Error(`יצירת קישור נכשלה: ${signErr.message}`)
          urls.push(signed.signedUrl)
        }
        if (urls.length) {
          const { error: updErr } = await supabase.from('trades').update({ images: urls }).eq('id', tradeId)
          if (updErr) throw new Error(updErr.message)
        }
        done += 1
        setImgProgress(done)
      }
      setImgPhase('done')
    } catch (e) {
      setImgError(e instanceof Error ? e.message : String(e))
      setImgPhase('error')
    }
  }

  if (!isSupabaseConfigured) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">ייבוא</h1>
        <div className="card text-muted">ייבוא זמין רק כשמחוברים ל-Supabase.</div>
      </div>
    )
  }

  const busy = phase === 'loading' || phase === 'importing'

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold">ייבוא היסטוריה</h1>
        <p className="text-muted">הבא את העסקאות והצילומים הקיימים שלך אל היומן בענן.</p>
      </div>

      {/* Trades */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <Download className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold">עסקאות</div>
            <div className="text-sm text-muted">
              היומן הפעיל: <span className="text-ink">{active.name}</span>
              {cloudCount !== null && <> · בענן: <span className="num text-ink">{cloudCount}</span></>}
            </div>
          </div>
        </div>

        {cloudCount !== null && cloudCount > 0 && phase === 'idle' && (
          <div className="flex items-start gap-2 rounded-lg border border-accent/30 bg-accent/10 p-3 text-sm text-accent">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>כבר יש {cloudCount} עסקאות ביומן. ייבוא נוסף עלול ליצור כפילויות.</span>
          </div>
        )}
        {phase === 'importing' && (
          <Progress label="מייבא עסקאות…" value={progress} total={total} />
        )}
        {phase === 'done' && <Success text={`הייבוא הושלם — ${total} עסקאות נוספו.`} />}
        {error && <ErrorLine text={error} />}

        <button onClick={runImport} disabled={busy} className="btn-ghost w-full justify-center">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          {busy ? 'מייבא…' : 'ייבא עסקאות'}
        </button>
      </div>

      {/* Screenshots */}
      <div className="card space-y-4">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent/15 text-accent">
            <ImageIcon className="h-5 w-5" />
          </div>
          <div>
            <div className="font-semibold">צילומי מסך היסטוריים</div>
            <div className="text-sm text-muted">מעלה את הצילומים לאחסון בענן ומקשר לכל עסקה.</div>
          </div>
        </div>

        {imgPhase === 'working' && <Progress label="מעלה צילומים…" value={imgProgress} total={imgTotal} />}
        {imgPhase === 'done' && (
          <Success text={`הועלו ${imgProgress} צילומים. רענן את העסקאות כדי לראות אותם.`} />
        )}
        {imgError && <ErrorLine text={imgError} />}

        <button
          onClick={migrateImages}
          disabled={imgPhase === 'working'}
          className="btn-primary w-full justify-center"
        >
          {imgPhase === 'working' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
          {imgPhase === 'working' ? 'מעלה…' : 'העלה צילומי מסך'}
        </button>
        <p className="text-xs text-muted">
          יש להריץ פעם אחת מהמחשב שבו נמצאים הצילומים (localhost). ההעלאה עשויה לקחת כמה דקות.
        </p>
      </div>
    </div>
  )
}

function Progress({ label, value, total }: { label: string; value: number; total: number }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-sm">
        <span className="text-muted">{label}</span>
        <span className="num">{value} / {total}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${total ? (value / total) * 100 : 0}%` }} />
      </div>
    </div>
  )
}

function Success({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-win/30 bg-win/10 p-3 text-sm text-win">
      <Check className="h-4 w-4" /> {text}
    </div>
  )
}

function ErrorLine({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-loss/30 bg-loss/10 p-3 text-sm text-loss">
      <AlertTriangle className="h-4 w-4" /> {text}
    </div>
  )
}
