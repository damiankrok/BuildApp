/**
 * A PNG encoder, in about a hundred lines and with no dependencies.
 *
 * It exists so a synthetic drawing can become BYTES — real bytes, with a real
 * SHA-256, that a real source package can name and a real decoder can read
 * back. Without that the synthetic fixture would have to be injected halfway
 * down the pipeline, and a fixture that skips the front of the pipeline cannot
 * tell you the pipeline works.
 *
 * Every deflate block is STORED — uncompressed — which is a legal deflate
 * stream that every decoder accepts. Compressing would make the files smaller
 * and the encoder ten times longer, and the point here is bytes that are
 * exactly reproducible, not bytes that are small.
 */
import type { Raster } from '@buildapp/source-cv'

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff
  for (const b of bytes) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function adler32(bytes: Uint8Array): number {
  let a = 1
  let b = 0
  for (const byte of bytes) {
    a = (a + byte) % 65521
    b = (b + a) % 65521
  }
  return ((b << 16) | a) >>> 0
}

const u32 = (value: number): Uint8Array => new Uint8Array([(value >>> 24) & 0xff, (value >>> 16) & 0xff, (value >>> 8) & 0xff, value & 0xff])

function chunk(type: string, data: Uint8Array): Uint8Array {
  const name = new Uint8Array([...type].map((c) => c.charCodeAt(0)))
  const body = new Uint8Array(name.length + data.length)
  body.set(name, 0)
  body.set(data, name.length)
  const out = new Uint8Array(4 + body.length + 4)
  out.set(u32(data.length), 0)
  out.set(body, 4)
  out.set(u32(crc32(body)), 4 + body.length)
  return out
}

/** A zlib stream of stored deflate blocks: a legal stream every decoder reads, and byte-for-byte reproducible. */
function zlibStored(raw: Uint8Array): Uint8Array {
  const blocks: Uint8Array[] = []
  const MAX = 65535
  for (let at = 0; at < raw.length || at === 0; at += MAX) {
    const slice = raw.subarray(at, Math.min(raw.length, at + MAX))
    const last = at + MAX >= raw.length ? 1 : 0
    const header = new Uint8Array(5)
    header[0] = last
    header[1] = slice.length & 0xff
    header[2] = (slice.length >> 8) & 0xff
    header[3] = ~slice.length & 0xff
    header[4] = (~slice.length >> 8) & 0xff
    const block = new Uint8Array(5 + slice.length)
    block.set(header, 0)
    block.set(slice, 5)
    blocks.push(block)
    if (last) break
  }
  const bodyLength = blocks.reduce((a, b) => a + b.length, 0)
  const out = new Uint8Array(2 + bodyLength + 4)
  // 0x78 0x01: deflate, 32k window, no preset dictionary, fastest.
  out[0] = 0x78
  out[1] = 0x01
  let at = 2
  for (const block of blocks) {
    out.set(block, at)
    at += block.length
  }
  out.set(u32(adler32(raw)), at)
  return out
}

/** A raster as 8-bit RGB PNG bytes. Deterministic: the same raster always encodes to the same bytes. */
export function encodePng(raster: Raster): Uint8Array {
  const { width, height, data } = raster
  const raw = new Uint8Array(height * (1 + width * 3))
  for (let y = 0; y < height; y += 1) {
    const row = y * (1 + width * 3)
    raw[row] = 0 // filter: none
    for (let x = 0; x < width; x += 1) {
      const src = (y * width + x) * 4
      const dst = row + 1 + x * 3
      raw[dst] = data[src]
      raw[dst + 1] = data[src + 1]
      raw[dst + 2] = data[src + 2]
    }
  }
  const ihdr = new Uint8Array(13)
  ihdr.set(u32(width), 0)
  ihdr.set(u32(height), 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 2 // colour type: truecolour
  const parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk('IHDR', ihdr), chunk('IDAT', zlibStored(raw)), chunk('IEND', new Uint8Array(0))]
  const total = parts.reduce((a, b) => a + b.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const part of parts) {
    out.set(part, at)
    at += part.length
  }
  return out
}
