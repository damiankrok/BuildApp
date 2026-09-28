package com.buildplan.preview.progress

import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.SceneObject
import com.buildplan.preview.scene.SemanticGroup

/**
 * The construction group of a semantic object: which part of the build it is.
 *
 * Read from what every bundle carries — the object's kind, the exporter's
 * semantic group of its meshes, its storey — and never from a house's name, a
 * URL or a fixture constant. An object the table cannot place is [UNMAPPED]:
 * it is not assigned to a stage it might not belong to.
 */
enum class ConstructionGroup {
    /** A slab on the lowest storey whose top is that storey's floor: the base slab. */
    BASE_SLAB,

    /** Walls, wall panels, their openings' reveals, structural members. */
    STRUCTURE,

    /** Rooms: spaces, which exist once the walls around them do. */
    SPACES,

    /** Slabs above the base, stairs, balcony slabs. */
    FLOORS_AND_STAIRS,

    /** Roofs, roof planes and openings, roof trim, chimneys. */
    ROOF,

    /** Windows, doors (garage doors included), rooflights. */
    JOINERY,

    /** Finish regions and cladding on the walls, facade frames, railings. */
    FACADE,

    /** Terraces, platforms, exterior steps, pergolas. */
    EXTERIOR_WORKS,

    /** Nothing in the rules says where this belongs. */
    UNMAPPED,
}

/**
 * The rules, as data: which group each kind belongs to, and at which starter
 * stage each group first stands. Stages absent from [introducedAt] have no
 * geometry of their own in any model this app can show (the purchase of the
 * plot, the design, formalities, site preparation, the installations,
 * plaster, screed, finishing): the timeline still stops there, and says so.
 */
object StageSemanticRules {
    /** Kinds whose group does not depend on anything else. */
    private val BY_KIND: Map<String, ConstructionGroup> = mapOf(
        "wall" to ConstructionGroup.STRUCTURE,
        "opening" to ConstructionGroup.STRUCTURE,
        "room" to ConstructionGroup.SPACES,
        "stair" to ConstructionGroup.FLOORS_AND_STAIRS,
        "roof" to ConstructionGroup.ROOF,
        "roofPlane" to ConstructionGroup.ROOF,
        "roofOpening" to ConstructionGroup.ROOF,
        "chimney" to ConstructionGroup.ROOF,
        "window" to ConstructionGroup.JOINERY,
        "door" to ConstructionGroup.JOINERY,
        "rooflight" to ConstructionGroup.JOINERY,
        "surfaceRegion" to ConstructionGroup.FACADE,
        "railing" to ConstructionGroup.FACADE,
        "terrace" to ConstructionGroup.EXTERIOR_WORKS,
        "platform" to ConstructionGroup.EXTERIOR_WORKS,
        "stepRun" to ConstructionGroup.EXTERIOR_WORKS,
    )

    /** A free member's role is its exporter group. */
    private val LINEAR_SOLID_BY_GROUP: Map<SemanticGroup, ConstructionGroup> = mapOf(
        SemanticGroup.STRUCTURAL_MEMBER to ConstructionGroup.STRUCTURE,
        SemanticGroup.ROOF_TRIM to ConstructionGroup.ROOF,
        SemanticGroup.ROOF_MAIN to ConstructionGroup.ROOF,
        SemanticGroup.FLAT_ROOF to ConstructionGroup.ROOF,
        SemanticGroup.FACADE_FRAME to ConstructionGroup.FACADE,
        SemanticGroup.PERGOLA_MEMBER to ConstructionGroup.EXTERIOR_WORKS,
    )

    val introducedAt: Map<ConstructionGroup, ConstructionStageKey> = mapOf(
        ConstructionGroup.BASE_SLAB to ConstructionStageKey.FOUNDATIONS,
        ConstructionGroup.STRUCTURE to ConstructionStageKey.WALLS,
        ConstructionGroup.SPACES to ConstructionStageKey.WALLS,
        ConstructionGroup.FLOORS_AND_STAIRS to ConstructionStageKey.FLOOR_SLAB,
        ConstructionGroup.ROOF to ConstructionStageKey.ROOF,
        ConstructionGroup.JOINERY to ConstructionStageKey.JOINERY,
        ConstructionGroup.FACADE to ConstructionStageKey.FACADE,
        ConstructionGroup.EXTERIOR_WORKS to ConstructionStageKey.GARDEN,
    )

