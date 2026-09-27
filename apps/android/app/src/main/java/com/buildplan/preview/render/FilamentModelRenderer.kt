package com.buildplan.preview.render

import android.content.res.AssetManager
import com.buildplan.preview.camera.OrbitCamera
import com.buildplan.preview.camera.OrbitPose
import com.buildplan.preview.camera.Projection
import com.buildplan.preview.math.Bounds
import com.buildplan.preview.math.Vec3
import com.buildplan.preview.presentation.FeatureEdgeSet
import com.buildplan.preview.presentation.PresentationLook
import com.buildplan.preview.presentation.PresentationMode
import com.buildplan.preview.presentation.PresentationStats
import com.buildplan.preview.presentation.RoofCoverBatch
import com.buildplan.preview.presentation.ScenePresentation
import com.buildplan.preview.presentation.StudyPalette
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.SceneObject
import com.buildplan.preview.scene.ViewerState
import com.google.android.filament.Box
import com.google.android.filament.Camera
import com.google.android.filament.Engine
import com.google.android.filament.EntityManager
import com.google.android.filament.Fence
import com.google.android.filament.IndexBuffer
import com.google.android.filament.IndirectLight
import com.google.android.filament.LightManager
import com.google.android.filament.Material
import com.google.android.filament.MaterialInstance
import com.google.android.filament.RenderableManager
import com.google.android.filament.Renderer
import com.google.android.filament.Scene
import com.google.android.filament.Skybox
import com.google.android.filament.SwapChain
import com.google.android.filament.VertexBuffer
import com.google.android.filament.View
import com.google.android.filament.Viewport
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.floor
import kotlin.math.max

/**
 * Filament rendering of a compiled BuildApp scene.
 *
 * Two rules shape everything here:
 *
 * 1. Geometry is uploaded ONCE per model. Changing visibility adds and removes
 *    entities from the Filament scene; changing style rewrites material
 *    parameters. Neither touches a vertex buffer, so no interaction rebuilds
 *    geometry.
 * 2. One entity per SEMANTIC object. Filament's pick returns an entity, and
 *    that entity maps straight back to an `objectId` — no name parsing, no
 *    guessing which triangle belonged to which window.
 *
 * Hiding is implemented by removing the entity from the scene rather than by
 * a shader trick, which also makes hidden geometry unpickable for free: the
 * pick pass only ever sees what the scene contains.
 *
 * Presentation modes (MODEL, CLAY, LINE) follow the same two rules. The study
 * overlays — feature edges and the roof covering — are derived once per model
 * by `ScenePresentation` from the uploaded scene alone and uploaded with it;
 * a mode switch rewrites material, light and view parameters and adds or
 * removes those overlay entities. Every overlay entity maps back to the
 * semantic object whose geometry it was derived from, so selection and
 * picking still resolve to BuildApp object ids and nothing else.
 */
class FilamentModelRenderer(private val assets: AssetManager) {

    val engine: Engine = run {
        // Loads libfilament-jni before any Filament class touches native code.
        com.google.android.filament.Filament.init()
        Engine.create()
    }
    /** Also handed to `DisplayHelper` so Filament can pace to the display. */
    val renderer: Renderer = engine.createRenderer()
    private val filamentScene: Scene = engine.createScene()
    val view: View = engine.createView()
    private val cameraEntity: Int = EntityManager.get().create()
    private val camera: Camera = engine.createCamera(cameraEntity)

    private val opaqueMaterial: Material = loadMaterial("materials/technical.filamat")
    private val translucentMaterial: Material = loadMaterial("materials/translucent.filamat")
    private val lineMaterial: Material = loadMaterial("materials/line.filamat")

    private var sunEntity: Int = 0
    private var indirectLight: IndirectLight? = null
    private var skybox: Skybox? = null

    private var model: ModelEntities? = null
    /**
     * The scene whose geometry is currently on the GPU.
     *
     * Held here rather than passed in every frame: viewer state is a set of
     * object ids, and ids only mean something inside the model they came
     * from. A caller that hands this renderer a different scene than the one
     * it uploaded would resolve those ids against the wrong building and show
     * whatever the two happen to have a name in common — which is a blank
     * viewport, not an error anyone would notice.
     */
    private var uploadedScene: ModelScene? = null
    private var grid: LineEntity? = null
    private var selectionBox: LineEntity? = null

    private var currentState: ViewerState? = null
    private var visibleNow: Set<String> = emptySet()
    /** Overlay entities (edges, covering) currently in the Filament scene. */
    private var overlaysNow: Set<Int> = emptySet()

    /** What the study overlays of the uploaded model cost; null before a model is uploaded. */
    var presentationStats: PresentationStats? = null
        private set
    private var viewportWidth = 1
    private var viewportHeight = 1

