package com.buildplan.preview

import androidx.compose.ui.geometry.Rect
import com.buildplan.preview.camera.ContentFrame
import com.buildplan.preview.camera.ContentInsets
import com.buildplan.preview.camera.OrbitCamera
import com.buildplan.preview.camera.Projection
import com.buildplan.preview.math.Vec3
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.ViewerState
import androidx.compose.animation.core.VectorConverter
import com.buildplan.preview.ui.DockLayout
import com.buildplan.preview.ui.GROW_FROM
import com.buildplan.preview.ui.MotionPolicy
import com.buildplan.preview.ui.PanelFrame
import com.buildplan.preview.ui.Sheet
import com.buildplan.preview.ui.ShellState
import com.buildplan.preview.ui.morphRect
import com.buildplan.preview.ui.panelAlpha
import com.buildplan.preview.ui.tileAlpha
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs
import kotlin.math.tan

/**
 * Variant C, "Minimalny dok" (OWNER, APK 1356; round D, APK 1357): the rules under the new workspace that do not
 * need a screen — the tile-to-panel morph's staged path and its springs, the dock as the window's arithmetic only, the reference grid as a view setting, the menu's stages request,
 * and the whole house framed large and centred in the space the resting chrome leaves free.
 */
class MinimalDockTest {

    private val tile = Rect(16f, 1404f, 286f, 1500f)
    private val frame = PanelFrame(x = 16f, bottom = 1390f, width = 688f, maxHeight = 900f)

    @Test
    fun `the morph is the tile at rest, the panel when open`() {
        assertEquals(tile, morphRect(tile, frame, panelHeight = 540f, p = 0f))
        assertEquals(Rect(16f, 850f, 704f, 1390f), morphRect(tile, frame, panelHeight = 540f, p = 1f))
    }

    @Test
    fun `round D - the glass first lifts in its own column, then grows, and never overshoots`() {
        var last = morphRect(tile, frame, 540f, 0f)
        for (i in 1..200) {
            val p = i / 200f
            val now = morphRect(tile, frame, 540f, p)
            // Every edge moves one way only: up, left, right — no detour, no overshoot.
            assertTrue("top at $p", now.top <= last.top + 1e-3f)
            assertTrue("bottom at $p", now.bottom <= last.bottom + 1e-3f)
            assertTrue("left at $p", now.left <= last.left + 1e-3f)
            assertTrue("right at $p", now.right >= last.right - 1e-3f)
            assertTrue("never wider than the panel", now.width <= frame.width + 1e-3f)
            if (p <= GROW_FROM) assertEquals("lifts at its own width at $p", tile.width, now.width, 1e-3f)
            last = now
        }
    }

    @Test
    fun `round D - opening either panel never crosses the other tile, in every window`() {
        val px = 2.625f // 420 dpi
        for ((w, h, side) in listOf(Triple(1080f, 2200f, false), Triple(720f, 1500f, false), Triple(2000f, 1100f, true), Triple(1600f, 2400f, false))) {
            val layout = DockLayout.of(w, h, side, gap = 8 * px, tileH = 64 * px, headerBottom = 48 * px, dockMaxW = 440 * px)
            for ((own, other, frame) in listOf(Triple(layout.layersSlot, layout.stagesSlot, layout.layersFrame), Triple(layout.stagesSlot, layout.layersSlot, layout.stagesFrame))) {
                for (i in 0..400) {
                    val r = morphRect(own, frame, panelHeight = 260 * px, p = i / 400f)
                    assertFalse("${w}x$h: glass crosses the other tile at ${i / 400f}: $r vs $other", r.overlaps(other.deflate(0.5f)))
                }
            }
        }
    }

