package com.buildplan.preview.ui

import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.pointer.PointerInputChange
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.onSizeChanged
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.lifecycle.LifecycleEventObserver
import com.buildplan.preview.render.FilamentCanvas
import com.buildplan.preview.render.PickOutcome
import com.buildplan.preview.scene.ModelScene
import kotlin.math.abs
import kotlin.math.hypot

/**
 * The 3D viewport: a Filament SurfaceView with the touch model on top of it.
 *
 * The gesture loop is written out rather than assembled from the stock
 * detectors because the difference that matters — one finger orbits, two
 * fingers pan and pinch — is exactly the distinction the stock transform
 * detector throws away.
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

    // Upload geometry once per model, never per frame.
    LaunchedEffect(canvas, scene.key) {
        canvas.modelRenderer.setModel(scene)
    }

    LaunchedEffect(canvas, model) {
        canvas.onFrame = { frameTimeNanos ->
            val nowMs = frameTimeNanos / 1_000_000
            canvas.modelRenderer.setState(scene, model.viewer)
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
                val slop = viewConfiguration.touchSlop
                awaitEachGesture {
                    val first = awaitFirstDown(requireUnconsumed = false)
                    val startMs = System.currentTimeMillis()
                    model.onGestureStart(startMs)

                    var maxPointers = 1
                    var travelled = 0f
                    var previousCentroid = first.position
                    var previousSpread = 0f
                    var dragging = false

                    while (true) {
                        val event = awaitPointerEvent()
                        val active = event.changes.filter { it.pressed }
                        if (active.isEmpty()) break
                        maxPointers = maxOf(maxPointers, active.size)

                        val centroid = centroidOf(active)
                        val spread = spreadOf(active, centroid)
                        val delta = centroid - previousCentroid

                        if (active.size == 1) {
                            travelled += delta.getDistance()
                            if (dragging || travelled > slop) {
                                dragging = true
                                // Half a screen width is a half turn: enough
                                // control to line up a facade, quick enough to
                                // get round the house in one drag.
                                model.orbit(
                                    deltaYawDeg = -delta.x.toDouble() * ORBIT_DEGREES_PER_PX,
                                    deltaPitchDeg = delta.y.toDouble() * ORBIT_DEGREES_PER_PX,
                                )
                                active.forEach { it.consume() }
                            }
                        } else {
                            dragging = true
                            travelled += delta.getDistance() + abs(spread - previousSpread)
                            if (previousSpread > MIN_SPREAD_PX && spread > MIN_SPREAD_PX) {
                                model.zoom((previousSpread / spread).toDouble())
                            }
                            model.pan(delta.x.toDouble(), delta.y.toDouble())
                            active.forEach { it.consume() }
                        }

                        previousCentroid = centroid
                        previousSpread = spread
                    }

                    // A tap: one finger, never dragged.
                    if (maxPointers == 1 && travelled <= slop) {
                        val p = first.position
                        canvas.pick(p.x.toInt(), p.y.toInt()) { outcome ->
                            when (outcome) {
                                is PickOutcome.Hit -> model.onPicked(outcome.objectId, System.currentTimeMillis())
                                PickOutcome.Empty -> model.onPicked(null, System.currentTimeMillis())
                                PickOutcome.Unchanged -> Unit
                            }
                        }
                    }
                }
            },
    ) {
        AndroidView(factory = { canvas.surfaceView }, modifier = Modifier.fillMaxSize())
    }
}

private fun centroidOf(changes: List<PointerInputChange>): Offset {
    var x = 0f
    var y = 0f
    for (c in changes) {
        x += c.position.x
        y += c.position.y
    }
    return Offset(x / changes.size, y / changes.size)
}

/** Mean distance of the pointers from their centroid: the pinch scalar. */
private fun spreadOf(changes: List<PointerInputChange>, centroid: Offset): Float {
    if (changes.size < 2) return 0f
    var total = 0f
    for (c in changes) total += hypot(c.position.x - centroid.x, c.position.y - centroid.y)
    return total / changes.size
}

private const val ORBIT_DEGREES_PER_PX = 0.32
private const val MIN_SPREAD_PX = 12f
