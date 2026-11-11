/**
 * The strict UTF-8 decoder a runtime without ICU is given (src/utf8-decoder.ts), against this runtime's own ICU
 * decoder, and the launcher that must not let a bundle which cannot load end the Android process.
 */
import { spawnSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { runtimeDecodesUtf8Strictly, strictUtf8Decoder, utf8Validity } from '../src/utf8-decoder.js'

const ICU = globalThis.TextDecoder
/** Node's decoder without ICU, as test/support/no-icu.cjs makes it: `fatal` refused when the decoder is made. */
class NoIcuDecoder extends ICU {
  constructor(label = 'utf-8', options: { fatal?: boolean; ignoreBOM?: boolean } = {}) {
    if (options?.fatal) throw Object.assign(new TypeError('"fatal" option is not supported on Node.js compiled without ICU'), { code: 'ERR_NO_ICU' })
    super(label, options)
  }
}
const Strict = strictUtf8Decoder(NoIcuDecoder as unknown as typeof TextDecoder)

const outcome = (make: () => InstanceType<typeof ICU>, bytes: Uint8Array, stream = false): string => {
  try {
    return `ok:${make().decode(bytes, { stream })}`
  } catch (error) {
    return `throws:${(error as Error).name}`
  }
}

describe('a strict UTF-8 decoder where the runtime refuses one', () => {
  it('the runtime without ICU refuses `fatal`; this one (with ICU) does not — the adapter is installed only there', () => {
    expect(runtimeDecodesUtf8Strictly(ICU)).toBe(true)
    expect(runtimeDecodesUtf8Strictly(NoIcuDecoder as unknown as typeof TextDecoder)).toBe(false)
    expect(() => new NoIcuDecoder('utf-8', { fatal: true })).toThrow(/without ICU/)
    expect(new Strict('utf-8', { fatal: true }).fatal).toBe(true)
    expect(new Strict('utf-8', { fatal: true, ignoreBOM: true }).ignoreBOM).toBe(true)
  })

  it('decides exactly as ICU does on every sequence of one and two bytes, and on every lead with each second byte and a valid tail', () => {
    const cases: Uint8Array[] = []
    for (let a = 0; a < 256; a++) {
      cases.push(Uint8Array.of(a))
      for (let b = 0; b < 256; b++) {
        cases.push(Uint8Array.of(a, b))
        if (a >= 0xe0) cases.push(Uint8Array.of(a, b, 0x80), Uint8Array.of(a, b, 0x80, 0x80), Uint8Array.of(a, b, 0xbf, 0xbf))
      }
    }
    let differ = 0
    for (const bytes of cases) {
      if (outcome(() => new ICU('utf-8', { fatal: true }), bytes) !== outcome(() => new Strict('utf-8', { fatal: true }), bytes)) differ++
    }
    expect(cases.length).toBeGreaterThan(65_000)
    expect(differ).toBe(0)
  })

  it('valid text decodes to the same string; an overlong form, a surrogate and a code point past U+10FFFF are refused', () => {
    const text = 'Dom z poddaszem — żółć, ł, ę, 🏠, 中'
    const bytes = new TextEncoder().encode(text)
    expect(new Strict('utf-8', { fatal: true }).decode(bytes)).toBe(text)
    for (const bad of [[0xc0, 0xaf], [0xe0, 0x80, 0xaf], [0xed, 0xa0, 0x80], [0xf4, 0x90, 0x80, 0x80], [0xff], [0x80]]) {
      expect(() => new Strict('utf-8', { fatal: true }).decode(Uint8Array.from(bad))).toThrow(TypeError)
    }
    // not strict: the replacement character, as before
    expect(new Strict('utf-8').decode(Uint8Array.of(0xff))).toBe('�')
  })

  it('streams: a sequence split across chunks is valid, an incomplete end without `stream` is not', () => {
    const bytes = new TextEncoder().encode('ąę🏠')
    for (let cut = 0; cut <= bytes.length; cut++) {
      const icu = new ICU('utf-8', { fatal: true })
      const strict = new Strict('utf-8', { fatal: true })
      const a = icu.decode(bytes.subarray(0, cut), { stream: true }) + icu.decode(bytes.subarray(cut))
      const b = strict.decode(bytes.subarray(0, cut), { stream: true }) + strict.decode(bytes.subarray(cut))
      expect(b).toBe(a)
    }
    expect(utf8Validity(Uint8Array.of(0xf0, 0x9f), true)).toBe(2)
    expect(utf8Validity(Uint8Array.of(0xf0, 0x9f), false)).toBe(-1)
    expect(() => new Strict('utf-8', { fatal: true }).decode(Uint8Array.of(0xf0, 0x9f))).toThrow(TypeError)
  })

  it('reads every kind of input the runtime reads: an ArrayBuffer, a view into wasm memory, nothing at all', () => {
    const memory = new Uint8Array(64)
    memory.set(new TextEncoder().encode('resvg'), 10)
    const strict = new Strict('utf-8', { ignoreBOM: true, fatal: true })
    expect(strict.decode(memory.subarray(10, 15))).toBe('resvg')
    expect(strict.decode(new DataView(memory.buffer, 10, 5))).toBe('resvg')
    expect(strict.decode(memory.buffer.slice(10, 15))).toBe('resvg')
    expect(strict.decode()).toBe('')
  })

  it('other encodings are the runtime’s to refuse, as before', () => {
    expect(() => new Strict('utf-16le', { fatal: true })).toThrow(/without ICU/)
  })
})

describe('the launcher a phone starts (runtime/main.mjs)', () => {
  it('a bundle that cannot be loaded ends with exit code 4 and its reason on stderr — never a fatal exception, which on Android ends the process', () => {
    const dir = mkdtempSync(join(tmpdir(), 'launcher-'))
    copyFileSync(join(import.meta.dirname, '../runtime/main.mjs'), join(dir, 'main.mjs'))
    writeFileSync(join(dir, 'analyzer.mjs'), "throw Object.assign(new TypeError('\"fatal\" option is not supported on Node.js compiled without ICU'), { code: 'ERR_NO_ICU' })\n")
    const run = spawnSync(process.execPath, [join(dir, 'main.mjs'), '--job', 'a'.repeat(32), '--url', 'https://x.test/', '--work', join(dir, 'w'), '--out', join(dir, 'o')], { encoding: 'utf8' })
    expect(run.status).toBe(4)
    expect(run.stderr).toMatch(/^local analyzer: the analyzer bundle could not be loaded: TypeError: "fatal" option/)
    expect(run.stderr).not.toMatch(/node:internal\/process\/esm_loader|triggerUncaughtException/)
  })
})
