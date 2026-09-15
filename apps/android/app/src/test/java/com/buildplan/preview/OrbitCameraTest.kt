package com.buildplan.preview

import com.buildplan.preview.camera.OrbitCamera
import com.buildplan.preview.camera.OrbitPose
import com.buildplan.preview.camera.PoseAnimation
import com.buildplan.preview.camera.Projection
import com.buildplan.preview.math.Bounds
import com.buildplan.preview.math.Vec3
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs

/** The interaction model: clamps, gesture arithmetic, framing and reset. */
class OrbitCameraTest {

    private val scene = TestScenes.marcowki
    private val camera = OrbitCamera(scene.bounds)
    private val home = camera.home()

    @Test
    fun `home frames the whole model`() {
        assertEquals(scene.bounds.center.x, home.focus.x, 1e-6)
        assertEquals(scene.bounds.center.y, home.focus.y, 1e-6)
        assertEquals(scene.bounds.center.z, home.focus.z, 1e-6)
        assertEquals(Vec3.ZERO, home.pan)
        assertEquals(Projection.PERSPECTIVE, home.projection)
        assertTrue("the whole house must fit", home.distance >= scene.bounds.radius)
    }

    @Test
    fun `pitch is clamped so the house never turns over`() {
        val up = camera.orbit(home, 0.0, 10_000.0)
        assertEquals(OrbitCamera.MAX_PITCH, up.pitchDeg, 1e-9)
        val down = camera.orbit(home, 0.0, -10_000.0)
        assertEquals(OrbitCamera.MIN_PITCH, down.pitchDeg, 1e-9)
        assertTrue("a plan view must still be reachable", OrbitCamera.MAX_PITCH >= 89.0)
        assertTrue("but never straight over the top", OrbitCamera.MAX_PITCH < 90.0)
    }

    @Test
    fun `yaw wraps instead of drifting`() {
        var pose = home
        repeat(8) { pose = camera.orbit(pose, 100.0, 0.0) }
        assertTrue(pose.yawDeg >= 0.0 && pose.yawDeg < 360.0)
        // Two full turns land back where they started.
        val once = camera.orbit(home, 360.0, 0.0)
        assertEquals(home.yawDeg, once.yawDeg, 1e-9)
    }

    @Test
    fun `zoom is clamped out of the walls and short of the horizon`() {
        var close = home
        repeat(40) { close = camera.zoom(close, 0.5) }
        assertEquals(camera.minDistance, close.distance, 1e-9)
        assertTrue("the camera must not end up inside the model", camera.minDistance > 0.0)

        var far = home
        repeat(40) { far = camera.zoom(far, 2.0) }
        assertEquals(camera.maxDistance, far.distance, 1e-9)
    }

    @Test
    fun `zoom moves the eye without moving the target`() {
        val zoomed = camera.zoom(home, 0.5)
        assertEquals(home.target.x, zoomed.target.x, 1e-9)
        assertEquals(home.target.y, zoomed.target.y, 1e-9)
        assertEquals(home.target.z, zoomed.target.z, 1e-9)
        assertTrue(camera.eye(zoomed).length != camera.eye(home).length)
    }

    @Test
    fun `pan moves the target across the view, and the model follows the fingers`() {
        val height = 1800
        val basis = camera.basis(home)

        val right = camera.pan(home, 100.0, 0.0, height)
        val movedRight = right.pan
        // Dragging right moves the target left, so the building appears to
        // move right with the finger.
        assertTrue("dragging right must not move the target right", (movedRight dot basis.right) < 0.0)

        val down = camera.pan(home, 0.0, 100.0, height)
        assertTrue("dragging down must lift the target", (down.pan dot basis.up) > 0.0)

        // Panning leaves the orbit alone.
        assertEquals(home.yawDeg, right.yawDeg, 1e-9)
        assertEquals(home.distance, right.distance, 1e-9)
        assertEquals(home.focus, right.focus)
    }

    @Test
    fun `pan is proportional to distance, so it feels the same at any zoom`() {
        val near = camera.zoom(home, 0.5)
        val a = camera.pan(home, 100.0, 0.0, 1800).pan.length
        val b = camera.pan(near, 100.0, 0.0, 1800).pan.length
        assertEquals("panning scales with the framed size", home.distance / near.distance, a / b, 1e-6)
    }

    @Test
    fun `pan on a zero-height viewport is ignored rather than dividing by zero`() {
        assertEquals(home.pan, camera.pan(home, 50.0, 50.0, 0).pan)
    }

    @Test
    fun `reset returns exactly to home from anywhere`() {
        var pose = camera.orbit(home, 137.0, -40.0)
        pose = camera.zoom(pose, 0.3)
        pose = camera.pan(pose, 400.0, -220.0, 1800)
        assertNotEquals(home, pose)
        assertEquals(home, camera.home())
    }

