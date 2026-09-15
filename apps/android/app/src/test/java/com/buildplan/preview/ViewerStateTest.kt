package com.buildplan.preview

import com.buildplan.preview.render.RenderStyle
import com.buildplan.preview.scene.ViewerState
import com.buildplan.preview.scene.VisibilityMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** Selection, isolation and style: the rules the viewport promises the user. */
class ViewerStateTest {

    private val scene = TestScenes.marcowki
    private val roofId = scene.objects.first { it.kind == "roof" }.id
    private val groundWallId = scene.objects.first { it.kind == "wall" && it.levelId == scene.groundLevelId }.id

    @Test
    fun `hidden objects are not pickable`() {
        val state = ViewerState().withVisibility(scene, VisibilityMode.ROOF_OFF)
        assertFalse("a hidden roof must not answer a tap", state.isPickable(scene, roofId))
        assertTrue(state.isPickable(scene, groundWallId))
    }

    @Test
    fun `an isolated object is the only pickable one`() {
        val state = ViewerState().select(groundWallId).isolateSelected(scene)
        assertTrue(state.isPickable(scene, groundWallId))
        assertFalse(state.isPickable(scene, roofId))
    }

    @Test
    fun `a selection survives a visibility change that leaves it visible`() {
        val state = ViewerState().select(groundWallId).withVisibility(scene, VisibilityMode.ROOF_OFF)
        assertEquals(groundWallId, state.selectedObjectId)
    }

    @Test
    fun `a selection is cleared only when it becomes hidden`() {
        val state = ViewerState().select(roofId).withVisibility(scene, VisibilityMode.ROOF_OFF)
        assertNull("hiding the selected roof must clear the selection", state.selectedObjectId)
    }

    @Test
    fun `a selection survives camera-independent style changes`() {
        val state = ViewerState().select(roofId).withStyle(RenderStyle.CLAY)
        assertEquals(roofId, state.selectedObjectId)
        assertEquals(RenderStyle.CLAY, state.style)
        assertEquals("style must not touch visibility", VisibilityMode.ALL, state.visibility)
    }

    @Test
    fun `isolate then show all returns the whole building`() {
        val isolated = ViewerState().select(groundWallId).isolateSelected(scene)
        assertTrue(isolated.isIsolating)
        assertEquals(1, isolated.visibleObjectIds(scene).size)

        val restored = isolated.showAll()
        assertFalse(restored.isIsolating)
        assertEquals(scene.objects.size, restored.visibleObjectIds(scene).size)
        assertEquals("showing all must not drop the selection", groundWallId, restored.selectedObjectId)
    }

    @Test
    fun `isolating with nothing selected does nothing`() {
        val state = ViewerState()
        assertEquals(state, state.isolateSelected(scene))
    }

    @Test
    fun `choosing a visibility mode drops an isolation`() {
        val state = ViewerState().select(groundWallId).isolateSelected(scene).withVisibility(scene, VisibilityMode.ALL)
        assertFalse(state.isIsolating)
    }

    @Test
    fun `selecting nothing clears the selection`() {
        assertNull(ViewerState().select(groundWallId).select(null).selectedObjectId)
        assertNull(ViewerState().select(groundWallId).clearSelection().selectedObjectId)
    }
}
