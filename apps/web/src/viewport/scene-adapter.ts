/**
 * CompiledScene -> Three.js objects.
 *
 * This is an adapter and nothing more: it turns the compiler's triangle lists
 * into buffer geometries, keeps a Map from every Three.js mesh back to the
 * semantic object id (the picking trace), and applies materials by part. It
 * never invents geometry. The model frame is mirrored in z here, and the
 * triangle winding swapped, because the model frame is left-handed and
 * Three.js is right-handed (see docs/CANONICAL_BUILDING_MODEL.md).
 */
import * as THREE from 'three'
import type { CompiledMesh, GeometryPart, Vec3 } from '@buildapp/geometry'
import type { Material } from '@buildapp/model'

export const toThree = (p: Vec3): THREE.Vector3 => new THREE.Vector3(p.x, p.y, -p.z)

export type SceneBuild = {
  group: THREE.Group
  /** Three.js mesh -> semantic object id: the picking trace. */
  meshToObject: Map<THREE.Object3D, string>
  pickables: THREE.Mesh[]
  bounds: THREE.Box3
}

type PartStyle = { color: number; opacity?: number; metalness?: number; roughness?: number; edges?: boolean }

const STYLE: Record<GeometryPart, PartStyle> = {
  WALL: { color: 0xcfc8bb, roughness: 0.95, edges: true },
  WALL_REVEAL: { color: 0xbdb6a9, roughness: 0.95, edges: true },
  WINDOW_FRAME: { color: 0x2c3036, roughness: 0.6 },
  WINDOW_GLASS: { color: 0x9ec7e6, opacity: 0.35, roughness: 0.1, metalness: 0.1 },
  WINDOW_MULLION: { color: 0x2c3036, roughness: 0.6 },
  DOOR_FRAME: { color: 0x2c3036, roughness: 0.6 },
  DOOR_LEAF: { color: 0x8a6a3d, roughness: 0.7, edges: true },
  DOOR_GLASS: { color: 0x9ec7e6, opacity: 0.35, roughness: 0.1, metalness: 0.1 },
  DOOR_PANEL: { color: 0x3a3d42, roughness: 0.7, edges: true },
  DOOR_HANDLE: { color: 0xb8b8b8, roughness: 0.3, metalness: 0.8 },
  SLAB: { color: 0x9b9b98, roughness: 0.9, edges: true },
  ROOF: { color: 0x6f4a3d, roughness: 0.9, edges: true },
  ROOF_REVEAL: { color: 0x5e3f34, roughness: 0.9, edges: true },
  ROOFLIGHT_FRAME: { color: 0x2c3036, roughness: 0.6 },
  ROOFLIGHT_GLASS: { color: 0x9ec7e6, opacity: 0.35, roughness: 0.1, metalness: 0.1 },
  BALCONY: { color: 0xa5a29b, roughness: 0.9, edges: true },
  RAILING_POST: { color: 0x3a3d42, roughness: 0.5, metalness: 0.6 },
  RAILING_RAIL: { color: 0x3a3d42, roughness: 0.5, metalness: 0.6 },
  RAILING_INFILL: { color: 0x9ec7e6, opacity: 0.45, roughness: 0.2 },
  CHIMNEY: { color: 0x9c5f4a, roughness: 0.9, edges: true },
  ROOM_FLOOR: { color: 0x3fa7a0, opacity: 0.28, roughness: 1 },
  STAIR_PLACEHOLDER: { color: 0xe0a24d, opacity: 0.5, roughness: 1 },
  STAIR_STEP: { color: 0xb9b3a8, roughness: 0.9, edges: true },
  SURFACE_REGION: { color: 0x9a7a4a, roughness: 0.85 },
}

const SELECTED = new THREE.Color(0x4fa3ff)

