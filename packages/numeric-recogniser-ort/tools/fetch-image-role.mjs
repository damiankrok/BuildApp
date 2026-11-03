#!/usr/bin/env node
/**
 * SOURCE-01: build the image-content encoder from its pinned upstream weights. No weight is committed: the repository
 * holds only the graph's structure (`models/image-role-spec.json` — operators, names, shapes, and which upstream
 * tensors make each initializer). This tool
 *
 *   1. fetches timm's `model.safetensors` at the pinned revision (or reads `--from <file>`), refused unless its SHA-256
 *      is the pin in `models/image-role.json`;
 *   2. folds each BatchNorm into the convolution before it, in float32 (Math.fround at every step, so the bytes are the
 *      same on every machine);
 *   3. writes the ONNX graph (opset 17) the spec describes, and refuses the result unless its SHA-256 is the pinned
 *      `sha256` the analyzer verifies before every load.
 *
 *   node packages/numeric-recogniser-ort/tools/fetch-image-role.mjs [--from <model.safetensors>] [--print-sha]
 */
import { createHash } from 'node:crypto'
import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const models = join(here, '..', 'models')
const MANIFEST = JSON.parse(readFileSync(join(models, 'image-role.json'), 'utf8'))
const SPEC = JSON.parse(readFileSync(join(models, 'image-role-spec.json'), 'utf8'))
const sha256 = (b) => createHash('sha256').update(b).digest('hex')
const argv = process.argv.slice(2)
const value = (n) => (argv.includes(`--${n}`) ? argv[argv.indexOf(`--${n}`) + 1] : undefined)

