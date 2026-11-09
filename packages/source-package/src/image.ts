/**
 * Image identity and decoding, from bytes only.
 *
 * `probeImage` reads the real format and the real pixel dimensions out of the
 * encoded bytes. Nothing here consults a filename, a `Content-Type` header or
 * an HTML attribute, because all three are routinely wrong: the benchmark
 * page declares `height="213"` for an elevation whose bytes are 256 pixels
 * tall, and a pipeline that trusts the markup silently mis-scales every
 * measurement taken off that drawing.
 *
 * `decodeImage` produces an RGBA raster for the deterministic CV layer. JPEG,
 * GIF and PNG (the benchmark publisher's formats) and WebP (005X-N3: the
 * default upload format of common publishing platforms; a plan served only as
 * WebP was otherwise a page "without a plan") are supported; anything else is
 * an honest failure rather than a guess.
 *
 * SVG (v3.51): a publisher that draws its plans as vectors serves no raster of them at all. An SVG has no pixels of
 * its own, so this layer gives it some, by one fixed rule (`svgRasterSize`): the size the file states, brought into
 * the range a plan sheet is read at. `probeImage` and `decodeImage` agree on that size, so everything downstream
 * measures a raster like any other. Rendering is resvg's (`@resvg/resvg-wasm`, MPL-2.0): no script runs, nothing is
 * fetched, and text set in a font (not outlined) is not drawn — no font is assumed.
 */
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import jpeg from 'jpeg-js'
import { PNG } from 'pngjs'
import { GifReader } from 'omggif'
import webpDecoderFactory from '@jsquash/webp/codec/dec/webp_dec.js'
import { Resvg, initWasm as startResvg } from '@resvg/resvg-wasm'
import type { PixelSize } from '@buildapp/source-common'

export type ImageFormat = 'jpeg' | 'png' | 'gif' | 'webp' | 'bmp' | 'svg'

export type ImageProbe = { format: ImageFormat; size: PixelSize }

const ascii = (b: Uint8Array, at: number, text: string): boolean => {
  for (let i = 0; i < text.length; i++) if (b[at + i] !== text.charCodeAt(i)) return false
  return true
}
const be16 = (b: Uint8Array, at: number): number => (b[at] << 8) | b[at + 1]
const be32 = (b: Uint8Array, at: number): number => ((b[at] << 24) | (b[at + 1] << 16) | (b[at + 2] << 8) | b[at + 3]) >>> 0
const le16 = (b: Uint8Array, at: number): number => b[at] | (b[at + 1] << 8)
const le32 = (b: Uint8Array, at: number): number => (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0

/** Real format and real dimensions, from the encoded bytes. `null` when the bytes are not an image this layer understands. */
export function probeImage(bytes: Uint8Array): ImageProbe | null {
  if (bytes.length < 16) return null

  // PNG: signature, then the IHDR chunk carries width and height as big-endian 32-bit
  if (bytes[0] === 0x89 && ascii(bytes, 1, 'PNG')) {
    if (!ascii(bytes, 12, 'IHDR')) return null
    return { format: 'png', size: { width: be32(bytes, 16), height: be32(bytes, 20) } }
  }

  // GIF: logical screen descriptor, little-endian 16-bit
  if (ascii(bytes, 0, 'GIF87a') || ascii(bytes, 0, 'GIF89a')) {
    return { format: 'gif', size: { width: le16(bytes, 6), height: le16(bytes, 8) } }
  }

  // BMP
  if (ascii(bytes, 0, 'BM') && bytes.length >= 26) {
    return { format: 'bmp', size: { width: le32(bytes, 18), height: Math.abs(le32(bytes, 22) | 0) } }
  }

  // WebP: RIFF container, then VP8 / VP8L / VP8X
  if (ascii(bytes, 0, 'RIFF') && ascii(bytes, 8, 'WEBP')) {
    const chunk = String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]).trim()
    if (chunk === 'VP8X' && bytes.length >= 30) {
      const w = 1 + (bytes[24] | (bytes[25] << 8) | (bytes[26] << 16))
      const h = 1 + (bytes[27] | (bytes[28] << 8) | (bytes[29] << 16))
      return { format: 'webp', size: { width: w, height: h } }
    }
    if (chunk === 'VP8' && bytes.length >= 30) {
      return { format: 'webp', size: { width: le16(bytes, 26) & 0x3fff, height: le16(bytes, 28) & 0x3fff } }
    }
    if (chunk === 'VP8L' && bytes.length >= 25) {
      const b = le32(bytes, 21)
      return { format: 'webp', size: { width: (b & 0x3fff) + 1, height: ((b >> 14) & 0x3fff) + 1 } }
    }
    return null
  }

  // JPEG: walk the markers to the frame header, which is the only place the true size lives.
  // Dimensions from EXIF or from a thumbnail are NOT the image's dimensions, which is one more
  // reason to read the frame rather than trust anything else.
  if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let at = 2
    while (at + 3 < bytes.length) {
      if (bytes[at] !== 0xff) {
        at++
        continue
      }
      // Any number of 0xFF octets may pad the gap before a marker; the
      // marker is the first byte after them that is not itself 0xFF. Reading
      // a pad byte as the marker gives a segment "length" of at least 0xC000
      // and walks the cursor off the end of a perfectly valid file.
      let markerAt = at + 1
      while (markerAt < bytes.length && bytes[markerAt] === 0xff) markerAt++
      if (markerAt >= bytes.length) return null
      at = markerAt - 1
      const marker = bytes[at + 1]
      if (marker === 0x00) {
        // A stuffed 0xFF00 inside entropy-coded data, not a marker at all.
        at += 2
        continue
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        at += 2
        continue
      }
      if (marker === 0xd9) break
      const length = be16(bytes, at + 2)
      if (length < 2) return null
      // SOF0..SOF15, excluding DHT (c4), JPG (c8) and DAC (cc)
      const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc
      if (isFrame) {
        if (at + 9 >= bytes.length) return null
        return { format: 'jpeg', size: { width: be16(bytes, at + 7), height: be16(bytes, at + 5) } }
      }
      at += 2 + length
    }
    return null
  }
  const svg = svgIntrinsicSize(bytes)
  if (svg) return { format: 'svg', size: svgRasterSize(svg.width, svg.height) }

  return null
}

