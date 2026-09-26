package com.buildplan.preview

import com.buildplan.preview.camera.CameraGestureAction
import com.buildplan.preview.camera.CameraGestureAction.Began
import com.buildplan.preview.camera.CameraGestureAction.DoubleTap
import com.buildplan.preview.camera.CameraGestureAction.Orbit
import com.buildplan.preview.camera.CameraGestureAction.Pan
import com.buildplan.preview.camera.CameraGestureAction.Tap
import com.buildplan.preview.camera.CameraGestureAction.Zoom
import com.buildplan.preview.camera.CameraGestureTracker
import com.buildplan.preview.camera.GestureSample
import com.buildplan.preview.camera.OrbitCamera
import com.buildplan.preview.camera.OrbitPose
import com.buildplan.preview.camera.TouchPointer
import com.buildplan.preview.math.Bounds
import com.buildplan.preview.math.Vec3
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.PI
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.ln
import kotlin.math.sin
import kotlin.math.tan

/**
 * The touch model, driven by synthetic multi-touch sequences.
 *
 * The rule above all others is the pointer-set rebase. A finger landing,
 * lifting, being replaced or showing up at a different list position is never
 * a movement in itself. Only fingers that actually move turn, pan or zoom the
 * camera.
 */
class CameraGestureTest {

    /** A synthetic touchscreen, by default a portrait phone of 1080 × 2160 px at 2.75 px/dp. */
    private class Screen(val widthPx: Int = 1080, val heightPx: Int = 2160, val density: Float = 2.75f) {
        val tracker = CameraGestureTracker()
        var timeMs = 1_000L
        val log = mutableListOf<List<CameraGestureAction>>()

        fun frame(vararg pointers: TouchPointer, dtMs: Long = 16): List<CameraGestureAction> {
            timeMs += dtMs
            val sample = GestureSample.Frame(pointers.toList(), timeMs, widthPx, heightPx, density)
            return tracker.onSample(sample).also { log += it }
        }

        /** The last finger has lifted: an event with nothing pressed. */
        fun release(dtMs: Long = 16) = frame(dtMs = dtMs)

        fun cancel() = tracker.onSample(GestureSample.Cancel).also { log += it }

        val slopPx: Double get() = CameraGestureTracker.TOUCH_SLOP_DP.toDouble() * density
        val degreesPerPx: Double get() = CameraGestureTracker.ORBIT_DEGREES_PER_SHORT_SIDE / minOf(widthPx, heightPx)
    }

    private fun at(id: Long, x: Number, y: Number, pressed: Boolean = true) =
        TouchPointer(id, x.toFloat(), y.toFloat(), pressed)

    private val none = emptyList<CameraGestureAction>()

    private fun List<CameraGestureAction>.yaw() = filterIsInstance<Orbit>().sumOf { it.dYawDeg }
    private fun List<CameraGestureAction>.pitch() = filterIsInstance<Orbit>().sumOf { it.dPitchDeg }
    private fun List<CameraGestureAction>.panRight() = filterIsInstance<Pan>().sumOf { it.right }
    private fun List<CameraGestureAction>.panUp() = filterIsInstance<Pan>().sumOf { it.up }
    private fun List<CameraGestureAction>.zoomScale() = filterIsInstance<Zoom>().fold(1.0) { acc, z -> acc * z.scale }
    private fun List<CameraGestureAction>.moves() = filter { it is Orbit || it is Pan || it is Zoom }

    /** A house-sized box. The touch model is generic and needs no particular building. */
    private val house = Bounds(Vec3(-6.0, 0.0, -5.0), Vec3(6.0, 8.0, 5.0))
    private val camera = OrbitCamera(house)
    private val home = camera.home()

    /** The same camera calls the view model makes for each action. */
    private fun OrbitCamera.apply(pose: OrbitPose, actions: List<CameraGestureAction>, heightPx: Int): OrbitPose =
        actions.fold(pose) { p, a ->
            when (a) {
                is Orbit -> orbit(p, a.dYawDeg, a.dPitchDeg)
                is Pan -> pan(p, a.dxPx(heightPx), a.dyPx(heightPx), heightPx)
                is Zoom -> zoom(p, a.distanceFactor)
                else -> p
            }
        }

    // -----------------------------------------------------------------------
    // One finger
    // -----------------------------------------------------------------------

