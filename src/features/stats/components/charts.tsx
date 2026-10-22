import { useEffect, useRef, useState } from 'react'
import type { MouseEvent, ReactNode } from 'react'
import { fmtShort } from '../format'
import { SERIES_COLORS } from '../colors'

const POSITIVE_COLOR = '#16a37f'
const NEGATIVE_COLOR = '#dc4c4c'

/** Width of an element in pixels, kept up to date when it resizes */
const useWidth = <T extends HTMLElement>() => {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return { ref, width }
}

/** Round axis maximum and ticks: 0, 10k, 20k ... */
const niceTicks = (min: number, max: number, count = 4): number[] => {
  const span = max - min || 1
  const raw = span / count
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map(m => m * magnitude).find(s => s >= raw) ?? raw
  const ticks: number[] = []
  for (let t = Math.floor(min / step) * step; t <= Math.ceil(max / step) * step + step / 2; t += step) ticks.push(t)
  return ticks
}

/** Rectangle with rounded top corners, so bars are anchored flat on the baseline */
const topRoundedBar = (x: number, y: number, w: number, h: number, r: number) => {
  const radius = Math.min(r, h, w / 2)
  return `M${x},${y + h}V${y + radius}Q${x},${y} ${x + radius},${y}H${x + w - radius}Q${x + w},${y} ${x + w},${y + radius}V${y + h}Z`
}

function Tooltip({ x, y, children }: { x: number; y: number; children: ReactNode }) {
  return (
    <div className="stats-tooltip" style={{ left: x, top: y }}>
      {children}
    </div>
  )
}

export interface Series {
  key: string
  label: string
  color: string
}

