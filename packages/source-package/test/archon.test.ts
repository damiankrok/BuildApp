import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  ARCHON_ADAPTER_ID,
  VARIANT_BLOCK,
  archonAdapter,
  archonPublished,
  archonResolutionCandidates,
  archonSpecifications,
  archonRoleClaims,
  assetSlug,
  captionFromSlug,
  mergeRoleClaims,
  normalizeRoles,
  parsePlNumber,
  variantId,
  variantStem,
  type DiscoveredCandidate,
  type SourceRoles,
} from '../src/index.js'

/**
 * The adapter is the only file that knows one publisher's vocabulary, so it is
 * the only place a wrong label can be born. Every address below is a REAL one
 * from the live benchmark project, and the published figures come from a
 * trimmed copy of that page's own markup — because the failure mode being
 * guarded against (a side elevation labelled LEFT when the publisher never
 * said which side it is) only shows up against the publisher's real naming.
 */
const ASSETS = 'https://assets.archon.pl/images/products/m2fa281446a8ca/'
const PROJECT_PAGE = 'https://www.archon.pl/projekty-domow/projekt-dom-w-marcowkach-ge-m2fa281446a8ca'

const GROUND_AREA_PLAN = `${ASSETS}rzut-parteru-z-powierzchniami-projekt-dom-w-marcowkach-ge-7056fa04af38f4015f8f19d40910c89c__11915.gif`
const ATTIC_AREA_PLAN = `${ASSETS}rzut-poddasza-z-powierzchniami-projekt-dom-w-marcowkach-ge-117abb705763e8815846decc6fef54fd__11917.gif`
const SECTION = `${ASSETS}przekroj-budynku-projekt-dom-w-marcowkach-ge-2bdfa17711fbe9d7bc173014765d5d51__256.jpg`
const FRONT = `${ASSETS}elewacja-frontowa-projekt-dom-w-marcowkach-ge-b165fc1dadc0b7ef46c3d1d74725aea3__264.jpg`
const REAR = `${ASSETS}elewacja-ogrodowa-projekt-dom-w-marcowkach-ge-9b95a143134b5e1afdf79034a2391bd8__267.jpg`
const SIDE_A = `${ASSETS}elewacja-boczna-projekt-dom-w-marcowkach-ge-b72318402d5f7c263303f0bf13597c8b__265.jpg`
const SIDE_B = `${ASSETS}elewacja-boczna-projekt-dom-w-marcowkach-ge-24130d2bfa16ddf40cd1a16f8e154ce2__266.jpg`
const SITE = `${ASSETS}sytuacja-projekt-dom-w-marcowkach-ge-88bea7ab3c6f0e8c5710051590dc2f56__255.jpg`
const RENDER = `${ASSETS}widok-1-projekt-dom-w-marcowkach-ge-6965a4a29ffff6828c320d5f7b3bb7c6__289.jpg`
/** The publisher's own high-resolution plan: its filename carries no description at all. */
const ANONYMOUS_PLAN = `${ASSETS}projekt-dom-w-marcowkach-ge-9d1547b712997f93462fc19e9eefb963__11817.gif`

const candidate = (url: string, extra: Partial<DiscoveredCandidate> = {}): DiscoveredCandidate => ({
  url,
  channel: 'IMG_SRC',
  exposedBy: PROJECT_PAGE,
  locator: 'img[src]',
  ...extra,
})

/** The roles the pipeline would seal for this candidate: the adapter's claims, merged and normalised. */
const rolesFor = (url: string, extra: Partial<DiscoveredCandidate> = {}): SourceRoles => normalizeRoles(mergeRoleClaims(archonRoleClaims(candidate(url, extra))).roles)

