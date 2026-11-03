/**
 * SOURCE-01: the source inspection — each picture the page published, what the publisher called it, what its pixels
 * show, what the analyzer did with it and why; and on a sheet, each number read off it, its crop and its line drawn
 * on the real image, read or worked out, and what the model made of it. It shows the service's records and decides
 * nothing.
 */
import type { JSX } from 'react'
import { useState } from 'react'
import type { SourceInspectionView, SourceReadingView, SourceSheetView } from '../analyzer/client.js'

const CONTENT_LABEL: Record<string, string> = { FLOOR_PLAN: 'floor plan', ELEVATION: 'elevation', SECTION: 'section', SITE_PLAN: 'site plan', EXTERIOR_PERSPECTIVE: 'exterior view', INTERIOR: 'interior' }
const OUTCOME_LABEL: Record<string, string> = { READ: 'read', REFUSED_BY_CONTENT: 'refused: the pixels contradict the caption', NOT_READ: 'not read', NO_READER: 'kept as a source only' }

export const readingLabel = (r: SourceReadingView): string => `${r.measure.toLowerCase().replace(/_/g, ' ')} ${r.printed ? `printed “${r.rawText}”` : 'worked out (not printed)'} → ${r.value} ${r.unit}`

function Sheet({ sheet }: { sheet: SourceSheetView }): JSX.Element {
  const [selected, setSelected] = useState<string | null>(null)
  const chosen = sheet.readings.find((r) => r.id === selected)
  const stroke = Math.max(2, Math.round(sheet.width / 300))
  return (
    <details className="source-sheet" data-testid="source-sheet" data-outcome={sheet.outcome}>
      <summary>
        <span className="source-thumb">
          <img src={sheet.url} alt="" loading="lazy" width={64} />
        </span>{' '}
        <b>{sheet.claimed.document.toLowerCase().replace(/_/g, ' ')}</b>
        {sheet.content ? ` · pixels: ${CONTENT_LABEL[sheet.content.top] ?? sheet.content.top} ${Math.round(sheet.content.probability * 100)} %` : ''} · <span data-testid="source-outcome">{OUTCOME_LABEL[sheet.outcome] ?? sheet.outcome}</span>
        {sheet.readings.length > 0 ? ` · ${sheet.readings.length} readings` : ''}
      </summary>
      <div className="analyzer-detail">publisher: {sheet.claimed.basis}</div>
      <div className="analyzer-detail" data-testid="source-why">
        {sheet.reader !== 'none' ? `${sheet.reader}${sheet.side ? ` (${sheet.side.toLowerCase()}, ${String(sheet.sideBasis ?? '').toLowerCase().replace(/_/g, ' ')})` : ''}: ` : ''}
        {sheet.why}
      </div>
      <div className="source-figure" style={{ position: 'relative', maxWidth: 720 }}>
        <img src={sheet.url} alt="" style={{ width: '100%', display: 'block' }} />
        <svg viewBox={`0 0 ${sheet.width} ${sheet.height}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} data-testid="source-overlay">
          {sheet.readings.map((r) => (
            <g key={r.id} opacity={chosen && chosen.id !== r.id ? 0.25 : 1} onClick={() => setSelected(r.id)} style={{ cursor: 'pointer' }}>
              {r.line ? <line x1={r.line.x0} y1={r.line.y0} x2={r.line.x1} y2={r.line.y1} stroke={r.printed ? '#0a7' : '#c80'} strokeWidth={stroke} strokeDasharray={r.printed ? undefined : `${stroke * 3} ${stroke * 2}`} /> : null}
              {r.box ? <rect x={r.box.x0} y={r.box.y0} width={r.box.x1 - r.box.x0} height={r.box.y1 - r.box.y0} fill="none" stroke={r.use === 'USED_IN_MODEL' ? '#06c' : '#999'} strokeWidth={stroke} /> : null}
            </g>
          ))}
        </svg>
      </div>
      {chosen ? (
        <div className="analyzer-detail" data-testid="source-reading-selected">
          {readingLabel(chosen)} — {chosen.use.toLowerCase().replace(/_/g, ' ')}
          {chosen.featureId ? ` → model element ${chosen.featureId}` : ''}: {chosen.why}
        </div>
      ) : null}
      {sheet.readings.length > 0 ? (
        <ul className="source-readings">
          {sheet.readings.slice(0, 60).map((r) => (
            <li key={r.id} onClick={() => setSelected(r.id)} data-testid="source-reading" data-printed={r.printed}>
              {readingLabel(r)} · {r.use.toLowerCase().replace(/_/g, ' ')}
              {r.featureId ? ` → ${r.featureId}` : ''}
            </li>
          ))}
        </ul>
      ) : null}
    </details>
  )
}

export function SourceSheets({ sources }: { sources: SourceInspectionView }): JSX.Element {
  const c = sources.counts
  return (
    <details className="analyzer-sources" data-testid="analyzer-sources">
      <summary>
        Source sheets: {c.sheets} pictures, {c.read} read, {c.refusedByContent} refused by their pixels · {c.readings} numbers ({c.printedUsed} printed and used, {c.derived} worked out)
      </summary>
      {sources.classifier ? (
        <div className="analyzer-detail">
          pictures read by {sources.classifier.id} (head {sources.classifier.headVersion}); the pixels only take a picture away from a reader, never add one
        </div>
      ) : (
        <div className="analyzer-detail">no image encoder ran: the publisher’s captions decided alone</div>
      )}
      {sources.sheets.map((s) => (
        <Sheet key={s.assetId} sheet={s} />
      ))}
    </details>
  )
}
