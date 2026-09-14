/**
 * Camera presets in three-space. The model's front facade faces model -z,
 * which is three +z, so the "front" camera stands at +z looking back at the
 * building and sees model +x on its right — as the coordinate convention
 * requires.
 */
import * as THREE from 'three'
import type { ViewPreset } from '@buildapp/editor'

export type Framing = { center: THREE.Vector3; radius: number }

export function framingOf(bounds: THREE.Box3): Framing {
  if (bounds.isEmpty()) return { center: new THREE.Vector3(0, 1, 0), radius: 10 }
  const center = bounds.getCenter(new THREE.Vector3())
  const radius = Math.max(2, bounds.getSize(new THREE.Vector3()).length() / 2)
  return { center, radius }
}

export function presetPosition(preset: ViewPreset, f: Framing): { position: THREE.Vector3; up: THREE.Vector3 } {
  const d = f.radius * 2.6
  const c = f.center
  const up = new THREE.Vector3(0, 1, 0)
  switch (preset) {
    case 'front':
      return { position: new THREE.Vector3(c.x, c.y, c.z + d), up }
    case 'rear':
      return { position: new THREE.Vector3(c.x, c.y, c.z - d), up }
    case 'left':
      return { position: new THREE.Vector3(c.x - d, c.y, c.z), up }
    case 'right':
      return { position: new THREE.Vector3(c.x + d, c.y, c.z), up }
    case 'top':
      // Looking straight down with model +z (into the building) up the screen.
      return { position: new THREE.Vector3(c.x, c.y + d, c.z), up: new THREE.Vector3(0, 0, -1) }
    case 'perspective':
    default:
      return { position: new THREE.Vector3(c.x + d * 0.62, c.y + d * 0.42, c.z + d * 0.7), up }
  }
}

export const isOrthographic = (preset: ViewPreset): boolean => preset !== 'perspective'
