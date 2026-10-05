/**
 * The pins: the model, its dictionary and the runtime are exactly what 005G measured, the npm version is exact, and a
 * file that is not its pinned bytes is refused — before ONNX Runtime sees it, and with nothing fetched instead.
 */
import { copyFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MANIFEST, MODEL, RECOGNISER_ID, RecogniserAssetError, readPinned, verifiedAssets, workspaceAssetPaths } from '../src/index.js'
// @ts-expect-error — a plain ES module without type declarations
import { dictionaryFromInferenceYml } from '../tools/fetch-model.mjs'

const ROOT = resolve(import.meta.dirname, '../../..')

describe('the pins are 005G’s', () => {
  it('names the model by repository, commit and SHA-256', () => {
    expect(MANIFEST.default).toBe('PP-OCRv6_tiny_rec')
    expect(MODEL.upstream).toEqual({ host: 'huggingface.co', repo: 'PaddlePaddle/PP-OCRv6_tiny_rec_onnx', commit: '2612ab37152ae0a677521bae4e1e3d4fb4cf7c30', file: 'inference.onnx' })
    expect(MODEL.sha256).toBe('9ef676d6ed3c88256a2d92c640c44f25b0c40947e111b14b8be8f594091563e6')
    expect(MODEL.bytes).toBe(4462639)
    expect(MODEL.license.spdx).toBe('Apache-2.0')
    expect(RECOGNISER_ID).toBe('ocr.ppocrv6-tiny-rec@9ef676d6')
  })

  it('takes ONNX Runtime Web 1.30.0 exactly, and its WebAssembly by hash', () => {
    const pkg = JSON.parse(readFileSync(resolve(import.meta.dirname, '../package.json'), 'utf8')) as { dependencies: Record<string, string> }
    expect(pkg.dependencies['onnxruntime-web']).toBe('1.30.0')
    const lock = JSON.parse(readFileSync(join(ROOT, 'package-lock.json'), 'utf8')) as { packages: Record<string, { version?: string }> }
    expect(lock.packages['node_modules/onnxruntime-web']?.version).toBe('1.30.0')
    expect(MANIFEST.runtime.version).toBe('1.30.0')
    expect(MANIFEST.runtime.files['ort-wasm-simd-threaded.wasm'].sha256).toBe('3398c10d07d229bd91b364548e130e0e51a8e5704b88c7c083ebbeb78842dee2')
  })

  it('the files on disk are the pinned ones', () => {
    const v = verifiedAssets(workspaceAssetPaths())
    expect(v.model.length).toBe(MODEL.bytes)
    expect(v.dictionary.length).toBe(MODEL.dictionary.entries)
  })

  it('ships the licences it names, by hash', () => {
    for (const [name, { sha256 }] of Object.entries(MANIFEST.licenses)) {
      const bytes = readFileSync(join(ROOT, 'apps/android/app/src/main/assets/licenses', name))
      expect(readPinned(join(ROOT, 'apps/android/app/src/main/assets/licenses', name), { sha256 }, name).length).toBe(bytes.length)
    }
  })
})

describe('a file that is not its pin is refused', () => {
  it('one changed byte in the model', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pins-'))
    const paths = workspaceAssetPaths()
    const tampered = join(dir, 'model.onnx')
    copyFileSync(paths.model, tampered)
    const bytes = readFileSync(tampered)
    bytes[bytes.length - 1] ^= 1
    writeFileSync(tampered, bytes)
    expect(() => verifiedAssets({ ...paths, model: tampered })).toThrow(RecogniserAssetError)
    expect(() => verifiedAssets({ ...paths, model: join(dir, 'missing.onnx') })).toThrow(/missing/)
  })

  it('another WebAssembly binary', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pins-'))
    const other = join(dir, 'ort.wasm')
    writeFileSync(other, Buffer.from([0, 97, 115, 109, 1, 0, 0, 0]))
    expect(() => verifiedAssets({ ...workspaceAssetPaths(), wasm: other })).toThrow(/refused/)
  })
})

describe('the dictionary is read from inference.yml as PaddleOCR reads it', () => {
  it('quoted, escaped and plain scalars, and an ideographic space that is an entry, not padding', () => {
    const yml = ['PostProcess:', '  name: CTCLabelDecode', '  character_dict:', "  - '!'", "  - ''''", '  - $', '  - "\\""', '  - 0', '  - 　', "  - ' '", 'Other: 1'].join('\n')
    expect(dictionaryFromInferenceYml(yml)).toEqual(['!', "'", '$', '"', '0', '　', ' '])
  })
})
