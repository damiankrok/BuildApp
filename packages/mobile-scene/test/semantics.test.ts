/**
 * Semantic groups and the architectural palette.
 *
 * Three things are held here: that a mesh's group follows from its compiled
 * part first and its object's facts second; that the palette keeps every
 * pair of commonly adjacent groups apart in luminance, which is the whole
 * reason it exists; and that the two viewers' copies of the palette — the
 * web adapter's and the Kotlin renderer's built-in fallback — are the shared
 * constant, byte for byte, so the same building reads the same way on both.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { createDemoBuilding } from '@buildapp/demo'
import { createMarcowkiReferenceBuilding } from '@buildapp/reference-marcowki'
import { compileBuilding, type GeometryPart } from '@buildapp/geometry'
import type { CanonicalBuildingModel } from '@buildapp/model'
import {
  ADJACENT_GROUPS,
  ARCHITECTURAL_PALETTE,
  ARCHITECTURAL_PALETTE_ID,
  MIN_ADJACENT_LUMINANCE_GAP,
  SEMANTIC_GROUPS,
  TONE_FAMILIES,
  applyToneHints,
  buildMobileSceneBundle,
  bundleStyling,
  edgeGroups,
  objectFactsOf,
  relativeLuminance,
  semanticGroupOf,
  toneOfColor,
  wallFinishes,
  type SemanticGroup,
} from '../src/index.js'

const ROOT = resolve(import.meta.dirname, '../../..')

/** Every part the compiler can emit. Kept explicit so a new part must be placed here and in the switch. */
const ALL_PARTS: GeometryPart[] = [
  'WALL',
  'WALL_REVEAL',
  'WINDOW_FRAME',
  'WINDOW_GLASS',
  'WINDOW_MULLION',
  'DOOR_FRAME',
  'DOOR_LEAF',
  'DOOR_GLASS',
  'DOOR_PANEL',
  'DOOR_HANDLE',
  'SLAB',
  'ROOF',
  'ROOF_REVEAL',
  'ROOFLIGHT_FRAME',
  'ROOFLIGHT_GLASS',
  'BALCONY',
  'RAILING_POST',
  'RAILING_RAIL',
  'RAILING_INFILL',
  'CHIMNEY',
  'ROOM_FLOOR',
  'STAIR_PLACEHOLDER',
  'STAIR_STEP',
  'SURFACE_REGION',
  'LINEAR_SOLID',
  'TERRACE',
  'ROOF_TRIM',
]

