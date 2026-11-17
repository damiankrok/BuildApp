/**
 * v3.54.6 (D39) — an accepted revision of a described house, reused by the next analysis of the same source.
 *
 * Three readings of one page by the provider give three houses (Marcówki GE: three model hashes, the first difference at
 * the first answer); one reading replayed gives one house, bit for bit. So the reading is the thing that is kept: an
 * accepted revision is the recorded answers of the reading whose house was accepted, under a BINDING of everything
 * that changes the house built from them —
 *   - the source variant (publisher adapter, project id; the pipeline reads a plan as published, never mirrored),
 *   - the pictures (each one's bytes and the roles the package gives it) and the page's published facts,
 *   - the reading contract and version, the resolver and builder versions,
 *   - the settings that change the geometry (the reader model, the review on or off).
 * A later analysis under the same binding replays those answers: the same geometry, no request. Anything else — no
 * accepted revision, another source, variant or version, or a re-analysis asked for — reads afresh: a SEPARATE
 * candidate, with what of the binding differs named, and the earlier revision kept untouched.
 *
 * The store is the host's, in its private data directory; it is written and read only on a submission allowed the
 * house reader (the same permission as the paid reading). Files are named by hashes: no address, path or key in them.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { ReadingRecord } from './read.js'
import type { HousePicture } from './pictures.js'

export const ACCEPTED_REVISION_SCHEMA = 'buildapp.accepted-house-revision' as const
export const ACCEPTED_REVISION_VERSION = '1.0.0' as const

export type AcceptedBinding = { variant: string; pictures: string; reader: string; resolver: string; builder: string; settings: string }
export type AcceptedRevision = { schema: typeof ACCEPTED_REVISION_SCHEMA; version: typeof ACCEPTED_REVISION_VERSION; key: string; binding: AcceptedBinding; acceptedAt: string; modelHash: string; /** v3.54.7: the quality status the delivered model had when it was accepted (D40/D41). */ quality?: string; records: ReadingRecord[] }
export type AcceptedRevisionStore = {
  get(key: string): AcceptedRevision | undefined
  /** The revisions accepted for one source variant, newest last. */
  forVariant(variant: string): AcceptedRevision[]
  /** Keeps a revision; an accepted revision is never replaced — a second one under the same key is refused. */
  put(revision: AcceptedRevision): boolean
}
/** What became of the accepted-revision rule on one analysis. */
export type AcceptedReuse =
  | { state: 'REUSED'; key: string; acceptedAt: string; sameGeometry: boolean; /** v3.54.7: whether the replay reaches the same quality status as when it was accepted. */ sameQuality?: boolean }
  | { state: 'NEW_CANDIDATE'; key: string; why: 'NO_ACCEPTED_REVISION' | 'BINDING_DIFFERS' | 'REANALYSIS_ASKED'; differs: Array<keyof AcceptedBinding>; previous?: string }
  | { state: 'ACCEPTED_NOW'; key: string; /** set when another revision of this variant was accepted under another binding: it is kept */ differs?: Array<keyof AcceptedBinding>; previous?: string }

const sha = (s: string): string => createHash('sha256').update(s).digest('hex')
const stable = (x: unknown): string => JSON.stringify(x, (_k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => (a < b ? -1 : 1))) : v))

export function acceptedBinding(input: { adapterId: string; externalId: string; pictures: ReadonlyArray<HousePicture>; published: unknown; reader: string; resolver: string; builder: string; model: string; review: boolean }): { key: string; binding: AcceptedBinding } {
  const pics = input.pictures.map((p) => `${p.byteHash}:${p.pageRole.document}:${p.pageRole.view}:${p.pageRole.storey}`).sort()
  const binding: AcceptedBinding = {
    variant: `${input.adapterId}:${input.externalId}:AS_PUBLISHED`,
    pictures: sha(stable({ pics, published: input.published })).slice(0, 32),
    reader: input.reader,
    resolver: input.resolver,
    builder: input.builder,
    settings: `model=${input.model};review=${input.review ? 'on' : 'off'}`,
  }
  return { key: sha(stable(binding)).slice(0, 32), binding }
}

export function bindingDiffers(a: AcceptedBinding, b: AcceptedBinding): Array<keyof AcceptedBinding> {
  return (Object.keys(a) as Array<keyof AcceptedBinding>).filter((k) => a[k] !== b[k])
}

/** The host's store: `<dir>/<key>.json`, `<dir>/variant-<hash>.json` (the keys of one variant). */
export function fileAcceptedStore(dir: string): AcceptedRevisionStore {
  const read = <T>(p: string): T | undefined => (existsSync(p) ? (JSON.parse(readFileSync(p, 'utf8')) as T) : undefined)
  const atomic = (p: string, text: string): void => {
    mkdirSync(dir, { recursive: true })
    const tmp = `${p}.tmp-${process.pid}`
    writeFileSync(tmp, text)
    renameSync(tmp, p)
  }
  const indexOf = (variant: string): string => join(dir, `variant-${sha(variant).slice(0, 32)}.json`)
  return {
    get: (key) => (/^[0-9a-f]{32}$/.test(key) ? read<AcceptedRevision>(join(dir, `${key}.json`)) : undefined),
    forVariant: (variant) => (read<string[]>(indexOf(variant)) ?? []).map((k) => read<AcceptedRevision>(join(dir, `${k}.json`))).filter((r): r is AcceptedRevision => !!r),
    put: (revision) => {
      const p = join(dir, `${revision.key}.json`)
      if (existsSync(p)) return false
      atomic(p, `${JSON.stringify(revision)}\n`)
      const keys = read<string[]>(indexOf(revision.binding.variant)) ?? []
      atomic(indexOf(revision.binding.variant), `${JSON.stringify([...keys, revision.key])}\n`)
      return true
    },
  }
}