/** An SVG larger than this is not a drawing sheet; it is refused before anything parses it. */
export const SVG_MAX_BYTES = 8 * 1024 * 1024
/** The long side of the raster an SVG is given: its own stated size, kept within what a sheet is read at. */
export const SVG_MIN_LONG_SIDE_PX = 1600
/** An SVG that states a long side under this is an icon or a mark, not a sheet. */
export const SVG_MIN_STATED_LONG_SIDE = 256
export const SVG_MAX_LONG_SIDE_PX = 2400

/** The size an SVG states for itself: `width` × `height` in user units or px, else its `viewBox`. */
export function svgIntrinsicSize(bytes: Uint8Array): PixelSize | null {
  if (bytes.length > SVG_MAX_BYTES) return null
  // the root element is at the top: a declaration, a doctype and comments may precede it, nothing else
  const head = new TextDecoder('utf-8').decode(bytes.subarray(0, 4096)).replace(/^\uFEFF/, '')
  const root = /^\s*(?:<\?xml[^>]*\?>\s*)?(?:<!--[\s\S]*?-->\s*)*(?:<!DOCTYPE[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg\b([^>]*)>/i.exec(head)
  if (!root) return null
  const attr = (name: string): string | undefined => new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([^"']*)["']`, 'i').exec(root[1])?.[1]
  const length = (v: string | undefined): number | undefined => {
    const m = v === undefined ? null : /^\s*(\d+(?:\.\d+)?)\s*(?:px)?\s*$/i.exec(v)
    const n = m ? Number(m[1]) : NaN
    return Number.isFinite(n) && n > 0 ? n : undefined
  }
  let width = length(attr('width'))
  let height = length(attr('height'))
  if (width === undefined || height === undefined) {
    const box = (attr('viewBox') ?? '').trim().split(/[\s,]+/).map(Number)
    if (box.length !== 4 || !box.every(Number.isFinite) || !(box[2] > 0) || !(box[3] > 0)) return null
    width = box[2]
    height = box[3]
  }
  // an icon is drawn at icon size: enlarged to a sheet it is a blur, not a drawing
  if (Math.max(width, height) < SVG_MIN_STATED_LONG_SIDE) return null
  // a sliver or a banner is not a sheet, and its raster would be all margin
  if (Math.max(width, height) / Math.min(width, height) > 8) return null
  return { width, height }
}

/** The raster an SVG of a stated size is given: the same aspect, its long side within the reading range. */
export function svgRasterSize(width: number, height: number): PixelSize {
  const long = Math.max(width, height)
  const scale = Math.min(SVG_MAX_LONG_SIDE_PX, Math.max(SVG_MIN_LONG_SIDE_PX, long)) / long
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

/** An RGBA raster: `data` is width*height*4 bytes, row-major from the top-left. */
export type Raster = { width: number; height: number; data: Uint8ClampedArray }

export class DecodeFailed extends Error {
  constructor(
    readonly code: 'UNSUPPORTED_FORMAT' | 'CORRUPT' | 'SIZE_MISMATCH',
    message: string,
  ) {
    super(message)
    this.name = 'DecodeFailed'
  }
}

/**
 * Decode to RGBA. The decoded raster's size is cross-checked against the probe:
 * if a decoder disagrees with the container header the bytes are not
 * trustworthy and that is reported, never silently preferred one way.
 */
export function decodeImage(bytes: Uint8Array): Raster {
  const probe = probeImage(bytes)
  if (!probe) throw new DecodeFailed('UNSUPPORTED_FORMAT', 'bytes are not a supported image')
  const raster = decodeByFormat(bytes, probe.format)
  if (raster.width !== probe.size.width || raster.height !== probe.size.height) {
    throw new DecodeFailed('SIZE_MISMATCH', `header says ${probe.size.width}x${probe.size.height} but the pixels decode to ${raster.width}x${raster.height}`)
  }
  return raster
}

function decodeByFormat(bytes: Uint8Array, format: ImageFormat): Raster {
  try {
    if (format === 'jpeg') {
      const out = jpeg.decode(bytes, { useTArray: true, formatAsRGBA: true })
      return { width: out.width, height: out.height, data: new Uint8ClampedArray(out.data.buffer, out.data.byteOffset, out.data.byteLength) }
    }
    if (format === 'png') {
      const png = PNG.sync.read(Buffer.from(bytes))
      return { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data.buffer, png.data.byteOffset, png.data.byteLength) }
    }
    if (format === 'webp') {
      const out = webpDecoder().decode(bytes.slice().buffer)
      if (!out) throw new Error('libwebp refused the bitstream')
      return { width: out.width, height: out.height, data: new Uint8ClampedArray(out.data.buffer, out.data.byteOffset, out.data.byteLength) }
    }
    if (format === 'svg') return rasteriseSvg(bytes)
    if (format === 'gif') {
      const reader = new GifReader(Buffer.from(bytes) as unknown as Uint8Array)
      const data = new Uint8ClampedArray(reader.width * reader.height * 4)
      // the first frame only: these are drawings, not animations
      reader.decodeAndBlitFrameRGBA(0, data as unknown as Uint8Array)
      return { width: reader.width, height: reader.height, data }
    }
  } catch (e) {
    throw new DecodeFailed('CORRUPT', `${format} decode failed: ${(e as Error).message}`)
  }
  throw new DecodeFailed('UNSUPPORTED_FORMAT', `no decoder for ${format}`)
}

/**
 * libwebp's own decoder (Squoosh build, `@jsquash/webp`, Apache-2.0), compiled once and instantiated synchronously
 * so `decodeImage` stays a plain function. Its output was checked bit for bit against libwebp (`dwebp`) on lossy,
 * lossless, alpha and odd-sized files; a decoder that differs from the reference by a row would move every
 * measurement taken near a drawing's edge.
 */
/** The file name libwebp's WebAssembly ships under beside a bundle (`apps/local-analyzer/build.mjs` copies and lists it). */
export const WEBP_WASM_FILE = 'webp_dec.wasm'

/**
 * libwebp's WebAssembly. A bundle has no `node_modules` to resolve a package in — the app's embedded runtime runs one
 * file from its private storage — so the copy laid beside the running module is read first; a checkout reads the
 * package's own. (v3.51: the bundle used to resolve the package only, so on the phone every WebP sheet failed to
 * decode and a publisher that serves WebP had no plan.)
 */
function webpWasmBytes(): Uint8Array {
  if (import.meta.url.startsWith('file:')) {
    const beside = fileURLToPath(new URL(`./${WEBP_WASM_FILE}`, import.meta.url))
    if (existsSync(beside)) return readFileSync(beside)
  }
  return readFileSync(createRequire(import.meta.url).resolve('@jsquash/webp/codec/dec/webp_dec.wasm'))
}

type WasmRuntime = { Module: new (bytes: Uint8Array) => object; Instance: new (module: object, imports: object) => { exports: object } }
let webp: { decode(data: ArrayBuffer): { width: number; height: number; data: Uint8ClampedArray } | null } | undefined
function webpDecoder(): NonNullable<typeof webp> {
  if (webp) return webp
  // The project's TypeScript library is plain ES2022 (no DOM); the runtime itself is Node's.
  const { Module, Instance } = (globalThis as unknown as { WebAssembly: WasmRuntime }).WebAssembly
  const wasm = new Module(webpWasmBytes())
  const module: Record<string, unknown> = {
    noInitialRun: true,
    instantiateWasm: (imports: object, ready: (instance: object) => void) => {
      const instance = new Instance(wasm, imports)
      ready(instance)
      return instance.exports
    },
  }
  // Emscripten fills the object it is given; with a synchronous instantiation `decode` is there on return. A failed
  // start rejects the factory's promise as well — that rejection is the same failure the check below throws.
  let failure = ''
  webpDecoderFactory(module).catch((e: unknown) => { failure = String(e) })
  if (typeof module.decode !== 'function') throw new Error(`the WebP decoder did not initialise synchronously ${failure}`.trim())
  webp = module as unknown as NonNullable<typeof webp>
  return webp
}

/** resvg's WebAssembly as `@resvg/resvg-wasm` ships it; beside a bundle under this name (`apps/local-analyzer/build.mjs`). */
export const SVG_WASM_FILE = 'resvg.wasm'

function svgWasmBytes(): Uint8Array {
  if (import.meta.url.startsWith('file:')) {
    const beside = fileURLToPath(new URL(`./${SVG_WASM_FILE}`, import.meta.url))
    if (existsSync(beside)) return readFileSync(beside)
  }
  return readFileSync(createRequire(import.meta.url).resolve('@resvg/resvg-wasm/index_bg.wasm'))
}

let svgStarting: Promise<void> | undefined
let svgState: { ready: boolean; failure?: string } = { ready: false }

/**
 * Start the decoders that cannot start synchronously (resvg's WebAssembly instantiates through a promise). Called
 * once at the top of an acquisition and of an analysis; idempotent. It never rejects: a runtime in which the
 * rasteriser cannot start still reads every raster format, and an SVG there fails to decode with the reason kept.
 */
export function startDecoders(): Promise<void> {
  svgStarting ??= (async () => {
    try {
      const { Module } = (globalThis as unknown as { WebAssembly: WasmRuntime }).WebAssembly
      await startResvg(new Module(svgWasmBytes()) as unknown as Parameters<typeof startResvg>[0])
      svgState = { ready: true }
    } catch (e) {
      svgState = { ready: false, failure: (e as Error).message }
    }
  })()
  return svgStarting
}

function rasteriseSvg(bytes: Uint8Array): Raster {
  if (!svgState.ready) throw new Error(svgState.failure ? `the SVG rasteriser did not start: ${svgState.failure}` : 'the SVG rasteriser has not been started in this process (startDecoders)')
  const intrinsic = svgIntrinsicSize(bytes)
  if (!intrinsic) throw new Error('the SVG states no size')
  const size = svgRasterSize(intrinsic.width, intrinsic.height)
  const resvg = new Resvg(bytes, { fitTo: { mode: 'width', value: size.width }, background: '#ffffff', font: { loadSystemFonts: false } })
  const rendered = resvg.render()
  try {
    // resvg rounds the height its own way; the raster is the probed size exactly, a missing last row left white
    const data = new Uint8ClampedArray(size.width * size.height * 4).fill(255)
    const rows = Math.min(size.height, rendered.height)
    const cols = Math.min(size.width, rendered.width)
    if (Math.abs(rendered.height - size.height) > 2 || rendered.width !== size.width) throw new Error(`rendered ${rendered.width}x${rendered.height}, expected ${size.width}x${size.height}`)
    const pixels = rendered.pixels
    for (let y = 0; y < rows; y += 1) data.set(pixels.subarray(y * rendered.width * 4, y * rendered.width * 4 + cols * 4), y * size.width * 4)
    return { width: size.width, height: size.height, data }
  } finally {
    rendered.free()
    resvg.free()
  }
}

/** Media type implied by the actual bytes, for cross-checking a server's claim. */
export const mediaTypeOfFormat = (format: ImageFormat): string => (format === 'svg' ? 'image/svg+xml' : `image/${format}`)

/** A 1×1 lossless WebP: the smallest file that exercises the decoder end to end. */
const WEBP_PROBE = 'UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA=='

/**
 * Can THIS runtime decode each format that needs more than plain JavaScript? Run where the code actually runs (the
 * bundle on the phone, not the checkout): a decoder that cannot start there is a publisher format silently lost.
 */
export async function decoderSelfCheck(): Promise<{ webp: boolean; svg: boolean; detail?: string }> {
  await startDecoders()
  const details: string[] = []
  const attempt = (bytes: Uint8Array, width: number, height: number): boolean => {
    try {
      const raster = decodeImage(bytes)
      return raster.width === width && raster.height === height
    } catch (e) {
      details.push((e as Error).message)
      return false
    }
  }
  const webp = attempt(Uint8Array.from(Buffer.from(WEBP_PROBE, 'base64')), 1, 1)
  const svg = attempt(new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="1000"><rect width="2000" height="1000" fill="#000"/></svg>'), 2000, 1000)
  return { webp, svg, ...(details.length > 0 ? { detail: details.join('; ') } : {}) }
}
