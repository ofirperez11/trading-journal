import { useEffect, useMemo, useState } from 'react'
import { Check, Loader2, PenLine, Plus, Lightbulb } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useTrades } from '../lib/useTrades'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { formatMoney, formatPct } from '../lib/trades'
import { PageTitle } from '../components/PageTitle'

// Discipline / emotional journal — one entry per day.
interface Entry {
  id?: string
  date: string // YYYY-MM-DD
  mood: string | null
  followed_rules: boolean | null
  notes: string | null
  lessons: string | null
}

const MOODS: { label: string; tag: string }[] = [
  { label: 'מצוין', tag: 'tag-green' },
  { label: 'טוב', tag: 'tag-green' },
  { label: 'ניטרלי', tag: '' },
  { label: 'לחוץ', tag: 'tag-orange' },
  { label: 'מתוסכל', tag: 'tag-red' },
]
const moodTag = (label: string | null) => MOODS.find((m) => m.label === label)?.tag ?? ''

const today = () => new Date().toISOString().slice(0, 10)
const prettyDate = (d: string) =>
  new Date(d + 'T12:00').toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
const shortDate = (d: string) => new Date(d + 'T12:00').toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })

const empty = (): Entry => ({ date: today(), mood: null, followed_rules: null, notes: '', lessons: '' })

// Demo mode (no backend): entries live in this browser only.
const DEMO_KEY = 'tj_demo_journal'
const loadDemo = (): Entry[] => {
  try {
    return JSON.parse(localStorage.getItem(DEMO_KEY) || '[]') as Entry[]
  } catch {
    return []
  }
}