export function Legend({ series }: { series: Series[] }) {
  return (
    <div className="stats-legend">
      {series.map(s => (
        <span key={s.key} className="stats-legend-item">
          <span className="stats-legend-swatch" style={{ background: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  )
}

interface ColumnChartProps {
  labels: string[]
  series: Series[]
  /** values[category][series] */
  values: number[][]
  formatValue: (n: number) => string
  height?: number
}

/** Vertical bars, stacked when there is more than one series */
export function ColumnChart({ labels, series, values, formatValue, height = 240 }: ColumnChartProps) {
  const { ref, width } = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const margin = { top: 20, right: 8, bottom: 26, left: 40 }
  const innerW = Math.max(0, width - margin.left - margin.right)
  const innerH = height - margin.top - margin.bottom
  const totals = values.map(v => v.reduce((a, b) => a + b, 0))
  const ticks = niceTicks(0, Math.max(...totals, 1))
  const top = ticks[ticks.length - 1]
  const y = (n: number) => margin.top + innerH - (n / top) * innerH
  const band = innerW / labels.length
  const barW = Math.min(44, band * 0.6)

  return (
    <div className="stats-chart" ref={ref} onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Column chart">
          {ticks.map(t => (
            <g key={t}>
              <line className="stats-grid-line" x1={margin.left} x2={width - margin.right} y1={y(t)} y2={y(t)} />
              <text className="stats-axis-label" x={margin.left - 8} y={y(t)} dy="0.32em" textAnchor="end">{fmtShort(t)}</text>
            </g>
          ))}
          {labels.map((label, i) => {
            const x = margin.left + band * i + (band - barW) / 2
            let base = 0
            const lastIndex = values[i].reduce((last, v, s) => (v > 0 ? s : last), -1)
            return (
              <g key={label}>
                {/* Wide invisible target so thin bars are easy to hover */}
                <rect x={margin.left + band * i} y={margin.top} width={band} height={innerH} fill="transparent" onMouseEnter={() => setHover(i)} />
                {values[i].map((v, s) => {
                  if (v <= 0) return null
                  const y0 = y(base)
                  base += v
                  const y1 = y(base)
                  // 2px gap between stacked segments
                  const h = Math.max(0, y0 - y1 - (s === 0 ? 0 : 2))
                  return s === lastIndex
                    ? <path key={s} d={topRoundedBar(x, y1, barW, h, 4)} fill={series[s].color} opacity={hover === null || hover === i ? 1 : 0.45} pointerEvents="none" />
                    : <rect key={s} x={x} y={y1} width={barW} height={h} fill={series[s].color} opacity={hover === null || hover === i ? 1 : 0.45} pointerEvents="none" />
                })}
                <text className="stats-axis-label" x={x + barW / 2} y={height - 8} textAnchor="middle">{label}</text>
              </g>
            )
          })}
          <line className="stats-baseline" x1={margin.left} x2={width - margin.right} y1={y(0)} y2={y(0)} />
        </svg>
      )}
      {hover !== null && (
        <Tooltip x={Math.min(margin.left + band * hover + band / 2, width - 90)} y={y(totals[hover]) - 8}>
          <strong>{labels[hover]}</strong>
          {series.length > 1 && series.map((s, idx) => (
            <span key={s.key} className="stats-tooltip-row">
              <span className="stats-legend-swatch" style={{ background: s.color }} />
              {s.label}: {formatValue(values[hover][idx])}
            </span>
          ))}
          <span className="stats-tooltip-row">{series.length > 1 ? 'Total: ' : ''}{formatValue(totals[hover])}</span>
        </Tooltip>
      )}
    </div>
  )
}

interface LinePoint {
  label: string
  value: number
  detail?: ReactNode
}

/** A single line with a zero line and a hover crosshair */
export function LineChart({ points, height = 260 }: { points: LinePoint[]; height?: number }) {
  const { ref, width } = useWidth<HTMLDivElement>()
  const [hover, setHover] = useState<number | null>(null)

  const margin = { top: 12, right: 12, bottom: 26, left: 44 }
  const innerW = Math.max(0, width - margin.left - margin.right)
  const innerH = height - margin.top - margin.bottom
  const ticks = niceTicks(Math.min(0, ...points.map(p => p.value)), Math.max(0, ...points.map(p => p.value)))
  const lo = ticks[0]
  const hi = ticks[ticks.length - 1]
  const x = (i: number) => margin.left + (points.length > 1 ? (i / (points.length - 1)) * innerW : innerW / 2)
  const y = (n: number) => margin.top + innerH - ((n - lo) / (hi - lo || 1)) * innerH
  const last = points[points.length - 1]
  const lineColor = last && last.value < 0 ? NEGATIVE_COLOR : POSITIVE_COLOR
  const labelEvery = Math.max(1, Math.ceil(points.length / Math.max(1, Math.floor(innerW / 90))))

  const handleMove = (event: MouseEvent<SVGSVGElement>) => {
    if (points.length === 0) return
    const box = event.currentTarget.getBoundingClientRect()
    const rel = (event.clientX - box.left - margin.left) / (innerW || 1)
    setHover(Math.max(0, Math.min(points.length - 1, Math.round(rel * (points.length - 1)))))
  }

  if (points.length === 0) return <p className="stats-empty">No ring sessions this week.</p>

  return (
    <div className="stats-chart" ref={ref} onMouseLeave={() => setHover(null)}>
      {width > 0 && (
        <svg width={width} height={height} onMouseMove={handleMove} role="img" aria-label="Line chart">
          {ticks.map(t => (
            <g key={t}>
              <line className={t === 0 ? 'stats-baseline' : 'stats-grid-line'} x1={margin.left} x2={width - margin.right} y1={y(t)} y2={y(t)} />
              <text className="stats-axis-label" x={margin.left - 8} y={y(t)} dy="0.32em" textAnchor="end">{fmtShort(t)}</text>
            </g>
          ))}
          {points.map((p, i) => i % labelEvery === 0 && (
            <text key={i} className="stats-axis-label" x={x(i)} y={height - 8} textAnchor="middle">{p.label}</text>
          ))}
          {hover !== null && <line className="stats-crosshair" x1={x(hover)} x2={x(hover)} y1={margin.top} y2={margin.top + innerH} />}
          <polyline fill="none" stroke={lineColor} strokeWidth={2} strokeLinejoin="round" points={points.map((p, i) => `${x(i)},${y(p.value)}`).join(' ')} />
          {hover !== null && <circle cx={x(hover)} cy={y(points[hover].value)} r={5} fill={lineColor} stroke="#fff" strokeWidth={2} />}
          <circle cx={x(points.length - 1)} cy={y(last.value)} r={4} fill={lineColor} />
        </svg>
      )}
      {hover !== null && (
        <Tooltip x={Math.min(Math.max(x(hover), 90), width - 90)} y={y(points[hover].value) - 12}>
          {points[hover].detail}
        </Tooltip>
      )}
    </div>
  )
}

interface BarRow {
  key: string
  label: string
  value: number
  valueLabel: string
  onClick?: () => void
}

/** Horizontal bars, all positive, biggest first */
export function BarList({ rows, color = SERIES_COLORS.nlh }: { rows: BarRow[]; color?: string }) {
  const max = Math.max(...rows.map(r => r.value), 1)
  return (
    <div className="stats-barlist">
      {rows.map(r => (
        <button type="button" key={r.key} className="stats-barlist-row" onClick={r.onClick} disabled={!r.onClick}>
          <span className="stats-barlist-label">{r.label}</span>
          <span className="stats-barlist-track">
            <span className="stats-barlist-bar" style={{ width: `calc((100% - 4rem) * ${r.value / max})`, background: color }} />
            <span className="stats-barlist-value">{r.valueLabel}</span>
          </span>
        </button>
      ))}
    </div>
  )
}

/** Bars growing left (losses) and right (wins) from a centre line */
export function DivergingBarList({ rows }: { rows: BarRow[] }) {
  const max = Math.max(...rows.map(r => Math.abs(r.value)), 1)
  // When every value has the same sign, the empty side is dropped so the bars get the full width
  const hasNegative = rows.some(r => r.value < 0)
  const hasPositive = rows.some(r => r.value > 0)
  const columns = hasNegative && hasPositive ? '1fr 1fr' : hasNegative ? '1fr 0' : '0 1fr'
  return (
    <div className="stats-barlist">
      {rows.map(r => {
        // Leave room next to the bar for its value label
        const share = `calc((100% - 4.5rem) * ${Math.abs(r.value) / max})`
        return (
          <button type="button" key={r.key} className="stats-barlist-row" onClick={r.onClick} disabled={!r.onClick}>
            <span className="stats-barlist-label">{r.label}</span>
            <span className="stats-diverging-track" style={{ gridTemplateColumns: columns }}>
              <span className="stats-diverging-half negative">
                {r.value < 0 && (
                  <>
                    <span className="stats-barlist-value">{r.valueLabel}</span>
                    <span className="stats-barlist-bar" style={{ width: share, background: NEGATIVE_COLOR }} />
                  </>
                )}
              </span>
              <span className="stats-diverging-half positive">
                {r.value >= 0 && (
                  <>
                    <span className="stats-barlist-bar" style={{ width: share, background: POSITIVE_COLOR }} />
                    <span className="stats-barlist-value">{r.valueLabel}</span>
                  </>
                )}
              </span>
            </span>
          </button>
        )
      })}
    </div>
  )
}

interface HeatmapProps {
  rowLabels: string[]
  columnLabels: string[]
  /** values[row][column] */
  values: number[][]
  formatTooltip: (row: number, column: number, value: number) => string
  /** Show every n-th column label */
  labelEvery?: number
}

/** Grid of cells shaded from light to dark by value (one hue) */
export function Heatmap({ rowLabels, columnLabels, values, formatTooltip, labelEvery = 3 }: HeatmapProps) {
  const [hover, setHover] = useState<{ row: number; column: number } | null>(null)
  const max = Math.max(...values.flat(), 0.01)

  return (
    <div className="stats-heatmap" onMouseLeave={() => setHover(null)}>
      <div className="stats-heatmap-grid" style={{ gridTemplateColumns: `2.6rem repeat(${columnLabels.length}, 1fr)` }}>
        {rowLabels.map((rowLabel, row) => (
          <div key={rowLabel} className="stats-heatmap-row">
            <span className="stats-heatmap-row-label">{rowLabel}</span>
            {values[row].map((value, column) => (
              <span
                key={column}
                className={`stats-heatmap-cell ${hover?.row === row && hover.column === column ? 'hovered' : ''}`}
                style={{ background: value > 0 ? `rgba(90, 103, 216, ${0.15 + 0.85 * (value / max)})` : undefined }}
                onMouseEnter={() => setHover({ row, column })}
              />
            ))}
          </div>
        ))}
        <div className="stats-heatmap-row">
          <span />
          {columnLabels.map((label, i) => (
            <span key={i} className="stats-axis-label stats-heatmap-col-label">{i % labelEvery === 0 ? label : ''}</span>
          ))}
        </div>
      </div>
      <p className="stats-heatmap-readout">
        {hover ? formatTooltip(hover.row, hover.column, values[hover.row][hover.column]) : 'Hover a cell for the details.'}
      </p>
    </div>
  )
}
