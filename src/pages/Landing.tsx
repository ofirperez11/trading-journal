import { Link } from 'react-router-dom'
import { BarChart3, ScanLine, Zap, Brain, ArrowLeft, TrendingUp } from 'lucide-react'
import { LogoWordmark } from '../components/Logo'
import { EquityCurve, sampleEquity } from '../components/EquityCurve'

const features = [
  {
    icon: BarChart3,
    title: 'אנליטיקה שמדברת',
    desc: 'Equity curve, profit factor, expectancy ו-R-multiple — יפים, ברורים, ומיידיים.',
  },
  {
    icon: ScanLine,
    title: 'עסקה מצילום מסך',
    desc: 'מעלים תמונה, היומן ממלא את הפרטים. אתה רק מאשר ושומר.',
  },
  {
    icon: Zap,
    title: 'ייבוא אוטומטי',
    desc: 'ייבוא ישיר מ-Tradovate (CSV) — בלי הקלדה ידנית של כל fill.',
  },
  {
    icon: Brain,
    title: 'משמעת ורגש',
    desc: 'תיעוד מצב רוח, עמידה בכללים ולקחים — לא רק מספרים.',
  },
]

function DashboardPreview() {
  const tiles = [
    { label: 'Net P&L', value: '+$4,210', cls: 'text-win' },
    { label: 'Win Rate', value: '61%', cls: 'text-white' },
    { label: 'Profit Factor', value: '1.94', cls: 'text-white' },
  ]
  return (
    <div className="panel overflow-hidden p-5 text-right">
      <div className="flex items-center justify-between">
        <span className="pill border-win/30 bg-win/10 text-win">
          <TrendingUp className="h-3.5 w-3.5" /> מגמה חיובית
        </span>
        <span className="text-sm font-medium text-muted">Equity Curve · 30 ימים</span>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-3">
        {tiles.map((t) => (
          <div key={t.label} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-3">
            <div className="stat-label">{t.label}</div>
            <div className={`mt-1 text-lg font-bold tabular-nums ${t.cls}`}>{t.value}</div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-2xl border border-white/[0.06] bg-white/[0.02] p-2">
        <EquityCurve data={sampleEquity} height={170} />
      </div>
    </div>
  )
}

export default function Landing() {
  return (
    <div className="min-h-full">
      {/* Nav */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <LogoWordmark />
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium text-muted hover:text-white">
            התחברות
          </Link>
          <Link to="/signup" className="btn-primary">
            התחל חינם
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-12 pt-12 lg:grid-cols-2 lg:pt-20">
        <div className="animate-fade-up text-center lg:text-right">
          <span className="pill">
            <Zap className="h-3.5 w-3.5 text-accent-2" />
            נבנה לסוחרי פיוצ'רס יומיים
          </span>
          <h1 className="mt-6 text-5xl font-extrabold leading-[1.05] tracking-tight md:text-6xl">
            היומן שהופך כל עסקה
            <br />
            <span className="text-gradient">ליתרון אמיתי</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted lg:mr-0">
            תעד, נתח והשתפר. סטטיסטיקות יפות וברורות, ייבוא אוטומטי מ-Tradovate, וניתוח עסקה מצילום מסך —
            הכל במקום אחד, על המחשב והאייפון.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 lg:justify-start">
            <Link to="/signup" className="btn-primary px-6 py-3 text-base">
              התחל לתעד — חינם
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link to="/login" className="btn-ghost px-6 py-3 text-base">
              כבר יש לי חשבון
            </Link>
          </div>
          <p className="mt-5 text-sm text-muted">בלי כרטיס אשראי · הנתונים שלך פרטיים ומאובטחים</p>
        </div>

        <div className="animate-fade-up [animation-delay:120ms]">
          <DashboardPreview />
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-bold md:text-4xl">כל מה שצריך כדי להשתפר</h2>
          <p className="mt-3 text-muted">ארבעה כלים, מטרה אחת — לסחור טוב יותר.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <div key={f.title} className="card text-right transition-transform hover:-translate-y-1">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/25 to-accent-2/15 text-white">
                <f.icon className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="panel relative overflow-hidden px-6 py-16 text-center">
          <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-[36rem] rounded-full bg-accent/20 blur-3xl" />
          <h2 className="relative text-3xl font-bold md:text-4xl">מוכן לראות את המספרים שלך באור חדש?</h2>
          <p className="relative mx-auto mt-3 max-w-md text-muted">
            הרשמה בחינם, בלי כרטיס אשראי. הנתונים שלך פרטיים ומאובטחים.
          </p>
          <Link to="/signup" className="btn-primary relative mt-7 px-7 py-3 text-base">
            צור חשבון
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-white/[0.06] py-8 text-center text-sm text-muted">
        Trading Journal · נבנה עבור סוחרים, באהבה.
      </footer>
    </div>
  )
}
