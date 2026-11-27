package com.buildplan.preview.ui

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.PointerEvent
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.LifecycleEventObserver
import com.buildplan.preview.R
import com.buildplan.preview.camera.CameraGestureAction
import com.buildplan.preview.camera.CameraGestureTracker
import com.buildplan.preview.camera.GestureSample
import com.buildplan.preview.camera.TouchPointer
import com.buildplan.preview.render.FilamentCanvas
import com.buildplan.preview.render.PickOutcome
import com.buildplan.preview.scene.ModelScene

/**
 * The 3D viewport: a Filament render surface ([FilamentCanvas]) with the touch
 * model on top of it.
 *
 * The gesture loop is written out rather than assembled from the stock
 * detectors because the difference that matters — one finger orbits, two
 * fingers pan and pinch — is exactly the distinction the stock transform
 * detector throws away. The interpretation itself lives in
 * [CameraGestureTracker], a pure state machine, so that its rules can be unit
 * tested, the rebase when a finger lands or lifts above all. This composable
 * only turns pointer events into samples and hands each resulting action to
 * the view model or the picker.
 */
@Composable
fun Viewport(
    scene: ModelScene,
    model: PreviewViewModel,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current
    val canvas = remember { FilamentCanvas(context, model.renderSurfaceKind) }
    val viewportDescription = stringResource(R.string.viewport_description)
    val a11yLabels = listOf(
        R.string.a11y_turn_left, R.string.a11y_turn_right, R.string.a11y_turn_up, R.string.a11y_turn_down,
        R.string.a11y_zoom_in, R.string.a11y_zoom_out, if (model.fittedHere) R.string.fit_home else R.string.tool_fit, R.string.selection_clear,
    ).map { stringResource(it) }
    val selectedNow = model.viewer.selectedObjectId != null
    val a11yActions = remember(a11yLabels, selectedNow) {
        fun now() = System.currentTimeMillis()
        listOfNotNull(
            CustomAccessibilityAction(a11yLabels[0]) { model.nudge(-A11Y_TURN_DEG, 0.0, 1.0, now()); true },
            CustomAccessibilityAction(a11yLabels[1]) { model.nudge(A11Y_TURN_DEG, 0.0, 1.0, now()); true },
            CustomAccessibilityAction(a11yLabels[2]) { model.nudge(0.0, A11Y_TILT_DEG, 1.0, now()); true },
            CustomAccessibilityAction(a11yLabels[3]) { model.nudge(0.0, -A11Y_TILT_DEG, 1.0, now()); true },
            CustomAccessibilityAction(a11yLabels[4]) { model.nudge(0.0, 0.0, 0.8, now()); true },
            CustomAccessibilityAction(a11yLabels[5]) { model.nudge(0.0, 0.0, 1.25, now()); true },
            CustomAccessibilityAction(a11yLabels[6]) { model.fitOrHome(now()); true },
            if (selectedNow) CustomAccessibilityAction(a11yLabels[7]) { model.clearSelection(); true } else null,
        )
    }
    val lifecycleOwner = LocalLifecycleOwner.current

    // The live canvas's counters, readable by a device test through the view
    // model; cleared again when this viewport leaves the composition.
    DisposableEffect(canvas) {
        model.renderDiagnostics = canvas.diagnostics
        onDispose { if (model.renderDiagnostics === canvas.diagnostics) model.renderDiagnostics = null }
    }

    // Upload geometry once per model, never per frame. Keyed on the scene
    // itself, so opening a different building — or the same one again after a
    // reload — always re-uploads.
    LaunchedEffect(canvas, scene) {
        canvas.modelRenderer.setModel(scene, model.preparedPresentation(scene))
        canvas.requestRender()
        // The house is on the GPU: its entrance can play now, not while it was still loading.
        model.arrive(System.currentTimeMillis())
    }

    // The frame callback outlives the composition that installed it, so it may
    // only read state that is still live: the view model, which is the same
    // instance for the whole screen. The scene is deliberately NOT captured
    // here — the renderer applies viewer state to the model it uploaded, and a
    // callback holding on to the previously opened building would resolve
    // object ids against the wrong model.
    LaunchedEffect(canvas, model) {
        var lastFrameNanos = 0L
        canvas.onFrame = { frameTimeNanos ->
            // Every caller stamps a transition with System.currentTimeMillis():
            // the presets, reset, "frame this", the double tap and the gesture
            // start. The Choreographer's frame time runs on the System.nanoTime()
            // clock instead. Mixing the two froze a transition at its first
            // pose, and the next touch then snapped the camera to the end.
            val nowMs = System.currentTimeMillis()
            // The turn's step, though, is the time between two vsyncs: even steps, free of callback jitter.
            val frameMs = if (lastFrameNanos == 0L) 0L else (frameTimeNanos - lastFrameNanos) / 1_000_000L
            lastFrameNanos = frameTimeNanos
            // The idle turntable moves the pose only while it turns; at rest it changes nothing, so nothing is drawn.
            model.glideStep(nowMs, frameMs)
            val turned = model.turntableStep(nowMs, frameMs)
            // While the house turns by itself, ask the display for 30 Hz (Android 11+): the turn draws at most that.
            canvas.preferSlowFrames(model.isAutoTurning)
            val state = canvas.modelRenderer.setState(model.viewer)
            val camera = canvas.modelRenderer.setCamera(model.camera, model.poseAt(nowMs), model.contentInsets)
            // Drawn only when something on screen changed (APK 1356): an idle house costs no GPU frames. A step of
            // the idle turn asks for one frame only; the next step asks again (round D).
            when {
                state || (camera && !turned) -> FilamentCanvas.SETTLE_FRAMES
                camera -> 1
                else -> 0
            }
        }
    }

    // The system's word on the idle turn (round D): TalkBack's touch exploration and battery saver hold it off.
    DisposableEffect(context, model) {
        val access = context.getSystemService(android.view.accessibility.AccessibilityManager::class.java)
        val power = context.getSystemService(android.os.PowerManager::class.java)
        model.touchExploration = access?.isTouchExplorationEnabled == true
        model.powerSave = power?.isPowerSaveMode == true
        val exploration = android.view.accessibility.AccessibilityManager.TouchExplorationStateChangeListener { on -> model.touchExploration = on }
        access?.addTouchExplorationStateChangeListener(exploration)
        val saver = object : android.content.BroadcastReceiver() {
            override fun onReceive(c: android.content.Context, intent: android.content.Intent) {
                model.powerSave = power?.isPowerSaveMode == true
            }
        }
        val filter = android.content.IntentFilter(android.os.PowerManager.ACTION_POWER_SAVE_MODE_CHANGED)
        androidx.core.content.ContextCompat.registerReceiver(context, saver, filter, androidx.core.content.ContextCompat.RECEIVER_NOT_EXPORTED)
        // A warm phone holds the turn too (Android 10+): the turn is a pleasure, never a load.
        val thermal = if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q && power != null) {
            android.os.PowerManager.OnThermalStatusChangedListener { status -> model.thermalHold = status >= android.os.PowerManager.THERMAL_STATUS_MODERATE }
                .also {
                    model.thermalHold = power.currentThermalStatus >= android.os.PowerManager.THERMAL_STATUS_MODERATE
                    power.addThermalStatusListener(it)
                }
        } else {
            null
        }
        onDispose {
            access?.removeTouchExplorationStateChangeListener(exploration)
            context.unregisterReceiver(saver)
            if (thermal != null && android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) power?.removeThermalStatusListener(thermal)
        }
    }

    DisposableEffect(lifecycleOwner, canvas) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> {
                    canvas.resume()
                    model.onResumed(System.currentTimeMillis())
                }
                Lifecycle.Event.ON_PAUSE -> canvas.pause()
                else -> Unit
            }
        }
        lifecycleOwner.lifecycle.addObserver(observer)
        canvas.resume()
        onDispose {
            lifecycleOwner.lifecycle.removeObserver(observer)
            canvas.destroy()
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .onSizeChanged {
                model.onViewportSize(it.width, it.height)
            }
            .semantics {
                contentDescription = viewportDescription
                // Everything a finger does on the house, as actions TalkBack can offer (round D).
                customActions = a11yActions
            }
            .pointerInput(scene.key) {
                // One tracker per pointer-input session: opening another model
                // restarts this block, so no half-finished gesture carries over.
                val tracker = CameraGestureTracker()
                // The touch that stops the idle turn is only that: it must not also select what it landed on.
                var stopper = false
                var anyDown = false
                // A touch cut off by a new house or a torn-down screen still ends: the house must not wait forever
                // for a finger that will never lift.
                try {
                    awaitPointerEventScope {
                        while (true) {
                            val event = awaitPointerEvent()
                            val down = event.changes.any { it.pressed }
                            if (down && !anyDown) {
                                stopper = model.isTurning
                                model.onTouch(true, System.currentTimeMillis())
                            }
                            val actions = tracker.onSample(event.toGestureSample(size.width, size.height, density))
                            // Consume exactly when the old hand-written loop did:
                            // once the touch is a camera move (a drag past the slop
                            // or a second finger), so nothing around the viewport
                            // claims it. A touch that may be a tap stays unconsumed.
                            if (tracker.isCameraGesture) {
                                event.changes.forEach { if (it.pressed) it.consume() }
                                model.onManipulating(true)
                            }
                            if (event.changes.none { it.pressed }) model.onManipulating(false)
                            for (action in actions) {
                                when (action) {
                                    CameraGestureAction.Began -> model.onGestureStart(System.currentTimeMillis())
                                    is CameraGestureAction.Orbit -> model.orbit(action.dYawDeg, action.dPitchDeg)
                                    // The view model pans in pixels of this same
                                    // viewport and divides by its height again.
                                    is CameraGestureAction.Pan -> model.pan(action.dxPx(size.height), action.dyPx(size.height))
                                    is CameraGestureAction.Zoom -> model.zoomAt(action.distanceFactor, action.x, action.y)
                                    // Both go through the same pick. The view model
                                    // decides "isolate and frame" when two picks
                                    // land on the same object within its window.
                                    is CameraGestureAction.Fling -> model.fling(action.yawDegPerS, action.pitchDegPerS)
                                    is CameraGestureAction.Tap -> if (stopper) tracker.forgetLastTap() else pickAt(canvas, model, action.x, action.y, double = false)
                                    is CameraGestureAction.DoubleTap -> if (!stopper) pickAt(canvas, model, action.x, action.y, double = true)
                                }
                            }
                            if (!down && anyDown) {
                                stopper = false
                                model.onTouch(false, System.currentTimeMillis())
                            }
                            anyDown = down
                        }
                    }
                } finally {
                    if (anyDown) {
                        model.onManipulating(false)
                        model.onTouch(false, System.currentTimeMillis())
                    }
                }
            },
    ) {
        AndroidView(factory = { canvas.view }, modifier = Modifier.fillMaxSize())
    }
}

