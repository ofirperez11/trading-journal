import { useState, type FormEvent } from 'react'
import { ChevronDown, Check, Plus, BookMarked } from 'lucide-react'
import { useJournals } from '../lib/journals'

/** Dropdown to pick the active journal (account) or create a new one. */
export function JournalSwitcher() {
  const { journals, active, setActive, createJournal } = useJournals()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')

  function handleAdd(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    createJournal(name)
    setName('')
    setOpen(false)
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-2 rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm transition-colors hover:bg-white/[0.06]"
      >
        <span className="flex min-w-0 items-center gap-2">
          <BookMarked className="h-4 w-4 shrink-0 text-accent-2" />
          <span className="truncate font-medium">{active.name}</span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="panel absolute z-30 mt-2 w-full overflow-hidden p-1 text-right">
            <div className="px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">
              היומנים שלי
            </div>
            {journals.map((j) => (
              <button
                key={j.id}
                onClick={() => {
                  setActive(j.id)
                  setOpen(false)
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-white/[0.05]"
              >
                <span className="truncate">{j.name}</span>
                {j.id === active.id && <Check className="h-4 w-4 shrink-0 text-accent-2" />}
              </button>
            ))}
            <div className="my-1 border-t border-white/[0.06]" />
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
    </div>
  )
}
