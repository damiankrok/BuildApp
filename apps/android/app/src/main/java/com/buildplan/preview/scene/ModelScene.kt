package com.buildplan.preview.scene

import com.buildplan.preview.math.Bounds
import com.buildplan.preview.math.Vec3

/**
 * The scene the renderer draws: one entry per SEMANTIC object.
 *
 * Grouping by `objectId` rather than by mesh is what makes selection honest. A
 * door's frame, leaf, glazing and handle are four compiled meshes but one
 * thing a person can tap, so they become one renderable with four primitives —
 * a tap anywhere on it resolves to the door. Batching further, into one
 * anonymous building mesh, would destroy exactly that.
 */
class SceneObject(
    val id: String,
    val kind: String,
    val levelId: String?,
    /** GPU positions, render frame, 3 floats per vertex. */
    val positions: FloatArray,
    /** Tangent-frame quaternions, 4 floats per vertex. */
    val tangents: FloatArray,
    val parts: List<ScenePart>,
    val bounds: Bounds,
    val triangleCount: Int,
    val metadata: BundleObject?,
) {
    val vertexCount: Int get() = positions.size / 3

    /**
     * Whether this object becomes a renderable on the GPU.
     *
     * An object the model names but compiles to nothing — a zone, a region
     * with no surface — is still a semantic object and still appears in the
     * inspector; it simply has no triangles to draw.
     */
    val hasGeometry: Boolean get() = vertexCount > 0
    val label: String get() = metadata?.label ?: id
    val kindLabel: String get() = metadata?.kindLabel ?: kind
}

/**
 * One primitive of a semantic object: the run of vertices belonging to a
 * single geometry part, which is what carries a material.
 */
class ScenePart(
    val part: GeometryPart,
    val rawPart: String,
    val materialId: String?,
    /** First vertex index of this part within the object's buffers. */
    val first: Int,
    val count: Int,
    /**
     * The styling group of this primitive: the bundle's own `semanticGroup`
     * when it names one this build knows, else derived from the part (older
     * bundles carry no group). Used by the Architectural style only.
     */
    val semanticGroup: SemanticGroup = SemanticGroup.derive(part),
    /**
     * The group exactly as the bundle wrote it, or null for an older bundle.
     * Looked up in `styling.groups` first, so a group added to the palette
     * after this build still draws in the colour the exporter chose.
     */
    val rawSemanticGroup: String? = null,
)

/** The compiler's geometry-part vocabulary, with a fallback that never throws. */
enum class GeometryPart {
    WALL, WALL_REVEAL,
    WINDOW_FRAME, WINDOW_GLASS, WINDOW_MULLION,
    DOOR_FRAME, DOOR_LEAF, DOOR_GLASS, DOOR_PANEL, DOOR_HANDLE,
    SLAB, ROOF, ROOF_REVEAL, ROOFLIGHT_FRAME, ROOFLIGHT_GLASS,
    BALCONY, RAILING_POST, RAILING_RAIL, RAILING_INFILL,
    CHIMNEY, ROOM_FLOOR, STAIR_PLACEHOLDER, STAIR_STEP, SURFACE_REGION, LINEAR_SOLID,
    /** A terrace platform: an exterior floor at or near the ground, distinct from a slab. */
    TERRACE,
    /** A roof edge member compiled with its roof: a verge board or a fascia. */
    ROOF_TRIM,
    OTHER;

    /** Glazing and markers read through; they blend and never cast shadows. */
    val isTranslucent: Boolean
        get() = this == WINDOW_GLASS || this == DOOR_GLASS || this == ROOFLIGHT_GLASS ||
            this == RAILING_INFILL || this == ROOM_FLOOR || this == STAIR_PLACEHOLDER

    companion object {
        private val byName = entries.associateBy { it.name }
        fun of(raw: String): GeometryPart = byName[raw] ?: OTHER
    }
}

/**
 * The styling vocabulary between a part and an object, mirroring
 * `SemanticGroup` in `packages/mobile-scene/src/semantics.ts`: coarse enough
 * that a palette can give every group a deliberately separated value, fine
 * enough that what a person tells apart on a drawing — main wall, secondary
 * wall, trim, glass, frame, roof, flat roof, terrace — stays apart on screen.
 *
 * The exporter derives each mesh's group from the model and writes it into
 * the bundle; that is the authoritative placement. `derive` is only the
 * fallback for bundles exported before groups existed, and reads what a
 * bundle always has: the part, the material's name, and the other parts of
 * the same object. It never reads a coordinate and never names a building.
 */
enum class SemanticGroup {
    WALL_MAIN,
    WALL_SECONDARY,
    WALL_INTERIOR,
    ROOF_MAIN,
    FLAT_ROOF,
    ROOF_TRIM,
    WINDOW_GLASS,
    WINDOW_FRAME,
    DOOR,
    GARAGE_DOOR,
    SLAB,
    BALCONY_SLAB,
    RAILING,
    FACADE_FRAME,
    TERRACE_SURFACE,
    CHIMNEY,
    ROOFLIGHT,
    STAIR,
    ROOM,
    OTHER;

