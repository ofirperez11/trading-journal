import { useEffect, useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  BookOpen,
  TrendingUp,
  Table2,
  Calendar,
  PenLine,
  Download,
  Settings,
  LogOut,
  Menu,
  X,
} from 'lucide-react'
import { Logo } from './Logo'
import { JournalSwitcher } from './JournalSwitcher'
import { useAuth } from '../lib/auth'

const nav = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/trades', label: 'Trades', icon: BookOpen },
  { to: '/app/analytics', label: 'Analytics', icon: TrendingUp },
  { to: '/app/summary', label: 'Summary', icon: Table2 },
  { to: '/app/calendar', label: 'Calendar', icon: Calendar },
  { to: '/app/journal', label: 'Journal', icon: PenLine },
  { to: '/app/import', label: 'Import', icon: Download },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

export default function AppShell() {
  const { user, signOut, isDemo } = useAuth()
  const location = useLocation()
  const [navOpen, setNavOpen] = useState(false)

  const name =
    (user?.user_metadata?.display_name as string | undefined) ?? user?.email?.split('@')[0] ?? 'Trader'

  // Close the drawer on navigation and on Escape.
  useEffect(() => setNavOpen(false), [location.pathname])
  useEffect(() => {
    if (!navOpen) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setNavOpen(false)
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navOpen])

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? 'border border-white/[0.06] bg-gradient-to-l from-accent/20 to-accent-2/10 text-ink'
        : 'text-muted hover:bg-white/[0.04] hover:text-ink'
    }`

  return (
    <div className="min-h-full">
      {/* Top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/[0.06] bg-bg/80 px-4 py-3 backdrop-blur-xl">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setNavOpen(true)}
            aria-label="פתח תפריט"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-ink transition-colors hover:bg-white/[0.07]"
          >
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          </button>
          <div className="flex items-center gap-2.5">
            <Logo size={26} />
            <span className="hidden font-mono text-sm font-semibold uppercase tracking-[0.16em] text-ink sm:block">
              Trading&nbsp;Journal
            </span>
          </div>
        </div>
        <div className="w-44 sm:w-56">
          <JournalSwitcher />
        </div>
      </header>

      {/* Drawer backdrop */}
      <div
        onClick={() => setNavOpen(false)}
        className={`fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${
          navOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden
      />

      {/* Slide-out nav drawer (from the right, RTL start) */}
      <aside
        aria-hidden={!navOpen}
        className={`fixed inset-y-0 right-0 z-50 flex w-72 max-w-[82vw] flex-col border-l border-white/[0.06] bg-surface/95 p-4 backdrop-blur-xl transition-transform duration-300 ${
          navOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
      >
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Logo size={26} />
            <span className="font-mono text-sm font-semibold uppercase tracking-[0.16em] text-ink">
              Journal
            </span>
          </div>
          <button
            onClick={() => setNavOpen(false)}
            aria-label="סגור תפריט"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-white/[0.06] hover:text-ink"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-1">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end} className={linkClass}>
              <item.icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 border-t border-white/[0.06] pt-4">
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-sm font-semibold uppercase text-bg">
              {name.slice(0, 1)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium">{name}</div>
              <button
                onClick={signOut}
                className="flex items-center gap-1 text-xs text-muted hover:text-loss"
              >
                <LogOut className="h-3 w-3" />
                התנתק
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main className="min-h-[calc(100%-65px)]">
        {isDemo && (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-6 py-2 text-center text-sm text-amber-300">
            ⚠️ מצב הדגמה — חברו את Supabase כדי לשמור נתונים אמיתיים.
          </div>
        )}
        <div className="mx-auto max-w-6xl p-6">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
