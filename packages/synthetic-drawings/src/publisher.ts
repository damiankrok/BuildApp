/**
 * A publisher that exists only in this repository.
 *
 * The link analyzer is a network service: a user pastes a URL, the service
 * fetches a page, finds the drawings on it and runs the pipeline. Testing that
 * end to end against a real publisher would make every test depend on
 * somebody else's web site. This is a web site in memory instead — a page that
 * links its sheets, the PNG bytes of those sheets, a resolver that says where
 * each host lives, and the adapter that reads the page — wired into the SAME
 * acquisition code a real URL goes through (`FetchDeps` is its only seam).
 *
 * It is a test fixture. No runtime wiring may import it: the analyzer API
 * registers the real publishers, and the architecture tests hold that line.
 */
import type { DiscoveredCandidate, FetchDeps, RoleClaim, SourceAdapter } from '@buildapp/source-package'
import { renderSheets } from './fixture.js'
import type { SyntheticSheet } from './fixture.js'
import type { SheetOptions, SyntheticHouse } from './house.js'

export type SyntheticProject = {
  /** The last path segment of the project's page, and the adapter's external id. */
  code: string
  title: string
  house: SyntheticHouse
  sheetOptions?: SheetOptions
  /** Only these sheets are published, by slug; all of them when absent. */
  only?: (slug: string) => boolean
}

export type SyntheticPublisherOptions = {
  host?: string
  projects: readonly SyntheticProject[]
  /**
   * Extra addresses on the in-memory internet. A host listed here resolves to
   * the address given; a path listed in `redirects` answers 302 to its target.
   * Both exist so a test can aim a redirect at somewhere private and watch the
   * acquisition refuse it.
   */
  hosts?: Record<string, string>
  redirects?: Record<string, string>
  /** Called before each response; a test can hold a request open (until `signal` aborts) or count them. */
  beforeRespond?: (url: string, signal?: AbortSignal) => Promise<void> | void
}

export type SyntheticPublisher = {
  host: string
  pageUrl: (code: string) => string
  adapter: SourceAdapter
  deps: FetchDeps
  /** Every address the in-memory internet was asked for, in order. */
  requests: string[]
}

// A publicly routable address: the SSRF guard refuses documentation ranges too.
const PUBLIC_ADDRESS = '93.184.215.14'

const PROJECTION: Record<SyntheticSheet['document'], RoleClaim['projection']> = {
  FLOOR_PLAN: 'ORTHOGRAPHIC_PLAN',
  SECTION: 'ORTHOGRAPHIC_SECTION',
  ELEVATION: 'ORTHOGRAPHIC_ELEVATION',
}

