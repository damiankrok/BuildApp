/**
 * Validating a provider's answer.
 *
 * Everything a model returns is treated as a claim from an untrusted source
 * until it has passed through here. The checks are not stylistic: each one
 * corresponds to a way a multimodal model actually fails.
 *
 *  - it answers about a different picture than the one it was shown, because
 *    the conversation carried another image;
 *  - it returns coordinates outside [0, 1], because it imagined a wider frame
 *    or reasoned in pixels of a size it made up;
 *  - it returns a POLYGON with two points, or a RECT with five;
 *  - it returns a zero-length segment, or a polygon with no area;
 *  - it refers to observation index 7 in a list of four;
 *  - it answers a facade question in plan vocabulary;
 *  - it asserts two things in one image are the same feature seen in two
 *    views, which one image cannot show.
 *
 * A rejected answer is thrown away whole. There is no partial acceptance:
 * a response that is wrong about the picture it looked at is not more
 * trustworthy in its other half.
 */
import { VisionObservationResponseSchema } from './schema.js'
import type { VisionGeometry, VisionObservationRequest, VisionObservationResponse, VisionTask } from './schema.js'
import { VisionResponseRejected } from './reasoner.js'
import { taskDefinition } from './tasks.js'

/** How far outside [0, 1] a coordinate may fall before the answer is refused. A hair, for a feature that touches the edge. */
export const COORD_MARGIN = 0.005

const ARITY: Record<VisionGeometry['type'], (n: number) => boolean> = {
  POINT: (n) => n === 1,
  SEGMENT: (n) => n === 2,
  POLYLINE: (n) => n >= 2,
  POLYGON: (n) => n >= 3,
  RECT: (n) => n === 2,
  LINE_FAMILY: (n) => n >= 4 && n % 2 === 0,
}

const dist = (a: readonly [number, number], b: readonly [number, number]): number => Math.hypot(a[0] - b[0], a[1] - b[1])

/** Anything smaller than this in normalized units is a point pretending to be a shape. */
const DEGENERATE = 1e-6

function checkGeometry(g: VisionGeometry, where: string): void {
  if (!ARITY[g.type](g.points.length)) throw new VisionResponseRejected('GEOMETRY_ARITY', `${where}: a ${g.type} cannot have ${g.points.length} points`)
  for (const [x, y] of g.points) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new VisionResponseRejected('SCHEMA_INVALID', `${where}: coordinate (${x}, ${y}) is not a finite number`)
    if (x < -COORD_MARGIN || x > 1 + COORD_MARGIN || y < -COORD_MARGIN || y > 1 + COORD_MARGIN) {
      throw new VisionResponseRejected('OUT_OF_BOUNDS', `${where}: coordinate (${x}, ${y}) lies outside the image the provider was shown`)
    }
  }
  if (g.type === 'SEGMENT' && dist(g.points[0], g.points[1]) < DEGENERATE) throw new VisionResponseRejected('DEGENERATE_GEOMETRY', `${where}: a segment of zero length locates nothing`)
  if (g.type === 'RECT') {
    const [a, b] = g.points
    if (Math.abs(a[0] - b[0]) < DEGENERATE || Math.abs(a[1] - b[1]) < DEGENERATE) throw new VisionResponseRejected('DEGENERATE_GEOMETRY', `${where}: a rectangle of zero width or height locates nothing`)
  }
  if (g.type === 'POLYGON') {
    let two = 0
    for (let i = 0; i < g.points.length; i += 1) {
      const p = g.points[i]
      const q = g.points[(i + 1) % g.points.length]
      two += p[0] * q[1] - q[0] * p[1]
    }
    if (Math.abs(two) / 2 < DEGENERATE) throw new VisionResponseRejected('DEGENERATE_GEOMETRY', `${where}: a polygon of zero area locates nothing`)
  }
  if (g.type === 'POLYLINE' || g.type === 'LINE_FAMILY') {
    const total = g.points.slice(1).reduce((acc, p, i) => acc + dist(g.points[i], p), 0)
    if (total < DEGENERATE) throw new VisionResponseRejected('DEGENERATE_GEOMETRY', `${where}: every point coincides`)
  }
}

/**
 * Parse and check one provider answer against the request that produced it.
 * Throws `VisionResponseRejected` on anything inadmissible; returns the
 * validated response otherwise.
 */
export function validateVisionResponse(raw: unknown, request: VisionObservationRequest): VisionObservationResponse {
  const parsed = VisionObservationResponseSchema.safeParse(raw)
  if (!parsed.success) throw new VisionResponseRejected('SCHEMA_INVALID', `the provider's answer does not fit the observation schema: ${parsed.error.issues.map((i) => `${i.path.join('.')} ${i.message}`).slice(0, 6).join('; ')}`, parsed.error.issues)
  const response = parsed.data

  if (response.task !== request.task) throw new VisionResponseRejected('WRONG_TASK', `asked for ${request.task}, answered ${response.task}`)
  if (response.assetByteHash !== request.asset.byteHash) {
    throw new VisionResponseRejected('WRONG_ASSET', `the provider answered about bytes ${response.assetByteHash.slice(0, 12)} but was shown ${request.asset.byteHash.slice(0, 12)}`)
  }

  const def = taskDefinition(request.task)
  const allowedKinds = new Set<string>(def.kinds)
  const allowedRelations = new Set<string>(def.relations)
  const cap = request.maxObservations ?? 256
  if (response.observations.length > cap) throw new VisionResponseRejected('TOO_MANY_OBSERVATIONS', `${response.observations.length} observations exceeds the ${cap} asked for`)

  response.observations.forEach((o, i) => {
    if (!allowedKinds.has(o.kind)) throw new VisionResponseRejected('KIND_NOT_ALLOWED', `observation ${i}: ${o.kind} is not part of the ${request.task} vocabulary`)
    checkGeometry(o.geometry, `observation ${i}`)
    o.alternatives?.forEach((alt, j) => {
      if (alt.geometry) checkGeometry(alt.geometry, `observation ${i} alternative ${j}`)
    })
  })

  response.relations.forEach((r, i) => {
    if (!allowedRelations.has(r.kind)) throw new VisionResponseRejected('RELATION_NOT_ALLOWED', `relation ${i}: ${r.kind} cannot be asserted from one image`)
    if (r.from >= response.observations.length || r.to >= response.observations.length) {
      throw new VisionResponseRejected('RELATION_INDEX', `relation ${i} refers to observation ${Math.max(r.from, r.to)} in a list of ${response.observations.length}`)
    }
    if (r.from === r.to) throw new VisionResponseRejected('RELATION_INDEX', `relation ${i} relates observation ${r.from} to itself`)
  })

  return response
}

/** Parse a provider's raw text as JSON, refusing anything that is not an object. */
export function parseProviderJson(text: string, task: VisionTask): unknown {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch (err) {
    throw new VisionResponseRejected('MALFORMED_JSON', `the ${task} answer was not valid JSON: ${(err as Error).message}`)
  }
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new VisionResponseRejected('MALFORMED_JSON', `the ${task} answer was ${Array.isArray(value) ? 'an array' : typeof value}, not an object`)
  return value
}