describe('ARCHON role classification, from the publisher’s real filenames', () => {
  it('reads the document and the storey out of a plan’s slug: "rzut parteru" is the ground floor plan, "rzut poddasza" the attic', () => {
    const ground = rolesFor(GROUND_AREA_PLAN)
    expect(ground.document).toBe('FLOOR_PLAN')
    expect(ground.storey).toBe('GROUND')
    expect(ground.projection).toBe('ORTHOGRAPHIC_PLAN')
    // a plan has no viewing direction: that is a fact about plans, not a gap
    expect(ground.view).toBe('NOT_APPLICABLE')

    const attic = rolesFor(ATTIC_AREA_PLAN)
    expect(attic.document).toBe('FLOOR_PLAN')
    expect(attic.storey).toBe('ATTIC')
  })

  it('reads "z powierzchniami" as the AREA_TABLE annotation, because that copy carries the room table and not the dimension chains', () => {
    expect(rolesFor(GROUND_AREA_PLAN).annotation).toBe('AREA_TABLE')
    expect(rolesFor(ATTIC_AREA_PLAN).annotation).toBe('AREA_TABLE')
    // and the plain plan in the page body is the OTHER copy — the one with the chains
    const plain = rolesFor(`${ASSETS}rzut-parteru-projekt-dom-w-marcowkach-ge-7056fa04af38f4015f8f19d40910c89c__915.gif`)
    expect(plain.annotation).toBe('DIMENSIONED')
  })

  it('reads "przekrój" as a section and "sytuacja" as a site plan, with the projection each implies', () => {
    expect(rolesFor(SECTION).document).toBe('SECTION')
    expect(rolesFor(SECTION).projection).toBe('ORTHOGRAPHIC_SECTION')
    expect(rolesFor(SITE).document).toBe('SITE_PLAN')
    expect(rolesFor(RENDER).document).toBe('PERSPECTIVE_RENDER')
    expect(rolesFor(RENDER).projection).toBe('PERSPECTIVE')
  })

  it('reads "frontowa" as FRONT and "ogrodowa" (the garden side) as REAR', () => {
    expect(rolesFor(FRONT).document).toBe('ELEVATION')
    expect(rolesFor(FRONT).view).toBe('FRONT')
    expect(rolesFor(REAR).view).toBe('REAR')
    // an elevation has no storey
    expect(rolesFor(FRONT).storey).toBe('NOT_APPLICABLE')
  })

  it('labels BOTH "elewacja boczna" assets SIDE_UNSPECIFIED and never guesses a left or a right', () => {
    // This publisher names both side elevations "boczna" and never says which is which.
    // Guessing would mirror a facade: every window, every opening and every roof edge
    // would land on the wrong wall, and nothing downstream could tell that had happened.
    // The honest answer is that the side is unstated.
    for (const url of [SIDE_A, SIDE_B]) {
      const roles = rolesFor(url)
      expect([url, roles.document, roles.view]).toEqual([url, 'ELEVATION', 'SIDE_UNSPECIFIED'])
    }
    // not merely "the merge produced SIDE_UNSPECIFIED": no claim anywhere proposes a side
    const claimed = [...archonRoleClaims(candidate(SIDE_A)), ...archonRoleClaims(candidate(SIDE_B))].map((c) => c.view)
    expect(claimed).not.toContain('SIDE_LEFT')
    expect(claimed).not.toContain('SIDE_RIGHT')
    // and the two of them are still distinguishable as assets, because their bytes differ
    expect(SIDE_A).not.toBe(SIDE_B)
  })

  it('takes the storey from the floor fragment that exposed a plan, because the publisher’s originals have no descriptive slug', () => {
    // `…__11817.gif` says nothing about which storey it is; only the endpoint it came
    // through does. A filename-only classifier would file this 1138 px plan as unknown.
    expect(assetSlug(ANONYMOUS_PLAN)).toBe('projekt-dom-w-marcowkach-ge')
    const ground = rolesFor(ANONYMOUS_PLAN, { exposedBy: 'https://www.archon.pl/product_fancybox_floor/m2fa281446a8ca/1' })
    expect(ground.document).toBe('FLOOR_PLAN')
    expect(ground.storey).toBe('GROUND')
    expect(ground.annotation).toBe('DIMENSIONED')
    const attic = rolesFor(ANONYMOUS_PLAN, { exposedBy: 'https://www.archon.pl/product_fancybox_floor/m2fa281446a8ca/3' })
    expect(attic.storey).toBe('ATTIC')
    // an index this adapter has not seen produces no claim at all rather than a guess
    const unseen = rolesFor(ANONYMOUS_PLAN, { exposedBy: 'https://www.archon.pl/product_fancybox_floor/m2fa281446a8ca/2' })
    expect(unseen.storey).toBe('UNKNOWN')
  })

  it('treats the bespoke floor attribute as the area-labelled copy, whatever the filename says', () => {
    const roles = rolesFor(ANONYMOUS_PLAN, { channel: 'FLOOR_PLAN_ATTR', locator: 'img[data-floor-pom-img]' })
    expect(roles.document).toBe('FLOOR_PLAN')
    expect(roles.annotation).toBe('AREA_TABLE')
  })

  it('strips diacritics and the content hash before matching, so "przekrój" and "przekroj" are one word', () => {
    expect(assetSlug(SECTION)).toBe('przekroj-budynku-projekt-dom-w-marcowkach-ge')
    expect(rolesFor(`${ASSETS}przekrój-budynku-x-2bdfa17711fbe9d7bc173014765d5d51__256.jpg`).document).toBe('SECTION')
    expect(captionFromSlug(FRONT)).toBe('elewacja frontowa projekt dom w marcowkach ge')
  })
})

