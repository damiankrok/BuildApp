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
 *    unchanged.
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
