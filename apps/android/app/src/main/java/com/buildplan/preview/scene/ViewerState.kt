package com.buildplan.preview.scene

import com.buildplan.preview.presentation.PresentationMode
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
    /**
     * MODEL, CLAY or LINE. Like the style, it is how the viewer draws and not
     * part of the model: it never changes selection, visibility or the camera.
     */
    val presentation: PresentationMode = PresentationMode.MODEL,
    /**
     * The construction time machine's objects (`progress.StageProjection`):
     * what stands at the stage being looked at, or null for the whole design.
     * Like the layers, it only decides which uploaded objects are in the
     * scene; the model, its geometry and the camera stay as they are.
     */
    val construction: Set<String>? = null,
) {
    val isIsolating: Boolean get() = isolatedObjectId != null

    /**
     * What is drawn: the construction stage ∩ the layer mode (roof, storeys)
     * ∩ the isolation. Each filter can only remove objects, so the order is
     * immaterial and the result is deterministic; isolating an object that
     * does not stand yet at the stage shown shows nothing, which is true.
     */
    fun visibleObjectIds(scene: ModelScene): Set<String> {
        val layers = Visibility.visibleObjectIds(scene, visibility, isolatedObjectId)
        return construction?.let { stage -> layers.filterTo(LinkedHashSet()) { it in stage } } ?: layers
    }

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

    /** Neither does the presentation mode: same objects, same selection, drawn differently. */
    fun withPresentation(mode: PresentationMode): ViewerState = copy(presentation = mode)

    /**
     * Look at another construction stage. The selection is kept even when its
     * object does not stand at that stage — scrubbing back and forth must not
     * throw it away; it is simply not drawn, highlighted or pickable meanwhile.
     */
    fun withConstruction(visible: Set<String>?): ViewerState = copy(construction = visible)
}