    companion object {
        private val byName = entries.associateBy { it.name }
        private val INTERIOR_MATERIAL = Regex("PARTITION|INTERIOR")
        private val FLAT_MATERIAL = Regex("MEMBRANE|FLAT")
        private val GLASS_MATERIAL = Regex("GLASS|GLAZ")

        /** The group a bundle names, or null for none or a name this build does not know. */
        fun of(raw: String?): SemanticGroup? = raw?.let { byName[it] }

        /**
         * The group of one primitive when the bundle does not say.
         *
         * `materialText` is the material's id and name, when the model gave the
         * object a material: a "flat roof membrane" or a "partition" stated as
         * a finish is the only hint an older bundle carries. `objectParts`
         * tells a sectional door (solid panels, no leaf, no glazing) from a
         * door you walk through.
         */
        fun derive(
            part: GeometryPart,
            materialText: String = "",
            objectParts: Set<GeometryPart> = emptySet(),
        ): SemanticGroup {
            val material = materialText.uppercase()
            return when (part) {
                GeometryPart.WALL, GeometryPart.WALL_REVEAL ->
                    if (INTERIOR_MATERIAL.containsMatchIn(material)) WALL_INTERIOR else WALL_MAIN
                GeometryPart.ROOF, GeometryPart.ROOF_REVEAL ->
                    if (FLAT_MATERIAL.containsMatchIn(material)) FLAT_ROOF else ROOF_MAIN
                GeometryPart.ROOF_TRIM -> ROOF_TRIM
                GeometryPart.WINDOW_GLASS, GeometryPart.DOOR_GLASS, GeometryPart.ROOFLIGHT_GLASS -> WINDOW_GLASS
                GeometryPart.WINDOW_FRAME, GeometryPart.WINDOW_MULLION -> WINDOW_FRAME
                GeometryPart.DOOR_FRAME, GeometryPart.DOOR_LEAF, GeometryPart.DOOR_PANEL, GeometryPart.DOOR_HANDLE -> {
                    val sectional = GeometryPart.DOOR_PANEL in objectParts &&
                        GeometryPart.DOOR_LEAF !in objectParts &&
                        GeometryPart.DOOR_GLASS !in objectParts
                    if (sectional) GARAGE_DOOR else DOOR
                }
                GeometryPart.SLAB -> SLAB
                GeometryPart.BALCONY -> BALCONY_SLAB
                GeometryPart.TERRACE -> TERRACE_SURFACE
                GeometryPart.RAILING_POST, GeometryPart.RAILING_RAIL -> RAILING
                GeometryPart.RAILING_INFILL -> if (GLASS_MATERIAL.containsMatchIn(material)) WINDOW_GLASS else RAILING
                GeometryPart.CHIMNEY -> CHIMNEY
                GeometryPart.ROOFLIGHT_FRAME -> ROOFLIGHT
                GeometryPart.STAIR_STEP, GeometryPart.STAIR_PLACEHOLDER -> STAIR
                GeometryPart.ROOM_FLOOR -> ROOM
                // A finish region is a secondary surface of its wall: it reads as a band.
                GeometryPart.SURFACE_REGION -> WALL_SECONDARY
                // Free members — portal heads, boards not compiled with a roof — frame the facade.
                GeometryPart.LINEAR_SOLID -> FACADE_FRAME
                GeometryPart.OTHER -> OTHER
            }
        }
    }
}