    init {
        view.scene = filamentScene
        view.camera = camera
        configureView()
        createEnvironment()
        // Outdoor daylight: the same exposure a photographer would use for the
        // sun intensity set in `createEnvironment`.
        camera.setExposure(16f, 1f / 125f, 100f)
    }

    // -----------------------------------------------------------------------
    // Setup
    // -----------------------------------------------------------------------

    private fun loadMaterial(path: String): Material {
        val bytes = assets.open(path).use { it.readBytes() }
        val buffer = ByteBuffer.allocateDirect(bytes.size).order(ByteOrder.nativeOrder())
        buffer.put(bytes)
        buffer.flip()
        return Material.Builder().payload(buffer, buffer.remaining()).build(engine)
    }

    private fun configureView() {
        view.isPostProcessingEnabled = true
        // Crisp edges matter more than film grain in a technical viewport.
        view.setAntiAliasing(View.AntiAliasing.NONE)
        view.multiSampleAntiAliasingOptions = View.MultiSampleAntiAliasingOptions().apply {
            enabled = true
            sampleCount = 4
        }
        setAmbientOcclusion(PresentationLook.model(RenderStyle.CONSTRUCTION))
        view.setShadowingEnabled(true)
        view.dynamicResolutionOptions = View.DynamicResolutionOptions().apply {
            enabled = true
            quality = View.QualityLevel.MEDIUM
        }
        view.blendMode = View.BlendMode.OPAQUE
    }

    /**
     * Screen-space ambient occlusion, per look. In MODEL, per style:
     * Construction and Clay keep it — contact darkening at reveals and under
     * eaves is what makes the depth of an opening readable there —
     * Architectural keeps a subtle pass at half the intensity. The CLAY study
     * uses the donor viewer's radius, intensity and power; the LINE study has
     * none. Quality stays LOW in every mode: the mobile budget.
     */
    private fun setAmbientOcclusion(look: PresentationLook) {
        val ao = look.ambientOcclusion
        view.ambientOcclusionOptions = View.AmbientOcclusionOptions().apply {
            enabled = ao != null
            quality = View.QualityLevel.LOW
            intensity = ao?.intensity ?: 0f
            radius = ao?.radius ?: 0.35f
            power = ao?.power ?: 1f
        }
    }

    /**
     * Everything a presentation sets outside the materials: backdrop, light,
     * shadows, occlusion, anti-aliasing and the grid. MODEL restores exactly
     * the values the viewer was created with.
     */
    private fun applyLook(look: PresentationLook) {
        skybox?.setColor(look.background[0], look.background[1], look.background[2], 1.0f)
        val lights = engine.lightManager
        lights.setIntensity(lights.getInstance(sunEntity), look.sunLux)
        indirectLight?.intensity = look.ambientIntensity
        view.setShadowingEnabled(look.shadows)
        setAmbientOcclusion(look)
        view.setAntiAliasing(if (look.fxaa) View.AntiAliasing.FXAA else View.AntiAliasing.NONE)
        grid?.setColor(look.grid)
    }

    private fun createEnvironment() {
        val bg = BACKGROUND
        skybox = Skybox.Builder().color(bg[0], bg[1], bg[2], 1.0f).build(engine).also { filamentScene.skybox = it }

        // Ambient light as spherical harmonics rather than an image: no IBL
        // asset to ship, nothing to load, and the preview stays fully offline.
        // Only the constant and the vertical term are set — a calm sky above,
        // a darker ground below.
        val sh = FloatArray(27)
        sh[0] = 0.55f; sh[1] = 0.58f; sh[2] = 0.64f          // L0, slightly cool
        sh[3] = 0.20f; sh[4] = 0.21f; sh[5] = 0.24f          // L1 y: brighter from above
        indirectLight = IndirectLight.Builder()
            .irradiance(3, sh)
            .intensity(PresentationLook.MODEL_AMBIENT)
            .build(engine)
            .also { filamentScene.indirectLight = it }

        sunEntity = EntityManager.get().create()
        LightManager.Builder(LightManager.Type.SUN)
            .color(1.0f, 0.96f, 0.90f)
            .intensity(PresentationLook.MODEL_SUN_LUX)
            // Down, from the front left: a conventional architectural sun that
            // keeps the front facade lit and still gives the sides relief.
            .direction(0.45f, -0.82f, -0.35f)
            .castShadows(true)
            .sunAngularRadius(1.2f)
            .build(engine, sunEntity)
        filamentScene.addEntity(sunEntity)
    }

    // -----------------------------------------------------------------------
    // Model
    // -----------------------------------------------------------------------

