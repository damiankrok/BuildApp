/**
 * wasm-probe.cjs — RESEARCH ONLY (BUILDPLAN-ANALYZER-005J). Deployment feasibility, not integration.
 *
 *   <node18>/bin/node research/analyzer-005j/wasm-probe.cjs --ort <onnxruntime-web package dir> --spec <spec.json> --out <json>
 *
 * Runs ONNX graphs in onnxruntime-web (WebAssembly SIMD, ONE thread — the route the phone already uses for the 005H
 * numeric recogniser) under the phone's Node line (18.20.4), with deterministic synthetic inputs of the shapes the
 * model takes. Records load time, the median and p95 of `runs` inferences, RSS before/after and an output hash. Inputs
 * are synthetic because only time and memory are measured here; quality is measured elsewhere (Python, same graphs).
 *
 * Memory caveat (as 005I D8): RSS is sampled on the event loop, which a single-threaded WASM inference blocks; the
 * reported RSS after inference is a LOWER BOUND on the peak.
 *
 * spec.json: { "models": [ { "name", "file", "runs", "inputs": [ { "name", "type": "float32"|"int64"|"bool", "shape": [..], "fill": "ramp"|"zeros"|"ones" } ] } ] }
 */
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function tensorOf(ort, inp) {
  const n = inp.shape.reduce((a, b) => a * b, 1)
  if (inp.type === 'int64') {
    const d = new BigInt64Array(n)
    for (let i = 0; i < n; i += 1) d[i] = inp.fill === 'ones' ? 1n : inp.fill === 'ramp' ? BigInt((i % 1000) + 1) : 0n
    return new ort.Tensor('int64', d, inp.shape)
  }
  if (inp.type === 'bool') {
    const d = new Uint8Array(n).fill(inp.fill === 'zeros' ? 0 : 1)
    return new ort.Tensor('bool', d, inp.shape)
  }
  const d = new Float32Array(n)
  for (let i = 0; i < n; i += 1) d[i] = inp.fill === 'ones' ? 1 : inp.fill === 'zeros' ? 0 : ((i * 2654435761) % 1000) / 1000
  return new ort.Tensor('float32', d, inp.shape)
}

async function main() {
  const ortDir = arg('ort')
  const ort = require(ortDir)
  ort.env.wasm.numThreads = 1
  ort.env.wasm.simd = true
  const spec = JSON.parse(fs.readFileSync(arg('spec'), 'utf8'))
  const out = { node: process.version, arch: process.arch, runtime: `onnxruntime-web@${JSON.parse(fs.readFileSync(path.join(ortDir, 'package.json'), 'utf8')).version}`, threads: 1, models: {} }
  for (const m of spec.models) {
    if (arg('only') && arg('only') !== m.name) continue
    const rss0 = process.memoryUsage.rss()
    const bytes = fs.readFileSync(m.file)
    const t0 = performance.now()
    let session
    try {
      session = await ort.InferenceSession.create(new Uint8Array(bytes), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' })
    } catch (e) {
      out.models[m.name] = { file: path.basename(m.file), bytes: bytes.length, error: String(e.message || e).slice(0, 300) }
      console.log(m.name, JSON.stringify(out.models[m.name]))
      continue
    }
    const loadMs = performance.now() - t0
    const feeds = {}
    for (const inp of m.inputs) feeds[inp.name] = tensorOf(ort, inp)
    const times = []
    let hash = null
    try {
      for (let r = 0; r < (m.runs || 3); r += 1) {
        const t1 = performance.now()
        const res = await session.run(feeds)
        times.push(performance.now() - t1)
        if (r === 0) {
          const first = res[session.outputNames[0]]
          hash = crypto.createHash('sha256').update(Buffer.from(first.data.buffer, first.data.byteOffset, first.data.byteLength)).digest('hex').slice(0, 16)
        }
      }
    } catch (e) {
      out.models[m.name] = { file: path.basename(m.file), bytes: bytes.length, loadMs: Math.round(loadMs), error: String(e.message || e).slice(0, 300) }
      console.log(m.name, JSON.stringify(out.models[m.name]))
      await session.release()
      continue
    }
    times.sort((a, b) => a - b)
    out.models[m.name] = { file: path.basename(m.file), bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex'), loadMs: Math.round(loadMs),
      runs: times.length, medianMs: Math.round(times[Math.floor(times.length / 2)]), p95Ms: Math.round(times[Math.min(times.length - 1, Math.floor(times.length * 0.95))]),
      rssBeforeMiB: Math.round(rss0 / 2 ** 20), rssAfterMiB: Math.round(process.memoryUsage.rss() / 2 ** 20), firstOutputSha256_16: hash, inputs: m.inputs.map((i) => ({ name: i.name, shape: i.shape })) }
    console.log(m.name, JSON.stringify(out.models[m.name]))
    await session.release()
  }
  fs.writeFileSync(arg('out'), JSON.stringify(out, null, 1))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
