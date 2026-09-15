package com.buildplan.preview

import com.buildplan.preview.camera.OrbitCamera
import com.buildplan.preview.camera.PresetTarget
import com.buildplan.preview.camera.Projection
import com.buildplan.preview.camera.ViewPreset
import com.buildplan.preview.scene.GeometryPart
import com.buildplan.preview.scene.VisibilityMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The presets, and the generic rules that find what they aim at.
 *
 * "The stairs" and "the entrance" are resolved from the scene's own structure,
 * never from an id belonging to a particular building — otherwise the viewer
 * would only work for one house.
 */
class ViewPresetTest {

    private val scene = TestScenes.marcowki
    private val camera = OrbitCamera(scene.bounds)

    @Test
    fun `every preset this model can satisfy produces a usable pose`() {
        val available = ViewPreset.availableIn(scene)
        assertTrue("all the core presets should be available", available.size >= 10)
        for (preset in available) {
            val pose = preset.poseIn(camera, scene, camera.home())
            assertNotNull("${preset.label} produced no pose", pose)
            pose!!
            assertTrue(pose.distance in camera.minDistance..camera.maxDistance)
            assertTrue(pose.pitchDeg in OrbitCamera.MIN_PITCH..OrbitCamera.MAX_PITCH)
            assertTrue(pose.focus.isFinite())
        }
    }

    @Test
    fun `elevations and plans are truly orthographic`() {
        for (preset in listOf(ViewPreset.FRONT, ViewPreset.REAR, ViewPreset.LEFT, ViewPreset.RIGHT, ViewPreset.TOP, ViewPreset.GROUND_PLAN, ViewPreset.ATTIC_PLAN, ViewPreset.AXONOMETRIC)) {
            assertEquals("${preset.label} must not be a perspective view", Projection.ORTHOGRAPHIC, preset.projection)
        }
        assertEquals(Projection.PERSPECTIVE, ViewPreset.WHOLE.projection)
    }

    @Test
    fun `the elevations look at the four sides, level`() {
        assertEquals(0.0, ViewPreset.FRONT.yawDeg, 0.0)
        assertEquals(180.0, ViewPreset.REAR.yawDeg, 0.0)
        assertEquals(90.0, ViewPreset.RIGHT.yawDeg, 0.0)
        assertEquals(270.0, ViewPreset.LEFT.yawDeg, 0.0)
        for (p in listOf(ViewPreset.FRONT, ViewPreset.REAR, ViewPreset.LEFT, ViewPreset.RIGHT)) {
            assertEquals("${p.label} must be level", 0.0, p.pitchDeg, 0.0)
        }
    }

    @Test
    fun `the front elevation really looks at the front facade`() {
        val pose = ViewPreset.FRONT.poseIn(camera, scene, camera.home())!!
        val eye = camera.eye(pose)
        assertTrue("the front camera must stand on the front side", eye.z > pose.target.z)
        assertEquals("and square on to it", pose.target.x, eye.x, 1e-6)
    }

    @Test
    fun `the plans carry the visibility they need to mean anything`() {
        assertEquals(VisibilityMode.GROUND_ONLY, ViewPreset.GROUND_PLAN.visibility)
        assertEquals(VisibilityMode.UPPER_ONLY, ViewPreset.ATTIC_PLAN.visibility)
        assertEquals("framing the stairs is useless under a roof", VisibilityMode.ROOF_OFF, ViewPreset.STAIRS.visibility)
        assertEquals("a plain view must not silently change what is shown", null, ViewPreset.FRONT.visibility)
        assertEquals(null, ViewPreset.WHOLE.visibility)
    }

    @Test
    fun `the stairs preset finds the real staircase`() {
        val id = scene.stairObjectId
        assertNotNull(id)
        val stair = scene.objectById(id)!!
        assertEquals("stair", stair.kind)
        assertTrue("a real staircase, not a placeholder footprint", stair.parts.any { it.part == GeometryPart.STAIR_STEP })
        assertEquals(id, ViewPreset.STAIRS.objectIdIn(scene))
        val pose = ViewPreset.STAIRS.poseIn(camera, scene, camera.home())!!
        assertTrue("the stairs must be framed closer than the house", pose.distance < camera.home().distance)
    }

    @Test
    fun `the entrance preset finds a walk-through door on the front facade`() {
        val id = scene.entranceObjectId
        assertNotNull(id)
        val door = scene.objectById(id)!!
        assertEquals("door", door.kind)
        assertTrue("an entrance has a leaf you walk through", door.parts.any { it.part == GeometryPart.DOOR_LEAF })
        assertEquals("the entrance is on the lowest storey", scene.groundLevelId, door.levelId)

        // It must be the front-most such door: in the render frame the front
        // facade is the largest z.
        val candidates = scene.objects.filter { o ->
            o.kind == "door" && o.parts.any { it.part == GeometryPart.DOOR_LEAF } && o.levelId == scene.groundLevelId
        }
        assertTrue(candidates.size > 1)
        assertEquals(candidates.maxByOrNull { it.bounds.center.z }!!.id, id)

        // A sectional garage panel is not a walk-through door and must not win.
        val garagePanels = scene.objects.filter { o -> o.kind == "door" && o.parts.none { it.part == GeometryPart.DOOR_LEAF } }
        assertTrue("the reference model has a panelled garage door to distinguish", garagePanels.isNotEmpty())
        assertTrue(garagePanels.none { it.id == id })
    }

    @Test
    fun `a preset with nothing to aim at is not offered`() {
        val demo = TestScenes.demo
        for (preset in ViewPreset.entries) {
            val available = preset.isAvailableIn(demo)
            val bounds = preset.boundsIn(demo)
            if (preset.target != PresetTarget.WHOLE_MODEL && bounds == null) {
                assertTrue("${preset.label} aims at nothing in the demo but is offered", !available)
            }
        }
        // Whole-model presets are always available where there is a model.
        assertTrue(ViewPreset.WHOLE.isAvailableIn(demo))
        assertTrue(ViewPreset.FRONT.isAvailableIn(demo))
    }

    @Test
    fun `presets go through the same framing as manual navigation`() {
        // A preset's distance is what `frame` would produce for the same
        // bounds: there is no separate camera path to drift apart from.
        val pose = ViewPreset.WHOLE.poseIn(camera, scene, camera.home())!!
        val framed = camera.frame(camera.home(), scene.bounds, ViewPreset.WHOLE.yawDeg, ViewPreset.WHOLE.pitchDeg, Projection.PERSPECTIVE, ViewPreset.WHOLE.margin)
        assertEquals(framed.distance, pose.distance, 1e-9)
        assertEquals(framed.focus, pose.focus)
    }
}
