import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import AppShell from './components/AppShell'
import Landing from './pages/Landing'
import AuthScreen from './pages/AuthScreen'
import Dashboard from './pages/Dashboard'
import Trades from './pages/Trades'
import TradeDetail from './pages/TradeDetail'
import TradeForm from './pages/TradeForm'
import Analytics from './pages/Analytics'
import Summary from './pages/Summary'
import Calendar from './pages/Calendar'
import ScreenshotImport from './pages/ScreenshotImport'
import ImportHistory from './pages/ImportHistory'
import Journal from './pages/Journal'
import Settings from './pages/Settings'

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
        <Route path="trades/new" element={<TradeForm />} />
        <Route path="trades/from-image" element={<ScreenshotImport />} />
        <Route path="trades/:id" element={<TradeDetail />} />
        <Route path="trades/:id/edit" element={<TradeForm />} />
        <Route path="analytics" element={<Analytics />} />
        <Route path="summary" element={<Summary />} />
        <Route path="calendar" element={<Calendar />} />
        <Route path="journal" element={<Journal />} />
        <Route path="import" element={<ImportHistory />} />
        <Route path="settings" element={<Settings />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
