import { describe, expect, it } from 'vitest'
import { angleDeltaDeg, canonicalJson, hashArtifact, hashOrdered, hashUnordered, rectIoU, round6, segmentAngleDeg, sha256Bytes, sha256Hex, slugify, stableId, toNorm } from '../src/index.js'

describe('sha256 (pure implementation)', () => {
  it('reproduces the published FIPS 180-4 vectors', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256Hex('abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe('248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1')
    // the 448-bit boundary and a multi-block message
    expect(sha256Hex('a'.repeat(55))).toBe('9f4390f8d30c2dd92ec9f095b65e2b9ae9b0a925a5258e241c9f1e910f734318')
    expect(sha256Hex('a'.repeat(1000000))).toBe('cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0')
  })

  it('hashes raw bytes, including non-UTF-8 ones', () => {
    expect(sha256Bytes(new Uint8Array([0xde, 0xad, 0xbe, 0xef]))).toBe('5f78c33274e43fa9de5659265c1d917e25c03722dcb0b8d27db8d5feaa813953')
    expect(sha256Bytes(new Uint8Array(0))).toBe(sha256Hex(''))
  })
})

describe('canonical JSON', () => {
  it('sorts keys recursively so build order cannot change the bytes', () => {
    const a = { b: 1, a: { d: [3, 2], c: true } }
    const b = { a: { c: true, d: [3, 2] }, b: 1 }
    expect(canonicalJson(a)).toBe(canonicalJson(b))
    expect(canonicalJson(a)).toBe('{"a":{"c":true,"d":[3,2]},"b":1}')
  })

  it('drops undefined members, keeps null, and normalises negative zero', () => {
    expect(canonicalJson({ a: undefined, b: null })).toBe('{"b":null}')
    expect(canonicalJson({ v: -0 })).toBe('{"v":0}')
    expect(canonicalJson([1, undefined, 2])).toBe('[1,null,2]')
  })

  it('refuses what JSON cannot represent rather than writing null quietly', () => {
    expect(() => canonicalJson({ v: NaN })).toThrow(/cannot represent/)
    expect(() => canonicalJson({ v: Infinity })).toThrow(/cannot represent/)
  })

  it('keeps array order, because an array is ordered content', () => {
    expect(canonicalJson([1, 2])).not.toBe(canonicalJson([2, 1]))
  })
})

describe('artifact hashing', () => {
  it('is order-independent for sets and order-dependent for sequences', () => {
    const x = { id: 'a', v: 1 }
    const y = { id: 'b', v: 2 }
    expect(hashUnordered([x, y])).toBe(hashUnordered([y, x]))
    expect(hashOrdered([x, y])).not.toBe(hashOrdered([y, x]))
  })

  it('distinguishes the same content under a different part label', () => {
    const a = hashArtifact('k', '1.0.0', [{ label: 'observations', unordered: [{ v: 1 }] }])
    const b = hashArtifact('k', '1.0.0', [{ label: 'relations', unordered: [{ v: 1 }] }])
    expect(a).not.toBe(b)
  })

  it('changes when the kind or the version changes', () => {
    const parts = [{ label: 'p', ordered: 1 }]
    expect(hashArtifact('k', '1.0.0', parts)).not.toBe(hashArtifact('k', '1.0.1', parts))
    expect(hashArtifact('k', '1.0.0', parts)).not.toBe(hashArtifact('j', '1.0.0', parts))
  })
})

describe('deterministic ids', () => {
  it('depends on content, not on key order or call order', () => {
    expect(stableId('obs', 'Front elevation', { a: 1, b: 2 })).toBe(stableId('obs', 'Front elevation', { b: 2, a: 1 }))
    expect(stableId('obs', 'x', { a: 1 })).not.toBe(stableId('obs', 'x', { a: 2 }))
  })

  it('slugs readably and trims to a bounded length', () => {
    expect(slugify('Rzut parteru (z powierzchniami)')).toBe('rzut-parteru-z-powierzchniami')
    expect(slugify('Dom w marcówkach (GE)')).toBe('dom-w-marcowkach-ge')
    expect(slugify('x'.repeat(200)).length).toBeLessThanOrEqual(48)
    expect(stableId('obs', '', { a: 1 })).toMatch(/^obs-[0-9a-f]{10}$/)
  })
})

describe('source-native geometry', () => {
  it('normalizes against the DECODED size, which is what makes a variant comparable', () => {
    expect(toNorm({ x: 275, y: 128 }, { width: 550, height: 256 })).toEqual({ x: 0.5, y: 0.5 })
    // the same feature on a 2x variant normalizes to the same place
    expect(toNorm({ x: 550, y: 256 }, { width: 1100, height: 512 })).toEqual({ x: 0.5, y: 0.5 })
  })

  it('measures angles with y DOWN, folded into [0, 180)', () => {
    expect(segmentAngleDeg({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0)
    expect(segmentAngleDeg({ x: 0, y: 0 }, { x: 0, y: 10 })).toBe(90)
    expect(segmentAngleDeg({ x: 0, y: 0 }, { x: 0, y: -10 })).toBe(90)
    // a 40 degree roof slope falling to the right, y down
    expect(segmentAngleDeg({ x: 0, y: 0 }, { x: 10, y: 10 * Math.tan((40 * Math.PI) / 180) })).toBeCloseTo(40, 6)
    expect(angleDeltaDeg(179, 1)).toBe(2)
    expect(angleDeltaDeg(40, 220)).toBe(0)
  })

  it('scores rectangle agreement by intersection over union', () => {
    const r = { x0: 0, y0: 0, x1: 10, y1: 10 }
    expect(rectIoU(r, r)).toBe(1)
    expect(rectIoU(r, { x0: 20, y0: 20, x1: 30, y1: 30 })).toBe(0)
    expect(rectIoU(r, { x0: 0, y0: 0, x1: 10, y1: 5 })).toBe(0.5)
    expect(round6(-0)).toBe(0)
  })
})
