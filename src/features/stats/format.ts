import { shiftTime } from './metrics'
import type { ClockZone } from './types'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const numberFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 })
const wholeFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })

/** 12,345.67 with a real minus sign */
export const fmt = (n: number): string => numberFormat.format(n).replace('-', '−')

/** 12,346 (rounded) */
export const fmtWhole = (n: number): string => wholeFormat.format(n).replace('-', '−')

/** +1,234.5 / −1,234.5, for results */
export const fmtSigned = (n: number, whole = false): string => {
  const text = whole ? fmtWhole(n) : fmt(n)
  return n > 0 ? `+${text}` : text
}

export const fmtPercent = (share: number): string => `${(share * 100).toFixed(1)}%`

/** 12k, 1.5k, 800: for chart axes */
export const fmtShort = (n: number): string => {
  const abs = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (abs >= 1000) return `${sign}${Number((abs / 1000).toFixed(1))}k`
  return `${sign}${Math.round(abs)}`
}

/** CSS class colouring a result green or red */
export const resultClass = (n: number): string => (n > 0 ? 'stats-positive' : n < 0 ? 'stats-negative' : '')

/** "Mon 12" from an export date "2026-10-12" */
export const fmtDay = (day: string): string => {
  const date = new Date(`${day}T00:00:00Z`)
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()}`
}

/** "12–18 Oct 2026" from the first and last export date */
export const fmtDateRange = (first: string, last: string): string => {
  const a = new Date(`${first}T00:00:00Z`)
  const b = new Date(`${last}T00:00:00Z`)
  return `${a.getUTCDate()}–${b.getUTCDate()} ${MONTHS[b.getUTCMonth()]} ${b.getUTCFullYear()}`
}

const pad = (n: number) => String(n).padStart(2, '0')

/** "Mon 12 Oct 19:23" in the chosen clock */
export const fmtTime = (timestamp: string, tz: ClockZone): string => {
  const date = shiftTime(timestamp, tz)
  return `${WEEKDAYS[date.getUTCDay()]} ${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}

/** "Mon 19:23" in the chosen clock, for chart axes */
export const fmtShortTime = (timestamp: string, tz: ClockZone): string => {
  const date = shiftTime(timestamp, tz)
  return `${WEEKDAYS[date.getUTCDay()]} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}`
}
