import { canonicalJson, round6, sha256Hex } from '@buildapp/source-common'
import { describe, expect, it } from 'vitest'
import {
  acquireSourcePackage,
  archonAdapter,
  allVariants,
  memoryByteCache,
  selectedVariant,
  sourcePackageContentHash,
  type AcquireOptions,
  type PublishedFact,
  type SourcePackage,
} from '../src/index.js'
import { PAGE_URL, assetUrl, forbiddenFetch, pngBytes, projectPage, publicResolver, stubFetch, utf8, type StubNet, type StubRoute } from './helpers.js'

/**
 * `acquireSourcePackage` is the ONE authoritative path from a URL to a sealed
 * package, and these tests exercise it end to end over a network that is not a
 * network: a stub `fetchImpl` serving bytes synthesised in this process, and a
 * stub resolver, so nothing here can reach anything.
 *
 * The properties under test are the ones a second consumer would otherwise get
 * wrong on its own: which copy of a drawing wins, what counts as the same
 * drawing, what the page's claims about size are worth, and whether two runs
 * over the same bytes agree.
 */

const HASH_PLAN = '7056fa04af38f4015f8f19d40910c89c'
const HASH_ELEVATION = 'b165fc1dadc0b7ef46c3d1d74725aea3'

/**
 * A project page in the publisher's shape: a ground-floor area plan embedded at
 * 320x240 with its 640x480 original reachable by the resolution convention, and
 * a front elevation embedded at 400x256 while the markup CLAIMS height="213" —
 * which is exactly what the live page does and exactly the mis-scaling this
 * layer exists to catch.
 */
const BENCHMARK = {
  planPage: assetUrl('rzut-parteru-z-powierzchniami-projekt-test', 915, HASH_PLAN),
  planOriginal: assetUrl('rzut-parteru-z-powierzchniami-projekt-test', 11915, HASH_PLAN),
  elevationPage: assetUrl('elewacja-frontowa-projekt-test', 264, HASH_ELEVATION),
  elevationOriginal: assetUrl('elewacja-frontowa-projekt-test', 11264, HASH_ELEVATION),
}

function benchmarkRoutes(): Record<string, StubRoute> {
  const html = projectPage(
    `<img src="${BENCHMARK.planPage}" width="320" height="240" alt="rzut parteru">` +
      `<img src="${BENCHMARK.elevationPage}" width="400" height="213" alt="elewacja frontowa">`,
  )
  return {
    [PAGE_URL]: { bytes: utf8(html), mediaType: 'text/html; charset=utf-8' },
    [BENCHMARK.planPage]: { bytes: pngBytes(320, 240, 1), mediaType: 'image/png' },
    [BENCHMARK.planOriginal]: { bytes: pngBytes(640, 480, 2), mediaType: 'image/png' },
    [BENCHMARK.elevationPage]: { bytes: pngBytes(400, 256, 3), mediaType: 'image/png' },
    [BENCHMARK.elevationOriginal]: { bytes: pngBytes(800, 512, 4), mediaType: 'image/png' },
  }
}

const acquire = (net: StubNet, options: AcquireOptions = {}): Promise<SourcePackage> =>
  acquireSourcePackage(PAGE_URL, [archonAdapter], { deps: { fetchImpl: net.fetchImpl, resolve: publicResolver }, ...options })

/** A single-asset page, for cases that need one drawing and no other traffic. */
async function acquireOne(slug: string, variant: number, imgAttrs: string, routes: Record<string, StubRoute>, options: AcquireOptions = {}, hash = HASH_PLAN): Promise<SourcePackage> {
  const url = assetUrl(slug, variant, hash)
  const html = projectPage(`<img src="${url}" ${imgAttrs}>`)
  const net = stubFetch({ [PAGE_URL]: { bytes: utf8(html), mediaType: 'text/html' }, ...routes })
  return acquire(net, options)
}

// ---------------------------------------------------------------------------

