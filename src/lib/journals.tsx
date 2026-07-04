import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Account, JournalShare, ShareRole } from '../types'
import { isSupabaseConfigured, supabase } from './supabase'
import { useAuth } from './auth'

// ---------------------------------------------------------------------------
// Journals = trading accounts. A user can keep several (Back Test, Live, …),
// switch the active one, delete journals they created, and share a journal
// with another user (viewer / editor). All views are scoped to the active one.
//
// Two modes:
//  • Demo (no Supabase): everything persists to localStorage.
//  • Supabase: accounts + journal_shares live in the DB (RLS returns the user's
//    own journals plus any shared with them).
// ---------------------------------------------------------------------------

/** Account id of the exported StonkJournal data (the back-test journal, demo only). */
export const BACKTEST_ID = 'ZEtNtuQ1ZmeKdRErasrb'

const STORAGE_JOURNALS = 'tj_journals'
const STORAGE_ACTIVE = 'tj_active_journal'
const STORAGE_SHARES = 'tj_journal_shares'

const backtestJournal: Account = {
  id: BACKTEST_ID,
  user_id: 'demo-user',
  name: 'בק־טסט',
  broker: 'Tradovate',
  currency: 'USD',
  starting_balance: null,
  is_default: true,
}

type SharesMap = Record<string, JournalShare[]>

interface JournalsContextValue {
  journals: Account[]
  activeId: string
  active: Account
  loading: boolean
  setActive: (id: string) => void
  createJournal: (name: string) => void
  deleteJournal: (id: string) => void
  shareJournal: (id: string, email: string, role: ShareRole) => void
  unshareJournal: (id: string, email: string) => void
}

const JournalsContext = createContext<JournalsContextValue | undefined>(undefined)

function read<T>(key: string, fallback: T): T {
  try {
    return JSON.parse(localStorage.getItem(key) ?? '') as T
  } catch {
    return fallback
  }
}

export function JournalsProvider({ children }: { children: ReactNode }) {
  return isSupabaseConfigured ? (
    <SupabaseJournals>{children}</SupabaseJournals>
  ) : (
    <DemoJournals>{children}</DemoJournals>
  )
}

