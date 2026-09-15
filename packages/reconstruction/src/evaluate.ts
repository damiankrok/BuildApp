/**
 * Scoring a candidate against a reference, AFTER it has been sealed.
 *
 * Two numbers, kept apart on purpose.
 *
 * **Geometric accuracy** asks: of the things the candidate DID build, how
 * close are they? It is a question about precision, and a candidate that
 * builds one wall and gets it exactly right scores perfectly on it.
 *
 * **Evidence-supported completeness** asks: how much of the building did the
 * evidence let it build at all? It is a question about coverage, and it is the
 * one that is embarrassing.
 *
 * Collapsing them into a single "score" is the thing to avoid, because the two
 * failure modes it hides are opposite and both fatal: a candidate that builds
 * almost nothing very precisely, and a candidate that builds everything
 * confidently and wrongly. Reported separately, each is obvious.
 *
 * Nothing in this file knows which project it is scoring. The reference comes
 * in as a model like any other, and the same code scores a synthetic fixture
 * against its own spec and a published house against a hand-built reference.
 * It runs after `sealCandidate`, never before, and nothing it computes can
 * reach the solver.
 */
import { round6 } from '@buildapp/source-common'
import type { CanonicalBuildingModel, Opening, Wall } from '@buildapp/model'
import { linearSolidBounds } from '@buildapp/model'
import type { ReconstructionCandidate } from './candidate.js'

export type MetricComparison = {
  name: string
  candidate: number | undefined
  reference: number
  unit: string
  /** Signed, candidate minus reference. */
  error: number | undefined
  /** As a fraction of the reference. */
  relative: number | undefined
  /** Which constraint class the candidate settled this with, when it settled it. */
  class?: string
}

export type OpeningComparison = {
  referenceId: string
  candidateId?: string
  /** Centre-to-centre distance in the wall's own plane, in metres. */
  positionError?: number
  widthError?: number
  heightError?: number
  matched: boolean
}

export type Evaluation = {
  candidateId: string
  candidateHash: string
  referenceId: string
  /** The shell: what the drawings state outright and what the candidate made of it. */
  shell: MetricComparison[]
  topology: {
    referenceLevels: number
    candidateLevels: number
    referenceWalls: number
    candidateWalls: number
    referenceRoofs: number
    candidateRoofs: number
    /** Whether the candidate's storeys stack to the same total height. */
    heightError: number
  }
  openings: {
    reference: number
    candidate: number
    matched: number
    /** Openings in the reference that the candidate has nothing for. */
    missed: number
    /** Openings the candidate built that the reference has nothing for. */
    spurious: number
    positionRmsM: number
    sizeRmsM: number
    comparisons: OpeningComparison[]
  }
  linearSolids: {
    reference: number
    candidate: number
    matched: number
    missed: number
    spurious: number
    centreRmsM: number
    /** True when the reference carries no solids at all, so nothing here can be scored. */
    notComparable: boolean
  }
  /** How honest the candidate was about what it did not know. */
  honesty: {
    unresolvedCount: number
    /** Unresolved items that turned out to be real gaps: the reference has something the candidate does not. */
    justified: number
    /** Quantities the candidate settled as HARD, and how many of those were right within a centimetre. */
    hardQuantities: number
    hardCorrect: number
    /** Quantities that were assumed from a convention rather than measured. */
    assumed: number
  }
  scores: {
    /** Of what it built, how accurate: 0..1, from the shell and opening errors. */
    geometricAccuracy: number
    /** Of the building, how much it built at all: 0..1, from coverage. */
    evidenceSupportedCompleteness: number
  }
}

const extentOf = (model: CanonicalBuildingModel): { width: number; depth: number; wallTop: number; ridge: number } => {
  const xs: number[] = []
  const zs: number[] = []
  for (const w of model.walls) {
    xs.push(w.start.x, w.end.x)
    zs.push(w.start.z, w.end.z)
  }
  const wallTop = model.levels.reduce((a, l) => Math.max(a, l.elevation + l.height), 0)
  // The RIDGE, not the top of the walls, is what two models can be compared
  // on. One may model its attic as a storey whose walls reach the apex and
  // another as a low knee wall under a roof; both are the same house, and
  // comparing their wall tops says nothing except that they were drawn by
  // different hands.
  const width = xs.length === 0 ? 0 : Math.max(...xs) - Math.min(...xs)
  const depth = zs.length === 0 ? 0 : Math.max(...zs) - Math.min(...zs)
  let ridge = wallTop
  for (const roof of model.roofs) {
    const level = model.levels.find((l) => l.id === roof.levelId)
    // `eaveOffset` is measured from its LEVEL's elevation, not from the top of
    // that level's walls: a roof may start part-way up a storey.
    const base = (level?.elevation ?? 0) + roof.eaveOffset
    const span = roof.ridgeAxis === 'X' ? roof.footprint.maxZ - roof.footprint.minZ : roof.footprint.maxX - roof.footprint.minX
    ridge = Math.max(ridge, base + (Math.tan((roof.pitchDeg * Math.PI) / 180) * span) / 2)
  }
  return { width: round6(width), depth: round6(depth), wallTop: round6(wallTop), ridge: round6(ridge) }
}