describe('decoded dimensions are used; the page’s claims are recorded and set aside', () => {
  it('records the HTML-declared size, uses the DECODED one, and flags that they disagreed', async () => {
    // The markup says 400x300 and the bytes are 800x600. A pipeline that believes the
    // markup mis-scales every measurement taken off this drawing by a factor of two, and
    // does so silently — so `decoded` is the only size any consumer may measure against.
    const url = assetUrl('rzut-parteru-projekt-test', 915, HASH_PLAN)
    const pkg = await acquireOne('rzut-parteru-projekt-test', 915, 'width="400" height="300" alt="rzut parteru"', { [url]: { bytes: pngBytes(800, 600), mediaType: 'image/png' } }, { probeResolutionCandidates: false })
    expect(pkg.assets).toHaveLength(1)
    const variant = selectedVariant(pkg.assets[0])
    expect(variant.decoded).toEqual({ width: 800, height: 600 })
    expect(variant.declared).toEqual({ width: 400, height: 300 })
    expect(variant.declaredMismatch).toBe(true)
    // the aspect is derived from the decoded size, so grouping is not poisoned either
    expect(variant.aspect).toBe(round6(800 / 600))
    // and the media type recorded is the one the BYTES imply, not the one a header claimed
    expect(variant.mediaType).toBe('image/png')
  })

  it('flags a mismatch when only ONE declared dimension is wrong, which is how the live page gets it wrong', async () => {
    const net = stubFetch(benchmarkRoutes())
    const pkg = await acquire(net)
    const page = allVariants(pkg).find((v) => v.url === BENCHMARK.elevationPage)
    expect(page?.decoded).toEqual({ width: 400, height: 256 })
    expect(page?.declared).toEqual({ width: 400, height: 213 })
    expect(page?.declaredMismatch).toBe(true)
  })

  it('does not invent a declaration for an address the markup never described', async () => {
    // the original found by the resolution convention was never in the markup, so it has
    // no declared size at all — which is different from having one that happens to agree
    const net = stubFetch(benchmarkRoutes())
    const pkg = await acquire(net)
    const original = allVariants(pkg).find((v) => v.url === BENCHMARK.planOriginal)
    expect(original?.declared).toBeUndefined()
    expect(original?.declaredMismatch).toBe(false)
  })
})

