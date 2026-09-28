package com.buildplan.preview

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Rect
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import android.provider.Settings
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.SemanticsProperties
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.lifecycle.ViewModelProvider
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import com.buildplan.preview.render.RenderDiagnostics
import com.buildplan.preview.ui.AnalyzerViewModel
import com.buildplan.preview.ui.PreviewViewModel
import com.buildplan.preview.ui.ProgressViewModel
import java.io.File
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue

/**
 * What the INTEGRATION-003C product tests share: finding the app's view
 * models, driving the navigation bar by its semantics, waiting for the
 * renderer, and saving screenshots with a manifest a CI script validates.
 *
 * Screenshots are the display as the compositor put it together
 * (UiAutomation), so the Filament surface and the Compose chrome over it are
 * both in the picture — what the owner sees.
 */
class Evidence(private val compose: ComposeTestRule, folder: String, private val prefix: String) {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    val app = instrumentation.targetContext
    val out = File(app.getExternalFilesDir(null), folder).apply { mkdirs() }
    private val captures = mutableListOf<JsonObject>()
    private val facts = linkedMapOf<String, JsonPrimitive>()

    fun preview(scenario: ActivityScenario<MainActivity>): PreviewViewModel = viewModel(scenario, PreviewViewModel::class.java)
    fun progress(scenario: ActivityScenario<MainActivity>): ProgressViewModel = viewModel(scenario, ProgressViewModel::class.java)
    fun analyzer(scenario: ActivityScenario<MainActivity>): AnalyzerViewModel = viewModel(scenario, AnalyzerViewModel::class.java)

    private fun <T : androidx.lifecycle.ViewModel> viewModel(scenario: ActivityScenario<MainActivity>, type: Class<T>): T {
        var model: T? = null
        scenario.onActivity { model = ViewModelProvider(it)[type] }
        return checkNotNull(model)
    }

    /** A place in the bottom bar: a tab with this label (a button on Dom may carry the same word). */
    fun tab(label: String): SemanticsMatcher =
        hasText(label) and hasClickAction() and SemanticsMatcher.expectValue(SemanticsProperties.Role, Role.Tab)

    fun string(id: Int, vararg args: Any): String = app.getString(id, *args)

    /** Wait until a node matching [matcher] is on screen: screens settle over a few frames. */
    fun awaitNode(matcher: SemanticsMatcher, unmerged: Boolean = false, timeoutMs: Long = NODE_TIMEOUT_MS) {
        compose.waitUntil(timeoutMs) { compose.onAllNodes(matcher, useUnmergedTree = unmerged).fetchSemanticsNodes().isNotEmpty() }
    }

    /** Wait until the 3D viewport draws the model, then let it draw a little more. */
    fun awaitRenderer(model: PreviewViewModel, step: String, frames: Long = SETTLE_FRAMES): RenderDiagnostics {
        compose.waitUntil(RENDER_TIMEOUT_MS) { model.renderDiagnostics?.ready == true }
        val d = checkNotNull(model.renderDiagnostics) { "$step: no viewport is composed" }
        settleFrames(d, frames)
        assertTrue("$step: swap chain alive (${d.summary()})", d.swapChainAlive)
        assertTrue("$step: viewport has a size", d.viewportWidth > 0 && d.viewportHeight > 0)
        assertTrue("$step: renderables in the scene", d.sceneRenderables > 0)
        assertTrue("$step: camera finite", d.cameraFinite)
        assertEquals("$step: exactly one Filament engine", 1, RenderDiagnostics.liveEngines.get())
        return d
    }

    /** Let the renderer draw [frames] more frames, so the next screenshot shows the latest state. */
    fun settleFrames(d: RenderDiagnostics, frames: Long = 12) {
        val target = d.framesRendered.get() + frames
        compose.waitUntil(RENDER_TIMEOUT_MS) { d.framesRendered.get() >= target }
        compose.waitForIdle()
        instrumentation.waitForIdleSync()
    }

    /** Save the screen as `<prefix>-<name>.png` and record it, with any facts about this moment. */
    fun capture(name: String, vararg notes: Pair<String, Any?>): Bitmap {
        compose.waitForIdle()
        instrumentation.waitForIdleSync()
        val (bitmap, via) = screen()
        val file = File(out, "$prefix-$name.png")
        file.outputStream().use { bitmap.compress(Bitmap.CompressFormat.PNG, 100, it) }
        captures += JsonObject(
            mapOf(
                "file" to JsonPrimitive(file.name),
                "width" to JsonPrimitive(bitmap.width),
                "height" to JsonPrimitive(bitmap.height),
                "via" to JsonPrimitive(via),
            ) + notes.associate { (k, v) -> k to JsonPrimitive(v?.toString()) },
        )
        return bitmap
    }

