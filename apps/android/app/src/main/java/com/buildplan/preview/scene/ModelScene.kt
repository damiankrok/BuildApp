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
)

/** The compiler's geometry-part vocabulary, with a fallback that never throws. */
enum class GeometryPart {
    WALL, WALL_REVEAL,
    WINDOW_FRAME, WINDOW_GLASS, WINDOW_MULLION,
    DOOR_FRAME, DOOR_LEAF, DOOR_GLASS, DOOR_PANEL, DOOR_HANDLE,
    SLAB, ROOF, ROOF_REVEAL, ROOFLIGHT_FRAME, ROOFLIGHT_GLASS,
    BALCONY, RAILING_POST, RAILING_RAIL, RAILING_INFILL,
    CHIMNEY, ROOM_FLOOR, STAIR_PLACEHOLDER, STAIR_STEP, SURFACE_REGION,
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

    fun objectById(id: String?): SceneObject? = if (id == null) null else index[id]

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

            for ((objectId, meshes) in meshesByObject) {
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

                    parts.add(
                        ScenePart(
                            part = GeometryPart.of(mesh.part),
                            rawPart = mesh.part,
                            materialId = mesh.materialId,
                            first = vertexCursor,
                            count = mesh.triangleCount * 3,
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
