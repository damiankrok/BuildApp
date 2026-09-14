import type { JSX } from 'react'
import { useEffect, useState } from 'react'
import type { PropertySpec } from '@buildapp/editor'
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

function EvidenceView({ evidence }: { evidence: Evidence | undefined }): JSX.Element {
  if (!evidence) {
    return (
      <div className="evidence">
        <span className="tag status-UNRESOLVED">no evidence</span>
      </div>
    )
  }
  return (
    <div className="evidence">
      <span className={`tag status-${evidence.status}`}>{evidence.status}</span>
      {evidence.source && <div>source: {evidence.source}</div>}
      {evidence.locator && <div>locator: {evidence.locator}</div>}
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
      <div className="section">
        <div className="panel-title" style={{ padding: '0 0 4px' }}>
          Evidence
        </div>
        <EvidenceView evidence={obj.evidence as Evidence | undefined} />
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
