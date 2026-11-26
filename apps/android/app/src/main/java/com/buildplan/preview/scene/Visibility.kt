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
    /**
     * v3.54.14: the modes [scene] can show. "Only the storeys above the lowest" needs a storey above the lowest — the
     * same rule as the attic-plan preset — so a single-storey house (a bungalow) is never offered an empty layer.
     */
    fun availableModes(scene: ModelScene): List<VisibilityMode> =
        VisibilityMode.entries.filter { it != VisibilityMode.UPPER_ONLY || scene.levels.size > 1 }

    /**
     * What a mode actually leaves out of [scene], for the words that say it (MARCOWKI-UI): derived from the filter
     * itself, so the sentence is true for any building — "Tylko parter" keeps a garage roof that stands on the ground
     * storey, and a bungalow has no upper storey to hide.
     */
    data class Hidden(val roofHidden: Boolean, val roofKept: Boolean, val upperHidden: Boolean, val groundHidden: Boolean, val roofWindowsHidden: Boolean = false)

    fun hidden(scene: ModelScene, mode: VisibilityMode): Hidden {
        val ground = scene.groundLevelId
        var roofHidden = false
        var roofKept = false
        var upperHidden = false
        var groundHidden = false
        var roofWindowsHidden = false
        for (o in scene.objects) {
            val shown = isVisible(o, mode, ground)
            val roof = o.kind in ROOF_KINDS
            if (roof && !shown && o.kind != "roof") roofWindowsHidden = true
            when {
                roof && shown -> roofKept = true
                roof -> roofHidden = true
                shown || o.levelId == null -> Unit
                o.levelId == ground -> groundHidden = true
                else -> upperHidden = true
            }
        }
        return Hidden(roofHidden, roofKept, upperHidden, groundHidden, roofWindowsHidden)
    }

    fun visibleObjectIds(scene: ModelScene, mode: VisibilityMode, isolated: String? = null): Set<String> {
        if (isolated != null && scene.objectById(isolated) != null) return setOf(isolated)
        val ground = scene.groundLevelId
        return scene.objects.asSequence()
            .filter { isVisible(it, mode, ground) }
            .map { it.id }
            .toSet()
    }

    /**
     * Everything a mode reads of an object: whether it belongs to the roof,
     * and its storey. Two objects with the same class are shown or hidden
     * together by every mode (isolation aside), which is what lets derived
     * overlays be batched per class instead of per object.
     */
    fun classOf(o: SceneObject): String = "${if (o.kind in ROOF_KINDS) "roof" else "body"}@${o.levelId ?: "-"}"

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
