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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.LifecycleEventObserver
import com.buildplan.preview.camera.CameraGestureAction
import com.buildplan.preview.camera.CameraGestureTracker
import com.buildplan.preview.camera.GestureSample
import com.buildplan.preview.camera.TouchPointer
import com.buildplan.preview.render.FilamentCanvas
import com.buildplan.preview.render.PickOutcome
import com.buildplan.preview.scene.ModelScene

/**
 * The 3D viewport: a Filament SurfaceView with the touch model on top of it.
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
    val canvas = remember { FilamentCanvas(context) }
    val lifecycleOwner = LocalLifecycleOwner.current

    // Upload geometry once per model, never per frame. Keyed on the scene
    // itself, so opening a different building — or the same one again after a
    // reload — always re-uploads.
    LaunchedEffect(canvas, scene) {
        canvas.modelRenderer.setModel(scene)
    }

    // The frame callback outlives the composition that installed it, so it may
    // only read state that is still live: the view model, which is the same
    // instance for the whole screen. The scene is deliberately NOT captured
    // here — the renderer applies viewer state to the model it uploaded, and a
    // callback holding on to the previously opened building would resolve
    // object ids against the wrong model.
    LaunchedEffect(canvas, model) {
        canvas.onFrame = { _ ->
            // Every caller stamps a transition with System.currentTimeMillis():
            // the presets, reset, "frame this", the double tap and the gesture
            // start. The Choreographer's frame time runs on the System.nanoTime()
            // clock instead. Mixing the two froze a transition at its first
            // pose, and the next touch then snapped the camera to the end.
            val nowMs = System.currentTimeMillis()
            canvas.modelRenderer.setState(model.viewer)
            canvas.modelRenderer.setCamera(model.camera, model.poseAt(nowMs))
        }
    }

    DisposableEffect(lifecycleOwner, canvas) {
        val observer = LifecycleEventObserver { _, event ->
            when (event) {
                Lifecycle.Event.ON_RESUME -> canvas.resume()
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
            .onSizeChanged { model.viewportHeightPx = it.height }
            .semantics { contentDescription = "3D model viewport. Drag with one finger to orbit, pinch to zoom, drag with two fingers to pan, tap an element to select it." }
            .pointerInput(scene.key) {
                // One tracker per pointer-input session: opening another model
                // restarts this block, so no half-finished gesture carries over.
                val tracker = CameraGestureTracker()
                awaitPointerEventScope {
                    while (true) {
                        val event = awaitPointerEvent()
                        val actions = tracker.onSample(event.toGestureSample(size.width, size.height, density))
                        // Consume exactly when the old hand-written loop did:
                        // once the touch is a camera move (a drag past the slop
                        // or a second finger), so nothing around the viewport
                        // claims it. A touch that may be a tap stays unconsumed.
                        if (tracker.isCameraGesture) event.changes.forEach { if (it.pressed) it.consume() }
                        for (action in actions) {
                            when (action) {
                                CameraGestureAction.Began -> model.onGestureStart(System.currentTimeMillis())
                                is CameraGestureAction.Orbit -> model.orbit(action.dYawDeg, action.dPitchDeg)
                                // The view model pans in pixels of this same
                                // viewport and divides by its height again.
                                is CameraGestureAction.Pan -> model.pan(action.dxPx(size.height), action.dyPx(size.height))
                                is CameraGestureAction.Zoom -> model.zoom(action.distanceFactor)
                                // Both go through the same pick. The view model
                                // decides "isolate and frame" when two picks
                                // land on the same object within its window.
                                is CameraGestureAction.Tap -> pickAt(canvas, model, action.x, action.y)
                                is CameraGestureAction.DoubleTap -> pickAt(canvas, model, action.x, action.y)
                            }
                        }
                    }
                }
            },
    ) {
        AndroidView(factory = { canvas.surfaceView }, modifier = Modifier.fillMaxSize())
    }
}

private fun pickAt(canvas: FilamentCanvas, model: PreviewViewModel, x: Float, y: Float) {
    canvas.pick(x.toInt(), y.toInt()) { outcome ->
        when (outcome) {
            is PickOutcome.Hit -> model.onPicked(outcome.objectId, System.currentTimeMillis())
            PickOutcome.Empty -> model.onPicked(null, System.currentTimeMillis())
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