export default function Journal() {
  const { user } = useAuth()
  const { trades } = useTrades()
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
    if (!isSupabaseConfigured) {
      setEntries(loadDemo().sort((a, b) => b.date.localeCompare(a.date)))
      setLoading(false)
      return
    }
    if (!user) {
      setLoading(false)
      return
    }
    supabase
      .from('journal_entries')
      .select('*')
      .order('date', { ascending: false })
      .then(({ data }) => {
        setEntries((data ?? []) as Entry[])
        setLoading(false)
      })
  }, [user?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // P&L per trading day, to put each entry next to what actually happened.
  const dayPnl = useMemo(() => {
    const m = new Map<string, { net: number; count: number }>()
    for (const t of trades) {
      const k = t.date.slice(0, 10)
      const a = m.get(k) ?? { net: 0, count: 0 }
      a.net += t.return_amount
      a.count++
      m.set(k, a)
    }
    return m
  }, [trades])

  // Discipline stats: how often the rules were followed, and what it's worth.
  const stats = useMemo(() => {
    const rated = entries.filter((e) => e.followed_rules != null)
    const kept = rated.filter((e) => e.followed_rules)
    const avg = (es: Entry[]) => {
      const ps = es.map((e) => dayPnl.get(e.date)?.net).filter((v): v is number => v != null)
      return ps.length ? ps.reduce((a, b) => a + b, 0) / ps.length : null
    }
    // Current streak of rule-following days (newest first).
    let streak = 0
    for (const e of [...rated].sort((a, b) => b.date.localeCompare(a.date))) {
      if (e.followed_rules) streak++
      else break
    }
    return {
      rate: rated.length ? kept.length / rated.length : null,
      avgKept: avg(kept),
      avgBroken: avg(rated.filter((e) => !e.followed_rules)),
      streak,
    }
  }, [entries, dayPnl])

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
    let saved: Entry
    if (!isSupabaseConfigured) {
      saved = row
      const next = [saved, ...loadDemo().filter((e) => e.date !== form.date)]
      localStorage.setItem(DEMO_KEY, JSON.stringify(next))
    } else {
      const { data, error: err } = await supabase
        .from('journal_entries')
        .upsert(row, { onConflict: 'user_id,date' })
        .select()
        .single()
      if (err) {
        setSaving(false)
        setError(err.message)
        return
      }
      saved = data as Entry
    }
    setSaving(false)
    // Replace/insert in the local list (dedupe by date).
    setEntries((list) => [saved, ...list.filter((e) => e.date !== form.date)].sort((a, b) => b.date.localeCompare(a.date)))
    setSavedAt(Date.now())
    setTimeout(() => setSavedAt(0), 2000)
  }

  // ⌘/Ctrl + Enter saves from anywhere in the editor.
  function onKeyDown(e: React.KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault()
      save()
    }
  }

  const day = dayPnl.get(form.date)
  const choice = (on: boolean, onCls: string) =>
    `h-9 rounded-md border px-3.5 text-sm font-medium transition-all active:scale-[0.97] ${
      on ? `${onCls} border-transparent font-semibold` : 'border-border text-[#5f5e5b] hover:bg-surface'
    }`

  return (
    <div>
      <PageTitle
        icon={PenLine}
        color="#c14c8a"
        title="יומן אישי"
        subtitle="תיעוד יומי של מצב רוח, משמעת ולקחים. הבסיס לשיפור."
      />

      {/* Discipline at a glance */}
      <div className="block-in mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4" style={{ '--i': 1 } as React.CSSProperties}>
        {[
          { k: 'רשומות', v: <span className="num">{entries.length}</span> },
          { k: 'ימים לפי הכללים', v: <span className="num">{stats.rate != null ? formatPct(stats.rate) : '—'}</span> },
          { k: 'רצף נוכחי', v: stats.streak ? <><span className="num">{stats.streak}</span> ימים</> : '—' },
          {
            k: 'P&L ממוצע ליום',
            v: (
              <span className="flex flex-wrap items-baseline gap-x-3 text-[15px]">
                <span>
                  <span className="text-[12px] font-normal text-muted">עקבת </span>
                  <span className="num text-win">{stats.avgKept != null ? formatMoney(stats.avgKept) : '—'}</span>
                </span>
                <span>
                  <span className="text-[12px] font-normal text-muted">חרגת </span>
                  <span className="num text-loss">{stats.avgBroken != null ? formatMoney(stats.avgBroken) : '—'}</span>
                </span>
              </span>
            ),
          },
        ].map((s) => (
          <div key={s.k} className="flex flex-col gap-0.5 bg-bg px-4 py-3">
            <span className="text-[12px] text-muted">{s.k}</span>
            <span className="text-lg font-bold">{s.v}</span>
          </div>
        ))}
      </div>
      {stats.avgKept != null && stats.avgBroken != null && stats.avgKept > stats.avgBroken && (
        <div className="callout mt-3 !text-sm">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#cb912f]" />
          <span>
            בימים שעקבת אחרי הכללים הרווחת בממוצע <b className="num">{formatMoney(stats.avgKept - stats.avgBroken)}</b> יותר מבימים שחרגת.
          </span>
        </div>
      )}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px]">
        {/* Entry editor — reads like a page */}
        <div onKeyDown={onKeyDown} className="block-in" style={{ '--i': 2 } as React.CSSProperties}>
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-2xl">{prettyDate(form.date)}</h2>
            <label className="sr-only" htmlFor="journal-date">תאריך</label>
            <input
              id="journal-date"
              type="date"
              dir="ltr"
              className="h-8 rounded-md border border-border bg-bg px-2 text-[13px] text-muted"
              value={form.date}
              onChange={(e) => set('date', e.target.value)}
            />
          </div>
          <p className="mt-1 text-sm text-muted">
            {day ? (
              <>
                באותו יום: <b className="num text-ink">{day.count}</b> {day.count === 1 ? 'עסקה' : 'עסקאות'},{' '}
                <b className={`num ${day.net > 0 ? 'text-win' : day.net < 0 ? 'text-loss' : ''}`}>{formatMoney(day.net)}</b>
              </>
            ) : (
              'אין עסקאות רשומות ביום הזה.'
            )}
          </p>

          <div className="mt-6 flex flex-col gap-1">
            <div className="grid grid-cols-[140px_minmax(0,1fr)] items-center gap-2 py-1.5">
              <span className="text-sm text-muted">מצב רוח</span>
              <div className="flex flex-wrap gap-1.5">
                {MOODS.map((m) => {
                  const on = form.mood === m.label
                  return (
                    <button
                      key={m.label}
                      type="button"
                      aria-pressed={on}
                      onClick={() => set('mood', on ? null : m.label)}
                      className={choice(on, `${m.tag || 'bg-tag-gray text-tag-gray-fg'} ${m.tag}`)}
                    >
                      {m.label}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="grid grid-cols-[140px_minmax(0,1fr)] items-center gap-2 py-1.5">
              <span className="text-sm text-muted">עקבתי אחרי הכללים?</span>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  aria-pressed={form.followed_rules === true}
                  onClick={() => set('followed_rules', form.followed_rules === true ? null : true)}
                  className={choice(form.followed_rules === true, 'bg-tag-green text-tag-green-fg')}
                >
                  כן
                </button>
                <button
                  type="button"
                  aria-pressed={form.followed_rules === false}
                  onClick={() => set('followed_rules', form.followed_rules === false ? null : false)}
                  className={choice(form.followed_rules === false, 'bg-tag-red text-tag-red-fg')}
                >
                  לא
                </button>
              </div>
            </div>
          </div>

          <div className="mt-6 border-t border-border pt-6">
            <label htmlFor="journal-notes" className="mb-2 block text-[17px] font-semibold">
              מה קרה היום
            </label>
            <textarea
              id="journal-notes"
              rows={5}
              className="w-full resize-y rounded-md bg-transparent px-1 py-1 text-[15px] leading-relaxed outline-none transition-colors placeholder:text-[#c7c6c3] hover:bg-[#fbfbfa] focus:bg-[#fbfbfa]"
              value={form.notes ?? ''}
              onChange={(e) => set('notes', e.target.value)}
              placeholder="איך הרגשת, מה עבד, מה לא…"
            />
          </div>
          <div className="mt-4">
            <label htmlFor="journal-lessons" className="mb-2 block text-[17px] font-semibold">
              לקחים
            </label>
            <textarea
              id="journal-lessons"
              rows={3}
              className="w-full resize-y rounded-md bg-transparent px-1 py-1 text-[15px] leading-relaxed outline-none transition-colors placeholder:text-[#c7c6c3] hover:bg-[#fbfbfa] focus:bg-[#fbfbfa]"
              value={form.lessons ?? ''}
              onChange={(e) => set('lessons', e.target.value)}
              placeholder="מה תעשה אחרת מחר?"
            />
          </div>

          {error && <p className="mt-3 rounded-md bg-tag-red px-3 py-2 text-sm text-tag-red-fg">{error}</p>}

          <div className="mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
              שמור רשומה
            </button>
            <kbd className="num hidden rounded border border-border bg-surface px-1.5 py-0.5 text-[11px] text-muted sm:inline">⌘ Enter</kbd>
            {savedAt > 0 && (
              <span className="flex animate-[fade-up_.3s_ease_both] items-center gap-1 text-sm font-medium text-win">
                <Check className="h-4 w-4" /> נשמר
              </span>
            )}
          </div>
          {!isSupabaseConfigured && <p className="mt-3 text-[12px] text-faint">מצב הדגמה: הרשומות נשמרות רק בדפדפן הזה.</p>}
        </div>

        {/* Timeline of past entries */}
        <aside className="block-in" style={{ '--i': 3 } as React.CSSProperties}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold">רשומות קודמות</h2>
            <button
              onClick={() => setForm(empty())}
              className="flex h-7 items-center gap-1 rounded-md px-2 text-[13px] text-muted transition-colors hover:bg-surface hover:text-ink"
            >
              <Plus className="h-3.5 w-3.5" /> רשומה להיום
            </button>
          </div>
          {loading ? (
            <p className="py-6 text-center text-sm text-muted">טוען…</p>
          ) : entries.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border py-10 text-center text-sm text-muted">עוד אין רשומות. כתוב את הראשונה.</p>
          ) : (
            <ol className="relative flex flex-col border-r border-border pr-3">
              {entries.map((e, i) => {
                const on = e.date === form.date
                const d = dayPnl.get(e.date)
                return (
                  <li key={e.date} style={{ animation: `fade-up .4s var(--ease-out-expo) ${Math.min(i, 10) * 40}ms both` }}>
                    <button
                      onClick={() => setForm({ ...e, notes: e.notes ?? '', lessons: e.lessons ?? '' })}
                      aria-current={on ? 'true' : undefined}
                      className={`relative w-full rounded-md px-2.5 py-2.5 text-right transition-colors ${on ? 'bg-surface' : 'hover:bg-[#fbfbfa]'}`}
                    >
                      <span
                        className={`absolute -right-[17px] top-4 h-2 w-2 rounded-full ring-2 ring-white ${
                          e.followed_rules === true ? 'bg-win' : e.followed_rules === false ? 'bg-loss' : 'bg-[#d3d1cb]'
                        }`}
                      />
                      <span className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold">{shortDate(e.date)}</span>
                        {e.mood && <span className={`tag ${moodTag(e.mood)}`}>{e.mood}</span>}
                        {d && (
                          <span className={`num mr-auto text-[13px] font-semibold ${d.net > 0 ? 'text-win' : d.net < 0 ? 'text-loss' : 'text-muted'}`}>
                            {formatMoney(d.net)}
                          </span>
                        )}
                      </span>
                      {(e.notes || e.lessons) && (
                        <span className="mt-1 line-clamp-2 block text-[13px] leading-snug text-muted">{e.notes || e.lessons}</span>
                      )}
                    </button>
                  </li>
                )
              })}
            </ol>
          )}
        </aside>
      </div>
    </div>
  )
}
