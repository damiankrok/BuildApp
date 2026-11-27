package com.buildplan.preview.presentation

import com.buildplan.preview.math.Bounds
import com.buildplan.preview.math.Vec3
import com.buildplan.preview.scene.ModelScene
import kotlin.math.PI
import kotlin.math.atan2
import kotlin.math.ceil
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.pow
import kotlin.math.sin

/**
 * The house's contact shadow in MODEL (round D): without it the house floats in the backdrop and touches
 * nothing. Presentation only, like the grid — no object id, never picked, never a shadow the sun casts.
 *
 * Built with no new shader: [RINGS] nested, filled outlines of the ground footprint, each a little larger
 * than the last, drawn on top of one another in a translucent black. Where all of them overlap — at the
 * foot of the walls — the ground is darkest; it fades to nothing [REACH_M] beyond the footprint. The
 * footprint is the convex hull of the ground-standing objects' corners, so the ring outlines are smooth
 * (rounded corners, no grid steps) and a fan from the centre triangulates every one of them.
 *
 * Pure geometry, free of Android and Filament, so the shape is a unit test.
 */
object ContactShadow {
    /** How many outlines are stacked. */
    const val RINGS = 8

    /** How far beyond the footprint the shadow reaches before it is gone, metres. */
    const val REACH_M = 1.4

    /** The opacity of one outline: eight of them give ≈ 45 % at the foot of the wall. */
    const val ALPHA_PER_RING = 0.072f

    /** An object whose bottom is this close to the house's lowest point stands on the ground. */
    const val STANDS_WITHIN_M = 0.6

    /** The share of the footprint the shown objects must stand over for the shadow to be drawn. */
    const val COVERS = 0.8

    /** The rounded corners are drawn with one segment per this many degrees of turn. */
    const val ARC_STEP_DEG = 12.0

    /** How far under the grid lines (and over a ground sheet) the shadow lies, metres. */
    const val BELOW_GRID_M = 0.005

    /** One point of the plan, metres. */
    data class PlanPoint(val x: Double, val z: Double)

    /** The stacked outlines and the plane they lie on. */
    class Shape(
        /** Outermost last; each closed, counter-clockwise seen from above, convex. */
        val rings: List<List<PlanPoint>>,
        /** The objects that stand on the ground, each with its plan box (min x, min z, max x, max z). */
        val footprints: Map<String, DoubleArray>,
        /** A point inside every ring: the fan's centre. */
        val centre: PlanPoint,
        val y: Double,
    ) {
        /** The objects that stand on the ground: the shadow is theirs. */
        val standing: Set<String> get() = footprints.keys

        /**
         * Whether the shown objects stand over (nearly) the whole footprint, so the one shadow is theirs and not a
         * ghost of hidden parts: the convex hull of the shown standing objects covers at least [COVERS] of the hull
         * of them all. An isolated wall, the attic alone, a stage before the foundations: no shadow.
         */
        fun covers(visible: Set<String>): Boolean {
            val shown = footprints.filterKeys { it in visible }.values
            if (shown.isEmpty()) return false
            val all = area(footprints.values)
            return all > 0.0 && area(shown) >= COVERS * all
        }

        /** The area of the convex hull of these plan boxes' corners. */
        private fun area(boxes: Collection<DoubleArray>): Double {
            val ring = hull(boxes.flatMap { b -> listOf(PlanPoint(b[0], b[1]), PlanPoint(b[2], b[1]), PlanPoint(b[2], b[3]), PlanPoint(b[0], b[3])) })
            if (ring.size < 3) return 0.0
            var twice = 0.0
            for (i in ring.indices) {
                val a = ring[i]
                val b = ring[(i + 1) % ring.size]
                twice += a.x * b.z - b.x * a.z
            }
            return kotlin.math.abs(twice) / 2.0
        }

        /** The bounds of the outermost ring, a centimetre thick. */
        val bounds: Bounds
            get() {
                val outer = rings.last()
                return Bounds(
                    Vec3(outer.minOf { it.x }, y - 0.01, outer.minOf { it.z }),
                    Vec3(outer.maxOf { it.x }, y + 0.01, outer.maxOf { it.z }),
                )
            }

        /** Interleaved positions (x, y, z), per ring the centre then its outline. */
        fun positions(): FloatArray {
            val out = FloatArray(rings.sumOf { it.size + 1 } * 3)
            var i = 0
            for (ring in rings) {
                for (p in listOf(centre) + ring) {
                    out[i++] = p.x.toFloat(); out[i++] = y.toFloat(); out[i++] = p.z.toFloat()
                }
            }
            return out
        }

        /** A fan per ring; each triangle faces up (counter-clockwise seen from above). */
        fun indices(): IntArray {
            val out = ArrayList<Int>()
            var base = 0
            for (ring in rings) {
                val n = ring.size
                for (j in 0 until n) {
                    // Seen from above (looking down −Y) a counter-clockwise turn in (x, z) is clockwise:
                    // swap the pair so the face's normal points up.
                    out.add(base); out.add(base + 1 + (j + 1) % n); out.add(base + 1 + j)
                }
                base += n + 1
            }
            return out.toIntArray()
        }
    }