    /** Upload a model. The previous one is fully released first. */
    fun setModel(scene: ModelScene) {
        releaseModel()
        uploadedScene = scene
        // Derived once, here, from the scene alone; a mode switch never
        // derives anything again.
        val presentation = ScenePresentation.of(scene)
        presentationStats = presentation.stats(scene)
        model = ModelEntities.build(engine, scene, presentation, opaqueMaterial, translucentMaterial, lineMaterial)
        grid = LineEntity.grid(engine, lineMaterial, scene.bounds)
        selectionBox = LineEntity.box(engine, lineMaterial, Selection.OUTLINE)
        grid?.let { filamentScene.addEntity(it.entity) }
        currentState = null
        visibleNow = emptySet()
        overlaysNow = emptySet()
    }

    /**
     * Apply viewer state.
     *
     * Only what actually changed is touched: a style or presentation change
     * rewrites material, light and view parameters, a visibility change moves
     * entities in and out of the scene, a selection change updates one
     * object's emissive, its lines' ink and the outline box. Overlays follow
     * the objects they were derived from: an edge or a tile is in the scene
     * only while its object is, and only in a mode that draws it.
     */
    fun setState(state: ViewerState) {
        val entities = model ?: return
        val scene = uploadedScene ?: return
        val previous = currentState
        // Called every frame; nothing below is worth doing when nothing moved.
        if (previous == state) return

        val mode = state.presentation
        val look = mode.look(state.style)
        val lookChanged = previous == null || previous.presentation != mode || previous.style != state.style
        if (lookChanged) {
            entities.applyAppearance(engine, scene, mode, state.style, look)
            applyLook(look)
        }

        // Restricted to what was actually uploaded, so the scene can only
        // ever be asked to show entities that exist.
        val visible = state.visibleObjectIds(scene) intersect scene.renderableObjectIds
        if (visible != visibleNow) {
            for (id in visibleNow - visible) entities.byId[id]?.surfaces?.forEach { filamentScene.removeEntity(it) }
            for (id in visible - visibleNow) entities.byId[id]?.surfaces?.forEach { filamentScene.addEntity(it) }
            visibleNow = visible
        }

        val overlays = entities.overlaysFor(visible, mode, state.selectedObjectId)
        if (overlays != overlaysNow) {
            for (e in overlaysNow - overlays) filamentScene.removeEntity(e)
            for (e in overlays - overlaysNow) filamentScene.addEntity(e)
            overlaysNow = overlays
        }

        if (previous?.selectedObjectId != state.selectedObjectId || lookChanged) {
            previous?.selectedObjectId?.let { entities.byId[it]?.setSelected(false) }
            state.selectedObjectId?.let { entities.byId[it]?.setSelected(true) }
            entities.inkEdges(look, state.selectedObjectId)
            updateSelectionBox(scene, state.selectedObjectId, visible)
        }

        currentState = state
    }

    private fun updateSelectionBox(scene: ModelScene, selectedId: String?, visible: Set<String>) {
        val box = selectionBox ?: return
        val target = selectedId?.takeIf { it in visible }?.let { scene.objectById(it) }
        if (target == null) {
            filamentScene.removeEntity(box.entity)
            return
        }
        // A pane has no thickness; pad so its outline is a box and not a plane.
        box.setBox(engine, target.bounds.padded(max(0.02, target.bounds.radius * 0.03)))
        filamentScene.addEntity(box.entity)
    }

    // -----------------------------------------------------------------------
    // Camera
    // -----------------------------------------------------------------------

    fun setCamera(orbit: OrbitCamera, pose: OrbitPose) {
        val eye = orbit.eye(pose)
        val target = pose.target
        val up = orbit.basis(pose).up
        camera.lookAt(eye.x, eye.y, eye.z, target.x, target.y, target.z, up.x, up.y, up.z)

        val (near, far) = orbit.clipPlanes(pose)
        val aspect = if (viewportHeight > 0) viewportWidth.toDouble() / viewportHeight.toDouble() else 1.0
        when (pose.projection) {
            Projection.PERSPECTIVE ->
                camera.setProjection(orbit.fovDeg, aspect, near, far, Camera.Fov.VERTICAL)
            Projection.ORTHOGRAPHIC -> {
                // The orthographic extent is the perspective frustum's height
                // at the focus distance, so switching projection does not
                // change how big the building looks.
                val halfHeight = orbit.orthoHalfHeight(pose)
                val halfWidth = halfHeight * aspect
                camera.setProjection(
                    Camera.Projection.ORTHO,
                    -halfWidth, halfWidth, -halfHeight, halfHeight,
                    near, far,
                )
            }
        }
    }

    fun setViewport(width: Int, height: Int) {
        viewportWidth = max(1, width)
        viewportHeight = max(1, height)
        view.viewport = Viewport(0, 0, viewportWidth, viewportHeight)
    }

    // -----------------------------------------------------------------------
    // Picking
    // -----------------------------------------------------------------------