    @Test
    fun `one finger drag orbits by the viewport-relative gain and never moves the target`() {
        val s = Screen()
        assertEquals(listOf(Began), s.frame(at(1, 300, 1000)))
        val actions = (1..30).flatMap { k -> s.frame(at(1, 300 + 10 * k, 1000 + 4 * k)) }

        // A straight drag from the landing point. The camera turns only for the
        // travel beyond the slop.
        val travel = hypot(300.0, 120.0)
        val share = (travel - s.slopPx) / travel
        assertEquals(-300.0 * share * s.degreesPerPx, actions.yaw(), 1e-6)
        assertEquals(120.0 * share * s.degreesPerPx, actions.pitch(), 1e-6)
        assertTrue("dragging right swings the camera the other way round the model", actions.yaw() < 0.0)
        assertTrue(actions.none { it is Pan || it is Zoom })

        val pose = camera.apply(home, actions, s.heightPx)
        assertEquals("an orbit turns about the target, it never moves it", home.target, pose.target)
        assertEquals(home.distance, pose.distance, 0.0)
    }

    @Test
    fun `three fifths of the short side is about a half turn at any resolution`() {
        for (widthPx in listOf(720, 1080, 1440)) {
            // The same 393 dp wide phone rendered at three densities.
            val s = Screen(widthPx = widthPx, heightPx = widthPx * 2, density = widthPx / 393f)
            s.frame(at(1, widthPx * 0.2, 1000))
            val drag = widthPx * 0.6
            val actions = (1..60).flatMap { k -> s.frame(at(1, widthPx * 0.2 + drag * k / 60, 1000)) }
            val turn = abs(actions.yaw())
            assertEquals(180.0 * (drag - s.slopPx) / drag, turn, 1e-3)
            assertTrue("a 3/5-width drag must be close to a half turn, was $turn°", turn in 165.0..180.0)
        }
    }

    @Test
    fun `the same physical drag orbits the same angle at any pixel density`() {
        val turns = listOf(2f, 3f).map { density ->
            // 400 × 800 dp at either density.
            val s = Screen(widthPx = (400 * density).toInt(), heightPx = (800 * density).toInt(), density = density)
            s.frame(at(1, 100 * density, 300 * density))
            // 150 dp right and 60 dp down, in 30 steps.
            val actions = (1..30).flatMap { k -> s.frame(at(1, (100 + 5 * k) * density, (300 + 2 * k) * density)) }
            actions.yaw() to actions.pitch()
        }
        assertEquals(turns[0].first, turns[1].first, 1e-6)
        assertEquals(turns[0].second, turns[1].second, 1e-6)
        assertTrue(abs(turns[0].first) > 50.0)

        // The slop is in dp too: 6 dp is still a tap at both densities, 10 dp is not.
        for (density in listOf(2f, 3f)) {
            val s = Screen(widthPx = (400 * density).toInt(), heightPx = (800 * density).toInt(), density = density)
            s.frame(at(1, 200 * density, 400 * density))
            s.frame(at(1, 206 * density, 400 * density))
            assertEquals(listOf(Tap(200 * density, 400 * density)), s.release())
            s.timeMs += 1_000 // well outside the double-tap window
            s.frame(at(2, 200 * density, 400 * density))
            s.frame(at(2, 210 * density, 400 * density))
            assertEquals(none, s.release())
        }
    }

    @Test
    fun `a still touch is a tap at the point where the finger landed`() {
        val s = Screen()
        assertEquals(listOf(Began), s.frame(at(1, 420, 900)))
        assertEquals(none, s.frame(at(1, 420, 900), dtMs = 40))
        assertFalse(s.tracker.isCameraGesture)
        assertEquals(listOf(Tap(420f, 900f)), s.frame(at(1, 420, 900, pressed = false), dtMs = 60))
        assertFalse(s.tracker.isTracking)
    }

    @Test
    fun `lifting after an orbit is neither a tap nor a jump`() {
        val s = Screen()
        s.frame(at(1, 500, 1200))
        repeat(20) { k -> s.frame(at(1, 500 + 8 * (k + 1), 1200)) }
        assertTrue(s.log.flatten().any { it is Orbit })
        assertTrue(s.tracker.isCameraGesture)

        // The up event reports the finger 40 px further on, as a flick often does.
        assertEquals(none, s.frame(at(1, 700, 1200, pressed = false)))
        assertFalse(s.tracker.isTracking)

        // The next touch starts clean. Landing somewhere else is not a movement.
        assertEquals(listOf(Began), s.frame(at(7, 100, 300)))
        assertEquals(none, s.frame(at(7, 100, 300)))
    }

