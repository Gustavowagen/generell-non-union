import { useState } from 'react'
import type { ReactNode } from 'react'

interface CardProps {
  title: string
  subtitle?: string
  className?: string
  children: ReactNode
}

export function Card({ title, subtitle, className, children }: CardProps) {
  return (
    <section className={`stats-card ${className ?? ''}`}>
      <h3 className="stats-card-title">{title}</h3>
      {subtitle && <p className="stats-card-subtitle">{subtitle}</p>}
      {children}
    </section>
  )
}

interface KpiTileProps {
  label: string
  value: string
  note?: string
  valueClass?: string
}

export function KpiTile({ label, value, note, valueClass }: KpiTileProps) {
  return (
    <div className="stats-kpi">
      <span className="stats-kpi-label">{label}</span>
      <span className={`stats-kpi-value ${valueClass ?? ''}`}>{value}</span>
      {note && <span className="stats-kpi-note">{note}</span>}
    </div>
  )
}

export function KpiRow({ children }: { children: ReactNode }) {
  return <div className="stats-kpi-row">{children}</div>
}

export interface Column<T> {
  key: string
  label: string
  /** Value used for sorting (and shown, unless render is given) */
  value: (row: T) => number | string
  render?: (row: T) => ReactNode
  numeric?: boolean
}

interface SortableTableProps<T> {
  columns: Column<T>[]
  rows: T[]
  rowKey: (row: T) => string
  initialSort?: { key: string; desc: boolean }
  onRowClick?: (row: T) => void
  isRowSelected?: (row: T) => boolean
  /** Scroll inside the card instead of growing the page */
  maxHeight?: string
  emptyText?: string
}

export function SortableTable<T>({ columns, rows, rowKey, initialSort, onRowClick, isRowSelected, maxHeight, emptyText }: SortableTableProps<T>) {
  const [sort, setSort] = useState(initialSort)

  const column = columns.find(c => c.key === sort?.key)
  const sorted = column && sort
    ? [...rows].sort((a, b) => {
      const x = column.value(a)
      const y = column.value(b)
      const order = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y))
      return sort.desc ? -order : order
    })
    : rows

  const handleSort = (key: string, numeric?: boolean) => {
    // Numbers start with the biggest first, text with A first
    setSort(prev => (prev?.key === key ? { key, desc: !prev.desc } : { key, desc: Boolean(numeric) }))
  }

  return (
    <div className="stats-table-wrap" style={{ maxHeight }}>
      <table className="stats-table">
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.key} className={c.numeric ? 'numeric' : undefined}>
                <button type="button" className="stats-sort-button" onClick={() => handleSort(c.key, c.numeric)}>
                  {c.label}
                  <span className="stats-sort-arrow" aria-hidden="true">
                    {sort?.key === c.key ? (sort.desc ? '▼' : '▲') : ''}
                  </span>
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map(row => (
            <tr
              key={rowKey(row)}
              className={`${onRowClick ? 'clickable' : ''} ${isRowSelected?.(row) ? 'selected' : ''}`}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
            >
              {columns.map(c => (
                <td key={c.key} className={c.numeric ? 'numeric' : undefined}>
                  {c.render ? c.render(row) : c.value(row)}
                </td>
              ))}
            </tr>
          ))}
          {sorted.length === 0 && (
            <tr>
              <td colSpan={columns.length} className="stats-table-empty">{emptyText ?? 'Nothing to show'}</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
