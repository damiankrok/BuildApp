package com.buildplan.preview.camera

import kotlin.math.hypot
import kotlin.math.min

/**
 * One pointer in a [GestureSample.Frame].
 *
 * [id] must stay the same for as long as the finger is down (Compose's
 * `PointerId.value`). Every movement is measured per id: where a pointer sits
 * in the event's list means nothing from one frame to the next.
 */
data class TouchPointer(
    val id: Long,
    /** Pixels from the viewport's left edge. */
    val x: Float,
    /** Pixels from the viewport's top edge, y down. */
    val y: Float,
    val pressed: Boolean = true,
)

/** What the viewport hands the [CameraGestureTracker]: one sample per pointer event. */
sealed interface GestureSample {
    /** Every pointer the event reports, and the viewport it happened on. */
    data class Frame(
        val pointers: List<TouchPointer>,
        val timeMs: Long,
        val widthPx: Int,
        val heightPx: Int,
        /**
         * Pixels per dp. The slops are defined in dp so that they are the same
         * physical size on every screen.
         */
        val density: Float,
    ) : GestureSample

    /**
     * The system took the touch stream away (a parent intercepted it, the
     * window lost focus). Whatever was in progress stops, and nothing it
     * would have done on release happens.
     */
    data object Cancel : GestureSample
}

/**
 * What a gesture means for the camera and the selection. These are semantic
 * steps, already scaled, so the viewport only has to hand each one to the
 * matching camera or selection call.
 */
sealed interface CameraGestureAction {
    /**
     * A finger landed on an idle viewport. A camera transition that is still
     * running must stop here and hand control to the finger.
     */
    data object Began : CameraGestureAction

    /** Degrees to add to the camera's yaw and pitch. The camera clamps the pitch. */
    data class Orbit(val dYawDeg: Double, val dPitchDeg: Double) : CameraGestureAction

    /**
     * The model follows the fingers this far across the screen, measured in
     * viewport heights along the camera's right and up axes. One viewport
     * height is the frustum's height at the focus, so the camera turns this
     * into world units from its own distance and field of view. Content at the
     * focus then stays under the fingers at any zoom and on any screen.
     */
    data class Pan(val right: Double, val up: Double) : CameraGestureAction {
        /** Finger travel in pixels (y down) on a viewport [heightPx] tall, the units `OrbitCamera.pan` takes. */
        fun dxPx(heightPx: Int): Double = right * heightPx
        fun dyPx(heightPx: Int): Double = -up * heightPx
    }

    /**
     * The pinch pair's distance grew by [scale] this frame. Above 1 the
     * fingers spread apart, which reads as "bring it closer".
     */
    data class Zoom(val scale: Double) : CameraGestureAction {
        /** The camera-distance multiplier `OrbitCamera.zoom` takes. */
        val distanceFactor: Double get() = 1.0 / scale
    }

    /** A tap at the point where the finger landed, in viewport pixels. */
    data class Tap(val x: Float, val y: Float) : CameraGestureAction

    /**
     * A second tap soon after and close to the previous one. It stands in for
     * that second [Tap], so a consumer that only selects treats it the same way.
     */
    data class DoubleTap(val x: Float, val y: Float) : CameraGestureAction
}

/**
 * The viewport's touch model as a pure state machine. Samples go in and
 * semantic camera and selection actions come out.
 *
 * One finger orbits, two fingers pan and pinch, and a short still touch is a
 * tap. The rule that keeps the model from jumping is the **pointer-set rebase**:
 * whenever the set of pressed pointer ids changes (a finger lands or lifts, a
 * pointer is replaced, or the list arrives in a different order), the tracker
 * re-reads every reference (orbit anchor, pair centroid, pair distance) from
 * the NEW set and emits no orbit, pan or zoom for that frame. Otherwise the
 * next frame would compare the new set's centroid and spread with the old
 * set's. That is a sudden pan plus a bogus pinch, even though no finger moved.
 *
 * Not thread-safe. Feed it from the one coroutine that reads the pointer events.
 */
class CameraGestureTracker {

    private data class Point(val x: Double, val y: Double) {
        fun distanceTo(o: Point): Double = hypot(x - o.x, y - o.y)
    }

    private class TapRecord(val at: Point, val upMs: Long)

    // The gesture: from the first finger down to the last finger up.
    private var tracking = false
    private var startMs = 0L
    private var firstId = 0L
    private var landing = Point(0.0, 0.0)
    private var tapPossible = false
    private var cameraGesture = false

    // The current pointer set. All of it is rebuilt by rebase().
    /** Pressed ids in event order: the identity whose change triggers a rebase. */
    private var setIds: List<Long> = emptyList()
    /** Pressed ids in the order they landed, which picks the pinch pair. */
    private val pressOrder = ArrayList<Long>()
    private val positions = HashMap<Long, Point>()

    // One finger.
    private var orbitAnchor = Point(0.0, 0.0)
    private var orbitEngaged = false

