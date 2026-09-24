import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { TrendingUp, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { LogoWordmark } from '../components/Logo'
import { sampleEquity } from '../components/EquityCurve'
import { LineChart } from '../components/charts'

const perks = [
  { color: '#9065b0', icon: TrendingUp, text: 'אנליטיקה ויזואלית שמראה איפה אתה מרוויח — ואיפה לא.' },
  { color: '#337ea9', icon: Sparkles, text: 'ניתוח עסקה מצילום מסך וייבוא אוטומטי מ-Tradovate.' },
  { color: '#448361', icon: ShieldCheck, text: 'הנתונים שלך פרטיים, מאובטחים, ומסונכרנים בין כל המכשירים.' },
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
  const [confirmSent, setConfirmSent] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    const result = isSignup
      ? await signUp(email, password, name || email.split('@')[0])
      : await signIn(email, password)
    setSubmitting(false)
    if (result.error) {
      setError(result.error)
      return
    }
    if ('needsConfirmation' in result && result.needsConfirmation) {
      setConfirmSent(true)
      return
    }
    navigate('/app')
  }

  return (
    <div className="grid min-h-full lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden border-l border-border bg-surface p-12 lg:flex">
        <Link to="/" className="relative">
          <LogoWordmark />
        </Link>
        <div className="relative">
          <h2 className="text-3xl font-bold leading-tight">
            כל עסקה היא <span className="rounded-md bg-tag-yellow px-1.5">נתון</span>.<br />כל נתון הוא הזדמנות להשתפר.
          </h2>
          <div className="mt-8 space-y-4 text-right">
            {perks.map((p) => (
              <div key={p.text} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-bg shadow-[0_0_0_1px_#ededeb]" style={{ color: p.color }}>
                  <p.icon className="h-4 w-4" strokeWidth={2} />
                </span>
                <span className="text-[#5f5e5b]">{p.text}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel relative p-4">
          <LineChart data={sampleEquity} height={120} format={(n) => `$${Math.round(n).toLocaleString('en-US')}`} showXAxis={false} />
        </div>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center justify-center lg:hidden">
            <LogoWordmark />
          </Link>

          <div>
            <h1 className="page-title">{isSignup ? 'יצירת חשבון' : 'התחברות'}</h1>
            <p className="mt-1 text-sm text-muted">
              {isSignup ? 'כמה שניות ומתחילים לתעד.' : 'טוב לראות אותך שוב.'}
            </p>

            {isDemo && (
              <div className="mt-4 rounded-md bg-tag-yellow px-3 py-2 text-[13px] text-tag-yellow-fg">
                מצב הדגמה — Supabase עוד לא מחובר. אפשר להיכנס עם כל אימייל כדי לסייר באתר.
              </div>
            )}

            {confirmSent ? (
              <div className="mt-6 space-y-4 text-center">
                <div className="rounded-md bg-tag-green px-4 py-4 text-sm leading-relaxed text-tag-green-fg">
                  שלחנו קישור אימות אל <span className="font-semibold" dir="ltr">{email}</span>.<br />
                  פתח את המייל, לחץ על הקישור כדי להפעיל את החשבון, ואז חזור להתחבר.
                </div>
                <Link to="/login" className="inline-block text-sm text-accent hover:underline">
                  חזרה להתחברות ←
                </Link>
              </div>
            ) : (
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
                <div className="rounded-md bg-tag-red px-3 py-2 text-sm text-tag-red-fg">
                  {error}
                </div>
              )}

              <button type="submit" className="btn-primary w-full !py-2.5 !text-[15px]" disabled={submitting}>
                {submitting ? 'רגע...' : isSignup ? 'צור חשבון' : 'התחבר'}
              </button>
            </form>
            )}

            <p className="mt-6 text-center text-sm text-muted">
              {isSignup ? 'כבר יש לך חשבון?' : 'עוד אין לך חשבון?'}{' '}
              <Link to={isSignup ? '/login' : '/signup'} className="font-semibold text-accent hover:underline">
                {isSignup ? 'התחבר' : 'הירשם'}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
