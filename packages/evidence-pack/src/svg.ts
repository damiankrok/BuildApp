/**
 * A tiny SVG writer with an element budget (BUILDPLAN-ANALYZER-005D Evidence Pack).
 *
 * Every picture in a pack is drawn from analyzer-owned primitives — lines, rectangles, points,
 * polygons and short text — in the frame's own pixel coordinates. There is no way to put an
 * `<image>` in one: this writer has no such element, and the pack's tests refuse any `<image`,
 * `data:` URI or `xlink:href` in what it emits. A publisher's drawing is never part of a pack.
 */
export type SvgStyle = { stroke?: string; fill?: string; width?: number; dash?: string; opacity?: number }

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const n = (v: number): string => (Number.isFinite(v) ? String(Math.round(v * 100) / 100) : '0')

export class Svg {
  private readonly parts: string[] = []
  private count = 0
  private dropped = 0
  constructor(
    readonly width: number,
    readonly height: number,
    readonly title: string,
    readonly budget: number,
  ) {}

  private push(element: string): boolean {
    if (this.count >= this.budget) {
      this.dropped += 1
      return false
    }
    this.count += 1
    this.parts.push(element)
    return true
  }

  private attrs(style: SvgStyle, id?: string, data?: Record<string, string | number>): string {
    const a: string[] = []
    if (id) a.push(`id="${esc(id)}"`)
    a.push(`stroke="${style.stroke ?? 'none'}"`, `fill="${style.fill ?? 'none'}"`)
    if (style.width !== undefined) a.push(`stroke-width="${n(style.width)}"`)
    if (style.dash) a.push(`stroke-dasharray="${style.dash}"`)
    if (style.opacity !== undefined) a.push(`opacity="${n(style.opacity)}"`)
    for (const [k, v] of Object.entries(data ?? {})) a.push(`data-${k}="${esc(String(v))}"`)
    return a.join(' ')
  }

  line(x1: number, y1: number, x2: number, y2: number, style: SvgStyle, id?: string, data?: Record<string, string | number>): boolean {
    return this.push(`<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}" ${this.attrs(style, id, data)}/>`)
  }

  rect(x0: number, y0: number, x1: number, y1: number, style: SvgStyle, id?: string, data?: Record<string, string | number>): boolean {
    return this.push(`<rect x="${n(Math.min(x0, x1))}" y="${n(Math.min(y0, y1))}" width="${n(Math.abs(x1 - x0))}" height="${n(Math.abs(y1 - y0))}" ${this.attrs(style, id, data)}/>`)
  }

  circle(cx: number, cy: number, r: number, style: SvgStyle, id?: string, data?: Record<string, string | number>): boolean {
    return this.push(`<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}" ${this.attrs(style, id, data)}/>`)
  }

  polygon(points: ReadonlyArray<{ x: number; y: number }>, style: SvgStyle, id?: string, data?: Record<string, string | number>): boolean {
    return this.push(`<polygon points="${points.map((p) => `${n(p.x)},${n(p.y)}`).join(' ')}" ${this.attrs(style, id, data)}/>`)
  }

  text(x: number, y: number, s: string, size: number, fill = '#111', anchor: 'start' | 'middle' | 'end' = 'start', weight: 'normal' | 'bold' = 'normal'): boolean {
    return this.push(`<text x="${n(x)}" y="${n(y)}" font-family="monospace" font-size="${n(size)}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}">${esc(s)}</text>`)
  }

  /** The finished document: one root, a title, a background, the elements, and how many the budget dropped. */
  render(): string {
    const note = this.dropped > 0 ? `\n<!-- ${this.dropped} elements over the budget of ${this.budget} were not drawn; the JSON sidecar lists every object -->` : ''
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${n(this.width)} ${n(this.height)}" width="${n(this.width)}" height="${n(this.height)}">\n<title>${esc(this.title)}</title>\n<rect x="0" y="0" width="${n(this.width)}" height="${n(this.height)}" fill="#ffffff"/>\n${this.parts.join('\n')}${note}\n</svg>\n`
  }

  get elements(): number {
    return this.count
  }

  get omitted(): number {
    return this.dropped
  }
}

/** What a pack may never contain in an SVG: a raster, a data URI, an external reference. */
export const FORBIDDEN_IN_SVG = [/<image\b/i, /data:/i, /xlink:href/i, /base64/i, /<foreignObject\b/i] as const

export const COLOURS = {
  TICK: '#1b8a3a',
  QUESTIONABLE: '#e08a00',
  REJECTED: '#d11f1f',
  PRIMARY: '#1f5fd1',
  ALTERNATIVE: '#9a9a9a',
  AMBIGUOUS: '#8a2fd1',
  UNCENTRED: '#c0c0c0',
  wall: '#5a6a7a',
  extent: '#d11fa0',
  envelope: '#00a0b0',
  body: '#2f9a5a',
  rejectedBody: '#d17a1f',
  text: '#222222',
} as const
