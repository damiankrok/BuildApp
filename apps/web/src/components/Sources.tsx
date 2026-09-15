import type { JSX } from 'react'
import { useMemo, useRef, useState } from 'react'
import { SourceObservationGraphSchema, errorsOnly, graphHashIsIntact, observationsOn, validateObservationGraph } from '@buildapp/source-observations'
import type { SourceCoordinateFrame, SourceObservation, SourceObservationGraph } from '@buildapp/source-observations'
import sample from '../sample-observations.json'
import { Reconstruction } from './Reconstruction.js'

/**
 * The Sources / Observations surface.
 *
 * Read-only, and structurally so: this panel is handed no store and imports
 * no command, so there is no path from anything a viewer clicks here to the
 * CanonicalBuildingModel. That matters more than it sounds. An observation is
 * a claim about a picture, with a confidence and a tolerance; the model is a
 * building. Letting a claim become a wall by clicking on it is the mistake the
 * whole stage is arranged to prevent, and the way to prevent it is to make it
 * unavailable rather than discouraged.
 *
 * It also does not fetch. A sealed graph arrives either as the sample built
 * into this bundle or from a file the viewer opens — the same artefact the CLI
 * writes, validated here by the same schema and the same rules. BuildWorld has
 * no scraper and no extractor of its own, so "the CLI and the web app read the
 * same sources" is a property of the code rather than a promise.
 */
const CONFIDENCE_BANDS: ReadonlyArray<{ min: number; label: string }> = [
  { min: 0.8, label: 'strong' },
  { min: 0.6, label: 'fair' },
  { min: 0.4, label: 'weak' },
  { min: 0, label: 'faint' },
]

const bandOf = (confidence: number): string => CONFIDENCE_BANDS.find((b) => confidence >= b.min)?.label ?? 'faint'

const frameLabel = (f: SourceCoordinateFrame): string =>
  [f.roles.document, f.roles.view !== 'NOT_APPLICABLE' && f.roles.view !== 'UNKNOWN' ? f.roles.view : null, f.roles.storey !== 'NOT_APPLICABLE' && f.roles.storey !== 'UNKNOWN' ? f.roles.storey : null].filter(Boolean).join(' · ')

function ObservationRow({ observation }: { observation: SourceObservation }): JSX.Element {
  const [open, setOpen] = useState(false)
  const o = observation
  return (
    <li className={`obs obs-${bandOf(o.confidence)}`} data-testid="observation">
      <button className="obs-head" onClick={() => setOpen(!open)} title={o.provenance.detail}>
        <span className="obs-kind">{o.kind}</span>
        {o.semanticHints.filter((h) => h !== 'unknown').map((h) => (
          <span key={h} className="tag">
            {h}
          </span>
        ))}
        <span className="obs-conf">
          {o.confidence.toFixed(2)} ±{o.uncertainty.positionPx}px
        </span>
        <span className={`tag extractor-${o.provenance.extractor}`}>{o.provenance.extractor === 'VISION_MODEL' ? 'vision' : o.provenance.extractor === 'DERIVED' ? 'derived' : 'cv'}</span>
      </button>
      {open ? (
        <div className="obs-body">
          <div className="kv">
            <span className="k">evidence</span>
            <span className="v">{o.provenance.detail}</span>
          </div>
          <div className="kv">
            <span className="k">from</span>
            <span className="v">{o.provenance.name}</span>
          </div>
          <div className="kv">
            <span className="k">shape</span>
            <span className="v">{o.pixelGeometry.type}</span>
          </div>
          {o.value ? (
            <div className="kv">
              <span className="k">value</span>
              <span className="v">
                {o.value.number ?? o.value.text} {o.value.unit}
              </span>
            </div>
          ) : null}
          <div className="kv">
            <span className="k">depth</span>
            <span className="v">{o.depthLayer}</span>
          </div>
          {o.uncertainty.reason ? (
            <div className="kv">
              <span className="k">why unsure</span>
              <span className="v">{o.uncertainty.reason}</span>
            </div>
          ) : null}
          {o.alternatives.map((alt, i) => (
            <div className="kv" key={i}>
              <span className="k">also fits</span>
              <span className="v">
                {alt.why} ({alt.confidence.toFixed(2)})
              </span>
            </div>
          ))}
          <div className="kv">
            <span className="k">id</span>
            <span className="v mono">{o.id}</span>
          </div>
        </div>
      ) : null}
    </li>
  )
}

