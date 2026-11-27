package com.buildplan.preview

import com.buildplan.preview.camera.ContentFrame
import com.buildplan.preview.camera.ContentInsets
import com.buildplan.preview.camera.OrbitCamera
import com.buildplan.preview.camera.Projection
import com.buildplan.preview.camera.Turntable
import com.buildplan.preview.math.Vec3
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs
import kotlin.math.tan

/** Round D: the idle turntable — when it starts, how it starts, and that the whole house stays in view all the way round. */
class TurntableTest {

    @Test
    fun `nothing turns until the house has been left alone long enough`() {
        assertEquals(0.0, Turntable.yawStep(0, 16), 0.0)
        assertEquals(0.0, Turntable.yawStep(Turntable.IDLE_BEFORE_MS - 1, 16), 0.0)
        assertEquals("the very first idle frame still does not jerk", 0.0, Turntable.yawStep(Turntable.IDLE_BEFORE_MS, 16), 1e-12)
    }

    @Test
    fun `it eases in, then turns at its speed, and a long frame never jumps`() {
        var last = 0.0
        for (t in Turntable.IDLE_BEFORE_MS..(Turntable.IDLE_BEFORE_MS + Turntable.RAMP_MS) step 100) {
            val step = Turntable.yawStep(t, 16)
            assertTrue("monotonic ramp at $t", step >= last - 1e-12)
            last = step
        }
        val cruising = Turntable.yawStep(Turntable.IDLE_BEFORE_MS + Turntable.RAMP_MS + 1_000, 1_000)
        assertEquals("a paused second turns no further than one capped frame", Turntable.DEGREES_PER_SECOND * Turntable.MAX_FRAME_MS / 1000.0, cruising, 1e-9)
        assertEquals(Turntable.DEGREES_PER_SECOND * 16 / 1000.0, Turntable.yawStep(Turntable.IDLE_BEFORE_MS + Turntable.RAMP_MS, 16), 1e-9)
    }

    @Test
    fun `after its longest run it eases out and holds still`() {
        val cruise = Turntable.yawStep(Turntable.IDLE_BEFORE_MS + Turntable.MAX_TURN_MS, 16)
        assertEquals(Turntable.DEGREES_PER_SECOND * 16 / 1000.0, cruise, 1e-9)
        var last = cruise
        for (t in 0..Turntable.RAMP_MS step 100) {
            val step = Turntable.yawStep(Turntable.IDLE_BEFORE_MS + Turntable.MAX_TURN_MS + t, 16)
            assertTrue("monotonic stop at +$t", step <= last + 1e-12)
            last = step
        }
        val end = Turntable.IDLE_BEFORE_MS + Turntable.MAX_TURN_MS + Turntable.RAMP_MS
        assertEquals(0.0, Turntable.yawStep(end, 16), 0.0)
        assertTrue(Turntable.finished(end))
        assertTrue(!Turntable.finished(end - 1))
    }

    @Test
    fun `the whole house stays inside the free span at every angle of the turn`() {
        val span = ContentFrame.fitSpan(720, 1600, ContentInsets(top = 250, right = 0, bottom = 220))
        for (scene in listOf(TestScenes.scene("marcowki-c-v35414"), TestScenes.marcowki, TestScenes.demo)) {
            val hull = scene.objects.filter { it.hasGeometry && !it.bounds.isEmpty }.flatMap { it.bounds.corners() }
            val camera = OrbitCamera(scene.bounds, hull = hull)
            val pose = Turntable.pose(camera, hull, camera.home(span), span)
            assertEquals(Projection.PERSPECTIVE, pose.projection)
            val pivot = Turntable.pivot(hull, scene.bounds)
            assertEquals(pivot, pose.focus)
            // The pivot is the centre of the smallest circle round the house in plan: no point is farther from it
            // than from the box's centre — the house swings round it least.
            val reach = { c: Vec3 -> hull.maxOf { kotlin.math.hypot(it.x - c.x, it.z - c.z) } }
            assertTrue("${scene.key}: ${reach(pivot)} <= ${reach(scene.bounds.center)}", reach(pivot) <= reach(scene.bounds.center) + 1e-9)
            // Check finer than the fit's own sampling: the margin covers the angles between samples.
            for (i in 0 until 360) {
                val turned = pose.copy(yawDeg = pose.yawDeg + i)
                val worst = worstShare(camera, turned, hull, span)
                assertTrue("${scene.key} at +$i°: a point at ${"%.3f".format(worst)} of the free half-field", worst <= 1.0)
            }
        }
    }

    /** How far out the points reach, as a share of the free half-field (1.0 = its edge). */
    private fun worstShare(camera: OrbitCamera, pose: com.buildplan.preview.camera.OrbitPose, points: List<Vec3>, span: OrbitCamera.FitSpan): Double {
        val tanHalf = tan(Math.toRadians(camera.fovDeg) / 2.0)
        val b = camera.basis(pose)
        val eye = camera.eye(pose)
        return points.maxOf { p ->
            val q = p - eye
            val depth = q dot b.forward
            maxOf(abs(q dot b.right) / depth / (tanHalf * span.horizontal), abs(q dot b.up) / depth / (tanHalf * span.vertical))
        }
    }
}
