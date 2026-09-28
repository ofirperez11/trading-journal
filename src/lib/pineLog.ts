import type { Bias, ChartMove, Liquidity, TradeSide, Zone } from '../types'
import { LOOKBACKS, SESSION_TIMES, type SessionTime } from './lookback'
import { parseChartMove } from './chartMove'
import { toDayKind } from './dayKind'

// Parser for the trade reports that the "full auto NOD indicator" writes to
// TradingView's Pine Logs. Accepts text pasted straight from Pine Logs or the
// CSV that Pine Logs exports (quoted multi-line cells) — both are split on the
// report's "══════" separator line.

export type PineResult = 'target' | 'stop' | 'be' | 'eod' | 'unfilled' | 'unknown'

export interface PineTrade {
  key: string // day|session|side — one report per opportunity+direction
  day: string // YYYY-MM-DD
  session: SessionTime
  fillTime: string | null // HH:MM (Israel time)
  symbol: string // MNQ / MES / …
  side: TradeSide
  entry: number
  stop: number | null
  stopPts: number | null
  target: number | null
  rr: string | null // e.g. "1:4"
  result: PineResult
  resultPts: number | null
  exit: number | null
  lookback: string | null // a marker from LOOKBACKS, e.g. '19:30' / 'פתיל 90'
  lookbackRaw: string
  lookbackSize: number | null // "גודל Lookback: 3.50 נק'" — points
  bias: Bias | null
  baseRaw: string
  liquidity: Liquidity | null
  liquidityGuessed: boolean // both sides were taken → chosen by trade direction
  liqRaw: string
  zone: Zone | null
  zoneRaw: string
  dayKind: string
  week: string
  beRaw: string
  htfRaw: string
  chartMove: ChartMove | null // "מהלך גרף" block — for/against points per timeframe
  warnings: string[]
}

const SEP = /═{5,}/
// Invisible direction marks (RLM/LRM, embeddings, isolates) that Pine Logs puts
// at the start of Hebrew lines — they break the "label:" / "📝" prefix checks.
const BIDI_MARKS = /[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g

/** Value of a "label: value" line; strips a trailing CSV quote. */
function field(lines: string[], label: string): string {
  const line = lines.find((l) => l.startsWith(label + ':'))
  if (!line) return ''
  return line.slice(label.length + 1).trim().replace(/"+$/, '').trim()
}

function toNum(s: string | undefined): number | null {
  if (s == null) return null
  const n = Number(s.replace(/,/g, ''))
  return Number.isFinite(n) ? n : null
}

function hhmmToMin(t: string): number {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
function minToHhmm(m: number): string {
  const x = ((m % 1440) + 1440) % 1440
  return `${Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`
}
/** "04:30" → "4:30" (the journal's lookback labels have no leading zero). */
function normTime(t: string): string {
  return minToHhmm(hhmmToMin(t))
}

// In the US/Israel DST-gap weeks every Israel-time label is one hour earlier
// (16:30 → 15:30), so a label that doesn't match is retried one hour later.
function resolveSession(t: string): SessionTime | null {
  const n = normTime(t)
  if ((SESSION_TIMES as readonly string[]).includes(n)) return n as SessionTime
  const shifted = minToHhmm(hhmmToMin(n) + 60)
  if ((SESSION_TIMES as readonly string[]).includes(shifted)) return shifted as SessionTime
  return null
}
function resolveLookback(t: string, session: SessionTime): string | null {
  const list = LOOKBACKS[session]
  const n = normTime(t)
  if (list.includes(n)) return n
  const shifted = minToHhmm(hhmmToMin(n) + 60)
  return list.includes(shifted) ? shifted : null
}

/** "6H (פתיל + גוף) + 3H (גוף)" → '6-3_wn'. The indicator may also write it in
 * English: "3H (body) + 90m (wick + body)" — "wick" = פתיל, "90m" = "90 דק". */
export function parseBias(base: string): Bias | null {
  const w = (s: string) => (/פתיל|wick/i.test(s) ? 'w' : 'n')
  let m = base.match(/6H \(([^)]+)\) \+ 3H \(([^)]+)\)/)
  if (m) return `6-3_${w(m[1])}${w(m[2])}` as Bias
  m = base.match(/3H \(([^)]+)\) \+ 90 ?(?:דק|m) \(([^)]+)\)/)
  if (m) return `3b90_${w(m[1])}${w(m[2])}` as Bias
  m = base.match(/3H \(([^)]+)\) \+ (?:פתיל 90|wick 90)/i)
  if (m) return `3w90_${w(m[1])}` as Bias
  m = base.match(/6H \(([^)]+)\) \+ 90 ?(?:דק|m) \(([^)]+)\)/)
  if (m) return `6b90_${w(m[1])}${w(m[2])}` as Bias
  return null
}

