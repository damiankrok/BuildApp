package com.buildplan.preview.camera

import com.buildplan.preview.math.Bounds
import com.buildplan.preview.math.Vec3
import com.buildplan.preview.math.clamp
import com.buildplan.preview.math.wrapDegrees
import kotlin.math.cos
import kotlin.math.max
import kotlin.math.sin
import kotlin.math.tan

enum class Projection { PERSPECTIVE, ORTHOGRAPHIC }

/**
 * Where the camera is, as state rather than as an accumulated transform.
 *
 * Gestures change these numbers and the matrix is derived from them every
 * frame. That is what keeps orbit, pinch, pan and the presets consistent: a
 * preset is a pose, not a special animation path, and nothing can drift.
 *
 * `focus` is what the camera orbits — the framed object or the whole house —
 * and `pan` is the separate screen-space displacement the user has dragged on
 * top of it. Keeping them apart means "frame this" can replace the focus
 * without silently inheriting an old pan.
 */
data class OrbitPose(
    val focus: Vec3,
    val pan: Vec3,
    /** Degrees around +y. 0 looks at the front facade. */
    val yawDeg: Double,
    /** Degrees above the horizon. 0 is eye level, 90 straight down. */
    val pitchDeg: Double,
    /** Eye distance from the target, and the only zoom scalar in both projections. */
    val distance: Double,
    val projection: Projection = Projection.PERSPECTIVE,
) {
    val target: Vec3 get() = focus + pan
}

/**
 * The orbit camera's rules: the clamps, the gesture arithmetic and framing.
 *
 * Pure and immutable — every operation takes a pose and returns one — so the
 * whole interaction model is unit-testable without a GPU.
 */
