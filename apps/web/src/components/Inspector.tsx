import type { JSX } from 'react'
import { useEffect, useState } from 'react'
import type { ObjectDescription, PropertySpec, TopologyDescription } from '@buildapp/editor'
import type { Evidence } from '@buildapp/model'
import { useSnapshot, useStore } from '../use-store.js'

function PropertyField({ id, spec, value }: { id: string; spec: PropertySpec; value: unknown }): JSX.Element {
  const store = useStore()
  const [draft, setDraft] = useState<string>(value === undefined || value === null ? '' : String(value))
  useEffect(() => {
    setDraft(value === undefined || value === null ? '' : String(value))
  }, [value, id])

  const commit = (): void => {
    if (spec.type === 'number') {
      const n = Number(draft)
      if (!Number.isFinite(n)) return
      if (n === value) return
      store.setProperty(id, spec.key, n)
    } else if (spec.type === 'text') {
      if (draft === (value ?? '')) return
      store.setProperty(id, spec.key, draft === '' ? undefined : draft)
    }
  }

  if (spec.type === 'select') {
    return (
      <div className="prop">
        <label>{spec.label}</label>
        <select data-testid={`prop-${spec.key}`} value={String(value ?? '')} onChange={(e) => store.setProperty(id, spec.key, e.target.value)}>
          {spec.options!.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <span className="unit" />
      </div>
    )
  }
  return (
    <div className="prop">
      <label>{spec.label}</label>
      <input
        type={spec.type === 'number' ? 'number' : 'text'}
        data-testid={`prop-${spec.key}`}
        value={draft}
        step={spec.step}
        min={spec.min}
        max={spec.max}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        }}
      />
      <span className="unit">{spec.unit ?? ''}</span>
    </div>
  )
}

function EvidenceView({ evidence, sources }: { evidence: Evidence | undefined; sources: ObjectDescription['evidenceSources'] }): JSX.Element {
  if (!evidence) {
    return (
      <div className="evidence" data-testid="inspector-evidence">
        <span className="tag status-UNRESOLVED" data-testid="inspector-evidence-status">
          no evidence
        </span>
      </div>
    )
  }
  return (
    <div className="evidence" data-testid="inspector-evidence">
      <span className={`tag status-${evidence.status}`} data-testid="inspector-evidence-status">
        {evidence.status}
      </span>
      {sources.length > 0 && (
        <div data-testid="inspector-evidence-sources">
          sources:
          <ul style={{ margin: '2px 0 4px', paddingLeft: 16 }}>
            {sources.map((src) => (
              <li key={src.id} title={src.id}>
                {src.label}
                {src.kind ? ` (${src.kind.toLowerCase()})` : ''}
              </li>
            ))}
          </ul>
        </div>
      )}
      {evidence.source && <div>source: {evidence.source}</div>}
      {evidence.locator && <div data-testid="inspector-evidence-locator">locator: {evidence.locator}</div>}
      {evidence.interpretation && <div>interpretation: {evidence.interpretation}</div>}
      {evidence.note && <div>note: {evidence.note}</div>}
      {evidence.properties &&
        Object.entries(evidence.properties).map(([k, v]) => (
          <div key={k}>
            {k}: <span className={`tag status-${v}`}>{v}</span>
          </div>
        ))}
    </div>
  )
}

const f3 = (n: number): string => n.toFixed(3)

/** Resolved wall topology, read-only: what the junction records were resolved to. */
function TopologyView({ t }: { t: TopologyDescription }): JSX.Element {
  return (
    <div className="kv" data-testid="inspector-topology">
      {t.extent && (
        <>
          <span className="k">physical outer</span>
          <span className="v" data-testid="topology-outer">
            {f3(t.extent.start.outer)} – {f3(t.extent.end.outer)} m
          </span>
          <span className="k">physical inner</span>
          <span className="v" data-testid="topology-inner">
            {f3(t.extent.start.inner)} – {f3(t.extent.end.inner)} m
          </span>
        </>
      )}
      {t.junctions?.map((j) => (
        <span key={j.id} className="v" style={{ gridColumn: '1 / -1' }}>
          {j.end ? `${j.end} ` : ''}
          {j.kind} {j.id} · {j.role.toLowerCase()} {j.ok ? '' : '· unresolved'}
        </span>
      ))}
      {t.rings && t.rings.length > 0 && (
        <>
          <span className="k">ring</span>
          <span className="v">{t.rings.join(', ')}</span>
        </>
      )}
      {t.junction && (
        <>
          <span className="k">resolved</span>
          <span className="v" data-testid="topology-junction-ok">
            {t.junction.ok ? 'yes' : 'no'}
          </span>
          {t.junction.point && (
            <>
              <span className="k">point</span>
              <span className="v">
                x {f3(t.junction.point.x)} z {f3(t.junction.point.z)}
              </span>
            </>
          )}
          {t.junction.participants.map((p) => (
            <span key={`${p.wallId}:${p.end ?? 'host'}`} className="v" style={{ gridColumn: '1 / -1' }}>
              {p.wallId}
              {p.end ? `/${p.end}` : ''} · {p.role.toLowerCase()}
              {p.cut ? ` · cut outer ${f3(p.cut.outer)} inner ${f3(p.cut.inner)}` : ''}
            </span>
          ))}
          {t.junction.contact && (
            <>
              <span className="k">contact</span>
              <span className="v">
                {t.junction.contact.face.toLowerCase()} face {f3(t.junction.contact.a0)} – {f3(t.junction.contact.a1)} m
              </span>
            </>
          )}
        </>
      )}
      {t.ringWalls && (
        <>
          <span className="k">closed</span>
          <span className="v" data-testid="topology-ring-closed">
            {t.ringClosed ? 'yes' : 'no'}
          </span>
          <span className="k">walls</span>
          <span className="v">{t.ringWalls.join(' → ')}</span>
        </>
      )}
    </div>
  )
}

