package com.buildplan.preview

import com.buildplan.preview.math.Vec3
import com.buildplan.preview.scene.BundleBounds
import com.buildplan.preview.scene.BundleVec3
import com.buildplan.preview.scene.ModelFrame
import com.buildplan.preview.scene.TangentFrames
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs

/** The coordinate conversion itself, on values chosen to expose a sign error. */
class ModelFrameTest {

    @Test
    fun `x and y survive, z is mirrored`() {
        val p = ModelFrame.point(3.0, 5.0, 7.0)
        assertEquals(3.0, p.x, 0.0)
        assertEquals(5.0, p.y, 0.0)
        assertEquals(-7.0, p.z, 0.0)
    }

    @Test
    fun `mirroring z exchanges the z bounds rather than mapping them componentwise`() {
        val b = ModelFrame.bounds(BundleBounds(BundleVec3(-1.0, 0.0, 2.0), BundleVec3(4.0, 6.0, 9.0)))
        assertEquals(-1.0, b.min.x, 0.0)
        assertEquals(4.0, b.max.x, 0.0)
        assertEquals(0.0, b.min.y, 0.0)
        assertEquals(6.0, b.max.y, 0.0)
        // model z 2..9 becomes render z -9..-2; a componentwise map would have
        // produced an inside-out box.
        assertEquals(-9.0, b.min.z, 0.0)
        assertEquals(-2.0, b.max.z, 0.0)
        assertTrue(!b.isEmpty)
    }

    @Test
    fun `absent bounds are empty, not a box at the origin`() {
        assertTrue(ModelFrame.bounds(null).isEmpty)
    }

    @Test
    fun `triangle vertices are re-wound a, c, b`() {
        // One triangle: a=(0,0,0) b=(1,0,0) c=(0,0,1) in model coordinates.
        val model = doubleArrayOf(0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0)
        val render = ModelFrame.renderPositions(model)
        assertEquals(9, render.size)
        // first vertex unchanged, then the compiled c (z mirrored), then the compiled b
        val expected = floatArrayOf(0f, 0f, 0f, 0f, 0f, -1f, 1f, 0f, 0f)
        for (i in expected.indices) assertEquals("coordinate $i", expected[i], render[i], 1e-9f)
    }

    @Test
    fun `the re-wind keeps a face pointing the same way it did in the model`() {
        // A triangle in the y=0 plane whose model normal points up (+y).
        val model = doubleArrayOf(
            0.0, 0.0, 0.0,
            0.0, 0.0, 1.0,
            1.0, 0.0, 0.0,
        )
        val render = ModelFrame.renderPositions(model)
        val n = ModelFrame.triangleNormal(render, 0)
        assertTrue("an upward face must stay upward through the conversion", n.y > 0.99)
    }

    @Test
    fun `mirroring alone without the re-wind would invert the face`() {
        // Same triangle, mirrored but NOT re-wound: the normal flips. This is
        // the bug the vertex swap exists to prevent.
        val mirroredOnly = floatArrayOf(0f, 0f, 0f, 0f, 0f, -1f, 1f, 0f, 0f)
        val wrong = ModelFrame.triangleNormal(mirroredOnly, 0)
        val right = ModelFrame.triangleNormal(ModelFrame.renderPositions(doubleArrayOf(0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.0, 0.0)), 0)
        assertTrue(wrong.y < -0.99)
        assertTrue(right.y > 0.99)
    }

    @Test
    fun `a degenerate triangle yields a usable normal instead of NaN`() {
        val n = ModelFrame.triangleNormal(floatArrayOf(1f, 1f, 1f, 1f, 1f, 1f, 1f, 1f, 1f), 0)
        assertTrue(n.isFinite())
        assertEquals(1.0, n.length, 1e-9)
    }

    @Test
    fun `the signed volume of a unit cube is positive when wound outward`() {
        assertTrue(ModelFrame.signedVolume6(outwardCube()) > 0.0)
    }

    @Test
    fun `a tangent frame rotates plus Z onto the normal it was built from`() {
        val normals = listOf(
            Vec3(0.0, 1.0, 0.0), Vec3(0.0, -1.0, 0.0),
            Vec3(1.0, 0.0, 0.0), Vec3(-1.0, 0.0, 0.0),
            Vec3(0.0, 0.0, 1.0), Vec3(0.0, 0.0, -1.0),
            Vec3(0.4, 0.8, -0.45).normalized(), Vec3(-0.7, 0.1, 0.7).normalized(),
        )
        for (n in normals) {
            val q = TangentFrames.fromNormal(n)
            val rotated = TangentFrames.rotate(q, Vec3(0.0, 0.0, 1.0))
            assertEquals("x for $n", n.x, rotated.x, 1e-5)
            assertEquals("y for $n", n.y, rotated.y, 1e-5)
            assertEquals("z for $n", n.z, rotated.z, 1e-5)
            val len = kotlin.math.sqrt((q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3]).toDouble())
            assertEquals("quaternion must be unit for $n", 1.0, len, 1e-5)
            assertTrue("Filament reads a negative w as a mirrored frame", q[3] >= 0f)
        }
    }

    @Test
    fun `every triangle of the real model gets a finite tangent frame`() {
        for (obj in TestScenes.marcowki.objects) {
            for (v in obj.tangents) assertTrue("non-finite tangent in ${obj.id}", v.isFinite())
            assertEquals("one quaternion per vertex in ${obj.id}", obj.vertexCount * 4, obj.tangents.size)
            assertEquals("three coordinates per vertex in ${obj.id}", obj.vertexCount * 3, obj.positions.size)
        }
    }

    private fun outwardCube(): FloatArray {
        val c = listOf(
            Vec3(0.0, 0.0, 0.0), Vec3(1.0, 0.0, 0.0), Vec3(1.0, 1.0, 0.0), Vec3(0.0, 1.0, 0.0),
            Vec3(0.0, 0.0, 1.0), Vec3(1.0, 0.0, 1.0), Vec3(1.0, 1.0, 1.0), Vec3(0.0, 1.0, 1.0),
        )
        val faces = listOf(
            intArrayOf(4, 5, 6), intArrayOf(4, 6, 7), // +z
            intArrayOf(1, 0, 3), intArrayOf(1, 3, 2), // -z
            intArrayOf(5, 1, 2), intArrayOf(5, 2, 6), // +x
            intArrayOf(0, 4, 7), intArrayOf(0, 7, 3), // -x
            intArrayOf(3, 7, 6), intArrayOf(3, 6, 2), // +y
            intArrayOf(0, 1, 5), intArrayOf(0, 5, 4), // -y
        )
        val out = FloatArray(faces.size * 9)
        var i = 0
        for (f in faces) for (idx in f) {
            out[i++] = c[idx].x.toFloat(); out[i++] = c[idx].y.toFloat(); out[i++] = c[idx].z.toFloat()
        }
        return out
    }
}