describe('semanticGroupOf', () => {
  it('places every compiled part, the two new ones included, in a group other than OTHER', () => {
    for (const part of ALL_PARTS) {
      expect(semanticGroupOf({ objectKind: 'wall', part }), part).not.toBe('OTHER')
    }
    expect(semanticGroupOf({ objectKind: 'wall', part: 'NOT_A_PART' as GeometryPart })).toBe('OTHER')
  })

  it('reads the part first', () => {
    expect(semanticGroupOf({ objectKind: 'wall', part: 'WALL' })).toBe('WALL_MAIN')
    expect(semanticGroupOf({ objectKind: 'wall', part: 'WALL_REVEAL' })).toBe('WALL_MAIN')
    expect(semanticGroupOf({ objectKind: 'roof', part: 'ROOF' })).toBe('ROOF_MAIN')
    expect(semanticGroupOf({ objectKind: 'roof', part: 'ROOF_TRIM' })).toBe('ROOF_TRIM')
    expect(semanticGroupOf({ objectKind: 'balcony', part: 'TERRACE' })).toBe('TERRACE_SURFACE')
    expect(semanticGroupOf({ objectKind: 'balcony', part: 'BALCONY' })).toBe('BALCONY_SLAB')
    expect(semanticGroupOf({ objectKind: 'slab', part: 'SLAB' })).toBe('SLAB')
    expect(semanticGroupOf({ objectKind: 'window', part: 'WINDOW_GLASS' })).toBe('WINDOW_GLASS')
    expect(semanticGroupOf({ objectKind: 'door', part: 'DOOR_GLASS' })).toBe('WINDOW_GLASS')
    expect(semanticGroupOf({ objectKind: 'rooflight', part: 'ROOFLIGHT_GLASS' })).toBe('WINDOW_GLASS')
    expect(semanticGroupOf({ objectKind: 'window', part: 'WINDOW_FRAME' })).toBe('WINDOW_FRAME')
    expect(semanticGroupOf({ objectKind: 'window', part: 'WINDOW_MULLION' })).toBe('WINDOW_FRAME')
    expect(semanticGroupOf({ objectKind: 'door', part: 'DOOR_LEAF' })).toBe('DOOR')
    expect(semanticGroupOf({ objectKind: 'door', part: 'DOOR_HANDLE' })).toBe('DOOR')
    expect(semanticGroupOf({ objectKind: 'railing', part: 'RAILING_POST' })).toBe('RAILING')
    expect(semanticGroupOf({ objectKind: 'railing', part: 'RAILING_RAIL' })).toBe('RAILING')
    expect(semanticGroupOf({ objectKind: 'chimney', part: 'CHIMNEY' })).toBe('CHIMNEY')
    expect(semanticGroupOf({ objectKind: 'rooflight', part: 'ROOFLIGHT_FRAME' })).toBe('ROOFLIGHT')
    expect(semanticGroupOf({ objectKind: 'stair', part: 'STAIR_STEP' })).toBe('STAIR')
    expect(semanticGroupOf({ objectKind: 'stair', part: 'STAIR_PLACEHOLDER' })).toBe('STAIR')
    expect(semanticGroupOf({ objectKind: 'room', part: 'ROOM_FLOOR' })).toBe('ROOM')
    expect(semanticGroupOf({ objectKind: 'surfaceRegion', part: 'SURFACE_REGION' })).toBe('WALL_SECONDARY')
    expect(semanticGroupOf({ objectKind: 'linearSolid', part: 'LINEAR_SOLID' })).toBe('FACADE_FRAME')
  })

  it('then the object facts: roof kind, balcony kind, wall kind, mass role, door assembly, railing infill', () => {
    expect(semanticGroupOf({ objectKind: 'roof', part: 'ROOF', objectFacts: { roofKind: 'FLAT' } })).toBe('FLAT_ROOF')
    expect(semanticGroupOf({ objectKind: 'roof', part: 'ROOF_REVEAL', objectFacts: { roofKind: 'FLAT' } })).toBe('FLAT_ROOF')
    expect(semanticGroupOf({ objectKind: 'roof', part: 'ROOF', objectFacts: { roofKind: 'GABLE' } })).toBe('ROOF_MAIN')
    expect(semanticGroupOf({ objectKind: 'balcony', part: 'BALCONY', objectFacts: { kind: 'TERRACE' } })).toBe('TERRACE_SURFACE')
    expect(semanticGroupOf({ objectKind: 'balcony', part: 'BALCONY', objectFacts: { kind: 'LOGGIA' } })).toBe('BALCONY_SLAB')
    expect(semanticGroupOf({ objectKind: 'wall', part: 'WALL', objectFacts: { wallKind: 'INTERIOR' } })).toBe('WALL_INTERIOR')
    expect(semanticGroupOf({ objectKind: 'wall', part: 'WALL', objectFacts: { wallKind: 'EXTERIOR' } })).toBe('WALL_MAIN')
    expect(semanticGroupOf({ objectKind: 'wall', part: 'WALL', objectFacts: { wallKind: 'EXTERIOR', massRole: 'ATTACHED' } })).toBe('WALL_SECONDARY')
    expect(semanticGroupOf({ objectKind: 'wall', part: 'WALL', objectFacts: { wallKind: 'EXTERIOR', massRole: 'MAIN' } })).toBe('WALL_MAIN')
    // an interior wall is interior whatever body it stands in
    expect(semanticGroupOf({ objectKind: 'wall', part: 'WALL', objectFacts: { wallKind: 'INTERIOR', massRole: 'ATTACHED' } })).toBe('WALL_INTERIOR')
    expect(semanticGroupOf({ objectKind: 'door', part: 'DOOR_PANEL', objectFacts: { kind: 'PANEL' } })).toBe('GARAGE_DOOR')
    expect(semanticGroupOf({ objectKind: 'door', part: 'DOOR_FRAME', objectFacts: { kind: 'PANEL' } })).toBe('GARAGE_DOOR')
    // a solid panel beside a leaf is part of an ordinary door
    expect(semanticGroupOf({ objectKind: 'door', part: 'DOOR_PANEL' })).toBe('DOOR')
    expect(semanticGroupOf({ objectKind: 'railing', part: 'RAILING_INFILL', objectFacts: { kind: 'GLASS' } })).toBe('WINDOW_GLASS')
    expect(semanticGroupOf({ objectKind: 'railing', part: 'RAILING_INFILL', objectFacts: { kind: 'BARS' } })).toBe('RAILING')
  })

  it('reads a material name only when the producer stated no kind', () => {
    expect(semanticGroupOf({ objectKind: 'roof', part: 'ROOF', materialId: 'mat-membrane', materialName: 'flat roof membrane' })).toBe('FLAT_ROOF')
    expect(semanticGroupOf({ objectKind: 'roof', part: 'ROOF', materialName: 'flat roof membrane', objectFacts: { roofKind: 'GABLE' } })).toBe('ROOF_MAIN')
    expect(semanticGroupOf({ objectKind: 'wall', part: 'WALL', materialId: 'mat-partition', materialName: 'Partition' })).toBe('WALL_INTERIOR')
    expect(semanticGroupOf({ objectKind: 'wall', part: 'WALL', materialName: 'Partition', objectFacts: { wallKind: 'EXTERIOR' } })).toBe('WALL_MAIN')
    expect(semanticGroupOf({ objectKind: 'railing', part: 'RAILING_INFILL', materialName: 'Glazing' })).toBe('WINDOW_GLASS')
    // a material never repaints a part that is not ambiguous
    expect(semanticGroupOf({ objectKind: 'slab', part: 'SLAB', materialName: 'flat roof membrane' })).toBe('SLAB')
  })
})

