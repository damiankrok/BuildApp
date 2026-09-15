package com.buildplan.preview.scene

import com.buildplan.preview.math.Bounds
import com.buildplan.preview.math.Vec3
import kotlin.math.abs
import kotlin.math.sqrt

/**
 * The ONE coordinate conversion in this application.
 *
 * The compiler's world frame is the CanonicalBuildingModel's frame:
 *
 *   x — right when looking at the front facade
 *   y — up
 *   z — away from the front facade, INTO the building
 *   metres, and triangles wound so that `(b - a) x (c - a)` points OUT of the
 *   material.
 *
 * Taken literally that triple is left-handed. Filament, like OpenGL, is
 * right-handed. The conversion is therefore exactly this and nothing else:
 *
 *   render.x = model.x
 *   render.y = model.y
 *   render.z = -model.z          (the front facade ends up at the largest z)
 *   vertices of each triangle are emitted a, c, b
 *
 * The vertex swap is not decoration: mirroring one axis reverses handedness,
 * so without it every outward face would become back-facing and culling would
 * turn the house inside out. Mirroring also swaps the meaning of the z bounds,
 * which is why `bounds` is not a componentwise map.
 *
 * Nothing else in the renderer may negate a coordinate. An architecture test
 * (`tests/architecture/android.test.ts`) fails the build if a sign flip
 * appears anywhere else, because scattered inversions are exactly how a viewer
 * silently starts mirroring a building.
 */
object ModelFrame {
    /** The single axis inversion. */
    const val Z_SIGN = -1.0

    fun z(modelZ: Double): Double = Z_SIGN * modelZ

    fun point(x: Double, y: Double, z: Double): Vec3 = Vec3(x, y, Z_SIGN * z)

    fun point(v: BundleVec3): Vec3 = point(v.x, v.y, v.z)

    /**
     * Model bounds in the render frame. Mirroring z exchanges the minimum and
     * the maximum on that axis, so this cannot be done componentwise.
     */
    fun bounds(b: BundleBounds?): Bounds = if (b == null) {
        Bounds.EMPTY
    } else {
        Bounds(
            Vec3(b.min.x, b.min.y, Z_SIGN * b.max.z),
            Vec3(b.max.x, b.max.y, Z_SIGN * b.min.z),
        )
    }

    /**
     * Vertex order inside one converted triangle: a, c, b.
     *
     * Index i of the converted triangle takes vertex `TRIANGLE_VERTEX_ORDER[i]`
     * of the compiled triangle.
     */
    val TRIANGLE_VERTEX_ORDER = intArrayOf(0, 2, 1)

    /**
     * Convert a mesh's flat `positions` into GPU vertex positions.
     *
     * Returns 9 floats per triangle, already mirrored and re-wound. Float is
     * the GPU's precision and the last step before upload; every calculation
     * before this one stays in double.
     */
    fun renderPositions(positions: DoubleArray): FloatArray {
        val out = FloatArray(positions.size)
        var o = 0
        var t = 0
        while (t + 8 < positions.size) {
            for (v in TRIANGLE_VERTEX_ORDER) {
                val base = t + v * 3
                out[o++] = positions[base].toFloat()
                out[o++] = positions[base + 1].toFloat()
                out[o++] = (Z_SIGN * positions[base + 2]).toFloat()
            }
            t += 9
        }
        return out
    }

    /**
     * The outward normal of one converted triangle, in the render frame.
     *
     * Read straight off the converted vertices: `(b - a) x (c - a)`. Because
     * the conversion preserves outward orientation, this points out of the
     * material, which is what makes back-face culling correct.
     */
    fun triangleNormal(renderPositions: FloatArray, triangleIndex: Int): Vec3 {
        val i = triangleIndex * 9
        val ax = renderPositions[i].toDouble(); val ay = renderPositions[i + 1].toDouble(); val az = renderPositions[i + 2].toDouble()
        val bx = renderPositions[i + 3].toDouble(); val by = renderPositions[i + 4].toDouble(); val bz = renderPositions[i + 5].toDouble()
        val cx = renderPositions[i + 6].toDouble(); val cy = renderPositions[i + 7].toDouble(); val cz = renderPositions[i + 8].toDouble()
        val ux = bx - ax; val uy = by - ay; val uz = bz - az
        val vx = cx - ax; val vy = cy - ay; val vz = cz - az
        val nx = uy * vz - uz * vy
        val ny = uz * vx - ux * vz
        val nz = ux * vy - uy * vx
        val len = sqrt(nx * nx + ny * ny + nz * nz)
        // A degenerate sliver has no direction of its own; point it up rather
        // than emitting a NaN normal that would blacken the whole primitive.
        return if (len > 1e-12) Vec3(nx / len, ny / len, nz / len) else Vec3.UP
    }