function geometryFor(mesh: CompiledMesh): THREE.BufferGeometry {
  const positions = new Float32Array(mesh.triangles.length * 9)
  let i = 0
  for (const t of mesh.triangles) {
    // Mirror z (model frame is left-handed) and swap b/c so faces stay front-facing.
    for (const p of [t.a, t.c, t.b]) {
      positions[i++] = p.x
      positions[i++] = p.y
      positions[i++] = -p.z
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  g.computeVertexNormals()
  return g
}

export function buildThreeScene(meshes: readonly CompiledMesh[], materials: readonly Material[], selection: string | null): SceneBuild {
  const group = new THREE.Group()
  group.name = 'compiled-building'
  const meshToObject = new Map<THREE.Object3D, string>()
  const pickables: THREE.Mesh[] = []
  const bounds = new THREE.Box3()
  const modelMaterial = new Map(materials.map((m) => [m.id, m]))

  for (const cm of meshes) {
    const style = STYLE[cm.part]
    const geometry = geometryFor(cm)
    const own = cm.materialId ? modelMaterial.get(cm.materialId) : undefined
    // A model material colours structural parts; fills keep their part colour.
    const usesOwn = own && (cm.part === 'WALL' || cm.part === 'WALL_REVEAL' || cm.part === 'ROOF' || cm.part === 'ROOF_REVEAL' || cm.part === 'SLAB' || cm.part === 'CHIMNEY' || cm.part === 'BALCONY' || cm.part === 'DOOR_LEAF' || cm.part === 'DOOR_PANEL' || cm.part === 'STAIR_STEP' || cm.part === 'SURFACE_REGION')
    const color = new THREE.Color(usesOwn ? own.color : style.color)
    const selected = selection !== null && cm.objectId === selection
    const material = new THREE.MeshStandardMaterial({
      color,
      roughness: style.roughness ?? 0.9,
      metalness: style.metalness ?? 0,
      transparent: style.opacity !== undefined,
      opacity: style.opacity ?? 1,
      side: THREE.FrontSide,
      flatShading: true,
      emissive: selected ? SELECTED : new THREE.Color(0x000000),
      emissiveIntensity: selected ? 0.55 : 0,
    })
    const three = new THREE.Mesh(geometry, material)
    three.name = `${cm.objectKind}:${cm.objectId}:${cm.part}`
    three.userData = { objectId: cm.objectId, objectKind: cm.objectKind, part: cm.part, hostWallId: cm.hostWallId, openingId: cm.openingId }
    three.renderOrder = style.opacity !== undefined ? 2 : 1
    group.add(three)
    meshToObject.set(three, cm.objectId)
    pickables.push(three)
    if (style.edges) {
      const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 20), new THREE.LineBasicMaterial({ color: selected ? 0x9fd0ff : 0x2a2d31, transparent: true, opacity: selected ? 1 : 0.6 }))
      edges.renderOrder = 3
      group.add(edges)
    }
    geometry.computeBoundingBox()
    if (geometry.boundingBox) bounds.union(geometry.boundingBox)
  }
  return { group, meshToObject, pickables, bounds }
}

export function disposeGroup(group: THREE.Group): void {
  group.traverse((o) => {
    const m = o as THREE.Mesh
    if (m.geometry) m.geometry.dispose()
    const mat = (m as THREE.Mesh).material as THREE.Material | THREE.Material[] | undefined
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose())
    else if (mat) mat.dispose()
  })
}

/** World axes of the MODEL frame drawn in three-space: x red, y green, z blue (model +z is three -z). */
export function modelAxes(length = 3): THREE.Group {
  const g = new THREE.Group()
  g.name = 'model-axes'
  const line = (to: THREE.Vector3, color: number): void => {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), to])
    g.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color })))
  }
  line(new THREE.Vector3(length, 0, 0), 0xe5645a)
  line(new THREE.Vector3(0, length, 0), 0x5fbf8a)
  line(new THREE.Vector3(0, 0, -length), 0x4fa3ff)
  return g
}