describe('the publisher’s resolution convention', () => {
  it('proposes the `__<n+11000>` original exactly once for a page copy', () => {
    // one hypothesis, one request. The section is embedded at 400x300 through a script
    // handler with no anchor to follow, and its 1138x854 original is reachable only here.
    expect(archonResolutionCandidates(SECTION)).toEqual([`${ASSETS}przekroj-budynku-projekt-dom-w-marcowkach-ge-2bdfa17711fbe9d7bc173014765d5d51__11256.jpg`])
    expect(archonResolutionCandidates(FRONT)).toHaveLength(1)
    expect(variantId(archonResolutionCandidates(FRONT)[0])).toBe(264 + VARIANT_BLOCK)
  })

  it('proposes NOTHING for an address that is already an original, so a guess is never chased in a circle', () => {
    expect(variantId(GROUND_AREA_PLAN)).toBeGreaterThanOrEqual(VARIANT_BLOCK)
    expect(archonResolutionCandidates(GROUND_AREA_PLAN)).toEqual([])
    expect(archonResolutionCandidates(ANONYMOUS_PLAN)).toEqual([])
    // the hero render's `__11289` reports that no larger copy is published
    expect(archonResolutionCandidates(`${ASSETS}widok-1-projekt-dom-w-marcowkach-ge-6965a4a29ffff6828c320d5f7b3bb7c6__11289.jpg`)).toEqual([])
    // and an address with no resolution block at all is not guessable
    expect(archonResolutionCandidates(`${ASSETS}logo.png`)).toEqual([])
  })

  it('gives a page copy and its original ONE identity, so the original is not filed as an unrelated picture', () => {
    // `…__264.jpg` is "elewacja frontowa"; `…__11264.jpg` is the same drawing at 1280 px.
    // Pairing by filename would fail here, and pairing by stem is what makes it work.
    const original = archonResolutionCandidates(FRONT)[0]
    expect(variantStem(original)).toBe(variantStem(FRONT))
    expect(archonAdapter.groupKey?.(candidate(original))).toBe(archonAdapter.groupKey?.(candidate(FRONT)))
    // two different drawings must NOT collapse onto one stem
    expect(variantStem(FRONT)).not.toBe(variantStem(REAR))
  })

  it('keeps a query string on the guessed address, because the publisher’s CDN may need it', () => {
    expect(archonResolutionCandidates(`${ASSETS}x-2bdfa17711fbe9d7bc173014765d5d51__256.jpg?v=3`)).toEqual([`${ASSETS}x-2bdfa17711fbe9d7bc173014765d5d51__11256.jpg?v=3`])
  })

  it('claims only archon.pl pages', () => {
    expect(archonAdapter.matches(new URL(PROJECT_PAGE))).toBe(true)
    expect(archonAdapter.matches(new URL('https://assets.archon.pl/x'))).toBe(true)
    expect(archonAdapter.matches(new URL('https://archon.pl.evil.example/x'))).toBe(false)
    expect(archonAdapter.id).toBe(ARCHON_ADAPTER_ID)
  })
})

