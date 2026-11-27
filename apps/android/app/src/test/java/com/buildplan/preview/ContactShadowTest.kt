package com.buildplan.preview

import com.buildplan.preview.presentation.ContactShadow
import com.buildplan.preview.presentation.ContactShadow.PlanPoint
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.hypot

/** Round D: the contact shadow under the house — a presentation shape built from the scene's own boxes, nothing else. */
class ContactShadowTest {

    @Test
    fun `the hull is convex, counter-clockwise and holds every point`() {
        val pts = listOf(PlanPoint(0.0, 0.0), PlanPoint(4.0, 0.0), PlanPoint(4.0, 3.0), PlanPoint(0.0, 3.0), PlanPoint(2.0, 1.0), PlanPoint(1.0, 0.0))
        val hull = ContactShadow.hull(pts)
        assertEquals(4, hull.size)
        assertTrue(isConvexCcw(hull))
        for (p in pts) assertTrue("$p inside", inside(hull, p, 1e-9))
    }

    @Test
    fun `each outline holds the one before it, and the last reaches exactly the reach`() {
        val hull = ContactShadow.hull(listOf(PlanPoint(0.0, 0.0), PlanPoint(10.0, 0.0), PlanPoint(10.0, 6.0), PlanPoint(0.0, 6.0)))
        var previous = hull
        for (k in 1 until ContactShadow.RINGS) {
            val ring = ContactShadow.offset(hull, ContactShadow.reach(k))
            assertTrue(isConvexCcw(ring))
            for (p in previous) assertTrue("ring $k holds ring ${k - 1}", inside(ring, p, 1e-6))
            previous = ring
        }
        val outer = ContactShadow.offset(hull, ContactShadow.REACH_M)
        // Every outer point is exactly the reach away from the hull: rounded corners, straight sides.
        for (p in outer) assertEquals(ContactShadow.REACH_M, distanceToRectangle(p, 0.0, 10.0, 0.0, 6.0), 1e-9)
        assertEquals(0.0, ContactShadow.reach(0), 0.0)
        assertEquals(ContactShadow.REACH_M, ContactShadow.reach(ContactShadow.RINGS - 1), 1e-12)
    }

    @Test
    fun `the Marcowki shadow lies just under the grid, faces up, and stays within reach of the house`() {
        for (scene in listOf(TestScenes.marcowki, TestScenes.scene("marcowki-c-v35414"), TestScenes.demo)) {
            val shape = ContactShadow.of(scene)
            assertNotNull(shape)
            shape!!
            assertEquals(scene.bounds.min.y - 0.015, shape.y, 1e-9)
            val positions = shape.positions()
            val indices = shape.indices()
            assertEquals(0, indices.size % 3)
            for (t in indices.indices step 3) {
                val (a, b, c) = Triple(indices[t], indices[t + 1], indices[t + 2])
                fun x(i: Int) = positions[i * 3].toDouble()
                fun z(i: Int) = positions[i * 3 + 2].toDouble()
                // Normal's y = (b - a) × (c - a), its y component: positive faces up.
                val ny = (z(b) - z(a)) * (x(c) - x(a)) - (x(b) - x(a)) * (z(c) - z(a))
                assertTrue("${scene.key}: triangle $t faces up ($ny)", ny >= -1e-9)
            }
            val b = shape.bounds
            assertTrue(b.min.x >= scene.bounds.min.x - ContactShadow.REACH_M - 1e-6 && b.max.x <= scene.bounds.max.x + ContactShadow.REACH_M + 1e-6)
            assertTrue(b.min.z >= scene.bounds.min.z - ContactShadow.REACH_M - 1e-6 && b.max.z <= scene.bounds.max.z + ContactShadow.REACH_M + 1e-6)
        }
    }

    @Test
    fun `the shadow is drawn only while what is shown stands over the footprint`() {
        val scene = TestScenes.marcowki
        val shape = ContactShadow.of(scene)!!
        assertTrue("everything shown", shape.covers(scene.objects.map { it.id }.toSet()))
        assertTrue("nothing shown", !shape.covers(emptySet()))
        // One small standing object alone is not the house's footprint.
        val smallest = shape.footprints.minByOrNull { (_, b) -> (b[2] - b[0]) * (b[3] - b[1]) }!!.key
        assertTrue("an isolated small element", !shape.covers(setOf(smallest)))
    }

    private fun isConvexCcw(ring: List<PlanPoint>): Boolean {
        val n = ring.size
        for (i in 0 until n) {
            val o = ring[i]; val a = ring[(i + 1) % n]; val b = ring[(i + 2) % n]
            val cross = (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x)
            if (cross < -1e-9) return false
        }
        return true
    }

    private fun inside(ring: List<PlanPoint>, p: PlanPoint, eps: Double): Boolean {
        val n = ring.size
        for (i in 0 until n) {
            val o = ring[i]; val a = ring[(i + 1) % n]
            if (hypot(a.x - o.x, a.z - o.z) < 1e-12) continue
            val cross = (a.x - o.x) * (p.z - o.z) - (a.z - o.z) * (p.x - o.x)
            if (cross < -eps) return false
        }
        return true
    }

    private fun distanceToRectangle(p: PlanPoint, x0: Double, x1: Double, z0: Double, z1: Double): Double {
        val dx = maxOf(x0 - p.x, 0.0, p.x - x1)
        val dz = maxOf(z0 - p.z, 0.0, p.z - z1)
        return hypot(dx, dz)
    }
}
