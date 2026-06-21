import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, ArrowDownRight, ArrowLeft, BookMarked } from 'lucide-react'
import { useAuth } from '../lib/auth'
import { useJournals } from '../lib/journals'
import { useTrades } from '../lib/useTrades'
import { computeStats, buildEquityCurve, formatMoney, formatPct, formatR } from '../lib/trades'
import { EquityCurve } from '../components/EquityCurve'
import { SideIndicator } from '../components/SideIndicator'

export default function Dashboard() {
  const { user } = useAuth()
  const { active } = useJournals()
  const { trades, loading } = useTrades()
  const name =
    (user?.user_metadata?.display_name as string | undefined) ?? user?.email?.split('@')[0] ?? 'Trader'

  const { stats, equity } = useMemo(
    () => ({ stats: computeStats(trades), equity: buildEquityCurve(trades) }),
    [trades],
  )

  if (loading) {
    return <div className="flex h-64 items-center justify-center text-muted">טוען את העסקאות שלך…</div>
  }

  if (trades.length === 0) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold">שלום, {name}</h1>
          <p className="text-muted">היומן הפעיל: {active.name}</p>
        </div>
        <div className="card flex flex-col items-center gap-3 py-16 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-accent/25 to-accent-2/15 text-accent-2">
            <BookMarked className="h-6 w-6" strokeWidth={1.75} />
          </div>
          <h3 className="text-lg font-semibold">היומן "{active.name}" עדיין ריק</h3>
          <p className="max-w-sm text-sm text-muted">
            כאן תופיע הסקירה ברגע שיהיו עסקאות. אפשר להוסיף עסקה ידנית, לייבא CSV מ-Tradovate, או לנתח
            צילום מסך — בשלבים הקרובים.
          </p>
        </div>
      </div>
    )
  }

  const cards = [
    {
      label: 'Net P&L',
      value: formatMoney(stats.netPnl),
      cls: stats.netPnl >= 0 ? 'text-win' : 'text-loss',
      sub: `${stats.totalTrades} עסקאות`,
    },
    { label: 'Win Rate', value: formatPct(stats.winRate), sub: `${stats.wins}W / ${stats.losses}L` },
    {
      label: 'Profit Factor',
      value: stats.profitFactor ? stats.profitFactor.toFixed(2) : '—',
      sub: 'רווח גולמי / הפסד גולמי',
    },
    {
      label: 'Avg Win / Loss',
      value: stats.avgWinLossRatio ? stats.avgWinLossRatio.toFixed(2) : '—',
      sub: `${formatMoney(stats.avgWin)} / ${formatMoney(-stats.avgLoss)}`,
    },
  ]

  const recent = trades.slice(0, 6)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">שלום, {name}</h1>
          <p className="text-muted">הנה סקירה כללית של הביצועים שלך.</p>
        </div>
        <Link to="/app/analytics" className="btn-ghost">
          אנליטיקה מלאה <ArrowLeft className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="card">
            <div className="stat-label">{c.label}</div>
            <div className={`stat-value ${c.cls ?? ''}`}>{c.value}</div>
            <div className="mt-1.5 text-xs text-muted">{c.sub}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="font-semibold">Equity Curve</h2>
          <span className="pill">{stats.totalTrades} עסקאות · P&L מצטבר</span>
        </div>
        <EquityCurve data={equity} positive={stats.netPnl >= 0} height={280} />
      </div>

      <div className="card">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">עסקאות אחרונות</h2>
          <Link to="/app/trades" className="text-sm font-medium text-accent-2 hover:underline">
            כל העסקאות
          </Link>
        </div>
        <div className="space-y-1">
          {recent.map((t) => {
            const win = t.return_amount > 0
            return (
              <Link
                key={t.id}
                to={`/app/trades/${t.id}`}
                className="group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm hover:bg-white/[0.03]"
              >
                <span className={`font-semibold tabular-nums ${win ? 'text-win' : 'text-loss'}`}>
                  {formatMoney(t.return_amount)}
                </span>
                <div className="flex items-center gap-3 text-muted">
                  {t.r_multiple != null && <span className="tabular-nums">{formatR(t.r_multiple)}</span>}
                  <SideIndicator side={t.side} />
                  <span className="font-medium text-white">{t.symbol}</span>
                  <span className="hidden w-24 text-left sm:block">
                    {new Date(t.date).toLocaleDateString('he-IL', { day: 'numeric', month: 'short' })}
                  </span>
                  {win ? (
                    <ArrowUpRight className="h-4 w-4 text-win" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-loss" />
                  )}
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </div>
  )
}
