import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, isSupabaseConfigured } from './supabase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  /** True when running without a configured backend (UI demo only). */
  isDemo: boolean
  signUp: (
    email: string,
    password: string,
    name: string,
  ) => Promise<{ error: string | null; needsConfirmation?: boolean }>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

const DEMO_KEY = 'tj_demo_user'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!isSupabaseConfigured) {
      // Demo mode: restore a local fake session so the whole app is explorable.
      const raw = localStorage.getItem(DEMO_KEY)
      if (raw) setUser(JSON.parse(raw) as User)
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }: { data: { session: Session | null } }) => {
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  function demoUser(email: string, name: string): User {
    return {
      id: 'demo-user',
      email,
      user_metadata: { display_name: name },
      app_metadata: {},
      aud: 'demo',
      created_at: new Date().toISOString(),
    } as User
  }

  const signUp: AuthContextValue['signUp'] = async (email, password, name) => {
    if (!isSupabaseConfigured) {
      const u = demoUser(email, name)
      localStorage.setItem(DEMO_KEY, JSON.stringify(u))
      setUser(u)
      return { error: null }
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    })
    // With email confirmation on, no session is returned until the user clicks
    // the link in their inbox.
    return { error: error?.message ?? null, needsConfirmation: !error && !data.session }
  }

  const signIn: AuthContextValue['signIn'] = async (email, password) => {
    if (!isSupabaseConfigured) {
      const u = demoUser(email, email.split('@')[0])
      localStorage.setItem(DEMO_KEY, JSON.stringify(u))
      setUser(u)
      return { error: null }
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signOut: AuthContextValue['signOut'] = async () => {
    if (!isSupabaseConfigured) {
      localStorage.removeItem(DEMO_KEY)
      setUser(null)
      return
    }
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, isDemo: !isSupabaseConfigured, signUp, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>')
  return ctx
}
