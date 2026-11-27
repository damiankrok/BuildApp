package com.buildplan.preview.camera

import kotlin.math.abs
import kotlin.math.exp
import kotlin.math.hypot

/**
 * The glide after a flick (round D): a one-finger turn released while still moving keeps turning for a moment and
 * comes to rest, the way a real turntable would — instead of stopping dead under the lifted finger.
 *
 * Pure arithmetic, so the feel is a unit test: exponential decay with time constant [TAU_MS], integrated exactly
 * per frame (so a dropped frame does not change where it stops), started only by a real flick ([MIN_START]) and
 * capped ([MAX_START]); pitch glides at [PITCH_SHARE] of its speed, so a sideways flick does not tip the house.
 */
object OrbitInertia {
    /** How quickly the glide dies away: after this long it has 37 % of its speed left. */
    const val TAU_MS = 220.0

    /** Slower than this (degrees a second) a release is a placement, not a flick: no glide. */
    const val MIN_START = 30.0

    /** The fastest glide, degrees a second: a wild flick still ends within about a quarter turn. */
    const val MAX_START = 360.0

    /** The glide stops below this speed, degrees a second. */
    const val STOP = 4.0

    /** The share of the vertical speed that glides. */
    const val PITCH_SHARE = 0.35

    /** The glide a release at ([yawDegPerS], [pitchDegPerS]) starts, or null when it is no flick. */
    fun start(yawDegPerS: Double, pitchDegPerS: Double): Pair<Double, Double>? {
        val pitch = pitchDegPerS * PITCH_SHARE
        val speed = hypot(yawDegPerS, pitch)
        if (!speed.isFinite() || speed < MIN_START) return null
        val k = if (speed > MAX_START) MAX_START / speed else 1.0
        return yawDegPerS * k to pitch * k
    }

    /** The turn over [dtMs] at speed [v] (degrees a second), exactly: v·τ·(1 − e^(−dt/τ)). */
    fun travel(v: Double, dtMs: Double): Double = v * TAU_MS / 1000.0 * (1.0 - exp(-dtMs / TAU_MS))

    /** The speed after [dtMs]. */
    fun decay(v: Double, dtMs: Double): Double = v * exp(-dtMs / TAU_MS)

    /** Whether a glide at this speed has stopped. */
    fun stopped(yaw: Double, pitch: Double): Boolean = hypot(yaw, pitch) < STOP

    /** The whole distance a glide from speed [v] travels before it stops (for tests and the record). */
    fun reach(v: Double): Double = abs(v) * TAU_MS / 1000.0
}
