import { useEffect, useState } from 'react'
import { Check, Loader2, PenLine } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { supabase, isSupabaseConfigured } from '../lib/supabase'

// Discipline / emotional journal — one entry per day.
interface Entry {
  id?: string
  date: string // YYYY-MM-DD
  mood: string | null
  followed_rules: boolean | null
  notes: string | null
  lessons: string | null
}

const MOODS: { label: string; tone: 'win' | 'muted' | 'loss' }[] = [
  { label: 'מצוין', tone: 'win' },
  { label: 'טוב', tone: 'win' },
  { label: 'ניטרלי', tone: 'muted' },
  { label: 'לחוץ', tone: 'loss' },
  { label: 'מתוסכל', tone: 'loss' },
]
const moodTone = (label: string | null) => MOODS.find((m) => m.label === label)?.tone ?? 'muted'
const toneText = { win: 'text-win', muted: 'text-muted', loss: 'text-loss' } as const
const toneChip = {
  win: 'border-win/50 bg-win/10 text-win',
  muted: 'border-accent/50 bg-accent/10 text-accent',
  loss: 'border-loss/50 bg-loss/10 text-loss',
} as const

const today = () => new Date().toISOString().slice(0, 10)
const prettyDate = (d: string) =>
  new Date(d + 'T12:00').toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

const empty = (): Entry => ({ date: today(), mood: null, followed_rules: null, notes: '', lessons: '' })

export default function Journal() {
  const { user } = useAuth()
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Entry>(empty())
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState(0)
  const [error, setError] = useState<string | null>(null)

  function set<K extends keyof Entry>(k: K, v: Entry[K]) {
    setForm((f) => ({ ...f, [k]: v }))
  }

  useEffect(() => {
    if (!isSupabaseConfigured || !user) { setLoading(false); return }
    supabase
      .from('journal_entries')
      .select('*')
      .order('date', { ascending: false })
      .then(({ data }) => { setEntries((data ?? []) as Entry[]); setLoading(false) })
  }, [user?.id])

  async function save() {
    if (!user) return
    setError(null)
    setSaving(true)
    const row = {
      user_id: user.id,
      date: form.date,
      mood: form.mood,
      followed_rules: form.followed_rules,
      notes: form.notes?.trim() || null,
      lessons: form.lessons?.trim() || null,
    }
    const { data, error: err } = await supabase
      .from('journal_entries')
      .upsert(row, { onConflict: 'user_id,date' })
      .select()
      .single()
    setSaving(false)
    if (err) { setError(err.message); return }
    // Replace/insert in the local list (dedupe by date).
    setEntries((list) => [data as Entry, ...list.filter((e) => e.date !== form.date)].sort((a, b) => b.date.localeCompare(a.date)))
    setSavedAt(Date.now())
    setTimeout(() => setSavedAt(0), 2000)
  }

  const field = 'flex flex-col gap-1.5'

  if (!isSupabaseConfigured) {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">יומן</h1>
        <div className="card text-muted">היומן זמין כשמחוברים ל-Supabase.</div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="flex items-center gap-2">
        <PenLine className="h-6 w-6 text-accent" />
        <div>
          <h1 className="text-2xl font-bold">יומן</h1>
          <p className="text-muted">תיעוד יומי של מצב רוח, משמעת ולקחים — הבסיס לשיפור.</p>
        </div>
      </div>

      {/* Entry editor */}
      <div className="card space-y-5">
        <label className={`${field} sm:max-w-xs`}>
          <span className="field-label mb-0">תאריך</span>
          <input type="date" dir="ltr" className="input" value={form.date} onChange={(e) => set('date', e.target.value)} />
        </label>

        <div className={field}>
          <span className="field-label mb-0">מצב רוח</span>
          <div className="flex flex-wrap gap-2">
            {MOODS.map((m) => {
              const on = form.mood === m.label
              return (
                <button
                  key={m.label}
                  type="button"
                  onClick={() => set('mood', on ? null : m.label)}
                  className={`rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${
                    on ? toneChip[m.tone] : 'border-black/[0.12] text-muted hover:text-ink'
                  }`}
                >
                  {m.label}
                </button>
              )
            })}
          </div>
        </div>

        <div className={field}>
          <span className="field-label mb-0">עקבתי אחרי הכללים?</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => set('followed_rules', form.followed_rules === true ? null : true)}
              className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                form.followed_rules === true ? 'border-win/50 bg-win/10 text-win' : 'border-black/[0.12] text-muted hover:text-ink'
              }`}
            >
              כן
            </button>
            <button
              type="button"
              onClick={() => set('followed_rules', form.followed_rules === false ? null : false)}
              className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                form.followed_rules === false ? 'border-loss/50 bg-loss/10 text-loss' : 'border-black/[0.12] text-muted hover:text-ink'
              }`}
            >
              לא
            </button>
          </div>
        </div>

        <label className={field}>
          <span className="field-label mb-0">מה קרה היום</span>
          <textarea rows={3} className="input resize-none" value={form.notes ?? ''} onChange={(e) => set('notes', e.target.value)} placeholder="איך הרגשת, מה עבד, מה לא…" />
        </label>
        <label className={field}>
          <span className="field-label mb-0">לקחים</span>
          <textarea rows={2} className="input resize-none" value={form.lessons ?? ''} onChange={(e) => set('lessons', e.target.value)} placeholder="מה תעשה אחרת מחר?" />
        </label>

        {error && <p className="text-sm text-loss">{error}</p>}

        <div className="flex items-center gap-3">
          <button onClick={save} disabled={saving} className="btn-primary">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            שמור רשומה
          </button>
          {savedAt > 0 && <span className="text-sm text-win">נשמר ✓</span>}
          {form.date !== today() || form.mood || form.notes ? (
            <button onClick={() => setForm(empty())} className="text-sm text-muted hover:text-ink">רשומה חדשה</button>
          ) : null}
        </div>
      </div>

      {/* Past entries */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold">רשומות קודמות</h2>
        {loading ? (
          <div className="card text-center text-muted">טוען…</div>
        ) : entries.length === 0 ? (
          <div className="card py-10 text-center text-muted">עוד אין רשומות. כתוב את הראשונה למעלה.</div>
        ) : (
          entries.map((e) => (
            <button
              key={e.date}
              onClick={() => setForm({ ...e, notes: e.notes ?? '', lessons: e.lessons ?? '' })}
              className="card block w-full text-right transition-colors hover:bg-black/[0.02]"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-semibold">{prettyDate(e.date)}</span>
                <div className="flex items-center gap-2">
                  {e.mood && (
                    <span className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${toneChip[moodTone(e.mood)]}`}>{e.mood}</span>
                  )}
                  {e.followed_rules != null && (
                    <span className={`text-xs font-medium ${e.followed_rules ? 'text-win' : 'text-loss'}`}>
                      {e.followed_rules ? 'לפי הכללים' : 'חריגה מהכללים'}
                    </span>
                  )}
                </div>
              </div>
              {e.notes && <p className="mt-2 line-clamp-2 text-sm text-muted">{e.notes}</p>}
              {e.lessons && <p className={`mt-1 text-sm ${toneText.muted}`}><span className="font-medium text-ink">לקח: </span>{e.lessons}</p>}
            </button>
          ))
        )}
      </div>
    </div>
  )
}
