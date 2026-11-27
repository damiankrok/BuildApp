package com.buildplan.preview

import com.buildplan.preview.camera.OrbitCamera
import com.buildplan.preview.camera.OrbitPose
import com.buildplan.preview.camera.Projection
import com.buildplan.preview.math.Bounds
import com.buildplan.preview.math.Vec3
import org.junit.Assert.assertEquals
import org.junit.Test

/** Round D: a pinch zooms toward the fingers — the point of the focus plane under them stays under them. */
class PinchZoomTest {

    private val camera = OrbitCamera(Bounds(Vec3(-6.0, 0.0, -5.0), Vec3(6.0, 8.0, 5.0)))

    private fun underFingers(pose: OrbitPose, ox: Double, oy: Double, scale: Double, height: Int): Vec3 {
        val wpp = camera.worldPerPixel(pose, height)
        val b = camera.basis(pose)
        return pose.target + b.right * (ox * wpp / scale) + b.up * (-oy * wpp / scale)
    }

    @Test
    fun `the point under the fingers stays under them, in both projections and with the chrome's frame`() {
        for (projection in Projection.entries) {
            for (scale in listOf(1.0, 0.8)) {
                val pose = OrbitPose(Vec3(0.0, 3.0, 0.0), Vec3.ZERO, 35.0, 25.0, 30.0, projection)
                for ((ox, oy) in listOf(200.0 to -150.0, -320.0 to 410.0, 0.0 to 0.0)) {
                    for (factor in listOf(0.8, 1.25)) {
                        val before = underFingers(pose, ox, oy, scale, 1600)
                        val after = camera.zoomAt(pose, factor, ox, oy, scale, 1600)
                        val now = underFingers(after, ox, oy, scale, 1600)
                        assertEquals("$projection x", before.x, now.x, 1e-6)
                        assertEquals("$projection y", before.y, now.y, 1e-6)
                        assertEquals("$projection z", before.z, now.z, 1e-6)
                    }
                }
            }
        }
    }

    @Test
    fun `at the distance limit a pinch does not slide the house`() {
        val pose = OrbitPose(Vec3(0.0, 3.0, 0.0), Vec3.ZERO, 35.0, 25.0, camera.minDistance, Projection.PERSPECTIVE)
        val after = camera.zoomAt(pose, 0.5, 300.0, 200.0, 1.0, 1600)
        assertEquals(pose.pan, after.pan)
        assertEquals(pose.distance, after.distance, 1e-12)
    }
}