class ModelScene(
    val key: String,
    val title: String,
    val subtitle: String,
    val bundle: SceneBundle,
    val objects: List<SceneObject>,
    val levels: List<BundleLevel>,
    /** Whole-model bounds in the RENDER frame. */
    val bounds: Bounds,
    val materials: Map<String, BundleMaterial>,
) {
    private val index = objects.associateBy { it.id }

    /** The bundle's palette block, or null for a bundle exported before it existed. */
    val styling: BundleStyling? get() = bundle.styling

    fun objectById(id: String?): SceneObject? = if (id == null) null else index[id]

    /**
     * The objects that carry geometry, and therefore the exact set of ids the
     * renderer can have entities for.
     *
     * Object ids are only meaningful inside their own model: two buildings
     * name their walls independently, so a visible-id set computed against one
     * scene resolves to almost nothing in another. Stating the uploadable set
     * here lets the renderer — and the tests — check that what it is asked to
     * show belongs to the model it uploaded.
     */
    val renderableObjectIds: Set<String> = objects.filter { it.hasGeometry }.mapTo(LinkedHashSet()) { it.id }

    val triangleCount: Int get() = bundle.scene.stats.triangleCount
    val meshCount: Int get() = bundle.scene.stats.meshCount
    val objectCount: Int get() = objects.size

    /** The lowest storey, whatever a particular building calls it. */
    val groundLevelId: String? = levels.minByOrNull { it.index }?.id

    fun levelLabel(id: String?): String? = levels.firstOrNull { it.id == id }?.label

    /**
     * The staircase to frame for the Stairs preset: the stair object carrying
     * the most geometry, so a real flight always wins over a placeholder
     * footprint. Generic — it asks the scene, not the building.
     */
    val stairObjectId: String? = objects
        .filter { it.kind == "stair" }
        .maxByOrNull { it.triangleCount }
        ?.id

    /**
     * The entrance to frame for the Entrance preset.
     *
     * Generic rule, stated in terms of the canonical frame rather than any
     * particular house: among doors on the lowest storey that have a real
     * DOOR_LEAF — a walk-through door, so a sectional garage panel is not one —
     * take the one nearest the FRONT facade. In the model frame z grows into
     * the building, so the front facade is the largest z after conversion.
     */
    val entranceObjectId: String? = objects
        .filter { it.kind == "door" }
        .filter { o -> o.parts.any { it.part == GeometryPart.DOOR_LEAF } }
        .filter { groundLevelId == null || it.levelId == null || it.levelId == groundLevelId }
        .maxByOrNull { it.bounds.center.z }
        ?.id

    companion object {
        /**
         * Build the render-ready scene from a validated bundle.
         *
         * Every triangle passes through `ModelFrame` exactly once here. The
         * loop preserves the compiler's mesh order inside each object so that
         * a part's vertex range is stable between loads.
         */
        fun from(bundle: SceneBundle, key: String, title: String, subtitle: String): ModelScene {
            val meshesByObject = LinkedHashMap<String, MutableList<BundleMesh>>()
            for (mesh in bundle.scene.meshes) meshesByObject.getOrPut(mesh.objectId) { mutableListOf() }.add(mesh)

            val metadata = bundle.objects.associateBy { it.id }
            val objects = ArrayList<SceneObject>(meshesByObject.size)

            val materialsById = bundle.materials.associateBy { it.id }

            for ((objectId, meshes) in meshesByObject) {
                val objectParts = meshes.mapTo(HashSet()) { GeometryPart.of(it.part) }
                val triangles = meshes.sumOf { it.triangleCount }
                val vertices = triangles * 3
                val positions = FloatArray(vertices * 3)
                val tangents = FloatArray(vertices * 4)
                val parts = ArrayList<ScenePart>(meshes.size)

                var vertexCursor = 0
                var objectBounds = Bounds.EMPTY

                for (mesh in meshes) {
                    val converted = ModelFrame.renderPositions(mesh.positions)
                    System.arraycopy(converted, 0, positions, vertexCursor * 3, converted.size)

                    for (t in 0 until mesh.triangleCount) {
                        val n = ModelFrame.triangleNormal(converted, t)
                        val q = TangentFrames.fromNormal(n)
                        for (v in 0 until 3) {
                            val o = (vertexCursor + t * 3 + v) * 4
                            tangents[o] = q[0]; tangents[o + 1] = q[1]; tangents[o + 2] = q[2]; tangents[o + 3] = q[3]
                        }
                    }

                    var i = 0
                    while (i + 2 < converted.size) {
                        val p = Vec3(converted[i].toDouble(), converted[i + 1].toDouble(), converted[i + 2].toDouble())
                        objectBounds = objectBounds.union(Bounds.around(p))
                        i += 3
                    }

                    val part = GeometryPart.of(mesh.part)
                    parts.add(
                        ScenePart(
                            part = part,
                            rawPart = mesh.part,
                            materialId = mesh.materialId,
                            first = vertexCursor,
                            count = mesh.triangleCount * 3,
                            semanticGroup = SemanticGroup.of(mesh.semanticGroup) ?: SemanticGroup.derive(
                                part,
                                mesh.materialId?.let { id -> "$id ${materialsById[id]?.name ?: ""}" } ?: "",
                                objectParts,
                            ),
                            rawSemanticGroup = mesh.semanticGroup,
                        ),
                    )
                    vertexCursor += mesh.triangleCount * 3
                }

                val first = meshes.first()
                objects.add(
                    SceneObject(
                        id = objectId,
                        kind = first.objectKind,
                        levelId = meshes.firstNotNullOfOrNull { it.levelId } ?: metadata[objectId]?.levelId,
                        positions = positions,
                        tangents = tangents,
                        parts = parts,
                        bounds = objectBounds,
                        triangleCount = triangles,
                        metadata = metadata[objectId],
                    ),
                )
            }

            return ModelScene(
                key = key,
                title = title,
                subtitle = subtitle,
                bundle = bundle,
                objects = objects,
                levels = bundle.levels.sortedBy { it.index },
                bounds = ModelFrame.bounds(bundle.scene.bounds),
                materials = bundle.materials.associateBy { it.id },
            )
        }
    }
}