    /** How close to its storey's floor a slab's top must be to count as the base slab, in metres. */
    const val BASE_SLAB_TOLERANCE_M = 0.05

    fun groupOf(obj: SceneObject, scene: ModelScene): ConstructionGroup {
        BY_KIND[obj.kind]?.let { return it }
        val groups = obj.parts.map { it.semanticGroup }.toSet()
        return when (obj.kind) {
            "slab" -> if (isBaseSlab(obj, scene)) ConstructionGroup.BASE_SLAB else ConstructionGroup.FLOORS_AND_STAIRS
            // A "balcony" whose every surface the exporter calls a terrace is a floor at the ground, not a cantilever.
            "balcony" -> if (groups.isNotEmpty() && groups.all { it == SemanticGroup.TERRACE_SURFACE }) ConstructionGroup.EXTERIOR_WORKS else ConstructionGroup.FLOORS_AND_STAIRS
            "wallPanel" -> if (groups.isNotEmpty() && groups.all { it == SemanticGroup.WALL_CLADDING }) ConstructionGroup.FACADE else ConstructionGroup.STRUCTURE
            "linearSolid" -> groups.map { LINEAR_SOLID_BY_GROUP[it] }.distinct().singleOrNull() ?: ConstructionGroup.UNMAPPED
            else -> ConstructionGroup.UNMAPPED
        }
    }

    /**
     * The base slab: on the lowest storey, its top at that storey's floor.
     * A slab on the lowest storey that tops out higher — a head over an
     * opening, a landing — is not the base.
     */
    fun isBaseSlab(obj: SceneObject, scene: ModelScene): Boolean {
        val ground = scene.levels.firstOrNull { it.id == scene.groundLevelId } ?: return false
        if (obj.levelId != ground.id) return false
        return obj.bounds.max.y <= ground.elevation + BASE_SLAB_TOLERANCE_M
    }
}

/**
 * Which stage a person is looking at in 3D. View state only: choosing one
 * never touches the saved progress.
 */
sealed interface ConstructionView {
    /** The whole design, as the project draws it — everything, including what no rule places. */
    data object Target : ConstructionView

    /** The house as it stands at the end of this stage, in the planned order. */
    data class AtStage(val stage: ConstructionStageKey) : ConstructionView

    /** What the owner has said is started or done, whatever the order. */
    data class Actual(val progress: ConstructionProgressState) : ConstructionView
}

/**
 * The semantic side of the construction time machine for one scene: every
 * object's group and the stage it first stands at, computed once per scene.
 * A view then becomes a set of visible object ids that the viewer
 * intersects with its own visibility (roof, storeys, isolation). It never
 * changes the scene, its geometry or the camera.
 */
class StageProjection(val scene: ModelScene) {
    /** Each object's construction group, in scene order. */
    val groups: Map<String, ConstructionGroup> = scene.objects.associate { it.id to StageSemanticRules.groupOf(it, scene) }

    /** The objects no rule places: shown only in [ConstructionView.Target]. */
    val unmapped: Set<String> = groups.filterValues { it == ConstructionGroup.UNMAPPED }.keys

    /** Each placed object's first stage. */
    private val stageOf: Map<String, ConstructionStageKey> =
        groups.mapNotNull { (id, g) -> StageSemanticRules.introducedAt[g]?.let { id to it } }.toMap()

    /** Stages at which at least one object of this scene first stands. */
    val stagesWithGeometry: Set<ConstructionStageKey> = stageOf.values.toSet()

    fun hasGeometry(stage: ConstructionStageKey): Boolean = stage in stagesWithGeometry

    /** The objects visible in a view; null for the target, which filters nothing. */
    fun visibleIds(view: ConstructionView): Set<String>? = when (view) {
        ConstructionView.Target -> null
        is ConstructionView.AtStage -> stageOf.filterValues { it.ordinal <= view.stage.ordinal }.keys
        is ConstructionView.Actual -> {
            val started = view.progress.stages
                .filter { it.status != StageStatus.NOT_STARTED }
                .mapNotNullTo(HashSet()) { it.stageKey }
            stageOf.filterValues { it in started }.keys
        }
    }

    /** The objects that first stand at exactly this stage. */
    fun introducedAt(stage: ConstructionStageKey): Set<String> = stageOf.filterValues { it == stage }.keys
}
