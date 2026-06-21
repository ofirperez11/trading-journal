import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { TrendingUp, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { LogoWordmark } from '../components/Logo'
import { EquityCurve, sampleEquity } from '../components/EquityCurve'

const perks = [
  { icon: TrendingUp, text: 'אנליטיקה ויזואלית שמראה איפה אתה מרוויח — ואיפה לא.' },
  { icon: Sparkles, text: 'ניתוח עסקה מצילום מסך וייבוא אוטומטי מ-Tradovate.' },
  { icon: ShieldCheck, text: 'הנתונים שלך פרטיים, מאובטחים, ומסונכרנים בין כל המכשירים.' },
]

export default function AuthScreen({ mode }: { mode: 'login' | 'signup' }) {
  const { signIn, signUp, isDemo } = useAuth()
  const navigate = useNavigate()
  const isSignup = mode === 'signup'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const { error } = isSignup
      ? await signUp(email, password, name || email.split('@')[0])
      : await signIn(email, password)
    setSubmitting(false)
    if (error) {
      setError(error)
      return
    }
    navigate('/app')
  }

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden p-12 lg:flex">
        <div className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-accent/25 blur-3xl" />
        <div className="pointer-events-none absolute -left-10 bottom-0 h-72 w-72 rounded-full bg-accent-2/15 blur-3xl" />
        <Link to="/" className="relative">
          <LogoWordmark />
        </Link>
        <div className="relative">
          <h2 className="text-3xl font-bold leading-tight">
            כל עסקה היא <span className="text-gradient">נתון</span>.<br />כל נתון הוא הזדמנות להשתפר.
          </h2>
          <div className="mt-8 space-y-4 text-right">
            {perks.map((p) => (
              <div key={p.text} className="flex items-start justify-end gap-3">
                <span className="text-muted">{p.text}</span>
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.06] text-accent-2">
                  <p.icon className="h-4 w-4" strokeWidth={1.75} />
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel relative p-3">
          <EquityCurve data={sampleEquity} height={120} />
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center justify-center lg:hidden">
            <LogoWordmark />
          </Link>

          <div className="card">
            <h1 className="text-2xl font-bold">{isSignup ? 'יצירת חשבון' : 'התחברות'}</h1>
            <p className="mt-1 text-sm text-muted">
              {isSignup ? 'כמה שניות ומתחילים לתעד.' : 'טוב לראות אותך שוב.'}
            </p>

            {isDemo && (
              <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-300">
                מצב הדגמה — Supabase עוד לא מחובר. אפשר להיכנס עם כל אימייל כדי לסייר באתר.
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-6 space-y-4 text-right">
              {isSignup && (
                <div>
                  <label className="field-label" htmlFor="name">שם</label>
                  <input
                    id="name"
                    className="input"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="איך לקרוא לך?"
                    autoComplete="name"
                  />
                </div>
              )}
              <div>
                <label className="field-label" htmlFor="email">אימייל</label>
                <input
                  id="email"
                  type="email"
                  required
                  className="input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  dir="ltr"
                />
              </div>
              <div>
                <label className="field-label" htmlFor="password">סיסמה</label>
                <input
                  id="password"
                  type="password"
                  required
                  minLength={6}
                  className="input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="לפחות 6 תווים"
                  autoComplete={isSignup ? 'new-password' : 'current-password'}
                  dir="ltr"
                />
              </div>

              {error && (
                <div className="rounded-xl border border-loss/30 bg-loss/10 px-4 py-2.5 text-sm text-loss">
                  {error}
                </div>
              )}

              <button type="submit" className="btn-primary w-full py-3" disabled={submitting}>
                {submitting ? 'רגע...' : isSignup ? 'צור חשבון' : 'התחבר'}
              </button>
            </form>

            <p className="mt-6 text-center text-sm text-muted">
              {isSignup ? 'כבר יש לך חשבון?' : 'עוד אין לך חשבון?'}{' '}
              <Link to={isSignup ? '/login' : '/signup'} className="font-semibold text-accent-2 hover:underline">
                {isSignup ? 'התחבר' : 'הירשם'}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
