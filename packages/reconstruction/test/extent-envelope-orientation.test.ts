import { describe, expect, it } from 'vitest'
import { PlanDrawing, TRANSFORMS, runScene } from './transforms.js'
import type { Scene } from './transforms.js'

/**
 * BUILDPLAN-ANALYZER-005F post-review C and B: the attached-room and box-completion rules give the same answer whichever
 * way up the plan is drawn, and the drawings the reviewers built to falsify them stay unbuilt. Each scene is drawn five
 * ways (as drawn, mirrored both ways, turned a quarter either way); every probe is in the plan's own coordinates.
 * Synthetic plans at 5 cm/px with 12 px walls; not a drawing of any building.
 */
const house = (): PlanDrawing => new PlanDrawing(560, 340).ring(40, 40, 359, 279)
const BAY_X = [40, 360, 400]
const BAY_Y = [40, 120, 220, 280]

const scenes: Record<string, { scene: Scene; probes: Array<{ at: [number, number]; built: boolean }> }> = {
  // the §29 bay: a line drawn across its open side at the house's face, glazed on its outer face
  'a flush bay behind a face line, glazed': {
    scene: { p: house().wall(348, 120, 399, 131).wall(348, 208, 399, 219).wall(388, 120, 399, 219).clear(388, 140, 399, 199).glazeV(388, 140, 199).clear(348, 132, 359, 207).line(358, 132, 358, 207), xs: BAY_X, ys: BAY_Y },
    probes: [{ at: [375, 170], built: true }],
  },
  // C5F-1: a walled yard with a door and the HOUSE's window into it, and a gate drawn as one line — no glazing of its own
  'a walled yard seen through the house’s own window': {
    scene: { p: house().wall(348, 120, 399, 131).wall(348, 208, 399, 219).wall(388, 120, 399, 145).wall(388, 194, 399, 219).line(393, 146, 393, 193).doorV(348, 126, 145).clear(348, 186, 359, 214).glazeV(348, 186, 214), xs: BAY_X, ys: BAY_Y },
    probes: [{ at: [375, 170], built: false }],
  },
  // C5F-2: the glazed bay, and against its solid south wall a walled yard closed by a gate drawn as one line
  'a glazed bay, and a walled yard behind its side wall': {
    scene: {
      p: house().wall(348, 120, 399, 131).wall(348, 208, 399, 219).wall(388, 120, 399, 145).wall(388, 194, 399, 222).glazeV(388, 146, 193).doorV(348, 150, 169).wall(388, 265, 399, 279).line(393, 223, 393, 264).wall(348, 268, 399, 279),
      xs: BAY_X,
      ys: BAY_Y,
    },
    probes: [
      { at: [375, 170], built: true },
      { at: [375, 250], built: false },
    ],
  },
  // C5F-5: a carport — two walls, short piers, a dashed roof line across a 2.3 m mouth, a door from the house
  'a carport with short piers and a dashed roof line': {
    scene: { p: house().wall(348, 110, 479, 121).wall(348, 198, 479, 209).wall(468, 122, 479, 136).wall(468, 183, 479, 197).dashedV(474, 137, 182).doorV(348, 150, 169), xs: [40, 360, 480], ys: [40, 110, 210, 280] },
    probes: [{ at: [420, 160], built: false }],
  },
  // C5F-3: the walled yard (door, gate as one line, no glazing) with the facade's window chain drawn across it
  'a walled yard a facade chain is drawn across': {
    scene: { p: house().wall(348, 120, 399, 131).wall(348, 208, 399, 219).wall(388, 120, 399, 145).wall(388, 194, 399, 219).line(393, 146, 393, 193).doorV(348, 150, 169), xs: BAY_X, ys: BAY_Y, verticalChain: { baselineX: 380, ticksY: [40, 150, 165, 280] } },
    probes: [{ at: [375, 170], built: false }],
  },
  // the §19 garage end: a 4 m garage, its end wall 1.4 m short of the house's face with a dashed 2.5 m door in it
  'a garage completed to its end wall by a drawn vehicle door': {
    scene: {
      p: (() => {
        const p = new PlanDrawing(520, 360).ring(140, 40, 459, 299).wall(60, 60, 151, 71).wall(60, 60, 71, 271).wall(60, 260, 151, 271).clear(75, 260, 125, 271)
        for (let x = 75; x <= 125; x += 13) p.line(x, 266, Math.min(x + 9, 125), 266)
        return p
      })(),
      xs: [60, 140, 460],
      ys: [40, 60, 120, 185, 200, 300],
      unread: { y: [271] },
    },
    probes: [{ at: [100, 240], built: true }],
  },
  // C5F-4: the same garage, its end wall solid and a dashed 2.5 m gap in the end's SIDE wall instead: behind that gap
  // lies 4 m of garage, and the house behind the garage's solid wall is no vehicle's length
  'a gap in a garage end’s side wall, the house behind a solid wall': {
    scene: {
      p: (() => {
        const p = new PlanDrawing(520, 360).ring(140, 40, 459, 299).wall(60, 60, 151, 71).wall(60, 60, 71, 271).wall(60, 260, 151, 271).clear(60, 205, 71, 254)
        for (let y = 205; y <= 254; y += 13) p.line(66, y, 66, Math.min(y + 9, 254))
        return p
      })(),
      xs: [60, 140, 460],
      ys: [40, 60, 120, 185, 200, 300],
      unread: { y: [271] },
    },
    probes: [{ at: [100, 240], built: false }],
  },
}

describe('§29/§30 under mirroring and rotation (005F post-review C)', () => {
  for (const [name, { scene, probes }] of Object.entries(scenes)) {
    it(`${name}: ${probes.map((p) => (p.built ? 'built' : 'not built')).join(', ')} — all five ways`, () => {
      for (const t of TRANSFORMS) {
        const r = runScene(scene, t)
        for (const probe of probes) {
          const parts = (r.d.boundary?.completions ?? []).filter((c) => !c.reason.startsWith('WALL_SLIVER')).map((c) => `${c.kind}/${c.decision}:${c.reason.split(':')[0]}`)
          expect(r.builtAt(...probe.at), `${t} at ${probe.at}: ${parts.join(' | ')}`).toBe(probe.built)
        }
      }
    })
  }
})
