package com.buildplan.preview

import com.buildplan.preview.camera.OrbitInertia
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs

/** Round D: the glide after a flick — when it starts, how far it goes, and that frame timing does not change it. */
class OrbitInertiaTest {

    @Test
    fun `only a real flick glides, a wild one is capped, and pitch glides less`() {
        assertNull(OrbitInertia.start(20.0, 0.0))
        val (yaw, pitch) = OrbitInertia.start(150.0, 100.0)!!
        assertEquals(150.0, yaw, 1e-12)
        assertEquals(100.0 * OrbitInertia.PITCH_SHARE, pitch, 1e-12)
        val (fast, _) = OrbitInertia.start(5_000.0, 0.0)!!
        assertEquals(OrbitInertia.MAX_START, fast, 1e-9)
        assertNull(OrbitInertia.start(Double.NaN, 0.0))
    }

    @Test
    fun `the glide covers the same turn whatever the frame rate, and stops within a quarter turn`() {
        fun run(stepMs: Double): Double {
            var v = OrbitInertia.MAX_START
            var turned = 0.0
            while (!OrbitInertia.stopped(v, 0.0)) {
                turned += OrbitInertia.travel(v, stepMs)
                v = OrbitInertia.decay(v, stepMs)
            }
            return turned
        }
        val at60 = run(16.0)
        val at120 = run(8.0)
        val choppy = run(48.0)
        assertTrue("same reach at any frame rate: $at60 $at120 $choppy", abs(at60 - at120) < 0.5 && abs(at60 - choppy) < 1.5)
        assertTrue("never more than the whole reach: $at60", at60 <= OrbitInertia.reach(OrbitInertia.MAX_START) + 1e-9)
        assertTrue("a quarter turn at most: $at60", at60 < 90.0)
    }
}