describe('grouping through a full acquisition', () => {
  it('selects the largest DECODED copy of a drawing and says which size it beat', async () => {
    const net = stubFetch(benchmarkRoutes())
    const pkg = await acquire(net)
    const plan = pkg.assets.find((a) => a.roles.document === 'FLOOR_PLAN')
    expect(plan?.variants).toHaveLength(2)
    expect(selectedVariant(plan!).decoded).toEqual({ width: 640, height: 480 })
    expect(plan?.selectionReason).toContain('640x480 over 320x240')
    // the two copies really are one asset: the page copy and the convention's original
    expect(plan?.variants.map((v) => v.url).sort()).toEqual([BENCHMARK.planOriginal, BENCHMARK.planPage].sort())
  })

  it('keeps a DIFFERENT CROP as its own asset and records why, instead of calling it a bigger copy', async () => {
    // Same slug, same resolution convention, materially different aspect (4:3 against
    // 16:9). Treating the second as "the same drawing, larger" would put every coordinate
    // measured off it in the wrong place, so it becomes its own asset with the reason kept.
    const page = assetUrl('rzut-parteru-projekt-test', 915, HASH_PLAN)
    const crop = assetUrl('rzut-parteru-projekt-test', 11915, HASH_PLAN)
    const pkg = await acquireOne('rzut-parteru-projekt-test', 915, 'width="800" height="600" alt="rzut parteru"', {
      [page]: { bytes: pngBytes(800, 600, 1), mediaType: 'image/png' },
      [crop]: { bytes: pngBytes(800, 450, 2), mediaType: 'image/png' },
    })
    expect(pkg.assets).toHaveLength(2)
    for (const asset of pkg.assets) expect(asset.variants).toHaveLength(1)
    const failure = pkg.failures.find((f) => f.code === 'DIFFERENT_CROP')
    expect(failure).toBeDefined()
    expect(failure?.stage).toBe('ROLE')
    // the reference copy is the page's own element, so the crop is the one split off
    expect(failure?.target).toBe(crop)
    expect(allVariants(pkg).map((v) => `${v.decoded.width}x${v.decoded.height}`).sort()).toEqual(['800x450', '800x600'])
  })

  it('collapses byte-identical copies published at two addresses into ONE variant, and records the duplication', async () => {
    // The publisher serves one original both by convention and under its own undescribed
    // name. Counting it twice would make an elevation look like two elevations and would
    // let a tie-break pick "between" two copies of the same bytes.
    const page = assetUrl('elewacja-frontowa-projekt-test', 264, HASH_ELEVATION)
    const mirror = assetUrl('elewacja-frontowa-projekt-test', 11264, HASH_ELEVATION)
    const sameBytes = pngBytes(600, 400, 9)
    const pkg = await acquireOne('elewacja-frontowa-projekt-test', 264, 'alt="elewacja frontowa"', {
      [page]: { bytes: sameBytes, mediaType: 'image/png' },
      [mirror]: { bytes: sameBytes, mediaType: 'image/png' },
    }, {}, HASH_ELEVATION)
    expect(pkg.assets).toHaveLength(1)
    expect(pkg.assets[0].variants).toHaveLength(1)
    const failure = pkg.failures.find((f) => f.code === 'BYTE_IDENTICAL')
    expect(failure).toBeDefined()
    expect(failure?.message).toContain('one copy published at two addresses')
    // the surviving variant is the page's own address, the one with the descriptive name
    expect(pkg.assets[0].variants[0].url).toBe(page)
    // both addresses are named in the record — one as the target, one in the message — so
    // the duplication can be traced from either end
    const record = `${failure?.target} ${failure?.message}`
    expect(record).toContain(page)
    expect(record).toContain(mirror)
    // `target` is the address that was DROPPED: a consumer filtering failures by
    // target is asking what is NOT in the package, and naming the survivor there
    // answered the opposite question.
    expect(failure?.target).toBe(mirror)
    expect(failure?.message).toContain(page)
  })

  it('records a candidate that could not be fetched as a failure rather than dropping it', async () => {
    // A 404 on a conventional address is positive evidence that no larger copy is
    // published; a hole with a reason is worth more than a quietly substituted thumbnail.
    const page = assetUrl('przekroj-budynku-projekt-test', 256, HASH_PLAN)
    const pkg = await acquireOne('przekroj-budynku-projekt-test', 256, 'width="400" height="300" alt="przekroj"', { [page]: { bytes: pngBytes(400, 300), mediaType: 'image/png' } })
    expect(pkg.assets).toHaveLength(1)
    const missing = pkg.failures.find((f) => f.stage === 'ASSET_FETCH')
    expect(missing?.code).toBe('HTTP_STATUS')
    expect(missing?.target).toBe(assetUrl('przekroj-budynku-projekt-test', 11256, HASH_PLAN))
  })

  it('classifies the assets it sealed from the publisher’s naming, with no dimension guessed', async () => {
    const net = stubFetch(benchmarkRoutes())
    const pkg = await acquire(net)
    expect(pkg.assets.map((a) => a.roles).sort((a, b) => a.document.localeCompare(b.document))).toEqual([
      { document: 'ELEVATION', storey: 'NOT_APPLICABLE', annotation: 'UNKNOWN', view: 'FRONT', projection: 'ORTHOGRAPHIC_ELEVATION' },
      { document: 'FLOOR_PLAN', storey: 'GROUND', annotation: 'AREA_TABLE', view: 'NOT_APPLICABLE', projection: 'ORTHOGRAPHIC_PLAN' },
    ])
    expect(pkg.project).toEqual({ externalId: 'm1234abcd5678', name: 'Projekt Test (GE)', publisher: 'archon.pl' })
  })
})

