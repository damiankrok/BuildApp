/**
 * What a drawing is, from the words around it — in the two languages a
 * Polish house project is published in, and nothing about any publisher.
 *
 * The rules are deliberately about VOCABULARY, not markup: "rzut parteru" in
 * an alt attribute, a heading, a filename or a figure caption is the same
 * statement. Where a word matches, the claim carries a confidence scaled by
 * where it was found — a filename is the publisher's own filing, a caption is
 * prose, a heading above the picture is context.
 */
import type { RoleClaim } from '../../roles.js'
import { deaccent } from '../../text.js'

export type WordRule = { test: RegExp; claim: Omit<RoleClaim, 'signal' | 'detail' | 'confidence'>; confidence: number; why: string }

/** Ordered: the first matching document rule wins the document dimension. */
export const DOCUMENT_WORDS: WordRule[] = [
  { test: /\bprzekr\w*|\bsections?\b|\bschnitt/, claim: { document: 'SECTION' }, confidence: 0.92, why: '"przekrój" / "section" names a section' },
  { test: /\belewacj\w*|\belevations?\b|\bfa[cç]ades?\b|\bfasad\w*|\bansicht/, claim: { document: 'ELEVATION' }, confidence: 0.92, why: '"elewacja" / "elevation" names an elevation' },
  { test: /\bsytuacj\w*|\bobrys\w*|\bsite[- ]?plan|\bplan zagospodarowania|\bdzialk\w*|\bplot\b/, claim: { document: 'SITE_PLAN' }, confidence: 0.88, why: '"sytuacja" / "obrys" / "site plan" names a site plan' },
  { test: /\brzut\w*|\bfloor[- ]?plans?\b|\bfloorplans?\b|\bgrundriss|\bplan\b|\bplany\b/, claim: { document: 'FLOOR_PLAN' }, confidence: 0.92, why: '"rzut" / "floor plan" names a floor plan' },
  { test: /\bwizualizacj\w*|\bwizualka|\brender\w*|\bwidok\w*|\bperspekt\w*|\bvisuali[sz]\w*|\bstylizacj\w*|\b3d\b/, claim: { document: 'PERSPECTIVE_RENDER' }, confidence: 0.86, why: '"wizualizacja" / "render" / "widok" names a visualisation' },
]

export const STOREY_WORDS: WordRule[] = [
  // "parter" the storey, never "parterowy" the house type: a single-storey house's render is not a ground-floor plan
  { test: /\bparter(u|ze|em)?\b|\bprzyziem\w*|\bground\b|\berdgeschoss/, claim: { storey: 'GROUND' }, confidence: 0.92, why: '"parter" / "ground" is the ground storey' },
  { test: /\bpoddasz\w*|\bstrych\w*|\battic\b|\bloft\b|\bdachgeschoss/, claim: { storey: 'ATTIC' }, confidence: 0.92, why: '"poddasze" / "attic" is the attic storey' },
  { test: /\bpi[eę]tr\w*|\bfirst[- ]?floor|\bupper\b|\b1st\b|\bobergeschoss/, claim: { storey: 'UPPER' }, confidence: 0.85, why: '"piętro" / "first floor" is an upper storey' },
  { test: /\bpiwnic\w*|\bsuteren\w*|\bbasement\b|\bcellar\b|\bkeller/, claim: { storey: 'BASEMENT' }, confidence: 0.85, why: '"piwnica" / "basement" is a basement' },
]

export const VIEW_WORDS: WordRule[] = [
  { test: /\bfrontow\w*|\bprzedni\w*|\bfront\b|\bprzod\b|\bod przodu\b/, claim: { view: 'FRONT' }, confidence: 0.9, why: '"frontowa" / "front" is the front' },
  { test: /\bogrodow\w*|\btyln\w*|\btyl\b|\bod tylu\b|\brear\b|\bback\b|\bgarden\b/, claim: { view: 'REAR' }, confidence: 0.9, why: '"ogrodowa" / "rear" is the rear' },
  { test: /\blew(a|y|ej|ym|o|e)\b|\bleft\b/, claim: { view: 'SIDE_LEFT' }, confidence: 0.85, why: '"lewa" / "left" is the left side' },
  { test: /\bpraw(a|y|ej|ym|o|e)\b|\bright\b/, claim: { view: 'SIDE_RIGHT' }, confidence: 0.85, why: '"prawa" / "right" is the right side' },
  { test: /\bboczn\w*|\bside\b/, claim: { view: 'SIDE_UNSPECIFIED' }, confidence: 0.88, why: '"boczna" / "side" names a side without saying which' },
]

