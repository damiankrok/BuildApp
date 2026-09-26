import type { JSX } from 'react'
import { useRef } from 'react'
import type { ViewPreset } from '@buildapp/editor'
import { createDemoBuilding } from '@buildapp/demo'
import { createMarcowkiReferenceBuilding } from '@buildapp/reference-marcowki'
import { SEALED_CANDIDATES, modelOf } from '@buildapp/candidates'
import { RENDER_STYLES, renderStyleStore, useRenderStyle, useSnapshot, useStore, type RenderStyleId } from '../use-store.js'

/**
 * The models BuildWorld can load from its own packages. Each entry is a
 * factory returning a CanonicalBuildingModel built by the Building DSL; the
 * store replaces its model with the result and the viewport recompiles.
 * Nothing about a model is special to the UI: a file loaded from disk shows
 * as "(file)" in the same selector.
 */
export const BUILTIN_MODELS: ReadonlyArray<{ id: string; label: string; modelId: string; create: () => ReturnType<typeof createDemoBuilding> }> = [
  { id: 'demo-house', label: 'Demo house', modelId: 'demo-house', create: () => createDemoBuilding() },
  { id: 'marcowki-ge', label: 'Dom w marcówkach (GE)', modelId: 'marcowki-ge', create: () => createMarcowkiReferenceBuilding() },
  // A reconstruction candidate is loaded by REPLAYING its sealed program, not
  // by running a solver here. BuildWorld shows the building that was sealed,
  // evaluated and shipped, or it shows an error — never a fourth building that
  // happens to be what this copy of the solver produces today.
  // A candidate's selector id is its sealed id; the model it replays to has
  // the id the solver gave it. Both are kept so the selector can show which
  // candidate is on screen instead of falling back to "(file)".
  ...SEALED_CANDIDATES.map((c) => ({ id: c.id, label: c.label, modelId: c.candidate.modelId, create: () => modelOf(c.id) })),
]

const VIEWS: Array<{ id: ViewPreset; label: string }> = [
  { id: 'perspective', label: 'Persp' },
  { id: 'front', label: 'Front' },
  { id: 'rear', label: 'Rear' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'top', label: 'Top' },
]

export type RightPanel = 'inspector' | 'sources'

export function Toolbar({ panel, onPanel }: { panel: RightPanel; onPanel: (p: RightPanel) => void }): JSX.Element {
  const store = useStore()
  const snap = useSnapshot()
  const renderStyle = useRenderStyle()
  const fileRef = useRef<HTMLInputElement>(null)

  const save = (): void => {
    const json = store.saveJson()
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'building-model.json'
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>): Promise<void> => {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    store.loadJson(text)
    e.target.value = ''
  }

  return (
    <div className="toolbar" data-testid="toolbar">
      <div className="brand">
        BuildWorld <span>· BuildApp</span>
      </div>
      <div className="group">
        <label>panel</label>
        <button data-testid="panel-inspector" className={panel === 'inspector' ? 'active' : ''} onClick={() => onPanel('inspector')} title="Inspect the selected object in the building model">
          Model
        </button>
        <button data-testid="panel-sources" className={panel === 'sources' ? 'active' : ''} onClick={() => onPanel('sources')} title="What was observed in the published sources — read-only evidence, never edits">
          Sources
        </button>
      </div>
      <div className="group">
        <label>view</label>
        {VIEWS.map((v) => (
          <button key={v.id} className={snap.view === v.id ? 'active' : ''} data-testid={`view-${v.id}`} onClick={() => store.setView(v.id)} title={`${v.label} view (re-frames)`}>
            {v.label}
          </button>
        ))}
      </div>
      <div className="group">
        <button data-testid="frame-selection" disabled={!snap.selection} className={snap.focus ? 'active' : ''} onClick={() => store.frame(snap.focus && snap.focus === snap.selection ? null : snap.selection)} title="Frame the selected object in the current view (again: frame the whole building)">
          {snap.focus ? 'Unframe' : 'Frame'}
        </button>
      </div>
      <div className="group">
        <button data-testid="undo" disabled={!snap.canUndo} onClick={() => store.undo()} title="Undo (Ctrl+Z)">
          Undo
        </button>
        <button data-testid="redo" disabled={!snap.canRedo} onClick={() => store.redo()} title="Redo (Ctrl+Y)">
          Redo
        </button>
      </div>
      <div className="group">
        <button data-testid="save" onClick={save} title="Save building-model.json">
          Save JSON
        </button>
        <button data-testid="load" onClick={() => fileRef.current?.click()} title="Load building-model.json">
          Load JSON
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} data-testid="load-input" onChange={onFile} />
        <label>model</label>
        <select
          data-testid="model-select"
          value={BUILTIN_MODELS.find((m) => m.modelId === snap.model.id)?.id ?? '__file'}
          onChange={(e) => {
            const entry = BUILTIN_MODELS.find((m) => m.id === e.target.value)
            if (entry) store.replaceModel(entry.create())
          }}
          title="Replace the model in the editor with one built from its command list"
        >
          {BUILTIN_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
          <option value="__file" disabled>
            (file)
          </option>
        </select>
        <button data-testid="reload-demo" onClick={() => store.replaceModel(createDemoBuilding())} title="Rebuild the demo building from its command list">
          Reset
        </button>
      </div>
      <div className="group">
        <button data-testid="toggle-roofs" className={snap.roofsVisible ? '' : 'active'} onClick={() => store.setRoofsVisible(!snap.roofsVisible)}>
          {snap.roofsVisible ? 'Hide roofs' : 'Show roofs'}
        </button>
        <label>storey</label>
        <select data-testid="isolate-level" value={snap.isolatedLevelId ?? ''} onChange={(e) => store.isolateLevel(e.target.value || null)}>
          <option value="">all</option>
          {[...snap.model.levels]
            .sort((a, b) => a.index - b.index)
            .map((l) => (
              <option key={l.id} value={l.id}>
                {l.name ?? l.id}
              </option>
            ))}
        </select>
        <button data-testid="show-all" onClick={() => store.resetVisibility()} title="Reset visibility: show everything">
          Show all
        </button>
      </div>
      <div className="group">
        <button data-testid="toggle-grid" className={snap.showGrid ? 'active' : ''} onClick={() => store.setGrid(!snap.showGrid)}>
          Grid
        </button>
        <button data-testid="toggle-axes" className={snap.showAxes ? 'active' : ''} onClick={() => store.setAxes(!snap.showAxes)}>
          Axes
        </button>
      </div>
      <div className="group">
        <label>style</label>
        <select
          data-testid="style-select"
          value={renderStyle}
          onChange={(e) => renderStyleStore.set(e.target.value as RenderStyleId)}
          title={RENDER_STYLES.find((s) => s.id === renderStyle)?.title ?? 'Render style'}
        >
          {RENDER_STYLES.map((s) => (
            <option key={s.id} value={s.id} title={s.title}>
              {s.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
