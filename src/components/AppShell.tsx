import { NavLink, Outlet } from 'react-router-dom'
import {
  LayoutDashboard,
  BookOpen,
  TrendingUp,
  Calendar,
  PenLine,
  Download,
  Settings,
  LogOut,
} from 'lucide-react'
import { Logo } from './Logo'
import { JournalSwitcher } from './JournalSwitcher'
import { useAuth } from '../lib/auth'

const nav = [
  { to: '/app', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/app/trades', label: 'Trades', icon: BookOpen },
  { to: '/app/analytics', label: 'Analytics', icon: TrendingUp },
  { to: '/app/calendar', label: 'Calendar', icon: Calendar },
  { to: '/app/journal', label: 'Journal', icon: PenLine },
  { to: '/app/import', label: 'Import', icon: Download },
  { to: '/app/settings', label: 'Settings', icon: Settings },
]

export default function AppShell() {
  const { user, signOut, isDemo } = useAuth()
  const name =
    (user?.user_metadata?.display_name as string | undefined) ?? user?.email?.split('@')[0] ?? 'Trader'

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
      isActive
        ? 'border border-white/[0.06] bg-gradient-to-r from-accent/20 to-accent-2/10 text-white'
        : 'text-muted hover:bg-white/[0.04] hover:text-white'
    }`

  return (
    <div className="flex min-h-full">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-60 shrink-0 flex-col border-r border-white/[0.06] bg-white/[0.015] p-4 backdrop-blur-xl md:flex">
        <div className="mb-4 flex items-center gap-2 px-2">
          <Logo size={26} />
          <span className="text-lg font-bold tracking-tight">Trading Journal</span>
        </div>
        <div className="mb-4">
          <JournalSwitcher />
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
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-2 text-sm font-semibold uppercase text-white">
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
      <main className="flex-1 overflow-auto pb-20 md:pb-0">
        <div className="border-b border-white/[0.06] p-3 md:hidden">
          <JournalSwitcher />
        </div>
        {isDemo && (
          <div className="border-b border-amber-500/30 bg-amber-500/10 px-6 py-2 text-center text-sm text-amber-300">
            ⚠️ מצב הדגמה — חברו את Supabase כדי לשמור נתונים אמיתיים.
          </div>
        )}
        <div className="mx-auto max-w-6xl p-6">
          <Outlet />
        </div>
      </main>

      {/* Bottom nav (mobile) */}
      <nav className="fixed inset-x-0 bottom-0 z-10 flex justify-around border-t border-white/[0.06] bg-bg/80 px-2 py-2 backdrop-blur-xl md:hidden">
        {nav.slice(0, 5).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 rounded-lg px-3 py-1 text-[10px] font-medium ${
                isActive ? 'text-white' : 'text-muted'
              }`
            }
          >
            <item.icon className="h-5 w-5" strokeWidth={1.75} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
