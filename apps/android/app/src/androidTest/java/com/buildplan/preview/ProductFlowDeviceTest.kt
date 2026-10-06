package com.buildplan.preview

import android.content.Intent
import android.graphics.Bitmap
import android.os.SystemClock
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.ComposeTimeoutException
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.click
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTextReplacement
import androidx.compose.ui.test.performTouchInput
import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.Espresso
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.buildplan.preview.progress.ConstructionStageKey
import com.buildplan.preview.progress.ConstructionView
import com.buildplan.preview.progress.HouseId
import com.buildplan.preview.progress.ProgressStore
import com.buildplan.preview.progress.StageStatus
import com.buildplan.preview.progress.TimelineCursor
import com.buildplan.preview.render.RenderDiagnostics
import com.buildplan.preview.ui.PreviewViewModel
import com.buildplan.preview.ui.ProgressViewModel
import com.buildplan.preview.ui.RuleGeometry
import java.io.File
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * INTEGRATION-004A's house-first journey on a device, the owner's way — by
 * the Compose semantics of the real workspace, never by launching a surface
 * directly: a cold start lands on the house with nothing recorded; the
 * stage sheet opens from the rail and the progress is recorded through its
 * own controls; the sheet closes onto the same house at the same camera;
 * the time machine rewinds to the foundations, walls, roof and joinery and
 * "Wróć do teraz"; the layers pane; an element's details; the expanded
 * timeline; the house menu, the source sheet; the analyzer task, and the
 * return to the same house.
 *
 * Every step asserts what the product promises — the preview never changes
 * what was saved, each stage shows exactly its semantic objects, one
 * Filament engine, the camera untouched by any sheet or task — and saves a
 * screenshot to `ui-evidence/` with a manifest CI validates. The progress
 * entered here is TEST data on the emulator's copy of the built-in
 * reference house.
 *
 * Instrumentation argument `reportName` prefixes the files (`default`,
 * `font-1.3`).
 */
@RunWith(AndroidJUnit4::class)
class ProductFlowDeviceTest {
    @get:Rule
    val compose = createEmptyComposeRule()

    private val args = InstrumentationRegistry.getArguments()
    private val prefix = args.getString("reportName") ?: "default"
    private val evidence = Evidence(compose, "ui-evidence", prefix)
    private var scenario: ActivityScenario<MainActivity>? = null

    @Before
    fun setUp() {
        // The journey starts from nothing recorded: the store is the app's own folder.
        File(evidence.app.filesDir, "progress").deleteRecursively()
        evidence.forgetOpenHouse()
        assertEquals("live Filament engines before the test", 0, RenderDiagnostics.liveEngines.get())
    }

    @After
    fun tearDown() {
        evidence.writeManifest()
        scenario?.close()
    }

