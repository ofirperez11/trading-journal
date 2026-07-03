import { useState } from 'react'
import { Check, Loader2, LogOut, User, ShieldCheck } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useJournals } from '../lib/journals'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

export default function Settings() {
  const { user, signOut, isDemo } = useAuth()
  const { journals } = useJournals()

  const initialName = (user?.user_metadata?.display_name as string | undefined) ?? user?.email?.split('@')[0] ?? ''
  const [name, setName] = useState(initialName)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function saveProfile() {
    setError(null)
    setSaving(true)
    if (isSupabaseConfigured && user) {
      const { error: err } = await supabase.auth.updateUser({ data: { display_name: name.trim() } })
      if (!err) await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', user.id)
      setSaving(false)
      if (err) { setError(err.message); return }
    } else {
      setSaving(false)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const field = 'flex flex-col gap-1.5'

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">הגדרות</h1>
        <p className="text-muted">פרופיל וחשבון.</p>
      </div>

      {/* Profile */}
      <div className="card space-y-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-lg font-semibold uppercase text-white">
            {(name || 'T').slice(0, 1)}
          </div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <User className="h-4 w-4 text-muted" /> פרופיל
          </div>
        </div>

        <label className={field}>
          <span className="field-label mb-0">שם תצוגה</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="איך לקרוא לך?" />
        </label>
        <label className={field}>
          <span className="field-label mb-0">אימייל</span>
          <input className="input opacity-60" dir="ltr" value={user?.email ?? ''} readOnly />
        </label>

        {error && <p className="text-sm text-loss">{error}</p>}

        <div className="flex items-center gap-3">
          <button onClick={saveProfile} disabled={saving || !name.trim()} className="btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            שמור
          </button>
          {saved && <span className="text-sm text-win">נשמר ✓</span>}
        </div>
      </div>

      {/* Account */}
      <div className="card space-y-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <ShieldCheck className="h-4 w-4 text-muted" /> חשבון
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">סטטוס</span>
          <span className={isDemo ? 'text-accent' : 'text-win'}>{isDemo ? 'מצב הדגמה' : 'מחובר לענן'}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted">יומנים</span>
          <span className="num text-ink">{journals.length}</span>
        </div>
        <div className="border-t border-black/[0.08] pt-4">
          <button
            onClick={signOut}
            className="btn inline-flex border border-loss/40 bg-loss/[0.06] text-loss hover:bg-loss/10"
          >
            <LogOut className="h-4 w-4" /> התנתק
          </button>
        </div>
      </div>
    </div>
  )
}
