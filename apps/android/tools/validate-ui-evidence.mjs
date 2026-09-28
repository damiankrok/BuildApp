#!/usr/bin/env node
// INTEGRATION-003C: the UI evidence gate fails when a required screenshot is
// missing or is not a real picture of the screen.
//
//   node validate-ui-evidence.mjs --dir <ui-evidence> --size 1080x2400 \
//        --require default:journey font-1.3:journey landscape:adaptive slice-marcowki:slice --out validation.json
//
// For every required capture (and every capture a manifest lists) the PNG
// must exist, be non-empty, decode (signature, chunk CRCs, IHDR, the inflated
// image data has exactly the length its header implies) and have the screen's
// size (either orientation). No dependencies: zlib and a CRC table.
import { readFileSync, existsSync, writeFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { inflateSync } from 'node:zlib'

const REQUIRED = {
  journey: [
    '01-dom-unset', '02-dom-to-3d-unset', '03-etapy-unset', '04-etapy-current-editing', '05-dom-progress',
    '06-3d-now', '07-3d-history-foundations', '08-3d-history-walls', '09-3d-history-roof', '10-3d-history-joinery',
    '11-3d-back-to-now', '12-3d-inspector', '13-3d-timeline-expanded', '14-3d-second-entry', '15-analyzer',
    '16-koszty', '17-dokumenty', '18-back-to-dom',
  ],
  slice: [
    '01-analyzing', '02-3d-after-analysis', '03-dom-result', '04-analyzer-result', '05-etapy-current',
    '06-3d-now', '07-3d-history-walls', '08-3d-history-pre-joinery', '09-3d-history-joinery',
    '10-3d-clay-history-walls', '11-3d-inspector', '12-3d-again',
  ],
  adaptive: ['01-dom', '02-3d-now', '03-3d-history-walls', '04-etapy'],
}

const args = process.argv.slice(2)
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
const dir = opt('--dir')
const size = opt('--size')
const out = opt('--out')
const reqStart = args.indexOf('--require')
const requires = []
if (reqStart >= 0) for (const a of args.slice(reqStart + 1)) { if (a.startsWith('--')) break; requires.push(a) }
if (!dir) { console.error('--dir is required'); process.exit(2) }
const [sw, sh] = (size ?? '').split('x').map(Number)

const CRC = new Uint32Array(256).map((_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0 })
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0 }

function decode(file) {
  const bytes = readFileSync(file)
  if (bytes.length === 0) throw new Error('empty file')
  const sig = [137, 80, 78, 71, 13, 10, 26, 10]
  if (!sig.every((b, i) => bytes[i] === b)) throw new Error('not a PNG signature')
  let at = 8, ihdr = null
  const idat = []
  while (at < bytes.length) {
    if (at + 12 > bytes.length) throw new Error('truncated')
    const len = bytes.readUInt32BE(at)
    if (at + 12 + len > bytes.length) throw new Error('truncated')
    const type = bytes.toString('latin1', at + 4, at + 8)
    const data = bytes.subarray(at + 8, at + 8 + len)
    const crc = bytes.readUInt32BE(at + 8 + len)
    if (crc32(bytes.subarray(at + 4, at + 8 + len)) !== crc) throw new Error(`bad CRC in ${type}`)
    if (type === 'IHDR') ihdr = { width: data.readUInt32BE(0), height: data.readUInt32BE(4), depth: data[8], colour: data[9], interlace: data[12] }
    if (type === 'IDAT') idat.push(data)
    at += 12 + len
    if (type === 'IEND') break
  }
  if (!ihdr) throw new Error('no IHDR')
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[ihdr.colour]
  if (!channels) throw new Error(`unknown colour type ${ihdr.colour}`)
  const raw = inflateSync(Buffer.concat(idat))
  if (ihdr.interlace === 0) {
    const expected = ihdr.height * (1 + Math.ceil((ihdr.width * channels * ihdr.depth) / 8))
    if (raw.length !== expected) throw new Error(`image data is ${raw.length} bytes, header implies ${expected}`)
  }
  return { width: ihdr.width, height: ihdr.height, bytes: bytes.length }
}

const results = []
let failed = 0
const checked = new Set()
function check(file, required) {
  if (checked.has(file)) return
  checked.add(file)
  const path = join(dir, file)
  const r = { file, required }
  if (!existsSync(path)) { r.error = 'missing' } else {
    try {
      Object.assign(r, decode(path))
      if (sw && sh && !((r.width === sw && r.height === sh) || (r.width === sh && r.height === sw))) r.error = `size ${r.width}x${r.height}, screen ${sw}x${sh}`
    } catch (e) { r.error = e.message }
  }
  if (r.error && required) failed++
  results.push(r)
}

for (const spec of requires) {
  const [prefix, kind] = spec.split(':')
  for (const name of REQUIRED[kind] ?? []) check(`${prefix}-${name}.png`, true)
}
// Every capture a manifest lists must be valid too (an optional one only warns).
if (existsSync(dir)) {
  for (const m of readdirSync(dir).filter((f) => f.endsWith('-manifest.json'))) {
    const manifest = JSON.parse(readFileSync(join(dir, m), 'utf8'))
    for (const c of manifest.captures ?? []) check(c.file, false)
  }
}

const summary = { dir, size, requires, checked: results.length, failed, results }
if (out) writeFileSync(out, JSON.stringify(summary, null, 2) + '\n')
for (const r of results) console.log(`${r.error ? (r.required ? 'FAIL' : 'warn') : 'ok  '} ${r.file}${r.error ? ` — ${r.error}` : ` ${r.width}x${r.height} ${r.bytes} B`}`)
console.log(failed ? `UI evidence: ${failed} required screenshot(s) missing or invalid` : `UI evidence: all ${results.filter((r) => r.required).length} required screenshots valid`)
process.exit(failed ? 1 : 0)
