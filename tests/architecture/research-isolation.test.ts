/**
 * BUILDPLAN-ANALYZER-005I §42 — the boundary bake-off is research, and production cannot reach it.
 *
 * Track B ran DeepLSD, ELSED and MobileSAM beside BuildPlan's own source-cv under
 * `research/analyzer-005i-boundary-bakeoff/`, with Python, PyTorch and OpenCV in a virtual environment outside the
 * repository. None of it may become a production dependency by accident:
 *
 *  - no production source (packages' and apps' `src` and `scripts`, the apps' bundler configs, the Android app's Kotlin
 *    and Gradle) imports or names anything
 *    under `research/`, or names DeepLSD, ELSED, MobileSAM / Segment Anything, PyTorch or a Python runtime in code;
 *  - `research/` is no npm workspace, and neither the type check nor the test runner collects it;
 *  - the repository tracks no model checkpoint (`.pt`, `.pth`, `.ckpt`, `.safetensors`) anywhere, and the research
 *    harness tracks no binary at all — its checkpoints are pinned by SHA-256 and fetched outside the repository;
 *  - the Android build declares no Python, PyTorch or OpenCV dependency and packages no research asset.
 *
 * With the harness present and not invoked, the production analyzer is the same code: nothing it imports changed for
 * Track B (`git diff` of Track B touches only `research/` and `stage-reports/`), which the matrix rows' hashes show.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { execFileSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(import.meta.dirname, '../..')
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8')
const codeOf = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 ')
const importsOf = (source: string): string[] => [...source.matchAll(/(?:^\s*(?:import|export)[^'"]*?from\s+|import\(\s*|require\(\s*)['"]([^'"]+)['"]/gm)].map((m) => m[1])

function filesUnder(dir: string, ext: RegExp): string[] {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return []
  const out: string[] = []
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      if (['node_modules', 'dist', 'build', '.gradle', '.cxx', 'third_party'].includes(name)) continue
      const p = join(d, name)
      if (statSync(p).isDirectory()) walk(p)
      else if (ext.test(name)) out.push(relative(ROOT, p))
    }
  }
  walk(abs)
  return out.sort()
}

const productionSources = (): string[] => [
  ...readdirSync(join(ROOT, 'packages')).flatMap((p) => filesUnder(`packages/${p}/src`, /\.(ts|tsx|mjs|js)$/)),
  ...readdirSync(join(ROOT, 'apps')).flatMap((a) => filesUnder(`apps/${a}/src`, /\.(ts|tsx|mjs|js)$/)),
  // post-review E8: the runners too — the blind round runs `packages/analysis-service/scripts/second-house.ts`, and a
  // bundler config under an app's scripts could alias research in.
  ...readdirSync(join(ROOT, 'packages')).flatMap((p) => filesUnder(`packages/${p}/scripts`, /\.(ts|tsx|mjs|js|cjs)$/)),
  ...readdirSync(join(ROOT, 'apps')).flatMap((a) => filesUnder(`apps/${a}/scripts`, /\.(ts|tsx|mjs|js|cjs)$/)),
  ...readdirSync(join(ROOT, 'apps')).flatMap((a) => filesUnder(`apps/${a}`, /^(vite|vitest|rollup|esbuild|webpack)\.config\.(ts|mjs|js|cjs)$/)),
  ...filesUnder('apps/android/app/src/main', /\.(kt|java)$/),
  ...filesUnder('apps/android', /\.gradle\.kts$/),
]

/** What the research harness runs, by name, in code (comments removed). */
const RESEARCH_PROVIDER = /deeplsd|\belsed\b|mobile_?sam|segment[-_ ]?anything|\btorch\b|pytorch|\bcv2\b|import\s+numpy|python3?\b/i

describe('§42 production cannot reach the boundary bake-off', () => {
  it('no production source imports or names anything under research/', () => {
    const offenders: string[] = []
    for (const f of productionSources()) {
      const text = read(f)
      for (const spec of importsOf(text)) if (/(^|\/)research\//.test(spec) || /boundary-bakeoff/.test(spec)) offenders.push(`${f} imports ${spec}`)
      if (/research\/analyzer-005i|boundary-bakeoff/.test(codeOf(text))) offenders.push(`${f} names the bake-off`)
    }
    expect(offenders).toEqual([])
  })

  it('no production source names DeepLSD, ELSED, MobileSAM, PyTorch, OpenCV-for-Python or a Python runtime in code', () => {
    const offenders = productionSources().filter((f) => RESEARCH_PROVIDER.test(codeOf(read(f))))
    expect(offenders).toEqual([])
  })

  it('research/ is no workspace, and neither the type check nor the test runner collects it', () => {
    const workspaces = (JSON.parse(read('package.json')) as { workspaces: string[] }).workspaces
    expect(workspaces.some((w) => w.startsWith('research'))).toBe(false)
    expect(JSON.stringify(JSON.parse(read('tsconfig.json')).include)).not.toMatch(/research/)
    expect(read('vitest.config.ts')).not.toMatch(/['"`]research\//)
    // and no production package declares a research package or a Python bridge as a dependency
    for (const p of readdirSync(join(ROOT, 'packages'))) {
      const file = `packages/${p}/package.json`
      if (!existsSync(join(ROOT, file))) continue
      const pkg = JSON.parse(read(file)) as Record<string, Record<string, string> | undefined>
      const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies, ...pkg.peerDependencies })
      expect(deps.filter((d) => /research|bakeoff|pytorch|torch|opencv|python|deeplsd|elsed|sam\b/i.test(d)), file).toEqual([])
    }
  })

  it('no model checkpoint is tracked anywhere, and the research harness tracks no binary', () => {
    const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
    expect(tracked.filter((f) => /\.(pt|pth|ckpt|safetensors|onnx|npz|npy|tflite)$/i.test(f))).toEqual([])
    const harness = tracked.filter((f) => f.startsWith('research/analyzer-005i-boundary-bakeoff/'))
    expect(harness.filter((f) => !/\.(py|ts|mjs|cjs|js|json|md|txt|sh|cpp|h|hpp|cmake|toml|cfg|ya?ml|csv)$|(^|\/)(CMakeLists\.txt|\.gitignore)$/i.test(f))).toEqual([])
  })

  it('the Android build declares no Python, PyTorch or OpenCV dependency and packages nothing from research/', () => {
    for (const f of filesUnder('apps/android', /\.gradle\.kts$/)) {
      const gradle = codeOf(read(f))
      expect(gradle, f).not.toMatch(/pytorch|torch|opencv|chaquopy|python|deeplsd|elsed|mobilesam|research\//i)
    }
    const assets = filesUnder('apps/android/app/src/main/assets', /.*/)
    expect(assets.filter((a) => /deeplsd|elsed|mobile_?sam|\.pt$|\.pth$|\.ckpt$/i.test(a))).toEqual([])
  })
})
