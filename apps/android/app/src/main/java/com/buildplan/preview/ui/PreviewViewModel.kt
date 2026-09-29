package com.buildplan.preview.ui

import android.app.Application
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.buildplan.preview.camera.ContentFrame
import com.buildplan.preview.camera.ContentInsets
import com.buildplan.preview.camera.OrbitCamera
import com.buildplan.preview.camera.OrbitPose
import com.buildplan.preview.camera.PoseAnimation
import com.buildplan.preview.camera.ViewPreset
import com.buildplan.preview.presentation.PresentationMode
import com.buildplan.preview.render.RenderDiagnostics
import com.buildplan.preview.render.RenderStyle
import com.buildplan.preview.render.RenderSurfaceKind
import com.buildplan.preview.scene.DownloadedScenes
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.SceneEntry
import com.buildplan.preview.scene.SceneLoadProblem
import com.buildplan.preview.scene.SceneLoadResult
import com.buildplan.preview.scene.SceneRepository
import com.buildplan.preview.scene.ViewerState
import com.buildplan.preview.scene.VisibilityMode
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

sealed interface ScreenState {
    data object Loading : ScreenState
    data class Ready(val scene: ModelScene) : ScreenState
    /** [message] is technical (for diagnostics); [problem], null for "no model at all", is what the owner is told. */
    /** [entry] is the house that failed to load, when one was asked for: the way to remove it. */
    data class Failed(val message: String, val problem: SceneLoadProblem?, val entry: SceneEntry? = null) : ScreenState
}

/**
 * Everything the viewport shows, held above the Activity so that an ordinary
 * rotation does not lose the camera, the style or the selection. The renderer
 * reads this every frame; nothing here knows about Filament.
 */
class PreviewViewModel(application: Application) : AndroidViewModel(application) {

    /** Bundled scenes first, in their exported order, then the analyses downloaded to this phone. */
    private val repository = SceneRepository(
        application.assets,
        DownloadedScenes(java.io.File(application.filesDir, "analyses")),
    )

    var scenes: List<SceneEntry> by mutableStateOf(repository.entries())
        private set

    /** Hide the scenes shipped in the APK (a launch extra for evidence of the no-house state), and show what is left. */
    fun hideBundled() {
        if (hidingBundled) return
        hidingBundled = true
        scenes = entries()
        loading?.cancel()
        scenes.firstOrNull()?.let { open(it) } ?: run { screen = ScreenState.Failed("no scene bundles in this build", null) }
    }

    private var hidingBundled = false

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
        private set

    var viewportWidthPx: Int = 1
        private set

    /**
     * Which Android surface the viewport renders into. A launch extra can pick
     * the other one for a device comparison ([RenderSurfaceKind.EXTRA]).
     */
    var renderSurfaceKind: RenderSurfaceKind = RenderSurfaceKind.DEFAULT

    /** The counters of the viewport on screen now, or null when no viewport is composed. */
    @Volatile var renderDiagnostics: RenderDiagnostics? = null

    /**
     * The viewport's edges the chrome covers at rest, in pixels. The renderer
     * frames the model inside what is left, every frame; read on the render
     * thread's callback, so a plain volatile rather than snapshot state.
     */
    @Volatile var contentInsets: ContentInsets = ContentInsets.NONE
        private set

    /** The chrome at rest (no sheet open): what "the whole house" is fitted to. */
    private var restInsets: ContentInsets = ContentInsets.NONE

    /** The home pose last computed; while the camera is still there, a new size or new chrome re-fits it. */
    private var home: OrbitPose? = null

    /** True while a finger turns, pans or zooms the model: the chrome steps back. */
    var manipulating by mutableStateOf(false)
        private set

    /** The aspect fits use: the free rectangle's, so the fitted house lands between the chrome whole. */
    private val fitAspect: Double get() = ContentFrame.fitAspect(viewportWidthPx, viewportHeightPx, restInsets)

    /** The free rectangle's spans, for the box fits of the whole house. */
    private val fitSpan: OrbitCamera.FitSpan get() = ContentFrame.fitSpan(viewportWidthPx, viewportHeightPx, restInsets)

    private var animation: Animation? = null
    private var lastTapAtMs = 0L
    private var lastTapObjectId: String? = null

    private class Animation(val from: OrbitPose, val to: OrbitPose, val startedAtMs: Long)

    val scene: ModelScene? get() = (screen as? ScreenState.Ready)?.scene

    val selected get() = scene?.objectById(viewer.selectedObjectId)