    // Two or more fingers: the first two to land.
    private var pairA = 0L
    private var pairB = 0L
    private var pairCentroid = Point(0.0, 0.0)
    private var pairSpan = 0.0

    /** The last tap, while a second one could still make it a double tap. */
    private var lastTap: TapRecord? = null

    /** True while at least one finger is down. */
    val isTracking: Boolean get() = tracking

    /**
     * True once the current gesture has become a camera move: a drag past the
     * slop, or a second finger. From then on the viewport consumes the
     * gesture's pointer events so nothing around it can claim them. A touch
     * that may still be a tap is left unconsumed.
     */
    val isCameraGesture: Boolean get() = cameraGesture

    /**
     * Advance by one sample. Returns what to do, in order. The list is empty
     * when the sample changes nothing, and that includes every transition frame.
     */
    fun onSample(sample: GestureSample): List<CameraGestureAction> = when (sample) {
        GestureSample.Cancel -> {
            clear()
            emptyList()
        }
        is GestureSample.Frame -> onFrame(sample)
    }

    private fun onFrame(frame: GestureSample.Frame): List<CameraGestureAction> {
        val pressed = frame.pointers.filter { it.pressed }.distinctBy { it.id }
        // A NaN would reach the pose and stay there: wrapDegrees and the
        // clamps pass NaN through. Drop the frame. The next good one is
        // measured against the last good positions, so nothing is lost.
        if (pressed.any { !it.x.isFinite() || !it.y.isFinite() }) return emptyList()

        if (!tracking) {
            if (pressed.isEmpty()) return emptyList() // hover, or a stray release
            tracking = true
            startMs = frame.timeMs
            firstId = pressed[0].id
            landing = pressed[0].point()
            tapPossible = pressed.size == 1
            cameraGesture = pressed.size > 1
            rebase(pressed)
            return listOf(CameraGestureAction.Began)
        }

        if (pressed.isEmpty()) return release(frame)

        val ids = pressed.map { it.id }
        if (ids != setIds) {
            // A tap is one finger from start to finish. A second finger, or the
            // one finger replaced by another, makes this something else.
            if (pressed.size > 1 || ids[0] != firstId) tapPossible = false
            if (pressed.size > 1) cameraGesture = true
            rebase(pressed)
            return emptyList()
        }

        return if (pressed.size == 1) orbit(pressed[0], frame) else panAndZoom(pressed, frame)
    }

    /** Re-read every reference from the new pointer set. The caller emits nothing for this frame. */
    private fun rebase(pressed: List<TouchPointer>) {
        setIds = pressed.map { it.id }
        pressOrder.retainAll(setIds.toSet())
        for (id in setIds) if (id !in pressOrder) pressOrder += id
        positions.clear()
        for (p in pressed) positions[p.id] = p.point()

        orbitEngaged = false
        if (pressed.size == 1) {
            // Each one-finger phase starts behind the slop again. When a pinch
            // ends, the finger left behind drifts as the other lifts, and that
            // drift must not turn the model.
            orbitAnchor = positions.getValue(setIds[0])
        } else {
            pairA = pressOrder[0]
            pairB = pressOrder[1]
            val a = positions.getValue(pairA)
            val b = positions.getValue(pairB)
            pairCentroid = midpoint(a, b)
            pairSpan = a.distanceTo(b)
        }
    }

    private fun orbit(pointer: TouchPointer, frame: GestureSample.Frame): List<CameraGestureAction> {
        val now = pointer.point()
        val previous = positions.put(pointer.id, now) ?: now
        val from = if (orbitEngaged) {
            previous
        } else {
            // Measured as displacement from the anchor, not path length, so
            // 1–2 px of jitter can never add up past the slop.
            val slop = TOUCH_SLOP_DP * densityOf(frame)
            val offset = now.distanceTo(orbitAnchor)
            if (offset <= slop) return emptyList()
            orbitEngaged = true
            cameraGesture = true
            tapPossible = false
            // Only the travel beyond the slop turns the camera. Counting from
            // the point where the finger crossed the slop circle means the
            // first orbit step is never larger than the finger's own step. The
            // whole slop at once would make the model lurch as the drag begins.
            val k = slop / offset
            Point(orbitAnchor.x + (now.x - orbitAnchor.x) * k, orbitAnchor.y + (now.y - orbitAnchor.y) * k)
        }

        val shortSide = min(frame.widthPx, frame.heightPx)
        if (shortSide <= 0) return emptyList()
        val degreesPerPx = ORBIT_DEGREES_PER_SHORT_SIDE / shortSide
        if (now == from) return emptyList()
        // Dragging right swings the camera left around the model, so the facade
        // under the finger moves right with it. Dragging down raises the eye.
        // (Written as from − now rather than −(now − from), so that no motion
        // gives 0.0 and never −0.0.)
        return listOf(
            CameraGestureAction.Orbit(
                dYawDeg = (from.x - now.x) * degreesPerPx,
                dPitchDeg = (now.y - from.y) * degreesPerPx,
            ),
        )
    }