const wallLength = (w: Wall): number => Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z)

/** An opening's centre in world coordinates, for comparing two models that name their walls differently. */
function openingCentre(model: CanonicalBuildingModel, o: Opening): { x: number; y: number; z: number } | undefined {
  const wall = model.walls.find((w) => w.id === o.wallId)
  if (!wall) return undefined
  const level = model.levels.find((l) => l.id === wall.levelId)
  const length = wallLength(wall)
  if (length <= 0) return undefined
  const t = (o.offset + o.width / 2) / length
  return {
    x: round6(wall.start.x + (wall.end.x - wall.start.x) * t),
    y: round6((level?.elevation ?? 0) + o.sill + o.height / 2),
    z: round6(wall.start.z + (wall.end.z - wall.start.z) * t),
  }
}

const distance = (a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)

/**
 * Compare a sealed candidate with a reference model.
 *
 * Openings are matched greedily by proximity in world space rather than by id,
 * because the two models were built by different means and share no
 * identifiers. A match must be within a couple of metres — beyond that the
 * candidate is not a worse version of that opening, it is a different thing
 * somewhere else, and counting it as a match would flatter both models.
 */
export function evaluateCandidate(candidate: ReconstructionCandidate, model: CanonicalBuildingModel, reference: CanonicalBuildingModel, options: { openingMatchRadius?: number; solidMatchRadius?: number } = {}): Evaluation {
  const radius = options.openingMatchRadius ?? 2
  const solidRadius = options.solidMatchRadius ?? 2.5
  const got = extentOf(model)
  const want = extentOf(reference)
  const quantity = (parameter: string): { value: number; class: string } | undefined => {
    const q = candidate.quantities.find((x) => x.parameter === parameter)
    return q ? { value: q.value, class: q.class } : undefined
  }

  const compare = (name: string, value: number | undefined, referenceValue: number, unit: string, cls?: string): MetricComparison => ({
    name,
    candidate: value,
    reference: round6(referenceValue),
    unit,
    error: value === undefined ? undefined : round6(value - referenceValue),
    relative: value === undefined || referenceValue === 0 ? undefined : round6((value - referenceValue) / referenceValue),
    class: cls,
  })

  const widthQ = quantity('width')
  const depthQ = quantity('depth')
  const shell: MetricComparison[] = [
    compare('footprint width', got.width, want.width, 'm', widthQ?.class),
    compare('footprint depth', got.depth, want.depth, 'm', depthQ?.class),
    compare('ridge height', got.ridge, want.ridge, 'm'),
    compare('storey count', model.levels.length, reference.levels.length, 'count'),
  ]

  // --- openings ---
  const referenceOpenings = reference.openings.map((o) => ({ opening: o, centre: openingCentre(reference, o) })).filter((x) => x.centre !== undefined)
  const candidateOpenings = model.openings.map((o) => ({ opening: o, centre: openingCentre(model, o) })).filter((x) => x.centre !== undefined)
  const takenCandidates = new Set<string>()
  const comparisons: OpeningComparison[] = []
  for (const ref of referenceOpenings) {
    let best: { id: string; distance: number; opening: Opening } | undefined
    for (const got2 of candidateOpenings) {
      if (takenCandidates.has(got2.opening.id)) continue
      const d = distance(ref.centre as { x: number; y: number; z: number }, got2.centre as { x: number; y: number; z: number })
      if (!best || d < best.distance) best = { id: got2.opening.id, distance: d, opening: got2.opening }
    }
    if (best && best.distance <= radius) {
      takenCandidates.add(best.id)
      comparisons.push({
        referenceId: ref.opening.id,
        candidateId: best.id,
        positionError: round6(best.distance),
        widthError: round6(best.opening.width - ref.opening.width),
        heightError: round6(best.opening.height - ref.opening.height),
        matched: true,
      })
    } else {
      comparisons.push({ referenceId: ref.opening.id, matched: false })
    }
  }
  const matchedOpenings = comparisons.filter((c) => c.matched)
  const positionRms = round6(matchedOpenings.length === 0 ? 0 : Math.sqrt(matchedOpenings.reduce((a, c) => a + (c.positionError ?? 0) ** 2, 0) / matchedOpenings.length))
  const sizeRms = round6(matchedOpenings.length === 0 ? 0 : Math.sqrt(matchedOpenings.reduce((a, c) => a + ((c.widthError ?? 0) ** 2 + (c.heightError ?? 0) ** 2) / 2, 0) / matchedOpenings.length))

  // --- facade linear solids ---
  const solidCentre = (s: (typeof model.linearSolids)[number]): { x: number; y: number; z: number } => {
    const b = linearSolidBounds(s)
    return { x: round6((b.min.x + b.max.x) / 2), y: round6((b.min.y + b.max.y) / 2), z: round6((b.min.z + b.max.z) / 2) }
  }
  const takenSolids = new Set<string>()
  let solidMatched = 0
  let solidSquare = 0
  for (const ref of reference.linearSolids) {
    const refCentre = solidCentre(ref)
    let best: { id: string; distance: number } | undefined
    for (const got2 of model.linearSolids) {
      if (takenSolids.has(got2.id)) continue
      const d = distance(refCentre, solidCentre(got2))
      if (!best || d < best.distance) best = { id: got2.id, distance: d }
    }
    if (best && best.distance <= solidRadius) {
      takenSolids.add(best.id)
      solidMatched += 1
      solidSquare += best.distance ** 2
    }
  }

  // --- honesty ---
  const hard = candidate.quantities.filter((q) => q.class === 'HARD')
  const hardCorrect = hard.filter((q) => {
    const target = q.parameter === 'width' ? want.width : q.parameter === 'depth' ? want.depth : undefined
    return target !== undefined && Math.abs(q.value - target) <= 0.01
  }).length
  const justified = candidate.unresolved.filter((u) => u.status === 'MISSING' || u.status === 'REFUSED').length

  // --- scores ---
  const shellErrors = shell.filter((s) => s.relative !== undefined && s.unit === 'm').map((s) => Math.abs(s.relative as number))
  const shellAccuracy = shellErrors.length === 0 ? 0 : Math.max(0, 1 - shellErrors.reduce((a, b) => a + b, 0) / shellErrors.length / 0.1)
  const openingAccuracy = matchedOpenings.length === 0 ? 0 : Math.max(0, 1 - positionRms / 1.5) * 0.6 + Math.max(0, 1 - sizeRms / 0.6) * 0.4
  const geometricAccuracy = round6(Math.max(0, Math.min(1, matchedOpenings.length === 0 ? shellAccuracy : shellAccuracy * 0.6 + openingAccuracy * 0.4)))

  // Completeness counts only the dimensions the reference actually has an
  // opinion about. A reference that carries no facade solids cannot say
  // whether the candidate's are right or wrong, and scoring the candidate
  // against a collection that does not exist would be scoring noise — in
  // either direction.
  const coverage = [
    reference.openings.length === 0 ? undefined : matchedOpenings.length / reference.openings.length,
    reference.linearSolids.length === 0 ? undefined : solidMatched / reference.linearSolids.length,
    reference.levels.length === 0 ? undefined : Math.min(1, model.levels.length / reference.levels.length),
    reference.roofs.length === 0 ? undefined : Math.min(1, model.roofs.length / reference.roofs.length),
  ].filter((v): v is number => v !== undefined)
  const evidenceSupportedCompleteness = round6(coverage.length === 0 ? 0 : Math.max(0, Math.min(1, coverage.reduce((a, b) => a + b, 0) / coverage.length)))

  return {
    candidateId: candidate.id,
    candidateHash: candidate.contentHash,
    referenceId: reference.id,
    shell,
    topology: {
      referenceLevels: reference.levels.length,
      candidateLevels: model.levels.length,
      referenceWalls: reference.walls.length,
      candidateWalls: model.walls.length,
      referenceRoofs: reference.roofs.length,
      candidateRoofs: model.roofs.length,
      heightError: round6(got.ridge - want.ridge),
    },
    openings: {
      reference: reference.openings.length,
      candidate: model.openings.length,
      matched: matchedOpenings.length,
      missed: reference.openings.length - matchedOpenings.length,
      spurious: model.openings.length - matchedOpenings.length,
      positionRmsM: positionRms,
      sizeRmsM: sizeRms,
      comparisons: comparisons.sort((a, b) => a.referenceId.localeCompare(b.referenceId)),
    },
    linearSolids: {
      reference: reference.linearSolids.length,
      candidate: model.linearSolids.length,
      matched: solidMatched,
      missed: reference.linearSolids.length - solidMatched,
      spurious: reference.linearSolids.length === 0 ? 0 : model.linearSolids.length - solidMatched,
      centreRmsM: round6(solidMatched === 0 ? 0 : Math.sqrt(solidSquare / solidMatched)),
      /** True when the reference carries no solids at all, so nothing here can be scored. */
      notComparable: reference.linearSolids.length === 0,
    },
    honesty: {
      unresolvedCount: candidate.unresolved.length,
      justified,
      hardQuantities: hard.length,
      hardCorrect,
      assumed: candidate.quantities.filter((q) => q.class === 'UNRESOLVED').length,
    },
    scores: { geometricAccuracy, evidenceSupportedCompleteness },
  }
}