function parseLiquidity(raw: string, side: TradeSide): { liquidity: Liquidity | null; guessed: boolean } {
  if (!raw) return { liquidity: null, guessed: false }
  const sell = /Sell Side:\s*כן/.test(raw)
  const buy = /Buy Side:\s*כן/.test(raw)
  if (sell && buy) return { liquidity: side === 'LONG' ? 'sellside' : 'buyside', guessed: true }
  if (sell) return { liquidity: 'sellside', guessed: false }
  if (buy) return { liquidity: 'buyside', guessed: false }
  return { liquidity: 'none', guessed: false }
}

function parseZone(raw: string): Zone | null {
  if (/Premium/i.test(raw)) return 'premium'
  if (/Discount/i.test(raw)) return 'discount'
  if (/Equilibrium/i.test(raw)) return 'deadzone'
  return null
}

function parseOne(chunk: string): PineTrade | null {
  const lines = chunk
    .split(/\r?\n/)
    .map((l) => l.replace(BIDI_MARKS, '').trim().replace(/^"+/, '').trim())
    .filter(Boolean)
  const header = lines.find((l) => l.startsWith('📝'))
  if (!header) return null
  const hm = header.match(/📝\s*(LONG|SHORT)\s+(\d{1,2}:\d{2})/)
  if (!hm) return null // e.g. an old "אין עסקה" line
  const side = hm[1] as TradeSide
  const warnings: string[] = []

  const session = resolveSession(hm[2])
  if (!session) warnings.push(`שעת הזדמנות לא מוכרת: ${hm[2]}`)

  const dm = field(lines, 'תאריך').match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)
  if (!dm) return null
  const day = `${dm[3]}-${dm[2].padStart(2, '0')}-${dm[1].padStart(2, '0')}`

  const entry = toNum(field(lines, 'מחיר כניסה'))
  if (entry == null) return null

  const fillM = field(lines, 'שעת כניסה').match(/(\d{1,2}:\d{2})/)
  const fillTime = fillM ? fillM[1] : null

  const stopM = field(lines, 'סטופ').match(/([\d.]+)\s*נק'?\s*\(([\d.,]+)\)/)
  const stopPts = stopM ? toNum(stopM[1]) : null
  const stop = stopM ? toNum(stopM[2]) : null

  const tgtM = field(lines, 'מחיר יציאה').match(/([\d.,]+)\s*(?:\((1:[\d.]+)\))?/)
  const target = tgtM ? toNum(tgtM[1]) : null
  const rr = tgtM?.[2] ?? null

  const resRaw = field(lines, 'תוצאה')
  const result: PineResult = resRaw.includes('טרגט')
    ? 'target'
    : resRaw.includes('סטופ')
      ? 'stop'
      : resRaw.includes('ברייק')
        ? 'be'
        : resRaw.includes('נסגר')
          ? 'eod'
          : resRaw.includes('לא מולא')
            ? 'unfilled'
            : 'unknown'
  const ptsM = resRaw.match(/([+-]?\d+(?:\.\d+)?)\s*$/)
  const resultPts = ptsM ? toNum(ptsM[1]) : null
  const dir = side === 'LONG' ? 1 : -1
  const exit =
    result === 'target' && target != null
      ? target
      : result === 'stop' && stop != null
        ? stop
        : resultPts != null
          ? Math.round((entry + dir * resultPts) * 100) / 100
          : null
  if (result === 'unknown') warnings.push('לא זוהתה תוצאה')
  if (result === 'unfilled') warnings.push('העסקה לא מולאה')

  const lookbackRaw = field(lines, 'Lookback')
  let lookback: string | null = null
  if (session) {
    if (lookbackRaw.includes('פתיל 90')) lookback = 'פתיל 90'
    else {
      const lm = lookbackRaw.match(/(\d{1,2}:\d{2})/)
      if (lm) lookback = resolveLookback(lm[1], session)
    }
    if (lookbackRaw && !lookback) warnings.push(`לוקבק לא מוכר: ${lookbackRaw}`)
  }

  const baseRaw = field(lines, 'בייס')
  const bias = parseBias(baseRaw)
  if (baseRaw && baseRaw !== '—' && !bias) warnings.push('זוג הביאס לא זוהה')

  const liqRaw = field(lines, 'נזילות שנלקחה')
  const { liquidity, guessed } = parseLiquidity(liqRaw, side)

  const zoneRaw = field(lines, 'אזור (Dealing Range)')
  const zone = parseZone(zoneRaw)

  const rawSymbol = field(lines, 'סימבול')
  const symbol = rawSymbol.replace(/\d*!$/, '').replace(/\d+$/, '') || rawSymbol

  return {
    key: `${day}|${session ?? hm[2]}|${side}`,
    day,
    session: session ?? '16:30',
    fillTime,
    symbol,
    side,
    entry,
    stop,
    stopPts,
    target,
    rr,
    result,
    resultPts,
    exit,
    lookback,
    lookbackRaw,
    lookbackSize: toNum(field(lines, 'גודל Lookback').match(/-?[\d.,]+/)?.[0]),
    bias,
    baseRaw,
    liquidity,
    liquidityGuessed: guessed,
    liqRaw,
    zone,
    zoneRaw,
    dayKind: field(lines, 'סוג יום'),
    week: field(lines, 'שבוע בחודש'),
    beRaw: field(lines, 'ברייק-איבן'),
    htfRaw: field(lines, 'ביאס (HTF 6H/3H)'),
    chartMove: parseChartMove(lines),
    warnings,
  }
}

/** Parse every report in a Pine Logs paste / CSV export. Duplicates (same day,
 * opportunity and direction) collapse to one — Replay can log a report twice. */
export function parsePineLogs(text: string): PineTrade[] {
  const out = new Map<string, PineTrade>()
  for (const chunk of text.split(SEP)) {
    const t = parseOne(chunk)
    if (t && !out.has(t.key)) out.set(t.key, t)
  }
  return [...out.values()].sort((a, b) => (a.day + a.session).localeCompare(b.day + b.session))
}

/** "… (שיא לונדון, שיא אסיה)" → "שיא לונדון, שיא אסיה" — the detail beyond the field. */
const inParens = (s: string) =>
  [...s.matchAll(/\(([^)]*)\)/g)]
    .map((m) => m[1].trim())
    .filter(Boolean)
    .join(' · ')

/**
 * Notes stored with the imported trade — only what no trade field holds.
 * Fill time, lookback, bias, week, day kind (a tag) and stop/target are fields
 * already; for liquidity and zone only the extra detail (which highs, % in
 * range) is kept.
 */
export function pineNotes(t: PineTrade): string {
  const rows = [
    'יובא מ-Pine Logs (full auto NOD indicator)',
    t.beRaw ? `ברייק-איבן: ${t.beRaw}` : '',
    inParens(t.liqRaw) ? `נזילות: ${inParens(t.liqRaw)}` : '',
    inParens(t.zoneRaw) ? `מיקום בטווח: ${inParens(t.zoneRaw)}` : '',
    t.htfRaw ? `ביאס HTF: ${t.htfRaw}` : '',
  ]
  return rows.filter(Boolean).join('\n')
}

/** Short tags for filtering later (piece type, day kind). */
export function pineTags(t: PineTrade): string[] {
  const tags = ['NOD']
  const piece = t.lookbackRaw.includes('גאפ') ? 'גאפ' : t.lookbackRaw.includes('פתיל') ? 'פתיל' : t.lookbackRaw ? 'גוף' : ''
  if (piece) tags.push(`LB ${piece}`)
  const tf = t.lookbackRaw.match(/(\d+)ד/)
  if (tf) tags.push(`LB ${tf[1]}m`)
  const kind = toDayKind(t.dayKind.replace(/\s*[🤖🏔🔘]/gu, ''))
  if (kind) tags.push(kind)
  return tags
}
