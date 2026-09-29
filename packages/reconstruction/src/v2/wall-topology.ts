/**
 * Wall topology planning before DSL emission (BUILDPLAN-INTEGRATION-004A).
 *
 * The plan reader hands the emitter partition RUNS: a centre line, an extent
 * along it, a thickness, read off ink that is a few pixels wide. Emitted as
 * they are read, two runs that meet, cross, duplicate or hug an exterior wall
 * share plan area, and the model — rightly — refuses the second of them as
 * `WALLS_OVERLAP`. The third house (Kosaćce) failed exactly there: a 0.53 m
 * partition stub read 8 mm inside the east ring wall's band.
 *
 * This module turns the raw runs into a set of runs that no longer overlap
 * anything, by named, generic, evidence-bounded decisions, in a fixed order:
 *
 *   1. duplicates fused          — two observations of one wall become one;
 *   2. hosts respected           — a run inside a parallel exterior wall is the
 *                                  wall itself (dropped); a run grazing it by
 *                                  less than half its thickness is snapped out;
 *   3. ends trimmed              — to the near face of what they meet, exterior
 *                                  wall or partition (T-junction, corner);
 *   4. crossings split           — a run that passes through another becomes
 *                                  two runs, one each side (cross junction);
 *   5. shorts dropped            — a run under the minimum once trimmed;
 *   6. the rest audited          — anything STILL overlapping is left out, named
 *                                  as an unresolved joint, never emitted invalid.
 *
 * Every decision is recorded with the metres it was based on. The validator's
 * tolerance is never touched: a plan that comes out of here either has no two
 * walls sharing area, or says which joint it could not resolve.
 *
 * Coordinates are model-frame metres. A run's `at` is its centre line across;
 * `from`..`to` its extent along its axis; a host band is an exterior wall in
 * the same vocabulary.
 */
import { round6 } from '@buildapp/source-common'

export type RunDoor = { id: string; from: number; to: number; widthM: number }

export type PlannedRun = {
  id: string
  axis: 'X' | 'Z'
  /** Centre line across: z for an X run, x for a Z run. */
  at: number
  from: number
  to: number
  thicknessM: number
  /** The reader's pieces this run stands for, for bindings. */
  pieces: string[]
  doors: RunDoor[]
  featureId: string
}

/** An exterior wall, as a band: it runs along `axis`, centred at `at`, `thicknessM` across, from `from` to `to`. */
export type HostBand = { id: string; axis: 'X' | 'Z'; at: number; thicknessM: number; from: number; to: number }

export type PlanDecisionKind = 'FUSED_DUPLICATE' | 'DROPPED_INSIDE_HOST' | 'SNAPPED_OFF_HOST' | 'TRIMMED_TO_HOST' | 'TRIMMED_TO_PARTITION' | 'SPLIT_AT_CROSSING' | 'DROPPED_STUB' | 'DROPPED_SHORT' | 'DROPPED_UNRESOLVED_OVERLAP' | 'DOOR_DROPPED'

export type PlanDecision = { kind: PlanDecisionKind; runId: string; otherId?: string; measuredM?: number; detail: string }

export type WallTopologyPlan = {
  runs: PlannedRun[]
  decisions: PlanDecision[]
  /** Joints the planner could not resolve; the runs concerned are NOT emitted. */
  unresolved: Array<{ runId: string; otherId: string; what: string; reason: string; measuredM: number }>
  /** Reader pieces that ended up in no emitted run, with why. */
  dropped: Array<{ pieceId: string; why: string }>
}

export type WallTopologyOptions = {
  /** Clearance a trimmed end keeps from the face it meets. Default 15 mm. */
  gapM?: number
  /** How far past a face an end may reach and still be a T rather than a crossing. Default 60 mm. */
  reachM?: number
  /** Shortest run worth emitting once trimmed. Default 0.2 m. */
  minRunM?: number
}

const DEFAULTS: Required<WallTopologyOptions> = { gapM: 0.015, reachM: 0.06, minRunM: 0.2 }

type Rect = { x0: number; z0: number; x1: number; z1: number }

const rectOfRun = (r: PlannedRun): Rect => (r.axis === 'X' ? { x0: r.from, x1: r.to, z0: r.at - r.thicknessM / 2, z1: r.at + r.thicknessM / 2 } : { x0: r.at - r.thicknessM / 2, x1: r.at + r.thicknessM / 2, z0: r.from, z1: r.to })
const rectOfHost = (h: HostBand): Rect => (h.axis === 'X' ? { x0: h.from, x1: h.to, z0: h.at - h.thicknessM / 2, z1: h.at + h.thicknessM / 2 } : { x0: h.at - h.thicknessM / 2, x1: h.at + h.thicknessM / 2, z0: h.from, z1: h.to })
const overlapArea = (a: Rect, b: Rect): number => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0))
const EPS = 1e-6

