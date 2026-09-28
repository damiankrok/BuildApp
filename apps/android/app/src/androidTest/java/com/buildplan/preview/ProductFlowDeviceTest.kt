package com.buildplan.preview

import android.content.Intent
import android.graphics.Bitmap
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.test.ComposeTimeoutException
import androidx.compose.ui.test.SemanticsMatcher
import androidx.compose.ui.test.click
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createEmptyComposeRule
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
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * INTEGRATION-003C's product journey on a device, the owner's way — by the
 * Compose semantics of the real screens, never by launching a place
 * directly: Dom with nothing recorded, Dom → 3D, Etapy (recording progress
 * through its own controls), Dom again, 3D now, the time machine back to the
 * foundations, walls, roof and joinery and "Wróć do teraz", an element's
 * details, the expanded timeline, leaving and entering 3D again, the
 * analyzer page, Koszty and Dokumenty.
 *
 * Every step asserts what the product promises — the preview never changes
 * what was saved, each stage shows exactly its semantic objects, one
 * Filament engine, the house drawn — and saves a screenshot to
 * `ui-evidence/` with a manifest CI validates. The progress entered here is
 * TEST data on the emulator's copy of the built-in reference house.
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
        assertEquals("live Filament engines before the test", 0, RenderDiagnostics.liveEngines.get())
    }

    @After
    fun tearDown() {
        evidence.writeManifest()
        scenario?.close()
    }

    @Test
    fun theOwnersJourneyThroughDom3dAndEtapy() {
        val scenario = ActivityScenario.launch<MainActivity>(Intent(evidence.app, MainActivity::class.java)).also { this.scenario = it }
        val preview = evidence.preview(scenario)
        val progress = evidence.progress(scenario)
        compose.waitUntil(Evidence.RENDER_TIMEOUT_MS) { progress.view != null && progress.sketch != null }
        val houseId = checkNotNull(progress.session?.houseId) { "the built-in house has a durable id" }
        evidence.fact("houseId", houseId)
        evidence.fact("reducedMotion", preview.reducedMotion)

        // 1. Dom, nothing recorded: "Postęp nieustawiony" and the way to set it; no engine.
        evidence.awaitNode(hasText(evidence.string(R.string.progress_unset)))
        assertNull("Dom composes no viewport", preview.renderDiagnostics)
        evidence.capture("01-dom-unset")

        // 2. Dom -> 3D through the bar: the whole design, "Postęp nieustawiony".
        compose.onNode(evidence.tab(evidence.string(R.string.place_model))).performClick()
        val first = evidence.awaitRenderer(preview, "first 3D entry")
        assertNull("unset progress shows the whole design", preview.viewer.construction)
        evidence.capture("02-dom-to-3d-unset", "visibleObjects" to first.visibleObjects)

        // 3. Back to Dom, then Etapy by the bar.
        Espresso.pressBack()
        compose.waitUntil(Evidence.RENDER_TIMEOUT_MS) { preview.renderDiagnostics == null }
        assertEquals("no engine after leaving 3D", 0, RenderDiagnostics.liveEngines.get())
        compose.onNode(evidence.tab(evidence.string(R.string.place_stages))).performClick()
        evidence.awaitNode(hasText(evidence.string(R.string.stages_title)))
        evidence.capture("03-etapy-unset")

        // 4. Record progress through Etapy's own controls: stages 1-7 done, Dach current at 40 %, a task.
        for (key in listOf(
            ConstructionStageKey.PLOT_PURCHASE, ConstructionStageKey.DESIGN, ConstructionStageKey.PERMITS,
            ConstructionStageKey.SITE_PREPARATION, ConstructionStageKey.FOUNDATIONS, ConstructionStageKey.WALLS,
            ConstructionStageKey.FLOOR_SLAB,
        )) {
            openStage(key)
            compose.onNode(hasText(evidence.string(R.string.stage_mark_done)) and hasClickAction()).performClick()
            compose.waitUntil(5_000) { progress.view?.stages?.firstOrNull { it.stageKey == key }?.status == StageStatus.DONE }
        }
        openStage(ConstructionStageKey.ROOF)
        compose.onNode(hasText(evidence.string(R.string.stage_make_current)) and hasClickAction()).performClick()
        compose.waitUntil(5_000) { progress.view?.summary?.currentStage == ConstructionStageKey.ROOF }
        compose.onNode(SemanticsMatcher.keyIsDefined(SemanticsActions.SetProgress)).performSemanticsAction(SemanticsActions.SetProgress) { it(0.4f) }
        compose.waitUntil(5_000) { progress.view?.summary?.currentStageCompletionPercent == 40 }
        compose.onNode(hasSetTextAction()).performTextReplacement(TASK)
        compose.onNode(hasText(evidence.string(R.string.stage_task_save)) and hasClickAction()).performClick()
        compose.waitUntil(5_000) { progress.view?.summary?.currentTask == TASK }
        val summary = checkNotNull(progress.view).summary
        assertEquals("(7 + 0.4) / 17 stages, rounded down", 43, summary.percent)
        evidence.capture("04-etapy-current-editing", "percent" to summary.percent, "task" to summary.currentTask)

        // The record is on disk, where an app restart reads it.
        val store = ProgressStore(File(evidence.app.filesDir, "progress"))
        val savedBytes = store.fileFor(HouseId(houseId.value)).readBytes()
        assertTrue("the progress was saved", savedBytes.isNotEmpty())

        // 5. Dom reflects the same progress.
        compose.onNode(evidence.tab(evidence.string(R.string.place_house))).performClick()
        evidence.awaitNode(hasText(evidence.string(R.string.progress_current_stage, evidence.string(R.string.stage_roof))))
        evidence.awaitNode(hasText(evidence.string(R.string.progress_now_doing, TASK)))
        evidence.capture("05-dom-progress")

        // 6. 3D now: the house as it stands by the owner's account — no joinery yet.
        compose.onNode(hasText(evidence.string(R.string.house_open_3d)) and hasClickAction()).performClick()
        val now = evidence.awaitRenderer(preview, "3D now")
        val projection = checkNotNull(progress.session).projection
        val actual = checkNotNull(projection.visibleIds(ConstructionView.Actual(checkNotNull(progress.session?.state))))
        assertEquals("3D now shows exactly what is recorded", actual, preview.viewer.construction)
        val joinery = projection.introducedAt(ConstructionStageKey.JOINERY)
        assertTrue("the model has joinery to hide", joinery.isNotEmpty())
        assertTrue("no window stands yet", joinery.none { it in actual })
        val nowShot = evidence.capture("06-3d-now", "visibleObjects" to now.visibleObjects, "construction" to actual.size)

        // 7-10. The time machine: drag along the rule to the foundations, then tap walls, roof, joinery.
        val shots = linkedMapOf<ConstructionStageKey, Bitmap>()
        val rule = compose.onNode(hasContentDescription(evidence.string(R.string.timeline_rule_description)))
        rule.performTouchInput {
            val g = RuleGeometry(width.toFloat(), STOPS, density)
            down(Offset(g.center(0), height / 2f))
            for (i in 1..stopOf(ConstructionStageKey.FOUNDATIONS)) moveTo(Offset(g.center(i), height / 2f))
            up()
        }
        shots[ConstructionStageKey.FOUNDATIONS] = previewShot(preview, progress, now, ConstructionStageKey.FOUNDATIONS, "07-3d-history-foundations")
        for ((key, name) in listOf(
            ConstructionStageKey.WALLS to "08-3d-history-walls",
            ConstructionStageKey.ROOF to "09-3d-history-roof",
            ConstructionStageKey.JOINERY to "10-3d-history-joinery",
        )) {
            rule.performTouchInput {
                val g = RuleGeometry(width.toFloat(), STOPS, density)
                click(Offset(g.center(stopOf(key)), height / 2f))
            }
            shots[key] = previewShot(preview, progress, now, key, name)
        }
        assertTrue("the preview never wrote the record", savedBytes.contentEquals(store.fileFor(HouseId(houseId.value)).readBytes()))
        assertEquals("the saved stage is still Dach", ConstructionStageKey.ROOF, progress.view?.summary?.currentStage)
        // Stages that differ must look different.
        val stages = shots.entries.toList()
        for (i in 1 until stages.size) {
            val d = Evidence.difference(stages[i - 1].value, stages[i].value, Evidence.modelRegion(stages[i].value))
            evidence.fact("difference ${stages[i - 1].key} -> ${stages[i].key}", d)
            assertTrue("${stages[i - 1].key} and ${stages[i].key} look the same (difference $d)", d >= MIN_STAGE_DIFFERENCE)
        }

        // 11. "Wróć do teraz" restores exactly the saved state.
        compose.onNode(hasText(evidence.string(R.string.timeline_return_now)) and hasClickAction()).performClick()
        compose.waitUntil(5_000) { progress.session?.cursor == TimelineCursor.Now }
        assertEquals(actual, preview.viewer.construction)
        evidence.settleFrames(now)
        val back = evidence.capture("11-3d-back-to-now")
        evidence.fact("difference now vs back-to-now", Evidence.difference(nowShot, back, Evidence.modelRegion(back)))

        // 12. An element's details: tap the house; if the tap finds nothing, choose a standing wall.
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
        compose.onNode(hasText(evidence.string(R.string.dock_details)) and hasClickAction()).performClick()
        evidence.awaitNode(hasText(evidence.string(R.string.inspector_about)))
        evidence.settleFrames(now)
        evidence.capture("12-3d-inspector", "selected" to preview.selected?.id)
        compose.onNode(hasContentDescription(evidence.string(R.string.inspector_close))).performClick()
        compose.onNode(hasContentDescription(evidence.string(R.string.selection_clear))).performClick()

        // 13. The timeline expanded: every stage named with its state.
        compose.onNode(hasContentDescription(evidence.string(R.string.timeline_expand))).performClick()
        evidence.awaitNode(hasText(evidence.string(R.string.stage_status_done)), unmerged = true)
        evidence.settleFrames(now)
        evidence.capture("13-3d-timeline-expanded")
        compose.onNode(hasContentDescription(evidence.string(R.string.timeline_collapse))).performClick()

        // 14. Leave 3D and come back: one engine again, the house again, the same state.
        Espresso.pressBack()
        compose.waitUntil(Evidence.RENDER_TIMEOUT_MS) { preview.renderDiagnostics == null }
        assertEquals(0, RenderDiagnostics.liveEngines.get())
        compose.onNode(evidence.tab(evidence.string(R.string.place_model))).performClick()
        val second = evidence.awaitRenderer(preview, "second 3D entry")
        assertEquals("re-entering shows the saved state", actual, preview.viewer.construction)
        evidence.capture("14-3d-second-entry", "visibleObjects" to second.visibleObjects)
        Espresso.pressBack()
        compose.waitUntil(Evidence.RENDER_TIMEOUT_MS) { preview.renderDiagnostics == null }

        // 15-17. The analyzer entry, Koszty, Dokumenty; 18. back to Dom.
        compose.onNode(evidence.tab(evidence.string(R.string.place_house))).performClick()
        compose.onNode(hasScrollAction()).performScrollToNode(hasText(evidence.string(R.string.house_add_action)))
        compose.onAllNodes(hasText(evidence.string(R.string.house_add_action)) and hasClickAction())[0].performClick()
        evidence.awaitNode(hasText(evidence.string(R.string.analyzer_title)))
        evidence.capture("15-analyzer")
        Espresso.pressBack()
        compose.onNode(evidence.tab(evidence.string(R.string.place_costs))).performClick()
        evidence.capture("16-koszty")
        compose.onNode(evidence.tab(evidence.string(R.string.place_documents))).performClick()
        evidence.capture("17-dokumenty")
        Espresso.pressBack()
        evidence.awaitNode(hasText(evidence.string(R.string.progress_metric_label)))
        evidence.capture("18-back-to-dom")
        evidence.fact("result", "PASS")
    }

    // -----------------------------------------------------------------------

    private fun openStage(key: ConstructionStageKey) {
        val name = evidence.string(stageLabel(key))
        compose.onNode(hasScrollAction()).performScrollToNode(hasText(name))
        compose.onNode(hasText(name) and hasClickAction()).performClick()
        compose.waitForIdle()
        compose.onNode(hasScrollAction()).performScrollToNode(hasText(evidence.string(R.string.stage_show_in_3d)) or hasText(evidence.string(R.string.stage_show_now)))
    }

    private fun previewShot(preview: PreviewViewModel, progress: ProgressViewModel, d: RenderDiagnostics, key: ConstructionStageKey, name: String): Bitmap {
        compose.waitUntil(5_000) { progress.session?.cursor == TimelineCursor.Stage(key) }
        val expected = checkNotNull(progress.session).projection.visibleIds(ConstructionView.AtStage(key))
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
    }
}
