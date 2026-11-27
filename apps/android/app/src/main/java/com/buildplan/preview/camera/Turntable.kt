package com.buildplan.preview.camera

import com.buildplan.preview.math.Vec3
import kotlin.math.abs
import kotlin.math.max
import kotlin.math.tan

/**
 * The idle turntable (round D): the whole house turning slowly by itself
 * while nobody touches it — an opt-in view setting, off unless the owner
 * turns it on, and never with the system's animations off.
 *
 * Pure arithmetic, free of Android and Filament, so the rules are unit tests:
 * when it may start, how fast it turns, how gently it starts, and where the
 * camera must stand for the whole house to stay in view at EVERY angle of the
 * turn (the home view is fitted for one angle; a long house seen end-on at
 * another angle would leave the frame).
 */
object Turntable {
    /** One turn a minute: slow enough to read the house, fast enough to see it move. */
    const val DEGREES_PER_SECOND = 6.0

    /** How long the house must be left alone before it starts turning: long enough to read what is on screen. */
    const val IDLE_BEFORE_MS = 5_000L

    /** The longest run: after five minutes of turning it eases out and holds still until the next touch. */
    const val MAX_TURN_MS = 300_000L

    /** How long the turn takes to reach its speed: it eases in, never jerks into motion. */
    const val RAMP_MS = 1_600L

    /** A frame longer than this (the app paused, a dropped second) never turns the house further than this at once. */
    const val MAX_FRAME_MS = 50L

    /** How many angles the fit is checked at; the fit holds between them by the margin. */
    const val FIT_SAMPLES = 36

    /**
     * The turn's margin: tighter than home's, because the all-angle fit is already the widest the house ever gets —
     * with home's margin the camera pulled back about 15 % when the turn began; with this one, about 5 %.
     */
    const val TURN_MARGIN = 1.04

    /**
     * The yaw to add this frame, degrees: nothing until the house has been left alone for [IDLE_BEFORE_MS],
     * then a smooth start over [RAMP_MS] to [DEGREES_PER_SECOND]; after [MAX_TURN_MS] of turning, a smooth stop
     * over [RAMP_MS].
     */
    fun yawStep(idleMs: Long, frameMs: Long): Double {
        if (idleMs < IDLE_BEFORE_MS || frameMs <= 0) return 0.0
        val turned = idleMs - IDLE_BEFORE_MS
        val start = smooth(turned.toDouble() / RAMP_MS)
        val stop = smooth((MAX_TURN_MS + RAMP_MS - turned).toDouble() / RAMP_MS)
        return DEGREES_PER_SECOND * minOf(start, stop) * frameMs.coerceAtMost(MAX_FRAME_MS) / 1000.0
    }

    /** True once the turn has begun: the moment the camera must already stand at [pose]. */
    fun started(idleMs: Long): Boolean = idleMs >= IDLE_BEFORE_MS

    /** True once the longest run has eased out. */
    fun finished(idleMs: Long): Boolean = idleMs >= IDLE_BEFORE_MS + MAX_TURN_MS + RAMP_MS

    private fun smooth(x: Double): Double {
        val t = x.coerceIn(0.0, 1.0)
        return t * t * (3.0 - 2.0 * t)
    }

    /**
     * Where the camera stands for the turn: it orbits the house's [pivot], at the current pitch, at the
     * nearest distance from which every frame point lies inside [span] with [margin] to spare at every one
     * of [FIT_SAMPLES] angles. Perspective, no pan.
     */
    fun pose(camera: OrbitCamera, framePoints: List<Vec3>, from: OrbitPose, span: OrbitCamera.FitSpan, margin: Double = TURN_MARGIN): OrbitPose {
        val pivot = pivot(framePoints, camera.sceneBounds)
        val tanHalf = tan(Math.toRadians(camera.fovDeg) / 2.0)
        val th = tanHalf * max(span.horizontal, 0.05) / margin
        val tv = tanHalf * max(span.vertical, 0.05) / margin
        var distance = 0.0
        for (i in 0 until FIT_SAMPLES) {
            val yaw = from.yawDeg + 360.0 * i / FIT_SAMPLES
            val b = camera.basis(OrbitPose(pivot, Vec3.ZERO, yaw, from.pitchDeg, 1.0, Projection.PERSPECTIVE))
            for (p in framePoints) {
                val q = p - pivot
                distance = max(distance, max(abs(q dot b.right) / th, abs(q dot b.up) / tv) - (q dot b.forward))
            }
        }
        // Never nearer than the owner stood: a house already seen from farther away is not pulled in.
        val keep = if (from.projection == Projection.PERSPECTIVE) max(distance, from.distance) else distance
        return camera.clamp(from.copy(focus = pivot, pan = Vec3.ZERO, distance = keep, projection = Projection.PERSPECTIVE))
    }

