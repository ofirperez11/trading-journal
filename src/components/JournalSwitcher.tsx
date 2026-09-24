import { useState, type FormEvent } from 'react'
import { ChevronDown, Check, Plus, BookMarked, Share2, Trash2, Users } from 'lucide-react'
import { useJournals } from '../lib/journals'
import { useAuth } from '../lib/auth'
import { ShareDialog } from './ShareDialog'

/** Dropdown to pick the active journal, create one, share it, or delete it. */
export function JournalSwitcher() {
  const { journals, active, setActive, createJournal, deleteJournal } = useJournals()
  const { user } = useAuth()
  const myId = user?.id
  // Whether the user has at least one journal shared *to* them (owned by someone
  // else). If so, they may delete their own default journal too — this lets a
  // partner remove the stray empty journal that used to be auto-created.
  const hasSharedIn = journals.some((j) => myId != null && j.user_id !== myId)
  const canDelete = (j: (typeof journals)[number]) => {
    if (myId == null) return !j.is_default // demo / no auth: original behavior
    if (j.user_id !== myId) return false // a journal shared to me — not mine to delete
    return !j.is_default || hasSharedIn
  }
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)
  const [shareId, setShareId] = useState<string | null>(null)

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    createJournal(name)
    setName('')
    setOpen(false)
  }

  const iconBtn =
    'flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted transition-colors hover:bg-[#e9e8e4] hover:text-ink'

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-md border border-border bg-bg px-2 py-1.5 text-sm transition-colors hover:bg-surface-2"
      >
        <span className="flex min-w-0 items-center gap-2">
          <BookMarked className="h-4 w-4 shrink-0 text-muted" />
          <span className="truncate font-medium">{active.name}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="panel absolute z-30 mt-1 w-full min-w-[15rem] origin-top animate-zoom-in overflow-hidden p-1 text-right shadow-[0_12px_32px_-12px_rgba(15,15,15,.3)]">
            <div className="px-2.5 py-1.5 text-xs font-semibold text-muted">
              היומנים שלי
            </div>

            {journals.map((j) => {
              const shareCount = j.shares?.length ?? 0
              if (confirmDelete === j.id) {
                return (
                  <div
                    key={j.id}
                    className="flex items-center justify-between gap-2 rounded-md bg-tag-red px-3 py-2 text-sm"
                  >
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          deleteJournal(j.id)
                          setConfirmDelete(null)
                        }}
                        className="rounded-md bg-loss px-2 py-1 text-xs font-semibold text-white hover:opacity-90"
                      >
                        מחק
                      </button>
                      <button
                        onClick={() => setConfirmDelete(null)}
                        className="rounded-md px-2 py-1 text-xs text-muted hover:text-ink"
                      >
                        ביטול
                      </button>
                    </div>
                    <span className="truncate text-muted">למחוק את "{j.name}"?</span>
                  </div>
                )
              }
              return (
                <div key={j.id} className="group flex items-center gap-1 rounded-md hover:bg-surface">
                  <button
                    onClick={() => {
                      setActive(j.id)
                      setOpen(false)
                    }}
                    className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2 text-sm"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate">{j.name}</span>
                      {shareCount > 0 && (
                        <span className="num inline-flex items-center gap-0.5 text-[10px] text-muted">
                          <Users className="h-3 w-3" />
                          {shareCount}
                        </span>
                      )}
                    </span>
                    {j.id === active.id && <Check className="h-4 w-4 shrink-0 text-accent" />}
                  </button>
                  <div className="flex shrink-0 items-center gap-0.5 pl-1.5">
                    <button onClick={() => setShareId(j.id)} className={iconBtn} aria-label={`שיתוף ${j.name}`} title="שיתוף">
                      <Share2 className="h-4 w-4" />
                    </button>
                    {canDelete(j) && (
                      <button
                        onClick={() => setConfirmDelete(j.id)}
                        className={`${iconBtn} hover:!bg-tag-red hover:!text-loss`}
                        aria-label={`מחיקת ${j.name}`}
                        title="מחיקה"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              )
            })}

            <div className="my-1 border-t border-border" />
            <form onSubmit={handleAdd} className="flex items-center gap-1.5 p-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="שם יומן חדש…"
                className="input px-3 py-1.5 text-sm"
              />
              <button type="submit" className="btn-primary shrink-0 px-2.5 py-1.5" aria-label="הוסף יומן">
                <Plus className="h-4 w-4" />
              </button>
            </form>
          </div>
        </>
      )}

      {shareId && <ShareDialog journalId={shareId} onClose={() => setShareId(null)} />}
    </div>
  )
}
