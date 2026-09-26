/**
 * Bundle the service into two self-contained ES modules:
 *
 *   dist/server.mjs  the HTTP server
 *   dist/worker.mjs  one job's worker thread
 *
 * Every workspace package is TypeScript source; esbuild compiles and inlines
 * it, so the runtime image needs Node and these two files, nothing else. The
 * metafile is kept (dist/meta.json) so a test can prove what went in — and
 * what did not: no reference model, no benchmark, no sealed candidate.
 */
import { build } from 'esbuild'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))

export async function bundle(outdir = join(here, 'dist'), entries = { server: join(here, 'src/main.ts'), worker: join(here, 'src/worker.ts') }) {
  await mkdir(outdir, { recursive: true })
  const result = await build({
    entryPoints: entries,
    outdir,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node22',
    outExtension: { '.js': '.mjs' },
    sourcemap: false,
    legalComments: 'none',
    metafile: true,
    logLevel: 'warning',
    // CommonJS dependencies (pngjs, jpeg-js) call require() for Node built-ins
    banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  })
  await writeFile(join(outdir, 'meta.json'), JSON.stringify(result.metafile))
  return result.metafile
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const meta = await bundle()
  const outputs = Object.entries(meta.outputs).map(([file, o]) => `${file} ${(o.bytes / 1024).toFixed(0)} KiB`)
  process.stdout.write(`${outputs.join('\n')}\n`)
}
