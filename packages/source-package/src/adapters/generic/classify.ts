/**
 * Is this page plausibly a house project page?
 *
 * Decided from combined signals, never from one keyword: a title that names
 * a house, a published floor area, roof facts, dimensions, a room table, a
 * project code, plan / elevation / section imagery, technical downloads,
 * structured data. Each signal is a FAMILY; a project page needs several
 * families to agree, so "dom" in a blog post's title is not a house.
 *
 * Three verdicts. PROJECT_PAGE: read it. NOT_PROJECT: say so. And
 * REQUIRES_RENDERING for the page whose markup is an empty mount point with
 * a script tag — the content exists only after a browser runs it, which this
 * analyzer does not do; that is a different fact from "not a project" and is
 * reported as one.
 */
import type { SourceClassification } from '../../adapter.js'
import { compareCodeUnits, deaccent } from '../../text.js'
import { ANY_DRAWING_WORD, DOCUMENT_WORDS, HOUSE_WORDS } from './vocabulary.js'
import { jsonLdStrings, jsonLdTypes, type PageFacts } from './markup.js'
import { blockPairs } from './published.js'

type Signal = { family: string; signal: string; detail: string; weight: number }

const AREA_LABEL = /powierzchni|\barea\b|\bm2\b|m²|\bsq\.? ?m\b|\bwohnfl/
const ROOF_LABEL = /\bdach\w*|\broof\w*|nachyleni|\bpitch\b|\bkat dachu|\bpolaci/
const DIMENSION_LABEL = /\bwymiar\w*|\bwysoko\w*|\bszeroko\w*|\bdlugo\w*|\bheight\b|\bwidth\b|\blength\b|\bdimension\w*|\bkubatur\w*|\bvolume\b/
const CODE_LABEL = /\bsymbol\b|\bkod\b|\bnr projektu|\bnumer projektu|\bproject (code|number|id)\b|\bsku\b|\bkatalog/
const DOWNLOAD = /\.(pdf|dwg|dxf|zip)(\?|#|$)/i
const STRUCTURED_TYPES = ['product', 'house', 'singlefamilyresidence', 'accommodation', 'realestatelisting', 'residence', 'offer']

const MIN_SCORE = 4
const MIN_FAMILIES = 2

/** Classify a fetched page from what it states and what it shows. */
export function classifyProjectPage(facts: PageFacts): SourceClassification {
  const signals: Signal[] = []
  const add = (family: string, signal: string, detail: string, weight: number): void => {
    if (!signals.some((s) => s.signal === signal)) signals.push({ family, signal, detail, weight })
  }

  // --- what the page calls itself ---
  const names = [facts.ogTitle, facts.h1, facts.title].filter((t): t is string => !!t)
  for (const name of names) {
    const m = HOUSE_WORDS.exec(deaccent(name))
    if (m) {
      add('title', 'title', `the page names a house or project ("${name.slice(0, 60)}")`, 1)
      break
    }
  }
  const types = jsonLdTypes(facts.jsonLd)
  const structured = types.find((t) => STRUCTURED_TYPES.includes(t))
  if (structured) add('structured', 'json-ld', `structured data of type ${structured}`, 1)
  if (facts.ogType && /product|house|place|article/.test(facts.ogType.toLowerCase())) add('structured', 'og:type', `og:type ${facts.ogType}`, 0.5)

  // --- what it states ---
  const labels = [...facts.pairs, ...blockPairs(facts)].map((p) => ({ label: deaccent(p.label), value: p.value }))
  const areaPairs = labels.filter((p) => AREA_LABEL.test(p.label) && /\d/.test(p.value))
  if (areaPairs.length > 0) add('figures', 'area', `${areaPairs.length} published area figure${areaPairs.length === 1 ? '' : 's'} (e.g. "${areaPairs[0].label}")`, 2)
  const roofPairs = labels.filter((p) => ROOF_LABEL.test(p.label) || ROOF_LABEL.test(deaccent(p.value)))
  if (roofPairs.length > 0) add('figures', 'roof', `roof stated in words ("${roofPairs[0].label}")`, 1)
  const dimensionPairs = labels.filter((p) => DIMENSION_LABEL.test(p.label) && /\d/.test(p.value))
  if (dimensionPairs.length > 0) add('figures', 'dimensions', `${dimensionPairs.length} published dimension${dimensionPairs.length === 1 ? '' : 's'} (e.g. "${dimensionPairs[0].label}")`, 1)
  const codePairs = labels.filter((p) => CODE_LABEL.test(p.label))
  const codeFromLd = jsonLdStrings(facts.jsonLd, ['sku', 'productID', 'mpn', 'identifier'])
  if (codePairs.length > 0 || codeFromLd.length > 0) add('code', 'project-code', codePairs.length > 0 ? `a project code line ("${codePairs[0].label}")` : `a structured identifier (${codeFromLd[0]})`, 1)

  // --- a room schedule: several numbered rows ending in a number ---
  let roomRows = 0
  for (const t of facts.tables) {
    const rows = t.rows.filter((r) => r.cells.length >= 2 && /^\d{1,2}\.?\s*\S/.test(r.cells[0]) && r.cells.slice(1).some((c) => /^\d+[.,]?\d*\s*(m²|m2)?$/.test(c.trim())))
    roomRows = Math.max(roomRows, rows.length)
  }
  if (roomRows >= 3) add('rooms', 'room-table', `a room schedule with ${roomRows} numbered rows`, 2)

  // --- what it shows: drawing vocabulary around images, headings and links ---
  const drawingKinds = new Set<string>()
  const emptyHeadings: string[] = []
  const hits: string[] = []
  for (const m of facts.body.matchAll(/<img\b([^>]*)>/gi)) {
    const attrs = deaccent(m[1])
    const words = [...attrs.matchAll(/\b(?:alt|title|data-caption|aria-label)\s*=\s*("([^"]*)"|'([^']*)')/gi)].map((a) => a[2] ?? a[3] ?? '').join(' ')
    const src = /\bsrc\s*=\s*("([^"]*)"|'([^']*)')/i.exec(m[1])
    const file = src ? decodeURIComponent((src[2] ?? src[3] ?? '').split('/').pop() ?? '') : ''
    const text = `${words} ${deaccent(file).replace(/[-_.]+/g, ' ')}`
    for (const rule of DOCUMENT_WORDS) {
      const d = rule.claim.document
      if (d && d !== 'PERSPECTIVE_RENDER' && rule.test.test(text)) {
        drawingKinds.add(d)
        if (hits.length < 4) hits.push(`${d.toLowerCase()} ← "${text.trim().slice(0, 40)}"`)
        break
      }
    }
  }
  // A heading names drawings only when a picture stands under it before the next heading of its rank or above.
  const PICTURE = /<img\b|<picture\b|<source\b[^>]*srcset|<a\b[^>]*href\s*=\s*["'][^"']*\.(?:jpe?g|png|gif|webp|pdf)\b/i
  for (const [i, h] of facts.headings.entries()) {
    const next = facts.headings.slice(i + 1).find((x) => x.level <= h.level)
    const pictured = PICTURE.test(facts.body.slice(h.offset, next?.offset ?? h.offset + 20000))
    for (const rule of DOCUMENT_WORDS) {
      const d = rule.claim.document
      if (d && d !== 'PERSPECTIVE_RENDER' && rule.test.test(deaccent(h.text))) {
        drawingKinds.add(d)
        // still a sign of a project page; said as what it is, a heading with nothing under it
        if (!pictured) emptyHeadings.push(`"${h.text.slice(0, 30)}" has no picture under it`)
      }
    }
  }
  if (drawingKinds.has('FLOOR_PLAN')) add('drawings', 'plan-imagery', `floor-plan imagery or headings (${hits.join('; ') || 'by heading'})`, 2)
  if (drawingKinds.has('ELEVATION')) add('drawings', 'elevation-imagery', 'elevation imagery or headings', 1)
  if (drawingKinds.has('SECTION')) add('drawings', 'section-imagery', 'section imagery or headings', 1)
  if (emptyHeadings.length > 0) add('drawings', 'empty-drawing-heading', emptyHeadings.join('; '), 0)
  const downloads = [...facts.body.matchAll(/<a\b[^>]*href\s*=\s*("([^"]*)"|'([^']*)')/gi)].map((a) => a[2] ?? a[3] ?? '').filter((h) => DOWNLOAD.test(h) && ANY_DRAWING_WORD.test(deaccent(h)))
  if (downloads.length > 0) add('drawings', 'technical-download', `${downloads.length} technical download link${downloads.length === 1 ? '' : 's'}`, 1)

  const score = signals.reduce((a, s) => a + s.weight, 0)
  const families = new Set(signals.map((s) => s.family))
  const evidence = [...signals].sort((a, b) => b.weight - a.weight || compareCodeUnits(a.signal, b.signal)).map((s) => ({ signal: s.signal, detail: s.detail, weight: s.weight }))
  const confidence = Math.min(1, Math.round((score / 8) * 100) / 100)

  if (score >= MIN_SCORE && families.size >= MIN_FAMILIES) return { verdict: 'PROJECT_PAGE', confidence, evidence }

  // A script shell: little or no text, a mount point or a noscript plea, and no drawing on the page.
  const shell = facts.scriptShellHints.length > 0 || (facts.textLength < 400 && facts.scriptCount > 0 && facts.imageCount === 0)
  if (shell && drawingKinds.size === 0) {
    return {
      verdict: 'REQUIRES_RENDERING',
      confidence,
      evidence: [...facts.scriptShellHints.map((h) => ({ signal: 'script-shell', detail: h, weight: 0 })), { signal: 'text', detail: `${facts.textLength} characters of text and ${facts.scriptCount} script tag${facts.scriptCount === 1 ? '' : 's'} before any browser ran`, weight: 0 }, ...evidence],
    }
  }
  return {
    verdict: 'NOT_PROJECT',
    confidence,
    evidence: [{ signal: 'threshold', detail: `${signals.length} signal${signals.length === 1 ? '' : 's'} in ${families.size} famil${families.size === 1 ? 'y' : 'ies'} scored ${score}; a project page needs at least ${MIN_SCORE} from ${MIN_FAMILIES} families`, weight: 0 }, ...evidence],
  }
}