class OrbitCamera(
    val sceneBounds: Bounds,
    /** Vertical field of view, degrees. Also sets the orthographic extent. */
    val fovDeg: Double = 45.0,
) {
    private val sceneRadius: Double = max(sceneBounds.radius, 0.5)

    /** Close enough to read a window reveal, never inside the walls. */
    val minDistance: Double = max(0.35, sceneRadius * 0.08)

    /** Far enough to see the site, never so far the house is a dot. */
    val maxDistance: Double = sceneRadius * 14.0

    fun clamp(pose: OrbitPose): OrbitPose = pose.copy(
        yawDeg = wrapDegrees(pose.yawDeg),
        pitchDeg = clamp(pose.pitchDeg, MIN_PITCH, MAX_PITCH),
        distance = clamp(pose.distance, minDistance, maxDistance),
    )

    /** One-finger drag. */
    fun orbit(pose: OrbitPose, deltaYawDeg: Double, deltaPitchDeg: Double): OrbitPose =
        clamp(pose.copy(yawDeg = pose.yawDeg + deltaYawDeg, pitchDeg = pose.pitchDeg + deltaPitchDeg))

    /** Pinch. `factor` below 1 moves the camera closer. */
    fun zoom(pose: OrbitPose, factor: Double): OrbitPose =
        clamp(pose.copy(distance = pose.distance * factor))

    /**
     * World units covered by one screen pixel at the focus plane.
     *
     * The same in both projections by construction: the orthographic extent is
     * defined as the perspective frustum's height at the focus distance, so
     * panning and zooming feel identical whichever projection is active.
     */
    fun worldPerPixel(pose: OrbitPose, viewportHeightPx: Int): Double {
        if (viewportHeightPx <= 0) return 0.0
        return 2.0 * pose.distance * tan(Math.toRadians(fovDeg) / 2.0) / viewportHeightPx
    }

    /** Half-height of the orthographic box, derived from the same zoom scalar. */
    fun orthoHalfHeight(pose: OrbitPose): Double = pose.distance * tan(Math.toRadians(fovDeg) / 2.0)

    /**
     * Two-finger drag. `dx`/`dy` are finger movement in pixels, screen axes
     * (y down). The model follows the fingers, so the target moves the other
     * way.
     */
    fun pan(pose: OrbitPose, dxPx: Double, dyPx: Double, viewportHeightPx: Int): OrbitPose {
        val scale = worldPerPixel(pose, viewportHeightPx)
        if (scale <= 0.0) return pose
        val basis = basis(pose)
        val delta = (basis.right * (-dxPx * scale)) + (basis.up * (dyPx * scale))
        return pose.copy(pan = pose.pan + delta)
    }

    /** The eye position for a pose. */
    fun eye(pose: OrbitPose): Vec3 = pose.target + direction(pose) * pose.distance

    /** Unit vector from the target towards the eye. */
    fun direction(pose: OrbitPose): Vec3 {
        val p = Math.toRadians(pose.pitchDeg)
        val y = Math.toRadians(pose.yawDeg)
        return Vec3(cos(p) * sin(y), sin(p), cos(p) * cos(y))
    }

    data class Basis(val right: Vec3, val up: Vec3, val forward: Vec3)

    /** Camera axes in world space, for pan and for the view matrix. */
    fun basis(pose: OrbitPose): Basis {
        val forward = (direction(pose) * -1.0).normalized()
        // Straight down needs a reference other than world up.
        val worldUp = if (kotlin.math.abs(forward.y) > 0.999) Vec3(0.0, 0.0, 1.0) else Vec3.UP
        val right = (forward cross worldUp).normalized()
        val up = (right cross forward).normalized()
        return Basis(right, up, forward)
    }

    /**
     * The distance at which `bounds` fills the viewport with a margin. Framing
     * uses the bounding sphere, so it is correct from every angle rather than
     * only from the one the user happens to be at.
     */
    fun distanceToFit(bounds: Bounds, margin: Double = 1.35): Double {
        val radius = max(bounds.radius, 0.25)
        return clamp(radius / tan(Math.toRadians(fovDeg) / 2.0) * margin, minDistance, maxDistance)
    }

    /**
     * Frame `bounds`, keeping the current angles unless new ones are given.
     * The pan is dropped: after "frame this" the object is centred, which is
     * the whole point of the action.
     */
    fun frame(
        pose: OrbitPose,
        bounds: Bounds,
        yawDeg: Double = pose.yawDeg,
        pitchDeg: Double = pose.pitchDeg,
        projection: Projection = pose.projection,
        margin: Double = 1.35,
    ): OrbitPose {
        if (bounds.isEmpty) return pose
        // A pane or a slab has almost no thickness; give it an extent so
        // framing it does not slam the camera onto the minimum distance.
        val padded = if (bounds.radius < 0.25) bounds.padded(0.25) else bounds
        return clamp(
            pose.copy(
                focus = padded.center,
                pan = Vec3.ZERO,
                yawDeg = yawDeg,
                pitchDeg = pitchDeg,
                distance = distanceToFit(padded, margin),
                projection = projection,
            ),
        )
    }

    /** Whole house: the pose Reset returns to. */
    fun home(): OrbitPose = frame(
        OrbitPose(sceneBounds.center, Vec3.ZERO, HOME_YAW, HOME_PITCH, sceneRadius * 3, Projection.PERSPECTIVE),
        sceneBounds,
        HOME_YAW,
        HOME_PITCH,
        Projection.PERSPECTIVE,
    )

    /** Near/far planes that hold the whole scene however far the camera is. */
    fun clipPlanes(pose: OrbitPose): Pair<Double, Double> {
        val far = pose.distance + sceneRadius * 4.0
        val near = max(0.05, minOf(pose.distance * 0.02, sceneRadius * 0.02))
        return near to far
    }

    companion object {
        /** Never let the house turn over; still allows a true plan view. */
        const val MIN_PITCH = -85.0
        const val MAX_PITCH = 89.0

        /** A three-quarter view that reads as a building rather than a facade. */
        const val HOME_YAW = 35.0
        const val HOME_PITCH = 22.0
    }
}
