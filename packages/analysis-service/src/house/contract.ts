/**
 * v3.54.10 — one meaning for the reading's data. The tool schemas in `read.ts` (READING_TOOLS) are the single source:
 * the provider gets them (FULL or SLIM, STRICT or NON_STRICT), and the same schemas validate every answer here — live,
 * non-strict and replayed alike — so that the shape the program consumes never depends on which variant answered.
 *
 * Rules, fixed and versioned:
 * - a field the schema does not name is dropped and said (`UNKNOWN_FIELD`); a missing required field fails the item
 *   it belongs to (`MISSING_FIELD`) — except a field whose type allows null, which omitted is read as null ("not said")
 *   and recorded; an array item that fails is removed and said (`ITEM_REJECTED`), the rest stays;
 * - `null` is a value only where the schema's type lists `null`; an omitted optional field is "not said", never a
 *   default;
 * - an enum value outside its list fails the item (`ENUM`); a number that is not finite fails it (`NUMBER`);
 * - the ONE migration: a value the schema types as array or object that arrives as JSON text (a non-strict answer)
 *   is parsed by rule `JSON_TEXT@1` and the fact is recorded with its path; text that is not that JSON fails the item.
 *   Nothing else is ever read out of free text.
 * The raw answer is kept as given (a deep copy taken before any of this); what was changed is listed.
 */

export const CONFORM_RULES_VERSION = 'conform@1' as const

export type ConformIssue = { path: string; code: 'UNKNOWN_FIELD' | 'MISSING_FIELD' | 'ITEM_REJECTED' | 'TYPE' | 'ENUM' | 'NUMBER'; why: string }
export type ConformMigration = { path: string; rule: 'JSON_TEXT@1' }
type Schema = { type?: string | string[]; enum?: unknown[]; properties?: Record<string, Schema>; required?: string[]; items?: Schema; additionalProperties?: boolean }

const typesOf = (s: Schema): string[] => (s.type === undefined ? [] : Array.isArray(s.type) ? s.type : [s.type])

class ItemFailed extends Error {}