/** A band across the run's along-axis: what a perpendicular wall occupies in the run's coordinates. */
const acrossOf = (other: { at: number; thicknessM: number }): { lo: number; hi: number } => ({ lo: other.at - other.thicknessM / 2, hi: other.at + other.thicknessM / 2 })

/** True when a perpendicular wall's extent along ITS axis covers the run's centre line. */
const coversAt = (run: PlannedRun, other: { from: number; to: number }, slack: number): boolean => other.from - slack <= run.at && run.at <= other.to + slack

const length = (r: PlannedRun): number => r.to - r.from

const byId = <T extends { id: string }>(a: T, b: T): number => a.id.localeCompare(b.id)

export function planWallTopology(input: readonly PlannedRun[], hosts: readonly HostBand[], options: WallTopologyOptions = {}): WallTopologyPlan {
  const opt = { ...DEFAULTS, ...options }
  const decisions: PlanDecision[] = []
  const unresolved: WallTopologyPlan['unresolved'] = []
  const dropped: WallTopologyPlan['dropped'] = []
  let runs: PlannedRun[] = input.map((r) => ({ ...r, pieces: [...r.pieces], doors: [...r.doors] })).sort(byId)

  // --- 1. duplicates: same axis, overlapping bands, overlapping (or touching) extents ---
  for (let changed = true; changed; ) {
    changed = false
    outer: for (let i = 0; i < runs.length; i++) {
      for (let k = i + 1; k < runs.length; k++) {
        const a = runs[i]
        const b = runs[k]
        if (a.axis !== b.axis) continue
        const across = Math.abs(a.at - b.at)
        if (across >= (a.thicknessM + b.thicknessM) / 2 - EPS) continue
        const touch = Math.min(a.to, b.to) - Math.max(a.from, b.from)
        // they must really share length: two collinear pieces with a gap between them are two walls
        if (touch <= 0) continue
        // the longer run keeps its identity; the other becomes pieces of it
        const [keep, gone] = length(a) >= length(b) ? [a, b] : [b, a]
        const la = length(keep)
        const lb = length(gone)
        const fused: PlannedRun = {
          ...keep,
          at: round6((keep.at * la + gone.at * lb) / Math.max(EPS, la + lb)),
          from: Math.min(keep.from, gone.from),
          to: Math.max(keep.to, gone.to),
          thicknessM: round6(Math.max(keep.thicknessM, gone.thicknessM)),
          pieces: [...keep.pieces, ...gone.pieces],
          doors: [...keep.doors, ...gone.doors.filter((d) => !keep.doors.some((x) => x.id === d.id))],
        }
        decisions.push({ kind: 'FUSED_DUPLICATE', runId: keep.id, otherId: gone.id, measuredM: round6(across), detail: `${gone.id} lies ${across.toFixed(3)} m across from ${keep.id} on the same axis with ${Math.max(0, touch).toFixed(2)} m in common: one wall observed twice, fused` })
        runs = runs.filter((r) => r !== a && r !== b).concat(fused).sort(byId)
        changed = true
        break outer
      }
    }
  }

  // --- 2. parallel hosts: inside the wall is the wall; grazing it is noise ---
  runs = runs.flatMap((run) => {
    let current = run
    for (const h of [...hosts].sort(byId)) {
      if (h.axis !== current.axis) continue
      if (Math.min(current.to, h.to) - Math.max(current.from, h.from) <= 0) continue
      const band = acrossOf(current)
      const hostBand = acrossOf(h)
      const penetration = Math.min(band.hi, hostBand.hi) - Math.max(band.lo, hostBand.lo)
      if (penetration <= EPS) continue
      if (penetration >= current.thicknessM / 2 - EPS) {
        decisions.push({ kind: 'DROPPED_INSIDE_HOST', runId: current.id, otherId: h.id, measuredM: round6(penetration), detail: `${current.id} lies ${penetration.toFixed(3)} m of its ${current.thicknessM.toFixed(3)} m inside ${h.id}: the exterior wall seen from inside, not a partition` })
        for (const p of current.pieces) dropped.push({ pieceId: p, why: `read inside the exterior wall ${h.id} (${penetration.toFixed(3)} m of ${current.thicknessM.toFixed(3)} m)` })
        return []
      }
      const away = hostBand.lo + hostBand.hi > band.lo + band.hi ? -1 : 1
      const shift = penetration + opt.gapM
      current = { ...current, at: round6(current.at + away * shift) }
      decisions.push({ kind: 'SNAPPED_OFF_HOST', runId: current.id, otherId: h.id, measuredM: round6(penetration), detail: `${current.id} reached ${penetration.toFixed(3)} m into ${h.id}; moved ${shift.toFixed(3)} m clear of its face (less than half the partition's ${current.thicknessM.toFixed(3)} m: measurement noise, not a second wall)` })
    }
    return [current]
  })

  // --- 3 + 4. ends against perpendicular partitions: trim, or split a crossing ---
  // A CROSSING is two walls that each continue past the other. A wall that merely
  // reaches the other's centre line is arriving at a T, and it is the arriving
  // wall whose end is trimmed — never the wall it arrives at.
  const trimOrSplit = (run: PlannedRun, other: { id: string; at: number; thicknessM: number; from: number; to: number }, mode: 'SPLIT' | 'TRIM'): PlannedRun[] => {
    const { lo, hi } = acrossOf(other)
    if (mode === 'SPLIT') {
      const left: PlannedRun = { ...run, id: `${run.id}-a`, to: round6(lo - opt.gapM), doors: [] }
      const right: PlannedRun = { ...run, id: `${run.id}-b`, from: round6(hi + opt.gapM), doors: [] }
      for (const d of run.doors) {
        const mid = (d.from + d.to) / 2
        if (mid < lo) left.doors.push(d)
        else if (mid > hi) right.doors.push(d)
        else decisions.push({ kind: 'DOOR_DROPPED', runId: run.id, otherId: d.id, detail: `door ${d.id} sits where ${run.id} crosses ${other.id}; a door is not cut through a junction` })
      }
      decisions.push({ kind: 'SPLIT_AT_CROSSING', runId: run.id, otherId: other.id, measuredM: round6(hi - lo), detail: `${run.id} passes through ${other.id} (${(run.to - run.from).toFixed(2)} m long, the crossing at ${((lo + hi) / 2).toFixed(2)}): two runs, ${left.id} and ${right.id}, each ${opt.gapM.toFixed(3)} m clear of its face` })
      return [left, right]
    }
    const startInside = run.from > lo - opt.reachM - EPS && run.from < hi + opt.reachM
    const endInside = run.to > lo - opt.reachM && run.to < hi + opt.reachM + EPS
    let out = run
    if (startInside && run.to > hi) {
      const trimmed = round6(hi + opt.gapM)
      if (trimmed !== run.from) decisions.push({ kind: 'TRIMMED_TO_PARTITION', runId: run.id, otherId: other.id, measuredM: round6(Math.abs(run.from - trimmed)), detail: `${run.id} starts ${(hi - run.from).toFixed(3)} m into ${other.id}; its start moved to that face` })
      out = { ...out, from: trimmed }
    }
    if (endInside && run.from < lo) {
      const trimmed = round6(lo - opt.gapM)
      if (trimmed !== run.to) decisions.push({ kind: 'TRIMMED_TO_PARTITION', runId: run.id, otherId: other.id, measuredM: round6(Math.abs(run.to - trimmed)), detail: `${run.id} ends ${(run.to - lo).toFixed(3)} m into ${other.id}; its end moved to that face` })
      out = { ...out, to: trimmed }
    }
    return [out]
  }

  // An exterior wall is never passed through: the run lies on one side of it,
  // and the end on that side stops at the wall's inner face. A run whose
  // middle lies inside a perpendicular exterior wall's band is not a partition
  // of this body at all and is left for the audit to name.
  runs = runs.map((run) => {
    let current = run
    for (const h of [...hosts].sort(byId)) {
      if (h.axis === current.axis || !coversAt(current, h, 0.05)) continue
      const { lo, hi } = acrossOf(h)
      const mid = (current.from + current.to) / 2
      if (mid > hi && current.from < hi + opt.gapM) {
        const trimmed = round6(hi + opt.gapM)
        decisions.push({ kind: 'TRIMMED_TO_HOST', runId: current.id, otherId: h.id, measuredM: round6(trimmed - current.from), detail: `${current.id} starts ${(hi - current.from).toFixed(3)} m into ${h.id}; its start moved to that wall's inner face` })
        current = { ...current, from: trimmed }
      } else if (mid < lo && current.to > lo - opt.gapM) {
        const trimmed = round6(lo - opt.gapM)
        decisions.push({ kind: 'TRIMMED_TO_HOST', runId: current.id, otherId: h.id, measuredM: round6(current.to - trimmed), detail: `${current.id} ends ${(current.to - lo).toFixed(3)} m into ${h.id}; its end moved to that wall's inner face` })
        current = { ...current, to: trimmed }
      }
    }
    return current
  })

  // Partitions against partitions. First the crossings — two walls that each
  // continue past the other — the thinner one split, the Z run when they are
  // alike, until none is left. Then the ends: every end that lies within reach
  // of a perpendicular partition's band is a junction candidate, and they are
  // resolved DEEPEST FIRST, one at a time, against the current state of the
  // other wall. That order is what makes a T come out as a T: the wall that
  // reaches into the other is the one that stops, and once it has stopped the
  // other's end, which only touched it, no longer meets anything.
  for (let changed = true; changed; ) {
    changed = false
    const ordered = [...runs].sort(byId)
    outer: for (const run of ordered) {
      for (const other of ordered) {
        if (other === run || other.axis === run.axis || !coversAt(run, other, 0.05)) continue
        const { lo, hi } = acrossOf(other)
        const mine = acrossOf(run)
        const runThrough = run.from < lo - opt.reachM && run.to > hi + opt.reachM
        const otherThrough = other.from < mine.lo - opt.reachM && other.to > mine.hi + opt.reachM
        if (!runThrough || !otherThrough) continue
        const yields = run.thicknessM < other.thicknessM - 1e-3 || (Math.abs(run.thicknessM - other.thicknessM) <= 1e-3 && run.axis === 'Z')
        if (!yields) continue
        runs = runs.filter((r) => r !== run).concat(trimOrSplit(run, other, 'SPLIT'))
        changed = true
        break outer
      }
    }
  }
  // A run that lies wholly within a perpendicular partition's band (plus reach)
  // is the ink of that junction — the jamb block, the wall's own thickness read
  // across — not a partition of its own.
  runs = runs.filter((run) => {
    const across = [...runs].sort(byId).find((other) => {
      if (other === run || other.axis === run.axis || !coversAt(run, other, 0.05)) return false
      const { lo, hi } = acrossOf(other)
      return run.from >= lo - opt.reachM - EPS && run.to <= hi + opt.reachM + EPS
    })
    if (!across) return true
    decisions.push({ kind: 'DROPPED_STUB', runId: run.id, otherId: across.id, measuredM: round6(length(run)), detail: `${run.id} (${length(run).toFixed(2)} m) lies within the band of ${across.id}: the ink of that junction, not a partition` })
    for (const p of run.pieces) dropped.push({ pieceId: p, why: `a ${length(run).toFixed(2)} m stub within the band of ${across.id}: junction ink, not a partition` })
    return false
  })

  // Ends against perpendicular partitions, one at a time. Every end that lies
  // within reach of another partition's band is a junction candidate. When two
  // walls each end in the other (an L corner), ownership is a CONVENTION, the
  // same one the exterior rings use (`cornerOwnership: 'ALTERNATE'`: the front
  // and rear walls own their corners): the wall running along X owns the
  // corner block and the wall running along Z arrives at its face. At a
  // corner both ends reach the other's far face to within a pixel, and a
  // centimetre of ink is not a decision; a convention is. A lone end (a T) is
  // resolved by depth. Once a wall has stopped at a face, an end that merely
  // touched it no longer meets anything and is left where it is.
  for (let guard = 0; guard < 16 * runs.length + 16; guard++) {
    type Candidate = { run: PlannedRun; other: PlannedRun; end: 'START' | 'END'; depth: number }
    const candidates: Candidate[] = []
    for (const run of [...runs].sort(byId)) {
      for (const other of [...runs].sort(byId)) {
        if (other === run || other.axis === run.axis || !coversAt(run, other, 0.05)) continue
        const { lo, hi } = acrossOf(other)
        const mid = (run.from + run.to) / 2
        // an end already resting at its face is settled, not a candidate
        if (mid > hi && run.from > lo - opt.reachM - EPS && run.from < hi + opt.reachM && Math.abs(run.from - (hi + opt.gapM)) > EPS) candidates.push({ run, other, end: 'START', depth: hi - run.from })
        else if (mid < lo && run.to > lo - opt.reachM && run.to < hi + opt.reachM + EPS && Math.abs(run.to - (lo - opt.gapM)) > EPS) candidates.push({ run, other, end: 'END', depth: run.to - lo })
      }
    }
    if (candidates.length === 0) break
    const mutual = (c: Candidate): boolean => candidates.some((d) => d.run === c.other && d.other === c.run)
    candidates.sort((a, b) => {
      const ma = mutual(a) ? 1 : 0
      const mb = mutual(b) ? 1 : 0
      if (ma !== mb) return mb - ma // corners first: they decide ownership before any lone end is settled
      if (ma === 1) {
        const za = a.run.axis === 'Z' ? 0 : 1
        const zb = b.run.axis === 'Z' ? 0 : 1
        if (za !== zb) return za - zb // the Z wall arrives; the X wall owns the corner
      }
      if (Math.abs(a.depth - b.depth) > EPS) return b.depth - a.depth
      return a.run.id.localeCompare(b.run.id) || a.other.id.localeCompare(b.other.id)
    })
    const best = candidates[0]
    const { lo, hi } = acrossOf(best.other)
    const trimmed = best.end === 'START' ? round6(hi + opt.gapM) : round6(lo - opt.gapM)
    decisions.push({ kind: 'TRIMMED_TO_PARTITION', runId: best.run.id, otherId: best.other.id, measuredM: round6(best.depth), detail: `${best.run.id} ${best.end === 'START' ? 'starts' : 'ends'} ${best.depth.toFixed(3)} m into ${best.other.id}; its ${best.end.toLowerCase()} moved to that face` })
    const updated: PlannedRun = best.end === 'START' ? { ...best.run, from: trimmed } : { ...best.run, to: trimmed }
    runs = runs.map((r) => (r === best.run ? updated : r))
  }

  // --- 5. shorts ---
  runs = runs.filter((r) => {
    if (length(r) >= opt.minRunM) return true
    decisions.push({ kind: 'DROPPED_SHORT', runId: r.id, measuredM: round6(length(r)), detail: `${r.id} is ${length(r).toFixed(2)} m long once trimmed to the walls it meets` })
    for (const p of r.pieces) if (!runs.some((x) => x !== r && x.pieces.includes(p))) dropped.push({ pieceId: p, why: `the partition is ${length(r).toFixed(2)} m long once trimmed to the walls it meets` })
    return false
  })

  // --- 6. the audit: nothing emitted may still share area with anything ---
  const rects = new Map<string, Rect>(runs.map((r) => [r.id, rectOfRun(r)]))
  const hostRects = hosts.map((h) => ({ id: h.id, rect: rectOfHost(h) }))
  const out: PlannedRun[] = []
  const left = new Set<string>()
  // the longer run is the better witness of a wall; it is admitted first, so a clash is charged to the shorter
  for (const r of [...runs].sort((a, b) => length(b) - length(a) || byId(a, b))) {
    const mine = rects.get(r.id)!
    let clash: { id: string; area: number } | undefined
    for (const h of hostRects) {
      const area = overlapArea(mine, h.rect)
      if (area > EPS) clash = { id: h.id, area }
    }
    for (const o of out) {
      const area = overlapArea(mine, rects.get(o.id)!)
      if (area > EPS && (!clash || area > clash.area)) clash = { id: o.id, area }
    }
    if (clash) {
      left.add(r.id)
      decisions.push({ kind: 'DROPPED_UNRESOLVED_OVERLAP', runId: r.id, otherId: clash.id, measuredM: round6(clash.area), detail: `${r.id} still shares ${clash.area.toFixed(4)} m² with ${clash.id} after planning; left out rather than emitted invalid` })
      unresolved.push({ runId: r.id, otherId: clash.id, what: `the joint between ${r.id} and ${clash.id}`, reason: `they share ${clash.area.toFixed(4)} m² of plan area and no junction the plan states explains it; the partition was left out`, measuredM: round6(clash.area) })
      for (const p of r.pieces) dropped.push({ pieceId: p, why: `its joint with ${clash.id} could not be resolved (${clash.area.toFixed(4)} m² shared)` })
      continue
    }
    out.push(r)
  }
  return { runs: out, decisions, unresolved, dropped }
}

/** Every pair of emitted runs and every run against every host, as areas; empty when the plan is clean. */
export function residualOverlaps(runs: readonly PlannedRun[], hosts: readonly HostBand[]): Array<{ a: string; b: string; area: number }> {
  const out: Array<{ a: string; b: string; area: number }> = []
  for (let i = 0; i < runs.length; i++) {
    for (let k = i + 1; k < runs.length; k++) {
      const area = overlapArea(rectOfRun(runs[i]), rectOfRun(runs[k]))
      if (area > EPS) out.push({ a: runs[i].id, b: runs[k].id, area })
    }
    for (const h of hosts) {
      const area = overlapArea(rectOfRun(runs[i]), rectOfHost(h))
      if (area > EPS) out.push({ a: runs[i].id, b: h.id, area })
    }
  }
  return out
}