    @Test
    fun `jitter under the slop neither orbits nor spoils the tap`() {
        val s = Screen()
        s.frame(at(1, 500, 1000))
        val noise = listOf(1, -2, 2, -1, 0, 2, -2, 1, -1, 2, 0, -2, 1, 2, -1, -2, 2, 0, 1, -1)
        for ((i, n) in noise.withIndex()) {
            val m = noise[(i + 7) % noise.size]
            assertEquals(none, s.frame(at(1, 500 + n, 1000 + m)))
        }
        assertFalse("jitter must not claim the touch", s.tracker.isCameraGesture)
        // Twenty frames of wobble add up to far more path than the slop, but
        // the finger never left the spot.
        assertEquals(listOf(Tap(500f, 1000f)), s.release())
    }

    @Test
    fun `a long press is not a tap`() {
        val s = Screen()
        s.frame(at(1, 500, 1000))
        s.frame(at(1, 500, 1000), dtMs = 300)
        s.frame(at(1, 500, 1000), dtMs = 300)
        assertEquals(none, s.release())
    }

    @Test
    fun `a finger replaced by another in one event is a rebase and not a tap`() {
        val s = Screen()
        s.frame(at(1, 300, 1000))
        s.frame(at(1, 300, 1000))
        // Finger 1 lifts and finger 2 lands 400 px away in the same event.
        assertEquals(none, s.frame(at(1, 300, 1000, pressed = false), at(2, 700, 1000)))
        assertEquals(none, s.frame(at(2, 700, 1000)))
        assertEquals("two different fingers are not one tap", none, s.release())
    }

    // -----------------------------------------------------------------------
    // Pointer-set changes: the rebase rule
    // -----------------------------------------------------------------------

    @Test
    fun `a second finger landing is not a movement`() {
        val s = Screen()
        s.frame(at(1, 400, 1000))
        // Mid-orbit, so the first finger is well past its slop.
        repeat(10) { k -> s.frame(at(1, 400 + 6 * (k + 1), 1000)) }
        assertTrue(s.log.flatten().any { it is Orbit })

        assertEquals(none, s.frame(at(1, 460, 1000), at(2, 800, 1500)))
        assertTrue("a second finger makes it a camera gesture at once", s.tracker.isCameraGesture)
        repeat(5) { assertEquals(none, s.frame(at(1, 460, 1000), at(2, 800, 1500))) }
    }

    @Test
    fun `a second finger landing far away causes no zoom`() {
        val s = Screen()
        s.frame(at(1, 540, 1000))
        assertEquals(none, s.frame(at(1, 540, 1000), at(2, 1075, 2155)))
        repeat(3) { assertEquals(none, s.frame(at(1, 540, 1000), at(2, 1075, 2155))) }
        // Real movement afterwards zooms by the real, small ratio, measured
        // against where the far finger actually is.
        val step = s.frame(at(1, 540, 1000), at(2, 1070, 2150))
        val zoom = step.filterIsInstance<Zoom>().single()
        assertTrue("a few px of pinch is a few thousandths of zoom, was ${zoom.scale}", abs(zoom.scale - 1.0) < 0.01)
    }

    @Test
    fun `lifting one of two fingers is not a movement`() {
        val s = Screen()
        s.frame(at(1, 300, 1000))
        s.frame(at(1, 300, 1000), at(2, 700, 1000))
        // A little real pinch first, so the pair has live references.
        repeat(5) { k -> s.frame(at(1, 300 - 10 * (k + 1), 1000), at(2, 700 + 10 * (k + 1), 1000)) }
        assertTrue(s.log.flatten().any { it is Zoom })

        // Finger 2 lifts. Compose reports it once more, unpressed.
        assertEquals(none, s.frame(at(1, 250, 1000), at(2, 750, 1000, pressed = false)))
        repeat(5) { assertEquals(none, s.frame(at(1, 250, 1000))) }
        // The finger left behind starts behind the slop again, so the drift
        // of a lifting pinch does not turn the model.
        assertEquals(none, s.frame(at(1, 260, 1005)))
    }