export function Inspector(): JSX.Element {
  const store = useStore()
  const snap = useSnapshot()
  const id = snap.selection
  const d = id ? store.describe(id) : undefined

  if (!d || !id) {
    return (
      <div className="inspector" data-testid="inspector">
        <div className="panel-title">Inspector</div>
        <div className="empty">Select an object in the scene tree or click it in the viewport.</div>
        {snap.lastError && (
          <div className="section">
            <div className="error" data-testid="inspector-error">
              {snap.lastError}
            </div>
          </div>
        )}
      </div>
    )
  }

  const obj = d.object as Record<string, unknown>
  const visible = store.isObjectVisible(id)
  const isolated = snap.isolated === id
  return (
    <div className="inspector" data-testid="inspector">
      <div className="panel-title">Inspector</div>
      <div className="section">
        <div className="kv">
          <span className="k">kind</span>
          <span className="v" data-testid="inspector-kind">
            {d.kind}
          </span>
          <span className="k">id</span>
          <span className="v" data-testid="inspector-id">
            {d.id}
          </span>
          {d.levelId && (
            <>
              <span className="k">level</span>
              <span className="v">{d.levelId}</span>
            </>
          )}
          {d.host && (
            <>
              <span className="k">{d.host.relation}</span>
              <span className="v" data-testid="inspector-host">
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault()
                    store.select(d.host!.id)
                  }}
                  title={`select ${d.host.kind} ${d.host.id}`}
                >
                  {d.host.id}
                </a>{' '}
                <span className="unit">{d.host.kind}</span>
              </span>
            </>
          )}
          {d.hostWallId && (
            <>
              <span className="k">host wall</span>
              <span className="v" data-testid="inspector-host-wall">
                {d.hostWallId}
              </span>
            </>
          )}
          {d.openingId && (
            <>
              <span className="k">opening</span>
              <span className="v">{d.openingId}</span>
            </>
          )}
          <span className="k">meshes</span>
          <span className="v">{d.meshCount}</span>
        </div>
        <div className="actions">
          <button data-testid="btn-hide" onClick={() => store.toggleHidden(id)}>
            {visible ? 'Hide' : 'Show'}
          </button>
          <button data-testid="btn-isolate" className={isolated ? 'active' : ''} onClick={() => store.isolate(isolated ? null : id)}>
            {isolated ? 'Un-isolate' : 'Isolate'}
          </button>
          {d.kind !== 'building' && (
            <button data-testid="btn-delete" onClick={() => store.execute({ type: 'removeFeature', targetId: id })}>
              Delete
            </button>
          )}
        </div>
      </div>
      <div className="section">
        <div className="panel-title" style={{ padding: '0 0 4px' }}>
          Properties
        </div>
        {d.properties.map((p) => (
          <PropertyField key={`${id}:${p.key}`} id={id} spec={p} value={obj[p.key]} />
        ))}
        {snap.lastError && (
          <div className="error" data-testid="inspector-error">
            {snap.lastError}
          </div>
        )}
      </div>
      {d.topology && (
        <div className="section">
          <div className="panel-title" style={{ padding: '0 0 4px' }}>
            Topology
          </div>
          <TopologyView t={d.topology} />
        </div>
      )}
      <div className="section">
        <div className="panel-title" style={{ padding: '0 0 4px' }}>
          Evidence
        </div>
        <EvidenceView evidence={obj.evidence as Evidence | undefined} sources={d.evidenceSources} />
      </div>
      <div className="section">
        <div className="panel-title" style={{ padding: '0 0 4px' }}>
          Raw
        </div>
        <pre className="v" style={{ margin: 0, fontSize: 10.5, whiteSpace: 'pre-wrap', color: 'var(--text-dim)' }}>
          {JSON.stringify(obj, null, 1)}
        </pre>
      </div>
    </div>
  )
}
