/**
 * 005Y-N7 (C): a corner notch as the two pockets the emitter already builds — one in each face of the corner, each a
 * passage through its ring wall that runs on through the corner (an open end), and each with the back wall that
 * faces it. The back wall parallel to the face along z runs past the inner corner, so the two back walls meet end to
 * face and never share material.
 */
import { round6 } from '@buildapp/source-common'
import type { CornerNotch, Rect } from './corner-recess.js'

type Pt = { x: number; z: number }

export type CornerPocketSpec = {
  facade: 'FRONT' | 'REAR' | 'WEST' | 'EAST'
  /** The mouth along the face, low to high. */
  from: number
  to: number
  mouthAt: number
  backAt: number
  /** Which end of the mouth is the corner. */
  openEnd: 'LOW' | 'HIGH'
  /** The back wall: its face towards the recess at `faceAt`, its material on the `into` side, along `from..to`. */
  back: { start: Pt; end: Pt; faceAt: number; into: 1 | -1; from: number; to: number }
  carriesPost: boolean
}

const pt = (x: number, z: number): Pt => ({ x: round6(x), z: round6(z) })

/** The two pockets of a corner notch of `body`, with walls `T` thick. */
export function cornerPocketSpecs(notch: CornerNotch, body: Rect, T: number): CornerPocketSpec[] {
  const cx = notch.xSide === 'WEST' ? body.x0 : body.x1
  const cz = notch.zSide === 'FRONT' ? body.z0 : body.z1
  const intoX: 1 | -1 = notch.xSide === 'WEST' ? 1 : -1
  const intoZ: 1 | -1 = notch.zSide === 'FRONT' ? 1 : -1
  const innerX = notch.xSide === 'WEST' ? notch.rect.x1 : notch.rect.x0
  const innerZ = notch.zSide === 'FRONT' ? notch.rect.z1 : notch.rect.z0
  // the back wall facing the zSide passage: along x at innerZ, material deeper (intoZ), from the xSide ring's inner
  // face to the other back wall's face; travel with the material on the left
  const wx0 = cx + intoX * T
  const alongX = intoZ > 0 ? [Math.min(wx0, innerX), Math.max(wx0, innerX)] : [Math.max(wx0, innerX), Math.min(wx0, innerX)]
  const backZ = { start: pt(alongX[0], innerZ), end: pt(alongX[1], innerZ), faceAt: innerZ, into: intoZ, from: round6(Math.min(wx0, innerX)), to: round6(Math.max(wx0, innerX)) }
  // the back wall facing the xSide passage: along z at innerX, material deeper (intoX), from the zSide ring's inner
  // face on past the inner corner by a wall's thickness
  const wz0 = cz + intoZ * T
  const wz1 = innerZ + intoZ * T
  const alongZ = intoX > 0 ? [Math.max(wz0, wz1), Math.min(wz0, wz1)] : [Math.min(wz0, wz1), Math.max(wz0, wz1)]
  const backX = { start: pt(innerX, alongZ[0]), end: pt(innerX, alongZ[1]), faceAt: innerX, into: intoX, from: round6(Math.min(wz0, wz1)), to: round6(Math.max(wz0, wz1)) }
  return [
    { facade: notch.zSide, from: round6(Math.min(cx, innerX)), to: round6(Math.max(cx, innerX)), mouthAt: cz, backAt: innerZ, openEnd: cx < innerX ? 'LOW' : 'HIGH', back: backZ, carriesPost: true },
    { facade: notch.xSide, from: round6(Math.min(cz, innerZ)), to: round6(Math.max(cz, innerZ)), mouthAt: cx, backAt: innerX, openEnd: cz < innerZ ? 'LOW' : 'HIGH', back: backX, carriesPost: false },
  ]
}
