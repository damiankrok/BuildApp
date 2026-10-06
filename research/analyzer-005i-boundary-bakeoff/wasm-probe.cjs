/**
 * wasm-probe.cjs — RESEARCH ONLY (BUILDPLAN-ANALYZER-005I Track B). Deployment feasibility, not integration.
 *
 *   <node18>/bin/node research/analyzer-005i-boundary-bakeoff/wasm-probe.cjs --ort <path to onnxruntime-web package> \
 *       --onnx-dir /home/user/work005i/onnx --out <json>
 *
 * Loads the ONNX graphs exported by providers/onnx_export.py into onnxruntime-web (WebAssembly SIMD, ONE thread —
 * the 005H route the phone already uses for the numeric recogniser) under the phone's Node line (18.20.4), runs one
 * inference on a real frame's input, and records load time, inference time, peak RSS and the max abs difference
 * against PyTorch's output on the same input. Nothing here is shipped or integrated.
 */
const fs = require('node:fs')
const path = require('node:path')

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : undefined
}

function readNpy(file) {
  const b = fs.readFileSync(file)
  const hlen = b.readUInt16LE(8)
  const header = b.subarray(10, 10 + hlen).toString('latin1')
  const shape = header.match(/'shape': \(([^)]*)\)/)[1].split(',').map((s) => s.trim()).filter(Boolean).map(Number)
  if (!/'descr': '<f4'/.test(header)) throw new Error(`unsupported dtype in ${file}: ${header}`)
  const data = new Float32Array(b.buffer.slice(b.byteOffset + 10 + hlen, b.byteOffset + b.length))
  return { shape, data }
}

async function main() {
  const ort = require(arg('ort'))
  ort.env.wasm.numThreads = 1
  ort.env.wasm.simd = true
  const dir = arg('onnx-dir')
  const out = { node: process.version, runtime: `onnxruntime-web@${JSON.parse(fs.readFileSync(path.join(arg('ort'), 'package.json'), 'utf8')).version}`, threads: 1, models: {} }
  let peak = process.memoryUsage.rss()
  const tick = setInterval(() => (peak = Math.max(peak, process.memoryUsage.rss())), 20)
  const only = arg('only')
  const run = async (name, file, feeds, compare) => {
    if (only && only !== name) return
    const rss0 = process.memoryUsage.rss()
    const t0 = performance.now()
    const session = await ort.InferenceSession.create(new Uint8Array(fs.readFileSync(path.join(dir, file))), { executionProviders: ['wasm'], graphOptimizationLevel: 'all' })
    const loadMs = performance.now() - t0
    const t1 = performance.now()
    const res = await session.run(feeds)
    const inferMs = performance.now() - t1
    let maxAbs = null
    if (compare) {
      const ref = readNpy(path.join(dir, compare.npy))
      const got = res[compare.output].data
      maxAbs = 0
      for (let i = 0; i < ref.data.length; i += 1) maxAbs = Math.max(maxAbs, Math.abs(ref.data[i] - got[i]))
    }
    peak = Math.max(peak, process.memoryUsage.rss())
    out.models[name] = { file, bytes: fs.statSync(path.join(dir, file)).size, loadMs: Math.round(loadMs), inferMs: Math.round(inferMs), rssBeforeMiB: Math.round(rss0 / 2 ** 20), rssAfterMiB: Math.round(process.memoryUsage.rss() / 2 ** 20), maxAbsDiffVsTorch: maxAbs }
    await session.release()
    console.log(name, JSON.stringify(out.models[name]))
  }
  if (!only || only === 'deeplsd_md_fields') {
    const dl = readNpy(path.join(dir, 'deeplsd_input.npy'))
    await run('deeplsd_md_fields', 'deeplsd_md_fields.onnx', { image: new ort.Tensor('float32', dl.data, [1, 1, ...dl.shape]) }, { npy: 'deeplsd_df_torch.npy', output: 'df' })
  }
  if (!only || only === 'mobile_sam_encoder') {
    const ms = readNpy(path.join(dir, 'msam_input.npy'))
    await run('mobile_sam_encoder', 'mobile_sam_encoder.onnx', { image: new ort.Tensor('float32', ms.data, [1, ...ms.shape]) }, { npy: 'msam_embedding_torch.npy', output: 'embedding' })
  }
  const emb = readNpy(path.join(dir, 'msam_embedding_torch.npy'))
  await run('mobile_sam_decoder', 'mobile_sam_decoder.onnx', {
    image_embeddings: new ort.Tensor('float32', emb.data, [1, 256, 64, 64]),
    point_coords: new ort.Tensor('float32', new Float32Array([200, 200, 800, 900]), [1, 2, 2]),
    point_labels: new ort.Tensor('float32', new Float32Array([2, 3]), [1, 2]),
    mask_input: new ort.Tensor('float32', new Float32Array(256 * 256), [1, 1, 256, 256]),
    has_mask_input: new ort.Tensor('float32', new Float32Array([0]), [1]),
    orig_im_size: new ort.Tensor('float32', new Float32Array([853, 853]), [2]),
  })
  clearInterval(tick)
  out.peakRssMiB = Math.round(peak / 2 ** 20)
  fs.writeFileSync(arg('out'), JSON.stringify(out, null, 1))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
