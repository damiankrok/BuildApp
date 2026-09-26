/**
 * Bundle the local analyzer for the app's embedded Node runtime.
 *
 *   node build.mjs [--out <dir>] [--fixture] [--fixture-out <dir>] [--meta-out <file>]
 *
 * writes into <dir> (default `dist/`):
 *
 *   analyzer.mjs   the production pipeline and the program around it, one
 *                  self-contained ES module (esbuild inlines every workspace
 *                  package, exactly as the analyzer API's bundle does)
 *   main.mjs       the launcher the app starts (runtime/main.mjs, copied)
 *   manifest.json  protocol, runtime target and the sha256 and size of each
 *                  file, which the app checks before it runs them
 *   meta.json      esbuild's metafile: what went in (architecture tests,
 *                  size report); `--meta-out` puts it elsewhere, which is
 *                  how the APK build keeps it out of the app's assets
 *
 * and with `--fixture` also the TEST-ONLY `fixture.mjs` + `fixture-main.mjs`
 * (the in-memory synthetic publisher) beside them, which the desktop parity
 * tests use; `--fixture-out <dir>` writes those two files alone into <dir>,
 * which is how the instrumentation test APK (and only it) gets them.
 *
 * Target node18: the runtime in the APK is nodejs-mobile 18.20.4. Nothing is
 * minified, so the phone runs the same readable code the server does.
 */
import { build } from 'esbuild'
import { createHash } from 'node:crypto'
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export const RUNTIME = { name: 'nodejs-mobile', node: '18.20.4', target: 'node18' }
export const PROTOCOL = 1

const BANNER = "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);"

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

async function bundleOne(entry, outfile, external = []) {
  const result = await build({
    entryPoints: [entry],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: RUNTIME.target,
    sourcemap: false,
    legalComments: 'none',
    metafile: true,
    logLevel: 'warning',
    external,
    // CommonJS dependencies (pngjs, jpeg-js) call require() for Node built-ins
    banner: { js: BANNER },
  })
  return result.metafile
}

/** The TEST-ONLY launcher and publisher: never part of the app's own assets. */
export async function bundleFixture(outdir) {
  outdir = resolve(outdir)
  await mkdir(outdir, { recursive: true })
  // the fixture bundle must NOT carry its own copy of the analyzer: it is only the publisher
  await bundleOne(join(here, 'fixture/fixture.ts'), join(outdir, 'fixture.mjs'))
  await copyFile(join(here, 'fixture/fixture-main.mjs'), join(outdir, 'fixture-main.mjs'))
}

export async function bundleLocalAnalyzer(outdir = join(here, 'dist'), { fixture = false, metaPath } = {}) {
  outdir = resolve(outdir)
  await mkdir(outdir, { recursive: true })
  const meta = await bundleOne(join(here, 'src/analyzer.ts'), join(outdir, 'analyzer.mjs'))
  await copyFile(join(here, 'runtime/main.mjs'), join(outdir, 'main.mjs'))
  const files = {}
  for (const name of ['analyzer.mjs', 'main.mjs']) {
    const bytes = await readFile(join(outdir, name))
    files[name] = { sha256: sha256(bytes), bytes: bytes.length }
  }
  const manifest = { schema: 'buildapp.local-analyzer-runtime', protocol: PROTOCOL, runtime: RUNTIME, entry: 'main.mjs', files }
  await writeFile(join(outdir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  const metaFile = metaPath ? resolve(metaPath) : join(outdir, 'meta.json')
  await mkdir(dirname(metaFile), { recursive: true })
  await writeFile(metaFile, JSON.stringify(meta))
  if (fixture) await bundleFixture(outdir)
  return { manifest, meta }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2)
  const i = argv.indexOf('--out')
  const out = i >= 0 ? argv[i + 1] : join(here, 'dist')
  const m = argv.indexOf('--meta-out')
  const { manifest } = await bundleLocalAnalyzer(out, { fixture: argv.includes('--fixture'), metaPath: m >= 0 ? argv[m + 1] : undefined })
  const f = argv.indexOf('--fixture-out')
  if (f >= 0) await bundleFixture(argv[f + 1])
  const lines = Object.entries(manifest.files).map(([name, info]) => `${name} ${info.bytes} bytes sha256 ${info.sha256}`)
  process.stdout.write(`${lines.join('\n')}\n`)
}