// --- Supabase-backed journals ---------------------------------------------
function SupabaseJournals({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [journals, setJournals] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [activeId, setActiveId] = useState<string>(() => localStorage.getItem(STORAGE_ACTIVE) ?? '')

  async function refresh(uid: string) {
    // Claim any journals shared with this user's email but not yet linked to
    // their account id (owners share by email before the recipient exists).
    // Ignored gracefully if the DB function isn't present yet.
    await supabase.rpc('claim_shared_journals')

    // RLS returns the user's own accounts + any shared with them.
    const { data: accts } = await supabase.from('accounts').select('*').order('created_at')
    let list = (accts ?? []) as Account[]

    // First run: create a default "בק־טסט" journal so the app is never empty.
    // Skip this when the user already has ANY accessible journal (including one
    // shared with them) — otherwise a partner gets a stray empty duplicate.
    if (list.length === 0) {
      const { data: created } = await supabase
        .from('accounts')
        .insert({ user_id: uid, name: 'בק־טסט', broker: 'Tradovate', currency: 'USD', is_default: true })
        .select()
        .single()
      if (created) list = [created as Account, ...list]
    }

    // Attach the share lists the owner manages.
    const { data: shares } = await supabase.from('journal_shares').select('*').eq('owner_id', uid)
    const byAccount: SharesMap = {}
    for (const s of (shares ?? []) as { account_id: string; shared_with_email: string; role: ShareRole }[]) {
      ;(byAccount[s.account_id] ??= []).push({ email: s.shared_with_email, role: s.role })
    }
    setJournals(list.map((a) => ({ ...a, shares: byAccount[a.id] ?? [] })))
    setLoading(false)
  }

  useEffect(() => {
    if (!user) {
      setJournals([])
      setLoading(false)
      return
    }
    setLoading(true)
    refresh(user.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  const active = journals.find((j) => j.id === activeId) ?? journals[0]
  useEffect(() => {
    if (active) localStorage.setItem(STORAGE_ACTIVE, active.id)
  }, [active?.id])

  async function createJournal(name: string) {
    if (!user) return
    const { data } = await supabase
      .from('accounts')
      .insert({ user_id: user.id, name: name.trim() || 'יומן חדש', currency: 'USD', is_default: false })
      .select()
      .single()
    if (data) {
      setJournals((j) => [...j, { ...(data as Account), shares: [] }])
      setActiveId((data as Account).id)
    }
  }

  async function deleteJournal(id: string) {
    await supabase.from('accounts').delete().eq('id', id)
    setJournals((j) => j.filter((x) => x.id !== id))
    if (activeId === id) setActiveId('')
  }

  async function shareJournal(id: string, email: string, role: ShareRole) {
    if (!user) return
    await supabase
      .from('journal_shares')
      .upsert(
        { account_id: id, owner_id: user.id, shared_with_email: email.toLowerCase(), role },
        { onConflict: 'account_id,shared_with_email' },
      )
    setJournals((j) =>
      j.map((x) => {
        if (x.id !== id) return x
        const list = x.shares ?? []
        const has = list.some((s) => s.email.toLowerCase() === email.toLowerCase())
        return {
          ...x,
          shares: has
            ? list.map((s) => (s.email.toLowerCase() === email.toLowerCase() ? { ...s, role } : s))
            : [...list, { email, role }],
        }
      }),
    )
  }

  async function unshareJournal(id: string, email: string) {
    await supabase
      .from('journal_shares')
      .delete()
      .eq('account_id', id)
      .eq('shared_with_email', email.toLowerCase())
    setJournals((j) =>
      j.map((x) =>
        x.id === id ? { ...x, shares: (x.shares ?? []).filter((s) => s.email.toLowerCase() !== email.toLowerCase()) } : x,
      ),
    )
  }

  if (user && loading) {
    return <div className="flex min-h-[50vh] items-center justify-center text-muted">טוען יומנים…</div>
  }

  return (
    <JournalsContext.Provider
      value={{
        journals,
        activeId: active?.id ?? '',
        active: active ?? backtestJournal,
        loading,
        setActive: setActiveId,
        createJournal,
        deleteJournal,
        shareJournal,
        unshareJournal,
      }}
    >
      {children}
    </JournalsContext.Provider>
  )
}

// --- Demo (localStorage) journals -----------------------------------------
function DemoJournals({ children }: { children: ReactNode }) {
  const [created, setCreated] = useState<Account[]>(() => read<Account[]>(STORAGE_JOURNALS, []))
  const [shares, setShares] = useState<SharesMap>(() => read<SharesMap>(STORAGE_SHARES, {}))
  const [activeId, setActiveId] = useState<string>(() => localStorage.getItem(STORAGE_ACTIVE) ?? BACKTEST_ID)

  const journals = [backtestJournal, ...created].map((j) => ({ ...j, shares: shares[j.id] ?? [] }))
  const active = journals.find((j) => j.id === activeId) ?? journals[0]

  useEffect(() => {
    localStorage.setItem(STORAGE_ACTIVE, active.id)
  }, [active.id])

  function persistCreated(next: Account[]) {
    setCreated(next)
    localStorage.setItem(STORAGE_JOURNALS, JSON.stringify(next))
  }
  function persistShares(next: SharesMap) {
    setShares(next)
    localStorage.setItem(STORAGE_SHARES, JSON.stringify(next))
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
    persistCreated([...created, journal])
    setActiveId(journal.id)
  }

  function deleteJournal(id: string) {
    if (id === BACKTEST_ID) return
    persistCreated(created.filter((j) => j.id !== id))
    if (shares[id]) {
      const next = { ...shares }
      delete next[id]
      persistShares(next)
    }
    if (activeId === id) setActiveId(BACKTEST_ID)
  }

  function shareJournal(id: string, email: string, role: ShareRole) {
    const list = shares[id] ?? []
    const has = list.some((s) => s.email.toLowerCase() === email.toLowerCase())
    const nextList = has
      ? list.map((s) => (s.email.toLowerCase() === email.toLowerCase() ? { ...s, role } : s))
      : [...list, { email, role }]
    persistShares({ ...shares, [id]: nextList })
  }

  function unshareJournal(id: string, email: string) {
    const nextList = (shares[id] ?? []).filter((s) => s.email.toLowerCase() !== email.toLowerCase())
    persistShares({ ...shares, [id]: nextList })
  }

  return (
    <JournalsContext.Provider
      value={{
        journals,
        activeId: active.id,
        active,
        loading: false,
        setActive: setActiveId,
        createJournal,
        deleteJournal,
        shareJournal,
        unshareJournal,
      }}
    >
      {children}
    </JournalsContext.Provider>
  )
}

export function useJournals() {
  const ctx = useContext(JournalsContext)
  if (!ctx) throw new Error('useJournals must be used within <JournalsProvider>')
  return ctx
}
