import { useEffect, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { X, UserPlus, Trash2 } from 'lucide-react'
import { useJournals } from '../lib/journals'
import type { ShareRole } from '../types'

const roleLabel: Record<ShareRole, string> = { viewer: 'צפייה', editor: 'עריכה' }

/** Share a journal with another user at a chosen permission level. */
export function ShareDialog({ journalId, onClose }: { journalId: string; onClose: () => void }) {
  const { journals, shareJournal, unshareJournal } = useJournals()
  const journal = journals.find((j) => j.id === journalId)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<ShareRole>('viewer')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!journal) return null
  const shares = journal.shares ?? []

  function submit(e: FormEvent) {
    e.preventDefault()
    const value = email.trim()
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) {
      setError('כתובת אימייל לא תקינה')
      return
    }
    setError(null)
    shareJournal(journalId, value, role)
    setEmail('')
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[60] flex animate-zoom-in items-center justify-center bg-black/30 p-4"
      onClick={onClose}
    >
      <div className="panel w-full max-w-md p-5 text-right shadow-[0_24px_48px_-16px_rgba(15,15,15,.35)]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl">שיתוף יומן</h2>
            <p className="mt-0.5 text-sm text-muted">{journal.name}</p>
          </div>
          <button
            onClick={onClose}
            aria-label="סגור"
            className="flex h-8 w-8 items-center justify-center rounded-md text-muted transition-colors hover:bg-surface hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <p className="mt-3 rounded-md bg-tag-yellow px-3 py-2 text-[13px] text-tag-yellow-fg">
          השיתוף ייכנס לתוקף כשנחבר את Supabase. בינתיים זו תצוגה מקדימה של מי שתזמין ובאיזו הרשאה.
        </p>

        <form onSubmit={submit} className="mt-4 flex items-end gap-2">
          <div className="flex-1">
            <label className="field-label" htmlFor="share-email">
              הזמנה לפי אימייל
            </label>
            <input
              id="share-email"
              type="email"
              dir="ltr"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              className="input"
            />
          </div>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as ShareRole)}
            aria-label="רמת הרשאה"
            className="input w-28 shrink-0"
          >
            <option value="viewer">צפייה</option>
            <option value="editor">עריכה</option>
          </select>
          <button type="submit" className="btn-primary h-[38px] shrink-0 !px-3" aria-label="שתף">
            <UserPlus className="h-4 w-4" />
          </button>
        </form>
        {error && <p className="mt-2 text-sm text-loss">{error}</p>}

        <div className="mt-5">
          <div className="text-[13px] font-semibold text-muted">משותף עם</div>
          {shares.length === 0 ? (
            <p className="mt-3 text-sm text-muted">היומן עדיין לא משותף עם אף אחד.</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {shares.map((s) => (
                <li
                  key={s.email}
                  className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-surface"
                >
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => unshareJournal(journalId, s.email)}
                      aria-label={`הסר שיתוף עם ${s.email}`}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-muted transition-colors hover:bg-tag-red hover:text-loss"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <span className={`tag ${s.role === 'editor' ? 'tag-blue' : ''}`}>{roleLabel[s.role]}</span>
                  </div>
                  <span dir="ltr" className="truncate text-sm text-ink">
                    {s.email}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>,
    document.body,
  )
}
