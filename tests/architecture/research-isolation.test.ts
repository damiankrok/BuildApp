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
import { closeSync, existsSync, openSync, readFileSync, readSync, readdirSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const ROOT = resolve(import.meta.dirname, '../..')
const read = (p: string): string => readFileSync(join(ROOT, p), 'utf8')
const codeOf = (source: string): string => source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/.*$/gm, '$1 ')
const importsOf = (source: string): string[] => [...source.matchAll(/(?:^\s*(?:import|export)[^'"]*?from\s+|import\(\s*|require\(\s*)['"]([^'"]+)['"]/gm)].map((m) => m[1])

function filesUnder(dir: string, ext: RegExp, includeVendored = false): string[] {
  const abs = join(ROOT, dir)
  if (!existsSync(abs)) return []
  const out: string[] = []
  const walk = (d: string): void => {
    for (const name of readdirSync(d)) {
      if (['node_modules', 'dist', 'build', '.gradle', '.cxx'].includes(name)) continue
      if (name === 'third_party' && !includeVendored) continue
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
  // post-review C3: the build scripts that decide what enters the bundle and the APK
  ...readdirSync(join(ROOT, 'apps')).flatMap((a) => filesUnder(`apps/${a}`, /^build\.(mjs|js|cjs|ts)$/)),
  ...readdirSync(join(ROOT, 'packages')).flatMap((p) => filesUnder(`packages/${p}`, /^build\.(mjs|js|cjs|ts)$/)),
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
    // and no production package, app or the root declares a research package or a Python bridge as a dependency
    const manifests = ['package.json', ...readdirSync(join(ROOT, 'packages')).map((p) => `packages/${p}/package.json`), ...readdirSync(join(ROOT, 'apps')).map((a) => `apps/${a}/package.json`)]
    for (const file of manifests) {
      if (!existsSync(join(ROOT, file))) continue
      const pkg = JSON.parse(read(file)) as Record<string, Record<string, string> | undefined>
      const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies, ...pkg.peerDependencies })
      expect(deps.filter((d) => /research|bakeoff|pytorch|torch|opencv|python|deeplsd|elsed|sam\b/i.test(d)), file).toEqual([])
    }
  })

  it('no model checkpoint is tracked anywhere, and the research harness tracks no binary', () => {
    const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
    // post-review C3: DeepLSD's own checkpoints are `.tar`; `.bin` is checked outside the byte cache BUILDAPP-03R
    // committed (`.cache/source-bytes`, publisher bytes from before the rule, no model among them).
    expect(tracked.filter((f) => /\.(pt|pth|ckpt|safetensors|onnx|ort|npz|npy|tflite|tar|pkl|h5|pb|gguf)$/i.test(f))).toEqual([])
    expect(tracked.filter((f) => /\.bin$/i.test(f) && !f.startsWith('.cache/source-bytes/'))).toEqual([])
    const harness = tracked.filter((f) => f.startsWith('research/analyzer-005i-boundary-bakeoff/'))
    expect(harness.filter((f) => !/\.(py|ts|mjs|cjs|js|json|md|txt|sh|cpp|h|hpp|cmake|toml|cfg|ya?ml|csv)$|(^|\/)(CMakeLists\.txt|\.gitignore)$/i.test(f))).toEqual([])
  })

  it('the Android build declares no Python, PyTorch or OpenCV dependency and packages nothing from research/', () => {
    for (const f of [...filesUnder('apps/android', /\.gradle\.kts$/), ...filesUnder('apps/android', /^libs\.versions\.toml$/)]) {
      const gradle = codeOf(read(f))
      expect(gradle, f).not.toMatch(/pytorch|torch|opencv|chaquopy|python|deeplsd|elsed|mobilesam|research\//i)
    }
    const assets = filesUnder('apps/android/app/src/main/assets', /.*/)
    expect(assets.filter((a) => /deeplsd|elsed|mobile_?sam|\.pt$|\.pth$|\.ckpt$/i.test(a))).toEqual([])
  })
})

/**
 * BUILDPLAN-ANALYZER-005J — the floor-plan intelligence audit is research too. It ran small VLMs (Florence-2,
 * SmolVLM2, Moondream), two wall networks and a micro-referee pilot from `research/analyzer-005j/`, in virtual
 * environments outside the repository, on publisher drawings read locally. What the repository may keep is code and
 * text: no model, no rendered question image and no publisher pixel.
 */
describe('005J production cannot reach the floor-plan intelligence audit, and the audit commits no pixels', () => {
  const AUDIT = /research\/analyzer-005j|florence-?2|smolvlm|moondream|micro[-_]?referee|wall[-_]?referee|vrgen/i

  it('no production source imports research/analyzer-005j or names the audited models in code', () => {
    const offenders: string[] = []
    for (const f of productionSources()) {
      const text = read(f)
      for (const spec of importsOf(text)) if (/analyzer-005j/.test(spec)) offenders.push(`${f} imports ${spec}`)
      if (AUDIT.test(codeOf(text))) offenders.push(`${f} names the 005J audit`)
    }
    expect(offenders).toEqual([])
  })

  it('the 005J harness and artifacts track only code and text — no image, model or archive', () => {
    const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
    const audit = tracked.filter((f) => f.startsWith('research/analyzer-005j/') || f.startsWith('stage-reports/artifacts/analyzer-005j/'))
    expect(audit.filter((f) => !/\.(py|ts|cjs|json|md|txt)$/i.test(f))).toEqual([])
    for (const f of audit) {
      const text = read(f)
      // the question corpus records crops by coordinates and hashes only; pixels would arrive as an embedded data URL,
      // a base64 image signature (PNG, JPEG, WebP, GIF), any long base64 run, or a long flat array of numbers (a mask)
      // (a signature alone may appear in prose, e.g. a review describing this test; an image is the signature plus its payload)
      expect(text, f).not.toMatch(/(data:(image|application)\/[\w.+-]+;base64,|iVBORw0KGgo|\/9j\/4|UklGR|R0lGOD)[A-Za-z0-9+/]{40,}/)
      expect(text, f).not.toMatch(/[A-Za-z0-9+/]{256,}={0,2}/)
      expect(text, f).not.toMatch(/\[(\s*-?\d+(\.\d+)?\s*,){64,}/)
      expect(text, f).not.toMatch(/(\[\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*\d{1,3}\s*)?\]\s*,\s*){64,}/)
      expect(statSync(join(ROOT, f)).size, f).toBeLessThanOrEqual(4 * 2 ** 20)
    }
  })

  it('the Android build packages nothing from the 005J audit', () => {
    for (const f of [...filesUnder('apps/android', /\.gradle\.kts$/), ...filesUnder('apps/android', /^libs\.versions\.toml$/)]) {
      expect(codeOf(read(f)), f).not.toMatch(AUDIT)
    }
    const assets = filesUnder('apps/android/app/src/main/assets', /.*/)
    expect(assets.filter((a) => AUDIT.test(a) || (/\.(onnx|ort|gguf|mf\.gz|safetensors|tflite|litertlm|bin|npz|npy|pkl|pt|pth)$/i.test(a) && !/numeric-recogniser|ppocr|paddle/i.test(a)))).toEqual([])
  })
})

/**
 * BUILDPLAN-ANALYZER-005K — the fresh-sheet gap set and its harness are research. The harness (`research/analyzer-005k/`)
 * draws sheets, extracts each WEAK gap with the frozen analyzer, composes the crops a reviewer labels and scores the rule,
 * all on publisher drawings read locally and kept outside the repository. What the repository may keep is code and text:
 * gap ids, coordinates, crop rectangles and the SHA-256 of the bytes and masks — never a crop, a sheet or an overlay.
 */
describe('005K production cannot reach the gap-set harness, and the gap set commits no pixels', () => {
  const HARNESS = /research\/analyzer-005k|gap-set-labels|gap-set-manifest/i

  it('no production source imports research/analyzer-005k or names the gap set', () => {
    const offenders: string[] = []
    for (const f of productionSources()) {
      const text = read(f)
      for (const spec of importsOf(text)) if (/analyzer-005k/.test(spec)) offenders.push(`${f} imports ${spec}`)
      if (HARNESS.test(codeOf(text))) offenders.push(`${f} names the 005K gap set`)
    }
    expect(offenders).toEqual([])
  })

  it('the 005K harness and artifacts track only code and text — no crop, sheet, overlay or archive', () => {
    const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
    const harness = tracked.filter((f) => f.startsWith('research/analyzer-005k/') || f.startsWith('stage-reports/artifacts/analyzer-005k/'))
    expect(harness.filter((f) => !/\.(py|ts|mjs|cjs|json|ndjson|md|txt|sh)$/i.test(f))).toEqual([])
    for (const f of harness) {
      const text = read(f)
      expect(text, f).not.toMatch(/(data:(image|application)\/[\w.+-]+;base64,|iVBORw0KGgo|\/9j\/4|UklGR|R0lGOD)[A-Za-z0-9+/]{40,}/)
      expect(text, f).not.toMatch(/[A-Za-z0-9+/]{256,}={0,2}/)
      expect(text, f).not.toMatch(/\[(\s*-?\d+(\.\d+)?\s*,){64,}/)
      expect(text, f).not.toMatch(/(\[\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*\d{1,3}\s*)?\]\s*,\s*){64,}/)
      expect(statSync(join(ROOT, f)).size, f).toBeLessThanOrEqual(4 * 2 ** 20)
    }
  })

  it('the Android build packages nothing from the 005K gap set', () => {
    for (const f of [...filesUnder('apps/android', /\.gradle\.kts$/), ...filesUnder('apps/android', /^libs\.versions\.toml$/)]) {
      expect(codeOf(read(f)), f).not.toMatch(HARNESS)
    }
    expect(filesUnder('apps/android/app/src/main/assets', /.*/).filter((a) => HARNESS.test(a) || /gap-set|analyzer-005k/i.test(a))).toEqual([])
  })
})

/**
 * BUILDPLAN-ANALYZER-005N — the compound-facade harness (`research/analyzer-005n/`) traces every decomposition of the
 * development rows through a Vite alias, replays the development matrix and the mutations, and probes extents —
 * writing its traces outside the repository. What the repository keeps is code and text: frame, gap, span and
 * interval ids, rectangles, widths, scales and decisions. Never a plan, an overlay or a picture of one.
 */
describe('005N production cannot reach the compound-facade harness, and it commits no pixels', () => {
  const HARNESS = /research\/analyzer-005n|trace-decompositions|fixture-trace|facade-baseline|baseline-compound-facades/i

  it('no production source imports research/analyzer-005n or names its traces', () => {
    const offenders: string[] = []
    for (const f of productionSources()) {
      const text = read(f)
      for (const spec of importsOf(text)) if (/analyzer-005n/.test(spec)) offenders.push(`${f} imports ${spec}`)
      if (HARNESS.test(codeOf(text))) offenders.push(`${f} names the 005N harness`)
    }
    expect(offenders).toEqual([])
  })

  it('the 005N harness and artifacts track only code and text — no plan, overlay or archive', () => {
    const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
    const harness = tracked.filter((f) => f.startsWith('research/analyzer-005n/') || f.startsWith('stage-reports/artifacts/analyzer-005n/'))
    expect(harness.filter((f) => !/\.(ts|mjs|json|ndjson|md|txt)$/i.test(f))).toEqual([])
    for (const f of harness) {
      const text = read(f)
      expect(text, f).not.toMatch(/(data:(image|application)\/[\w.+-]+;base64,|iVBORw0KGgo|\/9j\/4|UklGR|R0lGOD)[A-Za-z0-9+/]{40,}/)
      expect(text, f).not.toMatch(/[A-Za-z0-9+/]{256,}={0,2}/)
      expect(text, f).not.toMatch(/\[(\s*-?\d+(\.\d+)?\s*,){64,}/)
      expect(text, f).not.toMatch(/(\[\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*\d{1,3}\s*)?\]\s*,\s*){64,}/)
      expect(statSync(join(ROOT, f)).size, f).toBeLessThanOrEqual(4 * 2 ** 20)
    }
  })

  it('the harness writes its traces outside the repository only', () => {
    expect(read('research/analyzer-005n/trace-decompositions.mjs')).toMatch(/if \(work\.startsWith\(REPO\)\) throw new Error\('the trace harness lives outside the repository'\)/)
    expect(read('research/analyzer-005n/fixture-trace.ts')).toMatch(/if \(out\.startsWith\(resolve\(import\.meta\.dirname, '\.\.\/\.\.'\)\)\) throw new Error\('trace output stays outside the repository'\)/)
  })

  it('the Android build packages nothing from the 005N harness', () => {
    for (const f of [...filesUnder('apps/android', /\.gradle\.kts$/), ...filesUnder('apps/android', /^libs\.versions\.toml$/)]) {
      expect(codeOf(read(f)), f).not.toMatch(HARNESS)
    }
    expect(filesUnder('apps/android/app/src/main/assets', /.*/).filter((a) => HARNESS.test(a) || /analyzer-005n/i.test(a))).toEqual([])
  })
})

/**
 * BUILDPLAN-ANALYZER-005L — the storey-registration harness (`research/analyzer-005l/`) traces the layout pass on
 * development rows, replays the development matrix, and draws plans with their registrations for a developer to look
 * at — outside the repository. What the repository keeps is code and text: frame and region ids, rectangles, scales,
 * scores and areas. Never a plan, an overlay or a picture of one.
 */
describe('005L production cannot reach the storey-registration harness, and it commits no pixels', () => {
  const HARNESS = /research\/analyzer-005l|storey-trace|baseline-storey-registration/i

  it('no production source imports research/analyzer-005l or names its traces', () => {
    const offenders: string[] = []
    for (const f of productionSources()) {
      const text = read(f)
      for (const spec of importsOf(text)) if (/analyzer-005l/.test(spec)) offenders.push(`${f} imports ${spec}`)
      if (HARNESS.test(codeOf(text))) offenders.push(`${f} names the 005L harness`)
    }
    expect(offenders).toEqual([])
  })

  it('the 005L harness and artifacts track only code and text — no plan, overlay or archive', () => {
    const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
    const harness = tracked.filter((f) => f.startsWith('research/analyzer-005l/') || f.startsWith('stage-reports/artifacts/analyzer-005l/'))
    expect(harness.filter((f) => !/\.(ts|mjs|json|ndjson|md|txt)$/i.test(f))).toEqual([])
    for (const f of harness) {
      const text = read(f)
      expect(text, f).not.toMatch(/(data:(image|application)\/[\w.+-]+;base64,|iVBORw0KGgo|\/9j\/4|UklGR|R0lGOD)[A-Za-z0-9+/]{40,}/)
      expect(text, f).not.toMatch(/[A-Za-z0-9+/]{256,}={0,2}/)
      expect(text, f).not.toMatch(/\[(\s*-?\d+(\.\d+)?\s*,){64,}/)
      expect(text, f).not.toMatch(/(\[\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*\d{1,3}\s*)?\]\s*,\s*){64,}/)
      expect(statSync(join(ROOT, f)).size, f).toBeLessThanOrEqual(4 * 2 ** 20)
    }
  })

  it('the harness writes its pictures outside the repository only', () => {
    for (const f of ['research/analyzer-005l/look.ts', 'research/analyzer-005l/pair.ts', 'research/analyzer-005l/storey-trace.ts']) {
      // the output is resolved before it is checked: a relative path into the repository is refused too (council C5L-6)
      expect(read(f), f).toMatch(/= (?:arg\('(?:out|look)', ''\) && )?resolve\(arg\('(?:out|look)'/)
      expect(read(f), f).toMatch(/startsWith\((?:REPO|resolve\(import\.meta\.dirname, '\.\.\/\.\.'\))\)\) throw new Error\('pictures stay outside the repository'\)/)
    }
  })

  it('the Android build packages nothing from the 005L harness', () => {
    for (const f of [...filesUnder('apps/android', /\.gradle\.kts$/), ...filesUnder('apps/android', /^libs\.versions\.toml$/)]) {
      expect(codeOf(read(f)), f).not.toMatch(HARNESS)
    }
    expect(filesUnder('apps/android/app/src/main/assets', /.*/).filter((a) => HARNESS.test(a) || /analyzer-005l/i.test(a))).toEqual([])
  })
})

/**
 * BUILDPLAN-ANALYZER-005M — the Visual Referee v2 bake-off ran 2–8 B vision-language models (Qwen3-VL, SmolVLM2,
 * InternVL3.5) through a llama.cpp server on CPU, from `research/analyzer-005m/`, with every weight, converted GGUF,
 * tokenizer and question picture outside the worktree (`/dev/shm/models`, `/home/user/work005m`). Brief section 2 / 20:
 * no model weight, checkpoint, adapter or tokenizer bundle may enter Git history, LFS or a release; production may not
 * reach the harness; and a research artifact stays small.
 */
describe('005M production cannot reach the visual-referee v2 bake-off, and no weight enters the repository', () => {
  const HARNESS = /research\/analyzer-005m|analyzer-005m-vr2|qwen3[-_]?vl|internvl|smolvlm|gemma[-_]?3n|llama[-_.]?cpp|llama-server|\bgguf\b|litert[-_]?lm|matformer/i
  const WEIGHT_EXT = /\.(safetensors|bin|pt|pth|ptl|ckpt|gguf|ggml|onnx|ort|tflite|litertlm|task|mlmodel|mlpackage|npz|npy|pkl|pickle|h5|pb|mf|mf\.gz|tar|zst|7z|msgpack|pte|dlc|tiktoken|model|mnn|engine)$/i
  // a weight renamed to a harmless extension still starts like one (post-review E-5): GGUF, a safetensors header
  // (8-byte length + JSON), NumPy, HDF5, TFLite, a pickle, or a zip holding a PyTorch / safetensors / GGUF payload
  const weightMagic = (b: Buffer): boolean =>
    b.subarray(0, 4).toString('latin1') === 'GGUF' ||
    (b.length > 10 && b.subarray(8, 10).toString('latin1') === '{"' && b.readBigUInt64LE(0) < 100_000_000n) ||
    b.subarray(0, 6).toString('latin1') === '\x93NUMPY' ||
    b.subarray(0, 8).equals(Buffer.from([0x89, 0x48, 0x44, 0x46, 0x0d, 0x0a, 0x1a, 0x0a])) ||
    b.subarray(4, 8).toString('latin1') === 'TFL3' ||
    (b[0] === 0x80 && b[1] >= 2 && b[1] <= 5) ||
    (b.subarray(0, 4).toString('latin1') === 'PK\x03\x04' && /data\.pkl|\.safetensors|\.gguf/.test(b.toString('latin1')))
  const head = (f: string): Buffer => {
    const fd = openSync(join(ROOT, f), 'r')
    const buf = Buffer.alloc(4096)
    const n = readSync(fd, buf, 0, 4096, 0)
    closeSync(fd)
    return buf.subarray(0, n)
  }
  // the publisher bytes committed before 005J (`.cache/source-bytes/*.bin`) are drawings and pages, never a model. A
  // file must be a whole medium, not only start like one (post-review E2-5): a JPEG ends with its EOI marker, a PNG
  // with IEND, a GIF with its trailer, a PDF with %%EOF, and anything else is UTF-8 text with no NUL byte
  const publisherBytes = (b: Buffer): boolean => {
    const tail = b.subarray(Math.max(0, b.length - 2048)).toString('latin1').trimEnd()
    if (b.subarray(0, 3).equals(Buffer.from([0xff, 0xd8, 0xff]))) return b.subarray(Math.max(0, b.length - 64)).includes(Buffer.from([0xff, 0xd9]))
    if (b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return tail.slice(-16).includes('IEND')
    if (b.subarray(0, 3).toString('latin1') === 'GIF') return tail.endsWith(';')
    if (b.subarray(0, 4).toString('latin1') === '%PDF') return tail.includes('%%EOF')
    if (b.subarray(0, 4).toString('latin1') === 'RIFF' && b.subarray(8, 12).toString('latin1') === 'WEBP') return b.readUInt32LE(4) + 8 === b.length
    if (b.includes(0)) return false
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(b)
      return true
    } catch {
      return false
    }
  }
  const HUB_BUNDLE = /(^|\/)(tokenizer\.json|tokenizer\.model|tokenizer_config\.json|special_tokens_map\.json|added_tokens\.json|vocab\.json|merges\.txt|preprocessor_config\.json|processor_config\.json|chat_template\.(json|jinja)|generation_config\.json|adapter_config\.json|adapter_model\.[a-z]+|model\.safetensors\.index\.json)$/i
  const STAGE_PATHS = ['research/analyzer-005m/', 'stage-reports/artifacts/analyzer-005m-vr2/']
  const tracked = (): string[] => execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)

  it('no production source imports research/analyzer-005m or names the audited models or their runtime in code', () => {
    const offenders: string[] = []
    for (const f of productionSources()) {
      const text = read(f)
      for (const spec of importsOf(text)) if (/analyzer-005m/.test(spec)) offenders.push(`${f} imports ${spec}`)
      if (HARNESS.test(codeOf(text))) offenders.push(`${f} names the 005M bake-off`)
    }
    expect(offenders).toEqual([])
  })

  it('no model weight, checkpoint, adapter or hub tokenizer bundle is tracked anywhere', () => {
    const files = tracked()
    const sourceBytes = (f: string): boolean => f.startsWith('.cache/source-bytes/') && /\.bin$/i.test(f)
    expect(files.filter((f) => WEIGHT_EXT.test(f) && !sourceBytes(f))).toEqual([])
    expect(files.filter((f) => HUB_BUNDLE.test(f))).toEqual([])
    expect(files.filter(sourceBytes).filter((f) => !publisherBytes(readFileSync(join(ROOT, f))))).toEqual([])
  })

  it('no tracked file anywhere is the size of a model (post-review E2-5: a raw binary with no magic number)', () => {
    // the largest tracked file at the stage base is 16 MB (a design-tool binary); the smallest VLM pack measured is 1.5 GB
    expect(tracked().filter((f) => existsSync(join(ROOT, f)) && statSync(join(ROOT, f)).size > 32 * 2 ** 20)).toEqual([])
  })

  it('the detectors catch a disguised weight and reject a disguised publisher file (negative test, synthetic bytes)', () => {
    const st = Buffer.alloc(64)
    st.writeBigUInt64LE(40n, 0)
    st.write('{"__metadata__":{"format":"pt"}}', 8, 'latin1')
    const gguf = Buffer.concat([Buffer.from('GGUF', 'latin1'), Buffer.alloc(60)])
    const npy = Buffer.concat([Buffer.from('\x93NUMPY', 'latin1'), Buffer.alloc(58)])
    const pickle = Buffer.from([0x80, 0x04, 0x95, 0x00])
    const torchZip = Buffer.concat([Buffer.from('PK\x03\x04', 'latin1'), Buffer.from('archive/data.pkl', 'latin1')])
    for (const b of [st, gguf, npy, pickle, torchZip]) expect(weightMagic(b)).toBe(true)
    expect(weightMagic(Buffer.from('{"answer": "A", "confidence": "HIGH"}\n', 'utf8'))).toBe(false)
    // a weight behind a publisher prefix: no trailer, or a NUL byte in "text"
    expect(publisherBytes(Buffer.concat([Buffer.from('%PDF-1.7\n', 'latin1'), st]))).toBe(false)
    expect(publisherBytes(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), gguf]))).toBe(false)
    expect(publisherBytes(Buffer.concat([Buffer.from('text/html\n', 'latin1'), st]))).toBe(false)
    expect(publisherBytes(Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\n%%EOF\n', 'latin1'))).toBe(true)
    expect(publisherBytes(Buffer.from('image/jpeg', 'latin1'))).toBe(true)
  })

  it('no tracked file, whatever its name, starts like a weight file', () => {
    expect(tracked().filter((f) => existsSync(join(ROOT, f)) && statSync(join(ROOT, f)).isFile() && weightMagic(head(f)))).toEqual([])
  })

  it('the 005M harness and artifacts track only code and text, each file small, with no embedded pixels', () => {
    const stage = tracked().filter((f) => STAGE_PATHS.some((p) => f.startsWith(p)))
    expect(stage.length).toBeGreaterThan(0)
    // structured model answers are JSON lines (`runs/*.jsonl`): text, held to the same pixel and size checks below
    expect(stage.filter((f) => !/\.(py|ts|mjs|sh|json|jsonl|ndjson|md|txt)$/i.test(f))).toEqual([])
    for (const f of stage) {
      const bytes = readFileSync(join(ROOT, f))
      expect(bytes.includes(0), `${f} holds a NUL byte`).toBe(false)
      expect(() => new TextDecoder('utf-8', { fatal: true }).decode(bytes), f).not.toThrow()
      const text = bytes.toString('utf8')
      expect(text, f).not.toMatch(/(data:(image|application)\/[\w.+-]+;base64,|iVBORw0KGgo|\/9j\/4|UklGR|R0lGOD)[A-Za-z0-9+/]{40,}/)
      expect(text, f).not.toMatch(/[A-Za-z0-9+/]{256,}={0,2}/)
      expect(text, f).not.toMatch(/\[(\s*-?\d+(\.\d+)?\s*,){64,}/)
      expect(text, f).not.toMatch(/(\[\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*(,\s*\d{1,3}\s*)?\]\s*,\s*){64,}/)
      // a research artifact threshold: a weight shard, an image or a dataset dump cannot hide under it
      expect(statSync(join(ROOT, f)).size, f).toBeLessThanOrEqual(2 * 2 ** 20)
    }
  })

  it('Git LFS is not used, so no pointer can stand in for a weight', () => {
    for (const f of ['.gitattributes', ...tracked().filter((p) => p.endsWith('/.gitattributes'))]) {
      if (existsSync(join(ROOT, f))) expect(read(f), f).not.toMatch(/filter\s*=\s*lfs/i)
    }
    expect(existsSync(join(ROOT, '.lfsconfig'))).toBe(false)
    expect(tracked().filter((f) => STAGE_PATHS.some((p) => f.startsWith(p))).filter((f) => /^version https:\/\/git-lfs/.test(read(f)))).toEqual([])
  })

  it('the harness writes pictures and weights outside the repository only (symlinks resolved)', () => {
    const guard = (f: string, msg: string): void => {
      const src = read(f)
      expect(src, f).toMatch(new RegExp(`os\\.path\\.realpath\\([^)]*\\)\\.startswith\\([^\\n]*\\):\\s*\\n\\s*raise SystemExit\\('${msg}'\\)`))
      expect(src, f).not.toMatch(/os\.path\.abspath\((a\.out|out|a\.dir)\)\.startswith/)
    }
    guard('research/analyzer-005m/compose5.py', 'pictures stay outside the repository')
    guard('research/analyzer-005m/synthetic/vrgen2.py', 'renders stay outside the repository')
    guard('research/analyzer-005m/hfget.py', 'weights stay outside the repository')
    guard('research/analyzer-005m/bands_prep.py', 'pictures stay outside the repository')
    guard('research/analyzer-005m/student_dataset.py', 'the dataset stays outside the repository')
    expect(read('research/analyzer-005m/run_model.sh')).not.toMatch(/\$REPO\/[^"\s]*\.gguf/)
  })

  it('no npm manifest depends on a VLM runtime or the 005M harness (post-review F2-6)', () => {
    const NPM_VLM = /llama|ggml|web-?llm|mlc-ai|transformers|onnxruntime-genai|ollama|litert|mediapipe\/tasks-genai|executorch/i
    const manifests = ['package.json', ...readdirSync(join(ROOT, 'packages')).map((p) => `packages/${p}/package.json`), ...readdirSync(join(ROOT, 'apps')).map((a) => `apps/${a}/package.json`)]
    for (const f of manifests.filter((m) => existsSync(join(ROOT, m)))) {
      const pkg = JSON.parse(read(f)) as Record<string, Record<string, string> | undefined>
      const deps = ['dependencies', 'devDependencies', 'optionalDependencies', 'peerDependencies'].flatMap((k) => Object.keys(pkg[k] ?? {}))
      expect(deps.filter((d) => NPM_VLM.test(d) || HARNESS.test(d)), f).toEqual([])
    }
  })

  it('the Android build packages nothing from the 005M bake-off and no VLM weight or runtime', () => {
    const VLM_RUNTIME = /llama|ggml|\bmtmd\b|tasks-genai|litert[-_]?lm|mlc[-_]?llm|executorch|onnxruntime-genai/i
    for (const f of [...filesUnder('apps/android', /\.gradle\.kts$/), ...filesUnder('apps/android', /^libs\.versions\.toml$/)]) {
      expect(codeOf(read(f)), f).not.toMatch(HARNESS)
      expect(codeOf(read(f)), f).not.toMatch(VLM_RUNTIME)
    }
    // native code and its build (post-review F-8), vendored trees included (post-review F2-6)
    for (const f of filesUnder('apps/android', /\.(c|cc|cpp|h|hpp)$|^CMakeLists\.txt$/, true)) {
      expect(codeOf(read(f)), f).not.toMatch(HARNESS)
      expect(codeOf(read(f)), f).not.toMatch(VLM_RUNTIME)
    }
    expect(filesUnder('apps/android', /\.so$/, true).filter((f) => VLM_RUNTIME.test(f))).toEqual([])
    expect(filesUnder('apps/android', /\.(gguf|safetensors|litertlm)$/, true)).toEqual([])
    // the apps' tools decide what is fetched into a build (post-review F2-6)
    for (const a of readdirSync(join(ROOT, 'apps'))) {
      for (const f of filesUnder(`apps/${a}/tools`, /\.(mjs|js|cjs|ts|sh|py)$/)) {
        expect(codeOf(read(f)), f).not.toMatch(HARNESS)
        expect(codeOf(read(f)), f).not.toMatch(VLM_RUNTIME)
      }
    }
    expect(filesUnder('apps/android/app/src/main/assets', /.*/).filter((a) => HARNESS.test(a) || WEIGHT_EXT.test(a))).toEqual([])
  })
})

/**
 * BUILDPLAN-ANALYZER-005O — the metric-evidence bake-off is research. Its harness (`research/analyzer-005o/`) swaps a
 * copy of `plan-resolution.ts` in for one replay process (a Vite alias written OUTSIDE the repository), re-reads label
 * crops with the deployed recogniser, and scores challengers against blind transcriptions — all on publisher drawings
 * read locally. Production cannot reach it, it adds no dependency, and it commits no pixel; its challenger generator is
 * held by its own adversarial corpus and mutation controls (`test_views.py`), run here.
 */
describe('005O production cannot reach the metric bake-off, and the bake-off commits no pixels', () => {
  const HARNESS = /research\/analyzer-005o|as-printed-harness|AS_PRINTED_VIEW_005O|as_printed_views/i

  it('no production source imports research/analyzer-005o or names its harness', () => {
    const offenders: string[] = []
    for (const f of productionSources()) {
      const text = read(f)
      for (const spec of importsOf(text)) if (/analyzer-005o/.test(spec)) offenders.push(`${f} imports ${spec}`)
      if (HARNESS.test(codeOf(text))) offenders.push(`${f} names the 005O harness`)
    }
    expect(offenders).toEqual([])
  })

  it('the 005O harness and artifacts track only code and text — no crop, sheet, page, model or archive', () => {
    const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
    const harness = tracked.filter((f) => f.startsWith('research/analyzer-005o/') || f.startsWith('stage-reports/artifacts/analyzer-005o/'))
    expect(harness.length).toBeGreaterThan(0)
    expect(harness.filter((f) => !/\.(py|ts|mjs|json|md)$/i.test(f))).toEqual([])
    for (const f of harness) {
      const text = read(f)
      expect(text, f).not.toMatch(/(data:(image|application)\/[\w.+-]+;base64,|iVBORw0KGgo|\/9j\/4|UklGR|R0lGOD)[A-Za-z0-9+/]{40,}/)
      expect(text, f).not.toMatch(/[A-Za-z0-9+/]{256,}={0,2}/)
      expect(text, f).not.toMatch(/\[(\s*-?\d+(\.\d+)?\s*,){64,}/)
      expect(statSync(join(ROOT, f)).size, f).toBeLessThanOrEqual(4 * 2 ** 20)
    }
  })

  it('the harness writes its module swap and every publisher-derived file outside the repository', () => {
    const harness = read('research/analyzer-005o/as-printed-harness.mjs')
    expect(codeOf(harness)).toMatch(/work\.startsWith\(REPO\)\) throw/)
    // post-review LMP-4: every pixel writer refuses an output inside the repository at run time, before it writes
    for (const f of ['statement_crops.py', 'label_sheets.py', 'glyph_corpus.py']) {
      const py = read(`research/analyzer-005o/${f}`)
      expect(py, f).toMatch(/def refuse_inside_repo\(path\):[\s\S]*sys\.exit\(/)
      expect(py, f).toMatch(/a = ap\.parse_args\(\)\n\s+refuse_inside_repo\(a\.(work|out)\)/)
    }
    expect(read('research/analyzer-005o/reread.ts')).toMatch(/no\s+pixel\s+is\s+written/i)
  })

  it('the challenger generator reads no truth: no transcription, truth file or label sheet is named in its code', () => {
    // post-review L12: the generator's inputs are the sealed evidence (and, for the b-variants, the re-read file) only
    const code = read('research/analyzer-005o/as_printed_views.py').replace(/"""[\s\S]*?"""/g, ' ').replace(/#.*$/gm, ' ')
    expect(code).not.toMatch(/truth|transcri|labels[\/'"]|sheet/i)
    for (const f of ['as-printed-harness.mjs', 'replay.mjs', 'reread.ts']) expect(codeOf(read(`research/analyzer-005o/${f}`)), f).not.toMatch(/truth\.json|transcriptions\.json|sheet-key/i)
  })

  it('the challenger generator passes its adversarial corpus and every deliberately broken generator is caught', () => {
    const out = execFileSync('python3', ['-I', join(ROOT, 'research/analyzer-005o/test_views.py')], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    expect(out).toMatch(/corpus: \d+ cases, PASS/)
    expect(out).not.toMatch(/SURVIVED/)
    expect((out.match(/KILLED/g) ?? []).length).toBe(4)
  })
})

/**
 * BUILDPLAN-ANALYZER-005P — the consumer-scoped bake-off is research. Its harness (`research/analyzer-005p/`) swaps a
 * copy of `plan-resolution.ts` in for one replay process (a Vite alias written OUTSIDE the repository), with a policy
 * file naming, per consumer of the as-printed reading, how a contested statement is read. Production cannot reach it,
 * it commits no pixel, and its policy generator reads no truth: the transcriptions meet the variants only in the scorer.
 */
describe('005P production cannot reach the consumer-scoped bake-off, and the bake-off reads no truth before scoring', () => {
  const HARNESS = /research\/analyzer-005p|consumer-harness|AS_PRINTED_POLICY_005P|policy_views/i

  it('no production source imports research/analyzer-005p or names its harness', () => {
    const offenders: string[] = []
    for (const f of productionSources()) {
      const text = read(f)
      for (const spec of importsOf(text)) if (/analyzer-005p/.test(spec)) offenders.push(`${f} imports ${spec}`)
      if (HARNESS.test(codeOf(text))) offenders.push(`${f} names the 005P harness`)
    }
    expect(offenders).toEqual([])
  })

  it('the 005P harness and artifacts track only code and text — no crop, sheet, page, model or archive', () => {
    const tracked = execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)
    const harness = tracked.filter((f) => f.startsWith('research/analyzer-005p/') || f.startsWith('stage-reports/artifacts/analyzer-005p/'))
    expect(harness.length).toBeGreaterThan(0)
    expect(harness.filter((f) => !/\.(py|ts|mjs|json|md)$/i.test(f))).toEqual([])
    for (const f of harness) {
      const text = read(f)
      expect(text, f).not.toMatch(/(data:(image|application)\/[\w.+-]+;base64,|iVBORw0KGgo|\/9j\/4|UklGR|R0lGOD)[A-Za-z0-9+/]{40,}/)
      expect(text, f).not.toMatch(/[A-Za-z0-9+/]{256,}={0,2}/)
      expect(statSync(join(ROOT, f)).size, f).toBeLessThanOrEqual(4 * 2 ** 20)
    }
  })

  it('the harness and the policy files are written outside the repository', () => {
    expect(codeOf(read('research/analyzer-005p/consumer-harness.mjs'))).toMatch(/work\.startsWith\(REPO\)\) throw/)
    expect(read('research/analyzer-005p/policy_views.py')).toMatch(/startswith\(os\.path\.abspath\(os\.path\.join\(HERE, '\.\.', '\.\.'\)\)\):\n\s+sys\.exit\(/)
  })

  it('the policy generator and the harness read no truth: no transcription, truth file or label sheet is named in their code', () => {
    const code = read('research/analyzer-005p/policy_views.py').replace(/"""[\s\S]*?"""/g, ' ').replace(/#.*$/gm, ' ')
    expect(code).not.toMatch(/truth|transcri|labels[/'"]|sheet/i)
    for (const f of ['consumer-harness.mjs', 'replay.mjs']) expect(codeOf(read(`research/analyzer-005p/${f}`)), f).not.toMatch(/truth|transcriptions\.json|sheet-key/i)
  })
})

/**
 * BUILDPLAN-ANALYZER-005Q — the exterior-boundary bake-off is research. Its harness (`research/analyzer-005q/`) applies
 * a candidate patch to a copy of the base revision's `packages/reconstruction/src` (a Vite alias written OUTSIDE the
 * repository) and replays the corpus through it. Production cannot reach it, and it commits no pixel: the candidates
 * are patches, the census and the scores are text.
 */
describe('005Q production cannot reach the exterior-boundary bake-off, and the bake-off commits no pixels', () => {
  const HARNESS = /research\/analyzer-005q|analyzer-005q|score_005q|negative_gate|trigger_census|variant\.mjs/i
  // tracked and about to be: the stage's files are checked before the lead commits them, too
  const stageFiles = (): string[] =>
    [
      ...execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n'),
      ...execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' }).split('\n'),
    ].filter((f) => f.startsWith('research/analyzer-005q/') || f.startsWith('stage-reports/artifacts/analyzer-005q/'))

  it('no production source imports research/analyzer-005q or names its harness', () => {
    const offenders: string[] = []
    for (const f of productionSources()) {
      const text = read(f)
      for (const spec of importsOf(text)) if (/analyzer-005q|research\//.test(spec)) offenders.push(`${f} imports ${spec}`)
      if (HARNESS.test(codeOf(text))) offenders.push(`${f} names the 005Q harness`)
    }
    expect(offenders).toEqual([])
  })

  it('the 005Q harness and artifacts track only code, patches and text — no crop, sheet, page, model or archive', () => {
    const harness = stageFiles()
    expect(harness.length).toBeGreaterThan(0)
    expect(harness.filter((f) => !/\.(py|ts|mjs|json|md|patch)$/i.test(f))).toEqual([])
    for (const f of harness) {
      const text = read(f)
      expect(text, f).not.toMatch(/(data:(image|application)\/[\w.+-]+;base64,|iVBORw0KGgo|\/9j\/4|UklGR|R0lGOD)[A-Za-z0-9+/]{40,}/)
      expect(text, f).not.toMatch(/[A-Za-z0-9+/]{256,}={0,2}/)
      // a candidate patch touches the reconstruction module's source and nothing else
      if (f.endsWith('.patch')) for (const m of text.matchAll(/^\+\+\+ (?:b\/)?(\S+)/gm)) expect(m[1], f).toMatch(/^packages\/reconstruction\/src\//)
      if (f.endsWith('.patch')) expect(text, f).not.toMatch(/^GIT binary patch|^Binary files/m)
      expect(statSync(join(ROOT, f)).size, f).toBeLessThanOrEqual(4 * 2 ** 20)
    }
  })

  it('the variant copy and the replays are written outside the repository', () => {
    expect(codeOf(read('research/analyzer-005q/variant.mjs'))).toMatch(/work\.startsWith\(REPO\)\) throw new Error\('a variant copy lives outside the repository'\)/)
    expect(codeOf(read('research/analyzer-005q/replay.mjs'))).toMatch(/if \(work\.startsWith\(REPO\)\) throw new Error\('replays live outside the repository'\)/)
  })
})

/**
 * BUILDPLAN-ANALYZER-005Q-OCR — the full-plan text-detection and binding bake-off is research. Its harness
 * (`research/analyzer-005q-ocr/`) runs a pinned PP-OCRv6 tiny DETECTOR, the deployed recogniser, and two local truth
 * readers (PP-OCRv6 medium, Tesseract) on publisher sheets held OUTSIDE the repository. Production cannot reach it, it
 * commits no pixel and no weight, and the truth readers never see a contender's reading.
 */
describe('005Q-OCR production cannot reach the full-plan OCR bake-off, and the bake-off commits no pixels or weights', () => {
  const HARNESS = /analyzer-005q-ocr|fullplan\.ts|r1_server|PP-OCRv6_(tiny_det|small_det|medium_rec)|\btesseract\b/i
  const stageFiles = (): string[] =>
    [
      ...execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n'),
      ...execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' }).split('\n'),
    ].filter((f) => f.startsWith('research/analyzer-005q-ocr/') || f.startsWith('stage-reports/artifacts/analyzer-005q-ocr/'))

  it('no production source imports research/analyzer-005q-ocr or names its detector, truth readers or harness', () => {
    const offenders: string[] = []
    for (const f of productionSources()) {
      const text = read(f)
      for (const spec of importsOf(text)) if (/analyzer-005q-ocr|research\//.test(spec)) offenders.push(`${f} imports ${spec}`)
      if (HARNESS.test(codeOf(text))) offenders.push(`${f} names the 005Q-OCR harness`)
    }
    expect(offenders).toEqual([])
  })

  it('the harness and artifacts track only code and text — no crop, sheet, page, model weight or archive', () => {
    const files = stageFiles()
    expect(files.length).toBeGreaterThan(0)
    expect(files.filter((f) => !/\.(py|ts|mjs|json|md)$/i.test(f))).toEqual([])
    for (const f of files) {
      const text = read(f)
      expect(text, f).not.toMatch(/(data:(image|application)\/[\w.+-]+;base64,|iVBORw0KGgo|\/9j\/4|UklGR|R0lGOD)[A-Za-z0-9+/]{40,}/)
      expect(text, f).not.toMatch(/[A-Za-z0-9+/]{256,}={0,2}/)
      expect(statSync(join(ROOT, f)).size, f).toBeLessThanOrEqual(4 * 2 ** 20)
    }
  })

  it('every writer refuses an output inside the repository, and the detector and truth reader are pinned by hash', () => {
    for (const f of ['fullplan.ts', 'truth.ts']) {
      const code = codeOf(read(`research/analyzer-005q-ocr/${f}`))
      expect(code, f).toMatch(/if \(W === REPO \|\| W\.startsWith\(REPO \+ '\/'\)\) throw new Error/)
      expect(code, f).toMatch(/sha256: '[0-9a-f]{64}'/)
    }
    expect(codeOf(read('research/analyzer-005q-ocr/r1_server.py'))).toMatch(/hexdigest\(\) != a\.sha256/)
  })

  it('the truth readers never read a contender reading, and the contenders never read truth', () => {
    const truth = codeOf(read('research/analyzer-005q-ocr/truth.ts'))
    expect(truth).not.toMatch(/con\.b0|\.reads\b|\.external\b|latticeAsRead|ensemble|\.text\)\s*\}\s*of\s+con/)
    const contenders = codeOf(read('research/analyzer-005q-ocr/fullplan.ts'))
    expect(contenders).not.toMatch(/truth|transcri|labels\/|sheet-key|label-rows|trueScale/i)
  })
})

/**
 * BUILDPLAN-ANALYZER-005Q-CHAIN — the ink-first / binding / orientation integration study is research. Its challengers
 * are patches (`research/analyzer-005q-chain/candidates/*.patch`, `ACCEL.patch`) applied to a copy of the base's
 * source-metrics OUTSIDE the repository and aliased only for the replay process; production never sees them. A patch may
 * touch only `packages/source-metrics/src` (reconstruction, plan resolution and the 005P statement contest stay byte
 * for byte production's in every variant), and no added line may name a development row, a family, a published figure,
 * a verdict, a truth file or a scratch path (G4 / mutation M8: a challenger that knows which house it is reading is not a
 * rule about drawings).
 */
describe('005Q-CHAIN production cannot reach the integration study, and its challengers are blind to the rows', () => {
  const stageFiles = (): string[] =>
    [
      ...execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n'),
      ...execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' }).split('\n'),
    ].filter((f) => f.startsWith('research/analyzer-005q-chain/') || f.startsWith('stage-reports/artifacts/analyzer-005q-chain/'))
  const patches = (): string[] => stageFiles().filter((f) => f.endsWith('.patch'))
  const added = (patch: string): string[] =>
    read(patch)
      .split('\n')
      .filter((l) => l.startsWith('+') && !l.startsWith('+++'))

  it('no production source imports research/analyzer-005q-chain or names a challenger rule or the harness', () => {
    const offenders: string[] = []
    for (const f of productionSources()) {
      const text = read(f)
      for (const spec of importsOf(text)) if (/analyzer-005q-chain|research\//.test(spec)) offenders.push(`${f} imports ${spec}`)
      if (/inkOfC1|InkC1|inkFirstC1|geometricSpanC2|C2_BOUNDS|C3_SCALE_ROUTES|ACCEL_005Q_CHAIN|accelCallouts005qChain|005Q-CHAIN/.test(codeOf(text))) offenders.push(`${f} names the 005Q-CHAIN study`)
    }
    expect(offenders).toEqual([])
  })

  it('the study tracks only code and text — no crop, sheet, page, model weight or archive', () => {
    const files = stageFiles()
    expect(files.length).toBeGreaterThan(0)
    expect(files.filter((f) => !/\.(py|ts|mjs|json|md|patch)$/i.test(f))).toEqual([])
    for (const f of files) {
      const text = read(f)
      expect(text, f).not.toMatch(/(data:(image|application)\/[\w.+-]+;base64,|iVBORw0KGgo|\/9j\/4|UklGR|R0lGOD)[A-Za-z0-9+/]{40,}/)
      expect(text, f).not.toMatch(/[A-Za-z0-9+/]{256,}={0,2}/)
      expect(statSync(join(ROOT, f)).size, f).toBeLessThanOrEqual(4 * 2 ** 20)
    }
  })

  it('every challenger patch touches only packages/source-metrics/src, never reconstruction', () => {
    const list = patches()
    expect(list.length).toBeGreaterThanOrEqual(7)
    for (const p of list) {
      const targets = [...read(p).matchAll(/^\+\+\+ b\/(\S+)/gm)].map((m) => m[1])
      expect(targets.length, p).toBeGreaterThan(0)
      for (const t of targets) expect(t, p).toMatch(/^packages\/source-metrics\/src\/[\w-]+\.ts$/)
    }
  })

  it('no added line of any challenger names a development row, family, published figure, verdict, truth file or scratch path', () => {
    const cases = JSON.parse(read('research/analyzer-005q-chain/cases.json')).cases as Array<{ case: string; family: string }>
    const names = [...new Set(cases.flatMap((c) => [c.case, c.family]))].filter((n) => n.length >= 3)
    const forbidden = [...names.map((n) => n.toLowerCase()), 'publishedfacts', 'publishedareas', 'publishedrooms', 'footprint', 'verdict', 'label-records', 'truth', 'work005', 'trueScale'.toLowerCase(), 'murajach', 'gozdzik', 'glogownik']
    const offenders: string[] = []
    for (const p of patches())
      for (const line of added(p)) {
        const low = line.toLowerCase()
        for (const word of forbidden) if (new RegExp(`(^|[^a-z0-9])${word.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}([^a-z0-9]|$)`).test(low)) offenders.push(`${p}: ${word}`)
      }
    expect(offenders).toEqual([])
  })

  it('every writer refuses an output or a variant copy inside the repository', () => {
    expect(codeOf(read('research/analyzer-005q-chain/replay.mjs'))).toMatch(/if \(work === REPO \|\| work\.startsWith\(REPO \+ '\/'\)\) throw new Error/)
    expect(codeOf(read('research/analyzer-005q-chain/variant.mjs'))).toMatch(/work === REPO \|\| work\.startsWith\(REPO \+ '\/'\)\) throw new Error/)
    expect(codeOf(read('research/analyzer-005q-chain/spec/run-spec.mjs'))).toMatch(/variant\.startsWith\(REPO \+ '\/'\)\) throw new Error/)
  })

  it('the post-review scorer and gate corrections (addendum C) catch each defect the reviews found', () => {
    // one synthetic negative test per fixed P0/P1 (G2c both axes, unverified binding, questionable truth, abstention,
    // one ink on two spans, G2d per element, G2a' for C3/C4, published-area refusal); each failed on the first-scored code
    const run = spawnSync('python3', ['-I', join(ROOT, 'research/analyzer-005q-chain/test_review_fixes.py')], { cwd: ROOT, encoding: 'utf8' })
    expect(run.stderr, run.stderr).toMatch(/Ran 11 tests[\s\S]*\nOK\s*$/)
    expect(run.status).toBe(0)
  })
})

/**
 * BUILDPLAN-ANALYZER-005R — the visual asset router and exterior-observation study is research. It ran a deterministic
 * pixel router (Node), one local open-vocabulary detector (OWL-ViT, Python, weights outside the repository) and the
 * unmodified production acquirer on ARCHON pages read locally. The repository keeps code, text, hashes and aggregate
 * numbers: no publisher pixel, caption, page, crop, synthetic image or model weight; the routers never read metadata.
 */
describe('005R production cannot reach the visual-asset study, which commits no pixels, captions or weights', () => {
  const stageFiles = (): string[] =>
    [
      ...execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n'),
      ...execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' }).split('\n'),
    ].filter((f) => f.startsWith('research/analyzer-005r/') || f.startsWith('stage-reports/artifacts/analyzer-005r/'))

  it('no production source imports research/analyzer-005r or names the detector, the router or the harness', () => {
    const offenders: string[] = []
    for (const f of productionSources()) {
      const text = read(f)
      for (const spec of importsOf(text)) if (/analyzer-005r|research\//.test(spec)) offenders.push(`${f} imports ${spec}`)
      if (/owl-?vit|OwlViT|visual-observations\.0\.1|visual-edition-summary|v1-features@|v1-cart@|v1-cues@|005R/i.test(codeOf(text))) offenders.push(`${f} names the 005R study`)
    }
    expect(offenders).toEqual([])
  })

  it('the study tracks only code and text — no image, page, crop, archive or weight — and no embedded pixels', () => {
    const files = stageFiles()
    expect(files.length).toBeGreaterThan(0)
    expect(files.filter((f) => !/\.(py|mjs|sh|json|md)$/i.test(f))).toEqual([])
    for (const f of files) {
      const text = read(f)
      expect(text, f).not.toMatch(/(data:(image|application)\/[\w.+-]+;base64,|iVBORw0KGgo|\/9j\/4|UklGR|R0lGOD)[A-Za-z0-9+/]{40,}/)
      expect(text, f).not.toMatch(/[A-Za-z0-9+/]{256,}={0,2}/)
      expect(statSync(join(ROOT, f)).size, f).toBeLessThanOrEqual(4 * 2 ** 20)
    }
  })

  it('the committed corpus manifest carries hashes, URLs and channel names but no caption, page text or excluded publisher', () => {
    const manifest = JSON.parse(read('stage-reports/artifacts/analyzer-005r/corpus/corpus-manifest.json')) as {
      assets: Array<{ variantSha256: string; memberships: Array<Record<string, string>> }>
      excludedEditions: Array<{ status: string }>
    }
    expect(manifest.assets.length).toBeGreaterThan(0)
    for (const a of manifest.assets) {
      expect(a.variantSha256).toMatch(/^[0-9a-f]{64}$/)
      for (const m of a.memberships) {
        expect(Object.keys(m).sort()).toEqual(['channel', 'editionKey', 'host', 'url', 'via'])
        expect(m.url).not.toMatch(/dobredomy\.pl/)
      }
    }
    expect(manifest.excludedEditions.every((e) => e.status === 'SOURCE_NOT_USABLE')).toBe(true)
    expect(read('research/analyzer-005r/acquire.py')).toMatch(/'www\.dobredomy\.pl': 'Regulamin §7\.2/)
    // closed key sets at every level of the manifest (reviewer A-10: a caption at asset or edition level must fail too)
    const full = JSON.parse(read('stage-reports/artifacts/analyzer-005r/corpus/corpus-manifest.json')) as Record<string, unknown> & {
      assets: Array<Record<string, unknown>>
      editions: Record<string, Record<string, unknown>>
    }
    expect(Object.keys(full).sort()).toEqual(['assets', 'dhashMax', 'editions', 'excludedEditions', 'failures', 'minSideScored', 'note', 'schema', 'splitSalt'])
    for (const a of full.assets)
      expect(Object.keys(a).sort()).toEqual(['ahash', 'assetId', 'bytes', 'dhash', 'editions', 'families', 'family', 'format', 'height', 'lineageGroup', 'memberships', 'scoredSize', 'split', 'variantSha256', 'width'])
    for (const e of Object.values(full.editions))
      expect(Object.keys(e).sort()).toEqual(['canonicalUrls', 'editionKey', 'family', 'hosts', 'pageSha256', 'pageStatus', 'split', 'variantSha256'])
    // and no committed 005R JSON anywhere carries a caption, title or page-text field
    const textKeys: string[] = []
    const walk = (f: string, x: unknown): void => {
      if (Array.isArray(x)) for (const v of x) walk(f, v)
      else if (x && typeof x === 'object')
        for (const [k, v] of Object.entries(x)) {
          if (/^(captions?|titles?|pageText|rawText|alt|altText|heading|description|html|figcaption)$/i.test(k)) textKeys.push(`${f}: ${k}`)
          walk(f, v)
        }
    }
    for (const f of stageFiles().filter((f) => f.endsWith('.json'))) walk(f, JSON.parse(read(f)))
    expect(textKeys).toEqual([])
  })

  it('the pixel routers and the detector read image bytes only — never a caption, channel, truth or manifest — and the prompts name no project', () => {
    const forbidden = /caption|channel|survey|truth|manifest|editionKey|fancybox|roleTruth/i
    const pyCode = (f: string): string => read(f).replace(/"""[\s\S]*?"""/g, ' ').replace(/#.*$/gm, ' ')
    for (const f of ['research/analyzer-005r/v1/features.mjs', 'research/analyzer-005r/v1/tree.mjs', 'research/analyzer-005r/v1/cues.mjs', 'research/analyzer-005r/v2/run_owlvit.py',
      'research/analyzer-005r/addenda/a1_aspect_v1.mjs', 'research/analyzer-005r/addenda/a1_aspect_v2.py']) {
      expect(f.endsWith('.py') ? pyCode(f) : codeOf(read(f)), f).not.toMatch(forbidden)
    }
    // run.mjs: the feature, predict and cue paths read bytes and a model only; the two fit commands legitimately read
    // DEV truth and are exempt (reviewer A-10)
    const runMjs = codeOf(read('research/analyzer-005r/v1/run.mjs'))
    const pixelPaths = [
      /if \(cmd === 'features'\)[\s\S]*?(?=\} else if \(cmd === 'fit-v1'\))/.exec(runMjs)?.[0] ?? '',
      /\} else if \(cmd === 'predict'\)[\s\S]*$/.exec(runMjs)?.[0] ?? '',
    ]
    for (const part of pixelPaths) {
      expect(part.length).toBeGreaterThan(200)
      expect(part).not.toMatch(forbidden)
    }
    const manifest = JSON.parse(read('stage-reports/artifacts/analyzer-005r/corpus/corpus-manifest.json')) as { editions: Record<string, { family: string; canonicalUrls: string[] }> }
    const names = new Set<string>()
    for (const e of Object.values(manifest.editions)) {
      for (const t of e.family.split(':')[1].split('-')) if (t.length >= 5) names.add(t)
      for (const u of e.canonicalUrls) for (const t of (/\/projekt-([a-z0-9-]+)-m[0-9a-f]{8,}/.exec(u)?.[1] ?? '').split('-')) if (t.length >= 5) names.add(t)
    }
    const prompts = /PROMPTS = \{[\s\S]*?\n\}\n/.exec(read('research/analyzer-005r/v2/run_owlvit.py'))?.[0] ?? ''
    expect(prompts.length).toBeGreaterThan(100)
    expect([...names].filter((n) => new RegExp(`\\b${n}\\b`, 'i').test(prompts))).toEqual([])
    expect(prompts).not.toMatch(/archon|rarytas|m²|area|powierzch/i)
  })

  it('every pixel writer refuses an output directory inside the repository', () => {
    expect(read('research/analyzer-005r/acquire.py')).toMatch(/REFUSED: publisher bytes never go inside the repository/)
    expect(read('research/analyzer-005r/synth.py')).toMatch(/REFUSED: generated images stay outside the repository/)
    const run = spawnSync('python3', ['-I', join(ROOT, 'research/analyzer-005r/acquire.py'), 'fetch', join(ROOT, 'tmp-005r-refused')], { cwd: ROOT, encoding: 'utf8' })
    expect(run.status).not.toBe(0)
    expect(existsSync(join(ROOT, 'tmp-005r-refused'))).toBe(false)
  })

  it('the research JSON contract rejects every preregistered mutation (source and edition swap, fabricated box, leakage, interior to exterior, false confidence)', () => {
    const run = spawnSync('python3', ['-I', join(ROOT, 'research/analyzer-005r/schema/test_schema.py')], { cwd: ROOT, encoding: 'utf8' })
    expect(run.stderr, run.stderr).toMatch(/Ran \d+ tests[\s\S]*\nOK\s*$/)
    expect(run.status).toBe(0)
  })
})

/**
 * BUILDPLAN-ANALYZER-005R-ROUTER — the source-role guard study is research around one bounded production gate. Its
 * harnesses replay sealed development packages offline and write every output outside the repository; the repository
 * keeps code, text, hashes and aggregate numbers: no publisher pixel, caption, page or weight.
 */
describe('005R-ROUTER production cannot reach the router study, which commits no pixels or captions', () => {
  const stageFiles = (): string[] =>
    [
      ...execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n'),
      ...execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' }).split('\n'),
    ].filter((f) => f.startsWith('research/analyzer-005r-router/') || f.startsWith('stage-reports/artifacts/analyzer-005r-router/'))

  it('no production source imports the router study or names its harness', () => {
    const offenders: string[] = []
    for (const f of productionSources()) {
      const text = read(f)
      for (const spec of importsOf(text)) if (/analyzer-005r-router|research\//.test(spec)) offenders.push(`${f} imports ${spec}`)
      if (/005R-ROUTER|run-case\.ts|r1_meta|spot_review/i.test(codeOf(text))) offenders.push(`${f} names the router study`)
    }
    expect(offenders).toEqual([])
  })

  it('the study tracks only code and text, with no embedded pixels and no caption, title or page-text field', () => {
    const files = stageFiles()
    expect(files.length).toBeGreaterThan(0)
    expect(files.filter((f) => !/\.(py|mjs|ts|sh|json|md|patch)$/i.test(f))).toEqual([])
    const textKeys: string[] = []
    const walk = (f: string, x: unknown): void => {
      if (Array.isArray(x)) for (const v of x) walk(f, v)
      else if (x && typeof x === 'object')
        for (const [k, v] of Object.entries(x)) {
          if (/^(captions?|titles?|pageText|rawText|alt|altText|heading|description|html|figcaption|url|localPath)$/i.test(k)) textKeys.push(`${f}: ${k}`)
          walk(f, v)
        }
    }
    for (const f of files) {
      const text = read(f)
      expect(text, f).not.toMatch(/(data:(image|application)\/[\w.+-]+;base64,|iVBORw0KGgo|\/9j\/4|UklGR|R0lGOD)[A-Za-z0-9+/]{40,}/)
      expect(text, f).not.toMatch(/[A-Za-z0-9+/]{256,}={0,2}/)
      expect(statSync(join(ROOT, f)).size, f).toBeLessThanOrEqual(4 * 2 ** 20)
      if (f.endsWith('.json')) walk(f, JSON.parse(text))
    }
    expect(textKeys).toEqual([])
  })

  it('every replay writer refuses an output inside the repository, and the replay refuses publishers screened unusable', () => {
    for (const f of ['research/analyzer-005r-router/run-case.ts', 'research/analyzer-005r-router/ledger.ts']) expect(read(f)).toMatch(/REFUSED: replay outputs never go inside the repository/)
    expect(read('research/analyzer-005r-router/replay.mjs')).toMatch(/throw new Error\('replays live outside the repository'\)/)
    expect(read('research/analyzer-005r-router/replay.mjs')).toMatch(/USABLE_HOSTS = new Set\(\['www\.archon\.pl', 'www\.projektydomownowoczesnych\.pl'\]\)/)
    expect(read('research/analyzer-005r-router/variant.mjs')).toMatch(/a variant copy lives outside the repository/)
    for (const f of ['research/analyzer-005r-router/spot_review.py', 'research/analyzer-005r-router/r1_meta.py']) {
      const run = spawnSync('python3', ['-I', join(ROOT, f), 'x', 'y', join(ROOT, 'tmp-005r-router-refused'), join(ROOT, 'tmp-005r-router-refused.json'), 'z'], { cwd: ROOT, encoding: 'utf8' })
      expect(run.status, f).not.toBe(0)
      expect(existsSync(join(ROOT, 'tmp-005r-router-refused')) || existsSync(join(ROOT, 'tmp-005r-router-refused.json'))).toBe(false)
    }
  })
})

/**
 * BUILDPLAN-ANALYZER-005R-EXTERIOR — source-linked exterior evidence JSON is research. It reads the hashed 005R corpus,
 * cached page text and sealed N1v production runs locally, decodes no pixel for interpretation and shows no image to
 * any model. The repository keeps code, hashes, ids, channel names, caption classes, claim kind sets and counts.
 */
describe('005R-EXTERIOR production cannot reach the exterior evidence study, which commits no pixels, captions or text', () => {
  const stageFiles = (): string[] =>
    [
      ...execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n'),
      ...execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' }).split('\n'),
    ].filter((f) => f.startsWith('research/analyzer-005r-exterior/'))

  it('no production source imports the study or names its contract', () => {
    const offenders: string[] = []
    for (const f of productionSources()) {
      const text = read(f)
      for (const spec of importsOf(text)) if (/analyzer-005r-exterior|research\//.test(spec)) offenders.push(`${f} imports ${spec}`)
      if (/exterior-proposals\.0\.1|005R-EXTERIOR|TECHNICALLY_CORROBORATED/i.test(codeOf(text))) offenders.push(`${f} names the 005R-EXTERIOR study`)
    }
    expect(offenders).toEqual([])
  })

  it('the study tracks only code and text, with no embedded pixels, local paths, URLs or caption/text fields', () => {
    const files = stageFiles()
    expect(files.length).toBeGreaterThan(0)
    expect(files.filter((f) => !/\.(py|json|md)$/i.test(f))).toEqual([])
    const textKeys: string[] = []
    const walk = (f: string, x: unknown): void => {
      if (Array.isArray(x)) for (const v of x) walk(f, v)
      else if (x && typeof x === 'object')
        for (const [k, v] of Object.entries(x)) {
          if (/^(captions?|titles?|pageText|rawText|alt|altText|heading|description|html|figcaption|urls?|localPath|localFile|why)$/i.test(k)) textKeys.push(`${f}: ${k}`)
          walk(f, v)
        }
    }
    for (const f of files) {
      const text = read(f)
      expect(text, f).not.toMatch(/(data:(image|application)\/[\w.+-]+;base64,|iVBORw0KGgo|\/9j\/4|UklGR|R0lGOD)[A-Za-z0-9+/]{40,}/)
      expect(text, f).not.toMatch(/[A-Za-z0-9+/]{256,}={0,2}/)
      expect(statSync(join(ROOT, f)).size, f).toBeLessThanOrEqual(4 * 2 ** 20)
      if (f.endsWith('.json')) {
        expect(text, f).not.toMatch(/https?:\/\/|\/home\/|\/tmp\//)
        walk(f, JSON.parse(text))
      }
    }
    expect(textKeys).toEqual([])
  })

  it('every private writer refuses an output inside the repository', () => {
    for (const [f, args] of [
      ['research/analyzer-005r-exterior/ledger.py', ['x', 'y', 'z', join(ROOT, 'tmp-005r-exterior-refused'), join(ROOT, 'tmp-005r-exterior-refused.json')]],
      ['research/analyzer-005r-exterior/gates.py', ['x', join(ROOT, 'tmp-005r-exterior-refused.json'), join(ROOT, 'tmp-005r-exterior-refused'), 'r']],
    ] as const) {
      const run = spawnSync('python3', ['-I', join(ROOT, f), ...args], { cwd: ROOT, encoding: 'utf8' })
      expect(run.status, f).not.toBe(0)
      expect(run.stderr + run.stdout, f).toMatch(/REFUSED: private ledgers and publisher-derived files stay outside the repository/)
      expect(existsSync(join(ROOT, 'tmp-005r-exterior-refused')) || existsSync(join(ROOT, 'tmp-005r-exterior-refused.json'))).toBe(false)
    }
  })

  it('the research JSON contract refuses every preregistered mutation (edition mix and laundering, perspective authority, interior to exterior, fabricated corroboration)', () => {
    const run = spawnSync('python3', ['-I', join(ROOT, 'research/analyzer-005r-exterior/schema/test_schema.py')], { cwd: ROOT, encoding: 'utf8' })
    expect(run.stderr, run.stderr).toMatch(/Ran \d+ tests[\s\S]*\nOK\s*$/)
    expect(run.status).toBe(0)
    // the independent audit's forgery suite (addendum E), built from the committed manifest and B1 output
    const forged = spawnSync('python3', ['-I', join(ROOT, 'research/analyzer-005r-exterior/schema/test_bypasses.py')], { cwd: ROOT, encoding: 'utf8' })
    expect(forged.stdout, forged.stdout + forged.stderr).toMatch(/OK: \d+ forgeries refused/)
    expect(forged.status).toBe(0)
  })

  it('the committed gates record the sealed preregistration, all seven hard gates and the scope freeze', () => {
    const g = JSON.parse(read('research/analyzer-005r-exterior/results/gates.json')) as {
      preregistrationSha256: string
      hardGatesPass: boolean
      gates: Record<string, { pass: boolean }>
    }
    expect(Object.keys(g.gates).sort()).toEqual(['G1_variant_isolation', 'G2_interiors', 'G3_perspective_authority', 'G4_lookalikes', 'G5_stability', 'G6_evidence_validity', 'G7_scope_freeze'])
    expect(g.preregistrationSha256).toMatch(/^[0-9a-f]{64}$/)
    expect(g.hardGatesPass).toBe(true)
  })
})

/**
 * BUILDPLAN-ANALYZER-005R-EXTERIOR OWNER truth pack — a local, offline review page and its source-free queue. The pack
 * holds code, ids, byte hashes, project-page addresses and the OWNER's future answers; never a publisher pixel. Only a
 * person's click may write an answer, and production never reaches it.
 */
describe('005R-EXTERIOR OWNER review pack stays research, offline and pixel-free', () => {
  const DIR = 'research/analyzer-005r-exterior-owner-review/'
  const packFiles = (): string[] =>
    [
      ...execFileSync('git', ['ls-files'], { cwd: ROOT, encoding: 'utf8' }).split('\n'),
      ...execFileSync('git', ['ls-files', '--others', '--exclude-standard'], { cwd: ROOT, encoding: 'utf8' }).split('\n'),
    ].filter((f) => f.startsWith(DIR))

  it('no production source imports or names the review pack', () => {
    const offenders: string[] = []
    for (const f of productionSources()) {
      const text = read(f)
      for (const spec of importsOf(text)) if (/owner-review/.test(spec)) offenders.push(`${f} imports ${spec}`)
      if (/owner-review-(queue|labels)|OWNER_LOCAL_REVIEW|OwnerReviewCore/.test(codeOf(text))) offenders.push(`${f} names the review pack`)
    }
    expect(offenders).toEqual([])
  })

  it('tracks only text: no picture, no embedded pixels, URLs only as public project pages', () => {
    const files = packFiles()
    expect(files.length).toBeGreaterThan(10)
    expect(files.filter((f) => !/\.(py|json|md|js|mjs|css|html)$/i.test(f))).toEqual([])
    const textKeys: string[] = []
    const walk = (f: string, x: unknown): void => {
      if (Array.isArray(x)) for (const v of x) walk(f, v)
      else if (x && typeof x === 'object')
        for (const [k, v] of Object.entries(x)) {
          if (/^(captions?|titles?|pageText|rawText|alt|altText|heading|description|html|figcaption|urls?|imageUrl|localPath|localFile)$/i.test(k)) textKeys.push(`${f}: ${k}`)
          walk(f, v)
        }
    }
    for (const f of files) {
      const text = read(f)
      expect(text, f).not.toMatch(/(data:(image|application)\/[\w.+-]+;base64,|iVBORw0KGgo|\/9j\/4|UklGR|R0lGOD|Qk[0-9A-Za-z+/]{2}AAAAAAA)[A-Za-z0-9+/]{40,}/)
      expect(text, f).not.toMatch(/[A-Za-z0-9+/]{256,}={0,2}/)
      expect(text, f).not.toMatch(/\/home\/|\/tmp\/|\/root\//)
      expect(statSync(join(ROOT, f)).size, f).toBeLessThanOrEqual(2 ** 20)
      // data and documents (not the scripts that build or check them) may name only public project pages
      const isData = /\.(json|md|html)$/.test(f) || /\/(pack|examples)\//.test(f)
      for (const m of isData ? text.matchAll(/https?:\/\/[^\s"'`)<>]+/g) : []) {
        const ok = /^https:\/\/www\.archon\.pl\/projekty-domow\/[a-z0-9-]+$/.test(m[0]) || /^http:\/\/127\.0\.0\.1:/.test(m[0])
        expect(ok, `${f}: ${m[0]}`).toBe(true)
      }
      if (f.endsWith('.json')) walk(f, JSON.parse(text))
    }
    expect(textKeys).toEqual([])
    // image addresses (any host, any extension) never appear, not even the CDN the publisher serves pictures from
    const data = files.filter((f) => /\.(json|md|html)$/.test(f) || /\/(pack|examples)\//.test(f))
    expect(data.filter((f) => /cdn1\.archon|assets\.archon|\.jpe?g\b|\.png\b|\.webp\b/i.test(read(f)))).toEqual([])
  })

  it('the page is offline by construction: a closed CSP and no network API in the page code', () => {
    const html = read(`${DIR}review.html`)
    expect(html).toMatch(/default-src 'none'; script-src 'self'; style-src 'self'; img-src blob:; connect-src 'none'/)
    for (const f of ['review-core.js', 'review-ui.js', 'boot.js', 'sha256.js'])
      expect(codeOf(read(`${DIR}tool/${f}`)), f).not.toMatch(/\bfetch\(|XMLHttpRequest|WebSocket|sendBeacon|EventSource|navigator\.serviceWorker|\bimport\(/)
  })

  it('private and pixel writers refuse the repository', () => {
    for (const [f, args] of [
      ['make_synthetic_demo.py', [join(ROOT, 'tmp-owner-review-refused')]],
      ['check_page_access.py', [join(ROOT, 'tmp-owner-review-refused')]],
    ] as const) {
      const run = spawnSync('python3', ['-I', join(ROOT, DIR, f), ...args], { cwd: ROOT, encoding: 'utf8' })
      expect(run.status, f).not.toBe(0)
      expect(run.stderr + run.stdout, f).toMatch(/REFUSED/)
      expect(existsSync(join(ROOT, 'tmp-owner-review-refused'))).toBe(false)
    }
  })

  it('the queue rebuilds byte-identically and its rule and review tests pass', () => {
    const check = spawnSync('python3', ['-I', join(ROOT, DIR, 'build_pack.py'), '--check'], { cwd: ROOT, encoding: 'utf8' })
    expect(check.stdout + check.stderr).toMatch(/OK: pack reproducible/)
    const py = spawnSync('python3', ['-I', join(ROOT, DIR, 'test/test_pack.py')], { cwd: ROOT, encoding: 'utf8' })
    expect(py.stderr, py.stderr).toMatch(/Ran \d+ tests[\s\S]*\nOK\s*$/)
    const node = spawnSync(process.execPath, ['--test', join(ROOT, DIR, 'test/core.test.mjs')], { cwd: ROOT, encoding: 'utf8' })
    expect(node.stdout, node.stdout + node.stderr).toMatch(/# fail 0/)
    expect(node.status).toBe(0)
  })

  it('no human truth is claimed: the committed template is empty and the only filled example is SYNTHETIC', () => {
    const t = JSON.parse(read(`${DIR}pack/labels-template-EMPTY.json`)) as { labels: { status: string; reviewerOrigin: unknown }[] }
    expect(t.labels.every((l) => l.status === 'UNREVIEWED' && l.reviewerOrigin === null)).toBe(true)
    const tracked = packFiles().filter((f) => f.endsWith('.json'))
    for (const f of tracked) expect(read(f), f).not.toMatch(/"OWNER_LOCAL_REVIEW"/)
    const ex = JSON.parse(read(`${DIR}examples/example-labels-SYNTHETIC.json`)) as { packKind: string; labels: { reviewerOrigin: string | null }[] }
    expect(ex.packKind).toBe('SYNTHETIC')
    expect(ex.labels.every((l) => l.reviewerOrigin === null || l.reviewerOrigin === 'SYNTHETIC_EXAMPLE')).toBe(true)
    const cov = JSON.parse(read(`${DIR}results/coverage.json`)) as { humanTruth: string; classAccuracy: string }
    expect([cov.humanTruth, cov.classAccuracy]).toEqual(['NOT_RUN', 'NOT_MEASURED'])
  })
})

/**
 * IU-01 IMAGE UNDERSTANDING — the image-role classifier is research (`research/image-understanding/`): Python, frozen
 * pretrained backbones and a linear head, run offline from a virtual environment outside the repository. Publisher
 * pixels, Commons pixels, embeddings, weights and the fitted head stay outside Git; the repository keeps code, the
 * hash-keyed labels and text results. Production may not reach any of it.
 */
describe('IU-01 production cannot reach the image-role research, and it commits no pixels or weights', () => {
  const DIR = 'research/image-understanding/'
  const tracked = (): string[] => execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', DIR, 'stage-reports/artifacts/iu-01/', 'stage-reports/artifacts/iu-02/'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean)

  it('no production source imports research/image-understanding or names its harness', () => {
    for (const f of productionSources()) {
      const src = read(f)
      expect(importsOf(src).filter((i) => i.includes('image-understanding')), f).toEqual([])
      expect(codeOf(src), f).not.toMatch(/image-understanding|iu_classify|iu01-head/)
    }
  })

  it('the harness and its artifacts track only code and text — no image, embedding, weight or archive, each file small', () => {
    const files = tracked()
    expect(files.length).toBeGreaterThan(0)
    for (const f of files) {
      expect(f, f).toMatch(/\.(py|ts|md|json|csv|txt)$/)
      expect(statSync(join(ROOT, f)).size, f).toBeLessThan(1_500_000)
      expect(read(f), f).not.toMatch(/data:image\/|iVBORw0KGgo|\/9j\/4AAQ/)
    }
  })

  it('every writer of pixels, embeddings or the fitted head refuses a destination inside the repository', () => {
    const runs: Array<[string, string[]]> = [
      ['iu_classify.py', ['--folder', '/nonexistent', '--out', join(ROOT, 'tmp-iu-refused')]],
      ['geometry_corpus.py', [join(ROOT, 'tmp-iu-refused.json'), '/nonexistent']],
      ['iu/sheets.py', ['--index', '/nonexistent', '--out', join(ROOT, 'tmp-iu-refused')]],
      ['data/fetch_commons.py', ['--out', join(ROOT, 'tmp-iu-refused'), '--queries', '[]']],
    ]
    for (const [f, args] of runs) {
      const run = spawnSync('python3', ['-I', join(ROOT, DIR, f), ...args], { cwd: ROOT, encoding: 'utf8' })
      expect(run.status, f).not.toBe(0)
      expect(run.stderr + run.stdout, f).toMatch(/REFUSED/)
    }
    for (const f of ['evaluate.py', 'build_derived.py', 'embed_corpus.py']) {
      const run = spawnSync('python3', ['-I', join(ROOT, DIR, f), '--images', '/nonexistent'], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, IU_WORK: join(ROOT, 'tmp-iu-refused') } })
      expect(run.status, f).not.toBe(0)
      expect(run.stderr + run.stdout, f).toMatch(/REFUSED/)
    }
    expect(existsSync(join(ROOT, 'tmp-iu-refused'))).toBe(false)
  })

  it('inference runs behind the offline guard and the labels name no URL, caption or slug', () => {
    for (const f of ['iu_classify.py', 'embed_corpus.py', 'evaluate.py', 'geometry_corpus.py']) expect(read(`${DIR}${f}`), f).toMatch(/offline_guard\(\)/)
    const labels = read(`${DIR}data/labels-archon.json`)
    expect(labels).not.toMatch(/https?:\/\/|archon\.pl|\.jpg|\.gif/)
  })

  it('the Android build packages nothing from IU-01', () => {
    for (const f of filesUnder('apps/android', /\.gradle\.kts$/)) expect(read(f), f).not.toMatch(/image-understanding|onnx.*mobilenet/i)
  })
})

/**
 * IU-02 GEOMETRY-FIRST IMAGE UNDERSTANDING — projection test, segmentation bake-off, clean-facade preprocessor and the
 * fused classifier extend the same research directory. Synthetic renders, LoC/Commons/ARCHON pixels, clean facades,
 * masks, embeddings, weights and the fitted head stay outside Git; production may not reach `iu2/` or the harness.
 */
/**
 * IU-03A SAFE ROUTING + GEOMETRY PRESERVATION — the VETO_ONLY router and FacadeGeometryEvidence (`iu3/`) are research.
 * The router can only take an image AWAY from the facade extractor and hands the roles it was given back unchanged;
 * the evidence adapter feeds a research COPY of the observation graph to the unchanged solver. Production may not
 * reach any of it, and nothing it writes lands in the repository.
 */
describe('IU-03A production cannot reach the routing/evidence research, and its writers refuse the repository', () => {
  const DIR = 'research/image-understanding/'

  it('no production source imports iu3 or names its router, evidence or adapter', () => {
    for (const f of productionSources()) {
      const src = read(f)
      expect(importsOf(src).filter((i) => /(^|\/)iu3(\/|$)/.test(i)), f).toEqual([])
      expect(codeOf(src), f).not.toMatch(/VETO_ONLY|facade-geometry-evidence|iu03\.|extractor_variants|RESEARCH_IU03/)
    }
  })

  it('every IU-03A writer refuses a destination inside the repository', () => {
    const bad = join(ROOT, 'tmp-iu03-refused')
    const py: Array<[string, string[]]> = [
      ['iu3/dev_inputs.py', []],
      ['iu3/evaluate.py', ['dev', '--out', join(bad, 'x.json')]],
      ['iu3/facade_variants.py', ['--house', 'x', '--assets', '/nonexistent', '--out', bad]],
      ['iu3/negatives.py', ['--out', bad]],
      ['iu3/negatives_eval.py', ['--neg', '/nonexistent', '--t-veto', '0.6', '--out', join(bad, 'x.json')]],
    ]
    for (const [f, args] of py) {
      const run = spawnSync('python3', ['-I', join(ROOT, DIR, f), ...args], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, IU_WORK3: bad } })
      expect(run.status, f).not.toBe(0)
      expect(run.stderr + run.stdout, f).toMatch(/REFUSED/)
    }
    expect(existsSync(bad)).toBe(false)
    for (const f of ['iu3/legacy_roles.ts', 'iu3/extractor_variants.ts']) expect(read(`${DIR}${f}`), f).toMatch(/REFUSED: /)
  })

  it('VETO_ONLY never adds a facade route and never rewrites roles; the adapter never writes the sealed graph', () => {
    const route = read(`${DIR}iu3/route.py`)
    expect(route).toMatch(/if legacy_route != 'FACADE':\n(.*\n){0,3}\s+return Decision\(False, legacy_route, roles, diag\)/)
    expect(read(`${DIR}iu3/evaluate.py`)).toMatch(/assert d\.roles is roles/)
    const adapter = read(`${DIR}iu3/extractor_variants.ts`)
    expect(adapter).not.toMatch(/writeFileSync\([^)]*observation-graph/)
    expect(read(`${DIR}iu3/evidence.py`)).toMatch(/'independentlyDetected': box_occ < OCCLUDED_SHARE/)
  })
})

/**
 * IU-03B LIGHTWEIGHT MASKED PERSPECTIVE VETO — a second look inside a classical (sky/foliage-free) mask, added after
 * IU-03A's VETO_ONLY (`iu3b/`). Research only: it runs on top of the unchanged IU-03A router, can only take an image
 * AWAY from the facade extractor, hands the roles back unchanged, and nothing it writes lands in the repository.
 */
describe('IU-03B production cannot reach the masked-veto research, and its writers refuse the repository', () => {
  const DIR = 'research/image-understanding/'

  it('no production source imports iu3b or names its veto, mask or control set', () => {
    for (const f of productionSources()) {
      const src = read(f)
      expect(importsOf(src).filter((i) => /(^|\/)iu3b(\/|$)/.test(i)), f).toEqual([])
      expect(codeOf(src), f).not.toMatch(/STOP_PERSPECTIVE_MASKED|iu3bsynth|iu3bneg|iu3barchon|labels-archon-iu03b/)
    }
  })

  it('every IU-03B writer refuses a destination inside the repository', () => {
    const bad = join(ROOT, 'tmp-iu03b-refused')
    for (const f of ['collect.py', 'analyse_dev.py', 'evaluate_control.py', 'control_inputs.py', 'control_synth.py']) {
      const run = spawnSync('python3', ['-I', join(ROOT, DIR, 'iu3b', f), '--out', join(bad, 'x.json'), '--rows', '/nonexistent'], { cwd: ROOT, encoding: 'utf8' })
      expect(run.status, f).not.toBe(0)
      expect(run.stderr + run.stdout, f).toMatch(/REFUSED/)
    }
    expect(existsSync(bad)).toBe(false)
  })

  it('the masked stage runs only after the unchanged IU-03A router keeps the facade, and never adds one', () => {
    const veto = read(`${DIR}iu3b/veto.py`)
    expect(veto).toMatch(/v = route\.veto_only\(legacy_route, roles, list\(p\), c\['full'\]\['state'\], t_veto\)/)
    expect(veto).toMatch(/if not v\.facade or not masked:\n\s+return out/)
    expect(veto).not.toMatch(/'facade': True/)
    expect(read(`${DIR}iu3b/evaluate_control.py`)).toMatch(/assert d\['roles'\] is roles/)
  })
})

describe('IU-02 production cannot reach the geometry-first research, and its writers refuse the repository', () => {
  const DIR = 'research/image-understanding/'

  it('no production source imports iu2 or names the IU-02 harness, head or extractor comparison', () => {
    for (const f of productionSources()) {
      const src = read(f)
      expect(importsOf(src).filter((i) => i.includes('image-understanding') || /(^|\/)iu2(\/|$)/.test(i)), f).toEqual([])
      expect(codeOf(src), f).not.toMatch(/iu2_train|iu2_final|iu02-head|extractor_compare|clean-facade\.png/)
    }
  })

  it('every IU-02 writer of pixels, features, masks, the head or results refuses a destination inside the repository', () => {
    const bad = join(ROOT, 'tmp-iu02-refused')
    const runs: Array<[string, string[]]> = [
      ['geo_features.py', ['--tag', 'x', '--images', '/nonexistent']],
      ['eval_clean_synth.py', ['--synth', '/nonexistent', '--out', bad]],
      ['iu2_final.py', ['--sets', 'FINAL_LOC', '--out', join(bad, 'final.json')]],
      ['iu2_train.py', []],
      ['iu2/synth3d.py', ['--out', bad, '--prefix', 'x', '--seed', '1', '--houses', '1']],
      ['data/fetch_loc.py', ['--out', bad, '--queries', '[]']],
      ['iu2_draw_archon.py', ['0000', '1', `${bad}.json`]],
    ]
    for (const [f, args] of runs) {
      const run = spawnSync('python3', ['-I', join(ROOT, DIR, f), ...args], { cwd: ROOT, encoding: 'utf8', env: { ...process.env, IU_WORK2: bad } })
      expect(run.status, f).not.toBe(0)
      expect(run.stderr + run.stdout, f).toMatch(/REFUSED/)
    }
    expect(existsSync(bad)).toBe(false)
    expect(read(`${DIR}iu2/clean.py`)).toMatch(/refuse_inside_repo\(outdir, 'clean facade'\)/)
    expect(read(`${DIR}extractor_compare.ts`)).toMatch(/REFUSED: comparison outputs never go inside the repository/)
  })

  it('model fitting and final evaluation run behind the offline guard; LoC labels carry rights, not publisher addresses', () => {
    for (const f of ['iu2_train.py', 'iu2_final.py', 'eval_clean_synth.py']) expect(read(`${DIR}${f}`), f).toMatch(/offline_guard\(\)/)
    const loc = JSON.parse(read(`${DIR}data/labels-loc.json`)) as { rows: Array<{ rights: string; labelSource: string }> }
    expect(loc.rows.length).toBeGreaterThan(0)
    for (const r of loc.rows) {
      expect(r.rights).toMatch(/No known restrictions/)
      expect(r.labelSource).not.toMatch(/MODEL|PREDICT/)
    }
    expect(read(`${DIR}data/labels-loc.json`)).not.toMatch(/archon\.pl/)
  })
})