    @Test
    fun `framing an object centres it and drops the pan`() {
        val door = scene.objectById(scene.entranceObjectId)!!
        val wandered = camera.pan(home, 300.0, 120.0, 1800)
        val framed = camera.frame(wandered, door.bounds)
        assertEquals(door.bounds.center.x, framed.focus.x, 1e-6)
        assertEquals(door.bounds.center.y, framed.focus.y, 1e-6)
        assertEquals(Vec3.ZERO, framed.pan)
        assertTrue("a door must be framed closer than the whole house", framed.distance < home.distance)
        assertEquals("framing keeps the angles unless asked otherwise", wandered.yawDeg, framed.yawDeg, 1e-9)
    }

    @Test
    fun `framing a flat object does not slam the camera into it`() {
        val pane = Bounds(Vec3(0.0, 0.0, 0.0), Vec3(1.2, 1.4, 0.0))
        val framed = camera.frame(home, pane)
        assertTrue(framed.distance > camera.minDistance)
        assertTrue(framed.distance.isFinite())
    }

    @Test
    fun `framing empty bounds changes nothing`() {
        assertEquals(home, camera.frame(home, Bounds.EMPTY))
    }

    @Test
    fun `the eye sits where the angles say`() {
        val front = camera.clamp(home.copy(yawDeg = 0.0, pitchDeg = 0.0))
        val eye = camera.eye(front)
        // Yaw 0 looks at the front facade, which the conversion put at the
        // largest render z — so the camera stands in front of it.
        assertTrue(eye.z > front.target.z)
        assertEquals(front.target.x, eye.x, 1e-6)
        assertEquals(front.target.y, eye.y, 1e-6)

        val right = camera.clamp(home.copy(yawDeg = 90.0, pitchDeg = 0.0))
        assertTrue("yaw 90 must look from the +x side", camera.eye(right).x > right.target.x)

        val top = camera.clamp(home.copy(pitchDeg = 89.0))
        assertTrue("a plan view looks down from above", camera.eye(top).y > top.target.y)
    }

    @Test
    fun `the camera basis stays well defined looking straight down`() {
        val top = camera.clamp(home.copy(pitchDeg = OrbitCamera.MAX_PITCH))
        val basis = camera.basis(top)
        for (v in listOf(basis.right, basis.up, basis.forward)) {
            assertTrue(v.isFinite())
            assertEquals(1.0, v.length, 1e-6)
        }
        assertEquals(0.0, basis.right dot basis.up, 1e-6)
    }

    @Test
    fun `clip planes always contain the scene`() {
        for (pose in listOf(home, camera.zoom(home, 0.1), camera.zoom(home, 8.0))) {
            val (near, far) = camera.clipPlanes(camera.clamp(pose))
            assertTrue(near > 0.0)
            assertTrue(far > near)
            assertTrue("the far plane must reach past the model", far > pose.distance)
        }
    }

    @Test
    fun `the orthographic extent matches the perspective one at the same distance`() {
        val ortho = home.copy(projection = Projection.ORTHOGRAPHIC)
        val worldPerPixel = camera.worldPerPixel(ortho, 1000)
        assertEquals(
            "switching projection must not change how big the building looks",
            camera.orthoHalfHeight(ortho) * 2.0 / 1000,
            worldPerPixel,
            1e-9,
        )
        assertEquals(camera.worldPerPixel(home, 1000), worldPerPixel, 1e-9)
    }

    @Test
    fun `a transition eases from one pose to the other and is interruptible at any point`() {
        val target = camera.frame(home, scene.objectById(scene.stairObjectId!!)!!.bounds, 40.0, 18.0)
        assertEquals(home, PoseAnimation.lerp(home, target, 0.0))
        assertEquals(target, PoseAnimation.lerp(home, target, 1.0))
        // Halfway is genuinely between, so an interruption leaves a usable pose.
        val mid = PoseAnimation.lerp(home, target, 0.5)
        assertTrue(mid.distance > minOf(home.distance, target.distance) - 1e-9)
        assertTrue(mid.distance < maxOf(home.distance, target.distance) + 1e-9)
        assertTrue(mid.focus.isFinite())
    }

    @Test
    fun `a transition turns the short way round`() {
        assertEquals(20.0, PoseAnimation.shortestTurn(350.0, 10.0), 1e-9)
        assertEquals(-20.0, PoseAnimation.shortestTurn(10.0, 350.0), 1e-9)
        assertEquals(180.0, abs(PoseAnimation.shortestTurn(0.0, 180.0)), 1e-9)
        val from = home.copy(yawDeg = 350.0)
        val to = home.copy(yawDeg = 10.0)
        val mid = PoseAnimation.lerp(from, to, 0.5)
        assertTrue("the sweep must pass through 0, not through 180", mid.yawDeg > 355.0 || mid.yawDeg < 5.0)
    }
}