    /**
     * The display as composed. UiAutomation gives the compositor one second to
     * hand over a frame; an emulator drawing the 3D view in software can take
     * longer, and then it returns null. Try it a few times, then ask the shell's
     * `screencap`, which waits as long as the frame takes.
     */
    private fun screen(): Pair<Bitmap, String> {
        repeat(SCREENSHOT_ATTEMPTS) { attempt ->
            instrumentation.uiAutomation.takeScreenshot()?.let { return it to "uiautomation#${attempt + 1}" }
            SystemClock.sleep(SCREENSHOT_RETRY_MS)
        }
        val bytes = ParcelFileDescriptor.AutoCloseInputStream(instrumentation.uiAutomation.executeShellCommand("screencap -p")).use { it.readBytes() }
        val bitmap = checkNotNull(BitmapFactory.decodeByteArray(bytes, 0, bytes.size)) { "neither UiAutomation nor screencap produced a screenshot (${bytes.size} B)" }
        return bitmap to "screencap"
    }

    fun fact(key: String, value: Any?) {
        facts[key] = JsonPrimitive(value?.toString())
    }

    /** The manifest the CI validator reads: every capture, its size, and the facts recorded. */
    fun writeManifest() {
        facts["animatorDurationScale"] = JsonPrimitive(Settings.Global.getFloat(app.contentResolver, Settings.Global.ANIMATOR_DURATION_SCALE, 1f).toString())
        facts["fontScale"] = JsonPrimitive(app.resources.configuration.fontScale.toString())
        val manifest = JsonObject(
            mapOf(
                "prefix" to JsonPrimitive(prefix),
                "captures" to JsonArray(captures),
                "facts" to JsonObject(facts),
            ),
        )
        File(out, "$prefix-manifest.json").writeText(Json { prettyPrint = true }.encodeToString(JsonObject.serializer(), manifest))
    }

    companion object {
        const val RENDER_TIMEOUT_MS = 45_000L
        const val SETTLE_FRAMES = 20L
        const val NODE_TIMEOUT_MS = 10_000L
        private const val SCREENSHOT_ATTEMPTS = 3
        private const val SCREENSHOT_RETRY_MS = 400L

        /** Mean absolute luminance difference (0–255) of two screenshots over a region. */
        fun difference(a: Bitmap, b: Bitmap, region: Rect): Double {
            val r = Rect(region)
            if (!r.intersect(0, 0, minOf(a.width, b.width), minOf(a.height, b.height))) return 0.0
            val ra = IntArray(r.width())
            val rb = IntArray(r.width())
            var sum = 0.0
            var n = 0
            var y = r.top
            while (y < r.bottom) {
                a.getPixels(ra, 0, r.width(), r.left, y, r.width(), 1)
                b.getPixels(rb, 0, r.width(), r.left, y, r.width(), 1)
                var x = 0
                while (x < ra.size) {
                    sum += kotlin.math.abs(luminance(ra[x]) - luminance(rb[x]))
                    n++
                    x += 2
                }
                y += 2
            }
            return if (n == 0) 0.0 else sum / n
        }

        private fun luminance(c: Int): Double =
            0.2126 * ((c shr 16) and 0xff) + 0.7152 * ((c shr 8) and 0xff) + 0.0722 * (c and 0xff)

        /** How many pixels in [region] stand out from the ground (luminance above [threshold]): lines drawn, text set. */
        fun inkPixels(b: Bitmap, region: Rect, threshold: Double = 90.0): Int {
            val r = Rect(region)
            if (!r.intersect(0, 0, b.width, b.height)) return 0
            val row = IntArray(r.width())
            var n = 0
            for (y in r.top until r.bottom) {
                b.getPixels(row, 0, r.width(), r.left, y, r.width(), 1)
                for (c in row) if (luminance(c) > threshold) n++
            }
            return n
        }

        /** The part of the screen between the chrome where the house stands. */
        fun modelRegion(b: Bitmap): Rect = Rect((b.width * 0.08).toInt(), (b.height * 0.22).toInt(), (b.width * 0.78).toInt(), (b.height * 0.62).toInt())
    }
}
