import { useEffect, useMemo, useRef, useState } from 'react'
import type ExcelJS from 'exceljs'
import './SpreadsheetPreview.css'

interface SpreadsheetPreviewProps {
  worksheet: ExcelJS.Worksheet
}

interface GridCell {
  value: string | number | null
  bold: boolean
  fontSize?: number
  fill?: string // CSS color, e.g. "#E0E7FF"
  border: boolean
  center: boolean
  colSpan: number
  hidden: boolean // Covered by a merged cell to the left
}

interface CellPosition {
  row: number
  col: number
}

// Decimal separator of the browser's locale, so pasted numbers are read as numbers by Excel in the same locale
const DECIMAL_SEPARATOR = new Intl.NumberFormat().formatToParts(1.1).find(part => part.type === 'decimal')?.value ?? '.'

const formatValue = (value: string | number | null): string => {
  if (value === null) return ''
  if (typeof value === 'number') return String(value).replace('.', DECIMAL_SEPARATOR)
  return value
}

const columnLetter = (index: number): string => {
  let letters = ''
  for (let n = index + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters
  }
  return letters
}

const escapeHtml = (text: string): string =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const argbToCss = (argb: string | undefined): string | undefined =>
  argb && argb.length === 8 ? `#${argb.slice(2)}` : undefined

/**
 * Read values and styling from the ExcelJS worksheet into a plain grid
 */
const buildGrid = (worksheet: ExcelJS.Worksheet): { cells: GridCell[][]; columnWidths: number[] } => {
  const rowCount = worksheet.rowCount
  const colCount = worksheet.columnCount
  const cells: GridCell[][] = []

  for (let r = 1; r <= rowCount; r++) {
    const row = worksheet.getRow(r)
    const gridRow: GridCell[] = []
    for (let c = 1; c <= colCount; c++) {
      const cell = row.getCell(c)
      const rawValue = cell.value
      const value = typeof rawValue === 'number' || typeof rawValue === 'string' ? rawValue : null
      const fill = cell.fill?.type === 'pattern' && cell.fill.pattern === 'solid' ? argbToCss(cell.fill.fgColor?.argb) : undefined
      const border = cell.border ?? {}

      let colSpan = 1
      let hidden = false
      if (cell.isMerged) {
        if (cell.master !== cell) {
          hidden = true
        } else {
          while (c + colSpan <= colCount && row.getCell(c + colSpan).master === cell) colSpan++
        }
      }

      gridRow.push({
        // ExcelJS gives covered cells the merged value; they are empty in Excel
        value: value === '' || hidden ? null : value,
        bold: Boolean(cell.font?.bold),
        fontSize: cell.font?.size,
        fill,
        border: Boolean(border.top || border.left || border.bottom || border.right),
        center: cell.alignment?.horizontal === 'center',
        colSpan,
        hidden,
      })
    }
    cells.push(gridRow)
  }

  // ExcelJS widths are in characters
  const columnWidths = Array.from({ length: colCount }, (_, i) => Math.round((worksheet.getColumn(i + 1).width ?? 10) * 7 + 10))
  return { cells, columnWidths }
}

/**
 * Write both plain text (tab-separated) and HTML to the clipboard, so a paste into Excel keeps borders and headers
 */
const copyToClipboard = async (text: string, html: string): Promise<void> => {
  if (navigator.clipboard && typeof ClipboardItem !== 'undefined') {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/plain': new Blob([text], { type: 'text/plain' }),
          'text/html': new Blob([html], { type: 'text/html' }),
        }),
      ])
      return
    } catch {
      // Fall through to the copy event fallback
    }
  }
  const onCopy = (event: ClipboardEvent) => {
    event.preventDefault()
    event.clipboardData?.setData('text/plain', text)
    event.clipboardData?.setData('text/html', html)
  }
  document.addEventListener('copy', onCopy)
  try {
    if (!document.execCommand('copy')) throw new Error('Copy failed')
  } finally {
    document.removeEventListener('copy', onCopy)
  }
}

