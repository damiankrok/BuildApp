/**
 * Test fixtures for the source package: bytes synthesised in code, and a
 * network that is not a network.
 *
 * Nothing here reads a file from outside the repository and nothing here opens
 * a socket. Images are ENCODED in the test process, so a test can state "these
 * bytes are 800x600" as a fact rather than as a claim about a checked-in blob,
 * which is exactly the distinction the layer under test exists to enforce. The
 * stub `fetchImpl` records every call, so a test can assert on what was sent as
 * well as on what came back, and the stub `resolve` keeps every SSRF check
 * deterministic without asking a real resolver anything.
 */
import jpeg from 'jpeg-js'
import { PNG } from 'pngjs'
import type { AddressResolver } from '../src/index.js'

// ---------------------------------------------------------------------------
// Synthetic image bytes
// ---------------------------------------------------------------------------

/** A real PNG of exactly `width` x `height`. `seed` varies the pixels so two sizes never share a byte hash. */
export function pngBytes(width: number, height: number, seed = 0): Uint8Array {
  const png = new PNG({ width, height })
  for (let i = 0; i < width * height; i++) {
    png.data[i * 4] = (i * 7 + seed) & 0xff
    png.data[i * 4 + 1] = (i * 13 + seed) & 0xff
    png.data[i * 4 + 2] = (i * 29 + seed) & 0xff
    png.data[i * 4 + 3] = 0xff
  }
  return new Uint8Array(PNG.sync.write(png))
}

/** A real baseline JPEG of exactly `width` x `height`, with the JFIF APP0 segment its encoder emits. */
export function jpegBytes(width: number, height: number, seed = 0): Uint8Array {
  const data = Buffer.alloc(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    data[i * 4] = (i * 5 + seed) & 0xff
    data[i * 4 + 1] = (i * 11 + seed) & 0xff
    data[i * 4 + 2] = (i * 23 + seed) & 0xff
    data[i * 4 + 3] = 0xff
  }
  return new Uint8Array(jpeg.encode({ data, width, height }, 80).data)
}

/**
 * A real GIF89a of exactly `width` x `height`, written by hand.
 *
 * The LZW stream emits a CLEAR before every pixel index, which keeps the code
 * table empty and the code width pinned at 3 bits. That is legal, trivially
 * correct, and avoids depending on an encoder to state what the header says.
 */
export function gifBytes(width: number, height: number): Uint8Array {
  const out: number[] = [
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, // "GIF89a"
    width & 0xff, (width >> 8) & 0xff, // logical screen width, little-endian
    height & 0xff, (height >> 8) & 0xff, // logical screen height, little-endian
    0x80, 0x00, 0x00, // global colour table of 2 entries, background 0, no aspect
    0xff, 0xff, 0xff, 0x00, 0x00, 0x00, // the two colours
    0x2c, 0x00, 0x00, 0x00, 0x00, // image descriptor at (0,0)
    width & 0xff, (width >> 8) & 0xff,
    height & 0xff, (height >> 8) & 0xff,
    0x00, // no local colour table, not interlaced
    0x02, // LZW minimum code size
  ]
  const bits: number[] = []
  const emit = (code: number): void => {
    for (let i = 0; i < 3; i++) bits.push((code >> i) & 1)
  }
  for (let i = 0; i < width * height; i++) {
    emit(4) // CLEAR
    emit(0) // colour index 0
  }
  emit(4)
  emit(5) // END OF INFORMATION
  const packed: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0
    for (let j = 0; j < 8 && i + j < bits.length; j++) b |= bits[i + j] << j
    packed.push(b)
  }
  for (let i = 0; i < packed.length; i += 255) {
    const chunk = packed.slice(i, i + 255)
    out.push(chunk.length, ...chunk)
  }
  out.push(0x00, 0x3b) // block terminator, trailer
  return new Uint8Array(out)
}