    @Test
    fun theOwnersJourneyOnTheHouse() {
        val scenario = ActivityScenario.launch<MainActivity>(Intent(evidence.app, MainActivity::class.java)).also { this.scenario = it }
        val preview = evidence.preview(scenario)
        val progress = evidence.progress(scenario)
        compose.waitUntil(Evidence.RENDER_TIMEOUT_MS) { progress.view != null && progress.sketch != null }
        val houseId = checkNotNull(progress.session?.houseId) { "the built-in house has a durable id" }
        evidence.fact("houseId", houseId)
        evidence.fact("reducedMotion", preview.reducedMotion)

        // 1. A cold start lands on the house: the whole design, "Postęp nieustawiony", one engine, no tabs.
        val first = evidence.awaitRenderer(preview, "cold start")
        evidence.awaitNode(hasText(evidence.string(R.string.progress_unset)))
        assertNull("unset progress shows the whole design", preview.viewer.construction)
        assertEquals("the workspace is the root", 1, RenderDiagnostics.liveEngines.get())
        evidence.assertHouseInsideFreeArea(preview, evidence.capture("01-house-unset", "visibleObjects" to first.visibleObjects), "01 house, progress unset")
        // The camera at home follows the chrome as the rail's header grows; a camera the owner has set is
        // never re-fitted. The owner nudges the house by a few pixels, and from here on the pose is theirs.
        compose.runOnIdle { preview.pan(NUDGE_PX, 0.0) }
        val poseAtRest = preview.pose

        // 2. "Ustaw postęp" on the rail opens the stage sheet over the house, headed by the house drawn in ink.
        compose.onNode(hasText(evidence.string(R.string.progress_set_action)) and hasClickAction()).performClick()
        evidence.awaitNode(hasText(evidence.string(R.string.stages_title)))
        assertDrawingInked(preview, progress, evidence.capture("02-stages-sheet-unset"), "02 stage sheet")

        // 3. Record progress through the sheet's own controls: stage 1 done by itself, Dach made current,
        //    then "Oznacz 6 wcześniejszych etapów jako zakończone" (it says the count before it acts),
        //    Dach at 40 %, a task.
        openStage(ConstructionStageKey.PLOT_PURCHASE)
        compose.onNode(hasText(evidence.string(R.string.stage_mark_done)) and hasClickAction()).performClick()
        compose.waitUntil(5_000) { progress.view?.stages?.firstOrNull { it.stageKey == ConstructionStageKey.PLOT_PURCHASE }?.status == StageStatus.DONE }
        openStage(ConstructionStageKey.ROOF)
        compose.onNode(hasText(evidence.string(R.string.stage_make_current)) and hasClickAction()).performClick()
        compose.waitUntil(5_000) { progress.view?.summary?.currentStage == ConstructionStageKey.ROOF }
        val earlier = evidence.plural(R.plurals.stage_mark_earlier_done, 6, 6)
        list().performScrollToNode(hasText(earlier))
        compose.onNode(hasText(earlier) and hasClickAction()).performClick()
        compose.waitUntil(5_000) { progress.view?.stages?.take(7)?.all { it.status == StageStatus.DONE } == true }
        assertEquals("the current stage stays current", ConstructionStageKey.ROOF, progress.view?.summary?.currentStage)
        evidence.fact("bulk action label", earlier)
        compose.onNode(SemanticsMatcher.keyIsDefined(SemanticsActions.SetProgress) and hasSetProgressOnly()).performSemanticsAction(SemanticsActions.SetProgress) { it(0.4f) }
        compose.waitUntil(5_000) { progress.view?.summary?.currentStageCompletionPercent == 40 }
        compose.onNode(hasSetTextAction()).performTextReplacement(TASK)
        list().performScrollToNode(hasText(evidence.string(R.string.stage_task_save)))
        compose.onNode(hasText(evidence.string(R.string.stage_task_save)) and hasClickAction()).performClick()
        compose.waitUntil(5_000) { progress.view?.summary?.currentTask == TASK }
        val summary = checkNotNull(progress.view).summary
        assertEquals("(7 + 0.4) / 17 stages, rounded down", 43, summary.percent)
        evidence.capture("03-stages-sheet-editing", "percent" to summary.percent, "task" to summary.currentTask)

        // The record is on disk, where an app restart reads it.
        val store = ProgressStore(File(evidence.app.filesDir, "progress"))
        val savedBytes = store.fileFor(HouseId(houseId.value)).readBytes()
        assertTrue("the progress was saved", savedBytes.isNotEmpty())

        // 4. The sheet closes onto the same house: 3D now shows exactly what is recorded, the camera has not moved.
        evidence.closeSheet(evidence.stageSheet())
        evidence.awaitNode(hasText(evidence.string(R.string.progress_now_task, TASK)))
        assertEquals("one engine: the house never left", 1, RenderDiagnostics.liveEngines.get())
        assertEquals("the stage sheet did not move the camera", poseAtRest, preview.pose)
        val projection = checkNotNull(progress.session).projection
        val actual = checkNotNull(projection.visibleIds(ConstructionView.Actual(checkNotNull(progress.session?.state))))
        compose.waitUntil(5_000) { preview.viewer.construction == actual }
        assertEquals("3D now shows exactly what is recorded", actual, preview.viewer.construction)
        val joinery = projection.introducedAt(ConstructionStageKey.JOINERY)
        assertTrue("the model has joinery to hide", joinery.isNotEmpty())
        assertTrue("no window stands yet", joinery.none { it in actual })
        val now = first
        evidence.settleFrames(now)
        val nowShot = evidence.capture("04-house-now", "visibleObjects" to now.visibleObjects, "construction" to actual.size)
        evidence.assertHouseInsideFreeArea(preview, nowShot, "04 house now")

        // 5-8. The time machine: drag along the rule to the foundations, then tap walls, roof, joinery.
        val shots = linkedMapOf<ConstructionStageKey, Bitmap>()
        val rule = compose.onNode(hasContentDescription(evidence.string(R.string.timeline_rule_description)))
        rule.performTouchInput {
            val g = RuleGeometry(width.toFloat(), STOPS, density)
            down(Offset(g.center(0), height / 2f))
            for (i in 1..stopOf(ConstructionStageKey.FOUNDATIONS)) moveTo(Offset(g.center(i), height / 2f))
            up()
        }
        shots[ConstructionStageKey.FOUNDATIONS] = previewShot(preview, progress, now, ConstructionStageKey.FOUNDATIONS, "05-history-foundations")
        // Scrubbing changes which uploaded objects stand, nothing else: no upload, no camera move.
        val uploadsBefore = now.modelUploads
        val poseBefore = preview.pose
        for ((key, name) in listOf(
            ConstructionStageKey.WALLS to "06-history-walls",
            ConstructionStageKey.ROOF to "07-history-roof",
            ConstructionStageKey.JOINERY to "08-history-joinery",
        )) {
            val framesBefore = now.framesRendered.get()
            val started = SystemClock.elapsedRealtime()
            rule.performTouchInput {
                val g = RuleGeometry(width.toFloat(), STOPS, density)
                click(Offset(g.center(stopOf(key)), height / 2f))
            }
            val expected = checkNotNull(progress.session).projection.visibleIds(ConstructionView.AtStage(key))
            compose.waitUntil(5_000) { progress.session?.cursor == TimelineCursor.Stage(key) && preview.viewer.construction == expected }
            val applied = SystemClock.elapsedRealtime()
            compose.waitUntil(5_000) { now.framesRendered.get() > framesBefore + 1 }
            evidence.fact("scrub $key: tap to filter ms", applied - started)
            evidence.fact("scrub $key: tap to drawn frame ms", SystemClock.elapsedRealtime() - started)
            shots[key] = previewShot(preview, progress, now, key, name)
        }
        assertEquals("scrubbing uploads no geometry", uploadsBefore, now.modelUploads)
        assertEquals("scrubbing does not move the camera", poseBefore, preview.pose)
        evidence.fact("modelUploads during scrub", now.modelUploads - uploadsBefore)
        evidence.fact("camera moved during scrub", poseBefore != preview.pose)
        evidence.fact("first entry: frames", first.framesRendered.get())
        assertTrue("the preview never wrote the record", savedBytes.contentEquals(store.fileFor(HouseId(houseId.value)).readBytes()))
        assertEquals("the saved stage is still Dach", ConstructionStageKey.ROOF, progress.view?.summary?.currentStage)
        // Stages that differ must look different.
        val stages = shots.entries.toList()
        for (i in 1 until stages.size) {
            val d = Evidence.difference(stages[i - 1].value, stages[i].value, Evidence.modelRegion(stages[i].value))
            evidence.fact("difference ${stages[i - 1].key} -> ${stages[i].key}", d)
            assertTrue("${stages[i - 1].key} and ${stages[i].key} look the same (difference $d)", d >= MIN_STAGE_DIFFERENCE)
        }

        // 9. "Wróć do teraz" restores exactly the saved state.
        compose.onNode(hasText(evidence.string(R.string.timeline_return_now)) and hasClickAction()).performClick()
        runCatching { compose.waitUntil(5_000) { progress.session?.cursor == TimelineCursor.Now && preview.viewer.construction == actual } }
        assertEquals(TimelineCursor.Now, progress.session?.cursor)
        assertEquals(actual, preview.viewer.construction)
        evidence.settleFrames(now)
        val back = evidence.capture("09-back-to-now")
        evidence.fact("difference now vs back-to-now", Evidence.difference(nowShot, back, Evidence.modelRegion(back)))

        // 10. The layers pane from the rail: progressive disclosure, the house behind it.
        compose.onNode(hasText(evidence.string(R.string.tool_layers)) and hasClickAction()).performClick()
        evidence.awaitNode(hasText(evidence.string(R.string.layer_roof_off)) and hasClickAction())
        evidence.settleFrames(now)
        evidence.capture("10-layers-pane")
        Espresso.pressBack()
        compose.waitUntil(5_000) { compose.onAllNodes(hasText(evidence.string(R.string.layer_roof_off)) and hasClickAction()).fetchSemanticsNodes().isEmpty() }

        // 11. An element's details: tap the house; if the tap finds nothing, choose a standing wall.
        compose.onNode(hasContentDescription(evidence.string(R.string.viewport_description))).performTouchInput { click(center) }
        val picked = try {
            compose.waitUntil(5_000) { preview.selected != null }
            true
        } catch (e: ComposeTimeoutException) {
            false
        }
        if (!picked) {
            val wall = checkNotNull(preview.scene).objects.first { it.kind == "wall" && it.id in actual }.id
            compose.runOnIdle { preview.onPicked(wall, System.currentTimeMillis()) }
        }
        evidence.fact("inspectorSelectionByTap", picked)
        compose.onNode(evidence.detailsHandle()).performClick()
        evidence.awaitNode(hasText(evidence.string(R.string.inspector_about)))
        evidence.settleFrames(now)
        evidence.capture("11-inspector", "selected" to preview.selected?.id)
        // Cycle 1, C1-03: the owner reads Polish; the export's English is folded under "Dane techniczne".
        val sel = checkNotNull(preview.selected)
        val exportName = sel.metadata?.label
        if (sel.kind != "room" && !exportName.isNullOrBlank()) {
            assertTrue("the export's name '$exportName' is not the headline", compose.onAllNodes(hasText(exportName), useUnmergedTree = true).fetchSemanticsNodes().isEmpty())
        }
        for (english in listOf("Ridge axis", "Eave offset", "Footprint", "Type", "Length", "Thickness", "Height")) {
            assertTrue("'$english' is shown unfolded", compose.onAllNodes(hasText(english), useUnmergedTree = true).fetchSemanticsNodes().isEmpty())
        }
        // The sheet is solid to the finger (cycle 3, H-01): a tap on its own title neither picks the model nor
        // closes the details.
        compose.onNode(hasText(evidence.string(R.string.inspector_about))).performTouchInput { click(center) }
        compose.waitForIdle()
        assertEquals("a tap on the inspector kept the selection", sel.id, preview.selected?.id)
        compose.onNode(hasText(evidence.string(R.string.inspector_about))).assertExists()
        compose.onNode(hasContentDescription(evidence.string(R.string.inspector_close))).performClick()
        compose.onNode(hasContentDescription(evidence.string(R.string.selection_clear))).performClick()

        // 12. The timeline expanded: every stage named with its state.
        compose.onNode(hasContentDescription(evidence.string(R.string.timeline_expand))).performClick()
        evidence.awaitNode(hasText(evidence.string(R.string.stage_status_done)), unmerged = true)
        evidence.settleFrames(now)
        evidence.capture("12-timeline-expanded")
        compose.onNode(hasContentDescription(evidence.string(R.string.timeline_collapse))).performClick()

        // 13. The house menu: the houses on this phone, the open one marked, and the matters of this house.
        compose.onNode(evidence.menuButton()).performClick()
        evidence.awaitNode(hasText(evidence.string(R.string.house_saved_heading)))
        evidence.awaitNode(hasText(evidence.string(R.string.menu_costs)))
        compose.onNode(hasText(evidence.string(R.string.menu_costs_not_built))).assertExists()
        evidence.capture("13-menu")

        // 14. The source sheet from the menu: where the model came from, the technical figures folded.
        compose.onAllNodes(hasText(evidence.string(R.string.menu_source)) and hasClickAction())[0].performClick()
        evidence.awaitNode(hasText(evidence.string(R.string.house_status_bundled)))
        compose.onNode(hasText(evidence.string(R.string.house_diagnostics_show)) and hasClickAction()).assertExists()
        evidence.capture("14-source")
        Espresso.pressBack()
        compose.waitUntil(5_000) { compose.onAllNodes(hasText(evidence.string(R.string.house_status_bundled))).fetchSemanticsNodes().isEmpty() }
        assertEquals("sheets never move the camera", poseAtRest, preview.pose)

        // 15. The analyzer task from the menu: it takes the screen, and the engine goes with it.
        evidence.openAnalyzerTask(compose, preview)
        assertEquals("no engine on the analyzer task", 0, RenderDiagnostics.liveEngines.get())
        evidence.capture("15-analyzer-task")

        // 16. Back returns to the same house, at the same camera, with the same state.
        Espresso.pressBack()
        val second = evidence.awaitRenderer(preview, "back from the task")
        assertEquals("re-entering shows the saved state", actual, preview.viewer.construction)
        assertEquals("the task did not move the camera", poseAtRest, preview.pose)
        evidence.awaitNode(hasText(evidence.string(R.string.progress_now_task, TASK)))
        evidence.assertHouseInsideFreeArea(preview, evidence.capture("16-house-after-task", "visibleObjects" to second.visibleObjects), "16 house after the task")
        assertNotNull(progress.view)
        evidence.fact("result", "PASS")
    }