function SpreadsheetPreview({ worksheet }: SpreadsheetPreviewProps) {
  const { cells, columnWidths } = useMemo(() => buildGrid(worksheet), [worksheet])
  const rowCount = cells.length
  const colCount = columnWidths.length

  const [anchor, setAnchor] = useState<CellPosition | null>(null)
  const [focus, setFocus] = useState<CellPosition | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [copyMessage, setCopyMessage] = useState<string | null>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const messageTimeoutRef = useRef<number | undefined>(undefined)

  useEffect(() => {
    const stopDragging = () => setIsDragging(false)
    window.addEventListener('mouseup', stopDragging)
    return () => {
      window.removeEventListener('mouseup', stopDragging)
      window.clearTimeout(messageTimeoutRef.current)
    }
  }, [])

  const selection = anchor && focus ? {
    top: Math.min(anchor.row, focus.row),
    bottom: Math.max(anchor.row, focus.row),
    left: Math.min(anchor.col, focus.col),
    right: Math.max(anchor.col, focus.col),
  } : null

  const isSelected = (row: number, col: number) =>
    selection !== null && row >= selection.top && row <= selection.bottom && col >= selection.left && col <= selection.right

  const showMessage = (message: string) => {
    setCopyMessage(message)
    window.clearTimeout(messageTimeoutRef.current)
    messageTimeoutRef.current = window.setTimeout(() => setCopyMessage(null), 2000)
  }

  /**
   * Tab-separated text and an HTML table for a range of cells (inclusive)
   */
  const buildClipboardData = (top: number, bottom: number, left: number, right: number): { text: string; html: string } => {
    const textRows: string[] = []
    const htmlRows: string[] = []
    for (let r = top; r <= bottom; r++) {
      const textCells: string[] = []
      const htmlCells: string[] = []
      for (let c = left; c <= right; c++) {
        const cell = cells[r][c]
        const text = formatValue(cell.value)
        textCells.push(text)
        // A merged cell cut by the range edge is copied as separate cells
        if (cell.hidden && c !== left) continue
        const colSpan = Math.min(cell.colSpan, right - c + 1)
        const styles = ['white-space:nowrap']
        if (cell.border) styles.push('border:.5pt solid #000000')
        if (cell.bold) styles.push('font-weight:700')
        if (cell.fontSize) styles.push(`font-size:${cell.fontSize}pt`)
        if (cell.fill) styles.push(`background:${cell.fill}`)
        if (cell.center) styles.push('text-align:center')
        // Keep text that looks like a number (e.g. nickname "007") as text
        if (typeof cell.value === 'string' && /^[-+]?[\d.,\s]+$/.test(cell.value)) styles.push('mso-number-format:"\\@"')
        htmlCells.push(`<td${colSpan > 1 ? ` colspan="${colSpan}"` : ''} style='${styles.join(';')}'>${escapeHtml(text)}</td>`)
      }
      textRows.push(textCells.join('\t'))
      htmlRows.push(`<tr>${htmlCells.join('')}</tr>`)
    }
    const cols = columnWidths.slice(left, right + 1).map(width => `<col width="${width}">`).join('')
    const html = `<html><body><table style="border-collapse:collapse">${cols}${htmlRows.join('')}</table></body></html>`
    return { text: textRows.join('\r\n'), html }
  }

  const copyRange = async (top: number, bottom: number, left: number, right: number, message: string) => {
    const { text, html } = buildClipboardData(top, bottom, left, right)
    try {
      await copyToClipboard(text, html)
      showMessage(message)
    } catch (error) {
      console.error('Error copying to clipboard:', error)
      showMessage('Could not copy to clipboard')
    }
  }

  const handleCopyAll = () => {
    if (rowCount === 0 || colCount === 0) return
    copyRange(0, rowCount - 1, 0, colCount - 1, '✓ Copied the entire sheet')
  }

  const selectRange = (from: CellPosition, to: CellPosition) => {
    setAnchor(from)
    setFocus(to)
    gridRef.current?.focus()
  }

  const handleCellMouseDown = (event: React.MouseEvent, row: number, col: number) => {
    event.preventDefault()
    if (event.shiftKey && anchor) {
      setFocus({ row, col })
    } else {
      setAnchor({ row, col })
      setFocus({ row, col })
    }
    setIsDragging(true)
    gridRef.current?.focus()
  }

  const handleCellMouseEnter = (row: number, col: number) => {
    if (isDragging) setFocus({ row, col })
  }

  const handleKeyDown = (event: React.KeyboardEvent) => {
    const ctrl = event.ctrlKey || event.metaKey
    if (ctrl && event.key.toLowerCase() === 'a') {
      event.preventDefault()
      selectRange({ row: 0, col: 0 }, { row: rowCount - 1, col: colCount - 1 })
      return
    }
    if (ctrl && event.key.toLowerCase() === 'c') {
      event.preventDefault()
      if (selection) copyRange(selection.top, selection.bottom, selection.left, selection.right, '✓ Copied selection')
      return
    }
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0], ArrowDown: [1, 0], ArrowLeft: [0, -1], ArrowRight: [0, 1],
    }
    const move = moves[event.key]
    if (!move || !anchor || !focus) return
    event.preventDefault()
    const from = event.shiftKey ? focus : anchor
    const next = {
      row: Math.min(Math.max(from.row + move[0], 0), rowCount - 1),
      col: Math.min(Math.max(from.col + move[1], 0), colCount - 1),
    }
    if (event.shiftKey) {
      setFocus(next)
    } else {
      setAnchor(next)
      setFocus(next)
    }
  }

  const selectionLabel = selection
    ? `${columnLetter(selection.left)}${selection.top + 1}` +
      (selection.top !== selection.bottom || selection.left !== selection.right
        ? `:${columnLetter(selection.right)}${selection.bottom + 1}`
        : '')
    : ''
  const focusCell = focus ? cells[focus.row]?.[focus.col] : undefined

  return (
    <div className="spreadsheet-preview">
      <div className="spreadsheet-toolbar">
        <button type="button" className="copy-all-button" onClick={handleCopyAll}>
          Copy All
        </button>
        <span className="spreadsheet-hint">
          Click and drag to select cells, then press Ctrl+C. Paste with Ctrl+V into Excel.
        </span>
        {copyMessage && <span className="copy-message" role="status">{copyMessage}</span>}
      </div>

      <div className="spreadsheet-formula-bar">
        <span className="spreadsheet-cell-name">{selectionLabel}</span>
        <span className="spreadsheet-cell-value">{focusCell ? formatValue(focusCell.value) : ''}</span>
      </div>

      <div
        className="spreadsheet-grid"
        ref={gridRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <table>
          <colgroup>
            <col style={{ width: 40 }} />
            {columnWidths.map((width, i) => <col key={i} style={{ width }} />)}
          </colgroup>
          <thead>
            <tr>
              <th
                className="spreadsheet-corner"
                onMouseDown={() => selectRange({ row: 0, col: 0 }, { row: rowCount - 1, col: colCount - 1 })}
              />
              {columnWidths.map((_, col) => (
                <th
                  key={col}
                  className={selection && col >= selection.left && col <= selection.right ? 'header-active' : undefined}
                  onMouseDown={() => selectRange({ row: 0, col }, { row: rowCount - 1, col })}
                >
                  {columnLetter(col)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cells.map((row, rowIndex) => (
              <tr key={rowIndex}>
                <th
                  className={selection && rowIndex >= selection.top && rowIndex <= selection.bottom ? 'header-active' : undefined}
                  onMouseDown={() => selectRange({ row: rowIndex, col: 0 }, { row: rowIndex, col: colCount - 1 })}
                >
                  {rowIndex + 1}
                </th>
                {row.map((cell, colIndex) => {
                  if (cell.hidden) return null
                  const classNames = [
                    cell.border ? 'cell-border' : '',
                    typeof cell.value === 'number' ? 'cell-number' : '',
                    isSelected(rowIndex, colIndex) ? 'cell-selected' : '',
                    focus && focus.row === rowIndex && focus.col === colIndex ? 'cell-focus' : '',
                  ].filter(Boolean).join(' ')
                  return (
                    <td
                      key={colIndex}
                      colSpan={cell.colSpan > 1 ? cell.colSpan : undefined}
                      className={classNames || undefined}
                      style={{
                        fontWeight: cell.bold ? 700 : undefined,
                        fontSize: cell.fontSize ? `${cell.fontSize}pt` : undefined,
                        background: cell.fill,
                        textAlign: cell.center ? 'center' : undefined,
                      }}
                      onMouseDown={event => handleCellMouseDown(event, rowIndex, colIndex)}
                      onMouseEnter={() => handleCellMouseEnter(rowIndex, colIndex)}
                    >
                      {formatValue(cell.value)}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default SpreadsheetPreview