// ---------------------------------------------------------------------------

describe('determinism and the content hash', () => {
  it('produces the same package, the same ids and the same hash from the same inputs, twice', async () => {
    // Nothing in a package may depend on when it was built, what order candidates came
    // back in, or which machine ran it: that is what makes a sealed package replayable
    // and two consumers' disagreements attributable to something other than acquisition.
    const first = await acquire(stubFetch(benchmarkRoutes()))
    const second = await acquire(stubFetch(benchmarkRoutes()))
    expect(second.contentHash).toBe(first.contentHash)
    expect(second.id).toBe(first.id)
    expect(second.assets.map((a) => a.id)).toEqual(first.assets.map((a) => a.id))
    expect(allVariants(second).map((v) => v.id)).toEqual(allVariants(first).map((v) => v.id))
    expect(canonicalJson(second)).toBe(canonicalJson(first))
  })

  /** A hashable draft of a package, cloned so a mutation cannot leak into another case. */
  function draftOf(pkg: SourcePackage): Omit<SourcePackage, 'contentHash'> {
    const { contentHash, ...draft } = structuredClone(pkg)
    void contentHash
    return draft
  }
  const hashWith = (pkg: SourcePackage, mutate: (draft: Omit<SourcePackage, 'contentHash'>) => void): string => {
    const draft = draftOf(pkg)
    mutate(draft)
    return sourcePackageContentHash(draft)
  }
  const fact = (value: number): PublishedFact => ({ key: 'footprint_area', label: 'Powierzchnia zabudowy', value, unit: 'm2', raw: `${value}` })

  it('hashes exactly what the package says the hash covers, so the stated exclusion list cannot drift', async () => {
    const pkg = await acquire(stubFetch(benchmarkRoutes()))
    expect(sourcePackageContentHash(draftOf(pkg))).toBe(pkg.contentHash)
  })

  it('is INSENSITIVE to prose about the same facts, and to the order the assets happen to sit in', async () => {
    const pkg = await acquire(stubFetch(benchmarkRoutes()))
    const base = pkg.contentHash

    // a reworded explanation is not a different source
    expect(hashWith(pkg, (d) => void (d.assets[0].selectionReason = 'it was simply the best one, obviously'))).toBe(base)
    // role evidence is prose about roles that are themselves hashed
    expect(hashWith(pkg, (d) => void (d.assets[0].roleEvidence = []))).toBe(base)
    // the channel a copy was found through can change without the copy changing
    expect(hashWith(pkg, (d) => void (d.assets[0].variants[0].discoveredVia = 'OG_IMAGE:meta[og:image]@somewhere-else'))).toBe(base)
    // the assets are a SET: two runs that found the same things in a different order agree
    expect(hashWith(pkg, (d) => void d.assets.reverse())).toBe(base)

    // a failure's wording is prose too, while its code is content
    const withFailure = hashWith(pkg, (d) => void d.failures.push({ stage: 'ASSET_FETCH', target: 'https://assets.archon.pl/x.jpg', code: 'HTTP_STATUS', message: 'HTTP 404' }))
    const reworded = hashWith(pkg, (d) => void d.failures.push({ stage: 'ASSET_FETCH', target: 'https://assets.archon.pl/x.jpg', code: 'HTTP_STATUS', message: 'the server said the file is gone' }))
    expect(reworded).toBe(withFailure)
    expect(withFailure).not.toBe(base)
  })

  it('is SENSITIVE to every fact that makes one acquisition a different description of the material', async () => {
    const pkg = await acquire(stubFetch(benchmarkRoutes()))
    const base = pkg.contentHash

    // a different decoded size is the whole bug this package exists to prevent
    expect(hashWith(pkg, (d) => void (d.assets[0].variants[0].decoded.width += 1))).not.toBe(base)
    // different bytes at the same address are different material
    expect(hashWith(pkg, (d) => void (d.assets[0].variants[0].byteHash = sha256Hex('other bytes')))).not.toBe(base)
    // selecting the other copy changes what every consumer will analyse
    expect(hashWith(pkg, (d) => void (d.assets[0].selectedVariantId = d.assets[0].variants[1].id))).not.toBe(base)
    // a changed role changes what the asset IS
    expect(hashWith(pkg, (d) => void (d.assets[0].roles.storey = 'ATTIC'))).not.toBe(base)
    // and a changed adapter means the same bytes were read by different rules
    expect(hashWith(pkg, (d) => void (d.adapter.version = '2.0.0'))).not.toBe(base)
    expect(hashWith(pkg, (d) => void (d.pageHash = sha256Hex('a different page')))).not.toBe(base)

    // a published figure that moved is a different description of the building
    const published = hashWith(pkg, (d) => void d.publishedFacts.push(fact(131.16)))
    const moved = hashWith(pkg, (d) => void d.publishedFacts.push(fact(131.17)))
    expect(published).not.toBe(base)
    expect(moved).not.toBe(published)
  })
})