    /**
     * Six times the signed volume of a closed triangle set in the render
     * frame. Positive means the surface is wound outward — the property
     * back-face culling depends on. Used by tests as a winding oracle.
     */
    fun signedVolume6(renderPositions: FloatArray): Double {
        var sum = 0.0
        var i = 0
        while (i + 8 < renderPositions.size) {
            val ax = renderPositions[i].toDouble(); val ay = renderPositions[i + 1].toDouble(); val az = renderPositions[i + 2].toDouble()
            val bx = renderPositions[i + 3].toDouble(); val by = renderPositions[i + 4].toDouble(); val bz = renderPositions[i + 5].toDouble()
            val cx = renderPositions[i + 6].toDouble(); val cy = renderPositions[i + 7].toDouble(); val cz = renderPositions[i + 8].toDouble()
            sum += ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)
            i += 9
        }
        return sum
    }
}

/**
 * Filament's `TANGENTS` vertex attribute: the tangent frame as a quaternion
 * whose rotation takes +Z onto the surface normal.
 *
 * The viewer has no textures and no UVs, so only the normal is meaningful and
 * any tangent perpendicular to it will do. Each triangle gets its own frame —
 * vertices are never shared between triangles — which is what gives the flat,
 * technical shading the web viewer also uses.
 */
object TangentFrames {
    /** Quaternion `(x, y, z, w)` for a unit normal. */
    fun fromNormal(n: Vec3): FloatArray {
        // Any axis not parallel to the normal produces a valid tangent.
        val helper = if (abs(n.y) < 0.99) Vec3.UP else Vec3(1.0, 0.0, 0.0)
        val t = (helper cross n).normalized()
        val b = n cross t
        return fromBasis(t, b, n)
    }

    /**
     * Quaternion of the rotation whose matrix has columns `t`, `b`, `n`.
     * The basis must be orthonormal and right-handed (`t x b = n`).
     */
    fun fromBasis(t: Vec3, b: Vec3, n: Vec3): FloatArray {
        val trace = t.x + b.y + n.z
        val q: DoubleArray
        if (trace > 0.0) {
            val s = sqrt(trace + 1.0) * 2.0
            q = doubleArrayOf((b.z - n.y) / s, (n.x - t.z) / s, (t.y - b.x) / s, 0.25 * s)
        } else if (t.x > b.y && t.x > n.z) {
            val s = sqrt(1.0 + t.x - b.y - n.z) * 2.0
            q = doubleArrayOf(0.25 * s, (b.x + t.y) / s, (n.x + t.z) / s, (b.z - n.y) / s)
        } else if (b.y > n.z) {
            val s = sqrt(1.0 + b.y - t.x - n.z) * 2.0
            q = doubleArrayOf((b.x + t.y) / s, 0.25 * s, (n.y + b.z) / s, (n.x - t.z) / s)
        } else {
            val s = sqrt(1.0 + n.z - t.x - b.y) * 2.0
            q = doubleArrayOf((n.x + t.z) / s, (n.y + b.z) / s, 0.25 * s, (t.y - b.x) / s)
        }
        // Filament reads a negative w as a mirrored frame. Ours never is.
        val sign = if (q[3] < 0.0) -1.0 else 1.0
        val len = sqrt(q[0] * q[0] + q[1] * q[1] + q[2] * q[2] + q[3] * q[3])
        val k = if (len > 1e-12) sign / len else 1.0
        return floatArrayOf((q[0] * k).toFloat(), (q[1] * k).toFloat(), (q[2] * k).toFloat(), (q[3] * k).toFloat())
    }

    /** Rotate `v` by quaternion `q`. The inverse check tests use on `fromNormal`. */
    fun rotate(q: FloatArray, v: Vec3): Vec3 {
        val qx = q[0].toDouble(); val qy = q[1].toDouble(); val qz = q[2].toDouble(); val qw = q[3].toDouble()
        val u = Vec3(qx, qy, qz)
        val uv = u cross v
        val uuv = u cross uv
        return v + (uv * (2.0 * qw)) + (uuv * 2.0)
    }
}
