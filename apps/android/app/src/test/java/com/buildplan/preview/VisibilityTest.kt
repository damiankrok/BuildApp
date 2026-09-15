package com.buildplan.preview

import com.buildplan.preview.scene.Visibility
import com.buildplan.preview.scene.VisibilityMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Visibility filters the renderer, never the model.
 *
 * Every mode is checked to hide the right things AND to be reversible: the
 * same object set must come back when the filter is lifted, because a viewer
 * that cannot restore what it hid has mutated the building.
 */
class VisibilityTest {

    private val scene = TestScenes.marcowki
    private val all = Visibility.visibleObjectIds(scene, VisibilityMode.ALL)

    @Test
    fun `the model has the storeys the filters need`() {
        assertTrue("the reference model has more than one storey", scene.levels.size >= 2)
        assertEquals("the lowest storey is the ground", scene.levels.minByOrNull { it.index }?.id, scene.groundLevelId)
    }

    @Test
    fun `All shows every object that owns geometry`() {
        assertEquals(scene.objects.size, all.size)
    }

    @Test
    fun `Roof off hides the roof, its openings and its rooflights, and nothing else`() {
        val visible = Visibility.visibleObjectIds(scene, VisibilityMode.ROOF_OFF)
        val hidden = all - visible
        assertTrue("something must be hidden", hidden.isNotEmpty())
        for (id in hidden) {
            assertTrue("$id is not roof geometry", scene.objectById(id)!!.kind in Visibility.ROOF_KINDS)
        }
        for (id in visible) {
            assertFalse("roof geometry $id is still visible", scene.objectById(id)!!.kind in Visibility.ROOF_KINDS)
        }
    }

    @Test
    fun `with the roof off the attic is inspectable`() {
        val visible = Visibility.visibleObjectIds(scene, VisibilityMode.ROOF_OFF)
        val upperLevels = scene.levels.filter { it.id != scene.groundLevelId }.map { it.id }.toSet()
        val atticObjects = visible.mapNotNull { scene.objectById(it) }.filter { it.levelId in upperLevels }
        assertTrue("hiding the roof must leave the attic visible", atticObjects.size > 3)
    }

    @Test
    fun `Ground shows only the lowest storey`() {
        val visible = Visibility.visibleObjectIds(scene, VisibilityMode.GROUND_ONLY)
        assertTrue(visible.isNotEmpty())
        for (id in visible) assertEquals(scene.groundLevelId, scene.objectById(id)!!.levelId)
    }

    @Test
    fun `Attic shows only storeys above the lowest, with the roof off`() {
        val visible = Visibility.visibleObjectIds(scene, VisibilityMode.UPPER_ONLY)
        assertTrue(visible.isNotEmpty())
        for (id in visible) {
            val o = scene.objectById(id)!!
            assertTrue("$id has no storey", o.levelId != null)
            assertTrue("$id is on the ground storey", o.levelId != scene.groundLevelId)
            assertFalse("$id is roof geometry", o.kind in Visibility.ROOF_KINDS)
        }
    }

    @Test
    fun `Cutaway removes the roof and everything above the lowest storey`() {
        val visible = Visibility.visibleObjectIds(scene, VisibilityMode.CUTAWAY)
        assertTrue(visible.isNotEmpty())
        for (id in visible) {
            val o = scene.objectById(id)!!
            assertFalse("$id is roof geometry", o.kind in Visibility.ROOF_KINDS)
            assertTrue("$id is above the ground storey", o.levelId == null || o.levelId == scene.groundLevelId)
        }
        // A cutaway shows the ground storey — less its roofs, which it is
        // defined to remove — and, unlike Ground, also keeps geometry that
        // belongs to no storey at all.
        val ground = Visibility.visibleObjectIds(scene, VisibilityMode.GROUND_ONLY)
        val groundWithoutRoof = ground.filter { scene.objectById(it)!!.kind !in Visibility.ROOF_KINDS }.toSet()
        assertTrue("a cutaway must keep the whole ground storey below its roof", visible.containsAll(groundWithoutRoof))
        assertTrue("a cutaway is a section, so it removes roof geometry the ground filter kept", ground.size > groundWithoutRoof.size)
    }

    @Test
    fun `isolate shows exactly one object, whatever the mode says`() {
        val target = scene.objects.first { it.kind == "roof" }.id
        for (mode in VisibilityMode.entries) {
            assertEquals(setOf(target), Visibility.visibleObjectIds(scene, mode, isolated = target))
        }
    }

    @Test
    fun `isolating something that is not in the scene is ignored`() {
        assertEquals(all, Visibility.visibleObjectIds(scene, VisibilityMode.ALL, isolated = "no-such-object"))
    }

    @Test
    fun `every filter is reversible - nothing is destroyed by hiding it`() {
        for (mode in VisibilityMode.entries) {
            Visibility.visibleObjectIds(scene, mode)
            assertEquals(
                "after $mode the model must be able to show everything again",
                all,
                Visibility.visibleObjectIds(scene, VisibilityMode.ALL),
            )
        }
        assertEquals("the scene itself must be untouched", scene.objects.size, all.size)
    }

    @Test
    fun `the demo model filters too, with its own storeys`() {
        val demo = TestScenes.demo
        val demoAll = Visibility.visibleObjectIds(demo, VisibilityMode.ALL)
        val roofOff = Visibility.visibleObjectIds(demo, VisibilityMode.ROOF_OFF)
        assertTrue(roofOff.size < demoAll.size)
    }
}