// ---------------------------------------------------------------------------

describe('offline replay', () => {
  it('rebuilds a byte-identical package from a populated cache with no network at all', async () => {
    // This is what lets a benchmark run in CI and a reconstruction be audited later
    // without asking the publisher to serve the same file twice. The cached bytes are the
    // published bytes, so their hash is the published hash and the package must not move.
    const net = stubFetch(benchmarkRoutes())
    const cache = memoryByteCache()
    const online = await acquire(net, { cache })
    const callsWhileOnline = net.calls.length
    expect(callsWhileOnline).toBe(5) // the page and four assets
    expect(cache.size()).toBe(5)

    const replayed = await acquireSourcePackage(PAGE_URL, [archonAdapter], {
      cache,
      offline: true,
      // if anything reaches for the network this throws, and a NETWORK failure would show
      // up in the package below
      deps: { fetchImpl: forbiddenFetch, resolve: publicResolver },
    })

    expect(canonicalJson(replayed)).toBe(canonicalJson(online))
    expect(replayed.contentHash).toBe(online.contentHash)
    expect(replayed.failures).toEqual([])
    // the stub really was left alone: not one extra request
    expect(net.calls.length).toBe(callsWhileOnline)
  })

  it('records an honest cache miss offline instead of silently producing a smaller package', async () => {
    const cache = memoryByteCache()
    const routes = benchmarkRoutes()
    await acquire(stubFetch(routes), { cache })
    // forget one asset, as a partially warmed cache would
    const partial = memoryByteCache([...([PAGE_URL, BENCHMARK.planPage, BENCHMARK.elevationPage, BENCHMARK.elevationOriginal].map((u) => [u, { bytes: routes[u].bytes!, mediaType: routes[u].mediaType! }]) as Array<[string, { bytes: Uint8Array; mediaType: string }]>)])
    const replayed = await acquireSourcePackage(PAGE_URL, [archonAdapter], { cache: partial, offline: true, deps: { fetchImpl: forbiddenFetch, resolve: publicResolver } })
    const miss = replayed.failures.find((f) => f.code === 'OFFLINE_CACHE_MISS')
    expect(miss?.target).toBe(BENCHMARK.planOriginal)
    // the plan is still sealed, at the only resolution that was actually available
    const plan = replayed.assets.find((a) => a.roles.document === 'FLOOR_PLAN')
    expect(selectedVariant(plan!).decoded).toEqual({ width: 320, height: 240 })
    // and that is a DIFFERENT package, which the hash says out loud
    expect(replayed.contentHash).not.toBe((await acquire(stubFetch(routes), { cache })).contentHash)
  })
})
