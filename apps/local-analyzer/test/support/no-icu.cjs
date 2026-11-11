/**
 * TEST ONLY: make this Node process behave like V8 built WITHOUT ICU — what
 * nodejs-mobile ships for Android (`--with-intl=none`). Loaded with
 * `node --require` before the program, so the program sees what it sees on a
 * phone:
 *
 *  - no `Intl` global;
 *  - `String.prototype.localeCompare` compares UTF-16 code units (V8's
 *    builtins-string.cc, `#ifndef V8_INTL_SUPPORT`): the first differing code
 *    unit decides, then the length;
 *  - `String.prototype.normalize` validates its form and returns the string
 *    unchanged;
 *  - `TextDecoder` is Node's JavaScript decoder (`makeTextDecoderJS`,
 *    lib/internal/encoding.js in v18.20.4): only UTF-8 and UTF-16LE, and the
 *    `fatal` option is refused with ERR_NO_ICU when the decoder is made. A
 *    library that makes a strict decoder when its module is evaluated (resvg's
 *    wasm-bindgen glue) therefore stops the whole program on a phone. Without
 *    this line the simulation said "runs" for a bundle that never started on
 *    one (APK 1324..1328).
 */
'use strict'
delete globalThis.Intl
Object.defineProperty(String.prototype, 'localeCompare', {
  configurable: true,
  writable: true,
  value: function localeCompare(that) {
    const a = String(this)
    const b = String(that)
    if (a === b) return 0
    const n = Math.min(a.length, b.length)
    for (let i = 0; i < n; i++) {
      const d = a.charCodeAt(i) - b.charCodeAt(i)
      if (d !== 0) return d
    }
    return a.length - b.length
  },
})
Object.defineProperty(String.prototype, 'normalize', {
  configurable: true,
  writable: true,
  value: function normalize(form) {
    if (form !== undefined && !['NFC', 'NFD', 'NFKC', 'NFKD'].includes(String(form))) throw new RangeError('The normalization form should be one of NFC, NFD, NFKC, NFKD.')
    return String(this)
  },
})
{
  const Native = globalThis.TextDecoder
  const supported = new Set(['utf-8', 'utf-16le'])
  class TextDecoder extends Native {
    constructor(encoding = 'utf-8', options = {}) {
      // the label as WHATWG resolves it; anything the JS decoder has no converter for is refused, as Node refuses it
      const label = new Native(`${encoding}`).encoding
      if (!supported.has(label)) {
        const e = new RangeError(`The "${encoding}" encoding is not supported`)
        e.code = 'ERR_ENCODING_NOT_SUPPORTED'
        throw e
      }
      if (options !== null && options !== undefined && options.fatal) {
        const e = new TypeError('"fatal" option is not supported on Node.js compiled without ICU')
        e.code = 'ERR_NO_ICU'
        throw e
      }
      super(encoding, options ?? undefined)
    }
  }
  Object.defineProperty(globalThis, 'TextDecoder', { configurable: true, writable: true, value: TextDecoder })
}
