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
import { execFileSync } from 'node:child_process'
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
