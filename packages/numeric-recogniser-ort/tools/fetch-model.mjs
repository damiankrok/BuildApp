/**
 * Fetch and verify the external numeric recogniser's model (BUILDPLAN-ANALYZER-005H). Build time only.
 *
 *   node packages/numeric-recogniser-ort/tools/fetch-model.mjs [--out <dir>] [--verify-only]
 *
 * Reads `models/manifest.json` and, for its model:
 *   1. downloads `inference.onnx` and `inference.yml` from the pinned Hugging Face commit (never `main`);
 *   2. refuses either one unless its SHA-256 is the pinned one;
 *   3. derives the character dictionary from `inference.yml` (`PostProcess.character_dict`) and refuses it unless its
 *      SHA-256 (of the JSON array as written) is the pinned one;
 *   4. writes `<out>/<model file>` and `<out>/<dictionary file>` (default `<out>` = `models/`, gitignored).
 *
 * Files already present and matching are kept; nothing is downloaded for them. `--verify-only` downloads nothing and
 * fails unless every file is present and matches. A mismatch deletes what was written and exits 1. The device never
 * runs this: the APK ships the verified bytes, and nothing is downloaded at run time.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const MANIFEST_PATH = join(here, '..', 'models', 'manifest.json')

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex')

/** One YAML scalar of the `character_dict` list, as the YAML 1.1 loader PaddleOCR uses reads it. */
function yamlScalar(raw) {
  // YAML's white space is space and tab only: an ideographic space (U+3000) is a dictionary entry, not padding.
  const v = raw.replace(/[ \t]+$/, '')
  if (v.startsWith("'")) {
    if (!v.endsWith("'") || v.length < 2) throw new Error(`unterminated single-quoted scalar: ${raw}`)
    return v.slice(1, -1).replace(/''/g, "'")
  }
  if (v.startsWith('"')) {
    if (!v.endsWith('"') || v.length < 2) throw new Error(`unterminated double-quoted scalar: ${raw}`)
    return JSON.parse(v.replace(/\\x([0-9a-fA-F]{2})/g, '\\u00$1'))
  }
  return v
}

/** `PostProcess.character_dict` of a PaddleOCR `inference.yml`: the block list under that key, in order. */
export function dictionaryFromInferenceYml(text) {
  const lines = text.split('\n')
  const start = lines.findIndex((l) => /^\s*character_dict:\s*$/.test(l))
  if (start < 0) throw new Error('inference.yml has no character_dict')
  const indent = lines[start].match(/^\s*/)[0].length
  const out = []
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]
    const m = /^(\s*)- (.*)$/.exec(line)
    if (!m) {
      if (line.trim() === '') continue
      if (line.match(/^\s*/)[0].length <= indent) break
      throw new Error(`unexpected line in character_dict: ${line}`)
    }
    if (m[1].length < indent) break
    out.push(yamlScalar(m[2]))
  }
  return out
}

async function download(url) {
  const res = await fetch(url, { redirect: 'follow' })
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`)
  return new Uint8Array(await res.arrayBuffer())
}

export async function fetchModel({ out = join(here, '..', 'models'), verifyOnly = false } = {}) {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'))
  const model = manifest.models[manifest.default]
  out = resolve(out)
  mkdirSync(out, { recursive: true })
  const modelPath = join(out, model.file)
  const dictPath = join(out, model.dictionary.file)
  const written = []
  try {
    const present = (path, pin) => existsSync(path) && sha256(readFileSync(path)) === pin
    if (!present(modelPath, model.sha256)) {
      if (verifyOnly) throw new Error(`${model.file} is missing or does not match ${model.sha256}`)
      const bytes = await download(`https://huggingface.co/${model.upstream.repo}/resolve/${model.upstream.commit}/${model.upstream.file}`)
      if (bytes.length !== model.bytes || sha256(bytes) !== model.sha256) throw new Error(`${model.upstream.repo}@${model.upstream.commit}/${model.upstream.file}: SHA-256 ${sha256(bytes)} (${bytes.length} B), pinned ${model.sha256} (${model.bytes} B) — refused`)
      writeFileSync(`${modelPath}.partial`, bytes)
      renameSync(`${modelPath}.partial`, modelPath)
      written.push(modelPath)
    }
    if (!present(dictPath, model.dictionary.sha256)) {
      if (verifyOnly) throw new Error(`${model.dictionary.file} is missing or does not match ${model.dictionary.sha256}`)
      const yml = await download(`https://huggingface.co/${model.upstream.repo}/resolve/${model.upstream.commit}/${model.dictionary.source}`)
      if (sha256(yml) !== model.dictionary.sourceSha256) throw new Error(`${model.dictionary.source}: SHA-256 ${sha256(yml)}, pinned ${model.dictionary.sourceSha256} — refused`)
      const dict = dictionaryFromInferenceYml(Buffer.from(yml).toString('utf8'))
      const text = JSON.stringify(dict)
      if (dict.length !== model.dictionary.entries || sha256(text) !== model.dictionary.sha256) throw new Error(`the dictionary derived from ${model.dictionary.source}: ${dict.length} entries, SHA-256 ${sha256(text)}; pinned ${model.dictionary.entries}, ${model.dictionary.sha256} — refused`)
      writeFileSync(`${dictPath}.partial`, text)
      renameSync(`${dictPath}.partial`, dictPath)
      written.push(dictPath)
    }
    return { modelPath, dictPath, written }
  } catch (error) {
    for (const path of written) rmSync(path, { force: true })
    throw error
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const argv = process.argv.slice(2)
  const i = argv.indexOf('--out')
  try {
    const { modelPath, dictPath, written } = await fetchModel({ out: i >= 0 ? argv[i + 1] : undefined, verifyOnly: argv.includes('--verify-only') })
    process.stdout.write(`${modelPath}\n${dictPath}\n${written.length ? `fetched ${written.length} file(s)` : 'already present and verified'}\n`)
  } catch (error) {
    process.stderr.write(`fetch-model: ${error.message}\n`)
    process.exitCode = 1
  }
}
