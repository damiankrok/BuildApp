package com.buildplan.preview.ui

import android.app.Application
import androidx.compose.runtime.derivedStateOf
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

    /**
     * MARCOWKI-UI: the one house a clean start opens — the scene the exporter marked as the showcase — or null in a
     * build without one (then the first scene, as before).
     */
    val showcase: SceneEntry? get() = scenes.firstOrNull { it.showcase }

    /**
     * The houses of ordinary use, for the house menu: the showcase, then the analyses made on this phone. The scenes
     * shipped for development and review are not among them; they are listed apart, in [developmentScenes].
     */
    val houses: List<SceneEntry> get() = scenes.filter { !it.isDevelopment }

    /** The developer gallery: every scene shipped for development and review, in the exporter's order (MARCOWKI-UI). */
    val developmentScenes: List<SceneEntry> get() = scenes.filter { it.isDevelopment }

    /** Hide the scenes shipped in the APK (a launch extra for evidence of the no-house state), and show what is left. */
    fun hideBundled() {
        if (hidingBundled) return
        hidingBundled = true
        scenes = entries()
        loading?.cancel()
        scenes.firstOrNull()?.let { open(it, chosen = false) } ?: run { screen = ScreenState.Failed("no scene bundles in this build", null) }
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
    private var home by mutableStateOf<OrbitPose?>(null)

    /** True while a finger turns, pans or zooms the model: the chrome steps back. */
    var manipulating by mutableStateOf(false)
        private set

    /**
     * The named view the camera stands at now — or is moving to — for the Widok row; null once the
     * camera was turned by hand or framed on an element, so the row never names a view that is not
     * on screen. Zoom and pan keep the direction, so they keep the name.
     */
    var shownView: ViewPreset? by mutableStateOf(ViewPreset.WHOLE)
        private set

    /** The aspect fits use: the free rectangle's, so the fitted house lands between the chrome whole. */
    private val fitAspect: Double get() = ContentFrame.fitAspect(viewportWidthPx, viewportHeightPx, restInsets)

    /** The free rectangle's spans, for the box fits of the whole house. */
    private val fitSpan: OrbitCamera.FitSpan get() = ContentFrame.fitSpan(viewportWidthPx, viewportHeightPx, restInsets)

    private var animation: Animation? = null
    private var lastTapAtMs = 0L
    private var lastTapObjectId: String? = null

    private class Animation(val from: OrbitPose, val to: OrbitPose, val startedAtMs: Long, val durationMs: Long = PoseAnimation.durationFor(from, to))

    val scene: ModelScene? get() = (screen as? ScreenState.Ready)?.scene

    val selected get() = scene?.objectById(viewer.selectedObjectId)

    /** The house the owner had open, kept across process death and cold starts (cycle 3, H-03). */
    private val prefs = application.getSharedPreferences(PREFS, android.content.Context.MODE_PRIVATE)

    init {
        viewer = viewer.copy(grid = prefs.getBoolean(KEY_GRID, false))
        (StartChoice.of(scenes, lastChosen()))?.let { open(it, chosen = false) }
            ?: run { screen = ScreenState.Failed("no scene bundles in this build", null) }
    }

    /** The house last chosen, while the list still has it. */
    private fun lastChosenIfListed(): String? = prefs.getString(KEY_LAST_CHOSEN, null)?.takeIf { key -> scenes.any { it.key == key } }

    /**
     * The house the owner last CHOSE (MARCOWKI-UI). Up to APK 1354 the app remembered every house it opened, its own
     * automatic first one included, so an untouched install remembers the first scene of that build's list — an
     * experimental model the owner never picked. That older record is trusted only when it names an analysis made on
     * this phone, which the owner necessarily chose; any other is dropped, and the showcase opens instead.
     */
    private fun lastChosen(): String? {
        prefs.getString(KEY_LAST_CHOSEN, null)?.let { return it }
        val legacy = prefs.getString(KEY_LAST_OPEN_LEGACY, null) ?: return null
        val kept = legacy.takeIf { key -> scenes.any { it.key == key && it.source == com.buildplan.preview.scene.SceneSourceKind.DOWNLOADED } }
        prefs.edit().remove(KEY_LAST_OPEN_LEGACY).apply { if (kept != null) putString(KEY_LAST_CHOSEN, kept) }.apply()
        return kept
    }

    /**
     * Re-read the scene list (an analysis was downloaded or deleted). If the
     * open scene was a downloaded one that is gone now, fall back to the
     * first scene rather than keep showing something the list no longer has.
     */
    fun refreshScenes() {
        scenes = entries()
        // The house on screen — open, or failed to open — that the list no longer has (deleted): the start rule again.
        val openKey = scene?.key ?: (screen as? ScreenState.Failed)?.entry?.key ?: return
        if (scenes.none { it.key == openKey }) StartChoice.of(scenes, lastChosenIfListed())?.let { open(it, chosen = false) }
    }

    /** Open the scene with this key, if the list has it: the owner's choice, remembered for the next start. */
    fun openKey(key: String): Boolean {
        val entry = scenes.firstOrNull { it.key == key } ?: return false
        open(entry, chosen = true)
        return true
    }

    /**
     * Open a scene. Reading, hashing and parsing a bundle takes the main thread
     * long enough to freeze a frame, so it runs on a background thread while
     * the screens say "Wczytywanie"; a later open replaces an unfinished one.
     */
    fun open(entry: SceneEntry, chosen: Boolean = true) {
        loading?.cancel()
        screen = ScreenState.Loading
        loading = viewModelScope.launch {
            val result = withContext(Dispatchers.Default) {
                repository.load(entry).also { loaded ->
                    // The presentation (feature edges, roof covers) is derived from the scene alone: here, off the main
                    // thread, so the first frame of a heavy house does not wait for it (MARCOWKI-UI audit PERF-01).
                    prepared = (loaded as? SceneLoadResult.Ok)?.scene?.let { it to com.buildplan.preview.presentation.ScenePresentation.of(it) }
                }
            }
            show(result, entry, chosen)
        }
    }

    /** The presentation derived while [ModelScene] was loading, for that very scene, or null (then the renderer derives it). */
    @Volatile private var prepared: Pair<ModelScene, com.buildplan.preview.presentation.ScenePresentation>? = null

    fun preparedPresentation(scene: ModelScene): com.buildplan.preview.presentation.ScenePresentation? =
        prepared?.takeIf { it.first === scene }?.second

    private var loading: Job? = null

    private fun entries(): List<SceneEntry> =
        repository.entries().let { all -> if (hidingBundled) all.filter { it.source == com.buildplan.preview.scene.SceneSourceKind.DOWNLOADED } else all }

    private fun show(result: SceneLoadResult, entry: SceneEntry, chosen: Boolean) {
        when (result) {
            is SceneLoadResult.Failed -> screen = ScreenState.Failed(result.message, result.problem, entry)
            is SceneLoadResult.Ok -> {
                val model = result.scene
                // Only a house the owner chose is remembered: the app's own pick at start is not a choice (MARCOWKI-UI).
                if (chosen) prefs.edit().putString(KEY_LAST_CHOSEN, entry.key).apply()
                framePoints = model.objects.filter { it.hasGeometry && !it.bounds.isEmpty }.flatMap { it.bounds.corners() }
                camera = OrbitCamera(model.bounds, hull = framePoints)
                pose = camera.home(fitSpan).also { home = it }
                lastFit = null
                turning = false
                gliding = false
                fingerDown = false
                lastInteractionMs = System.currentTimeMillis()
                fitted = null
                // Selection, isolation and layers name objects of the old
                // model and start over; the style and the presentation mode
                // are how the viewer draws, not part of the model, so they
                // carry across a model switch.
                viewer = ViewerState(style = viewer.style, presentation = viewer.presentation, grid = viewer.grid)
                shownView = ViewPreset.WHOLE
                animation = null
                screen = ScreenState.Ready(model)
                // SHAPE-LIVE-01: a reading's "show in the model" opened this scene to select that element
                pendingSelection?.let { id -> if (model.objectById(id) != null) choose(id, System.currentTimeMillis()) }
                pendingSelection = null
            }
        }
    }

    /** The element a source reading asked to be shown, selected once its scene is open (SHAPE-LIVE-01). */
    private var pendingSelection: String? = null

    /**
     * Open the scene with this key and select `objectId` in it — from a reading's link to the element it went into.
     * The house already open is not reloaded; the selection is then made at once. False when no such scene is listed.
     */
    fun openKeyAndSelect(key: String, objectId: String): Boolean {
        if (scene?.key == key) {
            choose(objectId, System.currentTimeMillis())
            return true
        }
        pendingSelection = objectId
        return openKey(key).also { if (!it) pendingSelection = null }
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
        val t = (nowMs - running.startedAtMs).toDouble() / running.durationMs
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

    fun onGestureStart(nowMs: Long) {
        interrupt(nowMs)
        noteInteraction(nowMs)
    }

    /** A camera gesture is under way, or has ended (every finger lifted). */
    fun onManipulating(active: Boolean) {
        if (active) noteInteraction(System.currentTimeMillis())
        if (manipulating != active) manipulating = active
    }

    fun orbit(deltaYawDeg: Double, deltaPitchDeg: Double) {
        val next = camera.orbit(pose, deltaYawDeg, deltaPitchDeg)
        // Turned by hand, the camera no longer stands at any named view: the Widok row says so.
        if (next.yawDeg != pose.yawDeg || next.pitchDeg != pose.pitchDeg) shownView = null
        pose = next
    }

    // The glide after a flick (round D, [com.buildplan.preview.camera.OrbitInertia]).
    private var glideYaw = 0.0
    private var glidePitch = 0.0
    private var gliding = false

    /** A one-finger turn was released while moving: the house glides on and comes to rest (never with animations off). */
    fun fling(yawDegPerS: Double, pitchDegPerS: Double) {
        if (reducedMotion) return
        val start = com.buildplan.preview.camera.OrbitInertia.start(yawDegPerS, pitchDegPerS) ?: return
        glideYaw = start.first
        glidePitch = start.second
        gliding = true
    }

    /** Advance the glide by one frame; true when the camera moved. When it stops, the idle clock starts from there. */
    fun glideStep(nowMs: Long, frameMs: Long): Boolean {
        if (!gliding) return false
        if (manipulating || fingerDown || animation != null) {
            gliding = false
            return false
        }
        if (frameMs <= 0) return false
        val dt = frameMs.coerceAtMost(com.buildplan.preview.camera.Turntable.MAX_FRAME_MS).toDouble()
        val before = pose
        orbit(com.buildplan.preview.camera.OrbitInertia.travel(glideYaw, dt), com.buildplan.preview.camera.OrbitInertia.travel(glidePitch, dt))
        glideYaw = com.buildplan.preview.camera.OrbitInertia.decay(glideYaw, dt)
        // At the pitch limit the vertical part has nowhere to go.
        glidePitch = if (pose.pitchDeg == before.pitchDeg) 0.0 else com.buildplan.preview.camera.OrbitInertia.decay(glidePitch, dt)
        if (com.buildplan.preview.camera.OrbitInertia.stopped(glideYaw, glidePitch)) {
            gliding = false
            noteInteraction(nowMs)
        }
        return pose != before
    }

    /**
     * A step of the camera asked for without a gesture (TalkBack's actions on the 3D view, round D): turned by
     * [dYawDeg] / [dPitchDeg] and zoomed by [factor], animated like a preset (a cut with animations off).
     */
    fun nudge(dYawDeg: Double, dPitchDeg: Double, factor: Double, nowMs: Long) {
        noteInteraction(nowMs)
        val from = poseAt(nowMs)
        val target = camera.zoom(camera.orbit(from, dYawDeg, dPitchDeg), factor)
        if (target.yawDeg != from.yawDeg || target.pitchDeg != from.pitchDeg) shownView = null
        moveTo(target, nowMs)
    }

    /** A pinch about the point between the fingers ([x], [y], viewport pixels). */
    fun zoomAt(factor: Double, x: Float, y: Float) {
        if (x.isNaN() || y.isNaN()) return zoom(factor)
        val frame = ContentFrame.of(viewportWidthPx, viewportHeightPx, contentInsets)
        val centreX = viewportWidthPx / 2.0 * (1.0 + frame.shiftX)
        val centreY = viewportHeightPx / 2.0 * (1.0 - frame.shiftY)
        pose = camera.zoomAt(pose, factor, x - centreX, y - centreY, frame.scale, viewportHeightPx)
    }

    fun zoom(factor: Double) {
        pose = camera.zoom(pose, factor)
    }

    fun pan(dxPx: Double, dyPx: Double) {
        pose = camera.pan(pose, dxPx, dyPx, viewportHeightPx)
    }

    private fun moveTo(target: OrbitPose, nowMs: Long, durationMs: Long? = null) {
        gliding = false
        if (reducedMotion) {
            animation = null
            pose = target
        } else {
            val from = poseAt(nowMs)
            animation = Animation(from, target, nowMs, durationMs ?: PoseAnimation.durationFor(from, target))
        }
    }

    // -----------------------------------------------------------------------
    // Round D: "Dopasuj" in two stages, the idle turntable, the arrival shot
    // -----------------------------------------------------------------------

    /** The corners of every object's box: what "the whole house" is fitted by, and what the turntable keeps in view. */
    private var framePoints: List<com.buildplan.preview.math.Vec3> = emptyList()

    /** The pose the last "Dopasuj" fitted, while the camera still stands there. */
    private var lastFit by mutableStateOf<OrbitPose?>(null)

    /**
     * True while the camera stands where "Dopasuj" put it: the next tap goes home instead. Standing at home is not
     * "fitted" — there the button says "Dopasuj" and fits (a no-op at home itself), never "go home" to where it is.
     * Derived, so the header recomposes when the answer flips, not on every frame the camera moves (round D).
     */
    val fittedHere: Boolean by derivedStateOf { pose == lastFit }

    /**
     * "Dopasuj", two-stage like a map's location button: the first tap fits the whole house at the current
     * angle (and shows everything again while one element is isolated); once fitted, the next tap brings back
     * the whole-house perspective. There is always a one-tap way home.
     */
    fun fitOrHome(nowMs: Long) {
        if (viewer.isIsolating) viewer = viewer.showAll()
        if (fittedHere && animation == null) {
            // Back to the whole house: every layer, from the home angle.
            scene?.let { viewer = viewer.withVisibility(it, VisibilityMode.ALL) }
            applyPreset(ViewPreset.WHOLE, nowMs)
            lastFit = null
        } else {
            val part = visiblePart()
            if (part == null) applyPreset(ViewPreset.FIT, nowMs) else fitPart(part, nowMs)
            lastFit = animation?.to ?: pose
        }
    }

    /**
     * The box of what is shown when it is not the whole house ("Parter", "Bez dachu", a stage preview), or null
     * when everything is shown — or nothing is, and the whole house is the only sensible frame (round D).
     */
    private fun visiblePart(): com.buildplan.preview.math.Bounds? {
        val model = scene ?: return null
        val shown = viewer.visibleObjectIds(model)
        val solid = model.objects.filter { it.hasGeometry && !it.bounds.isEmpty }
        val visible = solid.filter { it.id in shown }
        if (visible.isEmpty() || visible.size == solid.size) return null
        return visible.map { it.bounds }.reduce { a, b -> a.union(b) }.takeUnless { it == model.bounds || it.isEmpty }
    }

    /** "Dopasuj" with part of the house hidden: what is shown fills the free space, at the current angle. */
    private fun fitPart(part: com.buildplan.preview.math.Bounds, nowMs: Long) {
        noteInteraction(nowMs)
        val from = poseAt(nowMs)
        val target = if (from.projection == com.buildplan.preview.camera.Projection.ORTHOGRAPHIC) {
            camera.frameBoxOrthographic(from, part, from.yawDeg, from.pitchDeg, fitSpan)
        } else {
            camera.frameBox(from, part, from.yawDeg, from.pitchDeg, fitSpan)
        }
        fitted = null
        moveTo(target, nowMs)
    }

    /** Taps on the model, counted: the workspace closes an open panel when the house is touched. */
    var taps by mutableStateOf(0)
        private set

    /** The idle turntable (round D): the house turns slowly by itself while nobody touches it. Off unless chosen. */
    var turntableOn by mutableStateOf(prefs.getBoolean(KEY_TURNTABLE, false))
        private set

    /** Set by the workspace while a panel, a sheet or an element's details are open: the house holds still then. */
    var turntablePaused: Boolean = false
        set(value) {
            if (field == value) return
            field = value
            gateChanged(System.currentTimeMillis())
        }

    /** Set by the ⋮ menu while it is open: the house holds still under it too (round D). */
    var menuOpen: Boolean = false
        set(value) {
            if (field == value) return
            field = value
            gateChanged(System.currentTimeMillis())
        }

    /**
     * Set from the system: TalkBack's touch exploration (a turning house would move under the finger that is
     * exploring it) and battery saver. Either holds the turntable off; the menu row says why.
     */
    var touchExploration by mutableStateOf(false)
    var powerSave by mutableStateOf(false)

    /** Why the turntable cannot run now although it is chosen, or null when it can (or is not chosen). */
    val turntableHeldBy: TurntableHold?
        get() = when {
            !turntableOn -> null
            reducedMotion -> TurntableHold.ANIMATIONS_OFF
            touchExploration -> TurntableHold.TALKBACK
            powerSave -> TurntableHold.POWER_SAVE
            thermalHold -> TurntableHold.THERMAL
            pose.projection != com.buildplan.preview.camera.Projection.PERSPECTIVE -> TurntableHold.PARALLEL_VIEW
            // Chosen, nothing in the way, but the camera is on a close-up the owner picked: it waits for the whole house.
            !turning && !showsWholeHouse() -> TurntableHold.CLOSE_UP
            else -> null
        }

    private var lastInteractionMs = 0L
    private var turning = false
    private var turnElapsedMs = 0L
    /** When the turn proper began (after its settle): its own clock. */
    private var turnStartMs = 0L
    /** A finger rests on the house (not yet a camera gesture): it holds still under it. */
    private var fingerDown = false
    /** Just switched on: start soon after the menu closes, so the owner sees what the switch did. */
    private var kickoffPending = false

    /** True while the house is turning by itself or gliding after a flick: the touch that stops it must not also select. */
    val isTurning: Boolean get() = (turning && !turnFinished) || gliding

    /** True while the house turns by itself (not a glide): the display may drop to the turn's own frame rate. */
    val isAutoTurning: Boolean get() = turning && !turnFinished

    /** The longest run has eased out: the house stands still until the next touch. */
    private var turnFinished = false

    /**
     * Showroom (round D): after the house has turned on its own for a while, the chrome steps back so the house
     * is the whole picture. The first touch (anything that counts as an interaction) brings it back.
     */
    var showroom by mutableStateOf(false)
        private set

    fun setTurntable(on: Boolean) {
        if (turntableOn == on) return
        turntableOn = on
        prefs.edit().putBoolean(KEY_TURNTABLE, on).apply()
        noteInteraction(System.currentTimeMillis())
        kickoffPending = on
    }

    /** The turntable's own settle move, while it runs: anything that stops the turn stops it where it is. */
    private var settle: Animation? = null

    /** The device is warm (thermal status moderate or worse): the house holds still. */
    var thermalHold by mutableStateOf(false)

    /** Nothing stands at the previewed stage: there is nothing to turn. */
    private val nothingShown: Boolean
        get() {
            val model = scene ?: return true
            val state = viewer
            // Asked every frame while the turntable is on: answered once per viewer state.
            if (state !== shownFor) {
                shownFor = state
                shownEmpty = state.visibleObjectIds(model).isEmpty()
            }
            return shownEmpty
        }
    private var shownFor: ViewerState? = null
    private var shownEmpty = false

    /** Ends a turn (and its showroom) without counting as a touch: the idle clock starts again from now. */
    private fun stopTurn(nowMs: Long) = noteInteraction(nowMs)

    /** Anything that moves or asks about the camera restarts the idle clock and stops a turn at once. */
    private fun noteInteraction(nowMs: Long) {
        settle?.let { s ->
            // Stopped mid-settle: the camera stays where it got to, it does not finish the move under a panel.
            if (animation === s) {
                pose = poseAt(nowMs)
                animation = null
            }
            settle = null
        }
        lastInteractionMs = nowMs
        turning = false
        turnFinished = false
        turnElapsedMs = 0L
        kickoffPending = false
        if (showroom) showroom = false
    }

    /** Something opened or closed over the house. Once all is closed after the switch was turned on, it starts soon. */
    private fun gateChanged(nowMs: Long) {
        val kickoff = kickoffPending
        noteInteraction(nowMs)
        if (kickoff && !turntablePaused && !menuOpen) {
            lastInteractionMs = nowMs - com.buildplan.preview.camera.Turntable.IDLE_BEFORE_MS + KICKOFF_MS
        } else {
            kickoffPending = kickoff
        }
    }

    /** A touch on the showroom's veil: the chrome comes back, the turn stops; nothing else happens. */
    fun wake(nowMs: Long) = noteInteraction(nowMs)

    /** A finger came down on the house (true) or the last one lifted (false). */
    fun onTouch(down: Boolean, nowMs: Long) {
        fingerDown = down
        if (down) gliding = false
        noteInteraction(nowMs)
    }

    /** The app came back to the front: the idle clock starts again, so the house does not jump straight into a turn. */
    fun onResumed(nowMs: Long) {
        // Nothing carries over a stay in the background: no frozen glide, no finger that never lifted.
        gliding = false
        fingerDown = false
        noteInteraction(nowMs)
    }

    /**
     * Whether the camera shows the whole house, as home or "Dopasuj" leave it: the only view the turntable starts
     * from. A close-up, a pan, an isolated or a selected element is something the owner chose to look at; turning
     * it away (and pulling the camera back to fit the whole house) would take it from them (round D).
     */
    private fun showsWholeHouse(): Boolean {
        if (viewer.selectedObjectId != null || viewer.isIsolating) return false
        if (pose.pan.length >= WHOLE_HOUSE_PAN_SHARE * camera.sceneBounds.radius) return false
        val homeDistance = home?.distance ?: return true
        return pose.distance >= WHOLE_HOUSE_DISTANCE_SHARE * homeDistance
    }

    /**
     * Advance the turntable by one frame; true when the camera moved (so the frame is drawn — and only then:
     * an idle house with the turntable off draws nothing). It turns only in a perspective view, never while a
     * finger is down, a camera move runs, something is open over the house, or the system's animations are off.
     * Its first step settles the camera where the whole house stays in view at every angle; then it eases in.
     */
    fun turntableStep(nowMs: Long, frameMs: Long): Boolean {
        val held = !turntableOn || reducedMotion || touchExploration || powerSave || thermalHold ||
            turntablePaused || menuOpen || fingerDown || manipulating || gliding || nothingShown
        if (held) {
            // Every way out of a turn ends it the same way: no turn left behind, the chrome back (round D). While
            // held, the idle clock does not run: the 5 s wait starts when the last hold lifts.
            if (turning || showroom) stopTurn(nowMs) else lastInteractionMs = nowMs
            return false
        }
        if (animation != null) return false
        if (pose.projection != com.buildplan.preview.camera.Projection.PERSPECTIVE || framePoints.isEmpty()) return false
        // The camera on a close-up the owner picked: the idle clock waits for the whole house, it does not run.
        if (!turning && !showsWholeHouse()) {
            lastInteractionMs = nowMs
            return false
        }
        val idle = nowMs - lastInteractionMs
        if (!com.buildplan.preview.camera.Turntable.started(idle)) return false
        if (!turning) {
            turning = true
            val stand = com.buildplan.preview.camera.Turntable.pose(camera, framePoints, pose, fitSpan)
            // The turn's own clock: its ease in, the showroom and the 5-minute cap count from here, however late
            // the turn could start.
            turnStartMs = if (stand != pose) nowMs + TURNTABLE_SETTLE_MS else nowMs
            if (stand != pose) {
                animation = Animation(pose, stand, nowMs, TURNTABLE_SETTLE_MS).also { settle = it }
                return true
            }
        }
        val turned = com.buildplan.preview.camera.Turntable.IDLE_BEFORE_MS + (nowMs - turnStartMs)
        // A slow turn is drawn at most every TURN_FRAME_MS (≈ 30 a second): 0.2° a frame is still smooth, and
        // a phone left on the table showing its house does not draw at the display's full rate (round D).
        turnElapsedMs += frameMs
        if (turnElapsedMs < TURN_FRAME_MS) return false
        val elapsed = turnElapsedMs
        turnElapsedMs = 0L
        val step = com.buildplan.preview.camera.Turntable.yawStep(turned, elapsed)
        if (step <= 0.0) {
            // Eased out after its longest run: the chrome comes back; the next touch starts the clock again.
            if (com.buildplan.preview.camera.Turntable.finished(turned)) {
                turnFinished = true
                if (showroom) showroom = false
            }
            return false
        }
        if (!showroom && nowMs - turnStartMs >= SHOWROOM_AFTER_MS) showroom = true
        // Turned by the turntable, the view keeps its name: it is still the whole house in perspective.
        pose = camera.orbit(pose, step, 0.0)
        return true
    }

    /** Houses that have made their entrance in this process: the arrival shot plays once per house. */
    private val arrived = HashSet<String>()

    /**
     * The arrival shot (round D): the first time a house is shown in this process, the camera eases into the
     * home view from a little higher, farther and turned — 900 ms, decelerating. Skipped with animations off,
     * and any touch takes over at once.
     */
    fun arrive(nowMs: Long) {
        val model = scene ?: return
        if (reducedMotion || !arrived.add(model.key)) return
        val target = home ?: return
        if (pose != target) return
        pose = camera.clamp(target.copy(yawDeg = target.yawDeg + ARRIVAL_TURN_DEG, pitchDeg = target.pitchDeg + ARRIVAL_RISE_DEG, distance = target.distance * ARRIVAL_DISTANCE))
        animation = Animation(pose, target, nowMs, ARRIVAL_MS)
        lastInteractionMs = nowMs
    }

    /** Whole house / Reset: a predictable camera AND a predictable scene. */
    fun reset(nowMs: Long) {
        val model = scene ?: return
        noteInteraction(nowMs)
        viewer = viewer.showAll().clearSelection()
        fitted = null
        shownView = ViewPreset.WHOLE
        moveTo(camera.home(fitSpan).also { home = it }, nowMs)
    }

    /** The viewport's size in pixels, from its layout. */
    fun onViewportSize(width: Int, height: Int) {
        if (width == viewportWidthPx && height == viewportHeightPx) return
        viewportWidthPx = width
        viewportHeightPx = height
        // A turn in progress was fitted for the old space: it stops, and starts again — eased in — for the new one.
        if (turning) noteInteraction(System.currentTimeMillis())
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
        if (turning) noteInteraction(System.currentTimeMillis())
        refitHome()
    }

    /** Still at home (never turned, zoomed or framed since): fit home again to the space there is now. */
    private fun refitHome() {
        val old = home ?: return
        // The arrival shot (or a move home) still on its way: aim it at the home for the new space. Any other move
        // keeps going; home itself is for the new space either way.
        animation?.let { a ->
            val newHome = camera.home(fitSpan)
            if (a.to == old) animation = Animation(a.from, newHome, a.startedAtMs, a.durationMs)
            home = newHome
            return
        }
        // Home for the new space, always: the turntable and "Dopasuj" compare against it even after the camera moved.
        val newHome = camera.home(fitSpan)
        // A whole-house preset still standing as it was framed (a phone turned with an elevation open) is framed
        // again for the new space, like home: a box fit for a wide window would crop it upright (audit round 2).
        fitted?.let { (preset, at) ->
            val model = scene
            if (pose == at && model != null) {
                preset.poseIn(camera, model, pose, fitAspect, fitSpan)?.let { pose = it; fitted = preset to it }
                home = newHome
                return
            }
        }
        if (pose == old) pose = newHome
        home = newHome
    }

    /** The last whole-house preset and the pose it framed, while the camera still stands there. */
    private var fitted: Pair<ViewPreset, OrbitPose>? = null

    fun applyPreset(preset: ViewPreset, nowMs: Long) {
        val model = scene ?: return
        noteInteraction(nowMs)
        val target = preset.poseIn(camera, model, poseAt(nowMs), fitAspect, fitSpan) ?: return
        preset.visibility?.let { viewer = viewer.withVisibility(model, it) }
        // A focus preset is also an answer to "which one?", so it selects the
        // object it framed — otherwise the inspector would still be empty
        // after asking to look at the stairs.
        preset.objectIdIn(model)?.let { if (viewer.isVisible(model, it)) viewer = viewer.select(it) }
        fitted = if (preset.target == com.buildplan.preview.camera.PresetTarget.WHOLE_MODEL) preset to target else null
        // "Dopasuj" keeps the angle, so it keeps the view's name too; every other preset IS the view now.
        if (!preset.keepsAngles) shownView = preset
        moveTo(target, nowMs)
    }

    fun frameSelection(nowMs: Long) {
        val model = scene ?: return
        val target = model.objectById(viewer.selectedObjectId) ?: return
        shownView = null
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
        taps += 1
        noteInteraction(nowMs)
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
            model.objectById(objectId)?.let {
                shownView = null
                moveTo(camera.frame(pose, it.bounds, margin = 1.7, aspect = fitAspect), nowMs)
            }
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
        // A plan names its layer: another layer makes it a plain view from above, not "Rzut parteru" any more.
        val view = shownView
        if (view?.visibility != null && view.visibility != mode) shownView = null
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

    /** The reference grid under the house (variant C: off unless the owner turns it on), remembered for the next start. */
    fun setGrid(on: Boolean) {
        if (viewer.grid == on) return
        viewer = viewer.copy(grid = on)
        prefs.edit().putBoolean(KEY_GRID, on).apply()
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

        /** Where the house last chosen is remembered (cycle 3, H-03; MARCOWKI-UI: chosen, not merely opened). */
        const val PREFS = "preview"
        const val KEY_LAST_CHOSEN = "lastChosenKey"

        /** Whether the reference grid is laid under the house (variant C). */
        const val KEY_GRID = "referenceGrid"

        /** Whether the house turns slowly by itself while left alone (round D). */
        const val KEY_TURNTABLE = "idleTurntable"

        /** The turntable's first step: the camera settles where the whole house stays in view all the way round. */
        const val TURNTABLE_SETTLE_MS = 700L

        /** How long the house turns on its own before the chrome steps back (showroom). */
        const val SHOWROOM_AFTER_MS = 6_000L

        /** After the switch is turned on and the menu closed, the turn starts this soon. */
        const val KICKOFF_MS = 600L

        /** The idle turn draws a frame at most this often. */
        const val TURN_FRAME_MS = 30L

        /** The turntable starts only from a whole-house view: panned less than this share of the house's radius… */
        const val WHOLE_HOUSE_PAN_SHARE = 0.05

        /** …and no nearer than this share of the home distance. */
        const val WHOLE_HOUSE_DISTANCE_SHARE = 0.85

        /** The arrival shot: from this much turned, risen and farther, over this long. */
        const val ARRIVAL_TURN_DEG = 28.0
        const val ARRIVAL_RISE_DEG = 6.0
        const val ARRIVAL_DISTANCE = 1.12
        const val ARRIVAL_MS = 900L

        /** Up to APK 1354: the house last OPENED, the app's automatic first pick included. Read once, then removed. */
        const val KEY_LAST_OPEN_LEGACY = "lastOpenKey"
    }
}

/**
 * Which house a start opens (MARCOWKI-UI), as a pure rule: the one the owner last chose, while the list still has it;
 * otherwise the showcase; otherwise — a build without a showcase — the first scene listed.
 */
object StartChoice {
    fun of(scenes: List<SceneEntry>, lastChosenKey: String?): SceneEntry? =
        scenes.firstOrNull { it.key == lastChosenKey } ?: scenes.firstOrNull { it.showcase } ?: scenes.firstOrNull()
}

/** Why a chosen turntable is not turning: said in the menu, never only shown by a missing check mark. */
enum class TurntableHold { ANIMATIONS_OFF, TALKBACK, POWER_SAVE, THERMAL, PARALLEL_VIEW, CLOSE_UP }