/** Validate (and minimally migrate) `value` against `schema`. Returns the conformed value; never mutates its input. */
export function conformAnswer(schema: unknown, value: unknown, opt: { keepUnknown?: boolean; /** a recording of an older contract: a required field it did not have is not said, not a failure */ lenientRequired?: boolean } = {}): { value: unknown; issues: ConformIssue[]; migrations: ConformMigration[] } {
  const issues: ConformIssue[] = []
  const migrations: ConformMigration[] = []
  const walk = (s: Schema, v: unknown, path: string): unknown => {
    const types = typesOf(s)
    if (v === null) {
      if (types.includes('null')) return null
      issues.push({ path, code: 'TYPE', why: 'null where the schema has no null' })
      throw new ItemFailed()
    }
    if ((types.includes('array') || types.includes('object')) && typeof v === 'string') {
      if (!/^\s*[[{]/.test(v)) {
        issues.push({ path, code: 'TYPE', why: `text where ${types.join('|')} was asked` })
        throw new ItemFailed()
      }
      try {
        v = JSON.parse(v)
        migrations.push({ path, rule: 'JSON_TEXT@1' })
      } catch {
        issues.push({ path, code: 'TYPE', why: 'text that is not the JSON it starts as' })
        throw new ItemFailed()
      }
    }
    if (s.enum && !s.enum.includes(v)) {
      issues.push({ path, code: 'ENUM', why: `${JSON.stringify(v)} is not one of ${s.enum.length} values` })
      throw new ItemFailed()
    }
    if (types.includes('array') && Array.isArray(v)) {
      const out: unknown[] = []
      v.forEach((x, i) => {
        try {
          out.push(s.items ? walk(s.items, x, `${path}[${i}]`) : x)
        } catch (e) {
          if (!(e instanceof ItemFailed)) throw e
          issues.push({ path: `${path}[${i}]`, code: 'ITEM_REJECTED', why: 'the item does not have the shape asked for; removed' })
        }
      })
      return out
    }
    if (types.includes('object') && v !== null && typeof v === 'object' && !Array.isArray(v)) {
      const o = v as Record<string, unknown>
      const props = s.properties ?? {}
      const out: Record<string, unknown> = {}
      const nulled = new Set<string>()
      for (const k of s.required ?? []) {
        if (k in o) continue
        if (typesOf(props[k] ?? {}).includes('null')) {
          nulled.add(k)
          issues.push({ path: `${path}.${k}`, code: 'MISSING_FIELD', why: 'omitted; its type allows null: read as null (not said)' })
          continue
        }
        if (opt.lenientRequired) {
          issues.push({ path: `${path}.${k}`, code: 'MISSING_FIELD', why: 'omitted in a recording of an older contract: not said' })
          continue
        }
        issues.push({ path: `${path}.${k}`, code: 'MISSING_FIELD', why: 'a required field is missing' })
        throw new ItemFailed()
      }
      // keys in the schema's own order: the same content in another key order conforms to the same value
      for (const k of Object.keys(props)) {
        if (nulled.has(k)) out[k] = null
        else if (k in o && o[k] !== undefined) out[k] = walk(props[k], o[k], `${path}.${k}`)
      }
      for (const k of Object.keys(o).sort()) {
        if (k in props) continue
        if (opt.keepUnknown) out[k] = o[k]
        issues.push({ path: `${path}.${k}`, code: 'UNKNOWN_FIELD', why: opt.keepUnknown ? 'not in the current schema; kept (a recording of an older contract)' : 'not in the schema; dropped' })
      }
      return out
    }
    if ((types.includes('number') || types.includes('integer')) && typeof v === 'number') {
      if (!Number.isFinite(v) || (types.includes('integer') && !types.includes('number') && !Number.isInteger(v))) {
        issues.push({ path, code: 'NUMBER', why: `${v} is not a ${types.includes('integer') ? 'whole' : 'finite'} number` })
        throw new ItemFailed()
      }
      return v
    }
    if (types.includes('string') && typeof v === 'string') return v
    if (types.includes('boolean') && typeof v === 'boolean') return v
    if (types.length === 0) return v
    issues.push({ path, code: 'TYPE', why: `${Array.isArray(v) ? 'array' : typeof v} where ${types.join('|')} was asked` })
    throw new ItemFailed()
  }
  try {
    return { value: walk(schema as Schema, value, '$'), issues, migrations }
  } catch (e) {
    if (!(e instanceof ItemFailed)) throw e
    return { value: undefined, issues, migrations }
  }
}

/** Every leaf field path of a tool schema (`elevations[].openings[].mullionsX`), for the request register and the capability check. */
export function schemaFields(schema: unknown, prefix = ''): string[] {
  const s = schema as Schema
  const types = typesOf(s)
  if (types.includes('object') && s.properties) return Object.entries(s.properties).flatMap(([k, v]) => schemaFields(v, prefix ? `${prefix}.${k}` : k))
  if (types.includes('array') && s.items && (typesOf(s.items).includes('object') || typesOf(s.items).includes('array'))) return schemaFields(s.items, `${prefix}[]`)
  return [prefix]
}

/** JSON with object keys sorted at every depth; array order kept (a polygon's order is meaning). */
export function canonicalJson(value: unknown): string {
  const walk = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(walk)
    if (v === null || typeof v !== 'object') return v
    return Object.fromEntries(Object.keys(v as Record<string, unknown>).sort().map((k) => [k, walk((v as Record<string, unknown>)[k])]))
  }
  return JSON.stringify(walk(value))
}

/**
 * The capability register: every field a reading tool asks for, what it becomes in the house document, which code
 * consumes it, and how a review can correct it. `NOTE_ONLY` fields explain uncertainty and are named as such; a field
 * missing here is caught by a test (no field without a declared fate).
 */
export type Capability = { field: string; document: string; consumer: string; correction: string }
export const READING_CAPABILITIES: Record<string, Capability> = {
  'DETAILS:elevations[].openings[].contour': { field: 'which contour the opening box traces (FRAME | GLASS | EXPOSED)', document: 'observations.elevations[].openings[].contour', consumer: 'resolveHouse openings: an EXPOSED box gives no sill or low head; FRAME stays frame', correction: 'SET_OPENING_DETAIL' },
  'DETAILS:elevations[].openings[].hiddenBelowY': { field: 'the row below which the opening is hidden', document: 'observations.elevations[].openings[].hiddenBelowY', consumer: 'resolveHouse openings: rows below are not read as sill/head', correction: 'SET_OPENING_DETAIL' },
  'DETAILS:elevations[].openings[].hiddenBy': { field: 'what hides it', document: 'observations.elevations[].openings[].hiddenBy', consumer: 'resolveHouse openings (trace)', correction: 'SET_OPENING_DETAIL' },
  'DETAILS:elevations[].openings[].mullionsX': { field: 'columns of the vertical profiles between panes', document: 'geometry.openings[].divisions.mullions', consumer: 'houseProgram: placeWindow divisions / placeDoor panel fractions', correction: 'SET_OPENING_DETAIL' },
  'DETAILS:elevations[].openings[].transomsY': { field: 'rows of horizontal profiles', document: 'geometry.openings[].divisions.transoms', consumer: 'recorded; the kernel has no transom in a window (named REPRESENTATION_LIMIT)', correction: 'SET_OPENING_DETAIL' },
  'DETAILS:elevations[].openings[].doorLeaves': { field: 'how many of its panes are doors', document: 'geometry.openings[].divisions.doorLeaves', consumer: 'houseProgram: GLAZED_DOOR panel kinds', correction: 'SET_OPENING_DETAIL' },
  'DETAILS:elevations[].openings[].id': { field: 'the opening it speaks of (the id the program gave)', document: 'binding', consumer: 'documentFromReading', correction: '-' },
  'DETAILS:elevations[].picture': { field: 'which picture', document: 'binding (stable picture id)', consumer: 'documentFromReading', correction: '-' },
  'DETAILS:elevations[].zones[].material': { field: 'finish family of a zone', document: 'geometry.zones[].material', consumer: 'houseProgram: createSurfaceRegion with the style profile material', correction: 'SET_ZONE' },
  'DETAILS:elevations[].zones[].tone': { field: 'its tone', document: 'geometry.zones[].tone', consumer: 'houseProgram style profile', correction: 'SET_ZONE' },
  'DETAILS:elevations[].zones[].box': { field: 'its extent on the elevation', document: 'geometry.zones[] host wall rect', consumer: 'resolveHouse zones → createSurfaceRegion', correction: 'SET_ZONE' },
  'DETAILS:elevations[].zones[].bodyId': { field: 'the body it is on', document: 'geometry.zones[] host', consumer: 'resolveHouse zones', correction: 'SET_ZONE' },
  'DETAILS:elevations[].zones[].certainty': { field: 'how sure', document: 'observations', consumer: 'resolveHouse: UNSURE zones are not built', correction: 'SET_ZONE' },
  'DETAILS:elevations[].zones[].note': { field: 'NOTE_ONLY', document: 'observations', consumer: 'none (explains uncertainty)', correction: '-' },
  'DETAILS:elevations[].chimneys[].leftX': { field: 'a chimney seen on this picture: its left column', document: 'observations.elevations[].features[] CHIMNEY', consumer: 'resolveHouse chimneys (fused across a gable and a side view)', correction: 'NONE (SET_FEATURE has no CHIMNEY kind)' },
  'DETAILS:elevations[].chimneys[].rightX': { field: 'its right column', document: 'same', consumer: 'same', correction: 'NONE (SET_FEATURE has no CHIMNEY kind)' },
  'DETAILS:elevations[].chimneys[].topY': { field: 'its top row', document: 'same', consumer: 'same', correction: 'NONE (SET_FEATURE has no CHIMNEY kind)' },
  'DETAILS:unknowns': { field: 'NOTE_ONLY', document: 'observations.unknowns', consumer: 'none', correction: '-' },
  'STOREY:storey': { field: 'which storey this plan is', document: 'observations.storeys[].level', consumer: 'interiorFromStoreys', correction: '-' },
  'STOREY:frontEdge': { field: 'the plan edge the front lies along', document: 'orientation of the storey reading', consumer: 'interiorFromStoreys', correction: '-' },
  'STOREY:outline': { field: 'outer wall faces of this storey', document: 'interior source footprint (registration)', consumer: 'resolveInterior (register on this level)', correction: '-' },
  'STOREY:partitions[].a': { field: 'partition end', document: 'interior partitions', consumer: 'resolveInterior → createWall INTERIOR', correction: 'NONE (a plan reading is corrected by reading the plan again)' },
  'STOREY:partitions[].b': { field: 'partition end', document: 'interior partitions', consumer: 'same', correction: 'NONE (a plan reading is corrected by reading the plan again)' },
  'STOREY:partitions[].thicknessPx': { field: 'partition thickness', document: 'interior partitions', consumer: 'same (DEFAULT 0.12 m when null)', correction: 'NONE (a plan reading is corrected by reading the plan again)' },
  'STOREY:doors[].at': { field: 'door centre', document: 'interior doors', consumer: 'resolveInterior → cutOpening + placeDoor', correction: 'NONE (a plan reading is corrected by reading the plan again)' },
  'STOREY:doors[].widthPx': { field: 'door width', document: 'interior doors', consumer: 'same (DEFAULT 0.9 m when null)', correction: 'NONE (a plan reading is corrected by reading the plan again)' },
  'STOREY:rooms[].polygon': { field: 'room or zone polygon', document: 'interior rooms', consumer: 'resolveInterior → createRoom', correction: 'NONE (a plan reading is corrected by reading the plan again)' },
  'STOREY:rooms[].name': { field: 'room name (separate observation)', document: 'interior rooms usage', consumer: 'createRoom usage', correction: 'NONE (a plan reading is corrected by reading the plan again)' },
  'STOREY:rooms[].number': { field: 'printed room number', document: 'interior rooms (trace)', consumer: 'trace', correction: '-' },
  'STOREY:rooms[].areaLiteral': { field: 'printed area (a check, never a fit)', document: 'interior rooms (check)', consumer: 'recorded only: no area check consumes it yet', correction: '-' },
  'STOREY:rooms[].open': { field: 'an open zone of a larger space (no wall around it)', document: 'interior rooms', consumer: 'merge: an open zone never adds a partition', correction: 'NONE (a plan reading is corrected by reading the plan again)' },
  'STOREY:stairs[]': { field: 'stair run outline', document: 'interior stairs (outline only)', consumer: 'recorded only: the stair is built from LOCAL where placed, never from the plan reading', correction: '-' },
  'STOREY:voids[]': { field: 'floor openings', document: 'interior voids', consumer: 'createSlab holes', correction: '-' },
  'STOREY:labels[].literal': { field: 'printed opening callout (e.g. width/height)', document: 'observations.labels[]', consumer: 'resolveHouse binds it to an elevation opening: rough width/height PRINTED', correction: 'NONE (an unbound callout is said; it is not forced)' },
  'STOREY:labels[].at': { field: 'where it is printed', document: 'observations.labels[]', consumer: 'binding by position on the wall', correction: 'NONE (an unbound callout is said; it is not forced)' },
  'STOREY:labels[].wall': { field: 'which wall it sits on', document: 'observations.labels[]', consumer: 'binding', correction: 'NONE (an unbound callout is said; it is not forced)' },
  'STOREY:labels[].kind': { field: 'window or door', document: 'observations.labels[]', consumer: 'binding (kind must agree)', correction: 'NONE (an unbound callout is said; it is not forced)' },
  'STOREY:unknowns': { field: 'NOTE_ONLY', document: 'observations.unknowns', consumer: 'none', correction: '-' },
}

/**
 * The order the program gives an elevation's openings (and so their ids o1, o2, …): by storey, then left edge, then
 * top edge, then kind — never by the order of the answer, so a permuted list gives the same ids. Two identical boxes of
 * one kind are interchangeable; their answer order then decides, and nothing downstream can tell them apart.
 */
export function stableOpeningOrder(openings: ReadonlyArray<{ kind: string; level?: number; box: { x0: number; y0: number; x1: number; y1: number } }>): number[] {
  const key = (o: (typeof openings)[number]) => [o.level ?? -1, Math.round(Math.min(o.box.x0, o.box.x1) * 10), Math.round(Math.min(o.box.y0, o.box.y1) * 10), Math.round(Math.max(o.box.x0, o.box.x1) * 10), o.kind] as const
  return openings.map((o, i) => ({ k: key(o), i })).sort((p, q) => {
    for (let n = 0; n < 4; n += 1) if (p.k[n] !== q.k[n]) return (p.k[n] as number) - (q.k[n] as number)
    return p.k[4] < q.k[4] ? -1 : p.k[4] > q.k[4] ? 1 : p.i - q.i
  }).map((x) => x.i)
}
