package com.buildplan.preview.scene

import com.buildplan.preview.render.RenderStyle

/**
 * Everything the viewport shows that is not the camera.
 *
 * Immutable, and free of Android and Filament, so the rules below — when a
 * selection survives, what may be picked — are ordinary unit tests rather than
 * something only a device can check.
 */
data class ViewerState(
    val visibility: VisibilityMode = VisibilityMode.ALL,
    val isolatedObjectId: String? = null,
    val style: RenderStyle = RenderStyle.CONSTRUCTION,
    val selectedObjectId: String? = null,
) {
    val isIsolating: Boolean get() = isolatedObjectId != null

    fun visibleObjectIds(scene: ModelScene): Set<String> =
        Visibility.visibleObjectIds(scene, visibility, isolatedObjectId)

    fun isVisible(scene: ModelScene, objectId: String): Boolean = objectId in visibleObjectIds(scene)

    /** Hidden geometry is never pickable: a tap must not select what is not there. */
    fun isPickable(scene: ModelScene, objectId: String): Boolean = isVisible(scene, objectId)

    fun select(objectId: String?): ViewerState = copy(selectedObjectId = objectId)

    fun clearSelection(): ViewerState = copy(selectedObjectId = null)

    /**
     * Change the visibility mode.
     *
     * The selection survives unless the selected object has just been hidden —
     * losing a selection because the roof went off would make the two controls
     * fight each other.
     */
    fun withVisibility(scene: ModelScene, mode: VisibilityMode): ViewerState {
        val next = copy(visibility = mode, isolatedObjectId = null)
        return if (next.selectedObjectId != null && !next.isVisible(scene, next.selectedObjectId)) next.clearSelection() else next
    }

    /** Isolate the current selection. Without a selection nothing changes. */
    fun isolateSelected(scene: ModelScene): ViewerState {
        val id = selectedObjectId ?: return this
        if (scene.objectById(id) == null) return this
        return copy(isolatedObjectId = id)
    }

    fun showAll(): ViewerState = copy(visibility = VisibilityMode.ALL, isolatedObjectId = null)

    /** Style never touches selection, visibility or the camera. */
    fun withStyle(style: RenderStyle): ViewerState = copy(style = style)
}