// ---- 1. the upstream weights ----------------------------------------------
async function upstream() {
  const u = MANIFEST.upstream
  let bytes
  if (value('from')) bytes = new Uint8Array(readFileSync(value('from')))
  else {
    const url = `https://${u.host}/${u.repo}/resolve/${u.revision}/${u.file}`
    const r = await fetch(url)
    if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`)
    bytes = new Uint8Array(await r.arrayBuffer())
  }
  const got = sha256(bytes)
  if (got !== u.sha256) throw new Error(`upstream ${u.file}: SHA-256 ${got}, pinned ${u.sha256} — refused`)
  return bytes
}

function safetensors(bytes) {
  const n = Number(new DataView(bytes.buffer, bytes.byteOffset, 8).getBigUint64(0, true))
  const header = JSON.parse(Buffer.from(bytes.subarray(8, 8 + n)).toString('utf8'))
  const base = 8 + n
  const tensors = new Map()
  for (const [name, t] of Object.entries(header)) {
    if (name === '__metadata__') continue
    if (t.dtype !== 'F32') continue // BatchNorm's num_batches_tracked (I64) is not a weight
    const [a, b] = t.data_offsets
    const copy = bytes.slice(base + a, base + b)
    tensors.set(name, { shape: t.shape, data: new Float32Array(copy.buffer, copy.byteOffset, (b - a) / 4) })
  }
  return tensors
}

// ---- 2. BatchNorm folded into each convolution, in float32 -----------------
function folded(tensors, from) {
  const f = Math.fround
  const get = (k) => {
    const t = tensors.get(k)
    if (!t) throw new Error(`upstream tensor ${k} is missing`)
    return t.data
  }
  const w = get(`${from.conv}.weight`)
  const out = w.length / tensors.get(`${from.conv}.weight`).shape.slice(1).reduce((a, b) => a * b, 1)
  const per = w.length / out
  const bias = tensors.has(`${from.conv}.bias`) ? get(`${from.conv}.bias`) : new Float32Array(out)
  const scale = new Float32Array(out)
  const shift = new Float32Array(out)
  if (from.bn) {
    const g = get(`${from.bn}.weight`), be = get(`${from.bn}.bias`), mu = get(`${from.bn}.running_mean`), v = get(`${from.bn}.running_var`)
    for (let c = 0; c < out; c += 1) {
      scale[c] = f(g[c] / f(Math.sqrt(f(v[c] + f(from.eps)))))
      shift[c] = f(f(f(bias[c] - mu[c]) * scale[c]) + be[c])
    }
  } else for (let c = 0; c < out; c += 1) (scale[c] = 1), (shift[c] = bias[c])
  if (from.kind === 'bias') return shift
  const r = new Float32Array(w.length)
  for (let c = 0; c < out; c += 1) for (let k = 0; k < per; k += 1) r[c * per + k] = f(w[c * per + k] * scale[c])
  return r
}

// ---- 3. the ONNX protobuf ---------------------------------------------------
const varint = (n) => {
  const out = []
  let v = BigInt(n)
  if (v < 0n) v += 1n << 64n
  do {
    let b = Number(v & 0x7fn)
    v >>= 7n
    if (v > 0n) b |= 0x80
    out.push(b)
  } while (v > 0n)
  return out
}
const key = (field, wire) => varint((field << 3) | wire)
const bytesField = (field, data) => [...key(field, 2), ...varint(data.length), ...data]
const str = (field, s) => bytesField(field, [...Buffer.from(s, 'utf8')])
const int = (field, n) => [...key(field, 0), ...varint(n)]
const msg = (field, parts) => bytesField(field, parts)
const packed = (field, ns) => bytesField(field, ns.flatMap((n) => varint(n)))
const float32 = (field, x) => {
  const b = Buffer.alloc(4)
  b.writeFloatLE(x)
  return [...key(field, 5), ...b]
}
function attribute(a) {
  if ('i' in a) return [...str(1, a.name), ...int(3, a.i), ...int(20, 2)]
  if ('ints' in a) return [...str(1, a.name), ...packed(8, a.ints), ...int(20, 7)]
  if ('f' in a) return [...str(1, a.name), ...float32(2, a.f), ...int(20, 1)]
  throw new Error(`attribute ${a.name}`)
}
const valueInfo = (v) => [...str(1, v.name), ...msg(2, msg(1, [...int(1, 1), ...msg(2, v.dims.flatMap((d) => msg(1, int(1, d))))]))]

function onnx(tensors) {
  const chunks = []
  const push = (a) => chunks.push(Buffer.from(a))
  const graph = []
  const flush = () => {
    chunks.push(Buffer.from(graph.splice(0)))
  }
  for (const n of SPEC.nodes) graph.push(...msg(1, [...n.inputs.flatMap((i) => str(1, i)), ...n.outputs.flatMap((o) => str(2, o)), ...str(3, n.name), ...str(4, n.op), ...n.attributes.flatMap((a) => msg(5, attribute(a)))]))
  graph.push(...str(2, 'main_graph'))
  flush()
  for (const init of SPEC.initializers) {
    const data = folded(tensors, init.from)
    const expected = init.dims.reduce((a, b) => a * b, 1)
    if (data.length !== expected) throw new Error(`${init.name}: ${data.length} values, the spec says ${expected}`)
    const raw = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
    const head = Buffer.from([...packed(1, init.dims), ...int(2, 1), ...str(8, init.name), ...key(9, 2), ...varint(raw.length)])
    const body = Buffer.concat([head, raw])
    chunks.push(Buffer.from([...key(5, 2), ...varint(body.length)]), body)
  }
  for (const v of SPEC.inputs) graph.push(...msg(11, valueInfo(v)))
  for (const v of SPEC.outputs) graph.push(...msg(12, valueInfo(v)))
  flush()
  const graphBytes = Buffer.concat(chunks)
  const model = Buffer.concat([Buffer.from([...int(1, SPEC.irVersion), ...str(2, 'buildapp.fetch-image-role'), ...msg(8, [...str(1, ''), ...int(2, SPEC.opset)])]), Buffer.from([...key(7, 2), ...varint(graphBytes.length)]), graphBytes])
  return new Uint8Array(model)
}

const weights = safetensors(await upstream())
const model = onnx(weights)
const got = sha256(model)
if (argv.includes('--print-sha')) console.log(`${got} ${model.length}`)
const target = join(models, MANIFEST.file)
if (got !== MANIFEST.sha256 || model.length !== MANIFEST.bytes) {
  if (!argv.includes('--print-sha')) throw new Error(`built ${MANIFEST.file}: SHA-256 ${got} (${model.length} B), pinned ${MANIFEST.sha256} (${MANIFEST.bytes} B) — refused`)
} else {
  if (existsSync(target) && sha256(readFileSync(target)) === got) console.log(`already present: ${MANIFEST.file}`)
  else {
    writeFileSync(`${target}.partial`, model)
    renameSync(`${target}.partial`, target)
    console.log(`built ${MANIFEST.file} ${model.length} B sha256 ${got}`)
  }
}
