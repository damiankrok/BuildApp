import type { JSX } from 'react'
import { useMemo } from 'react'
import { SEALED_CANDIDATES, candidateStatus } from '@buildapp/candidates'
import { useSnapshot } from '../use-store.js'

/**
 * What the model on screen is, when it is a reconstruction.
 *
 * A candidate looks like any other building in the viewport, and that is
 * exactly the problem: it has holes the reference does not, numbers derived
 * rather than read, and a stair it refused to invent. A viewer who cannot see
 * that is being shown a confident building that nobody has claimed is right.
 *
 * So this card is deliberately unflattering. The coverage bar is the fraction
 * of the candidate's own quantities that the drawings actually STATE, not a
 * quality score; the count of named holes is next to it; and the four hashes
 * are shown in full-width so the thing on screen can be tied back to the exact
 * bytes it came from.
 */
export function Reconstruction(): JSX.Element | null {
  const snap = useSnapshot()
  const sealed = useMemo(() => SEALED_CANDIDATES.find((c) => c.candidate.modelId === snap.model.id), [snap.model.id])
  if (!sealed) return null
  const status = candidateStatus(sealed)
  const settled = status.hard + status.soft + status.unresolvedQuantities
  const stated = settled === 0 ? 0 : status.hard / settled
  const supported = settled === 0 ? 0 : (status.hard + status.soft) / settled

  return (
    <div className="reconstruction" data-testid="reconstruction">
      <div className="panel-title">
        Reconstruction
        <span className="readonly" data-testid="reconstruction-auto">
          automatic · not final
        </span>
      </div>
      <div className="recon-bar" title="How each quantity in this candidate was settled">
        <span className="recon-seg recon-hard" style={{ width: `${(stated * 100).toFixed(1)}%` }} />
        <span className="recon-seg recon-soft" style={{ width: `${((supported - stated) * 100).toFixed(1)}%` }} />
        <span className="recon-seg recon-unresolved" style={{ width: `${((1 - supported) * 100).toFixed(1)}%` }} />
      </div>
      <ul className="recon-legend">
        <li>
          <span className="swatch recon-hard" /> {status.hard} stated by a drawing
        </li>
        <li>
          <span className="swatch recon-soft" /> {status.soft} inferred from the sources
        </li>
        <li>
          <span className="swatch recon-unresolved" /> {status.unresolvedQuantities} left to a building convention
        </li>
      </ul>
      <div className="kv">
        <span className="k">named holes</span>
        <span className="v" data-testid="recon-unresolved">
          {status.unresolved}
        </span>
      </div>
      <div className="kv">
        <span className="k">contradictions</span>
        <span className="v">{status.contradictions}</span>
      </div>
      <div className="kv">
        <span className="k">traced objects</span>
        <span className="v">{status.tracedObjects}</span>
      </div>
      <div className="kv">
        <span className="k">DSL commands</span>
        <span className="v">{status.commands}</span>
      </div>
      <div className="kv">
        <span className="k">solver</span>
        <span className="v">{status.solver}</span>
      </div>
      <div className="hashes">
        <div className="kv">
          <span className="k">source package</span>
          <span className="v mono" data-testid="recon-package-hash">
            {status.sourcePackageHash.slice(0, 16)}
          </span>
        </div>
        <div className="kv">
          <span className="k">observations</span>
          <span className="v mono">{status.observationGraphHash.slice(0, 16)}</span>
        </div>
        <div className="kv">
          <span className="k">metric evidence</span>
          <span className="v mono">{status.metricEvidenceHash.slice(0, 16)}</span>
        </div>
        <div className="kv">
          <span className="k">candidate</span>
          <span className="v mono" data-testid="recon-candidate-hash">
            {status.candidateHash.slice(0, 16)}
          </span>
        </div>
        <div className="kv">
          <span className="k">model</span>
          <span className="v mono">{status.modelHash.slice(0, 16)}</span>
        </div>
      </div>
      <p className="recon-note">
        This building was reconstructed from published drawings by the solver named above. It is a candidate: the quantities marked as conventions are not measurements, the named holes are things the
        drawings do not determine, and nothing here has been checked against a designer&apos;s intent.
      </p>
    </div>
  )
}