export const ANNOTATION_WORDS: WordRule[] = [
  { test: /z-powierzchniami|\bpowierzchni\w*|\barea table|\bareas\b/, claim: { annotation: 'AREA_TABLE' }, confidence: 0.85, why: '"z powierzchniami" / "areas" is the copy carrying the room areas' },
  { test: /\bwymiar\w*|\bdimension\w*/, claim: { annotation: 'DIMENSIONED' }, confidence: 0.8, why: '"wymiary" / "dimensions" is the dimensioned copy' },
]

/** Words that make a link worth following one level, on the same site, for more drawings. */
export const DRAWING_LINK_WORDS = /\brzut\w*|\belewacj\w*|\bprzekr\w*|\brysun\w*|\bdokumentacj\w*|\bfloor[- ]?plans?\b|\belevations?\b|\bsections?\b|\bdrawings?\b|\btechnical\b|\bplany\b/

/** Any drawing word at all, for telling a project picture from a navigation thumbnail. */
export const ANY_DRAWING_WORD = new RegExp([...DOCUMENT_WORDS.map((r) => r.test.source), DRAWING_LINK_WORDS.source].join('|'))

/** Words a page about a house uses for itself. */
export const HOUSE_WORDS = /\bdom\b|\bdomu\b|\bdomy\b|\bprojekt\w*|\bhouse\b|\bhome\b|\bvilla\b|\bwilla\b|\bbungalow\b|\bresidence\b|\bhaus\b|\bcottage\b/

/** Site chrome by name: never a drawing of the house. */
export const CHROME_NAME = /logo|icon|sprite|banner|avatar|flag|badge|payment|button|arrow|social|facebook|instagram|youtube|pixel|spacer|loading|placeholder|blank\.|1x1|tracking|cookie|captcha/i

export type Applied = { rule: WordRule; matched: string }

/** The first rule of a set that matches the deaccented text, or undefined. */
export function firstMatch(rules: readonly WordRule[], text: string): Applied | undefined {
  const folded = deaccent(text)
  for (const rule of rules) {
    const m = rule.test.exec(folded)
    if (m) return { rule, matched: m[0] }
  }
  return undefined
}

/**
 * What a linked technical document is, from its words: the link text, the
 * list item it is filed under, its filename. Ordered: first match wins. A
 * document is never an image asset; this is its kind, not a drawing role.
 */
export type DocumentKind = 'OUTLINE' | 'DRAWING_SET' | 'ENERGY_CERTIFICATE' | 'COST_ESTIMATE' | 'BROCHURE' | 'UNKNOWN'
export const DOCUMENT_KIND_WORDS: Array<{ test: RegExp; kind: DocumentKind; why: string }> = [
  { test: /\bobrys\w*|\boutline\b|\bfootprint\b|\bumriss/, kind: 'OUTLINE', why: '"obrys budynku" / "outline" is the building outline' },
  { test: /charakterystyk\w* energetyczn\w*|swiadectw\w* energetyczn\w*|\benergy (performance|certificate)\b|\bepc\b/, kind: 'ENERGY_CERTIFICATE', why: '"charakterystyka energetyczna" is an energy certificate, not a drawing' },
  { test: /\bkosztorys\w*|\bzestawienie materialow|\bcost estimate\b|\bbill of quantities\b/, kind: 'COST_ESTIMATE', why: '"kosztorys" is a cost estimate' },
  { test: /\brzut\w*|\belewacj\w*|\bprzekr\w*|\brysun\w*|\bdokumentacj\w*|\bfloor[- ]?plans?\b|\belevations?\b|\bsections?\b|\bdrawings?\b/, kind: 'DRAWING_SET', why: 'drawing words name a drawing set' },
  { test: /\bprezentacj\w*|\bdrukuj\b|\bwydruk\w*|\bkarta projektu\b|\bbroszur\w*|\bbrochure\b|\bprint\b/, kind: 'BROCHURE', why: 'a presentation or print copy of the page' },
]
export const MIRROR_WORDS = /\blustr\w*|\bmirror\w*|\bodbici\w* lustrzan\w*|\bgespiegelt/
export const BASE_WORDS = /\bpodstaw\w*|\boryginal\w*|\bbase\b|\bstandard\w*/
/** A scale printed with the link ("w skali 1:500"): kept as text, never a transform. */
export const STATED_SCALE = /\b1\s*:\s*(\d{2,4})\b/