private fun pickAt(canvas: FilamentCanvas, model: PreviewViewModel, x: Float, y: Float, double: Boolean) {
    canvas.pick(x.toInt(), y.toInt()) { outcome ->
        when (outcome) {
            is PickOutcome.Hit -> model.onPicked(outcome.objectId, System.currentTimeMillis())
            PickOutcome.Empty -> {
                model.onPicked(null, System.currentTimeMillis())
                // A double tap beside the house is "Dopasuj" (round D): the quickest way back when lost.
                if (double) model.fitOrHome(System.currentTimeMillis())
            }
            PickOutcome.Unchanged -> Unit
        }
    }
}

/**
 * Compose only translates here. Pointer ids, positions and pressed state go in
 * as they are, and the tracker does all the interpretation.
 */
private fun PointerEvent.toGestureSample(widthPx: Int, heightPx: Int, density: Float): GestureSample {
    if (isSystemCancel()) return GestureSample.Cancel
    return GestureSample.Frame(
        pointers = changes.map { TouchPointer(it.id.value, it.position.x, it.position.y, it.pressed) },
        timeMs = changes.firstOrNull()?.uptimeMillis ?: 0L,
        widthPx = widthPx,
        heightPx = heightPx,
        density = density,
    )
}

/**
 * Compose has no cancel event type. When the system cancels the touch stream,
 * it releases every pointer at once and marks those releases as already
 * consumed. A real lift of the last finger is a single release that nobody
 * consumed. Treating the cancel as a release would let it end in a tap and
 * select whatever was under the finger.
 */
private fun PointerEvent.isSystemCancel(): Boolean {
    if (changes.any { it.pressed }) return false
    val released = changes.filter { it.previousPressed }
    return released.isNotEmpty() && released.all { it.isConsumed }
}

/** TalkBack's turn and tilt steps on the 3D view. */
private const val A11Y_TURN_DEG = 45.0
private const val A11Y_TILT_DEG = 15.0
