package com.buildplan.preview.render

import android.content.res.AssetManager
import com.buildplan.preview.camera.OrbitCamera
import com.buildplan.preview.camera.OrbitPose
import com.buildplan.preview.camera.Projection
import com.buildplan.preview.math.Bounds
import com.buildplan.preview.math.Vec3
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
    private var grid: LineEntity? = null
    private var selectionBox: LineEntity? = null

    private var currentState: ViewerState? = null
    private var visibleNow: Set<String> = emptySet()
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
        view.ambientOcclusionOptions = View.AmbientOcclusionOptions().apply {
            enabled = true
            quality = View.QualityLevel.LOW
            // Contact darkening at reveals and under eaves is what makes the
            // depth of an opening readable; more than that is noise.
            intensity = 0.7f
            radius = 0.35f
        }
        view.setShadowingEnabled(true)
        view.dynamicResolutionOptions = View.DynamicResolutionOptions().apply {
            enabled = true
            quality = View.QualityLevel.MEDIUM
        }
        view.blendMode = View.BlendMode.OPAQUE
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
            .intensity(26_000f)
            .build(engine)
            .also { filamentScene.indirectLight = it }

        sunEntity = EntityManager.get().create()
        LightManager.Builder(LightManager.Type.SUN)
            .color(1.0f, 0.96f, 0.90f)
            .intensity(72_000f)
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
        model = ModelEntities.build(engine, scene, opaqueMaterial, translucentMaterial)
        grid = LineEntity.grid(engine, lineMaterial, scene.bounds)
        selectionBox = LineEntity.box(engine, lineMaterial, Selection.OUTLINE)
        grid?.let { filamentScene.addEntity(it.entity) }
        currentState = null
        visibleNow = emptySet()
    }

    /**
     * Apply viewer state.
     *
     * Only what actually changed is touched: a style change rewrites material
     * parameters, a visibility change moves entities in and out of the scene,
     * a selection change updates two objects' emissive and the outline box.
     */
    fun setState(scene: ModelScene, state: ViewerState) {
        val entities = model ?: return
        val previous = currentState
        // Called every frame; nothing below is worth doing when nothing moved.
        if (previous == state) return

        if (previous == null || previous.style != state.style) {
            entities.applyStyle(engine, scene, state.style)
        }

        val visible = state.visibleObjectIds(scene)
        if (visible != visibleNow) {
            for (id in visibleNow - visible) entities.byId[id]?.let { filamentScene.removeEntity(it.entity) }
            for (id in visible - visibleNow) entities.byId[id]?.let { filamentScene.addEntity(it.entity) }
            visibleNow = visible
        }

        if (previous?.selectedObjectId != state.selectedObjectId || previous?.style != state.style) {
            previous?.selectedObjectId?.let { entities.byId[it]?.setSelected(false) }
            state.selectedObjectId?.let { entities.byId[it]?.setSelected(true) }
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
            for (o in entities.all) filamentScene.removeEntity(o.entity)
            entities.destroy(engine)
        }
        model = null
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
        /** The technical viewport ground, in linear space. */
        val BACKGROUND = floatArrayOf(
            RenderStyle.srgbToLinear(0x12 / 255f),
            RenderStyle.srgbToLinear(0x15 / 255f),
            RenderStyle.srgbToLinear(0x1a / 255f),
        )
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

/** One semantic object on the GPU: one entity, one buffer pair, one material per part. */
class ObjectEntity(
    val objectId: String,
    val entity: Int,
    val vertexBuffer: VertexBuffer,
    val indexBuffer: IndexBuffer,
    val instances: List<MaterialInstance>,
) {
    fun setSelected(selected: Boolean) {
        val e = if (selected) Selection.EMISSIVE else ZERO
        for (instance in instances) instance.setParameter("emissive", e[0], e[1], e[2])
    }

    fun destroy(engine: Engine) {
        engine.renderableManager.destroy(entity)
        engine.destroyVertexBuffer(vertexBuffer)
        engine.destroyIndexBuffer(indexBuffer)
        for (instance in instances) engine.destroyMaterialInstance(instance)
        EntityManager.get().destroy(entity)
    }

    private companion object {
        val ZERO = floatArrayOf(0f, 0f, 0f)
    }
}

class ModelEntities(val all: List<ObjectEntity>, private val byEntity: Map<Int, String>) {
    val byId: Map<String, ObjectEntity> = all.associateBy { it.objectId }

    /** Filament renderable -> semantic object. The whole picking trace. */
    fun objectIdOf(renderable: Int): String? = byEntity[renderable]

    fun applyStyle(engine: Engine, scene: ModelScene, style: RenderStyle) {
        for (entity in all) {
            val obj = scene.objectById(entity.objectId) ?: continue
            for ((i, part) in obj.parts.withIndex()) {
                val instance = entity.instances.getOrNull(i) ?: continue
                val material = part.materialId?.let { scene.materials[it] }
                val a = style.appearanceOf(part.part, material)
                instance.setParameter("baseColor", a.red, a.green, a.blue, a.alpha)
                instance.setParameter("roughness", a.roughness)
                instance.setParameter("metallic", a.metallic)
                instance.setParameter("reflectance", a.reflectance)
            }
        }
    }

    fun destroy(engine: Engine) {
        for (o in all) o.destroy(engine)
    }

    companion object {
        /**
         * Upload the whole model.
         *
         * Runs once per scene load. Each semantic object becomes one entity
         * with one vertex buffer, one index buffer and one primitive per
         * geometry part, so a part can carry its own material while the whole
         * object stays a single pickable thing.
         */
        fun build(engine: Engine, scene: ModelScene, opaque: Material, translucent: Material): ModelEntities {
            val entities = ArrayList<ObjectEntity>(scene.objects.size)
            val byEntity = HashMap<Int, String>(scene.objects.size * 2)

            for (obj in scene.objects) {
                if (obj.vertexCount == 0) continue
                val entity = EntityManager.get().create()
                val vertexBuffer = buildVertexBuffer(engine, obj)
                val indexBuffer = buildIndexBuffer(engine, obj.vertexCount)

                val builder = RenderableManager.Builder(obj.parts.size)
                    .boundingBox(boxOf(obj.bounds))
                    .culling(true)
                    .castShadows(true)
                    .receiveShadows(true)

                val instances = ArrayList<MaterialInstance>(obj.parts.size)
                for ((i, part) in obj.parts.withIndex()) {
                    val isGlass = part.part.isTranslucent
                    val instance = (if (isGlass) translucent else opaque).createInstance()
                    instances.add(instance)
                    builder.geometry(i, RenderableManager.PrimitiveType.TRIANGLES, vertexBuffer, indexBuffer, part.first, part.count)
                    builder.material(i, instance)
                    // Glazing must not throw a hard shadow or cast a pane
                    // shaped shadow across the room behind it.
                    if (isGlass) builder.blendOrder(i, 1)
                }
                builder.build(engine, entity)

                entities.add(ObjectEntity(obj.id, entity, vertexBuffer, indexBuffer, instances))
                byEntity[entity] = obj.id
            }

            val model = ModelEntities(entities, byEntity)
            model.applyStyle(engine, scene, RenderStyle.CONSTRUCTION)
            return model
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
            return create(engine, material, points.toFloatArray(), GRID_COLOR, gridBounds)
        }

        private fun create(engine: Engine, material: Material, data: FloatArray, color: FloatArray, bounds: Bounds): LineEntity {
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
            RenderableManager.Builder(1)
                .boundingBox(ModelEntities.boxOf(bounds))
                .geometry(0, RenderableManager.PrimitiveType.LINES, vb, ib, 0, vertexCount)
                .material(0, instance)
                .castShadows(false)
                .receiveShadows(false)
                // A guide is not the building: it must never answer a pick.
                .priority(7)
                .build(engine, entity)

            return LineEntity(entity, vb, ib, instance)
        }

        private val GRID_COLOR = floatArrayOf(
            RenderStyle.srgbToLinear(0.29f),
            RenderStyle.srgbToLinear(0.33f),
            RenderStyle.srgbToLinear(0.38f),
            0.55f,
        )
    }
}
