package com.buildplan.preview.math

import kotlin.math.abs
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

/**
 * Small double-precision vector maths.
 *
 * Deliberately independent of Filament so that camera, framing and bounds
 * logic runs in an ordinary JVM unit test with no GPU and no native library.
 * Only the renderer converts these to the float buffers the GPU wants.
 */
data class Vec3(val x: Double, val y: Double, val z: Double) {
    operator fun plus(o: Vec3) = Vec3(x + o.x, y + o.y, z + o.z)
    operator fun minus(o: Vec3) = Vec3(x - o.x, y - o.y, z - o.z)
    operator fun times(s: Double) = Vec3(x * s, y * s, z * s)

    infix fun dot(o: Vec3) = x * o.x + y * o.y + z * o.z
    infix fun cross(o: Vec3) = Vec3(y * o.z - z * o.y, z * o.x - x * o.z, x * o.y - y * o.x)

    val length: Double get() = sqrt(x * x + y * y + z * z)

    fun normalized(): Vec3 {
        val l = length
        return if (l > 1e-12) Vec3(x / l, y / l, z / l) else ZERO
    }

    fun isFinite() = x.isFinite() && y.isFinite() && z.isFinite()

    companion object {
        val ZERO = Vec3(0.0, 0.0, 0.0)
        val UP = Vec3(0.0, 1.0, 0.0)
    }
}

/** An axis-aligned box. `min` is componentwise smaller than `max` when not empty. */
data class Bounds(val min: Vec3, val max: Vec3) {
    val center: Vec3 get() = Vec3((min.x + max.x) / 2, (min.y + max.y) / 2, (min.z + max.z) / 2)
    val size: Vec3 get() = Vec3(max.x - min.x, max.y - min.y, max.z - min.z)

    /** Half the diagonal: the radius of the sphere that contains the box. */
    val radius: Double get() = size.length / 2

    val isEmpty: Boolean get() = max.x < min.x || max.y < min.y || max.z < min.z

    fun union(o: Bounds): Bounds = when {
        isEmpty -> o
        o.isEmpty -> this
        else -> Bounds(
            Vec3(min(min.x, o.min.x), min(min.y, o.min.y), min(min.z, o.min.z)),
            Vec3(max(max.x, o.max.x), max(max.y, o.max.y), max(max.z, o.max.z)),
        )
    }

    /** The eight corners, for drawing a selection box. */
    fun corners(): List<Vec3> = listOf(
        Vec3(min.x, min.y, min.z), Vec3(max.x, min.y, min.z), Vec3(max.x, min.y, max.z), Vec3(min.x, min.y, max.z),
        Vec3(min.x, max.y, min.z), Vec3(max.x, max.y, min.z), Vec3(max.x, max.y, max.z), Vec3(min.x, max.y, max.z),
    )

    /** Grown so that a flat box (a pane, a floor slab) still has a visible extent. */
    fun padded(by: Double): Bounds =
        if (isEmpty) this
        else Bounds(Vec3(min.x - by, min.y - by, min.z - by), Vec3(max.x + by, max.y + by, max.z + by))

    companion object {
        val EMPTY = Bounds(
            Vec3(Double.POSITIVE_INFINITY, Double.POSITIVE_INFINITY, Double.POSITIVE_INFINITY),
            Vec3(Double.NEGATIVE_INFINITY, Double.NEGATIVE_INFINITY, Double.NEGATIVE_INFINITY),
        )

        fun around(point: Vec3): Bounds = Bounds(point, point)
    }
}

/** Degrees wrapped into `[0, 360)`, so yaw never drifts to an unreadable number. */
fun wrapDegrees(deg: Double): Double {
    val m = deg % 360.0
    return if (m < 0) m + 360.0 else m
}

fun clamp(v: Double, lo: Double, hi: Double): Double = max(lo, min(hi, v))

/** True when two angles name the same direction, within `epsDeg`. */
fun sameAngle(a: Double, b: Double, epsDeg: Double = 1e-6): Boolean {
    val d = abs(wrapDegrees(a) - wrapDegrees(b))
    return d < epsDeg || abs(d - 360.0) < epsDeg
}