    @Test
    fun `reordering pointer ids in the event list is not a movement`() {
        val s = Screen()
        s.frame(at(1, 100, 1000))
        s.frame(at(1, 100, 1000), at(2, 900, 1000))
        s.frame(at(1, 100, 1000), at(2, 900, 1000))
        // The same two fingers, listed the other way round.
        assertEquals(none, s.frame(at(2, 900, 1000), at(1, 100, 1000)))
        assertEquals(none, s.frame(at(2, 900, 1000), at(1, 100, 1000)))
        // Movement is read per id. Pairing by list index would read an 800 px swap here.
        val step = s.frame(at(2, 910, 1000), at(1, 110, 1000))
        assertEquals(listOf(Pan(10.0 / s.heightPx, 0.0)), step)
    }

    @Test
    fun `a third finger landing and lifting mid-pan is not a jump`() {
        val s = Screen()
        s.frame(at(1, 400, 1000))
        s.frame(at(1, 400, 1000), at(2, 700, 1000))
        var x = 0
        repeat(5) { x += 10; s.frame(at(1, 400 + x, 1000), at(2, 700 + x, 1000)) }

        // An accidental third contact, far from the others.
        assertEquals(none, s.frame(at(1, 400 + x, 1000), at(2, 700 + x, 1000), at(3, 60, 2100)))
        repeat(5) { k ->
            x += 10
            // The third contact wanders wildly. Only the first two to land steer.
            val wild = if (k % 2 == 0) at(3, 360, 1800) else at(3, 60, 2100)
            s.frame(at(1, 400 + x, 1000), at(2, 700 + x, 1000), wild)
        }
        assertEquals(none, s.frame(at(1, 400 + x, 1000), at(2, 700 + x, 1000), at(3, 60, 2100, pressed = false)))
        repeat(5) { x += 10; s.frame(at(1, 400 + x, 1000), at(2, 700 + x, 1000)) }

        val all = s.log.flatten()
        // 15 moving frames of 10 px. The transition frames added nothing.
        assertEquals(150.0 / s.heightPx, all.panRight(), 1e-12)
        assertEquals(0.0, all.panUp(), 0.0)
        assertTrue("the pair's span never changed", all.none { it is Zoom })
    }

    @Test
    fun `when the first finger lifts, the next two to land become the pair without a jump`() {
        val s = Screen()
        s.frame(at(1, 200, 800))
        s.frame(at(1, 200, 800), at(2, 800, 800))
        s.frame(at(1, 200, 800), at(2, 800, 800), at(3, 500, 1600))
        // Finger 1 lifts: the pair is now 2 and 3, a very different span and centroid.
        assertEquals(none, s.frame(at(2, 800, 800), at(3, 500, 1600)))
        assertEquals(none, s.frame(at(2, 800, 800), at(3, 500, 1600)))
        val step = s.frame(at(2, 810, 800), at(3, 510, 1600))
        assertEquals(listOf(Pan(10.0 / s.heightPx, 0.0)), step)
    }

    // -----------------------------------------------------------------------
    // Two fingers
    // -----------------------------------------------------------------------

    @Test
    fun `a pure pinch zooms by the span ratio and does not pan`() {
        val s = Screen()
        s.frame(at(1, 440, 1000))
        s.frame(at(1, 440, 1000), at(2, 640, 1000))
        val actions = (1..10).flatMap { k -> s.frame(at(1, 440 - 5 * k, 1000), at(2, 640 + 5 * k, 1000)) }
        assertEquals(300.0 / 200.0, actions.zoomScale(), 1e-9)
        assertTrue(actions.none { it is Pan })

        val pose = camera.apply(home, actions, s.heightPx)
        assertEquals("spreading the fingers brings the camera closer", home.distance / 1.5, pose.distance, 1e-9)
        assertEquals(home.target, pose.target)
    }