describe('the architectural palette', () => {
  it('names every group once, with a well-formed appearance', () => {
    expect(new Set(SEMANTIC_GROUPS).size).toBe(SEMANTIC_GROUPS.length)
    expect(Object.keys(ARCHITECTURAL_PALETTE).sort()).toEqual([...SEMANTIC_GROUPS].sort())
    for (const g of SEMANTIC_GROUPS) {
      const a = ARCHITECTURAL_PALETTE[g]
      expect(a.color, g).toMatch(/^#[0-9a-f]{6}$/)
      expect(a.roughness, g).toBeGreaterThanOrEqual(0)
      expect(a.roughness, g).toBeLessThanOrEqual(1)
      expect(a.metalness, g).toBeGreaterThanOrEqual(0)
      expect(a.metalness, g).toBeLessThanOrEqual(1)
      if (a.opacity !== undefined) {
        expect(a.opacity, g).toBeGreaterThan(0)
        expect(a.opacity, g).toBeLessThan(1)
      }
      expect(['SOFT', 'NONE']).toContain(a.edge)
    }
  })

  it('keeps every pair of commonly adjacent groups apart in relative luminance', () => {
    expect(ADJACENT_GROUPS.length).toBeGreaterThan(30)
    const short: string[] = []
    for (const [a, b] of ADJACENT_GROUPS) {
      const gap = Math.abs(relativeLuminance(ARCHITECTURAL_PALETTE[a].color) - relativeLuminance(ARCHITECTURAL_PALETTE[b].color))
      if (gap < MIN_ADJACENT_LUMINANCE_GAP) short.push(`${a} vs ${b}: ${gap.toFixed(3)}`)
    }
    expect(short).toEqual([])
    expect(MIN_ADJACENT_LUMINANCE_GAP).toBeGreaterThanOrEqual(0.06)
  })

  it('gives every opaque group its own colour', () => {
    const opaque = SEMANTIC_GROUPS.filter((g) => ARCHITECTURAL_PALETTE[g].opacity === undefined)
    expect(new Set(opaque.map((g) => ARCHITECTURAL_PALETTE[g].color)).size).toBe(opaque.length)
  })

  it('is the ladder the brief describes', () => {
    const L = (g: SemanticGroup): number => relativeLuminance(ARCHITECTURAL_PALETTE[g].color)
    expect(L('ROOF_TRIM')).toBeGreaterThan(L('WALL_MAIN')) // trims one step lighter than walls
    expect(L('WALL_MAIN')).toBeGreaterThan(L('WALL_SECONDARY')) // a mid-grey secondary body
    expect(L('WALL_MAIN')).toBeGreaterThan(L('SLAB')) // light concrete, darker than the render
    expect(L('SLAB')).toBeGreaterThan(L('TERRACE_SURFACE')) // a darker warm stone
    expect(L('ROOF_MAIN')).toBeLessThan(0.08) // a deep warm grey
    expect(L('WINDOW_FRAME')).toBeLessThan(0.03) // near-black frames
    expect(ARCHITECTURAL_PALETTE.WINDOW_GLASS.opacity).toBeCloseTo(0.35, 6)
    // warm: red at or above blue on the render, the timber and the stone
    for (const g of ['WALL_MAIN', 'DOOR', 'TERRACE_SURFACE', 'CHIMNEY'] as const) {
      const [r, , b] = [parseInt(ARCHITECTURAL_PALETTE[g].color.slice(1, 3), 16), 0, parseInt(ARCHITECTURAL_PALETTE[g].color.slice(5, 7), 16)]
      expect(r, g).toBeGreaterThan(b)
    }
    // cool glass: blue above red
    expect(parseInt(ARCHITECTURAL_PALETTE.WINDOW_GLASS.color.slice(5, 7), 16)).toBeGreaterThan(parseInt(ARCHITECTURAL_PALETTE.WINDOW_GLASS.color.slice(1, 3), 16))
  })

  it('asks for a soft edge on the structural groups only', () => {
    expect(edgeGroups().sort()).toEqual(
      ['WALL_MAIN', 'WALL_SECONDARY', 'WALL_INTERIOR', 'ROOF_MAIN', 'FLAT_ROOF', 'ROOF_TRIM', 'SLAB', 'BALCONY_SLAB', 'TERRACE_SURFACE', 'CHIMNEY', 'FACADE_FRAME'].sort(),
    )
    for (const g of ['WINDOW_GLASS', 'WINDOW_FRAME', 'RAILING', 'ROOM', 'DOOR', 'OTHER'] as const) expect(ARCHITECTURAL_PALETTE[g].edge).toBe('NONE')
  })
})

describe('applyToneHints', () => {
  it('is pure and a no-op without hints', () => {
    const before = JSON.stringify(ARCHITECTURAL_PALETTE)
    expect(applyToneHints(ARCHITECTURAL_PALETTE, undefined)).toEqual(ARCHITECTURAL_PALETTE)
    expect(applyToneHints(ARCHITECTURAL_PALETTE, {})).toEqual(ARCHITECTURAL_PALETTE)
    const shifted = applyToneHints(ARCHITECTURAL_PALETTE, { WALL_MAIN: 'DARK' })
    expect(shifted).not.toBe(ARCHITECTURAL_PALETTE)
    expect(JSON.stringify(ARCHITECTURAL_PALETTE)).toBe(before)
  })

  it('moves a hinted group onto the nearest rung of that tone family and nothing else', () => {
    const shifted = applyToneHints(ARCHITECTURAL_PALETTE, { WALL_SECONDARY: 'DARK' })
    const darkColours = TONE_FAMILIES.DARK.map((g) => ARCHITECTURAL_PALETTE[g].color)
    expect(darkColours).toContain(shifted.WALL_SECONDARY.color)
    expect(relativeLuminance(shifted.WALL_SECONDARY.color)).toBeLessThan(relativeLuminance(ARCHITECTURAL_PALETTE.WALL_SECONDARY.color))
    // the nearest dark rung to a mid grey that keeps its neighbours apart
    const neighbours = ADJACENT_GROUPS.filter(([a, b]) => a === 'WALL_SECONDARY' || b === 'WALL_SECONDARY').map(([a, b]) => (a === 'WALL_SECONDARY' ? b : a))
    const rgb = (c: string): number[] => [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16))
    const dist = (a: string, b: string): number => Math.hypot(...rgb(a).map((v, i) => v - rgb(b)[i]))
    const expected = [...darkColours]
      .sort((a, b) => dist(ARCHITECTURAL_PALETTE.WALL_SECONDARY.color, a) - dist(ARCHITECTURAL_PALETTE.WALL_SECONDARY.color, b))
      .find((c) => neighbours.every((n) => Math.abs(relativeLuminance(c) - relativeLuminance(ARCHITECTURAL_PALETTE[n].color)) >= MIN_ADJACENT_LUMINANCE_GAP))
    expect(shifted.WALL_SECONDARY.color).toBe(expected)
    // only the colour moves, and only the hinted group
    expect({ ...shifted.WALL_SECONDARY, color: undefined }).toEqual({ ...ARCHITECTURAL_PALETTE.WALL_SECONDARY, color: undefined })
    for (const g of SEMANTIC_GROUPS) if (g !== 'WALL_SECONDARY') expect(shifted[g], g).toEqual(ARCHITECTURAL_PALETTE[g])
    const lightened = applyToneHints(ARCHITECTURAL_PALETTE, { WALL_SECONDARY: 'LIGHT' })
    expect(TONE_FAMILIES.LIGHT.map((g) => ARCHITECTURAL_PALETTE[g].color)).toContain(lightened.WALL_SECONDARY.color)
    expect(relativeLuminance(lightened.WALL_SECONDARY.color)).toBeGreaterThan(relativeLuminance(ARCHITECTURAL_PALETTE.WALL_SECONDARY.color))
  })

  it('never moves a group into a neighbour: a hint no rung can honour is dropped', () => {
    // Every dark rung sits within the gap of something the main walls meet
    // (the roof, the frames, the flat roof): a dark main body would merge with
    // its own roof, so the hint is not honoured and the walls keep their rung.
    const shifted = applyToneHints(ARCHITECTURAL_PALETTE, { WALL_MAIN: 'DARK' })
    expect(shifted.WALL_MAIN).toEqual(ARCHITECTURAL_PALETTE.WALL_MAIN)
    // whatever is hinted, adjacent groups stay apart
    for (const tone of Object.keys(TONE_FAMILIES) as Array<keyof typeof TONE_FAMILIES>) {
      const hints = Object.fromEntries(SEMANTIC_GROUPS.map((g) => [g, tone]))
      const p = applyToneHints(ARCHITECTURAL_PALETTE, hints)
      for (const [a, b] of ADJACENT_GROUPS) {
        const moved = p[a].color !== ARCHITECTURAL_PALETTE[a].color || p[b].color !== ARCHITECTURAL_PALETTE[b].color
        if (moved) expect(Math.abs(relativeLuminance(p[a].color) - relativeLuminance(p[b].color)), `${tone}: ${a} / ${b}`).toBeGreaterThanOrEqual(MIN_ADJACENT_LUMINANCE_GAP)
      }
    }
  })

  it('reads a finish colour as a tone family by luminance', () => {
    expect(toneOfColor('#e8e4dc')).toBe('LIGHT')
    expect(toneOfColor('#8e8983')).toBe('MID')
    expect(toneOfColor('#3a3a3c')).toBe('DARK')
  })

  it('leaves a group alone when the hint agrees with the palette', () => {
    expect(applyToneHints(ARCHITECTURAL_PALETTE, { WINDOW_GLASS: 'COOL', DOOR: 'WARM', ROOF_MAIN: 'DARK', SLAB: 'MID' })).toEqual(ARCHITECTURAL_PALETTE)
  })

  it('keeps a translucent group translucent', () => {
    const shifted = applyToneHints(ARCHITECTURAL_PALETTE, { WINDOW_GLASS: 'DARK' })
    expect(shifted.WINDOW_GLASS.opacity).toBe(ARCHITECTURAL_PALETTE.WINDOW_GLASS.opacity)
  })
})