export function Sources(): JSX.Element {
  const [graph, setGraph] = useState<SourceObservationGraph>(() => SourceObservationGraphSchema.parse(sample))
  const [source, setSource] = useState('the sample built into this build')
  const [error, setError] = useState<string | null>(null)
  const [frameId, setFrameId] = useState<string | null>(null)
  const [kind, setKind] = useState<string>('ALL')
  const fileRef = useRef<HTMLInputElement>(null)

  const issues = useMemo(() => validateObservationGraph(graph, { checkIds: true, checkHash: true }), [graph])
  const frame = useMemo(() => graph.coordinateFrames.find((f) => f.id === frameId) ?? graph.coordinateFrames[0], [graph, frameId])
  const observations = useMemo(() => (frame ? observationsOn(graph, frame.id) : []), [graph, frame])
  const kinds = useMemo(() => [...new Set(observations.map((o) => o.kind))].sort(), [observations])
  const shown = useMemo(() => observations.filter((o) => kind === 'ALL' || o.kind === kind).sort((a, b) => b.confidence - a.confidence || a.id.localeCompare(b.id)), [observations, kind])

  const onFile = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      try {
        const parsed = SourceObservationGraphSchema.parse(JSON.parse(String(reader.result)))
        const errors = errorsOnly(validateObservationGraph(parsed, { checkIds: true, checkHash: true }))
        if (errors.length > 0) throw new Error(`${errors.length} validation error(s): ${errors[0].code} on ${errors[0].subject}`)
        setGraph(parsed)
        setSource(file.name)
        setFrameId(null)
        setError(null)
      } catch (err) {
        setError((err as Error).message)
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="sources" data-testid="sources">
      <Reconstruction />
      <div className="panel-title">
        Sources / Observations
        <span className="readonly" data-testid="sources-readonly">
          read-only
        </span>
      </div>

      <div className="sources-note">What was SEEN in the published drawings. Evidence, not edits — nothing on this panel can change the building.</div>

      <div className="sources-meta">
        <div className="kv">
          <span className="k">graph</span>
          <span className="v mono" data-testid="sources-graph-id">
            {graph.id}
          </span>
        </div>
        <div className="kv">
          <span className="k">hash</span>
          <span className="v mono" data-testid="sources-hash">
            {graph.contentHash.slice(0, 16)}… {graphHashIsIntact(graph) ? '✓ intact' : '✗ stale'}
          </span>
        </div>
        <div className="kv">
          <span className="k">package</span>
          <span className="v mono">{graph.sourcePackageId}</span>
        </div>
        <div className="kv">
          <span className="k">loaded from</span>
          <span className="v">{source}</span>
        </div>
        <div className="kv">
          <span className="k">extractors</span>
          <span className="v">{graph.extractors.map((e) => `${e.name}@${e.version}`).join(', ')}</span>
        </div>
        <div className="kv">
          <span className="k">validation</span>
          <span className="v" data-testid="sources-validation">
            {issues.filter((i) => i.severity === 'ERROR').length} errors, {issues.filter((i) => i.severity === 'WARN').length} warnings
          </span>
        </div>
      </div>

      <div className="sources-controls">
        <select data-testid="sources-frame" value={frame?.id ?? ''} onChange={(e) => setFrameId(e.target.value)}>
          {graph.coordinateFrames.map((f) => (
            <option key={f.id} value={f.id}>
              {frameLabel(f)} — {f.size.width}×{f.size.height}
            </option>
          ))}
        </select>
        <select data-testid="sources-kind" value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="ALL">all kinds ({observations.length})</option>
          {kinds.map((k) => (
            <option key={k} value={k}>
              {k} ({observations.filter((o) => o.kind === k).length})
            </option>
          ))}
        </select>
        <button data-testid="sources-open" onClick={() => fileRef.current?.click()} title="Open a sealed observation graph written by observations:extract">
          Open graph…
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} data-testid="sources-file" onChange={onFile} />
      </div>
      {error ? (
        <div className="sources-error" data-testid="sources-error">
          refused: {error}
        </div>
      ) : null}

      <ul className="obs-list" data-testid="sources-observations">
        {shown.map((o) => (
          <ObservationRow key={o.id} observation={o} />
        ))}
        {shown.length === 0 ? <li className="obs-empty">nothing of this kind was observed on this drawing</li> : null}
      </ul>

      {graph.conflicts.length > 0 ? (
        <div className="sources-section">
          <div className="sources-subtitle">readings that cannot both be right</div>
          {graph.conflicts.map((c) => (
            <div className="kv" key={c.id}>
              <span className="k">{c.kind}</span>
              <span className="v">{c.what}</span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="sources-section">
        <div className="sources-subtitle" data-testid="sources-gaps-title">
          what the analyzer says it does not know ({graph.unresolved.length})
        </div>
        {graph.unresolved.slice(0, 40).map((u) => (
          <div className="kv" key={u.id}>
            <span className="k">{u.status}</span>
            <span className="v">{u.what}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
