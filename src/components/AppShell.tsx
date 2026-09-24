import { useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
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
  Plus,
  ImagePlus,
  type LucideIcon,
} from 'lucide-react'
import { JournalSwitcher } from './JournalSwitcher'
import { DashboardCover } from './DashboardCover'
import { useAuth } from '../lib/auth'
import { useJournals } from '../lib/journals'

interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  color: string
  end?: boolean
}

// Journal pages — each gets its own colour, like page icons in a workspace.
const pages: NavItem[] = [
  { to: '/app', label: 'דשבורד', icon: LayoutDashboard, color: '#448361', end: true },
  { to: '/app/trades', label: 'עסקאות', icon: BookOpen, color: '#337ea9' },
  { to: '/app/analytics', label: 'אנליטיקה', icon: TrendingUp, color: '#9065b0' },
  { to: '/app/summary', label: 'סיכום', icon: Table2, color: '#d9730d' },
  { to: '/app/calendar', label: 'לוח שנה', icon: Calendar, color: '#cb912f' },
  { to: '/app/journal', label: 'יומן אישי', icon: PenLine, color: '#c14c8a' },
]
const utility: NavItem[] = [
  { to: '/app/import', label: 'ייבוא', icon: Download, color: '#787774' },
  { to: '/app/settings', label: 'הגדרות', icon: Settings, color: '#787774' },
]

/** Breadcrumb label for the current route. */
function pageLabel(path: string): string {
  if (path === '/app/trades/new') return 'עסקה חדשה'
  if (path === '/app/trades/from-image') return 'עסקה מצילום מסך'
  if (/^\/app\/trades\/[^/]+\/edit$/.test(path)) return 'עריכת עסקה'
  if (/^\/app\/trades\/[^/]+$/.test(path)) return 'עסקה'
  const hit = [...pages, ...utility]
    .filter((p) => (p.end ? path === p.to : path.startsWith(p.to)))
    .sort((a, b) => b.to.length - a.to.length)[0]
  return hit?.label ?? ''
}

export default function AppShell() {
  const { user, signOut, isDemo } = useAuth()
  const { active } = useJournals()
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

  const itemClass = ({ isActive }: { isActive: boolean }) =>
    `flex h-[30px] items-center gap-2 rounded-md px-2 text-sm transition-colors ${
      isActive ? 'bg-black/[0.055] font-semibold text-ink' : 'text-[#5f5e5b] hover:bg-black/[0.04]'
    }`

  const sidebar = (
    <div className="flex h-full flex-col gap-0.5 px-2 py-2.5">
      <div className="flex items-center gap-2 px-2 pb-2.5 pt-1.5">
        <span className="flex h-6 w-6 items-center justify-center rounded-[5px] bg-ink text-xs font-bold text-white">
          {name.slice(0, 1)}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold">{name}</span>
        <button
          onClick={() => setNavOpen(false)}
          aria-label="סגור תפריט"
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted hover:bg-black/[0.05] lg:hidden"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <Link to="/app/trades/new" className={itemClass({ isActive: false })}>
        <Plus className="h-4 w-4" strokeWidth={2} />
        עסקה חדשה
      </Link>
      <Link to="/app/trades/from-image" className={itemClass({ isActive: false })}>
        <ImagePlus className="h-4 w-4" strokeWidth={2} />
        עסקה מצילום מסך
      </Link>

      <div className="px-2 pb-1 pt-4 text-xs font-semibold text-faint">יומן</div>
      <div className="mb-1 px-0.5">
        <JournalSwitcher />
      </div>
      <nav aria-label="עמודי היומן" className="flex flex-col gap-0.5">
        {pages.map((item) => (
          <NavLink key={item.to} to={item.to} end={item.end} className={itemClass}>
            <item.icon className="h-4 w-4" strokeWidth={2} style={{ color: item.color }} />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="flex-1" />

      {isDemo && (
        <div className="mx-1 mb-2 rounded-md bg-tag-yellow px-2.5 py-1.5 text-[12px] leading-snug text-tag-yellow-fg">
          מצב הדגמה: הנתונים נשמרים רק בדפדפן הזה.
        </div>
      )}
      <nav aria-label="כלים" className="flex flex-col gap-0.5">
        {utility.map((item) => (
          <NavLink key={item.to} to={item.to} className={itemClass}>
            <item.icon className="h-4 w-4" strokeWidth={2} />
            {item.label}
          </NavLink>
        ))}
        <button onClick={signOut} className={`${itemClass({ isActive: false })} hover:text-loss`}>
          <LogOut className="h-4 w-4" strokeWidth={2} />
          התנתק
        </button>
      </nav>
    </div>
  )

  const crumb = pageLabel(location.pathname)
  // Data-heavy pages (wide tables / grids) get a wider page column.
  const wide = ['/app/trades', '/app/summary', '/app/calendar'].includes(location.pathname)

  return (
    <div className="min-h-full lg:pr-[248px]">
      {/* Desktop sidebar — always visible */}
      <aside className="fixed inset-y-0 right-0 z-40 hidden w-[248px] border-l border-border bg-surface lg:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      <div
        onClick={() => setNavOpen(false)}
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity duration-300 lg:hidden ${
          navOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        aria-hidden
      />
      <aside
        aria-hidden={!navOpen}
        className={`fixed inset-y-0 right-0 z-50 w-[272px] max-w-[85vw] border-l border-border bg-surface shadow-xl transition-transform duration-300 lg:hidden ${
          navOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        style={{ transitionTimingFunction: 'var(--ease-out-expo)' }}
      >
        {sidebar}
      </aside>

      {/* Top bar: breadcrumb */}
      <header className="sticky top-0 z-30 flex h-11 items-center gap-1.5 bg-bg/90 px-3 text-sm text-muted backdrop-blur">
        <button
          onClick={() => setNavOpen(true)}
          aria-label="פתח תפריט"
          className="flex h-8 w-8 items-center justify-center rounded-md text-ink hover:bg-black/[0.05] lg:hidden"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <span className="truncate">{active.name}</span>
        {crumb && (
          <>
            <span className="text-[#c7c6c3]">/</span>
            <span className="truncate text-ink">{crumb}</span>
          </>
        )}
      </header>

      <main>
        {location.pathname === '/app' && <DashboardCover />}
        <div className={`mx-auto px-5 pb-20 pt-8 sm:px-10 ${wide ? 'max-w-[1480px] lg:px-12' : 'max-w-[1100px] lg:px-16'}`}>
          <Outlet />
        </div>
      </main>
    </div>
  )
}
