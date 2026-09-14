import type { JSX } from 'react'
import { useRef } from 'react'
import type { ViewPreset } from '@buildapp/editor'
import { createDemoBuilding } from '@buildapp/demo'
import { useSnapshot, useStore } from '../use-store.js'

const VIEWS: Array<{ id: ViewPreset; label: string }> = [
  { id: 'perspective', label: 'Persp' },
  { id: 'front', label: 'Front' },
  { id: 'rear', label: 'Rear' },
  { id: 'left', label: 'Left' },
  { id: 'right', label: 'Right' },
  { id: 'top', label: 'Top' },
]

export function Toolbar(): JSX.Element {
  const store = useStore()
  const snap = useSnapshot()
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
        <label>view</label>
        {VIEWS.map((v) => (
          <button key={v.id} className={snap.view === v.id ? 'active' : ''} data-testid={`view-${v.id}`} onClick={() => store.setView(v.id)} title={`${v.label} view (re-frames)`}>
            {v.label}
          </button>
        ))}
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
        <button data-testid="reload-demo" onClick={() => store.replaceModel(createDemoBuilding())} title="Rebuild the demo building from its command list">
          Demo
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
    </div>
  )
}