    @Test
    fun `a pure two finger drag pans and does not zoom`() {
        val s = Screen()
        s.frame(at(1, 440, 1000))
        s.frame(at(1, 440, 1000), at(2, 640, 1000))
        val actions = (1..20).flatMap { k -> s.frame(at(1, 440 + 10 * k, 1000 - 5 * k), at(2, 640 + 10 * k, 1000 - 5 * k)) }
        assertEquals(200.0 / s.heightPx, actions.panRight(), 1e-12)
        assertEquals(100.0 / s.heightPx, actions.panUp(), 1e-12)
        assertEquals(1.0, actions.zoomScale(), 1e-12)

        val pose = camera.apply(home, actions, s.heightPx)
        assertEquals(home.distance, pose.distance, 0.0)
        assertEquals("pan never turns the camera", home.yawDeg, pose.yawDeg, 0.0)
        assertEquals(home.pitchDeg, pose.pitchDeg, 0.0)
    }

    @Test
    fun `pinch and pan together give both`() {
        val s = Screen()
        // The second finger lands off-centre: that is not movement either.
        s.frame(at(1, 440, 1000))
        s.frame(at(1, 440, 1000), at(2, 640, 1000))
        val actions = (1..10).flatMap { k ->
            val cx = 540 + 6 * k
            val cy = 1000 + 3 * k
            val half = 100 + 5 * k
            s.frame(at(1, cx - half, cy), at(2, cx + half, cy))
        }
        assertEquals(1.5, actions.zoomScale(), 1e-9)
        assertEquals(60.0 / s.heightPx, actions.panRight(), 1e-12)
        assertEquals(-30.0 / s.heightPx, actions.panUp(), 1e-12)
    }

    @Test
    fun `a two finger drag keeps the building under the fingers`() {
        val s = Screen()
        s.frame(at(1, 400, 1000))
        s.frame(at(1, 400, 1000), at(2, 700, 1100))
        val actions = (1..20).flatMap { k -> s.frame(at(1, 400 + 6 * k, 1000 - 4 * k), at(2, 700 + 6 * k, 1100 - 4 * k)) }
        val after = camera.apply(home, actions, s.heightPx)

        // Where does the old target appear now? Project it into the new view.
        val basis = camera.basis(after)
        val v = home.target - camera.eye(after)
        val depth = v dot basis.forward
        val pxPerWorld = s.heightPx / (2.0 * depth * tan(Math.toRadians(camera.fovDeg) / 2.0))
        val screenDx = (v dot basis.right) * pxPerWorld
        val screenDy = -(v dot basis.up) * pxPerWorld
        assertEquals("the fingers moved 120 px right", 120.0, screenDx, 1e-6)
        assertEquals("and 80 px up", -80.0, screenDy, 1e-6)
    }

    @Test
    fun `pinch, lift one finger, then keep orbiting without a jump`() {
        val s = Screen()
        s.frame(at(1, 400, 1000))
        s.frame(at(1, 400, 1000), at(2, 700, 1000))
        repeat(10) { k -> s.frame(at(1, 400 - 5 * (k + 1), 1000), at(2, 700 + 5 * (k + 1), 1000)) }
        assertEquals(none, s.frame(at(1, 350, 1000), at(2, 750, 1000, pressed = false)))

        val step = 4.0
        val orbit = (1..40).flatMap { k -> s.frame(at(1, 350 + step * k, 1000)) }
        assertTrue("one finger again: only orbit", orbit.all { it is Orbit })
        for (o in orbit.filterIsInstance<Orbit>()) {
            assertTrue("no orbit frame may exceed the finger's own step", abs(o.dYawDeg) <= step * s.degreesPerPx + 1e-9)
        }
        assertEquals(-(160.0 - s.slopPx) * s.degreesPerPx, orbit.yaw(), 1e-6)
        assertEquals(0.0, orbit.pitch(), 1e-12)
        assertEquals(none, s.release())
    }

    @Test
    fun `fingers crossing never produce a runaway zoom`() {
        val s = Screen()
        s.frame(at(1, 300, 1000))
        s.frame(at(1, 300, 1000), at(2, 780, 1000))
        // Start close in, so that the zoom-out while the fingers converge stays
        // inside the camera's own clamp and the way back can be compared.
        val start = camera.zoom(home, 0.25)
        var pose = start
        // Straight through each other: the span falls to zero and grows back.
        for (k in 1..48) {
            val actions = s.frame(at(1, 300 + 10 * k, 1000), at(2, 780 - 10 * k, 1000))
            for (z in actions.filterIsInstance<Zoom>()) {
                assertTrue(z.scale in CameraGestureTracker.MIN_ZOOM_STEP..CameraGestureTracker.MAX_ZOOM_STEP)
            }
            pose = camera.apply(pose, actions, s.heightPx)
            assertTrue(pose.distance.isFinite())
            assertTrue(pose.distance in camera.minDistance..camera.maxDistance)
        }
        val all = s.log.flatten()
        assertTrue("the centroid never moved", all.none { it is Pan })
        // In and back out to the same span nets to no zoom, clamps included.
        assertEquals(1.0, all.zoomScale(), 1e-9)
        assertEquals(start.distance, pose.distance, 1e-9)
    }

