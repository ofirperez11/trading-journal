import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Account } from '../types'

// ---------------------------------------------------------------------------
// Journals = trading accounts. A user can keep several (Back Test, Live, …)
// and switch the active one; all views are scoped to it.
// Demo mode persists to localStorage; later this maps to the Supabase
// `accounts` table.
// ---------------------------------------------------------------------------

/** Account id of the exported StonkJournal data (the back-test journal). */
export const BACKTEST_ID = 'ZEtNtuQ1ZmeKdRErasrb'

const STORAGE_JOURNALS = 'tj_journals'
const STORAGE_ACTIVE = 'tj_active_journal'

const backtestJournal: Account = {
  id: BACKTEST_ID,
  user_id: 'demo-user',
  name: 'בק־טסט',
  broker: 'Tradovate',
  currency: 'USD',
  starting_balance: null,
  is_default: true,
}

interface JournalsContextValue {
  journals: Account[]
  activeId: string
  active: Account
  setActive: (id: string) => void
  createJournal: (name: string) => void
}

const JournalsContext = createContext<JournalsContextValue | undefined>(undefined)

export function JournalsProvider({ children }: { children: ReactNode }) {
  const [created, setCreated] = useState<Account[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_JOURNALS) ?? '[]') as Account[]
    } catch {
      return []
    }
  })
  const [activeId, setActiveId] = useState<string>(
    () => localStorage.getItem(STORAGE_ACTIVE) ?? BACKTEST_ID,
  )

  const journals = [backtestJournal, ...created]
  const active = journals.find((j) => j.id === activeId) ?? backtestJournal

  useEffect(() => {
    localStorage.setItem(STORAGE_ACTIVE, active.id)
  }, [active.id])

  function setActive(id: string) {
    setActiveId(id)
  }

  function createJournal(name: string) {
    const journal: Account = {
      id: crypto.randomUUID(),
      user_id: 'demo-user',
      name: name.trim() || 'יומן חדש',
      broker: null,
      currency: 'USD',
      starting_balance: null,
      is_default: false,
    }
    const next = [...created, journal]
    setCreated(next)
    localStorage.setItem(STORAGE_JOURNALS, JSON.stringify(next))
    setActiveId(journal.id)
  }

  return (
    <JournalsContext.Provider value={{ journals, activeId: active.id, active, setActive, createJournal }}>
      {children}
    </JournalsContext.Provider>
  )
}

export function useJournals() {
  const ctx = useContext(JournalsContext)
  if (!ctx) throw new Error('useJournals must be used within <JournalsProvider>')
  return ctx
}
