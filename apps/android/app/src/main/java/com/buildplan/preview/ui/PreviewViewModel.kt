package com.buildplan.preview.ui

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import com.buildplan.preview.camera.OrbitCamera
import com.buildplan.preview.camera.OrbitPose
import com.buildplan.preview.camera.PoseAnimation
import com.buildplan.preview.camera.ViewPreset
import com.buildplan.preview.render.RenderStyle
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.SceneIndexEntry
import com.buildplan.preview.scene.SceneLoadResult
import com.buildplan.preview.scene.SceneRepository
import com.buildplan.preview.scene.ViewerState
import com.buildplan.preview.scene.VisibilityMode

sealed interface ScreenState {
    data object Loading : ScreenState
    data class Ready(val scene: ModelScene) : ScreenState
    data class Failed(val message: String) : ScreenState
}

/**
 * Everything the viewport shows, held above the Activity so that an ordinary
 * rotation does not lose the camera, the style or the selection. The renderer
 * reads this every frame; nothing here knows about Filament.
 */
class PreviewViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = SceneRepository(application.assets)

    val scenes: List<SceneIndexEntry> = repository.index()

    var screen by mutableStateOf<ScreenState>(ScreenState.Loading)
        private set

    var viewer by mutableStateOf(ViewerState())
        private set

    var pose by mutableStateOf(OrbitPose(com.buildplan.preview.math.Vec3.ZERO, com.buildplan.preview.math.Vec3.ZERO, 0.0, 0.0, 10.0))
        private set

    var camera: OrbitCamera = OrbitCamera(com.buildplan.preview.math.Bounds(com.buildplan.preview.math.Vec3.ZERO, com.buildplan.preview.math.Vec3.ZERO))
        private set

    /** Shortening or removing camera motion when the system asks for it. */
    var reducedMotion: Boolean = false

    var viewportHeightPx: Int = 1

    private var animation: Animation? = null
    private var lastTapAtMs = 0L
    private var lastTapObjectId: String? = null

    private class Animation(val from: OrbitPose, val to: OrbitPose, val startedAtMs: Long)

    val scene: ModelScene? get() = (screen as? ScreenState.Ready)?.scene

    val selected get() = scene?.objectById(viewer.selectedObjectId)

    init {
        scenes.firstOrNull()?.let { open(it) }
            ?: run { screen = ScreenState.Failed("This build carries no scene bundles. Run `npm run mobile:export-scenes` and rebuild.") }
    }

    fun open(entry: SceneIndexEntry) {
        screen = ScreenState.Loading
        when (val result = repository.load(entry)) {
            is SceneLoadResult.Failed -> screen = ScreenState.Failed(result.message)
            is SceneLoadResult.Ok -> {
                val model = result.scene
                camera = OrbitCamera(model.bounds)
                pose = camera.home()
                viewer = ViewerState()
                animation = null
                screen = ScreenState.Ready(model)
            }
        }
    }

    // -----------------------------------------------------------------------
    // Camera
    // -----------------------------------------------------------------------

    /**
     * The pose to draw now, advancing any preset transition.
     *
     * Called once per frame by the canvas. When no transition is running this
     * simply returns the current pose.
     */
    fun poseAt(nowMs: Long): OrbitPose {
        val running = animation ?: return pose
        val t = (nowMs - running.startedAtMs).toDouble() / PoseAnimation.DURATION_MS
        if (t >= 1.0) {
            animation = null
            pose = running.to
            return running.to
        }
        return PoseAnimation.lerp(running.from, running.to, t)
    }

    /** Any manual camera input drops an in-flight transition immediately. */
    private fun interrupt(nowMs: Long) {
        val running = animation ?: return
        pose = poseAt(nowMs)
        animation = null
    }

    fun onGestureStart(nowMs: Long) = interrupt(nowMs)

    fun orbit(deltaYawDeg: Double, deltaPitchDeg: Double) {
        pose = camera.orbit(pose, deltaYawDeg, deltaPitchDeg)
    }

    fun zoom(factor: Double) {
        pose = camera.zoom(pose, factor)
    }

    fun pan(dxPx: Double, dyPx: Double) {
        pose = camera.pan(pose, dxPx, dyPx, viewportHeightPx)
    }

    private fun moveTo(target: OrbitPose, nowMs: Long) {
        if (reducedMotion) {
            animation = null
            pose = target
        } else {
            animation = Animation(poseAt(nowMs), target, nowMs)
        }
    }

    /** Whole house / Reset: a predictable camera AND a predictable scene. */
    fun reset(nowMs: Long) {
        val model = scene ?: return
        viewer = viewer.showAll().clearSelection()
        moveTo(camera.home(), nowMs)
    }

    fun applyPreset(preset: ViewPreset, nowMs: Long) {
        val model = scene ?: return
        val target = preset.poseIn(camera, model, pose) ?: return
        preset.visibility?.let { viewer = viewer.withVisibility(model, it) }
        // A focus preset is also an answer to "which one?", so it selects the
        // object it framed — otherwise the inspector would still be empty
        // after asking to look at the stairs.
        preset.objectIdIn(model)?.let { if (viewer.isVisible(model, it)) viewer = viewer.select(it) }
        moveTo(target, nowMs)
    }

    fun frameSelection(nowMs: Long) {
        val model = scene ?: return
        val target = model.objectById(viewer.selectedObjectId) ?: return
        moveTo(camera.frame(pose, target.bounds, margin = 1.7), nowMs)
    }

    // -----------------------------------------------------------------------
    // Selection and visibility
    // -----------------------------------------------------------------------

    /**
     * A tap has resolved to `objectId` (or to nothing).
     *
     * Selection is applied at once — it never waits to see whether a second
     * tap is coming. A second tap on the same object soon after is then read
     * as "isolate and frame this", which is additional behaviour on top of a
     * selection the user already saw happen.
     */
    fun onPicked(objectId: String?, nowMs: Long): Boolean {
        val model = scene ?: return false
        if (objectId == null) {
            viewer = viewer.clearSelection()
            lastTapObjectId = null
            return false
        }
        val isDoubleTap = objectId == lastTapObjectId && nowMs - lastTapAtMs <= DOUBLE_TAP_MS
        viewer = viewer.select(objectId)
        lastTapAtMs = nowMs
        lastTapObjectId = objectId
        if (isDoubleTap) {
            viewer = viewer.isolateSelected(model)
            model.objectById(objectId)?.let { moveTo(camera.frame(pose, it.bounds, margin = 1.7), nowMs) }
            lastTapObjectId = null
        }
        return isDoubleTap
    }

    fun setVisibility(mode: VisibilityMode) {
        val model = scene ?: return
        viewer = viewer.withVisibility(model, mode)
    }

    fun isolateSelected() {
        val model = scene ?: return
        viewer = viewer.isolateSelected(model)
    }

    fun showAll() {
        viewer = viewer.showAll()
    }

    fun setStyle(style: RenderStyle) {
        viewer = viewer.withStyle(style)
    }

    fun clearSelection() {
        viewer = viewer.clearSelection()
    }

    private companion object {
        /** The platform's own double-tap window. */
        const val DOUBLE_TAP_MS = 300L
    }
}