    private fun panAndZoom(pressed: List<TouchPointer>, frame: GestureSample.Frame): List<CameraGestureAction> {
        for (p in pressed) positions[p.id] = p.point()
        val a = positions.getValue(pairA)
        val b = positions.getValue(pairB)
        val centroid = midpoint(a, b)
        val span = a.distanceTo(b)
        val actions = ArrayList<CameraGestureAction>(2)

        if (frame.heightPx > 0 && centroid != pairCentroid) {
            // Screen y points down and the camera's up points up.
            actions += CameraGestureAction.Pan(
                right = (centroid.x - pairCentroid.x) / frame.heightPx,
                up = (pairCentroid.y - centroid.y) / frame.heightPx,
            )
        }

        // Two real fingertips are never this close. A span this small comes
        // from crossing or merged contacts, and a ratio taken against it is
        // mostly noise.
        val minSpan = MIN_PINCH_SPAN_DP * densityOf(frame)
        if (pairSpan >= minSpan && span >= minSpan && span != pairSpan) {
            // Clamped per frame so that one bad sample can move the camera by at
            // most one ordinary step. The bounds are reciprocal, so a pinch that
            // goes out and back still nets to exactly no zoom.
            actions += CameraGestureAction.Zoom((span / pairSpan).coerceIn(MIN_ZOOM_STEP, MAX_ZOOM_STEP))
        }

        pairCentroid = centroid
        pairSpan = span
        if (actions.isNotEmpty()) cameraGesture = true
        return actions
    }

    private fun release(frame: GestureSample.Frame): List<CameraGestureAction> {
        val isTap = tapPossible && frame.timeMs - startMs <= TAP_TIMEOUT_MS
        val at = landing
        val previousTap = lastTap
        endGesture()

        if (!isTap) {
            // A drag between two taps means they are not a double tap.
            lastTap = null
            return emptyList()
        }
        val isDoubleTap = previousTap != null &&
            frame.timeMs - previousTap.upMs in 0..DOUBLE_TAP_TIMEOUT_MS &&
            at.distanceTo(previousTap.at) <= DOUBLE_TAP_SLOP_DP * densityOf(frame)
        return if (isDoubleTap) {
            // A third tap starts a new pair instead of double-tapping again.
            lastTap = null
            listOf(CameraGestureAction.DoubleTap(at.x.toFloat(), at.y.toFloat()))
        } else {
            lastTap = TapRecord(at, frame.timeMs)
            listOf(CameraGestureAction.Tap(at.x.toFloat(), at.y.toFloat()))
        }
    }

    private fun endGesture() {
        tracking = false
        tapPossible = false
        cameraGesture = false
        orbitEngaged = false
        setIds = emptyList()
        pressOrder.clear()
        positions.clear()
    }

    private fun clear() {
        endGesture()
        lastTap = null
    }

    private fun TouchPointer.point() = Point(x.toDouble(), y.toDouble())

    private fun midpoint(a: Point, b: Point) = Point((a.x + b.x) / 2.0, (a.y + b.y) / 2.0)

    private fun densityOf(frame: GestureSample.Frame): Double =
        if (frame.density.isFinite() && frame.density > 0f) frame.density.toDouble() else 1.0

    companion object {
        /**
         * How far a finger may wander and still be tapping, measured from where
         * it landed. It matches the platform's own touch slop, so a tap here
         * feels like a tap anywhere else on the phone.
         */
        const val TOUCH_SLOP_DP = 8f

        /**
         * Orbit gain, in degrees per one short side of the viewport of finger
         * travel. It is used for yaw and pitch alike.
         *
         * The gain is relative to the viewport, not per pixel. A per-pixel gain
         * turns a 1440 px phone a third faster than a 1080 px one for the same
         * swipe. Measuring against the short side also keeps the gain the same
         * when the phone rotates. 300° puts a half turn at 3/5 of the width in
         * portrait. That is slow enough to line up a facade and quick enough to
         * get round the house in two strokes. It is also lower than the old
         * 0.32°/px, which was 346° per width on a 1080 px screen.
         */
        const val ORBIT_DEGREES_PER_SHORT_SIDE = 300.0

        /**
         * The per-frame limit on the pinch ratio. A real pinch rarely changes
         * the finger distance by a quarter within one frame, so this only ever
         * catches glitches.
         */
        const val MAX_ZOOM_STEP = 1.25
        const val MIN_ZOOM_STEP = 1.0 / MAX_ZOOM_STEP

        /** Below this pair distance no zoom is read. Fingertips cannot get this close. */
        const val MIN_PINCH_SPAN_DP = 16f

        /** Held longer than the platform's long-press timeout, a touch is not a tap. */
        const val TAP_TIMEOUT_MS = 500L

        /**
         * The window between the two taps' releases. It is the platform's
         * double-tap timeout, and it is the same window the view model uses
         * when it decides that two picks of the same object mean "isolate this".
         */
        const val DOUBLE_TAP_TIMEOUT_MS = 300L

        /** A second tap within one touch target of the first is aimed at the same thing. */
        const val DOUBLE_TAP_SLOP_DP = 48f
    }
}