    // -----------------------------------------------------------------------
    // Cancel
    // -----------------------------------------------------------------------

    @Test
    fun `cancel clears everything and emits nothing`() {
        val s = Screen()
        s.frame(at(1, 400, 1000))
        s.frame(at(1, 400, 1000), at(2, 700, 1000))
        repeat(3) { k -> s.frame(at(1, 400 - 5 * (k + 1), 1000), at(2, 700 + 5 * (k + 1), 1000)) }
        assertEquals(none, s.cancel())
        assertFalse(s.tracker.isTracking)
        assertFalse(s.tracker.isCameraGesture)
        // A release that still arrives afterwards is neither a tap nor a move.
        assertEquals(none, s.release())

        // A touch that might have been a tap never taps once cancelled.
        s.frame(at(3, 300, 300))
        assertEquals(none, s.cancel())
        assertEquals(none, s.frame(at(3, 300, 300, pressed = false)))

        // Fingers still down when the stream resumes begin a fresh gesture,
        // measured from where they are now.
        assertEquals(listOf(Began), s.frame(at(1, 380, 1000), at(2, 720, 1000)))
        assertEquals(none, s.frame(at(1, 380, 1000), at(2, 720, 1000)))
    }

    @Test
    fun `cancel also forgets a pending double tap`() {
        val s = Screen()
        s.frame(at(1, 400, 900))
        assertEquals(listOf(Tap(400f, 900f)), s.release(dtMs = 50))
        s.cancel()
        s.frame(at(2, 400, 900), dtMs = 80)
        assertEquals(listOf(Tap(400f, 900f)), s.release(dtMs = 50))
    }

    // -----------------------------------------------------------------------
    // Double tap
    // -----------------------------------------------------------------------

    @Test
    fun `a quick second tap close to the first is a double tap`() {
        val s = Screen()
        s.frame(at(1, 400, 900))
        assertEquals(listOf(Tap(400f, 900f)), s.release(dtMs = 60))
        s.frame(at(2, 410, 905), dtMs = 120)
        assertEquals(listOf(DoubleTap(410f, 905f)), s.release(dtMs = 60))
        // A third tap starts a new pair rather than double-tapping again.
        s.frame(at(3, 410, 905), dtMs = 60)
        assertEquals(listOf(Tap(410f, 905f)), s.release(dtMs = 60))
    }

    @Test
    fun `a slow, distant or interrupted second tap is only a tap`() {
        val slow = Screen()
        slow.frame(at(1, 400, 900))
        slow.release(dtMs = 60)
        slow.frame(at(2, 400, 900), dtMs = 280)
        assertEquals(listOf(Tap(400f, 900f)), slow.release(dtMs = 60))

        val distant = Screen()
        distant.frame(at(1, 400, 900))
        distant.release(dtMs = 60)
        // 200 px is about 73 dp: a different target.
        distant.frame(at(2, 600, 900), dtMs = 80)
        assertEquals(listOf(Tap(600f, 900f)), distant.release(dtMs = 60))

        val dragged = Screen()
        dragged.frame(at(1, 400, 900))
        dragged.release(dtMs = 30)
        dragged.frame(at(2, 400, 900), dtMs = 30)
        dragged.frame(at(2, 460, 900), dtMs = 30)
        dragged.release(dtMs = 30)
        dragged.frame(at(3, 400, 900), dtMs = 30)
        assertEquals(listOf(Tap(400f, 900f)), dragged.release(dtMs = 30))
    }

    // -----------------------------------------------------------------------
    // Long gestures and malformed input
    // -----------------------------------------------------------------------

