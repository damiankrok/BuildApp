/**
 * The viewer's category filters (03G): roof assemblies, exterior assemblies,
 * structural members and unknown assemblies shown or hidden as a whole.
 */
import { describe, expect, it } from 'vitest'
import { buildFixture, fixtureById } from '@buildapp/architecture/fixtures'
import { EditorStore, viewCategoriesOf } from '../src/index.js'

describe('category filters', () => {
  it('file each object under what it is part of', () => {
    const m = buildFixture(fixtureById('exterior-pergola'))
    const c = viewCategoriesOf(m)
    expect([...(c.get('pergola-post-1') ?? [])].sort()).toEqual(['EXTERIOR_ASSEMBLIES', 'STRUCTURAL_MEMBERS'])
    expect([...(c.get('roof-main-plane-front') ?? [])]).toEqual(['ROOF_ASSEMBLIES'])
    expect(c.get('ring-0-w0')).toBeUndefined()
    const u = viewCategoriesOf(buildFixture(fixtureById('unknown-feature')))
    expect([...(u.get('unknown-roof-feature') ?? [])]).toEqual(['UNKNOWN'])
  })

  it('hide and show whole categories, and Show all restores them', () => {
    const store = new EditorStore(buildFixture(fixtureById('exterior-pergola')))
    const visible = (): string[] => [...new Set(store.visibleMeshes().map((x) => x.objectId))]
    const all = visible()
    expect(all).toContain('pergola-post-1')
    store.setCategoryVisible('STRUCTURAL_MEMBERS', false)
    expect(visible()).not.toContain('pergola-post-1')
    expect(visible()).not.toContain('pergola-rafter-1')
    expect(visible()).toContain('roof-main-plane-front')
    expect(visible()).toContain('terrace-rear')
    store.setCategoryVisible('ROOF_ASSEMBLIES', false)
    expect(visible()).not.toContain('roof-main-plane-front')
    expect(visible()).toContain('ring-0-w0')
    store.resetVisibility()
    expect(visible()).toEqual(all)
  })

  it('an unknown assembly is drawn restrained and can be hidden', () => {
    const store = new EditorStore(buildFixture(fixtureById('unknown-feature')))
    const meshes = store.visibleMeshes().filter((x) => x.objectId === 'unknown-roof-feature')
    expect(meshes.length).toBeGreaterThan(0)
    expect(meshes.every((x) => x.part === 'UNKNOWN_ASSEMBLY')).toBe(true)
    store.setCategoryVisible('UNKNOWN', false)
    expect(store.visibleMeshes().some((x) => x.objectId === 'unknown-roof-feature')).toBe(false)
  })
})
