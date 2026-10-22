/**
 * Council D, Q1–Q3: thinBodies() skips a body with storeyRects or pieceOf, while emitBuilding builds that body's rings
 * from rectAt(m, storey). A storey rectangle or a piece narrower than 2T is never adjudicated and is refused.
 *   npx vite-node research/analyzer-n7-council/D/h1-storeyrects-pieces.ts
 */
import { thinBodies } from '../../../packages/reconstruction/src/v2/thin-body.js'
import { rectAt } from '../../../packages/reconstruction/src/v2/building.js'
import { building, mass, run, check, done, T } from './lib.js'

// main 10 x 8, two storeys. attached-0 east of it, 3.0 m wide on storey 0, its storey-1 footprint only 0.45 m wide.
const main = mass('main', 'MAIN', 0, 0, 10, 8, [0, 1])
const att = mass('attached-0', 'ATTACHED', 10, 1, 13, 7, [0, 1], { storeyRects: [{ storey: 1, x0: 10, z0: 1, x1: 10.45, z1: 7 }] })
console.log('--- Q1/Q2: storeyRect narrower than 2T ---')
check('thinBodies skips the body with storeyRects', thinBodies([main, att], T).length === 0, JSON.stringify(thinBodies([main, att], T).map((x) => x.mass.id)))
const r1 = rectAt(att, 1)
check('rectAt(att,1) is narrower than 2T', r1.x1 - r1.x0 < 2 * T, `width ${(r1.x1 - r1.x0).toFixed(2)} < ${2 * T}`)
const a = run(building([main, att], 2))
check('plain apply refuses ring-attached-0-1', a.plainFailedId === 'ring-attached-0-1', `${a.plainFailedId} ${a.plainErrors?.map((e) => e.message).join(' | ')}`)
check('preview cut: failure is ring-attached-0-1 WALLS_OVERLAP', a.preview.failures[0]?.id === 'ring-attached-0-1' && a.preview.failures[0]?.codes.includes('WALLS_OVERLAP'), JSON.stringify(a.preview.failures[0]))
const lostSound = a.preview.skipped.filter((s) => s.id === 'ring-attached-0-0' || s.id === 'slab-attached-0-0')
check('the sound storey-0 ring and slab of the same body are cut with it (SAME_BODY)', lostSound.length === 2, lostSound.map((s) => `${s.id}:${s.cause}`).join(','))

// a body whose base rect is itself narrow but has storeyRects: also skipped
const att2 = mass('attached-0', 'ATTACHED', 10, 1, 10.45, 7, [0, 1], { storeyRects: [{ storey: 1, x0: 10, z0: 1, x1: 13, z1: 7 }] })
check('even a narrow BASE rect is skipped when storeyRects exist', thinBodies([main, att2], T).length === 0)

console.log('--- Q3: a piece narrower than 2T ---')
const att3 = mass('attached-0', 'ATTACHED', 10, 1, 13, 7, [0])
const piece = mass('main-s1-1', 'ATTACHED', 3, 2, 3.4, 6, [1], { pieceOf: 'main', sourceMassId: 'src-main' })
check('thinBodies skips the piece', thinBodies([main, att3, piece], T).length === 0)
const p = run(building([main, att3, piece], 2))
check('plain apply refuses ring-main-s1-1-1', p.plainFailedId === 'ring-main-s1-1-1', `${p.plainFailedId} ${p.plainErrors?.map((e) => e.message).join(' | ')}`)
check('preview cut the piece and kept the rest', p.preview.fit.ok && p.preview.failures[0]?.id === 'ring-main-s1-1-1', JSON.stringify(p.preview.skipped.map((s) => `${s.id}:${s.cause}`)))
// cutFailedObject's prefix grouping: a failure on main's piece — is the piece grouped with main?
const pieceCutMain = p.preview.skipped.filter((s) => s.id?.startsWith('ring-main-') && !s.id.startsWith('ring-main-s'))
check('main rings are not cut along with main\'s piece', pieceCutMain.length === 0, JSON.stringify(pieceCutMain))

// a MAIN body (role MAIN) is never checked either
const thinMain = mass('main', 'MAIN', 0, 0, 0.5, 8)
check('thinBodies never checks MAIN', thinBodies([thinMain], T).length === 0)
done()
