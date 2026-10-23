/**
 * IU-01 (research only): what the PRODUCTION role path does with the brief's negative cases when the only signal is
 * the publisher's text. Invented-but-plausible ARCHON-shaped addresses (no real project), run through the real
 * archonRoleClaims -> mergeRoleClaims -> normalizeRoles, then through the real readsAsFacade router and the
 * PERSPECTIVE camera filter. Nothing here reads a pixel — that is the point: the production path cannot either.
 *
 *   npx vite-node research/image-understanding/audit/metadata-hazards.ts
 */
import { archonRoleClaims, mergeRoleClaims, normalizeRoles, type DiscoveredCandidate } from '@buildapp/source-package'
import { readsAsFacade } from '@buildapp/source-vision'

const A = 'https://assets.archon.pl/images/products/m0123456789ab/'
const PAGE = 'https://www.archon.pl/projekty-domow/projekt-dom-w-testach-m0123456789ab'
const H = '0123456789abcdef0123456789abcdef'
const roles = (url: string, extra: Partial<DiscoveredCandidate> = {}) =>
  normalizeRoles(mergeRoleClaims(archonRoleClaims({ url, channel: 'IMG_SRC', exposedBy: PAGE, locator: 'img[src]', ...extra })).roles)

type Case = { id: string; brief: string; truth: string; url: string; extra?: Partial<DiscoveredCandidate>; safe: (r: ReturnType<typeof roles>) => boolean }
const cases: Case[] = [
  { id: 'N1', brief: 'zdjęcie wnętrza podpisane na stronie jako elewacja', truth: 'INTERIOR_PERSPECTIVE', url: `${A}projekt-dom-w-testach-${H}__271.jpg`, extra: { caption: 'Dom w testach elewacja frontowa' }, safe: (r) => !readsAsFacade(r) },
  { id: 'N1b', brief: 'wnętrze z błędnym slugiem „elewacja”', truth: 'INTERIOR_PERSPECTIVE', url: `${A}elewacja-ogrodowa-projekt-dom-w-testach-${H}__272.jpg`, safe: (r) => !readsAsFacade(r) },
  { id: 'N2', brief: 'perspektywa domu prawie od frontu, nazwana „wizualizacja elewacji frontowej”', truth: 'EXTERIOR_PERSPECTIVE', url: `${A}wizualizacja-elewacji-frontowej-projekt-dom-w-testach-${H}__260.jpg`, safe: (r) => !readsAsFacade(r) },
  { id: 'N3', brief: 'perspektywa „widok od frontu”', truth: 'EXTERIOR_PERSPECTIVE', url: `${A}widok-od-frontu-projekt-dom-w-testach-${H}__261.jpg`, safe: (r) => !readsAsFacade(r) && r.projection === 'PERSPECTIVE' },
  { id: 'N4', brief: 'wnętrze „wizualizacja salonu” — trafia do solvera kamery zewnętrznej', truth: 'INTERIOR_PERSPECTIVE', url: `${A}wizualizacja-salonu-projekt-dom-w-testach-${H}__280.jpg`, safe: (r) => r.projection !== 'PERSPECTIVE' },
  { id: 'N5', brief: 'rzut poddasza podpisany błędnie jako parter', truth: 'FLOOR_PLAN/ATTIC', url: `${A}rzut-parteru-projekt-dom-w-testach-${H}__707.gif`, safe: (r) => r.storey !== 'GROUND' },
  { id: 'N6', brief: 'przekrój podpisany jako elewacja (przypomina elewację)', truth: 'TECHNICAL_SECTION', url: `${A}elewacja-boczna-projekt-dom-w-testach-${H}__265.jpg`, safe: (r) => r.document !== 'ELEVATION' },
  { id: 'N7', brief: 'kolaż 2×2 elewacji „elewacje”', truth: 'OTHER (collage)', url: `${A}elewacje-projekt-dom-w-testach-${H}__262.jpg`, safe: (r) => !readsAsFacade(r) },
  { id: 'N8', brief: 'plan sytuacyjny', truth: 'SITE_PLAN', url: `${A}plan-sytuacyjny-projekt-dom-w-testach-${H}__255.jpg`, safe: (r) => r.document === 'SITE_PLAN' },
  { id: 'N9', brief: 'brak podpisu, nieznana strona', truth: '(any)', url: `${A}projekt-dom-w-testach-${H}__11299.jpg`, safe: (r) => r.document === 'UNKNOWN' && r.view !== 'FRONT' },
  { id: 'N10', brief: 'detal konstrukcyjny „detal-wiezby” (brak reguły)', truth: 'ARCHITECTURAL_DETAIL', url: `${A}detal-wiezby-projekt-dom-w-testach-${H}__290.jpg`, safe: (r) => r.document === 'UNKNOWN' || r.document === 'DETAIL' },
]
let unsafe = 0
const out: unknown[] = []
for (const c of cases) {
  const r = roles(c.url, c.extra)
  const ok = c.safe(r)
  if (!ok) unsafe++
  const route = readsAsFacade(r) ? 'FACADE_EXTRACTORS' : r.projection === 'PERSPECTIVE' ? 'PERSPECTIVE_CAMERA' : r.document === 'UNKNOWN' ? 'SKIPPED_UNKNOWN' : r.document
  out.push({ id: c.id, brief: c.brief, truth: c.truth, roles: r, route, verdict: ok ? 'SAFE' : 'UNSAFE' })
  console.log(`${ok ? 'SAFE  ' : 'UNSAFE'} ${c.id.padEnd(4)} ${c.brief}\n        truth=${c.truth} -> document=${r.document} view=${r.view} storey=${r.storey} projection=${r.projection} route=${route}`)
}
console.log(`\n${unsafe}/${cases.length} UNSAFE`)
if (process.argv.includes('--json')) console.log(JSON.stringify(out, null, 1))
