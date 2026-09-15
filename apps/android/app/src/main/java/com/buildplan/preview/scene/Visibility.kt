package com.buildplan.preview.scene

/**
 * Visibility is renderer state, never a change to the building.
 *
 * Hiding the roof does not recompile anything and removes no semantic object:
 * it decides which of the already-uploaded renderables are in the Filament
 * scene this frame. Switching back shows exactly the same geometry again.
 *
 * The modes are expressed through the bundle's own storey list, so they work
 * for any building: "ground" means the lowest storey the model declares, not a
 * hard-coded name.
 */
enum class VisibilityMode(val label: String, val description: String) {
    ALL("All", "Show the whole building"),
    ROOF_OFF("Roof off", "Hide the roof and its rooflights, so the attic is inspectable"),
    GROUND_ONLY("Ground", "Show only the lowest storey"),
    UPPER_ONLY("Attic", "Show only the storeys above the lowest, roof off"),
    CUTAWAY("Cutaway", "Hide the roof and every storey above the lowest"),
}

object Visibility {
    /**
     * Kinds that belong to the roof plane. Rooflights and the reveals of roof
     * openings go with it: a rooflight left hovering where its roof used to be
     * would be a lie about the building.
     */
    val ROOF_KINDS = setOf("roof", "roofOpening", "rooflight")

    /**
     * The objects a mode shows.
     *
     * `isolated` overrides the mode entirely: isolating is the user saying
     * "just this one", and it should not also have to satisfy a storey filter.
     */
    fun visibleObjectIds(scene: ModelScene, mode: VisibilityMode, isolated: String? = null): Set<String> {
        if (isolated != null && scene.objectById(isolated) != null) return setOf(isolated)
        val ground = scene.groundLevelId
        return scene.objects.asSequence()
            .filter { isVisible(it, mode, ground) }
            .map { it.id }
            .toSet()
    }

    fun isVisible(o: SceneObject, mode: VisibilityMode, groundLevelId: String?): Boolean {
        val isRoof = o.kind in ROOF_KINDS
        return when (mode) {
            VisibilityMode.ALL -> true
            VisibilityMode.ROOF_OFF -> !isRoof
            // A storey filter is about what stands on a storey, so an object
            // the model puts on no storey is not part of one.
            VisibilityMode.GROUND_ONLY -> o.levelId != null && o.levelId == groundLevelId
            VisibilityMode.UPPER_ONLY -> !isRoof && o.levelId != null && o.levelId != groundLevelId
            // The cutaway keeps storey-less geometry: it is a section through
            // the building, not a filter on one floor's contents.
            VisibilityMode.CUTAWAY -> !isRoof && (o.levelId == null || o.levelId == groundLevelId)
        }
    }
}
