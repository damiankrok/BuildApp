/**
 * Post-review D5: a pack is complete for its own version, and versions are compared as numbers — a string compare
 * puts 1.10.0 before 1.9.0.
 */
import { describe, expect, it } from 'vitest'
import { compareVersions, PACK_FILES, requiredFiles } from '../src/index.js'

describe('evidence-pack versions', () => {
  it('compares versions component by component, numerically', () => {
    expect(compareVersions('1.10.0', '1.9.0')).toBe(1)
    expect(compareVersions('1.9.0', '1.10.0')).toBe(-1)
    expect(compareVersions('1.1.0', '1.1.0')).toBe(0)
    expect(compareVersions('1.1', '1.1.0')).toBe(0)
    expect(compareVersions('2.0.0', '1.99.99')).toBe(1)
  })

  it('a 1.0.0 pack is complete without the 1.1.0 topology files; 1.1.0 and every later version need them', () => {
    expect(requiredFiles('1.0.0')).not.toContain('07b-dimension-topology.json')
    for (const v of ['1.1.0', '1.2.0', '1.10.0', '2.0.0']) expect(requiredFiles(v)).toEqual([...PACK_FILES])
  })
})