describe('the bundle styling block', () => {
  it('carries the shared palette and no hints when none were given', () => {
    const styling = bundleStyling()
    expect(styling.palette).toBe(ARCHITECTURAL_PALETTE_ID)
    expect(styling.groups).toEqual(ARCHITECTURAL_PALETTE)
    expect('toneHints' in styling).toBe(false)
  })

  it('carries the hints it applied', () => {
    const styling = bundleStyling({ WALL_SECONDARY: 'DARK' })
    expect(styling.toneHints).toEqual({ WALL_SECONDARY: 'DARK' })
    expect(styling.groups.WALL_SECONDARY.color).toBe(applyToneHints(ARCHITECTURAL_PALETTE, { WALL_SECONDARY: 'DARK' }).WALL_SECONDARY.color)
  })
})

describe('in a bundle', () => {
  const cases: Array<[string, CanonicalBuildingModel]> = [
    ['demo', createDemoBuilding()],
    ['marcowki', createMarcowkiReferenceBuilding()],
  ]

  it.each(cases)('%s: every mesh carries the group semanticGroupOf derives for it, and every group is styled', (_name, model) => {
    const scene = compileBuilding(model)
    const bundle = buildMobileSceneBundle(model, { scene })
    const materialName = new Map(model.materials.map((m) => [m.id, m.name]))
    const finishes = wallFinishes(model)
    for (let i = 0; i < scene.meshes.length; i++) {
      const m = scene.meshes[i]
      const expected = semanticGroupOf({
        objectKind: m.objectKind,
        part: m.part,
        materialId: m.materialId,
        materialName: m.materialId ? materialName.get(m.materialId) : undefined,
        objectFacts: objectFactsOf(model, m.objectId, finishes),
      })
      expect(bundle.scene.meshes[i].semanticGroup, `${m.objectId} ${m.part}`).toBe(expected)
      expect(bundle.styling.groups[bundle.scene.meshes[i].semanticGroup], `${m.objectId} ${m.part}`).toBeDefined()
    }
    expect(bundle.styling.palette).toBe(ARCHITECTURAL_PALETTE_ID)
    expect(Object.keys(bundle.styling.groups).sort()).toEqual([...SEMANTIC_GROUPS].sort())
  })

  it('reads the reference model as a person would: flat roof, terrace, partition, glass balustrade, sectional door', () => {
    const model = createMarcowkiReferenceBuilding()
    const bundle = buildMobileSceneBundle(model)
    const groupsOf = (objectId: string): Set<SemanticGroup> => new Set(bundle.scene.meshes.filter((m) => m.objectId === objectId).map((m) => m.semanticGroup))
    const flat = model.roofs.find((r) => r.kind === 'FLAT')
    const gable = model.roofs.find((r) => r.kind === 'GABLE')
    const terrace = model.balconies.find((b) => b.kind === 'TERRACE')
    const balcony = model.balconies.find((b) => b.kind === 'BALCONY')
    const interior = model.walls.find((w) => w.kind === 'INTERIOR')
    const finishes = wallFinishes(model)
    const exterior = model.walls.find((w) => finishes.get(w.id) === 'PRIMARY')
    const secondary = model.walls.find((w) => finishes.get(w.id) === 'SECONDARY')
    const glassRail = model.railings.find((r) => r.infill === 'GLASS')
    const sectional = model.doors.find((d) => d.assembly?.panels.every((p) => p.kind === 'PANEL'))
    const leafDoor = model.doors.find((d) => !d.assembly)
    expect(flat && gable && terrace && balcony && interior && exterior && secondary && glassRail && sectional && leafDoor).toBeTruthy()
    if (!flat || !gable || !terrace || !balcony || !interior || !exterior || !secondary || !glassRail || !sectional || !leafDoor) return
    expect(groupsOf(flat.id)).toEqual(new Set(['FLAT_ROOF']))
    expect(groupsOf(gable.id)).toEqual(new Set(['ROOF_MAIN']))
    expect(groupsOf(terrace.id)).toEqual(new Set(['TERRACE_SURFACE']))
    expect(groupsOf(balcony.id)).toEqual(new Set(['BALCONY_SLAB']))
    expect(groupsOf(interior.id)).toEqual(new Set(['WALL_INTERIOR']))
    expect(groupsOf(exterior.id)).toEqual(new Set(['WALL_MAIN']))
    expect(groupsOf(glassRail.id)).toEqual(new Set(['RAILING', 'WINDOW_GLASS']))
    expect(groupsOf(sectional.id)).toEqual(new Set(['GARAGE_DOOR']))
    expect(groupsOf(leafDoor.id).has('DOOR')).toBe(true)
    expect(groupsOf(leafDoor.id).has('GARAGE_DOOR')).toBe(false)
    // the garage, in a finish of its own, reads as a secondary body; nothing else does
    expect(groupsOf(secondary.id)).toEqual(new Set(['WALL_SECONDARY']))
    const secondaryWalls = new Set(bundle.scene.meshes.filter((m) => m.part === 'WALL' && m.semanticGroup === 'WALL_SECONDARY').map((m) => m.objectId))
    expect([...secondaryWalls].sort()).toEqual(model.walls.filter((w) => finishes.get(w.id) === 'SECONDARY').map((w) => w.id).sort())
  })

  it('reads the finishes off the model: dominant finish PRIMARY, frame-member finish MEMBER, any other SECONDARY', () => {
    const model = createMarcowkiReferenceBuilding()
    const finishes = wallFinishes(model)
    const area = new Map<string, number>()
    for (const w of model.walls.filter((x) => x.kind === 'EXTERIOR' && x.materialId)) area.set(w.materialId as string, (area.get(w.materialId as string) ?? 0) + Math.hypot(w.end.x - w.start.x, w.end.z - w.start.z) * w.height)
    const dominant = [...area].sort((a, b) => b[1] - a[1])[0][0]
    for (const w of model.walls) {
      if (w.kind !== 'EXTERIOR') expect(finishes.has(w.id), w.id).toBe(false)
      else expect(finishes.get(w.id) === 'PRIMARY', w.id).toBe(w.materialId === dominant)
    }
    // a model with one finish has no secondary walls at all
    const one = createDemoBuilding()
    const oneFinish = { ...one, walls: one.walls.map((w) => ({ ...w, materialId: one.walls[0].materialId })) }
    expect([...wallFinishes(oneFinish).values()].every((f) => f === 'PRIMARY')).toBe(true)
  })

  it('derives tone hints from the model’s own finishes and applies them', () => {
    const model = createMarcowkiReferenceBuilding()
    const bundle = buildMobileSceneBundle(model)
    expect(bundle.styling.toneHints).toBeDefined()
    const colorOf = new Map(model.materials.map((m) => [m.id, m.color]))
    for (const [group, tone] of Object.entries(bundle.styling.toneHints ?? {})) {
      const meshes = bundle.scene.meshes.filter((m) => m.semanticGroup === group && m.materialId)
      expect(meshes.length, group).toBeGreaterThan(0)
      const byMaterial = new Map<string, number>()
      for (const m of meshes) byMaterial.set(m.materialId as string, (byMaterial.get(m.materialId as string) ?? 0) + m.triangleCount)
      const [dominant] = [...byMaterial].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]
      expect(tone, group).toBe(toneOfColor(colorOf.get(dominant) as string))
    }
    expect(bundle.styling.groups).toEqual(applyToneHints(ARCHITECTURAL_PALETTE, bundle.styling.toneHints))
  })

  it('changes the hash when a tone hint changes the palette', () => {
    const model = createDemoBuilding()
    expect(buildMobileSceneBundle(model, { toneHints: { WALL_MAIN: 'DARK' } }).contentHash).not.toBe(buildMobileSceneBundle(model).contentHash)
    const derived = buildMobileSceneBundle(model)
    expect(buildMobileSceneBundle(model, { toneHints: derived.styling.toneHints }).contentHash).toBe(derived.contentHash)
    // no hints at all: the palette as it stands
    expect(buildMobileSceneBundle(model, { toneHints: {} }).styling.groups).toEqual(ARCHITECTURAL_PALETTE)
  })
})

