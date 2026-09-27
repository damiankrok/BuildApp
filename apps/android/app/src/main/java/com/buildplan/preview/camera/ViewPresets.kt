package com.buildplan.preview.camera

import com.buildplan.preview.math.Bounds
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.VisibilityMode

/**
 * Straight down is 90°, which the pitch clamp refuses so the camera can never
 * pass over the top and flip. One degree short is visually a plan view and
 * keeps the orbit well defined.
 */
const val PLAN_PITCH = 89.0

/** The isometric elevation angle, atan(1/sqrt 2): the three axes foreshortened equally. */
val ISOMETRIC_PITCH: Double = Math.toDegrees(kotlin.math.atan(1.0 / kotlin.math.sqrt(2.0)))

/**
 * What a preset aims at. Presets resolve against the scene rather than naming
 * a building: `STAIR` is "the staircase this model has", not an id.
 */
enum class PresetTarget { WHOLE_MODEL, STAIR, ENTRANCE }

/**
 * The camera presets.
 *
 * Every one is just a pose handed to the same `OrbitCamera` the fingers drive,
 * so a preset can never reach a place manual navigation cannot, and framing
 * behaves identically either way.
 *
 * The elevations and plans are genuinely orthographic: an elevation with
 * perspective is not an elevation, and Filament supports the projection
 * directly, so there is no long-focal-length approximation here.
 */
enum class ViewPreset(
    val label: String,
    val description: String,
    val yawDeg: Double,
    val pitchDeg: Double,
    val target: PresetTarget,
    val projection: Projection,
    /** A visibility mode the preset also needs to be meaningful, if any. */
    val visibility: VisibilityMode? = null,
    val margin: Double = 1.35,
    /** Keep the current yaw, pitch and projection; only refit. */
    val keepsAngles: Boolean = false,
    /** Fit to the viewport's narrower side, so nothing is cropped in portrait. */
    val fitsViewport: Boolean = false,
) {
    WHOLE("Whole house", "Three-quarter view of the whole model", OrbitCamera.HOME_YAW, OrbitCamera.HOME_PITCH, PresetTarget.WHOLE_MODEL, Projection.PERSPECTIVE),
    AXONOMETRIC("Axonometric", "Orthographic three-quarter view", 45.0, 30.0, PresetTarget.WHOLE_MODEL, Projection.ORTHOGRAPHIC),
    FRONT("Front", "Front elevation", 0.0, 0.0, PresetTarget.WHOLE_MODEL, Projection.ORTHOGRAPHIC),
    REAR("Rear", "Rear elevation", 180.0, 0.0, PresetTarget.WHOLE_MODEL, Projection.ORTHOGRAPHIC),
    LEFT("Left / West", "Left elevation", 270.0, 0.0, PresetTarget.WHOLE_MODEL, Projection.ORTHOGRAPHIC),
    RIGHT("Right / East", "Right elevation", 90.0, 0.0, PresetTarget.WHOLE_MODEL, Projection.ORTHOGRAPHIC),
    TOP("Top", "Roof plan from above", 0.0, PLAN_PITCH, PresetTarget.WHOLE_MODEL, Projection.ORTHOGRAPHIC),
    GROUND_PLAN("Ground plan", "Lowest storey from above", 0.0, PLAN_PITCH, PresetTarget.WHOLE_MODEL, Projection.ORTHOGRAPHIC, VisibilityMode.GROUND_ONLY),
    ATTIC_PLAN("Attic plan", "Upper storey from above, roof off", 0.0, PLAN_PITCH, PresetTarget.WHOLE_MODEL, Projection.ORTHOGRAPHIC, VisibilityMode.UPPER_ONLY),
    STAIRS("Stairs", "Frame the staircase, roof off", 40.0, 18.0, PresetTarget.STAIR, Projection.PERSPECTIVE, VisibilityMode.ROOF_OFF, margin = 1.6),
    ENTRANCE("Entrance", "Frame the entrance door", 10.0, 4.0, PresetTarget.ENTRANCE, Projection.PERSPECTIVE, margin = 1.8),

    /** Generic, from the model's bounds only: the whole model at the current angle, never cropped. */
    FIT("Fit model", "Whole model at the current angle, fitted to the screen", 0.0, 0.0, PresetTarget.WHOLE_MODEL, Projection.PERSPECTIVE, margin = 1.12, keepsAngles = true, fitsViewport = true),

    /** Generic, from the model's bounds only: a true isometric (equal foreshortening of the three axes). */
    ISOMETRIC("Isometric", "True isometric, orthographic, fitted to the screen", 45.0, ISOMETRIC_PITCH, PresetTarget.WHOLE_MODEL, Projection.ORTHOGRAPHIC, margin = 1.12, fitsViewport = true),
    ;

    /** The bounds this preset frames, or null when the model has no such thing. */
    fun boundsIn(scene: ModelScene): Bounds? = when (target) {
        PresetTarget.WHOLE_MODEL -> scene.bounds
        PresetTarget.STAIR -> scene.objectById(scene.stairObjectId)?.bounds
        PresetTarget.ENTRANCE -> scene.objectById(scene.entranceObjectId)?.bounds
    }

    /** The semantic object this preset is about, when it is about one. */
    fun objectIdIn(scene: ModelScene): String? = when (target) {
        PresetTarget.WHOLE_MODEL -> null
        PresetTarget.STAIR -> scene.stairObjectId
        PresetTarget.ENTRANCE -> scene.entranceObjectId
    }

    /** Presets that this particular model can actually satisfy. */
    fun isAvailableIn(scene: ModelScene): Boolean {
        val b = boundsIn(scene) ?: return false
        if (b.isEmpty) return false
        if (this == ATTIC_PLAN) return scene.levels.size > 1
        return true
    }

    /**
     * The pose this preset frames. [aspect] is the viewport's width over its
     * height; only the presets that fit the viewport read it, so every older
     * preset frames exactly as it always did.
     */
    fun poseIn(camera: OrbitCamera, scene: ModelScene, from: OrbitPose, aspect: Double = 1.0): OrbitPose? {
        val bounds = boundsIn(scene) ?: return null
        val yaw = if (keepsAngles) from.yawDeg else yawDeg
        val pitch = if (keepsAngles) from.pitchDeg else pitchDeg
        val proj = if (keepsAngles) from.projection else projection
        return camera.frame(from, bounds, yaw, pitch, proj, margin, if (fitsViewport) aspect else 1.0)
    }

    companion object {
        fun availableIn(scene: ModelScene): List<ViewPreset> = entries.filter { it.isAvailableIn(scene) }
    }
}