    /** The house the owner had open, kept across process death and cold starts (cycle 3, H-03). */
    private val prefs = application.getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE)

    init {
        val last = prefs.getString(KEY_LAST_OPEN, null)
        (scenes.firstOrNull { it.key == last } ?: scenes.firstOrNull())?.let { open(it) }
            ?: run { screen = ScreenState.Failed("no scene bundles in this build", null) }
    }

    /**
     * Re-read the scene list (an analysis was downloaded or deleted). If the
     * open scene was a downloaded one that is gone now, fall back to the
     * first scene rather than keep showing something the list no longer has.
     */
    fun refreshScenes() {
        scenes = entries()
        val openKey = scene?.key ?: return
        if (scenes.none { it.key == openKey }) scenes.firstOrNull()?.let { open(it) }
    }

    /** Open the scene with this key, if the list has it. */
    fun openKey(key: String): Boolean {
        val entry = scenes.firstOrNull { it.key == key } ?: return false
        open(entry)
        return true
    }

    /**
     * Open a scene. Reading, hashing and parsing a bundle takes the main thread
     * long enough to freeze a frame, so it runs on a background thread while
     * the screens say "Wczytywanie"; a later open replaces an unfinished one.
     */
    fun open(entry: SceneEntry) {
        loading?.cancel()
        screen = ScreenState.Loading
        loading = viewModelScope.launch {
            val result = withContext(Dispatchers.Default) { repository.load(entry) }
            show(result, entry)
        }
    }

    private var loading: Job? = null

    private fun entries(): List<SceneEntry> =
        repository.entries().let { all -> if (hidingBundled) all.filter { it.source == com.buildplan.preview.scene.SceneSourceKind.DOWNLOADED } else all }

    private fun show(result: SceneLoadResult, entry: SceneEntry) {
        when (result) {
            is SceneLoadResult.Failed -> screen = ScreenState.Failed(result.message, result.problem, entry)
            is SceneLoadResult.Ok -> {
                val model = result.scene
                prefs.edit().putString(KEY_LAST_OPEN, entry.key).apply()
                camera = OrbitCamera(model.bounds)
                pose = camera.home(fitSpan).also { home = it }
                // Selection, isolation and layers name objects of the old
                // model and start over; the style and the presentation mode
                // are how the viewer draws, not part of the model, so they
                // carry across a model switch.
                viewer = ViewerState(style = viewer.style, presentation = viewer.presentation)
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

    /** A camera gesture is under way, or has ended (every finger lifted). */
    fun onManipulating(active: Boolean) {
        if (manipulating != active) manipulating = active
    }

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
        moveTo(camera.home(fitSpan).also { home = it }, nowMs)
    }

    /** The viewport's size in pixels, from its layout. */
    fun onViewportSize(width: Int, height: Int) {
        if (width == viewportWidthPx && height == viewportHeightPx) return
        viewportWidthPx = width
        viewportHeightPx = height
        refitHome()
    }

    /**
     * The chrome's footprint on the viewport: [rest] is the chrome at rest,
     * which "the whole house" is fitted to; [drawn] is what the renderer
     * frames into now — the same, or with an open sheet's height at the
     * bottom so the element asked about stays in view above it.
     */
    fun onChromeInsets(rest: ContentInsets, drawn: ContentInsets = rest) {
        contentInsets = drawn
        if (rest == restInsets) return
        restInsets = rest
        refitHome()
    }

    /** Still at home (never turned, zoomed or framed since): fit home again to the space there is now. */
    private fun refitHome() {
        val at = home ?: return
        if (animation != null || pose != at) return
        pose = camera.home(fitSpan).also { home = it }
    }

    fun applyPreset(preset: ViewPreset, nowMs: Long) {
        val model = scene ?: return
        val target = preset.poseIn(camera, model, poseAt(nowMs), fitAspect, fitSpan) ?: return
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
        moveTo(camera.frame(pose, target.bounds, margin = 1.7, aspect = fitAspect), nowMs)
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
            model.objectById(objectId)?.let { moveTo(camera.frame(pose, it.bounds, margin = 1.7, aspect = fitAspect), nowMs) }
            lastTapObjectId = null
        }
        return isDoubleTap
    }

    /**
     * An element chosen from the list (not tapped on the model): selected and
     * framed, with none of a tap's double-tap meaning.
     */
    fun choose(objectId: String, nowMs: Long) {
        val model = scene ?: return
        if (model.objectById(objectId) == null) return
        viewer = viewer.select(objectId)
        lastTapObjectId = null
        frameSelection(nowMs)
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

    fun setPresentation(mode: PresentationMode) {
        viewer = viewer.withPresentation(mode)
    }

    fun clearSelection() {
        viewer = viewer.clearSelection()
    }

    /**
     * What the construction timeline shows (`progress.ConstructionTimeline`):
     * the objects standing at the stage looked at, or null for the whole
     * design. Only which uploaded objects are in the scene changes — no
     * geometry is uploaded again and the camera does not move.
     */
    fun setConstruction(visible: Set<String>?) {
        if (viewer.construction != visible) viewer = viewer.withConstruction(visible)
    }

    private companion object {
        /** The platform's own double-tap window. */
        const val DOUBLE_TAP_MS = 300L

        /** Where the house last open is remembered (cycle 3, H-03). */
        const val PREFS = "preview"
        const val KEY_LAST_OPEN = "lastOpenKey"
    }
}
