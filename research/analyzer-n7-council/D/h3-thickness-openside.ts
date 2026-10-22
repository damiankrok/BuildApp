/**
 * Council D, Q4/Q5: per-body thickness (DRAWN_THIN_WALLS) and SHARED_WALL (openSide) through emitBuilding + the model,
 * for every side and for a multi-storey body; what else names the open wall or uses the house's T.
 *   npx vite-node research/analyzer-n7-council/D/h3-thickness-openside.ts
 */
import type { OpeningV2 } from '../../../packages/reconstruction/src/v2/openings-v2.js'
import { cutFailedObject } from '../../../packages/reconstruction/src/candidate.js'
import { building, mass, run, check, done, T } from './lib.js'

const opening = (id: string, massId: string, facade: OpeningV2['facade'], interval: [number, number], family: OpeningV2['family'] = 'WINDOW', storeyIndex = 0): OpeningV2 =>
  ({ id, storeyIndex, massId, facade, planeAt: 0, interval, widthM: interval[1] - interval[0], sillY: storeyIndex * 2.9 + 0.9, headY: storeyIndex * 2.9 + 2.1, profile: 'RECTANGULAR', family, mullions: [], planGap: { frameId: 'p', pixelRect: { x0: 0, y0: 0, x1: 1, y1: 1 } }, provenance: { interval: 'SOURCE_DERIVED', width: 'SOURCE_DERIVED', sill: 'SOURCE_DERIVED', head: 'SOURCE_DERIVED', profile: 'SOURCE_DERIVED', family: 'SOURCE_DERIVED' }, uncertaintyM: 0.02, why: 'council' }) as unknown as OpeningV2

console.log('--- Q4: DRAWN_THIN_WALLS 0.12 m body with a window and a door; frames sized from the house T ---')
{
  const main = mass('main', 'MAIN', 0, 0, 10, 8)
  const a = mass('attached-0', 'ATTACHED', 10, 1, 10.5, 7, [0], { wallThicknessM: 0.12 })
  const r = run(building([main, a], 1, { openings: [opening('o-win', 'attached-0', 'EAST', [2, 3]), opening('o-door', 'attached-0', 'EAST', [4, 5], 'DOOR' as OpeningV2['family'])] }))
  const win = r.emitted.program.find((c) => c.type === 'placeWindow') as Record<string, unknown>
  const door = r.emitted.program.find((c) => c.type === 'placeDoor') as Record<string, unknown>
  console.log('  placeWindow:', JSON.stringify(win), '\n  placeDoor:', JSON.stringify(door))
  console.log('  plain failedAt', r.plainFailedAt, r.plainFailedId, r.plainErrors?.map((e) => `${e.code}: ${e.message.slice(0, 140)}`).join(' | '))
  console.log('  preview failures', JSON.stringify(r.preview.failures), 'fits', JSON.stringify(r.preview.fit.ok ? r.preview.fit.fits : null))
  const w = r.model?.windows.find((x) => x.id === 'o-win-unit') as Record<string, unknown> | undefined
  check('window frame depth+inset fits the 0.12 m wall', !!w && ((w.frameDepth as number) ?? 0.08) + ((w.frameInset as number) ?? 0.12) <= 0.12 + 1e-9, JSON.stringify(w))
}

console.log('--- Q5: SHARED_WALL on each side, one and two storeys ---')
const cases = [
  { side: 'WEST' as const, att: [10, 1, 10.45, 7] },
  { side: 'EAST' as const, att: [-0.45, 1, 0, 7] },
  { side: 'FRONT' as const, att: [2, 8, 8, 8.45] },
  { side: 'REAR' as const, att: [2, -0.45, 8, 0] },
]
for (const storeys of [[0], [0, 1]]) {
  for (const c of cases) {
    const main = mass('main', 'MAIN', 0, 0, 10, 8, storeys)
    const a = mass('attached-0', 'ATTACHED', c.att[0], c.att[1], c.att[2], c.att[3], storeys, { openSide: c.side })
    const r = run(building([main, a], storeys.length))
    const walls = r.model?.walls.filter((w) => w.id.startsWith('ring-attached-0-')).map((w) => w.id) ?? []
    check(`openSide ${c.side}, storeys ${storeys.join(',')}: whole, ${3 * storeys.length} own walls`, r.plainFailedAt === undefined && walls.length === 3 * storeys.length, `${r.plainFailedId ?? ''} ${r.plainErrors?.map((e) => e.message.slice(0, 120)).join(' | ') ?? ''} walls=${walls.join(',')}`)
  }
}