    /**
     * Resolve a tap.
     *
     * Filament's pick runs against the scene's own render pass, so only
     * entities currently in the scene — the visible ones — can answer, which
     * is what makes hidden geometry unpickable without any extra bookkeeping.
     * The callback arrives a frame or two later, on the given handler.
     *
     * Guides are classified rather than treated as misses: hitting the ground
     * grid means "nothing here", but hitting the outline of the object you
     * already selected must not throw that selection away.
     */
    fun pick(x: Int, y: Int, handler: android.os.Handler, onResult: (PickOutcome) -> Unit) {
        val entities = model
        if (entities == null) {
            onResult(PickOutcome.Empty)
            return
        }
        val outline = selectionBox?.entity
        // Filament's pick origin is the bottom-left of the viewport; Android
        // touch coordinates start at the top-left.
        view.pick(x, viewportHeight - y, handler) { result ->
            val objectId = entities.objectIdOf(result.renderable)
            onResult(
                when {
                    objectId != null -> PickOutcome.Hit(objectId)
                    outline != null && result.renderable == outline -> PickOutcome.Unchanged
                    else -> PickOutcome.Empty
                },
            )
        }
    }

    // -----------------------------------------------------------------------
    // Frames
    // -----------------------------------------------------------------------

    fun render(swapChain: SwapChain, frameTimeNanos: Long) {
        if (renderer.beginFrame(swapChain, frameTimeNanos)) {
            renderer.render(view)
            renderer.endFrame()
        }
    }

    fun createSwapChain(surface: Any, flags: Long): SwapChain = engine.createSwapChain(surface, flags)

    fun destroySwapChain(swapChain: SwapChain) {
        engine.destroySwapChain(swapChain)
        engine.flushAndWait()
    }

    // -----------------------------------------------------------------------
    // Teardown
    // -----------------------------------------------------------------------

    private fun releaseModel() {
        model?.let { entities ->
            for (e in entities.allEntities) filamentScene.removeEntity(e)
            entities.destroy(engine)
        }
        model = null
        uploadedScene = null
        presentationStats = null
        overlaysNow = emptySet()
        grid?.let { filamentScene.removeEntity(it.entity); it.destroy(engine) }
        grid = null
        selectionBox?.let { filamentScene.removeEntity(it.entity); it.destroy(engine) }
        selectionBox = null
        visibleNow = emptySet()
        currentState = null
    }

    fun destroy() {
        // Let the GPU finish with everything before the buffers go away.
        Fence.waitAndDestroy(engine.createFence(), Fence.Mode.FLUSH)
        releaseModel()
        filamentScene.removeEntity(sunEntity)
        engine.lightManager.destroy(sunEntity)
        EntityManager.get().destroy(sunEntity)
        indirectLight?.let { engine.destroyIndirectLight(it) }
        skybox?.let { engine.destroySkybox(it) }
        engine.destroyMaterial(opaqueMaterial)
        engine.destroyMaterial(translucentMaterial)
        engine.destroyMaterial(lineMaterial)
        engine.destroyView(view)
        engine.destroyScene(filamentScene)
        engine.destroyRenderer(renderer)
        engine.destroyCameraComponent(cameraEntity)
        EntityManager.get().destroy(cameraEntity)
        engine.destroy()
    }

    companion object {
        /** The technical viewport ground of MODEL, in linear space. */
        val BACKGROUND: FloatArray = PresentationLook.MODEL_BACKGROUND
    }
}

/** What a tap landed on. */
sealed interface PickOutcome {
    /** A semantic object: select it. */
    data class Hit(val objectId: String) : PickOutcome

    /** Background or a guide that means "nothing here": clear the selection. */
    data object Empty : PickOutcome

    /** A guide belonging to the current selection: leave the selection alone. */
    data object Unchanged : PickOutcome
}

// ---------------------------------------------------------------------------
// Uploaded model
// ---------------------------------------------------------------------------

/**
 * One semantic object on the GPU: one buffer pair, one material instance per
 * part, and up to two renderables over those buffers — its opaque parts and
 * its translucent parts (glazing, markers). The split exists only so that a
 * presentation can stop glazing from casting a shadow without also stopping
 * the frame around it: shadow casting is a property of a renderable, not of a
 * primitive. Both renderables answer a pick with the same object id.
 *
 * The object's roof covering, when it has one, is a third renderable of its
 * own buffers, answering with the same id.
 */
