import { useEffect, useState } from 'react'
import { Check, Copy, Link2, Loader2, PlugZap, Trash2, AlertTriangle } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useJournals } from '../lib/journals'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

// TradingView → journal webhook: each user gets one secret link per journal.
// The indicator's alert() posts its Pine-Logs report there and the
// `pine-webhook` Edge Function turns it into a trade in this journal.

interface Tok {
  token: string
  qty: number
}

// A finished trade dated 1.1.2000 — sent by "בדיקת חיבור" and deleted right after.
const TEST_REPORT = `══════════════════════════
📝 LONG 16:30 · 1.1.2000
תאריך: 1.1.2000
שעת כניסה: 16:35
בייס: 6H (גוף) + 3H (גוף)
Lookback: LB 16:30 30ד גוף
סימבול: MNQ1!
כיוון: LONG
מחיר כניסה: 100.00
סטופ: 20.00 נק' (80.00)
מחיר יציאה: 160.00 (1:3)
תוצאה: ✅ טרגט +60.00`

export function TradingViewLink() {
  const { user } = useAuth()
  const { active } = useJournals()
  const [tok, setTok] = useState<Tok | null | undefined>(undefined) // undefined = loading
  const [qty, setQty] = useState('1')
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState(false)
  const [test, setTest] = useState<'idle' | 'running' | 'ok' | 'fail'>('idle')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setTest('idle')
    setError(null)
    if (!isSupabaseConfigured || !user || !active?.id) {
      setTok(null)
      return
    }
    setTok(undefined)
    supabase
      .from('webhook_tokens')
      .select('token, qty')
      .eq('user_id', user.id)
      .eq('account_id', active.id)
      .maybeSingle()
      .then(({ data, error: e }) => {
        if (e) setError(e.message)
        setTok((data as Tok | null) ?? null)
        if (data) setQty(String((data as Tok).qty))
      })
  }, [user?.id, active?.id])

  const url = tok ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pine-webhook?token=${tok.token}` : ''

  async function create() {
    if (!user) return
    setBusy(true)
    setError(null)
    const { data, error: e } = await supabase
      .from('webhook_tokens')
      .insert({ user_id: user.id, account_id: active.id, qty: Number(qty) || 1 })
      .select('token, qty')
      .single()
    setBusy(false)
    if (e) return setError(e.message)
    setTok(data as Tok)
  }

  async function saveQty(v: string) {
    setQty(v)
    const n = Number(v)
    if (!tok || !Number.isFinite(n) || n <= 0) return
    const { error: e } = await supabase.from('webhook_tokens').update({ qty: n }).eq('token', tok.token)
    if (e) setError(e.message)
  }

  async function revoke() {
    if (!tok || !confirm('לבטל את הקישור? התראות שכבר הוגדרו ב-TradingView יפסיקו להכניס עסקאות.')) return
    setBusy(true)
    const { error: e } = await supabase.from('webhook_tokens').delete().eq('token', tok.token)
    setBusy(false)
    if (e) return setError(e.message)
    setTok(null)
    setTest('idle')
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('ההעתקה נחסמה — סמן את הקישור והעתק ידנית')
    }
  }

  async function runTest() {
    setTest('running')
    setError(null)
    try {
      const res = await fetch(url, { method: 'POST', body: TEST_REPORT })
      const body = (await res.json()) as { ok?: boolean; error?: string }
      await supabase.from('trades').delete().eq('account_id', active.id).eq('date', '2000-01-01T16:30')
      if (!res.ok || !body.ok) throw new Error(body.error ?? `HTTP ${res.status}`)
      setTest('ok')
    } catch (e) {
      setTest('fail')
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  if (!isSupabaseConfigured) {
    return <p className="text-sm text-muted">זמין רק כשהיומן מחובר לענן.</p>
  }
  if (tok === undefined) {
    return <Loader2 className="h-4 w-4 animate-spin text-muted" />
  }

  return (
    <div className="flex flex-col gap-3">
      {!tok ? (
        <button onClick={create} disabled={busy} className="btn-primary self-start">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
          צור קישור ליומן "{active.name}"
        </button>
      ) : (
        <>
          <div className="flex gap-2">
            <input className="input min-w-0 flex-1 bg-surface !text-[12px] text-muted" dir="ltr" value={url} readOnly onFocus={(e) => e.target.select()} />
            <button onClick={copy} className="btn-ghost shrink-0">
              {copied ? <Check className="h-4 w-4 text-win" /> : <Copy className="h-4 w-4" />}
              {copied ? 'הועתק' : 'העתק'}
            </button>
          </div>
          <p className="flex items-start gap-1.5 text-[12px] text-faint">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            הקישור הזה הוא המפתח ליומן — כל מי שיש לו אותו יכול להכניס אליו עסקאות. אל תשתף אותו.
          </p>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted">חוזים לכל עסקה</span>
            <input type="number" min={1} step={1} dir="ltr" className="input !h-9 w-20" value={qty} onChange={(e) => saveQty(e.target.value)} />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <button onClick={runTest} disabled={test === 'running'} className="btn-ghost">
              {test === 'running' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
              בדיקת חיבור
            </button>
            {test === 'ok' && (
              <span className="flex items-center gap-1 text-sm font-medium text-win">
                <Check className="h-4 w-4" /> החיבור עובד
              </span>
            )}
            <div className="flex-1" />
            <button onClick={revoke} disabled={busy} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-sm text-muted hover:bg-tag-red hover:text-loss">
              <Trash2 className="h-4 w-4" /> בטל קישור
            </button>
          </div>
          <ol className="list-decimal space-y-1 pr-5 text-sm leading-relaxed text-muted">
            <li>העתק את הקישור.</li>
            <li>ב-TradingView, על הגרף עם האינדיקטור: לחץ על השעון (Alert) ← Condition: <b className="text-ink">full auto NOD indicator</b> ← <b className="text-ink">Any alert() function call</b>.</li>
            <li>בלשונית Notifications סמן <b className="text-ink">Webhook URL</b> והדבק את הקישור.</li>
            <li>תוקף: <b className="text-ink">Open-ended</b>. שמור. מעכשיו כל עסקה שנסגרת בלייב נכנסת ליומן לבד.</li>
          </ol>
        </>
      )}
      {error && <p className="rounded-md bg-tag-red px-3 py-2 text-sm text-tag-red-fg">{error}</p>}
    </div>
  )
}