describe('published figures, from the publisher’s own markup', () => {
  /** A trimmed copy of the live project page: the "Powierzchnie i wymiary" block and both room tables. */
  const html = readFileSync(resolve(import.meta.dirname, 'fixtures/archon-published.html'), 'utf8')
  const { facts, rooms } = archonPublished(html)
  const factValue = (key: string): number | undefined => facts.find((f) => f.key === key)?.value

  it('parses the Polish decimal comma as a decimal point, not as a thousands separator', () => {
    // "129,04" is one hundred and twenty-nine, not twelve thousand: a locale-blind parse
    // would be off by a factor of ten thousand and would still look like a number
    expect(parsePlNumber('129,04')).toBe(129.04)
    expect(parsePlNumber('1 205,5')).toBe(1205.5) // thin space as the thousands group
    expect(parsePlNumber('8,27 m')).toBe(8.27)
    expect(parsePlNumber('brak danych')).toBeNull()
  })

  it('maps the publisher’s figures onto stable keys by its slug rather than by its visible label', () => {
    expect(factValue('house_net_area')).toBe(129.04)
    expect(factValue('footprint_area')).toBe(131.16)
    expect(factValue('roof_area')).toBe(150.57)
    expect(factValue('building_height')).toBe(8.27)
    // the more specific key must win over the prefix it shares with a broader one
    expect(factValue('usable_area_without_stairs')).toBe(153.31)
    expect(factValue('usable_area')).toBeUndefined()
    // a length is metres and an area is square metres; a consumer may not have to guess
    expect(facts.find((f) => f.key === 'building_height')?.unit).toBe('m')
    expect(facts.find((f) => f.key === 'footprint_area')?.unit).toBe('m2')
    // the raw string is kept so a mis-parse can be seen rather than merely suspected
    expect(facts.find((f) => f.key === 'house_net_area')?.raw).toContain('129,04')
  })

  it('records nothing for a figure it has no canonical key for, rather than inventing one', () => {
    // "Minimalne wymiary działki" is "19,05 x 20,6" — two numbers, not one quantity
    expect(facts.map((f) => f.key)).not.toContain('minimalne_wymiary_dzialki')
    expect(facts.every((f) => Number.isFinite(f.value))).toBe(true)
  })

  it('reads the room table of BOTH storeys, keeping the publisher’s numbering', () => {
    expect(rooms).toHaveLength(18)
    expect(rooms.filter((r) => r.storey === 'GROUND')).toHaveLength(9)
    expect(rooms.filter((r) => r.storey === 'ATTIC')).toHaveLength(9)
    // the storey comes from the table's own heading ("PARTER" / "PODDASZE"), which is the
    // only thing tying a row to a floor
    const pantry = rooms.find((r) => r.storey === 'GROUND' && r.index === 5)
    expect(pantry?.label).toBe('Spiżarnia')
    expect(pantry?.area).toBe(1.44)
    expect(rooms.find((r) => r.storey === 'GROUND' && r.index === 9)?.label).toBe('Garaż')
    expect(rooms.find((r) => r.storey === 'ATTIC' && r.index === 1)?.label).toBe('Korytarz')
  })

  it('does not mistake the table’s heading row for a room', () => {
    // the header carries the storey totals (96,50 and 62,44); counting them as rooms would
    // double the ground floor's area
    expect(rooms.map((r) => r.area)).not.toContain(96.5)
    expect(rooms.map((r) => r.area)).not.toContain(62.44)
    expect(rooms.every((r) => r.index >= 1 && r.index <= 9)).toBe(true)
  })

  it('finds nothing in markup that has none, instead of throwing', () => {
    const empty = archonPublished('<html><body><p>Nothing to see</p></body></html>')
    expect(empty.facts).toEqual([])
    expect(empty.rooms).toEqual([])
  })
})

/**
 * §8 of the stage brief needs a source-supported roof pitch, and the plainest
 * statement of one a catalogue page carries is the sentence the publisher
 * wrote about the roof. It is scraped as TEXT: what it means is the reading
 * layer's business, not the adapter's.
 */
describe('archonSpecifications', () => {
  const page = `
    <div class="product-data technical-data-item">
      <div class="product-data__item"><div class="product-data__header"><div class="product-data__title">
        <strong>ściany:</strong> pustak ceramiczny 25 cm, styropian 20 cm, tynk
      </div></div></div>
      <div class="product-data__item"><div class="product-data__header"><div class="product-data__title">
        <strong>ścianka kolankowa:</strong> 130 cm
      </div></div></div>
      <div class="product-data__item"><div class="product-data__header"><div class="product-data__title">
        <strong>dach:</strong> dwuspadowy, nachylenie 40 st. , dachówka ceramiczna
      </div></div></div>
      <div class="product-data__item"><div class="product-data__header"><div class="product-data__title">
        <strong>kocioł:</strong> gazowy
      </div></div></div>
    </div>
    <div class="row"><div class="col-md-12 big" id="bottom-description"><p>Dach bez okapów.</p></div></div>`

  it('keeps each line under a key, with the label and text as printed', () => {
    const specs = archonSpecifications(page)
    const roof = specs.find((s) => s.key === 'roof')
    expect(roof?.label).toBe('dach')
    expect(roof?.text).toBe('dwuspadowy, nachylenie 40 st. , dachówka ceramiczna')
  })

  it('separates a knee wall from the walls it is not', () => {
    const specs = archonSpecifications(page)
    expect(specs.find((s) => s.key === 'knee_wall')?.text).toBe('130 cm')
    expect(specs.find((s) => s.key === 'walls')?.text).toBe('pustak ceramiczny 25 cm, styropian 20 cm, tynk')
  })

  it('keeps a line it has no key for rather than dropping it', () => {
    expect(archonSpecifications(page).some((s) => s.key === 'other' && s.label === 'kocioł')).toBe(true)
  })

  it('takes the prose below the drawings too, because that is where a publisher says "no eaves"', () => {
    expect(archonSpecifications(page).find((s) => s.key === 'description')?.text).toBe('Dach bez okapów.')
  })

  it('is deterministic and finds nothing in a page that has none', () => {
    expect(archonSpecifications('<html><body><p>nothing here</p></body></html>')).toEqual([])
    expect(JSON.stringify(archonSpecifications(page))).toBe(JSON.stringify(archonSpecifications(page)))
  })
})
