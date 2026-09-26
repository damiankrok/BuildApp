/**
 * The web viewer and the phone draw the same building the same way.
 *
 * An architecture rule keeps the web app clear of @buildapp/mobile-scene, so
 * the web adapter carries its own copy of the semantic grouping, the finish
 * roles and the tone hints. A text comparison of the palettes cannot catch a
 * copy that groups one wall differently. This test runs both on the same
 * compiled scenes — the reference, the demo and every sealed candidate — and
 * holds them to the same group and the same colour, mesh for mesh.
 */
import { describe, expect, it } from 'vitest'
import { compileBuilding } from '@buildapp/geometry'
import { createDemoBuilding } from '@buildapp/demo'
import { createMarcowkiReferenceBuilding } from '@buildapp/reference-marcowki'
import { SEALED_CANDIDATES, modelOf } from '@buildapp/candidates'
import type { CanonicalBuildingModel } from '@buildapp/model'
import { buildMobileSceneBundle } from '@buildapp/mobile-scene'
import type * as THREE from 'three'
import { buildThreeScene, disposeGroup } from '../../apps/web/src/viewport/scene-adapter.js'

const models: Array<[string, () => CanonicalBuildingModel]> = [
  ['demo', createDemoBuilding],
  ['reference', createMarcowkiReferenceBuilding],
  ...SEALED_CANDIDATES.map((c): [string, () => CanonicalBuildingModel] => [c.id, () => modelOf(c.id)]),
]

describe('web and phone styling agree', () => {
  it.each(models)('%s: same semantic group and same architectural colour on every mesh', (_name, build) => {
    const model = build()
    const scene = compileBuilding(model)
    const bundle = buildMobileSceneBundle(model, { scene })
    const web = buildThreeScene(scene.meshes, model.materials, null, 'architectural', model)
    const meshes = web.pickables
    expect(meshes.length).toBe(bundle.scene.meshes.length)
    for (let i = 0; i < meshes.length; i++) {
      const m = meshes[i]
      const want = bundle.scene.meshes[i]
      expect(m.userData.objectId).toBe(want.objectId)
      expect(m.userData.semanticGroup, `${want.objectId} ${want.part}`).toBe(want.semanticGroup)
      const color = `#${(m.material as THREE.MeshStandardMaterial).color.getHexString()}`
      expect(color, `${want.objectId} ${want.part} (${want.semanticGroup})`).toBe(bundle.styling.groups[want.semanticGroup].color)
    }
    disposeGroup(web.group)
  })
})
