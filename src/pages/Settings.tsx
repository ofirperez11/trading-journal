import { useState } from 'react'
import { Check, Loader2, LogOut, Download, Settings as SettingsIcon } from 'lucide-react'
import { PageTitle } from '../components/PageTitle'
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
  const [exporting, setExporting] = useState(false)

  async function exportBackup() {
    if (!isSupabaseConfigured || !user) return
    setExporting(true)
    try {
      const [t, a, j] = await Promise.all([
        supabase.from('trades').select('*'),
        supabase.from('accounts').select('*'),
        supabase.from('journal_entries').select('*'),
      ])
      const payload = {
        exportedAt: new Date().toISOString(),
        user: user.email,
        trades: t.data ?? [],
        accounts: a.data ?? [],
        journal_entries: j.data ?? [],
      }
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
      const href = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = href
      link.download = `trading-journal-backup-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(href)
    } finally {
      setExporting(false)
    }
  }

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

  const row = 'grid grid-cols-1 items-center gap-2 border-b border-[#f1f0ed] py-3.5 last:border-0 sm:grid-cols-[180px_minmax(0,1fr)]'

  return (
    <div className="max-w-2xl">
      <PageTitle icon={SettingsIcon} color="#787774" title="הגדרות" subtitle="פרופיל, גיבוי וחשבון." />

      {/* Profile */}
      <section className="block-in mt-8" style={{ '--i': 1 } as React.CSSProperties}>
        <h2 className="mb-1 text-[17px] font-semibold">פרופיל</h2>
        <div className="flex flex-col">
          <div className={row}>
            <span className="text-sm text-muted">תמונה</span>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-ink text-base font-bold text-white">
              {(name || 'T').slice(0, 1)}
            </span>
          </div>
          <label className={row}>
            <span className="text-sm text-muted">שם תצוגה</span>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="איך לקרוא לך?" />
          </label>
          <label className={row}>
            <span className="text-sm text-muted">אימייל</span>
            <input className="input bg-surface text-muted" dir="ltr" value={user?.email ?? ''} readOnly />
          </label>
        </div>
        {error && <p className="mt-2 rounded-md bg-tag-red px-3 py-2 text-sm text-tag-red-fg">{error}</p>}
        <div className="mt-3 flex items-center gap-3">
          <button onClick={saveProfile} disabled={saving || !name.trim()} className="btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            שמור
          </button>
          {saved && (
            <span className="flex animate-[fade-up_.3s_ease_both] items-center gap-1 text-sm font-medium text-win">
              <Check className="h-4 w-4" /> נשמר
            </span>
          )}
        </div>
      </section>

      {/* Backup */}
      <section className="block-in mt-10 border-t border-border pt-6" style={{ '--i': 2 } as React.CSSProperties}>
        <h2 className="mb-1 text-[17px] font-semibold">גיבוי נתונים</h2>
        <p className="text-sm leading-relaxed text-muted">
          הורד קובץ עם כל העסקאות, היומנים והרשומות שלך: נקודת שחזור מקומית. מומלץ לעשות את זה מדי פעם.
          בנוסף מתבצע גיבוי אוטומטי יומי בענן.
        </p>
        <button onClick={exportBackup} disabled={exporting || !isSupabaseConfigured} className="btn-ghost mt-3">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          ייצוא גיבוי (JSON)
        </button>
      </section>

      {/* Account */}
      <section className="block-in mt-10 border-t border-border pt-6" style={{ '--i': 3 } as React.CSSProperties}>
        <h2 className="mb-1 text-[17px] font-semibold">חשבון</h2>
        <div className="flex flex-col">
          <div className={row}>
            <span className="text-sm text-muted">סטטוס</span>
            <span>
              <span className={`tag ${isDemo ? 'tag-yellow' : 'tag-green'}`}>{isDemo ? 'מצב הדגמה' : 'מחובר לענן'}</span>
            </span>
          </div>
          <div className={row}>
            <span className="text-sm text-muted">יומנים</span>
            <span className="num text-sm font-semibold">{journals.length}</span>
          </div>
        </div>
        <button onClick={signOut} className="btn mt-3 border border-[#f3c9c1] text-loss hover:bg-tag-red">
          <LogOut className="h-4 w-4" /> התנתק
        </button>
      </section>
    </div>
  )
}