const escapeHtml = (text: string): string => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function syntheticPublisher(options: SyntheticPublisherOptions): SyntheticPublisher {
  const host = options.host ?? 'drawings.synthetic-publisher.test'
  const origin = `https://${host}`
  const pageUrl = (code: string): string => `${origin}/projects/${code}`
  const requests: string[] = []

  // Rendering is the slow part, and a project is rendered once, when first asked for.
  const sheetsByCode = new Map<string, SyntheticSheet[]>()
  const sheetsOf = (project: SyntheticProject): SyntheticSheet[] => {
    let sheets = sheetsByCode.get(project.code)
    if (!sheets) {
      sheets = renderSheets(project.house, project.sheetOptions ?? {}).filter((s) => (project.only ? project.only(s.slug) : true))
      sheetsByCode.set(project.code, sheets)
    }
    return sheets
  }
  const projectByCode = new Map(options.projects.map((p) => [p.code, p]))
  const sheetUrl = (code: string, slug: string): string => `${origin}/sheets/${code}/${slug}.png`

  const pageHtml = (project: SyntheticProject): string =>
    [
      '<!doctype html><html><head>',
      `<title>${escapeHtml(project.title)} | Synthetic Publisher</title>`,
      '</head><body>',
      `<h1>${escapeHtml(project.title)}</h1>`,
      ...sheetsOf(project).map((s) => `<a class="sheet" href="/sheets/${project.code}/${s.slug}.png">${escapeHtml(s.slug)}</a>`),
      '</body></html>',
    ].join('\n')

  const respond = (status: number, body: Uint8Array | string, type: string, headers: Record<string, string> = {}): Response =>
    new Response(typeof body === 'string' ? body : Buffer.from(body), { status, headers: { 'content-type': type, ...headers } })

  const fetchImpl = (async (input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url)
    requests.push(url.toString())
    if (init?.signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' })
    await options.beforeRespond?.(url.toString(), init?.signal ?? undefined)
    if (init?.signal?.aborted) throw Object.assign(new Error('aborted'), { name: 'AbortError' })
    const redirect = options.redirects?.[url.toString()]
    if (redirect) return respond(302, '', 'text/plain', { location: redirect })
    if (url.hostname !== host) return respond(404, 'not found', 'text/plain')
    const page = /^\/projects\/([a-z0-9-]+)$/.exec(url.pathname)
    if (page) {
      const project = projectByCode.get(page[1])
      return project ? respond(200, pageHtml(project), 'text/html; charset=utf-8') : respond(404, 'no such project', 'text/plain')
    }
    const sheet = /^\/sheets\/([a-z0-9-]+)\/([a-z0-9-]+)\.png$/.exec(url.pathname)
    if (sheet) {
      const project = projectByCode.get(sheet[1])
      const found = project ? sheetsOf(project).find((s) => s.slug === sheet[2]) : undefined
      return found ? respond(200, found.bytes, 'image/png') : respond(404, 'no such sheet', 'text/plain')
    }
    return respond(404, 'not found', 'text/plain')
  }) as typeof fetch

  const resolve = async (name: string): Promise<string[]> => {
    if (name === host) return [PUBLIC_ADDRESS]
    const extra = options.hosts?.[name]
    if (extra) return [extra]
    throw new Error(`ENOTFOUND ${name}`)
  }

  const sheetForUrl = (address: string): SyntheticSheet | undefined => {
    const m = /\/sheets\/([a-z0-9-]+)\/([a-z0-9-]+)\.png$/.exec(new URL(address).pathname)
    const project = m ? projectByCode.get(m[1]) : undefined
    return project ? sheetsOf(project).find((s) => s.slug === m![2]) : undefined
  }

  const adapter: SourceAdapter = {
    id: 'synthetic-publisher',
    version: '1',
    matches: (url) => url.hostname === host,
    identify: (ctx) => {
      const code = /\/projects\/([a-z0-9-]+)$/.exec(new URL(ctx.url).pathname)?.[1]
      const title = /<title>([^<|]+)/.exec(ctx.html)?.[1]?.trim()
      return { externalId: code, name: title, publisher: 'synthetic-publisher' }
    },
    async discover(ctx) {
      const out: DiscoveredCandidate[] = []
      for (const m of ctx.html.matchAll(/<a class="sheet" href="([^"]+)">([^<]*)<\/a>/g)) {
        out.push({ url: new URL(m[1], ctx.url).toString(), channel: 'ANCHOR_HREF', exposedBy: ctx.url, locator: 'a.sheet[href]', caption: m[2] })
      }
      return out
    },
    resolutionCandidates: () => [],
    roleClaims: (candidate) => {
      // The publisher names its own sheets; this is its naming convention, read back.
      const s = sheetForUrl(candidate.url)
      if (!s) return []
      return [
        {
          document: s.document,
          storey: s.storey,
          view: s.view,
          projection: PROJECTION[s.document],
          annotation: s.document === 'FLOOR_PLAN' ? 'DIMENSIONED' : undefined,
          signal: 'filename',
          detail: `the synthetic publisher's sheet name ${s.slug}`,
          confidence: 0.95,
        },
      ]
    },
    parsePublished: () => ({ facts: [], specifications: [], rooms: [] }),
  }

  return { host, pageUrl, adapter, deps: { fetchImpl, resolve }, requests }
}