console.log('--- Q5: references to the wall that is not built ---')
{
  const main = mass('main', 'MAIN', 0, 0, 10, 8)
  const a = mass('attached-0', 'ATTACHED', 10, 1, 10.45, 7, [0], { openSide: 'WEST' })
  // an opening the plan reads on the open (shared) side of the thin body
  const r = run(building([main, a], 1, { openings: [opening('o-shared-side', 'attached-0', 'WEST', [2, 3])] }))
  console.log('  opening on open side -> plain', r.plainFailedId, r.plainErrors?.map((e) => `${e.code}`).join(','), 'fits', JSON.stringify(r.preview.fit.ok ? r.preview.fit.fits : null), 'failures', JSON.stringify(r.preview.failures.map((f) => f.id + ':' + f.codes)))
  check('an opening on the open side is either retargeted or named, not silently dropped', r.preview.failures.length > 0 || (r.preview.fit.ok && r.preview.fit.fits.length > 0), '')
  // a sharedDoor whose OWN side is open goes into the other body's wall
  const sd = { ...opening('sd-1', 'attached-0', 'WEST', [3, 4], 'DOOR' as OpeningV2['family']), otherMassId: 'main', sillY: 0, headY: 2.1 }
  const r2 = run(building([main, a], 1, { sharedDoors: [sd as never] }))
  const cut = r2.model?.openings.find((o) => o.id === 'sd-1')
  check('sharedDoor with mine open is cut in main\'s east wall', cut?.wallId === 'ring-main-0-w1', `${cut?.wallId} offset ${(cut as { offset?: number } | undefined)?.offset} plain ${r2.plainFailedId} ${r2.plainErrors?.map((e) => e.code)}`)
  // sharedDoor named from the other side: mass = main (facade EAST), other = attached-0 whose WEST is open
  const sd2 = { ...sd, id: 'sd-2', massId: 'main', facade: 'EAST', otherMassId: 'attached-0' }
  const r3 = run(building([main, a], 1, { sharedDoors: [sd2 as never] }))
  const cut3 = r3.model?.openings.find((o) => o.id === 'sd-2') as { wallId?: string; leaves?: unknown } | undefined
  check('sharedDoor from main with other open: no leaf in a missing wall', !!cut3 && !cut3.leaves, `${JSON.stringify(cut3)} plain ${r3.plainFailedId} ${r3.plainErrors?.map((e) => e.code)}`)
  // a terrace hosted on the open side
  const t = { id: 'terrace-1', storeyIndex: 0, side: 'WEST', polygon: [{ x: 9, z: 1 }, { x: 10, z: 1 }, { x: 10, z: 2 }, { x: 9, z: 2 }], topY: 0, thicknessM: 0.15, surface: 'PAVED', edge: 'FLUSH', massIds: ['attached-0'], featureId: 'ft', provenance: 'SOURCE_DERIVED', why: 'c' }
  const r4 = run(building([main, a], 1, { terraces: [t as never] }))
  console.log('  terrace hosted on open side -> plain', r4.plainFailedId, r4.plainErrors?.map((e) => `${e.code}: ${e.message.slice(0, 100)}`).join(' | '), ' preview failures', JSON.stringify(r4.preview.failures.map((f) => `${f.id}:${f.codes}`)), 'skipped', JSON.stringify(r4.preview.skipped.map((s) => `${s.id}:${s.cause}`)))
}

console.log('--- partial preview: a failing createWall of a three-wall body (no ring id to group by) ---')
{
  const main = mass('main', 'MAIN', 0, 0, 10, 8)
  const a = mass('attached-0', 'ATTACHED', 10, 1, 10.45, 7, [0], { openSide: 'WEST' })
  const r = run(building([main, a], 1))
  const prog = r.emitted.program
  const at = prog.findIndex((c) => (c as { id?: string }).id === 'ring-attached-0-0-w2')
  const cut = cutFailedObject(prog, at, 'main', 'council: pretend w2 was refused')
  const kept = cut?.program.filter((c) => (c as { id?: string }).id?.startsWith('ring-attached-0-0-w') || (c as { id?: string }).id === 'slab-attached-0-0').map((c) => (c as { id?: string }).id)
  check('cutting one wall of a three-wall body takes its body (other walls, slab) with it', (kept ?? []).length === 0, `still kept: ${JSON.stringify(kept)}; skipped ${JSON.stringify(cut?.skipped.map((s) => `${s.id}:${s.cause}`))}`)
}
console.log('T', T)
done()