    @Test
    fun `a thousand-sample orbit accumulates no discontinuity`() {
        val s = Screen()
        val path = (0..1000).map { k ->
            Pair((540 + 300 * sin(2 * PI * k / 400)).toFloat(), (1000 + 200 * sin(2 * PI * k / 250)).toFloat())
        }
        s.frame(at(1, path[0].first, path[0].second))
        var firstOrbitAt = -1
        var afterFirst = 0.0 to 0.0
        for (k in 1..1000) {
            val (x, y) = path[k]
            val actions = s.frame(at(1, x, y))
            val step = hypot(x.toDouble() - path[k - 1].first, y.toDouble() - path[k - 1].second)
            for (o in actions.filterIsInstance<Orbit>()) {
                assertTrue("frame $k turned more than the finger moved", hypot(o.dYawDeg, o.dPitchDeg) <= step * s.degreesPerPx + 1e-9)
                if (firstOrbitAt < 0) firstOrbitAt = k
                else afterFirst = (afterFirst.first + o.dYawDeg) to (afterFirst.second + o.dPitchDeg)
            }
        }
        assertTrue(firstOrbitAt > 0)
        // After the first orbit frame, the per-frame turns add up exactly to
        // the finger's net movement. Nothing is lost or invented in between.
        val (xf, yf) = path[1000]
        val (xs, ys) = path[firstOrbitAt]
        assertEquals(-(xf.toDouble() - xs) * s.degreesPerPx, afterFirst.first, 1e-6)
        assertEquals((yf.toDouble() - ys) * s.degreesPerPx, afterFirst.second, 1e-6)
        // Across the whole gesture, only the slop is missing.
        val all = s.log.flatten()
        val missingPx = hypot(
            all.yaw() / s.degreesPerPx + (xf.toDouble() - path[0].first),
            all.pitch() / s.degreesPerPx - (yf.toDouble() - path[0].second),
        )
        assertTrue("only the slop may be missing, was $missingPx px", missingPx <= s.slopPx + 1e-6)
    }

    @Test
    fun `a thousand-sample pan and pinch accumulates no discontinuity`() {
        val s = Screen()
        fun pair(k: Int): Pair<TouchPointer, TouchPointer> {
            val cx = 540 + 250 * sin(2 * PI * k / 330)
            val cy = 1100 + 400 * sin(2 * PI * k / 470)
            val half = 175 + 75 * sin(2 * PI * k / 210)
            return at(1, cx - half, cy) to at(2, cx + half, cy)
        }
        fun centroid(p: Pair<TouchPointer, TouchPointer>) =
            (p.first.x.toDouble() + p.second.x) / 2 to (p.first.y.toDouble() + p.second.y) / 2
        fun span(p: Pair<TouchPointer, TouchPointer>) =
            hypot(p.second.x.toDouble() - p.first.x, p.second.y.toDouble() - p.first.y)

        val start = pair(0)
        s.frame(start.first)
        s.frame(start.first, start.second)
        var previous = start
        for (k in 1..1000) {
            val p = pair(k)
            val actions = s.frame(p.first, p.second)
            val (px, py) = centroid(previous)
            val (cx, cy) = centroid(p)
            val stepPx = hypot(cx - px, cy - py)
            for (pan in actions.filterIsInstance<Pan>()) {
                assertTrue(hypot(pan.right, pan.up) * s.heightPx <= stepPx + 1e-9)
            }
            for (z in actions.filterIsInstance<Zoom>()) {
                assertTrue(abs(ln(z.scale)) <= ln(CameraGestureTracker.MAX_ZOOM_STEP) + 1e-12)
            }
            previous = p
        }
        val all = s.log.flatten()
        val (x0, y0) = centroid(start)
        val (x1, y1) = centroid(previous)
        assertEquals((x1 - x0) / s.heightPx, all.panRight(), 1e-9)
        assertEquals(-(y1 - y0) / s.heightPx, all.panUp(), 1e-9)
        assertEquals(span(previous) / span(start), all.zoomScale(), 1e-9)
    }