class ObjectEntity(
    val objectId: String,
    /** Opaque parts, or null when the object has none. */
    val opaque: Int?,
    /** Translucent parts, or null when the object has none. */
    val translucent: Int?,
    val vertexBuffer: VertexBuffer,
    val indexBuffer: IndexBuffer,
    /** One per part, in the object's part order. */
    val instances: List<MaterialInstance>,
    val cover: CoverEntity?,
) {
    /** The object's own surfaces: what visibility adds and removes. */
    val surfaces: List<Int> = listOfNotNull(opaque, translucent)

    fun setSelected(selected: Boolean) {
        val e = if (selected) Selection.EMISSIVE else ZERO
        for (instance in instances) instance.setParameter("emissive", e[0], e[1], e[2])
        cover?.instance?.setParameter("emissive", e[0], e[1], e[2])
    }

    fun destroy(engine: Engine) {
        opaque?.let { engine.renderableManager.destroy(it); EntityManager.get().destroy(it) }
        translucent?.let { engine.renderableManager.destroy(it); EntityManager.get().destroy(it) }
        engine.destroyVertexBuffer(vertexBuffer)
        engine.destroyIndexBuffer(indexBuffer)
        for (instance in instances) engine.destroyMaterialInstance(instance)
        cover?.destroy(engine)
    }

    private companion object {
        val ZERO = floatArrayOf(0f, 0f, 0f)
    }
}

/** A roof covering batch on the GPU: one renderable for every tile of one roof. */
class CoverEntity(
    val objectId: String,
    val entity: Int,
    private val vertexBuffer: VertexBuffer,
    private val indexBuffer: IndexBuffer,
    val instance: MaterialInstance,
) {
    fun destroy(engine: Engine) {
        engine.renderableManager.destroy(entity)
        engine.destroyVertexBuffer(vertexBuffer)
        engine.destroyIndexBuffer(indexBuffer)
        engine.destroyMaterialInstance(instance)
        EntityManager.get().destroy(entity)
    }
}

