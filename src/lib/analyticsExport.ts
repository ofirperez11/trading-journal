import type { Trade } from '../types'
import type { Analytics, Bucket } from './analytics'
import { BIAS_FULL_LABEL } from './bias'
import { CHART_MOVE_LABEL } from './chartMove'
import { dayKindOf } from './dayKind'
import { downloadCsv } from './csv'

// Export the analytics page — exactly what's on screen (date range, global
// filter and $ / points unit applied) — as one CSV that opens in Excel: a
// summary, every breakdown as its own titled table, then the trades behind it.

type Cell = string | number | null
type Rows = Cell[][]

const r2 = (v: number | null | undefined) => (v == null || !Number.isFinite(v) ? null : Math.round(v * 100) / 100)
const pct = (v: number | null | undefined) => (v == null ? null : `${Math.round(v * 100)}%`)
const LIQ: Record<string, string> = { buyside: 'Buyside', sellside: 'Sellside', none: 'לא נלקחה' }
const ZONE: Record<string, string> = { premium: 'Premium', deadzone: 'Deadzone', discount: 'Discount' }

/** A titled table followed by a blank row. */
function table(title: string, head: string[], body: Rows): Rows {
  return body.length ? [[title], head, ...body, []] : []
}
/** P&L breakdown (month, weekday, hour, asset, side). */
const pnlTable = (title: string, b: Bucket[], pnl: string) =>
  table(title, ['', pnl, 'עסקאות', 'אחוז הצלחה'], b.filter((x) => x.count).map((x) => [x.label, r2(x.value), x.count, pct(x.winRate)]))
/** Win-rate breakdown (liquidity, zone, bias…) — `value` is the win rate in %. */
const winTable = (title: string, b: Bucket[]) =>
  table(title, ['', 'אחוז הצלחה', 'עסקאות'], b.map((x) => [x.label, `${x.value}%`, x.count]))

export interface AnalyticsExportMeta {
  journal: string
  range: string // the period label, e.g. "הכל" / "90 יום"
  filters: number // active global-filter selections
  unit: 'usd' | 'pts'
}

export function exportAnalyticsCsv(a: Analytics, trades: Trade[], meta: AnalyticsExportMeta): void {
  const pnl = meta.unit === 'pts' ? 'P&L (נק׳)' : 'P&L ($)'
  const now = new Date() // local date — toISOString() is UTC and reads as yesterday after midnight in Israel
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

  const rows: Rows = [
    ...table('סיכום', ['מדד', 'ערך'], [
      ['יומן', meta.journal],
      ['תקופה', meta.range],
      ['סינונים פעילים', meta.filters],
      ['יחידה', meta.unit === 'pts' ? 'נקודות' : 'דולרים'],
      ['תאריך ייצוא', today],
      ['עסקאות', a.totalTrades],
      ['זכיות / הפסדים / תיקו', `${a.wins} / ${a.losses} / ${a.washes}`],
      ['אחוז הצלחה', pct(a.winRate)],
      [`רווח נקי ${pnl}`, r2(a.netPnl)],
      ['רווח גולמי', r2(a.grossProfit)],
      ['הפסד גולמי', r2(a.grossLoss)],
      ['Profit Factor', r2(a.profitFactor)],
      ['תוחלת לעסקה', r2(a.expectancy)],
      ['ניצחון ממוצע', r2(a.avgWin)],
      ['הפסד ממוצע', r2(a.avgLoss)],
      ['Payoff (ניצחון / הפסד)', r2(a.payoff)],
      ['Drawdown מקסימלי', r2(-a.maxDrawdown)],
      ['העסקה הטובה', r2(a.bestTrade)],
      ['העסקה הגרועה', r2(a.worstTrade)],
      ['רצף ניצחונות', a.maxWinStreak],
      ['רצף הפסדים', a.maxLossStreak],
      ['ימי מסחר', a.tradingDays],
      ['ימים ירוקים / אדומים', `${a.winningDays} / ${a.losingDays}`],
      ['אחוז ימים ירוקים', pct(a.dayWinRate)],
      ['ממוצע יומי', r2(a.avgDailyPnl)],
    ]),
    ...pnlTable('P&L לפי חודש', a.byMonth, pnl),
    ...pnlTable('P&L לפי יום בשבוע', a.byWeekday, pnl),
    ...pnlTable('P&L לפי שעת כניסה', a.byHour, pnl),
    ...pnlTable('לפי נכס', a.bySymbol, pnl),
    ...pnlTable('לונג מול שורט', a.bySide, pnl),
    ...table('לפי מודל כניסה (Lookback)', ['', 'R ממוצע', 'עסקאות', 'אחוז הצלחה'], a.byLookback.map((x) => [x.label, r2(x.value), x.count, pct(x.winRate)])),
    ...a.lookbackSize.flatMap((s) => winTable(`${s.asset} · אחוז הצלחה לפי גודל Lookback`, s.buckets)),
    ...winTable('אחוז הצלחה לפי שבוע בחודש', a.byWeekOfMonth),
    ...winTable('לפי לקיחת נזילות', a.byLiquidity),
    ...winTable('אחוז הצלחה לפי אזור וכיוון', a.byZone),
    ...winTable('אחוז הצלחה לפי סוג יום', a.byDayKind),
    ...winTable('אחוז הצלחה לפי ביאס', a.byBias),
    ...table('התפלגות R', ['', 'עסקאות'], a.rDistribution.map((x) => [x.label, x.value])),
    ...table(
      'מהלך גרף לפי טיימפריים (ממוצע, נק׳)',
      ['גרף', 'מנצחות · בעד', 'מנצחות · נגד', 'מפסידות · בעד', 'מפסידות · נגד'],
      a.chartMove.map((x) => [CHART_MOVE_LABEL[x.tf], r2(x.win?.for), r2(x.win?.against), r2(x.loss?.for), r2(x.loss?.against)]),
    ),
    ...table(
      'MFE / MAE (ממוצע, נק׳)',
      ['נכס', 'מנצחות · MFE', 'מנצחות · MAE', 'מפסידות · MFE', 'מפסידות · MAE'],
      a.excursions.map((x) => [x.asset, r2(x.win?.mfe), r2(x.win?.mae), r2(x.loss?.mfe), r2(x.loss?.mae)]),
    ),
    ...table(
      'עסקאות',
      ['תאריך', 'שעה', 'סימבול', 'כיוון', 'סטטוס', 'כמות', 'כניסה', 'יציאה', 'סטופ', 'יעד', 'R', pnl, 'Lookback', 'נזילות', 'אזור', 'ביאס', 'שבוע בחודש', 'סוג יום'],
      [...trades]
        .sort((x, y) => x.date.localeCompare(y.date))
        .map((t) => [
          `${t.date.slice(8, 10)}/${t.date.slice(5, 7)}/${t.date.slice(0, 4)}`,
          t.date.slice(11, 16),
          t.symbol,
          t.side,
          t.status,
          t.qty,
          t.entry,
          t.exit,
          t.stoploss,
          t.target,
          r2(t.r_multiple),
          r2(t.return_amount),
          t.lookback,
          t.liquidity ? LIQ[t.liquidity] : null,
          t.zone ? ZONE[t.zone] : null,
          t.bias ? BIAS_FULL_LABEL[t.bias] : null,
          t.week_of_month,
          dayKindOf(t),
        ]),
    ),
  ]

  const [first, ...rest] = rows
  downloadCsv(`${meta.journal}-אנליטיקה-${today}.csv`, first.map((c) => (c == null ? '' : String(c))), rest)
}
