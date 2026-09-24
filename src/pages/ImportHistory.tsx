import { useEffect, useState } from 'react'
import { Download, Loader2, Check, AlertTriangle, Image as ImageIcon } from 'lucide-react'
import { PageTitle } from '../components/PageTitle'
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

  const header = (
    <PageTitle
      icon={Download}
      color="#787774"
      title="ייבוא היסטוריה"
      subtitle="הבא את העסקאות והצילומים הקיימים שלך אל היומן בענן."
    />
  )

  if (!isSupabaseConfigured) {
    return (
      <div>
        {header}
        <div className="callout mt-6">ייבוא זמין רק כשמחוברים ל-Supabase.</div>
      </div>
    )
  }

  const busy = phase === 'loading' || phase === 'importing'

  return (
    <div className="max-w-2xl">
      {header}

      <div className="mt-6 flex flex-col gap-4">
        {/* Step 1 · Trades */}
        <section className="panel block-in flex flex-col gap-4 p-5" style={{ '--i': 1 } as React.CSSProperties}>
          <div className="flex items-start gap-3">
            <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface text-sm font-bold text-muted">1</span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[17px] font-semibold">עסקאות</h2>
              <div className="mt-0.5 flex flex-wrap items-center gap-2 text-sm text-muted">
                <span>
                  ליומן: <span className="font-medium text-ink">{active.name}</span>
                </span>
                {cloudCount !== null && (
                  <span className="tag">
                    בענן: <span className="num font-semibold">{cloudCount}</span>
                  </span>
                )}
              </div>
            </div>
            {phase === 'done' && <span className="tag tag-green !font-semibold"><Check className="h-3.5 w-3.5" /> הושלם</span>}
          </div>

          {cloudCount !== null && cloudCount > 0 && phase === 'idle' && (
            <div className="flex items-start gap-2 rounded-md bg-tag-yellow px-3 py-2.5 text-sm text-tag-yellow-fg">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>כבר יש {cloudCount} עסקאות ביומן. ייבוא נוסף עלול ליצור כפילויות.</span>
            </div>
          )}
          {phase === 'importing' && <Progress label="מייבא עסקאות…" value={progress} total={total} />}
          {phase === 'done' && <Success text={`הייבוא הושלם: ${total} עסקאות נוספו.`} />}
          {error && <ErrorLine text={error} />}

          <button onClick={runImport} disabled={busy} className="btn-ghost self-start">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {busy ? 'מייבא…' : 'ייבא עסקאות'}
          </button>
        </section>

        {/* Step 2 · Screenshots */}
        <section className="panel block-in flex flex-col gap-4 p-5" style={{ '--i': 2 } as React.CSSProperties}>
          <div className="flex items-start gap-3">
            <span className="num flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface text-sm font-bold text-muted">2</span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[17px] font-semibold">צילומי מסך היסטוריים</h2>
              <p className="mt-0.5 text-sm text-muted">מעלה את הצילומים לאחסון בענן ומקשר כל אחד לעסקה שלו.</p>
            </div>
            {imgPhase === 'done' && <span className="tag tag-green !font-semibold"><Check className="h-3.5 w-3.5" /> הושלם</span>}
          </div>

          {imgPhase === 'working' && <Progress label="מעלה צילומים…" value={imgProgress} total={imgTotal} />}
          {imgPhase === 'done' && <Success text={`הועלו ${imgProgress} צילומים. רענן את העסקאות כדי לראות אותם.`} />}
          {imgError && <ErrorLine text={imgError} />}

          <button onClick={migrateImages} disabled={imgPhase === 'working'} className="btn-primary self-start">
            {imgPhase === 'working' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageIcon className="h-4 w-4" />}
            {imgPhase === 'working' ? 'מעלה…' : 'העלה צילומי מסך'}
          </button>
          <p className="text-[12px] text-faint">
            יש להריץ פעם אחת מהמחשב שבו נמצאים הצילומים (localhost). ההעלאה עשויה לקחת כמה דקות.
          </p>
        </section>
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
      <div className="h-1.5 overflow-hidden rounded-full bg-[#efeeec]">
        <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${total ? (value / total) * 100 : 0}%` }} />
      </div>
    </div>
  )
}

function Success({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-tag-green px-3 py-2.5 text-sm text-tag-green-fg">
      <Check className="h-4 w-4" /> {text}
    </div>
  )
}

function ErrorLine({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-tag-red px-3 py-2.5 text-sm text-tag-red-fg">
      <AlertTriangle className="h-4 w-4" /> {text}
    </div>
  )
}
