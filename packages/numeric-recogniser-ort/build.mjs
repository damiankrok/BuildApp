/**
 * Bundle the recogniser's worker and lay out its runtime files, for the local analyzer (the APK) and the tests.
 *
 *   ocr-worker.mjs                   the worker (src/worker.ts) with ONNX Runtime Web's JS and the decoder inlined
 *   ort-wasm-simd-threaded.wasm      ONNX Runtime Web's WebAssembly binary, verified against the manifest
 *   ort-wasm-simd-threaded.mjs       its loader, verified
 *   models/PP-OCRv6_tiny_rec.onnx    the model, verified (fetch it first: tools/fetch-model.mjs)
 *   models/PP-OCRv6_tiny_rec.dict.json
 *
 * Nothing here downloads anything: a file that is missing or does not match its pin fails the build.
 */
import { build } from 'esbuild'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, rename } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const require = createRequire(import.meta.url)
export const MANIFEST = JSON.parse(await readFile(join(here, 'models', 'manifest.json'), 'utf8'))
const MODEL = MANIFEST.models[MANIFEST.default]

export const WORKER_FILE = 'ocr-worker.mjs'
const BANNER = "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);"
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

/**
 * The worker as one ES module for Node 18 (the phone's runtime). Returns esbuild's metafile. Written beside the target
 * and renamed onto it, so a run starting a worker from the same path never reads a half-written file.
 */
export async function bundleRecogniserWorker(outfile) {
  const target = resolve(outfile)
  const partial = `${target}.${process.pid}.${Date.now()}.partial.mjs`
  const result = await build({
    entryPoints: [join(here, 'src', 'worker.ts')],
    outfile: partial,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node18',
    sourcemap: false,
    legalComments: 'none',
    metafile: true,
    logLevel: 'warning',
    banner: { js: BANNER },
  })
  await rename(partial, target)
  return result.metafile
}

/** The runtime files and the model, verified against the manifest, as `{ published path: source path }`. */
export function recogniserAssetSources() {
  return {
    'ort-wasm-simd-threaded.wasm': { from: require.resolve('onnxruntime-web/ort-wasm-simd-threaded.wasm'), pin: MANIFEST.runtime.files['ort-wasm-simd-threaded.wasm'] },
    'ort-wasm-simd-threaded.mjs': { from: require.resolve('onnxruntime-web/ort-wasm-simd-threaded.mjs'), pin: MANIFEST.runtime.files['ort-wasm-simd-threaded.mjs'] },
    [`models/${MODEL.file}`]: { from: join(here, 'models', MODEL.file), pin: { sha256: MODEL.sha256, bytes: MODEL.bytes } },
    [`models/${MODEL.dictionary.file}`]: { from: join(here, 'models', MODEL.dictionary.file), pin: { sha256: MODEL.dictionary.sha256 } },
  }
}

/** Copy the verified runtime and model into `outdir`; refuses any file that is not its pinned bytes. */
export async function layOutRecogniserAssets(outdir) {
  outdir = resolve(outdir)
  const files = {}
  for (const [name, { from, pin }] of Object.entries(recogniserAssetSources())) {
    let bytes
    try {
      bytes = await readFile(from)
    } catch {
      throw new Error(`${name}: ${from} is missing (run node packages/numeric-recogniser-ort/tools/fetch-model.mjs)`)
    }
    const sha = sha256(bytes)
    if (sha !== pin.sha256 || (pin.bytes !== undefined && bytes.length !== pin.bytes)) throw new Error(`${name}: SHA-256 ${sha} (${bytes.length} B), pinned ${pin.sha256} — refused`)
    await mkdir(dirname(join(outdir, name)), { recursive: true })
    await copyFile(from, join(outdir, name))
    files[name] = { sha256: sha, bytes: bytes.length }
  }
  return files
}