describe('the viewers draw from the same palette', () => {
  const fmt = (v: number | undefined): string => (v === undefined ? '-' : String(v))

  it('the web adapter carries an identical copy (an architecture rule keeps it from importing this package)', () => {
    const web = readFileSync(resolve(ROOT, 'apps/web/src/viewport/scene-adapter.ts'), 'utf8')
    const found = new Map<string, { color: string; opacity?: number; edge: string }>()
    for (const m of web.matchAll(/^\s{2}([A-Z_]+):\s*\{\s*color:\s*'(#[0-9a-f]{6})'(?:,\s*opacity:\s*([0-9.]+))?[^}]*edge:\s*'(SOFT|NONE)'/gm)) {
      found.set(m[1], { color: m[2], opacity: m[3] === undefined ? undefined : Number(m[3]), edge: m[4] })
    }
    for (const g of SEMANTIC_GROUPS) {
      const a = ARCHITECTURAL_PALETTE[g]
      expect(found.get(g), `the web adapter has no architectural entry for ${g}`).toBeDefined()
      expect(`${found.get(g)?.color} ${fmt(found.get(g)?.opacity)} ${found.get(g)?.edge}`, g).toBe(`${a.color} ${fmt(a.opacity)} ${a.edge}`)
    }
    expect(found.size).toBe(SEMANTIC_GROUPS.length)
  })

  it('the Kotlin renderer carries an identical built-in fallback, and its enum names every group', () => {
    const kotlin = readFileSync(resolve(ROOT, 'apps/android/app/src/main/java/com/buildplan/preview/render/RenderStyle.kt'), 'utf8')
    const found = new Map<string, { color: string; opacity?: number; edge: string }>()
    for (const m of kotlin.matchAll(/SemanticGroup\.([A-Z_]+) to BundleGroupAppearance\(\s*color = "(#[0-9a-f]{6})",\s*opacity = ([0-9.]+|null),[^)]*edge = "(SOFT|NONE)"/g)) {
      found.set(m[1], { color: m[2], opacity: m[3] === 'null' ? undefined : Number(m[3]), edge: m[4] })
    }
    for (const g of SEMANTIC_GROUPS) {
      const a = ARCHITECTURAL_PALETTE[g]
      expect(found.get(g), `the Kotlin fallback palette has no entry for ${g}`).toBeDefined()
      expect(`${found.get(g)?.color} ${fmt(found.get(g)?.opacity)} ${found.get(g)?.edge}`, g).toBe(`${a.color} ${fmt(a.opacity)} ${a.edge}`)
    }
    expect(found.size).toBe(SEMANTIC_GROUPS.length)

    const enumSource = readFileSync(resolve(ROOT, 'apps/android/app/src/main/java/com/buildplan/preview/scene/ModelScene.kt'), 'utf8')
    const enumBody = /enum class SemanticGroup\s*\{([\s\S]*?)\n\}/.exec(enumSource)?.[1] ?? ''
    for (const g of SEMANTIC_GROUPS) expect(new RegExp(`\\b${g}\\b`).test(enumBody), `Kotlin SemanticGroup lacks ${g}`).toBe(true)
    for (const part of ALL_PARTS) expect(new RegExp(`\\b${part}\\b`).test(enumSource), `Kotlin GeometryPart lacks ${part}`).toBe(true)
  })
})