    @Test
    fun `round D - the dock is the window's arithmetic only, its tiles never overlap and the panels stand above it`() {
        val px = 2.625f
        val a = DockLayout.of(1080f, 2200f, false, 8 * px, 64 * px, 48 * px, 440 * px)
        // Two calls with the same window give the same layout: there is nothing else it could depend on.
        assertEquals(a, DockLayout.of(1080f, 2200f, false, 8 * px, 64 * px, 48 * px, 440 * px))
        assertFalse(a.layersSlot.overlaps(a.stagesSlot))
        assertEquals(8 * px, a.stagesSlot.left - a.layersSlot.right, 0.6f)
        for (f in listOf(a.layersFrame, a.stagesFrame)) {
            assertTrue(f.bottom < a.top)
            assertEquals("both panels take the dock's column", a.left, f.x, 1e-3f)
            assertEquals(a.width, f.width, 1e-3f)
        }
        // A window too short for a panel still gets a glass at least a tile high, never a negative one.
        val tiny = DockLayout.of(1080f, 300f, true, 8 * px, 64 * px, 48 * px, 440 * px)
        assertTrue(tiny.layersFrame.maxHeight >= 64 * px)
    }

    @Test
    fun `a panel taller than its frame allows is held to the frame`() {
        val open = morphRect(tile, frame, panelHeight = 5_000f, p = 1f)
        assertEquals(frame.maxHeight, open.height, 1e-3f)
        assertEquals(frame.bottom, open.bottom, 1e-3f)
    }

    @Test
    fun `the tile's words leave before the panel's arrive, so two texts never share the glass`() {
        for (i in 0..100) {
            val p = i / 100f
            assertFalse("both readable at $p", tileAlpha(p) > 0.01f && panelAlpha(p) > 0.01f)
        }
        assertEquals(1f, tileAlpha(0f))
        assertEquals(0f, panelAlpha(0f))
        assertEquals(0f, tileAlpha(1f))
        assertEquals(1f, panelAlpha(1f))
    }

    @Test
    fun `round D - the morph springs settle quickly, never overshoot, and closing is quicker`() {
        val motion = MotionPolicy(reduced = false)
        fun run(spec: androidx.compose.animation.core.FiniteAnimationSpec<Float>): Pair<Long, Float> {
            val anim = androidx.compose.animation.core.TargetBasedAnimation(spec, Float.VectorConverter, 0f, 1f)
            var peak = 0f
            var t = 0L
            while (t <= anim.durationNanos) {
                val v = anim.getValueFromNanos(t)
                assertTrue("monotonic", v >= peak - 1e-4f)
                peak = maxOf(peak, v)
                t += 4_000_000L
            }
            return anim.durationNanos / 1_000_000L to peak
        }
        val (open, openPeak) = run(motion.morphOpen())
        val (close, closePeak) = run(motion.morphClose())
        assertTrue("opens in $open ms", open in 200..600)
        assertTrue("closes in $close ms", close in 150..open)
        assertTrue("no overshoot: $openPeak / $closePeak", openPeak <= 1.0005f && closePeak <= 1.0005f)
        // The incoming glass starts only once the outgoing one is all but home.
        assertTrue(MotionPolicy.MORPH_HANDOVER in 0f..0.1f)
    }

    @Test
    fun `with animations off the dock's surfaces cut instead of moving`() {
        val off = MotionPolicy(reduced = true)
        assertTrue(off.reduced)
        // The workspace snaps the morph when reduced; every other transition of the policy is none or a snap.
        assertEquals(androidx.compose.animation.EnterTransition.None, off.panelEnter(androidx.compose.ui.graphics.TransformOrigin.Center))
        assertTrue(off.enter<Float>() is androidx.compose.animation.core.SnapSpec)
    }

    @Test
    fun `the reference grid is a view setting, off at the start, and carried by no model change`() {
        assertFalse(ViewerState().grid)
        val on = ViewerState().copy(grid = true)
        // Layers, isolation and the construction axis never touch it.
        val scene = TestScenes.marcowki
        assertTrue(on.withVisibility(scene, com.buildplan.preview.scene.VisibilityMode.ROOF_OFF).grid)
        assertTrue(on.showAll().grid)
        assertTrue(on.withConstruction(emptySet()).grid)
    }

