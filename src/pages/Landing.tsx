import { Link } from 'react-router-dom'
import { BarChart3, ScanLine, Zap, Brain, ArrowLeft } from 'lucide-react'
import { LogoWordmark } from '../components/Logo'
import { EquityCurve, sampleEquity } from '../components/EquityCurve'
import { CountUp } from '../components/CountUp'

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
    { label: 'Win Rate', value: '61%', cls: 'text-ink' },
    { label: 'Profit Factor', value: '1.94', cls: 'text-ink' },
    { label: 'Avg R', value: '+1.7', cls: 'text-win' },
  ]
  return (
    <div className="panel overflow-hidden text-right">
      {/* Terminal status bar */}
      <div className="flex items-center justify-between border-b border-black/[0.08] px-4 py-2.5">
        <span className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-wider text-muted">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-win" />
          live · MNQ
        </span>
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted">בק־טסט · 289 trades</span>
      </div>

      <div className="p-5">
        {/* The thesis: a terminal P&L readout */}
        <div className="stat-label">Net P&amp;L</div>
        <div className="mt-1 font-mono text-4xl font-semibold num text-win glow-amber">
          <CountUp value={137328} format={(n) => `+$${Math.round(n).toLocaleString('en-US')}`} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-xl border border-black/[0.08] bg-black/[0.02] p-3">
              <div className="stat-label">{t.label}</div>
              <div className={`num mt-1 text-lg font-bold ${t.cls}`}>{t.value}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-xl border border-black/[0.08] bg-black/[0.02] p-2">
          <EquityCurve data={sampleEquity} height={160} draw />
        </div>
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
          <Link to="/login" className="text-sm font-medium text-muted hover:text-ink">
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
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/25 to-accent-2/15 text-accent">
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

      <footer className="border-t border-black/[0.08] py-8 text-center text-sm text-muted">
        Trading Journal · נבנה עבור סוחרים, באהבה.
      </footer>
    </div>
  )
}