    // -----------------------------------------------------------------------

    /** The stage sheet's list (the only scrolling node while the sheet is open). */
    private fun list() = compose.onAllNodes(hasScrollAction()).onFirst()

    /** The completion slider, not the rule: the rule is not on the sheet, but on a tall window both may be composed. */
    private fun hasSetProgressOnly(): SemanticsMatcher =
        SemanticsMatcher("not the timeline's rule") { node -> node.config.getOrNull(androidx.compose.ui.semantics.SemanticsProperties.ContentDescription)?.contains(evidence.string(R.string.timeline_rule_description)) != true }

    private fun openStage(key: ConstructionStageKey) = evidence.openStage(evidence.string(stageLabel(key)))

    /** The stage sheet's drawing of the house is on screen, in ink: a blank drawing is a failed sheet. */
    private fun assertDrawingInked(preview: PreviewViewModel, progress: ProgressViewModel, shot: Bitmap, step: String) {
        val title = checkNotNull(preview.scene).title
        val node = compose.onNode(hasContentDescription(evidence.string(R.string.house_drawing_description, title))).fetchSemanticsNode()
        val b = node.boundsInWindow
        val box = android.graphics.Rect(b.left.toInt(), b.top.toInt(), b.right.toInt(), b.bottom.toInt())
        val ink = Evidence.inkPixels(shot, box)
        evidence.fact("$step: drawing box", box.toShortString())
        evidence.fact("$step: drawing segments", progress.sketch?.segmentCount)
        evidence.fact("$step: drawing ink pixels", ink)
        if (ink < MIN_DRAWING_INK) {
            // Tell a late frame from a drawing that never comes: look again after a pause, then fail either way.
            SystemClock.sleep(3_000)
            val later = Evidence.inkPixels(evidence.capture("${step.take(2)}-diagnostic-late"), box)
            evidence.fact("$step: drawing ink pixels 3 s later", later)
        }
        assertTrue("$step: the house drawing is drawn ($ink ink pixels)", ink >= MIN_DRAWING_INK)
    }