    @Test
    fun `the menu's stages and the STAGES launch extra still name a place the shell can hold`() {
        assertEquals(ShellState(sheet = Sheet.STAGES), ShellState.decode("STAGES"))
        assertEquals(ShellState(sheet = Sheet.TOOLS), ShellState.decode("HOUSE:TOOLS"))
        assertEquals(ShellState(), ShellState().open(Sheet.TOOLS).back())
    }

    @Test
    fun `the whole house is centred in the free span, and fills it`() {
        val portrait = ContentFrame.fitSpan(720, 1600, ContentInsets(top = 250, right = 0, bottom = 220))
        val landscape = ContentFrame.fitSpan(1600, 720, ContentInsets(top = 150, right = 0, bottom = 130))
        for (scene in listOf(TestScenes.scene("marcowki-c-v35414"), TestScenes.marcowki, TestScenes.demo)) {
            val hull = hullOf(scene)
            val camera = OrbitCamera(scene.bounds, hull = hull)
            for (span in listOf(portrait, landscape)) {
                val pose = camera.home(span)
                assertEquals(Projection.PERSPECTIVE, pose.projection)
                val (x, y) = extent(camera, pose, hull, span)
                assertTrue("${scene.key}: inside horizontally ${x.first}..${x.second}", x.first >= -1.0 / OrbitCamera.BOX_MARGIN - 1e-6 && x.second <= 1.0 / OrbitCamera.BOX_MARGIN + 1e-6)
                assertTrue("${scene.key}: inside vertically ${y.first}..${y.second}", y.first >= -1.0 / OrbitCamera.BOX_MARGIN - 1e-6 && y.second <= 1.0 / OrbitCamera.BOX_MARGIN + 1e-6)
                assertEquals("${scene.key}: centred left-right", 0.0, (x.first + x.second) / 2.0, 0.01)
                assertEquals("${scene.key}: centred up-down", 0.0, (y.first + y.second) / 2.0, 0.01)
                // It uses the space: one pair of sides reaches the margin.
                val reach = maxOf(x.second - x.first, y.second - y.first) / 2.0
                assertTrue("${scene.key}: fills only $reach", reach >= 1.0 / OrbitCamera.BOX_MARGIN - 0.01 || pose.distance <= camera.minDistance + 1e-9)
            }
        }
    }

    @Test
    fun `an L-shaped house is framed larger by its own pieces than by its one box`() {
        val scene = TestScenes.scene("marcowki-c-v35414")
        val span = ContentFrame.fitSpan(720, 1600, ContentInsets(top = 250, right = 0, bottom = 220))
        val byBox = OrbitCamera(scene.bounds).home(span)
        val byPieces = OrbitCamera(scene.bounds, hull = hullOf(scene)).home(span)
        assertTrue("closer: ${byPieces.distance} < ${byBox.distance}", byPieces.distance < byBox.distance)
    }

    private fun hullOf(scene: ModelScene): List<Vec3> = scene.objects.filter { it.hasGeometry && !it.bounds.isEmpty }.flatMap { it.bounds.corners() }

    /** The points' projected extent as shares of the free half-field, horizontally and vertically. */
    private fun extent(camera: OrbitCamera, pose: com.buildplan.preview.camera.OrbitPose, points: List<Vec3>, span: OrbitCamera.FitSpan): Pair<Pair<Double, Double>, Pair<Double, Double>> {
        val tanHalf = tan(Math.toRadians(camera.fovDeg) / 2.0)
        val b = camera.basis(pose)
        val eye = camera.eye(pose)
        var minX = Double.MAX_VALUE; var maxX = -Double.MAX_VALUE; var minY = Double.MAX_VALUE; var maxY = -Double.MAX_VALUE
        for (p in points) {
            val q = p - eye
            val depth = q dot b.forward
            val x = (q dot b.right) / depth / (tanHalf * span.horizontal)
            val y = (q dot b.up) / depth / (tanHalf * span.vertical)
            minX = minOf(minX, x); maxX = maxOf(maxX, x); minY = minOf(minY, y); maxY = maxOf(maxY, y)
        }
        assertTrue(abs(minX) < 10 && abs(maxY) < 10)
        return (minX to maxX) to (minY to maxY)
    }
}
