package com.buildplan.preview

import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Rect
import android.os.Handler
import android.os.HandlerThread
import android.view.PixelCopy
import android.view.SurfaceView
import android.view.TextureView
import android.view.View
import android.view.ViewGroup
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.performClick
import androidx.lifecycle.ViewModelProvider
import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.Espresso
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.buildplan.preview.render.RenderDiagnostics
import com.buildplan.preview.render.RenderSurfaceKind
import com.buildplan.preview.ui.PreviewViewModel
import com.buildplan.preview.ui.ShellState
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The P0 gate of INTEGRATION-003C: the 3D place must draw the house when it
 * is reached the way the owner reaches it — cold start on Dom, then a tap on
 * `3D` in the navigation bar — and again after leaving it and coming back.
 * A direct launch into 3D (the path every earlier screenshot took) is checked
 * beside it.
 *
 * Two questions are asked separately, because a blank viewport has two very
 * different causes:
 *
 * 1. Did the renderer draw? The viewport's own [RenderDiagnostics]: a swap
 *    chain, a size, an uploaded model with renderables in the scene, a finite
 *    camera and frames drawn. And the render surface's own pixels (PixelCopy
 *    of a SurfaceView, or a TextureView's bitmap): what Filament produced.
 * 2. Did the screen show it? The display, as the compositor put it together
 *    (UiAutomation's screenshot), compared with those surface pixels over
 *    the same region. A house on the surface and a flat colour on the screen
 *    is a compositing failure, not a rendering one.
 *
 * Instrumentation arguments (optional):
 *   renderSurface   SURFACE_VIEW or TEXTURE_VIEW; absent = the app's default
 *   reportName      prefix of the evidence files (default: the surface kind)
 *
 * Evidence — PNGs of the surface and the screen, and one JSON per step — goes
 * to the app's external files folder, `model-entry/`, which CI pulls.
 */
@RunWith(AndroidJUnit4::class)
class ModelEntryDeviceTest {
    @get:Rule
    val compose = createEmptyComposeRule()

    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val app = instrumentation.targetContext
    private val args = InstrumentationRegistry.getArguments()
    private val surface: RenderSurfaceKind? = RenderSurfaceKind.decode(args.getString("renderSurface"))
    private val reportName = args.getString("reportName") ?: (surface?.name ?: "default")
    private val out = File(app.getExternalFilesDir(null), "model-entry").apply { mkdirs() }
    private val json = Json { prettyPrint = true }
    private val copyThread = HandlerThread("pixel-copy").apply { start() }

    private var scenario: ActivityScenario<MainActivity>? = null

    @Before
    fun setUp() {
        // No engine may be left over from an earlier test in this process.
        assertEquals("live Filament engines before the test", 0, RenderDiagnostics.liveEngines.get())
    }

    @After
    fun tearDown() {
        scenario?.close()
        copyThread.quitSafely()
    }

    @Test
    fun domThen3dThroughTheNavigationBarDrawsTheHouseAndAgainAfterBack() {
        val scenario = launch(extraPlace = null).also { this.scenario = it }
        val model = viewModelOf(scenario)

        // Cold start lands on Dom: no viewport, no engine.
        compose.onNode(hasText(app.getString(R.string.place_house)) and hasClickAction()).assertExists()
        assertNull("Dom composes no viewport", model.renderDiagnostics)
        assertEquals("no engine on Dom", 0, RenderDiagnostics.liveEngines.get())
        captureScreen("$reportName-dom-before")

        // Dom -> 3D, through the navigation bar as the owner does it.
        compose.onNode(hasText(app.getString(R.string.place_model)) and hasClickAction()).performClick()
        val first = awaitRenderer(model, "first entry")
        val firstPixels = evidence(scenario, first, "$reportName-dom-to-3d-first")

        // Back to Dom: the viewport and its engine are gone.
        Espresso.pressBack()
        compose.waitUntil(TIMEOUT_MS) { model.renderDiagnostics == null }
        compose.onNode(hasText(app.getString(R.string.place_house)) and hasClickAction()).assertExists()
        assertTrue("the first viewport was destroyed on back", first.destroyed)
        assertEquals("no engine after leaving 3D", 0, RenderDiagnostics.liveEngines.get())

        // Dom -> 3D again.
        compose.onNode(hasText(app.getString(R.string.place_model)) and hasClickAction()).performClick()
        val second = awaitRenderer(model, "second entry")
        val secondPixels = evidence(scenario, second, "$reportName-dom-to-3d-second")

        assertDisplayed(firstPixels, "first entry")
        assertDisplayed(secondPixels, "second entry")
    }

    @Test
    fun direct3dLaunchDrawsTheHouse() {
        val scenario = launch(extraPlace = "MODEL").also { this.scenario = it }
        val model = viewModelOf(scenario)
        val diagnostics = awaitRenderer(model, "direct launch")
        val pixels = evidence(scenario, diagnostics, "$reportName-direct-3d")
        assertDisplayed(pixels, "direct launch")
    }

    // -----------------------------------------------------------------------

    private fun launch(extraPlace: String?): ActivityScenario<MainActivity> {
        val intent = Intent(app, MainActivity::class.java)
        extraPlace?.let { intent.putExtra(ShellState.EXTRA_PLACE, it) }
        surface?.let { intent.putExtra(RenderSurfaceKind.EXTRA, it.name) }
        return ActivityScenario.launch(intent)
    }

    private fun viewModelOf(scenario: ActivityScenario<MainActivity>): PreviewViewModel {
        var model: PreviewViewModel? = null
        scenario.onActivity { model = ViewModelProvider(it)[PreviewViewModel::class.java] }
        return checkNotNull(model)
    }

    /** Wait until the viewport says it is drawing the model, then let it draw a little longer. */
    private fun awaitRenderer(model: PreviewViewModel, step: String): RenderDiagnostics {
        compose.waitUntil(TIMEOUT_MS) { model.renderDiagnostics?.ready == true }
        val diagnostics = checkNotNull(model.renderDiagnostics) { "$step: no viewport is composed" }
        val target = diagnostics.framesRendered.get() + SETTLE_FRAMES
        compose.waitUntil(TIMEOUT_MS) { diagnostics.framesRendered.get() >= target }
        instrumentation.waitForIdleSync()

        assertTrue("$step: swap chain alive (${diagnostics.summary()})", diagnostics.swapChainAlive)
        assertTrue("$step: swap chain created at least once", diagnostics.swapChainsCreated.get() >= 1)
        assertTrue("$step: surface resized at least once", diagnostics.resizes.get() >= 1)
        assertTrue("$step: viewport has a size", diagnostics.viewportWidth > 0 && diagnostics.viewportHeight > 0)
        assertTrue("$step: UiHelper ready", diagnostics.uiHelperReady)
        assertTrue("$step: model uploaded", diagnostics.modelUploads >= 1)
        assertTrue("$step: renderables in the scene", diagnostics.sceneRenderables > 0 && diagnostics.visibleObjects > 0)
        assertTrue("$step: camera finite", diagnostics.cameraFinite)
        assertTrue("$step: several frames drawn", diagnostics.framesRendered.get() >= SETTLE_FRAMES)
        assertEquals("$step: exactly one Filament engine", 1, RenderDiagnostics.liveEngines.get())
        return diagnostics
    }

    private data class Pixels(val surface: RegionStats?, val screen: RegionStats)

    /**
     * Save the surface's own pixels and the screen's, over the viewport's
     * middle (clear of the top strip and the dock), with the counters.
     */
    private fun evidence(scenario: ActivityScenario<MainActivity>, diagnostics: RenderDiagnostics, name: String): Pixels {
        var renderView: View? = null
        var onScreen = Rect()
        scenario.onActivity { activity ->
            renderView = findRenderView(activity.window.decorView)
            renderView?.let { v ->
                val at = IntArray(2)
                v.getLocationOnScreen(at)
                onScreen = Rect(at[0], at[1], at[0] + v.width, at[1] + v.height)
            }
        }
        val view = checkNotNull(renderView) { "$name: no render view in the hierarchy" }
        val middle = { w: Int, h: Int -> Rect((w * 0.15).toInt(), (h * 0.30).toInt(), (w * 0.85).toInt(), (h * 0.65).toInt()) }

        val surfaceBitmap = surfacePixels(scenario, view)
        val surfaceStats = surfaceBitmap?.let { bmp ->
            save(bmp, "$name-surface")
            RegionStats.of(bmp, middle(bmp.width, bmp.height))
        }

        val screen = instrumentation.uiAutomation.takeScreenshot()
        save(screen, "$name-screen")
        val region = middle(onScreen.width(), onScreen.height()).apply { offset(onScreen.left, onScreen.top) }
        val screenStats = RegionStats.of(screen, region)

        val report = buildJsonObject {
            put("step", name)
            put("surfaceKind", diagnostics.surfaceKind.name)
            put("renderView", view.javaClass.simpleName)
            put("renderViewOnScreen", onScreen.flattenToString())
            put("diagnostics", diagnostics.summary())
            put("framesRendered", diagnostics.framesRendered.get())
            put("framesSkipped", diagnostics.framesSkipped.get())
            put("swapChainsCreated", diagnostics.swapChainsCreated.get())
            put("resizes", diagnostics.resizes.get())
            put("viewport", "${diagnostics.viewportWidth}x${diagnostics.viewportHeight}")
            put("sceneRenderables", diagnostics.sceneRenderables)
            put("visibleObjects", diagnostics.visibleObjects)
            put("cameraFinite", diagnostics.cameraFinite)
            put("liveEngines", RenderDiagnostics.liveEngines.get())
            put("surfacePixels", surfaceStats?.toJson() ?: JsonObject(emptyMap()))
            put("screenPixels", screenStats.toJson())
        }
        File(out, "$name.json").writeText(json.encodeToString(JsonObject.serializer(), report))
        return Pixels(surfaceStats, screenStats)
    }

    /**
     * What the screen shows must be what the renderer drew. When the surface
     * holds a picture (more than a flat background), the screen over the
     * same region must hold most of it; a flat screen over a drawn surface is
     * exactly the owner's blank 3D.
     */
    private fun assertDisplayed(pixels: Pixels, step: String) {
        val surface = pixels.surface ?: return
        if (surface.nonBackgroundFraction < DRAWN_FRACTION) return
        assertTrue(
            "$step: the renderer drew the house (${surface.nonBackgroundFraction} of the surface is not background) " +
                "but the screen shows ${pixels.screen.nonBackgroundFraction} — the surface is not composited",
            pixels.screen.nonBackgroundFraction >= surface.nonBackgroundFraction * 0.5,
        )
    }

    private fun surfacePixels(scenario: ActivityScenario<MainActivity>, view: View): Bitmap? = when (view) {
        is TextureView -> {
            var bmp: Bitmap? = null
            scenario.onActivity { bmp = view.bitmap }
            bmp
        }
        is SurfaceView -> {
            if (view.width <= 0 || view.height <= 0) {
                null
            } else {
                val bmp = Bitmap.createBitmap(view.width, view.height, Bitmap.Config.ARGB_8888)
                val done = CountDownLatch(1)
                var result = -1
                PixelCopy.request(view, bmp, { r -> result = r; done.countDown() }, Handler(copyThread.looper))
                done.await(10, TimeUnit.SECONDS)
                if (result == PixelCopy.SUCCESS) bmp else null
            }
        }
        else -> null
    }

    private fun findRenderView(root: View): View? {
        if (root is SurfaceView || root is TextureView) return root
        if (root is ViewGroup) for (i in 0 until root.childCount) findRenderView(root.getChildAt(i))?.let { return it }
        return null
    }

    private fun captureScreen(name: String) {
        save(instrumentation.uiAutomation.takeScreenshot(), "$name-screen")
    }

    private fun save(bitmap: Bitmap, name: String) {
        File(out, "$name.png").outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
    }

    private companion object {
        const val TIMEOUT_MS = 30_000L
        const val SETTLE_FRAMES = 30L

        /** A surface with more than this share of non-background pixels in its middle has a picture on it. */
        const val DRAWN_FRACTION = 0.05
    }
}

/**
 * Pixel facts over one rectangle: how much of it differs from the viewport
 * background (#12151A, the colour of the window, the Compose surface and
 * Filament's clear alike), and how many distinct colours it holds.
 */
data class RegionStats(
    val region: String,
    val pixels: Int,
    val nonBackgroundFraction: Double,
    val distinctColours: Int,
    val meanLuminance: Double,
) {
    fun toJson(): JsonObject = buildJsonObject {
        put("region", region)
        put("pixels", pixels)
        put("nonBackgroundFraction", nonBackgroundFraction)
        put("distinctColours", distinctColours)
        put("meanLuminance", meanLuminance)
    }

    companion object {
        private const val BG_R = 0x12
        private const val BG_G = 0x15
        private const val BG_B = 0x1a
        private const val TOLERANCE = 12

        fun of(bitmap: Bitmap, rect: Rect): RegionStats {
            val r = Rect(rect)
            if (!r.intersect(0, 0, bitmap.width, bitmap.height)) return RegionStats(rect.flattenToString(), 0, 0.0, 0, 0.0)
            var count = 0
            var differs = 0
            var luminance = 0.0
            val colours = HashSet<Int>()
            val row = IntArray(r.width())
            for (y in r.top until r.bottom) {
                bitmap.getPixels(row, 0, r.width(), r.left, y, r.width(), 1)
                for (c in row) {
                    val red = (c shr 16) and 0xff
                    val green = (c shr 8) and 0xff
                    val blue = c and 0xff
                    count++
                    if (kotlin.math.abs(red - BG_R) > TOLERANCE || kotlin.math.abs(green - BG_G) > TOLERANCE || kotlin.math.abs(blue - BG_B) > TOLERANCE) differs++
                    luminance += 0.2126 * red + 0.7152 * green + 0.0722 * blue
                    colours.add(((red shr 3) shl 10) or ((green shr 3) shl 5) or (blue shr 3))
                }
            }
            return RegionStats(r.flattenToString(), count, if (count == 0) 0.0 else differs.toDouble() / count, colours.size, if (count == 0) 0.0 else luminance / count)
        }
    }
}