/** Splice `block` into `bytes` immediately after the two-byte SOI, so a JPEG gains markers ahead of its frame. */
export function spliceAfterSoi(bytes: Uint8Array, block: readonly number[]): Uint8Array {
  const out = new Uint8Array(bytes.length + block.length)
  out.set(bytes.subarray(0, 2), 0)
  out.set(Uint8Array.from(block), 2)
  out.set(bytes.subarray(2), 2 + block.length)
  return out
}

/** A JPEG `COM` (comment) segment carrying `text`, for putting a marker between the JFIF header and the frame. */
export function jpegComment(text: string): number[] {
  const body = [...Buffer.from(text, 'latin1')]
  const length = body.length + 2
  return [0xff, 0xfe, (length >> 8) & 0xff, length & 0xff, ...body]
}

// ---------------------------------------------------------------------------
// A network that is not a network
// ---------------------------------------------------------------------------

export type StubRoute = {
  bytes?: Uint8Array
  mediaType?: string
  status?: number
  /** For a 3xx: where this hop points next. */
  location?: string
  /** Extra response headers, e.g. a `content-length` that lies about the body. */
  headers?: Record<string, string>
}

export type StubCall = { url: string; init: RequestInit }

export type StubNet = { fetchImpl: typeof fetch; calls: StubCall[] }

/** A `fetchImpl` serving a fixed routing table and recording every request made to it. Anything unrouted is a 404. */
export function stubFetch(routes: Readonly<Record<string, StubRoute>>): StubNet {
  const calls: StubCall[] = []
  const fetchImpl = (async (input: Parameters<typeof fetch>[0], init?: RequestInit): Promise<Response> => {
    const url = String(input)
    calls.push({ url, init: init ?? {} })
    const route = routes[url]
    if (!route) return new Response(null, { status: 404 })
    const status = route.status ?? 200
    const headers: Record<string, string> = { ...(route.headers ?? {}) }
    if (route.location !== undefined) headers.location = route.location
    if (route.mediaType !== undefined) headers['content-type'] = route.mediaType
    if (status >= 300 && status < 400) return new Response(null, { status, headers })
    return new Response(route.bytes ?? new Uint8Array(0), { status, headers })
  }) as unknown as typeof fetch
  return { fetchImpl, calls }
}

/** A `fetchImpl` that fails the test if anything at all asks it for a byte. */
export const forbiddenFetch = (async (input: Parameters<typeof fetch>[0]): Promise<Response> => {
  throw new Error(`the network was used when it must not have been: ${String(input)}`)
}) as unknown as typeof fetch

/** A resolver that puts every name on a publicly routable address. */
export const publicResolver: AddressResolver = async () => ['93.184.216.34']

/** A resolver that puts every name on the loopback interface — the rebind/`localtest.me` shape. */
export const loopbackResolver: AddressResolver = async () => ['127.0.0.1']

// ---------------------------------------------------------------------------
// A synthetic ARCHON project
// ---------------------------------------------------------------------------

/** A project code of the shape the publisher's URLs and asset paths carry. */
export const PROJECT_CODE = 'm1234abcd5678'
export const PAGE_URL = `https://www.archon.pl/projekty-domow/projekt-test-${PROJECT_CODE}`
export const ASSET_BASE = `https://assets.archon.pl/images/products/${PROJECT_CODE}/`

/**
 * An asset address in the publisher's shape: a descriptive slug, a content
 * hash of at least 16 hex characters, and the `__<n>` resolution block.
 */
export const assetUrl = (slug: string, variant: number, hash = '0123456789abcdef0123456789abcdef', ext = 'png'): string => `${ASSET_BASE}${slug}-${hash}__${variant}.${ext}`

/** Wrap markup in the minimum a project page needs for the adapter to identify it. */
export const projectPage = (body: string, title = 'Projekt Test (GE)'): string =>
  `<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta property="og:title" content="${title} - ARCHON+"></head><body>${body}</body></html>`

export const utf8 = (text: string): Uint8Array => new TextEncoder().encode(text)
