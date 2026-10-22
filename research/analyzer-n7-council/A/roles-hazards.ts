/**
 * Council A (research only): the ARCHON role rules on invented-but-plausible addresses (no real project). Each case
 * prints the roles the pipeline would seal (adapter claims -> mergeRoleClaims -> normalizeRoles), and whether that is
 * what the drawing is. Then the storey the reconstruction would read each plan as (planStoreyOf/readPlans grouping).
 */
import { archonRoleClaims, mergeRoleClaims, normalizeRoles, type DiscoveredCandidate } from '@buildapp/source-package'
import { STOREY_RANK, planStoreyOf, groundLabelledAmong } from '../../../packages/reconstruction/src/layout.js'
const A = 'https://assets.archon.pl/images/products/m0123456789ab/'
const PAGE = 'https://www.archon.pl/projekty-domow/projekt-dom-w-testach-m0123456789ab'
const FRAG = (i: number) => `https://www.archon.pl/product_fancybox_floor/m0123456789ab/${i}`
const H = '0123456789abcdef0123456789abcdef'
const roles = (url: string, extra: Partial<DiscoveredCandidate> = {}) => normalizeRoles(mergeRoleClaims(archonRoleClaims({ url, channel: 'IMG_SRC', exposedBy: PAGE, locator: 'img[src]', ...extra })).roles)
const merged = (...cs: Array<[string, Partial<DiscoveredCandidate>]>) => normalizeRoles(mergeRoleClaims(cs.flatMap(([u, e]) => archonRoleClaims({ url: u, channel: 'IMG_SRC', exposedBy: PAGE, locator: 'img[src]', ...e }))).roles)
let bad = 0
const check = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want)
  if (!ok) bad++
  console.log(`${ok ? 'OK  ' : 'BAD '} ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`)
}
// 1. a two-storey house with a "piętro" (UPPER): page copies say UPPER by slug, the fragment originals (/3) say ATTIC
const pageUpper = roles(`${A}rzut-pietra-projekt-dom-w-testach-${H}__707.gif`)
const fragUpper = roles(`${A}projekt-dom-w-testach-${H}__11817.gif`, { exposedBy: FRAG(3) })
const areaUpper = roles(`${A}rzut-pietra-z-powierzchniami-projekt-dom-w-testach-${H}__11917.gif`, { channel: 'FLOOR_PLAN_ATTR', locator: 'img[data-floor-pom-img]', exposedBy: FRAG(3) })
check('piętro page copy storey', pageUpper.storey, 'UPPER')
check('piętro fragment original storey (same drawing)', fragUpper.storey, 'UPPER')
check('piętro area copy storey (same drawing)', areaUpper.storey, 'UPPER')
const frames = [pageUpper, fragUpper, areaUpper, roles(`${A}rzut-parteru-projekt-dom-w-testach-${H}__706.gif`)].map((r, i) => ({ id: `f${i}`, roles: r }))
const g = groundLabelledAmong(frames as never)
const storeysRead = [...new Set(frames.map((f) => planStoreyOf(f as never, g)).filter((s) => s in STOREY_RANK))]
check('storeys the reconstruction would read for a 2-storey piętro house', storeysRead.sort(), ['GROUND', 'UPPER'])
// 2. "plan sytuacyjny" is a site plan, not a floor plan (document rules: first match wins and "plan" comes first)
check('plan-sytuacyjny document', roles(`${A}plan-sytuacyjny-projekt-dom-w-testach-${H}__255.jpg`).document, 'SITE_PLAN')
// 3. a project NAME carrying a storey word: an attic plan of "Dom parterowy z poddaszem" style names
check('rzut-poddasza of a project named "...parterowy..." storey', roles(`${A}rzut-poddasza-projekt-dom-parterowy-${H}__707.gif`).storey, 'ATTIC')
// the anonymous original of the ground floor of a project whose name says "poddasze"
check('fragment/1 original of project "dom-z-poddaszem" storey', roles(`${A}projekt-dom-z-poddaszem-${H}__11815.gif`, { exposedBy: FRAG(1) }).storey, 'GROUND')
// 4. a basement plan exposed by the fragment index 1 (index->storey map is a two-storey assumption)
check('rzut-piwnicy page copy', roles(`${A}rzut-piwnicy-projekt-dom-w-testach-${H}__705.gif`).storey, 'BASEMENT')
check('rzut-piwnicy area copy through fragment /1', roles(`${A}rzut-piwnicy-z-powierzchniami-projekt-dom-w-testach-${H}__11915.gif`, { channel: 'FLOOR_PLAN_ATTR', exposedBy: FRAG(1) }).storey, 'BASEMENT')
// 5. caption-only document words on the anonymous original: an elevation original inherits its parent's caption
check('elevation original with caption only', roles(`${A}projekt-dom-w-testach-${H}__11264.jpg`, { channel: 'VARIANT_CONVENTION', caption: 'gotowy projekt Dom w testach elewacja frontowa' }).view, 'FRONT')
// 6. the same URL exposed both as IMG_SRC on the page and through FLOOR_PLAN_ATTR: annotation claims merged across channels
check('one URL seen via IMG_SRC and FLOOR_PLAN_ATTR', merged([`${A}projekt-dom-w-testach-${H}__11815.gif`, { exposedBy: FRAG(1) }], [`${A}projekt-dom-w-testach-${H}__11815.gif`, { channel: 'FLOOR_PLAN_ATTR', locator: 'img[data-floor-pom-img]' }]).annotation, 'UNKNOWN (two channels disagree)')
console.log(`${bad} BAD`)