class ModelEntities(
    val all: List<ObjectEntity>,
    private val byEntity: Map<Int, String>,
    private val edges: FeatureEdgeSet,
    /** One line renderable per class batch, index for index with `edges.merged`. */
    private val mergedEdges: List<LineEntity?>,
    /** One line renderable per object group, index for index with `edges.groups`. */
    private val objectEdges: List<LineEntity?>,
) {
    val byId: Map<String, ObjectEntity> = all.associateBy { it.objectId }

    /** Every renderable this model uploaded: surfaces, coverings and lines. */
    val allEntities: List<Int> =
        all.flatMap { it.surfaces + listOfNotNull(it.cover?.entity) } +
            mergedEdges.mapNotNull { it?.entity } + objectEdges.mapNotNull { it?.entity }

    /** Filament renderable -> semantic object. The whole picking trace. */
    fun objectIdOf(renderable: Int): String? = byEntity[renderable]

    /**
     * The overlay renderables a state shows: the covering of each visible
     * roof in a mode that draws coverings, and the feature-edge groups the
     * edge set says are drawn for these objects, tiers and selection.
     */
    fun overlaysFor(visible: Set<String>, mode: PresentationMode, selected: String?): Set<Int> {
        val out = LinkedHashSet<Int>()
        if (mode.showsRoofCover) {
            for (id in visible) byId[id]?.cover?.let { out.add(it.entity) }
        }
        val tiers = mode.edgeTiers
        if (tiers.isNotEmpty()) {
            val drawn = edges.drawn(visible, tiers, selected)
            for (i in drawn.merged) mergedEdges[i]?.let { out.add(it.entity) }
            for (i in drawn.perObject) objectEdges[i]?.let { out.add(it.entity) }
        }
        return out
    }

    /** Line ink for a look: the selected object's own groups take the highlight. */
    fun inkEdges(look: PresentationLook, selected: String?) {
        for (line in mergedEdges) line?.setColor(look.edgeInk)
        for ((i, line) in objectEdges.withIndex()) {
            line?.setColor(if (selected != null && edges.groups[i].objectId == selected) look.selectedEdgeInk else look.edgeInk)
        }
    }

    /**
     * Material parameters for a presentation. MODEL reads the style exactly
     * as before; the studies read `StudyPalette`. Glazing's shadow casting
     * and the surfaces' depth offset follow the look.
     */
    fun applyAppearance(engine: Engine, scene: ModelScene, mode: PresentationMode, style: RenderStyle, look: PresentationLook) {
        val rm = engine.renderableManager
        for (entity in all) {
            val obj = scene.objectById(entity.objectId) ?: continue
            for ((i, part) in obj.parts.withIndex()) {
                val instance = entity.instances.getOrNull(i) ?: continue
                val a = if (mode.usesStyle) {
                    style.appearanceOf(part, part.materialId?.let { scene.materials[it] }, scene.styling)
                } else {
                    StudyPalette.appearanceOf(mode, part)
                }
                instance.setParameter("baseColor", a.red, a.green, a.blue, a.alpha)
                instance.setParameter("roughness", a.roughness)
                instance.setParameter("metallic", a.metallic)
                instance.setParameter("reflectance", a.reflectance)
                if (!part.part.isTranslucent) instance.setPolygonOffset(look.surfaceDepthOffset, look.surfaceDepthOffset)
            }
            entity.translucent?.let { glass ->
                val ri = rm.getInstance(glass)
                rm.setCastShadows(ri, look.glassShadows)
                rm.setReceiveShadows(ri, look.glassShadows)
            }
            entity.cover?.let { cover ->
                val a = StudyPalette.coverAppearance()
                cover.instance.setParameter("baseColor", a.red, a.green, a.blue, a.alpha)
                cover.instance.setParameter("roughness", a.roughness)
                cover.instance.setParameter("metallic", a.metallic)
                cover.instance.setParameter("reflectance", a.reflectance)
                cover.instance.setPolygonOffset(look.surfaceDepthOffset, look.surfaceDepthOffset)
            }
        }
    }

    fun destroy(engine: Engine) {
        for (o in all) o.destroy(engine)
        for (line in mergedEdges) line?.destroy(engine)
        for (line in objectEdges) line?.destroy(engine)
    }

    companion object {
        /**
         * Upload the whole model and its study overlays.
         *
         * Runs once per scene load. Each semantic object becomes one vertex
         * buffer, one index buffer and one primitive per geometry part, so a
         * part can carry its own material while the whole object stays a
         * single pickable thing; its opaque and translucent primitives go to
         * two renderables over those same buffers. Coverings and feature
         * edges are uploaded here too and enter the scene only in a mode that
         * draws them.
         */
        fun build(
            engine: Engine,
            scene: ModelScene,
            presentation: ScenePresentation,
            opaque: Material,
            translucent: Material,
            line: Material,
        ): ModelEntities {
            val entities = ArrayList<ObjectEntity>(scene.objects.size)
            val byEntity = HashMap<Int, String>(scene.objects.size * 3)

            for (obj in scene.objects) {
                if (!obj.hasGeometry) continue
                val vertexBuffer = buildVertexBuffer(engine, obj)
                val indexBuffer = buildIndexBuffer(engine, obj.vertexCount)

                val instances = ArrayList<MaterialInstance>(obj.parts.size)
                for (part in obj.parts) instances.add((if (part.part.isTranslucent) translucent else opaque).createInstance())

                fun renderable(translucentParts: Boolean): Int? {
                    val indices = obj.parts.indices.filter { obj.parts[it].part.isTranslucent == translucentParts }
                    if (indices.isEmpty()) return null
                    val entity = EntityManager.get().create()
                    val builder = RenderableManager.Builder(indices.size)
                        .boundingBox(boxOf(obj.bounds))
                        .culling(true)
                        .castShadows(true)
                        .receiveShadows(true)
                    for ((slot, i) in indices.withIndex()) {
                        val part = obj.parts[i]
                        builder.geometry(slot, RenderableManager.PrimitiveType.TRIANGLES, vertexBuffer, indexBuffer, part.first, part.count)
                        builder.material(slot, instances[i])
                        if (translucentParts) builder.blendOrder(slot, 1)
                    }
                    builder.build(engine, entity)
                    byEntity[entity] = obj.id
                    return entity
                }

                val cover = presentation.coverByObject[obj.id]?.let { batch ->
                    buildCover(engine, batch, opaque).also { byEntity[it.entity] = obj.id }
                }
                entities.add(ObjectEntity(obj.id, renderable(false), renderable(true), vertexBuffer, indexBuffer, instances, cover))
            }

            val edges = presentation.edges
            // Lines answer a pick with the object they outline, like its surfaces.
            val merged = edges.merged.map { m ->
                LineEntity.lines(engine, line, m.positions)?.also { l -> m.members.singleOrNull()?.let { byEntity[l.entity] = it } }
            }
            val perObject = edges.groups.map { g ->
                LineEntity.lines(engine, line, g.positions)?.also { l -> byEntity[l.entity] = g.objectId }
            }

            val model = ModelEntities(entities, byEntity, edges, merged, perObject)
            val look = PresentationLook.model(RenderStyle.CONSTRUCTION)
            model.applyAppearance(engine, scene, PresentationMode.MODEL, RenderStyle.CONSTRUCTION, look)
            model.inkEdges(look, null)
            return model
        }

        private fun buildCover(engine: Engine, batch: RoofCoverBatch, material: Material): CoverEntity {
            val vb = VertexBuffer.Builder()
                .bufferCount(2)
                .vertexCount(batch.vertexCount)
                .attribute(VertexBuffer.VertexAttribute.POSITION, 0, VertexBuffer.AttributeType.FLOAT3, 0, 12)
                .attribute(VertexBuffer.VertexAttribute.TANGENTS, 1, VertexBuffer.AttributeType.FLOAT4, 0, 16)
                .build(engine)
            vb.setBufferAt(engine, 0, directFloats(batch.positions))
            vb.setBufferAt(engine, 1, directFloats(batch.tangents))
            val indices = ByteBuffer.allocateDirect(batch.indices.size * 4).order(ByteOrder.nativeOrder())
            indices.asIntBuffer().put(batch.indices)
            indices.rewind()
            val ib = IndexBuffer.Builder()
                .indexCount(batch.indices.size)
                .bufferType(IndexBuffer.Builder.IndexType.UINT)
                .build(engine)
            ib.setBuffer(engine, indices)
            val instance = material.createInstance()
            val entity = EntityManager.get().create()
            RenderableManager.Builder(1)
                .boundingBox(boxOf(batch.bounds))
                .geometry(0, RenderableManager.PrimitiveType.TRIANGLES, vb, ib, 0, batch.indices.size)
                .material(0, instance)
                .culling(true)
                // The relief is the point: each course shades the one below.
                .castShadows(true)
                .receiveShadows(true)
                .build(engine, entity)
            return CoverEntity(batch.objectId, entity, vb, ib, instance)
        }

        private fun buildVertexBuffer(engine: Engine, obj: SceneObject): VertexBuffer {
            val positions = directFloats(obj.positions)
            val tangents = directFloats(obj.tangents)
            val vb = VertexBuffer.Builder()
                .bufferCount(2)
                .vertexCount(obj.vertexCount)
                .attribute(VertexBuffer.VertexAttribute.POSITION, 0, VertexBuffer.AttributeType.FLOAT3, 0, 12)
                .attribute(VertexBuffer.VertexAttribute.TANGENTS, 1, VertexBuffer.AttributeType.FLOAT4, 0, 16)
                .build(engine)
            vb.setBufferAt(engine, 0, positions)
            vb.setBufferAt(engine, 1, tangents)
            return vb
        }

        /**
         * Flat shading means no vertex is shared, so the index buffer is the
         * identity. It exists because Filament addresses a primitive's range
         * through indices.
         */
        private fun buildIndexBuffer(engine: Engine, vertexCount: Int): IndexBuffer {
            val buffer = ByteBuffer.allocateDirect(vertexCount * 4).order(ByteOrder.nativeOrder())
            val ints = buffer.asIntBuffer()
            for (i in 0 until vertexCount) ints.put(i)
            buffer.rewind()
            val ib = IndexBuffer.Builder()
                .indexCount(vertexCount)
                .bufferType(IndexBuffer.Builder.IndexType.UINT)
                .build(engine)
            ib.setBuffer(engine, buffer)
            return ib
        }

        fun directFloats(values: FloatArray): ByteBuffer {
            val buffer = ByteBuffer.allocateDirect(values.size * 4).order(ByteOrder.nativeOrder())
            buffer.asFloatBuffer().put(values)
            buffer.rewind()
            return buffer
        }

        fun boxOf(b: Bounds): Box {
            val c = b.center
            val h = b.size
            return Box(
                c.x.toFloat(), c.y.toFloat(), c.z.toFloat(),
                max(h.x / 2, 1e-3).toFloat(), max(h.y / 2, 1e-3).toFloat(), max(h.z / 2, 1e-3).toFloat(),
            )
        }
    }
}