    @Test
    fun `camera distance stays finite and clamped under malformed input`() {
        val s = Screen()
        var pose = home
        fun apply(actions: List<CameraGestureAction>): OrbitPose {
            val before = pose
            pose = camera.apply(pose, actions, s.heightPx)
            assertTrue(pose.distance.isFinite())
            assertTrue(pose.distance in camera.minDistance..camera.maxDistance)
            assertTrue(pose.target.isFinite())
            val ratio = pose.distance / before.distance
            assertTrue("one frame zoomed by $ratio", ratio in CameraGestureTracker.MIN_ZOOM_STEP - 1e-12..CameraGestureTracker.MAX_ZOOM_STEP + 1e-12)
            return pose
        }

        apply(s.frame(at(1, 500, 1000)))
        // A second finger lands at the far corner and lifts again: no zoom at all.
        apply(s.frame(at(1, 500, 1000), at(2, 1079, 2159)))
        assertEquals(home.distance, pose.distance, 0.0)
        apply(s.frame(at(1, 500, 1000), at(2, 1079, 2159, pressed = false)))
        apply(s.frame(at(1, 500, 1000), at(3, 600, 1000)))
        assertEquals(home.distance, pose.distance, 0.0)

        // The pair distance jumps 40× in a single frame. One ordinary step at most.
        apply(s.frame(at(1, 500, 1000), at(3, 4500, 1000)))
        assertTrue(pose.distance > camera.minDistance && pose.distance < camera.maxDistance)
        assertEquals(home.distance * CameraGestureTracker.MIN_ZOOM_STEP, pose.distance, 1e-9)
        // And straight back: the clamps are reciprocal, so no zoom is left over.
        apply(s.frame(at(1, 500, 1000), at(3, 600, 1000)))
        assertEquals(home.distance, pose.distance, 1e-9)

        // Non-finite coordinates are dropped, not applied.
        assertEquals(none, s.frame(at(1, Float.NaN, 1000), at(3, 600, 1000)))
        assertEquals(none, s.frame(at(1, 500, 1000), at(3, Float.POSITIVE_INFINITY, 1000)))
        // A viewport with no size cannot scale a pan or an orbit.
        val empty = s.tracker.onSample(GestureSample.Frame(listOf(at(1, 510, 1000), at(3, 610, 1000)), s.timeMs + 16, 0, 0, 0f))
        assertEquals(none, empty)

        // Hammering the pinch far past either clamp still lands on the clamp.
        repeat(200) { k -> apply(s.frame(at(1, 500, 1000), at(3, if (k % 2 == 0) 4500 else 560, 1000))) }
        repeat(100) { k -> apply(s.frame(at(1, 500, 1000), at(3, 560 + 60 * (k + 1), 1000))) }
        assertEquals(camera.minDistance, pose.distance, 1e-9)
        repeat(100) { k -> apply(s.frame(at(1, 500, 1000), at(3, 6560 - 60 * (k + 1), 1000))) }
        assertTrue(pose.distance.isFinite())
    }

    @Test
    fun `the target moves only by deliberate pans, never on finger-count changes`() {
        val s = Screen()
        var pose = home
        fun step(vararg pointers: TouchPointer): List<CameraGestureAction> {
            val before = pose
            val actions = s.frame(*pointers)
            pose = camera.apply(pose, actions, s.heightPx)
            if (actions.none { it is Pan }) assertEquals("only a pan may move the target", before.target, pose.target)
            if (actions.moves().isEmpty()) assertEquals("a frame with no movement changes nothing", before, pose)
            return actions
        }

        step(at(1, 400, 1000))
        repeat(20) { k -> step(at(1, 400 + 5 * (k + 1), 1000)) } // orbit
        assertEquals(none, step(at(1, 500, 1000), at(2, 900, 1200))) // 1 → 2
        assertEquals(none, step(at(1, 500, 1000), at(2, 900, 1200), at(3, 100, 300))) // 2 → 3
        assertEquals(none, step(at(1, 500, 1000), at(2, 900, 1200))) // 3 → 2
        assertEquals(none, step(at(2, 900, 1200))) // 2 → 1, and not the first finger
        repeat(20) { k -> step(at(2, 900, 1200 - 6 * (k + 1))) } // orbit again
        assertEquals(home.target, pose.target)

        assertEquals(none, step(at(2, 900, 1080), at(4, 300, 1080))) // 1 → 2
        repeat(10) { k -> step(at(2, 900 + 4 * (k + 1), 1080), at(4, 300 + 4 * (k + 1), 1080)) } // a real pan
        val panned = pose.target
        assertTrue("the pan moved the target", panned != home.target)
        assertEquals(none, step(at(4, 340, 1080))) // 2 → 1
        repeat(10) { k -> step(at(4, 340, 1080 + 5 * (k + 1))) } // orbit: the target stays panned
        assertEquals(panned, pose.target)
    }
}
