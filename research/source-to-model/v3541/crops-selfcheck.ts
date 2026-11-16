/**
 * v3.54.1 counter-trials of the crop transforms (brief §8: "a crop transform with a mirror and a rotation lands on the
 * right side"), and of the mapping of an answer's crop references back to their parents. No network, no key.
 *   npx vite-node research/source-to-model/v3541/crops-selfcheck.ts
 */
import { chooseCrops, cropEdgeToParent, cropPointToParent, cropRgba, mapAnswerToParents, mirrorRgba, rotateRgba } from './crops.js'
import type { CropTransform, Edge, Rgba } from './crops.js'

const results: Array<[string, boolean, unknown?]> = []
const check = (name: string, ok: boolean, detail?: unknown): void => void results.push([name, ok, detail])

// a 40 × 20 picture with one red pixel near its top-left and a dark block in its right half
const pic: Rgba = { width: 40, height: 20, data: new Uint8ClampedArray(40 * 20 * 4).fill(255) }
const put = (r: Rgba, x: number, y: number, rgb: [number, number, number]): void => r.data.set([...rgb, 255], (y * r.width + x) * 4)
put(pic, 3, 2, [255, 0, 0])
const at = (r: Rgba, x: number, y: number): number[] => [...r.data.subarray((y * r.width + x) * 4, (y * r.width + x) * 4 + 3)]
const redOf = (r: Rgba): { x: number; y: number } | null => {
  for (let y = 0; y < r.height; y += 1) for (let x = 0; x < r.width; x += 1) if (at(r, x, y)[0] === 255 && at(r, x, y)[1] === 0) return { x, y }
  return null
}

const rect = { x: 2, y: 1, w: 10, h: 6 } // contains the red pixel at (1, 1) of the crop
for (const deg of [0, 90, 180, 270] as const)
  for (const mirrored of [false, true]) {
    let r = rotateRgba(cropRgba(pic, rect), deg)
    if (mirrored) r = mirrorRgba(r)
    const t: CropTransform = { number: 9, parent: 2, assetId: 'a', why: 'test', rect, rotationDeg: deg, mirrored, scale: 1, outW: r.width, outH: r.height, sha256: '' }
    const red = redOf(r) as { x: number; y: number }
    const back = cropPointToParent(t, red.x + 0.5, red.y + 0.5)
    check(`point: rotation ${deg}, mirror ${mirrored} → the red pixel lands on (3, 2) of the parent`, Math.floor(back.x) === 3 && Math.floor(back.y) === 2, back)
    // the edge of the crop that the parent's TOP became, named on the crop, maps back to TOP
    const edges: Edge[] = ['TOP', 'BOTTOM', 'LEFT', 'RIGHT']
    const toCrop = (e: Edge): Edge => {
      // which crop edge is nearest the parent edge e: the one whose parent image is e
      return edges.find((c) => cropEdgeToParent(t, c) === e) as Edge
    }
    check(`edge: rotation ${deg}, mirror ${mirrored} → every crop edge maps to a distinct parent edge`, new Set(edges.map((e) => cropEdgeToParent(t, e))).size === 4)
    check(`edge: rotation ${deg}, mirror ${mirrored} → the parent's BOTTOM named on the crop is BOTTOM again`, cropEdgeToParent(t, toCrop('BOTTOM')) === 'BOTTOM')
  }
// a known case, by hand: rotated 90° clockwise, the parent's bottom is the crop's LEFT; mirrored after, it is the RIGHT
const t90: CropTransform = { number: 9, parent: 2, assetId: 'a', why: 't', rect, rotationDeg: 90, mirrored: false, scale: 1, outW: 6, outH: 10, sha256: '' }
check('by hand: rotated 90° cw, the crop’s LEFT edge is the parent’s BOTTOM', cropEdgeToParent(t90, 'LEFT') === 'BOTTOM')
check('by hand: rotated 90° cw and mirrored, the crop’s RIGHT edge is the parent’s BOTTOM', cropEdgeToParent({ ...t90, mirrored: true }, 'RIGHT') === 'BOTTOM')
// an enlarged crop: scale 2, the point maps back by half
const t2: CropTransform = { ...t90, rotationDeg: 0, outW: 20, outH: 12, scale: 2 }
const p2 = cropPointToParent(t2, 3, 3)
check('scale ×2: crop (3, 3) is parent (3.5, 2.5)', Math.abs(p2.x - 3.5) < 1e-9 && Math.abs(p2.y - 2.5) < 1e-9, p2)

// the answer's references to a crop become its parent's; the crops' inventory entries go
const answer = { frame: { planImage: 9, frontIsPlanEdge: 'LEFT', how: '' }, images: [{ image: 2 }, { image: 9 }], openings: [{ images: [9, 2, 3] }], bodies: [{ id: 'm', images: [3] }] }
const { output, mapped } = mapAnswerToParents(answer, [t90])
const o = output as typeof answer
check('answer: the plan named as a crop is its parent, and the front edge is the parent’s', o.frame.planImage === 2 && o.frame.frontIsPlanEdge === 'BOTTOM', o.frame)
check('answer: the crop’s inventory entry is removed, the original’s kept', o.images.length === 1 && o.images[0].image === 2)
check('answer: an item’s pictures name the parent once', JSON.stringify(o.openings[0].images) === JSON.stringify([2, 3]))
check('answer: what names no crop is untouched', JSON.stringify(o.bodies[0].images) === JSON.stringify([3]) && mapped.length === 3, mapped)

// the crop rule is the picture's alone and deterministic
const drawing: Rgba = { width: 200, height: 100, data: new Uint8ClampedArray(200 * 100 * 4).fill(255) }
for (let y = 20; y < 80; y += 1) for (let x = 30; x < 170; x += 1) if (x < 32 || x > 167 || y < 22 || y > 77) put(drawing, x, y, [0, 0, 0])
for (let x = 120; x < 160; x += 2) for (let y = 60; y < 70; y += 1) put(drawing, x, y, [0, 0, 0]) // small print, right half
const crops = chooseCrops(drawing)
check('rule: the first crop is the ink’s box (within its 1 % pad)', crops.length === 2 && Math.abs(crops[0].rect.x - 28) <= 2 && Math.abs(crops[0].rect.y - 18) <= 2 && Math.abs(crops[0].rect.x + crops[0].rect.w - 172) <= 2, crops[0])
check('rule: the second crop is the half with the small print', crops[1].rect.x > crops[0].rect.x, crops[1])
check('rule: the same picture gives the same crops', JSON.stringify(chooseCrops(drawing)) === JSON.stringify(crops))

for (const [name, ok, detail] of results) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  ${JSON.stringify(detail)}`}`)
console.log(JSON.stringify({ checks: results.length, failed: results.filter((r) => !r[1]).length }))
process.exit(results.every((r) => r[1]) ? 0 : 1)