// ---------------------------------------------------------------------------
// Guides
// ---------------------------------------------------------------------------

/**
 * Unlit line geometry: the ground grid and the selection outline.
 *
 * Guides, never building material. They are separate entities so that they can
 * never be picked as a semantic object and never appear in the inspector.
 */
class LineEntity(
    val entity: Int,
    private val vertexBuffer: VertexBuffer,
    private val indexBuffer: IndexBuffer,
    private val instance: MaterialInstance,
) {
    /** Recolour the line (a mode's ink, the selection's). A parameter write, nothing else. */
    fun setColor(color: FloatArray) {
        instance.setParameter("baseColor", color[0], color[1], color[2], color[3])
    }

    /** Re-point an existing box at new bounds. No allocation, no rebuild. */
    fun setBox(engine: Engine, b: Bounds) {
        val c = b.corners()
        val data = FloatArray(BOX_EDGES.size * 3)
        for ((i, idx) in BOX_EDGES.withIndex()) {
            val p = c[idx]
            data[i * 3] = p.x.toFloat()
            data[i * 3 + 1] = p.y.toFloat()
            data[i * 3 + 2] = p.z.toFloat()
        }
        vertexBuffer.setBufferAt(engine, 0, ModelEntities.directFloats(data))
        engine.renderableManager.setAxisAlignedBoundingBox(
            engine.renderableManager.getInstance(entity),
            ModelEntities.boxOf(b),
        )
    }

    fun destroy(engine: Engine) {
        engine.renderableManager.destroy(entity)
        engine.destroyVertexBuffer(vertexBuffer)
        engine.destroyIndexBuffer(indexBuffer)
        engine.destroyMaterialInstance(instance)
        EntityManager.get().destroy(entity)
    }

    companion object {
        /** Corner indices of the 12 edges of a box, as line-list pairs. */
        private val BOX_EDGES = intArrayOf(
            0, 1, 1, 2, 2, 3, 3, 0,
            4, 5, 5, 6, 6, 7, 7, 4,
            0, 4, 1, 5, 2, 6, 3, 7,
        )

        /**
         * A feature-edge line list, or null when there is nothing to draw.
         * Its colour is set by the presentation (`setColor`), and it is a
         * separate renderable so that it can be in the scene only in a mode
         * that inks edges.
         */
        fun lines(engine: Engine, material: Material, positions: FloatArray): LineEntity? {
            if (positions.size < 6) return null
            var b = Bounds.EMPTY
            var i = 0
            while (i + 2 < positions.size) {
                b = b.union(Bounds.around(Vec3(positions[i].toDouble(), positions[i + 1].toDouble(), positions[i + 2].toDouble())))
                i += 3
            }
            return create(engine, material, positions, floatArrayOf(0f, 0f, 0f, 0f), b.padded(0.01), guide = false)
        }

        fun box(engine: Engine, material: Material, color: FloatArray): LineEntity =
            create(engine, material, FloatArray(BOX_EDGES.size * 3), color, Bounds(Vec3.ZERO, Vec3.ZERO))

        /**
         * A one-metre technical grid on the ground plane, sized to the model
         * and a little beyond it, so the building has somewhere to stand.
         */
        fun grid(engine: Engine, material: Material, bounds: Bounds): LineEntity {
            val pad = max(2.0, bounds.radius * 0.35)
            val minX = floor(bounds.min.x - pad)
            val maxX = floor(bounds.max.x + pad) + 1
            val minZ = floor(bounds.min.z - pad)
            val maxZ = floor(bounds.max.z + pad) + 1
            val y = bounds.min.y - 0.01

            val points = ArrayList<Float>()
            var x = minX
            while (x <= maxX) {
                points.add(x.toFloat()); points.add(y.toFloat()); points.add(minZ.toFloat())
                points.add(x.toFloat()); points.add(y.toFloat()); points.add(maxZ.toFloat())
                x += 1.0
            }
            var z = minZ
            while (z <= maxZ) {
                points.add(minX.toFloat()); points.add(y.toFloat()); points.add(z.toFloat())
                points.add(maxX.toFloat()); points.add(y.toFloat()); points.add(z.toFloat())
                z += 1.0
            }
            val gridBounds = Bounds(Vec3(minX, y - 0.1, minZ), Vec3(maxX, y + 0.1, maxZ))
            return create(engine, material, points.toFloatArray(), PresentationLook.MODEL_GRID, gridBounds)
        }

        private fun create(engine: Engine, material: Material, data: FloatArray, color: FloatArray, bounds: Bounds, guide: Boolean = true): LineEntity {
            val vertexCount = data.size / 3
            val vb = VertexBuffer.Builder()
                .bufferCount(1)
                .vertexCount(vertexCount)
                .attribute(VertexBuffer.VertexAttribute.POSITION, 0, VertexBuffer.AttributeType.FLOAT3, 0, 12)
                .build(engine)
            vb.setBufferAt(engine, 0, ModelEntities.directFloats(data))

            val indices = ByteBuffer.allocateDirect(vertexCount * 4).order(ByteOrder.nativeOrder())
            val ints = indices.asIntBuffer()
            for (i in 0 until vertexCount) ints.put(i)
            indices.rewind()
            val ib = IndexBuffer.Builder()
                .indexCount(vertexCount)
                .bufferType(IndexBuffer.Builder.IndexType.UINT)
                .build(engine)
            ib.setBuffer(engine, indices)

            val instance = material.createInstance()
            instance.setParameter("baseColor", color[0], color[1], color[2], color[3])

            val entity = EntityManager.get().create()
            val builder = RenderableManager.Builder(1)
                .boundingBox(ModelEntities.boxOf(bounds))
                .geometry(0, RenderableManager.PrimitiveType.LINES, vb, ib, 0, vertexCount)
                .material(0, instance)
                .castShadows(false)
                .receiveShadows(false)
            // A guide is not the building: it must never answer a pick. A
            // feature edge is drawn after the surfaces it outlines.
            builder.priority(if (guide) 7 else 6)
            builder.build(engine, entity)

            return LineEntity(entity, vb, ib, instance)
        }

    }
}
