package com.buildplan.preview.camera

import com.buildplan.preview.math.Vec3
import com.buildplan.preview.math.clamp
import com.buildplan.preview.math.wrapDegrees

/**
 * Moving between camera poses.
 *
 * A preset that teleports is disorienting — you lose track of which side of
 * the house you are on — so functional transitions are short, eased and
 * always interruptible: the first touch drops the animation and hands control
 * straight back. When the system asks for reduced motion the move is skipped
 * entirely rather than merely shortened.
 */
object PoseAnimation {
    /** Short enough never to feel like waiting. */
    const val DURATION_MS = 320L

    /** The longest a camera move takes: a half turn to the far side of the house. */
    const val LONGEST_MS = 600L

    /**
     * How long a move takes (round D): a small adjustment the short [DURATION_MS], a half turn round the house up to
     * [LONGEST_MS] — a fixed 320 ms whipped a 180° "Z tyłu" round at over 800°/s.
     */
    fun durationFor(from: OrbitPose, to: OrbitPose): Long {
        val turn = kotlin.math.abs(shortestTurn(from.yawDeg, to.yawDeg)) / 180.0
        val tilt = kotlin.math.abs(to.pitchDeg - from.pitchDeg) / 90.0
        val share = kotlin.math.max(turn, tilt).coerceIn(0.0, 1.0)
        return DURATION_MS + ((LONGEST_MS - DURATION_MS) * share).toLong()
    }

    /** Ease in and out (cubic): no abrupt start, no overshoot, a gentler middle than smoothstep for long turns. */
    fun ease(t: Double): Double {
        val x = clamp(t, 0.0, 1.0)
        return if (x < 0.5) 4.0 * x * x * x else 1.0 - Math.pow(-2.0 * x + 2.0, 3.0) / 2.0
    }

    /**
     * Interpolate. Yaw takes the shorter way round, so turning from 350° to
     * 10° sweeps 20° rather than 340° the wrong way.
     */
    fun lerp(from: OrbitPose, to: OrbitPose, t: Double): OrbitPose {
        val k = ease(t)
        // Land exactly on the endpoints: a transition that stops a
        // floating-point hair away from its target would leave the camera
        // permanently off the pose a preset promised.
        if (k <= 0.0) return from
        if (k >= 1.0) return to
        return OrbitPose(
            focus = lerp(from.focus, to.focus, k),
            pan = lerp(from.pan, to.pan, k),
            yawDeg = wrapDegrees(from.yawDeg + shortestTurn(from.yawDeg, to.yawDeg) * k),
            pitchDeg = from.pitchDeg + (to.pitchDeg - from.pitchDeg) * k,
            distance = from.distance + (to.distance - from.distance) * k,
            // The projection is a step change; switch at the halfway point so
            // it happens while the camera is already moving.
            projection = if (k < 0.5) from.projection else to.projection,
        )
    }

    /** Signed degrees from `a` to `b`, in `(-180, 180]`. */
    fun shortestTurn(a: Double, b: Double): Double {
        var d = wrapDegrees(b) - wrapDegrees(a)
        if (d > 180.0) d -= 360.0
        if (d <= -180.0) d += 360.0
        return d
    }

    private fun lerp(a: Vec3, b: Vec3, t: Double) = Vec3(
        a.x + (b.x - a.x) * t,
        a.y + (b.y - a.y) * t,
        a.z + (b.z - a.z) * t,
    )
}
