import type { JSX } from 'react'
/**
 * The 3D viewport. Owns the Three.js renderer, cameras and controls, and
 * draws exactly what the editor store says is visible: the compiled scene
 * from the CanonicalBuildingModel, filtered by visibility, with the selected
 * object highlighted. Picking resolves a Three.js mesh to a semantic object
 * id through the adapter's map — never by parsing a name.
 */
import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useSnapshot, useStore } from '../use-store.js'
import { buildThreeScene, disposeGroup, modelAxes, type SceneBuild } from '../viewport/scene-adapter.js'
import { framingOf, isOrthographic, presetPosition } from '../viewport/camera-presets.js'

type ThreeState = {
  renderer: THREE.WebGLRenderer
  scene: THREE.Scene
  perspective: THREE.PerspectiveCamera
  ortho: THREE.OrthographicCamera
  active: THREE.Camera
  controlsP: OrbitControls
  controlsO: OrbitControls
  grid: THREE.GridHelper
  axes: THREE.Group
  build: SceneBuild | null
  raycaster: THREE.Raycaster
  frame: number
  lastRadius: number
}

export function Viewport(): JSX.Element {
  const store = useStore()
  const snap = useSnapshot()
  const hostRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef<ThreeState | null>(null)

  // --- renderer lifecycle ---------------------------------------------------
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, preserveDrawingBuffer: true })
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    renderer.setClearColor(0x0f1113)
    renderer.domElement.setAttribute('data-testid', 'viewport-canvas')
    host.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    scene.add(new THREE.HemisphereLight(0xdfe6f0, 0x2a2622, 0.9))
    const key = new THREE.DirectionalLight(0xffffff, 1.6)
    key.position.set(12, 18, 16)
    scene.add(key)
    const fill = new THREE.DirectionalLight(0xbfd0ff, 0.5)
    fill.position.set(-14, 8, -10)
    scene.add(fill)
    scene.add(new THREE.AmbientLight(0xffffff, 0.25))

    const grid = new THREE.GridHelper(60, 60, 0x33383f, 0x22262b)
    grid.position.y = -0.35
    scene.add(grid)
    const axes = modelAxes(3)
    scene.add(axes)

    const perspective = new THREE.PerspectiveCamera(42, 1, 0.05, 2000)
    const ortho = new THREE.OrthographicCamera(-10, 10, 10, -10, -500, 500)
    const controlsP = new OrbitControls(perspective, renderer.domElement)
    const controlsO = new OrbitControls(ortho, renderer.domElement)
    for (const c of [controlsP, controlsO]) {
      c.enableDamping = true
      c.dampingFactor = 0.12
      c.screenSpacePanning = true
    }
    controlsO.enableRotate = false
    controlsO.enabled = false

    const st: ThreeState = {
      renderer,
      scene,
      perspective,
      ortho,
      active: perspective,
      controlsP,
      controlsO,
      grid,
      axes,
      build: null,
      raycaster: new THREE.Raycaster(),
      frame: 0,
      lastRadius: 10,
    }
    stateRef.current = st

    const resize = (): void => {
      const w = Math.max(1, host.clientWidth)
      const h = Math.max(1, host.clientHeight)
      renderer.setSize(w, h, false)
      perspective.aspect = w / h
      perspective.updateProjectionMatrix()
      const half = st.lastRadius * 1.15
      ortho.left = -half * (w / h)
      ortho.right = half * (w / h)
      ortho.top = half
      ortho.bottom = -half
      ortho.updateProjectionMatrix()
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    // Picking: a click (not a drag) resolves the mesh under the pointer to its semantic object.
    let downAt: { x: number; y: number } | null = null
    const onDown = (e: PointerEvent): void => {
      downAt = { x: e.clientX, y: e.clientY }
    }
    const onUp = (e: PointerEvent): void => {
      if (!downAt) return
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y)
      downAt = null
      if (moved > 4 || e.button !== 0) return
      const rect = renderer.domElement.getBoundingClientRect()
      const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -(((e.clientY - rect.top) / rect.height) * 2 - 1))
      const b = st.build
      if (!b) return
      st.raycaster.setFromCamera(ndc, st.active)
      const hits = st.raycaster.intersectObjects(b.pickables, false)
      const hit = hits[0]
      store.select(hit ? (b.meshToObject.get(hit.object) ?? null) : null)
    }
    renderer.domElement.addEventListener('pointerdown', onDown)
    renderer.domElement.addEventListener('pointerup', onUp)

    const loop = (): void => {
      st.frame = requestAnimationFrame(loop)
      controlsP.update()
      controlsO.update()
      renderer.render(scene, st.active)
    }
    loop()

    return () => {
      cancelAnimationFrame(st.frame)
      ro.disconnect()
      renderer.domElement.removeEventListener('pointerdown', onDown)
      renderer.domElement.removeEventListener('pointerup', onUp)
      controlsP.dispose()
      controlsO.dispose()
      if (st.build) disposeGroup(st.build.group)
      renderer.dispose()
      host.removeChild(renderer.domElement)
      stateRef.current = null
    }
  }, [store])

  // --- geometry: rebuild from the compiled scene whenever it or visibility changes ---
  useEffect(() => {
    const st = stateRef.current
    if (!st) return
    if (st.build) {
      st.scene.remove(st.build.group)
      disposeGroup(st.build.group)
    }
    const build = buildThreeScene(store.visibleMeshes(), snap.model.materials, snap.selection)
    st.scene.add(build.group)
    st.build = build
    ;(window as unknown as { __buildworld?: unknown }).__buildworld = {
      store,
      meshCount: build.pickables.length,
      objectIds: [...new Set(build.meshToObject.values())],
    }
  }, [store, snap.scene, snap.hidden, snap.isolated, snap.isolatedLevelId, snap.roofsVisible, snap.selection, snap.model.materials])

  useEffect(() => {
    const st = stateRef.current
    if (!st) return
    st.grid.visible = snap.showGrid
    st.axes.visible = snap.showAxes
  }, [snap.showGrid, snap.showAxes])

  // --- camera presets ---------------------------------------------------------
  useEffect(() => {
    const st = stateRef.current
    if (!st) return
    // Frame the whole compiled building, not just what is visible, so presets are stable.
    const all = buildThreeScene(snap.scene.meshes, snap.model.materials, null)
    const framing = framingOf(all.bounds)
    disposeGroup(all.group)
    st.lastRadius = framing.radius
    const { position, up } = presetPosition(snap.view, framing)
    const orthoView = isOrthographic(snap.view)
    st.active = orthoView ? st.ortho : st.perspective
    st.controlsP.enabled = !orthoView
    st.controlsO.enabled = orthoView
    const cam = st.active as THREE.PerspectiveCamera | THREE.OrthographicCamera
    cam.up.copy(up)
    cam.position.copy(position)
    cam.lookAt(framing.center)
    const controls = orthoView ? st.controlsO : st.controlsP
    controls.target.copy(framing.center)
    controls.update()
    const host = hostRef.current
    if (host) {
      const w = Math.max(1, host.clientWidth)
      const h = Math.max(1, host.clientHeight)
      const half = framing.radius * 1.15
      st.ortho.left = -half * (w / h)
      st.ortho.right = half * (w / h)
      st.ortho.top = half
      st.ortho.bottom = -half
      st.ortho.zoom = 1
      st.ortho.updateProjectionMatrix()
    }
  }, [snap.view, snap.viewNonce, snap.scene, snap.model.materials])

  return (
    <div className="viewport" ref={hostRef} data-testid="viewport">
      <div className="overlay">
        {snap.view} · {snap.scene.stats.triangleCount} tris · drag: orbit / right-drag: pan / wheel: zoom / click: select
      </div>
      <div className="axes-legend">
        <b style={{ color: '#e5645a' }}>x</b> right · <b style={{ color: '#5fbf8a' }}>y</b> up · <b style={{ color: '#4fa3ff' }}>z</b> into the building
      </div>
    </div>
  )
}
