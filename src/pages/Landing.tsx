import { Link } from 'react-router-dom'
import { BarChart3, ScanLine, Zap, Brain, ArrowLeft } from 'lucide-react'
import { LogoWordmark } from '../components/Logo'
import { sampleEquity } from '../components/EquityCurve'
import { LineChart } from '../components/charts'
import { CountUp } from '../components/CountUp'

const features = [
  {
    color: '#9065b0',
    icon: BarChart3,
    title: 'אנליטיקה שמדברת',
    desc: 'Equity curve, profit factor, expectancy ו-R-multiple — יפים, ברורים, ומיידיים.',
  },
  {
    color: '#337ea9',
    icon: ScanLine,
    title: 'עסקה מצילום מסך',
    desc: 'מעלים תמונה, היומן ממלא את הפרטים. אתה רק מאשר ושומר.',
  },
  {
    color: '#d9730d',
    icon: Zap,
    title: 'ייבוא אוטומטי',
    desc: 'ייבוא ישיר מ-Tradovate (CSV) — בלי הקלדה ידנית של כל fill.',
  },
  {
    color: '#c14c8a',
    icon: Brain,
    title: 'משמעת ורגש',
    desc: 'תיעוד מצב רוח, עמידה בכללים ולקחים — לא רק מספרים.',
  },
]

function DashboardPreview() {
  const tiles = [
    { label: 'Win Rate', value: '61%', tag: 'tag-blue' },
    { label: 'Profit Factor', value: '1.94', tag: 'tag-purple' },
    { label: 'Avg R', value: '+1.7', tag: 'tag-yellow' },
  ]
  return (
    <div className="panel overflow-hidden text-right shadow-[0_24px_48px_-24px_rgba(15,15,15,.25)]">
      {/* Window chrome: breadcrumb like the app */}
      <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2.5 text-[12px] text-muted">
        <span>
          בק־טסט <span className="text-[#c7c6c3]">/</span> <span className="text-ink">דשבורד</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-win" />
          <span className="num">289 trades</span>
        </span>
      </div>

      <div className="p-5">
        <div className="text-[13px] text-muted">Net P&amp;L</div>
        <div className="num mt-1 text-4xl font-bold text-win">
          <CountUp value={137328} format={(n) => `+$${Math.round(n).toLocaleString('en-US')}`} />
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between text-[12px] text-muted">
                {t.label}
              </div>
              <div className="num mt-1 text-lg font-bold">{t.value}</div>
              <span className={`tag ${t.tag} mt-1 !text-[10px]`}>{t.label === 'Avg R' ? 'לעסקה' : 'כולל'}</span>
            </div>
          ))}
        </div>
        <div className="mt-4 rounded-lg border border-border p-3">
          <LineChart data={sampleEquity} height={150} format={(n) => `$${Math.round(n).toLocaleString('en-US')}`} showXAxis={false} />
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
          <span className="tag tag-orange !px-2.5 !py-1 !text-[13px]">
            <Zap className="h-3.5 w-3.5" />
            נבנה לסוחרי פיוצ'רס יומיים
          </span>
          <h1 className="mt-6 text-5xl font-bold leading-[1.1] md:text-6xl">
            היומן שהופך כל עסקה
            <br />
            <span className="rounded-md bg-tag-yellow px-2 [box-decoration-break:clone]">ליתרון אמיתי</span>
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted lg:mr-0">
            תעד, נתח והשתפר. סטטיסטיקות יפות וברורות, ייבוא אוטומטי מ-Tradovate, וניתוח עסקה מצילום מסך —
            הכל במקום אחד, על המחשב והאייפון.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 lg:justify-start">
            <Link to="/signup" className="btn-primary !px-5 !py-2.5 !text-base">
              התחל לתעד — חינם
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <Link to="/login" className="btn-ghost !px-5 !py-2.5 !text-base">
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
            <div key={f.title} className="card text-right transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_28px_-16px_rgba(15,15,15,.3)]">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface" style={{ color: f.color }}>
                <f.icon className="h-5 w-5" strokeWidth={2} />
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-xl bg-surface px-6 py-16 text-center">
          <h2 className="relative text-3xl font-bold md:text-4xl">מוכן לראות את המספרים שלך באור חדש?</h2>
          <p className="relative mx-auto mt-3 max-w-md text-muted">
            הרשמה בחינם, בלי כרטיס אשראי. הנתונים שלך פרטיים ומאובטחים.
          </p>
          <Link to="/signup" className="btn-primary relative mt-7 !px-6 !py-2.5 !text-base">
            צור חשבון
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-sm text-muted">
        Trading Journal · נבנה עבור סוחרים, באהבה.
      </footer>
    </div>
  )
}