    private fun previewShot(preview: PreviewViewModel, progress: ProgressViewModel, d: RenderDiagnostics, key: ConstructionStageKey, name: String): Bitmap {
        val expected = checkNotNull(progress.session).projection.visibleIds(ConstructionView.AtStage(key))
        // The workspace hands the cursor's frame to the viewer on its next composition.
        runCatching { compose.waitUntil(5_000) { progress.session?.cursor == TimelineCursor.Stage(key) && preview.viewer.construction == expected } }
        assertEquals("$key: the cursor is on $key", TimelineCursor.Stage(key), progress.session?.cursor)
        assertEquals("$key: the 3D shows exactly the objects standing at the end of $key", expected, preview.viewer.construction)
        evidence.awaitNode(hasText(evidence.string(R.string.timeline_preview_of, evidence.string(stageLabel(key)))))
        evidence.settleFrames(d)
        return evidence.capture(name, "stage" to key, "objects" to expected?.size)
    }

    private fun stopOf(key: ConstructionStageKey): Int = key.ordinal

    private fun stageLabel(key: ConstructionStageKey): Int = when (key) {
        ConstructionStageKey.PLOT_PURCHASE -> R.string.stage_plot_purchase
        ConstructionStageKey.DESIGN -> R.string.stage_design
        ConstructionStageKey.PERMITS -> R.string.stage_permits
        ConstructionStageKey.SITE_PREPARATION -> R.string.stage_site_preparation
        ConstructionStageKey.FOUNDATIONS -> R.string.stage_foundations
        ConstructionStageKey.WALLS -> R.string.stage_walls
        ConstructionStageKey.FLOOR_SLAB -> R.string.stage_floor_slab
        ConstructionStageKey.ROOF -> R.string.stage_roof
        ConstructionStageKey.JOINERY -> R.string.stage_joinery
        else -> error("not used by this journey: $key")
    }

    private companion object {
        const val TASK = "Montaż więźby"

        /** The rule's stops: 17 stages and the finished design. */
        const val STOPS = 18

        /** Mean luminance difference (0–255) below which two stage previews count as the same picture. */
        const val MIN_STAGE_DIFFERENCE = 1.0

        /** Bright pixels in the drawing's box below which it counts as blank (a drawn house has about ten thousand). */
        const val MIN_DRAWING_INK = 1_500

        /** The owner's smallest gesture: enough to leave the camera's home, invisible in a capture. */
        const val NUDGE_PX = 6.0
    }
}
