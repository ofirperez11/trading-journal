import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import AppShell from './components/AppShell'
import Landing from './pages/Landing'
import AuthScreen from './pages/AuthScreen'
import Dashboard from './pages/Dashboard'
import Trades from './pages/Trades'
import TradeDetail from './pages/TradeDetail'

function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-bold">{title}</h1>
      <div className="card text-muted">{note}</div>
    </div>
  )
}

/** Gate for the in-app area: redirect to landing if not signed in. */
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-full items-center justify-center text-muted">טוען…</div>
    )
  }
  return user ? <>{children}</> : <Navigate to="/" replace />
}

/** If already signed in, public auth pages bounce to the app. */
function RedirectIfAuthed({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return null
  return user ? <Navigate to="/app" replace /> : <>{children}</>
}

export default function App() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/" element={<RedirectIfAuthed><Landing /></RedirectIfAuthed>} />
      <Route path="/login" element={<RedirectIfAuthed><AuthScreen mode="login" /></RedirectIfAuthed>} />
      <Route path="/signup" element={<RedirectIfAuthed><AuthScreen mode="signup" /></RedirectIfAuthed>} />

      {/* Protected app */}
      <Route
        path="/app"
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="trades" element={<Trades />} />
        <Route path="trades/:id" element={<TradeDetail />} />
        <Route path="analytics" element={<Placeholder title="Analytics" note="אנליטיקה מעמיקה — שלב 3." />} />
        <Route path="calendar" element={<Placeholder title="Calendar" note="לוח שנה P&L — שלב 7." />} />
        <Route path="journal" element={<Placeholder title="Journal" note="יומן רגשי ומשמעת — שלב 7." />} />
        <Route path="import" element={<Placeholder title="Import" note="ייבוא Tradovate CSV + הנתונים הקיימים — שלב 2/6." />} />
        <Route path="settings" element={<Placeholder title="Settings" note="הגדרות ופרופיל." />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