    /**
     * What the house turns about: in plan, the centre of the smallest circle holding every frame point — the
     * point the house swings around least, so it stays centred all the way round and the camera stands as near
     * as it can (the box's centre of an L-shaped house sat in its empty corner, and the house swung out to one
     * side); in height, the middle of the box.
     */
    fun pivot(framePoints: List<Vec3>, bounds: com.buildplan.preview.math.Bounds): Vec3 {
        val circle = enclosingCircle(hull(framePoints.map { it.x to it.z }.distinct())) ?: return bounds.center
        return Vec3(circle.first, bounds.center.y, circle.second)
    }

    /** The convex hull in plan (Andrew's monotone chain), counter-clockwise. */
    private fun hull(points: List<Pair<Double, Double>>): List<Pair<Double, Double>> {
        val sorted = points.sortedWith(compareBy<Pair<Double, Double>> { it.first }.thenBy { it.second })
        if (sorted.size < 3) return sorted
        fun cross(o: Pair<Double, Double>, a: Pair<Double, Double>, b: Pair<Double, Double>) =
            (a.first - o.first) * (b.second - o.second) - (a.second - o.second) * (b.first - o.first)
        val lower = ArrayList<Pair<Double, Double>>()
        for (p in sorted) {
            while (lower.size >= 2 && cross(lower[lower.size - 2], lower.last(), p) <= 0) lower.removeAt(lower.size - 1)
            lower.add(p)
        }
        val upper = ArrayList<Pair<Double, Double>>()
        for (p in sorted.asReversed()) {
            while (upper.size >= 2 && cross(upper[upper.size - 2], upper.last(), p) <= 0) upper.removeAt(upper.size - 1)
            upper.add(p)
        }
        return lower.dropLast(1) + upper.dropLast(1)
    }

    /** The smallest circle holding [points] (incremental, exact; deterministic), as (centre x, centre z); null when empty. */
    private fun enclosingCircle(points: List<Pair<Double, Double>>): Pair<Double, Double>? {
        if (points.isEmpty()) return null
        var c = Circle(points[0].first, points[0].second, 0.0)
        for (i in points.indices) {
            if (c.holds(points[i])) continue
            c = Circle(points[i].first, points[i].second, 0.0)
            for (j in 0 until i) {
                if (c.holds(points[j])) continue
                c = Circle.of(points[i], points[j])
                for (k in 0 until j) if (!c.holds(points[k])) c = Circle.of(points[i], points[j], points[k]) ?: c
            }
        }
        return c.x to c.z
    }

    private class Circle(val x: Double, val z: Double, val r: Double) {
        fun holds(p: Pair<Double, Double>): Boolean = kotlin.math.hypot(p.first - x, p.second - z) <= r + 1e-9

        companion object {
            fun of(a: Pair<Double, Double>, b: Pair<Double, Double>): Circle {
                val x = (a.first + b.first) / 2.0
                val z = (a.second + b.second) / 2.0
                return Circle(x, z, kotlin.math.hypot(a.first - x, a.second - z))
            }

            /** The circle through three points, or null when they are on one line. */
            fun of(a: Pair<Double, Double>, b: Pair<Double, Double>, c: Pair<Double, Double>): Circle? {
                val d = 2.0 * (a.first * (b.second - c.second) + b.first * (c.second - a.second) + c.first * (a.second - b.second))
                if (abs(d) < 1e-12) return null
                val a2 = a.first * a.first + a.second * a.second
                val b2 = b.first * b.first + b.second * b.second
                val c2 = c.first * c.first + c.second * c.second
                val x = (a2 * (b.second - c.second) + b2 * (c.second - a.second) + c2 * (a.second - b.second)) / d
                val z = (a2 * (c.first - b.first) + b2 * (a.first - c.first) + c2 * (b.first - a.first)) / d
                return Circle(x, z, kotlin.math.hypot(a.first - x, a.second - z))
            }
        }
    }
}