    /** The radius of outline [k] beyond the footprint: closer together near the wall, so the falloff is soft. */
    fun reach(k: Int): Double = REACH_M * (k.toDouble() / (RINGS - 1)).pow(2.0)

    /** The contact shadow of [scene], or null when it has nothing standing on anything. */
    fun of(scene: ModelScene): Shape? {
        val solid = scene.objects.filter { it.hasGeometry && !it.bounds.isEmpty }
        if (solid.isEmpty() || scene.bounds.isEmpty) return null
        val floor = scene.bounds.min.y
        val standing = solid.filter { it.bounds.min.y <= floor + STANDS_WITHIN_M }.ifEmpty { solid }
        val corners = standing.flatMap { o ->
            val b = o.bounds
            listOf(PlanPoint(b.min.x, b.min.z), PlanPoint(b.max.x, b.min.z), PlanPoint(b.max.x, b.max.z), PlanPoint(b.min.x, b.max.z))
        }
        val hull = hull(corners)
        if (hull.size < 3) return null
        val centre = PlanPoint(hull.sumOf { it.x } / hull.size, hull.sumOf { it.z } / hull.size)
        val rings = (0 until RINGS).map { k -> offset(hull, reach(k)) }
        val footprints = standing.associateTo(LinkedHashMap()) { o -> o.id to doubleArrayOf(o.bounds.min.x, o.bounds.min.z, o.bounds.max.x, o.bounds.max.z) }
        return Shape(rings, footprints, centre, floor - 0.01 - BELOW_GRID_M)
    }

    /** The convex hull, counter-clockwise in (x, z), without collinear points (Andrew's monotone chain). */
    fun hull(points: List<PlanPoint>): List<PlanPoint> {
        val sorted = points.distinct().sortedWith(compareBy<PlanPoint> { it.x }.thenBy { it.z })
        if (sorted.size < 3) return sorted
        fun cross(o: PlanPoint, a: PlanPoint, b: PlanPoint) = (a.x - o.x) * (b.z - o.z) - (a.z - o.z) * (b.x - o.x)
        val lower = ArrayList<PlanPoint>()
        for (p in sorted) {
            while (lower.size >= 2 && cross(lower[lower.size - 2], lower[lower.size - 1], p) <= 1e-12) lower.removeAt(lower.size - 1)
            lower.add(p)
        }
        val upper = ArrayList<PlanPoint>()
        for (p in sorted.asReversed()) {
            while (upper.size >= 2 && cross(upper[upper.size - 2], upper[upper.size - 1], p) <= 1e-12) upper.removeAt(upper.size - 1)
            upper.add(p)
        }
        return lower.dropLast(1) + upper.dropLast(1)
    }

    /**
     * [hull] grown by [r]: every edge moved out by [r], every corner rounded with an arc of radius [r]
     * (the hull swept by a disc). Still convex and counter-clockwise; [r] = 0 is the hull itself.
     */
    fun offset(hull: List<PlanPoint>, r: Double): List<PlanPoint> {
        if (r <= 0.0) return hull
        val n = hull.size
        val out = ArrayList<PlanPoint>()
        for (i in 0 until n) {
            val prev = hull[(i - 1 + n) % n]
            val v = hull[i]
            val next = hull[(i + 1) % n]
            // Outward normals of the incoming and outgoing edges (interior on the left of a CCW walk).
            val a0 = atan2(-(v.x - prev.x), v.z - prev.z)
            var a1 = atan2(-(next.x - v.x), next.z - v.z)
            while (a1 < a0) a1 += 2 * PI
            val turn = a1 - a0
            val steps = max(1, ceil(Math.toDegrees(turn) / ARC_STEP_DEG).toInt())
            for (s in 0..steps) {
                val a = a0 + turn * s / steps
                out.add(PlanPoint(v.x + r * cos(a), v.z + r * sin(a)))
            }
        }
        return out
    }
}
