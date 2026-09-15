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

    /** Smoothstep: no abrupt start, no overshoot. */
    fun ease(t: Double): Double {
        val x = clamp(t, 0.0, 1.0)
        return x * x * (3.0 - 2.0 * x)
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
