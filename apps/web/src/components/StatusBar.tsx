import type { JSX } from 'react'
import { useSnapshot, useStore } from '../use-store.js'

export function StatusBar(): JSX.Element {
  const store = useStore()
  const snap = useSnapshot()
  const m = snap.model
  const visible = store.visibleMeshes().length
  const errors = snap.scene.diagnostics.filter((d) => d.severity === 'ERROR').length
  const warnings = snap.scene.diagnostics.length - errors
  return (
    <div className="status" data-testid="status">
      <span>
        model <b data-testid="status-model">{m.name}</b> ({m.id})
      </span>
      <span>
        {m.schema}@{m.schemaVersion}
      </span>
      <span>
        {m.units.length}/{m.units.angle} · y=0 ground floor · z into building
      </span>
      <span>
        L{m.levels.length} W{m.walls.length} O{m.openings.length} Win{m.windows.length} D{m.doors.length} R{m.rooms.length} S{m.slabs.length} Rf{m.roofs.length}
      </span>
      <span>
        tris <b data-testid="status-triangles">{snap.scene.stats.triangleCount}</b> · meshes{' '}
        <b data-testid="status-meshes">
          {visible}/{snap.scene.stats.meshCount}
        </b>
      </span>
      <span className={errors > 0 ? 'diag-error' : 'diag-ok'} data-testid="status-diagnostics">
        {errors === 0 && warnings === 0 ? 'geometry ok' : `${errors} errors, ${warnings} warnings`}
      </span>
      <span className="spacer" />
      <span>
        sel <b data-testid="status-selection">{snap.selection ?? '—'}</b>
      </span>
      <span>
        rev <b data-testid="status-revision">{snap.revision}</b>
      </span>
    </div>
  )
}
