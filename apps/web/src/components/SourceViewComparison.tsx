import type { JSX } from 'react'
import { useMemo } from 'react'
import { SEALED_CANDIDATES, sourceViewResidualsOf } from '@buildapp/candidates'
import { useSnapshot } from '../use-store.js'

/**
 * How the candidate on screen compares with the drawings it was checked on.
 *
 * The analyzer-v2 verifier projects the finished building back into each
 * source view and measures, feature by feature, where the model's edge lands
 * against the edge the drawing shows. This table is that measurement, sealed
 * beside the candidate and tied to it by hash. It is deliberately a table and
 * not a score: a reviewer wants to know WHICH sill is out and by how much,
 * and an average would hide exactly that.
 *
 * A candidate whose solver never verified against the views shows nothing
 * here. Absence is a fact about that solver, and it is not softened.
 */
/** Two decimals: a centimetre, which is finer than any tolerance in the table. The unit is in the header. */
const metres = (m: number): string => m.toFixed(2)
const signed = (m: number): string => `${m < 0 ? '−' : '+'}${Math.abs(m).toFixed(2)}`

/** The verifier's feature kinds, as a reviewer says them. */
const KIND_LABELS: Record<string, string> = { OPENING_SILL: 'sill', OPENING_HEAD: 'head', ROOF_EDGE: 'roof edge', RECESS_PLANE: 'recess', MEMBER_EDGE: 'member', SILHOUETTE_WIDTH: 'silhouette' }
const kindLabel = (kind: string): string => KIND_LABELS[kind] ?? kind.toLowerCase().replace(/_/g, ' ')

export function SourceViewComparison(): JSX.Element | null {
  const snap = useSnapshot()
  const sealed = useMemo(() => SEALED_CANDIDATES.find((c) => c.candidate.modelId === snap.model.id), [snap.model.id])
  const rows = useMemo(() => {
    if (!sealed) return null
    const residuals = sourceViewResidualsOf(sealed.id)
    if (!residuals) return null
    return [...residuals.residuals].sort((a, b) => a.kind.localeCompare(b.kind) || (a.objectId ?? a.featureId).localeCompare(b.objectId ?? b.featureId))
  }, [sealed])
  if (!sealed || !rows) return null
  const within = rows.filter((r) => r.withinTolerance).length

  return (
    <div className="source-views" data-testid="source-view-comparison">
      <div className="panel-title">
        Source views
        <span className="readonly" data-testid="source-view-summary">
          {within} of {rows.length} within tolerance
        </span>
      </div>
      <table className="svc-table">
        <colgroup>
          <col className="svc-col-kind" />
          <col className="svc-col-object" />
          <col className="svc-col-num" />
          <col className="svc-col-num" />
          <col className="svc-col-num" />
          <col className="svc-col-num" />
          <col className="svc-col-verdict" />
        </colgroup>
        <thead>
          <tr>
            <th>kind</th>
            <th>object</th>
            <th className="num">model m</th>
            <th className="num">seen m</th>
            <th className="num">Δ</th>
            <th className="num">tol.</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={`${i}-${r.frameId}-${r.featureId}-${r.kind}`} className={r.withinTolerance ? 'svc-ok' : 'svc-off'} data-testid="source-view-row" title={`${r.frameId}\n${r.why}`}>
              <td>{kindLabel(r.kind)}</td>
              <td className="mono svc-object">{r.objectId ?? r.featureId}</td>
              <td className="num">{metres(r.modelM)}</td>
              <td className="num">{metres(r.observedM)}</td>
              <td className="num">{signed(r.residualM)}</td>
              <td className="num">±{r.toleranceM.toFixed(2)}</td>
              <td className="svc-verdict">{r.withinTolerance ? 'within' : 'out'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="recon-note">Each row is one feature of this candidate projected back into a published view: the model&apos;s value, the value the drawing shows, and their difference against that feature&apos;s own uncertainty. Measured once, when the candidate was sealed.</p>
    </div>
  )
}
