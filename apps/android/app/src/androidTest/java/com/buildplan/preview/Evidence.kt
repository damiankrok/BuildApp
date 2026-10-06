package com.buildplan.preview

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Rect
import android.os.ParcelFileDescriptor
import android.os.SystemClock
import android.provider.Settings
import androidx.compose.ui.test.SemanticsMatcher
import androidx.test.espresso.Espresso
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.hasAnyAncestor
import androidx.compose.ui.test.hasAnyDescendant
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.junit4.ComposeTestRule
import androidx.lifecycle.ViewModelProvider
import androidx.test.core.app.ActivityScenario
import androidx.test.platform.app.InstrumentationRegistry
import androidx.test.runner.lifecycle.ActivityLifecycleMonitorRegistry
import androidx.test.runner.lifecycle.Stage
import com.buildplan.preview.render.RenderDiagnostics
import com.buildplan.preview.ui.AnalyzerViewModel
import com.buildplan.preview.ui.PreviewViewModel
import com.buildplan.preview.ui.ProgressViewModel
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
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

    /** Starts the app from no remembered house (cycle 3, H-03): the bundled first house opens. */
    fun forgetOpenHouse() {
        app.deleteSharedPreferences("preview")
    }
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

    /** The house menu button in the workspace's top context. */
    fun menuButton(): SemanticsMatcher = hasContentDescription(string(R.string.workspace_menu))

    /** A clickable whose action is labelled [label] (its `onClickLabel`), whatever text it prints. */
    fun hasClickLabel(label: String): SemanticsMatcher =
        SemanticsMatcher("click label '$label'") { it.config.getOrNull(SemanticsActions.OnClick)?.label == label }

    /** The selection row's way into the details: the row prints the element's storey, its action says "Szczegóły". */
    fun detailsHandle(): SemanticsMatcher = hasClickLabel(string(R.string.dock_details))

    /**
     * The stage sheet is open: its heading is composed when the sheet opens at the top (progress unset),
     * and the current stage's editor when it opens scrolled to the stage in progress (progress set).
     */
    fun stageSheet(): SemanticsMatcher = hasText(string(R.string.stages_title)) or hasText(string(R.string.stage_completion))

    fun awaitStageSheet() = awaitNode(stageSheet())

    /**
     * Close a sheet by the system back: the keyboard first (a back that reaches a still-open keyboard
     * closes the keyboard, not the sheet), then back, until nothing matching [open] is left.
     */
    fun closeSheet(open: SemanticsMatcher) {
        Espresso.closeSoftKeyboard()
        Espresso.pressBack()
        val gone = { compose.onAllNodes(open).fetchSemanticsNodes().isEmpty() }
        try {
            compose.waitUntil(5_000) { gone() }
        } catch (e: androidx.compose.ui.test.ComposeTimeoutException) {
            Espresso.pressBack()
            compose.waitUntil(5_000) { gone() }
        }
    }

    /** Open the house menu and choose a row by its label. */
    fun openMenu(compose: androidx.compose.ui.test.junit4.ComposeTestRule, label: String) {
        compose.onNode(menuButton()).performClick()
        awaitNode(hasText(label) and hasClickAction())
        compose.onAllNodes(hasText(label) and hasClickAction())[0].performClick()
    }

    /** Leave the house for the analyzer task through the menu: the viewport and its engine go away. */
    fun openAnalyzerTask(compose: androidx.compose.ui.test.junit4.ComposeTestRule, preview: PreviewViewModel) {
        openMenu(compose, string(R.string.house_add_action))
        awaitNode(hasText(string(R.string.analyzer_title)))
        compose.waitUntil(RENDER_TIMEOUT_MS) { preview.renderDiagnostics == null }
    }

    fun string(id: Int, vararg args: Any): String = app.getString(id, *args)

    /** A plural as the app shows it: by Polish rules, whatever the device's language (MainActivity pins them). */
    fun plural(id: Int, count: Int, vararg args: Any): String {
        val config = android.content.res.Configuration(app.resources.configuration).apply { setLocale(PRODUCT_LOCALE) }
        return app.createConfigurationContext(config).resources.getQuantityString(id, count, *args)
    }

    /** Wait until a node matching [matcher] is on screen: screens settle over a few frames. */
    fun awaitNode(matcher: SemanticsMatcher, unmerged: Boolean = false, timeoutMs: Long = NODE_TIMEOUT_MS) {
        compose.waitUntil(timeoutMs) { compose.onAllNodes(matcher, useUnmergedTree = unmerged).fetchSemanticsNodes().isNotEmpty() }
    }

    /**
     * Wait until exactly one node matches [matcher], or fail saying how many there were. Counting goes through
     * `fetchSemanticsNodes`, which reads the tree on the UI thread; Compose's own "expected one node" message is
     * built on the test thread and, while the UI thread is still laying out, trips `SnapshotStateObserver`'s
     * thread check and hides the real mismatch (005J run 181).
     */
    fun awaitExactlyOne(matcher: SemanticsMatcher, what: String, timeoutMs: Long = NODE_TIMEOUT_MS) {
        var found = -1
        try {
            compose.waitUntil(timeoutMs) { compose.onAllNodes(matcher).fetchSemanticsNodes().size.also { found = it } == 1 }
        } catch (e: androidx.compose.ui.test.ComposeTimeoutException) {
            throw AssertionError("$what: expected exactly one node, found $found after ${timeoutMs / 1000} s", e)
        }
    }

    /** Click the one node [matcher] finds, once there is exactly one (see [awaitExactlyOne]). */
    fun clickExactlyOne(matcher: SemanticsMatcher, what: String) {
        awaitExactlyOne(matcher, what)
        compose.onNode(matcher).performClick()
    }

    /**
     * The stage sheet's list: the scrolling node that holds stage rows, each a clickable that says its state in
     * words. At most one stage is in progress, so a done or a not-started row is always on screen. The house
     * behind the modal sheet stays in the semantics tree, with scrolling nodes and a timeline head that prints a
     * stage's name and is clickable, so neither "the first scrolling node" nor a stage's name alone is the sheet.
     */
    fun stageList(): SemanticsMatcher =
        hasScrollAction() and hasAnyDescendant(hasClickAction() and (hasText(string(R.string.stage_status_done)) or hasText(string(R.string.stage_status_not_started))))

    /**
     * Open the stage named [label] on the stage sheet and bring its actions into view (005K Phase 0). Every step
     * waits for the sheet to settle and for exactly one node to act on: the previous edit's change may still be
     * composing when the next stage is looked up.
     */
    fun openStage(label: String) {
        val list = stageList()
        compose.waitForIdle()
        awaitExactlyOne(list, "the stage sheet's list")
        compose.onNode(list).performScrollToNode(hasText(label))
        val row = hasText(label) and hasClickAction() and hasAnyAncestor(list)
        awaitExactlyOne(row, "the stage row '$label'")
        compose.onNode(row).performClick()
        compose.waitForIdle()
        awaitExactlyOne(list, "the stage sheet's list")
        compose.onNode(list).performScrollToNode(hasText(string(R.string.stage_show_in_3d)) or hasText(string(R.string.stage_show_now)))
    }

    /**
     * Wait until the 3D viewport draws the model, then let it draw a little
     * more. After the activity is recreated, pass the old canvas's diagnostics
     * as [replacing]: until the old canvas is torn down it still reads ready.
     */
    fun awaitRenderer(model: PreviewViewModel, step: String, frames: Long = SETTLE_FRAMES, replacing: RenderDiagnostics? = null): RenderDiagnostics {
        compose.waitUntil(RENDER_TIMEOUT_MS) { model.renderDiagnostics.let { it != null && it !== replacing && it.ready } }
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
        awaitPresented()
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
     * Compose being idle means the frame is recorded, not that it is on the
     * display: an emulator drawing in software hands frames to the compositor
     * a second or more later, and a screenshot then shows the previous screen.
     * Redraw the window and wait until that frame has been submitted to its
     * swap chain — twice, so the one showing the latest state is through — and
     * give the compositor a moment to put it on the display.
     */
    private fun awaitPresented() {
        repeat(2) {
            val committed = CountDownLatch(1)
            instrumentation.runOnMainSync {
                val activity = ActivityLifecycleMonitorRegistry.getInstance().getActivitiesInStage(Stage.RESUMED).firstOrNull()
                val decor = activity?.window?.decorView
                if (decor == null) {
                    committed.countDown()
                } else {
                    decor.viewTreeObserver.registerFrameCommitCallback { committed.countDown() }
                    decor.invalidate()
                }
            }
            check(committed.await(PRESENT_TIMEOUT_MS, TimeUnit.MILLISECONDS)) { "the window never committed a frame" }
        }
        SystemClock.sleep(COMPOSITOR_MS)
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

    /**
     * Cycle 1, C1-01: the whole house stands inside the space the chrome
     * leaves free. The strips along the free rectangle's left and right
     * edges (3 % of the width each, between the top context and the
     * timeline) must hold almost no bright pixels — a wall reaching the edge
     * of the screen, or running under the tool rail, fills them.
     */
    fun assertHouseInsideFreeArea(model: PreviewViewModel, shot: Bitmap, step: String) {
        val i = model.contentInsets
        val strip = (shot.width * 0.03).toInt()
        val top = i.top
        val bottom = shot.height - i.bottom
        val left = inkPixels(shot, Rect(i.left, top, i.left + strip, bottom), HOUSE_LUMINANCE)
        val right = inkPixels(shot, Rect(shot.width - i.right - strip, top, shot.width - i.right, bottom), HOUSE_LUMINANCE)
        fact("$step: free area", "l=${i.left} t=${i.top} r=${i.right} b=${i.bottom}")
        // The chrome is reported: the top context, the rail and the timeline each take their edge —
        // a house framed as if the timeline were not there stands under its glass.
        assertTrue("$step: the chrome's footprint is reported (t=${i.top} r=${i.right} b=${i.bottom})", i.top > 0 && i.right > 0 && i.bottom > 0)
        fact("$step: house pixels at the free area's left / right edge", "$left / $right")
        assertTrue("$step: the house reaches the left edge of the free area ($left bright pixels)", left <= EDGE_TOLERANCE)
        assertTrue("$step: the house runs under the tool rail ($right bright pixels)", right <= EDGE_TOLERANCE)
        // …and it uses the room it has (finish review, F-01): framed by a bounding sphere with a margin,
        // the house's walls spanned 54 % of the free width on a phone and 47 % of the free height on its side.
        val free = Rect(i.left, top, shot.width - i.right, bottom)
        val (spanW, spanH) = brightExtent(shot, free, HOUSE_LUMINANCE)
        val fill = maxOf(spanW.toDouble() / free.width(), spanH.toDouble() / free.height())
        fact("$step: house walls' extent in the free area (width / height)", "%.2f / %.2f".format(java.util.Locale.ROOT, spanW.toDouble() / free.width(), spanH.toDouble() / free.height()))
        assertTrue("$step: the house fills its free area ($fill of its longer side)", fill >= MIN_HOUSE_FILL)
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
        private const val PRESENT_TIMEOUT_MS = 10_000L
        private const val COMPOSITOR_MS = 250L

        /** Luminance above which a pixel is a lit wall, not the ground (#101419) or the grid's thin lines. */
        private const val HOUSE_LUMINANCE = 110.0

        /** Bright pixels an edge strip may hold without the house touching it: antialiasing, a stray grid crossing. */
        private const val EDGE_TOLERANCE = 60

        /** The walls' extent over the free area's limiting side at home: under it, the house is framed small. */
        private const val MIN_HOUSE_FILL = 0.55

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

        /** The width and height of the box around every pixel brighter than [threshold] in [region]. */
        fun brightExtent(b: Bitmap, region: Rect, threshold: Double): Pair<Int, Int> {
            val r = Rect(region)
            if (!r.intersect(0, 0, b.width, b.height)) return 0 to 0
            val row = IntArray(r.width())
            var minX = Int.MAX_VALUE
            var maxX = Int.MIN_VALUE
            var minY = Int.MAX_VALUE
            var maxY = Int.MIN_VALUE
            for (y in r.top until r.bottom) {
                b.getPixels(row, 0, r.width(), r.left, y, r.width(), 1)
                for ((k, c) in row.withIndex()) {
                    if (luminance(c) <= threshold) continue
                    minX = minOf(minX, k); maxX = maxOf(maxX, k)
                    minY = minOf(minY, y); maxY = maxOf(maxY, y)
                }
            }
            return if (maxX < minX) 0 to 0 else (maxX - minX) to (maxY - minY)
        }

        /** The part of the screen between the chrome where the house stands. */
        fun modelRegion(b: Bitmap): Rect = Rect((b.width * 0.08).toInt(), (b.height * 0.22).toInt(), (b.width * 0.78).toInt(), (b.height * 0.62).toInt())
    }
}
