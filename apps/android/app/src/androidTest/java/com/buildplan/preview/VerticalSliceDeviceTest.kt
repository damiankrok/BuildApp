package com.buildplan.preview

import android.content.Intent
import androidx.compose.ui.semantics.SemanticsActions
import androidx.compose.ui.semantics.getOrNull
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.onFirst
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performSemanticsAction
import androidx.compose.ui.test.performTextReplacement
import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.Espresso
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.buildplan.preview.analyzer.AnalysisState
import com.buildplan.preview.analyzer.AnalyzerFailure
import com.buildplan.preview.progress.ConstructionStageKey
import com.buildplan.preview.progress.ConstructionView
import com.buildplan.preview.progress.StageStatus
import com.buildplan.preview.progress.TimelineCursor
import com.buildplan.preview.presentation.PresentationMode
import com.buildplan.preview.render.RenderDiagnostics
import com.buildplan.preview.scene.SceneSourceKind
import com.buildplan.preview.ui.PreviewViewModel
import com.buildplan.preview.ui.ProgressViewModel
import java.io.File
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeFalse
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * A real project through the whole product (INTEGRATION-003C §25S, under the
 * house-first shell of 004A): from the open house, take the analyzer task
 * from the menu, paste the link, let the analyzer on this phone read it, and
 * go on as the owner would — open the result (a finished analysis never
 * replaces the house on screen by itself), read its limitations on the
 * source sheet, record progress for THIS house in the stage sheet, rewind
 * the time machine to the walls without a roof, the closed shell before the
 * joinery and the joinery (also drawn as CLAY), open an element's details,
 * and come back to the house after the analyzer task.
 *
 * Nothing here knows which house it is: the same steps and the same
 * assertions run for every link (`sliceUrl`, `sliceName` instrumentation
 * arguments). When the publisher cannot be reached the test is skipped with
 * `SOURCE_UNREACHABLE` recorded, never passed.
 */
@RunWith(AndroidJUnit4::class)
class VerticalSliceDeviceTest {
    @get:Rule
    val compose = createEmptyComposeRule()

    private val args = InstrumentationRegistry.getArguments()
    private val url: String? = args.getString("sliceUrl")
    private val name = args.getString("sliceName") ?: "slice"
    private val timeoutMs = (args.getString("sliceTimeoutMinutes")?.toLongOrNull() ?: 40L) * 60_000L
    private val evidence = Evidence(compose, "ui-evidence", "slice-$name")
    private var scenario: ActivityScenario<MainActivity>? = null

    @Before
    fun setUp() {
        assumeTrue("no sliceUrl given", !url.isNullOrBlank())
        File(evidence.app.filesDir, "progress").deleteRecursively()
        assertEquals(0, RenderDiagnostics.liveEngines.get())
    }

    @After
    fun tearDown() {
        evidence.writeManifest()
        scenario?.close()
    }

    @Test
    fun aProjectLinkThroughTheWholeProduct() {
        val link = checkNotNull(url)
        val scenario = ActivityScenario.launch<MainActivity>(Intent(evidence.app, MainActivity::class.java)).also { this.scenario = it }
        val preview = evidence.preview(scenario)
        val progress = evidence.progress(scenario)
        val analyzer = evidence.analyzer(scenario)
        evidence.fact("url", link)
        // The built-in house is the root: wait until it is drawn, then take the analyzer task from its menu.
        compose.waitUntil(Evidence.RENDER_TIMEOUT_MS) { preview.scene != null && progress.view != null }
        val bundled = evidence.awaitRenderer(preview, "the built-in house")
        evidence.openAnalyzerTask(compose, preview)
        compose.onNode(hasSetTextAction()).performTextReplacement(link)
        compose.onNode(hasText(evidence.string(R.string.analyzer_analyze)) and hasClickAction()).performClick()
        compose.waitUntil(30_000) { analyzer.isRunning || analyzer.state is AnalysisState.Failed }
        evidence.capture("01-analyzing")

        val started = System.currentTimeMillis()
        compose.waitUntil(timeoutMs) { analyzer.state is AnalysisState.Completed || analyzer.state is AnalysisState.Failed }
        evidence.fact("analysisMs", System.currentTimeMillis() - started)
        (analyzer.state as? AnalysisState.Failed)?.let { failed ->
            val code = (failed.failure as? AnalyzerFailure.JobFailed)?.diagnosticCode ?: (failed.failure as? AnalyzerFailure.LocalRuntime)?.code
            evidence.fact("failure", "$code ${failed.failure}")
            evidence.capture("01-failed")
            assumeFalse("SOURCE_UNREACHABLE: the publisher could not be reached", code == "SOURCE_UNREACHABLE" || failed.failure is AnalyzerFailure.Offline)
            throw AssertionError("the analysis failed: ${failed.failure}")
        }
        val completed = analyzer.state as AnalysisState.Completed
        val summary = completed.summary
        val limited = summary.unresolved.isNotEmpty() || summary.warnings.isNotEmpty()
        evidence.fact("modelHash", summary.modelHash)
        evidence.fact("sceneContentHash", summary.sceneContentHash)
        evidence.fact("unresolved", summary.unresolved.size)
        evidence.fact("warnings", summary.warnings.size)
        evidence.fact("limited", limited)

        // The finished analysis is opened by the owner ("Otwórz w 3D" on the result): the house is drawn.
        evidence.capture("02-analyzer-result")
        compose.onNode(hasText(evidence.string(R.string.house_open_3d)) and hasClickAction()).performClick()
        val first = evidence.awaitRenderer(preview, "3D after the analysis", replacing = bundled)
        val scene = checkNotNull(preview.scene)
        assertEquals("the analysed scene is open", completed.entry.key, scene.key)
        val houseId = checkNotNull(progress.session?.houseId) { "an analysed house has a durable id" }
        assertTrue("the id is the model's, not the download's: $houseId", !houseId.value.startsWith("analysis-"))
        evidence.fact("houseId", houseId)
        evidence.fact("objects", scene.objectCount)
        evidence.capture("03-house-after-analysis", "visibleObjects" to first.visibleObjects)
        assertEquals(SceneSourceKind.DOWNLOADED, preview.scenes.first { it.key == scene.key }.source)

        // The source sheet says what the analysis left open, in the same words as the result.
        evidence.openMenu(compose, evidence.string(R.string.menu_source))
        evidence.awaitNode(hasText(evidence.string(if (limited) R.string.house_status_limited else R.string.house_status_ready)))
        if (limited) evidence.awaitNode(hasText(evidence.string(R.string.analyzer_details)))
        evidence.capture("04-source-sheet")
        Espresso.pressBack()
        compose.waitUntil(5_000) { compose.onAllNodes(hasText(evidence.string(R.string.house_status_bundled))).fetchSemanticsNodes().isEmpty() }

        // The stage sheet for THIS house: stages 1-7 done, Dach current at 50 %.
        compose.onNode(hasText(evidence.string(R.string.progress_set_action)) and hasClickAction()).performClick()
        evidence.awaitNode(hasText(evidence.string(R.string.stages_title)))
        for (key in DONE) {
            openStage(stageName(key))
            compose.onNode(hasText(evidence.string(R.string.stage_mark_done)) and hasClickAction()).performClick()
            compose.waitUntil(5_000) { progress.view?.stages?.firstOrNull { it.stageKey == key }?.status == StageStatus.DONE }
        }
        openStage(stageName(ConstructionStageKey.ROOF))
        compose.onNode(hasText(evidence.string(R.string.stage_make_current)) and hasClickAction()).performClick()
        compose.waitUntil(5_000) { progress.view?.summary?.currentStage == ConstructionStageKey.ROOF }
        compose.onNode(androidx.compose.ui.test.SemanticsMatcher.keyIsDefined(SemanticsActions.SetProgress) and notTheRule())
            .performSemanticsAction(SemanticsActions.SetProgress) { it(0.5f) }
        compose.waitUntil(5_000) { progress.view?.summary?.currentStageCompletionPercent == 50 }
        evidence.fact("percent", progress.view?.summary?.percent)
        evidence.capture("05-stages-sheet")
        Espresso.pressBack()
        compose.waitUntil(5_000) { compose.onAllNodes(hasText(evidence.string(R.string.stages_title))).fetchSemanticsNodes().isEmpty() }

        // 3D now: the shell and the roof being built, no joinery yet — the same house, the sheet is gone.
        val now = first
        val projection = checkNotNull(progress.session).projection
        val actual = checkNotNull(projection.visibleIds(ConstructionView.Actual(checkNotNull(progress.session?.state))))
        runCatching { compose.waitUntil(5_000) { preview.viewer.construction == actual } }
        assertEquals(actual, preview.viewer.construction)
        val walls = projection.introducedAt(ConstructionStageKey.WALLS)
        val roof = projection.introducedAt(ConstructionStageKey.ROOF)
        val joinery = projection.introducedAt(ConstructionStageKey.JOINERY)
        evidence.fact("objects introduced at walls / roof / joinery", "${walls.size} / ${roof.size} / ${joinery.size}")
        evidence.fact("unplacedObjects", projection.unmapped.size)
        assertTrue("this house has walls to show", walls.isNotEmpty())
        assertTrue("walls stand now", walls.all { it in actual })
        assertTrue("no joinery yet", joinery.none { it in actual })
        evidence.settleFrames(now)
        evidence.capture("06-house-now", "objects" to actual.size)

        // The time machine: walls without a roof, the closed shell before joinery, then the joinery.
        val walled = history(preview, progress, now, ConstructionStageKey.WALLS, "07-history-walls")
        assertTrue("walls stand at the end of Ściany", walls.all { it in walled })
        assertTrue("no roof at the end of Ściany", roof.none { it in walled })
        val preJoinery = history(preview, progress, now, ConstructionStageKey.ROOF, "08-history-pre-joinery")
        assertTrue("the roof stands at the end of Dach", roof.all { it in preJoinery })
        assertTrue("no joinery before Stolarka", joinery.none { it in preJoinery })
        val joined = history(preview, progress, now, ConstructionStageKey.JOINERY, "09-history-joinery")
        assertTrue("windows and doors stand at the end of Stolarka", joinery.all { it in joined })

        // History composes with the way the house is drawn: CLAY, rewound to Ściany.
        compose.runOnIdle { preview.setPresentation(PresentationMode.CLAY) }
        history(preview, progress, now, ConstructionStageKey.WALLS, "10-clay-history-walls")
        assertEquals(PresentationMode.CLAY, preview.viewer.presentation)
        compose.runOnIdle { preview.setPresentation(PresentationMode.MODEL) }

        compose.onNode(hasText(evidence.string(R.string.timeline_return_now)) and hasClickAction()).performClick()
        runCatching { compose.waitUntil(5_000) { progress.session?.cursor == TimelineCursor.Now && preview.viewer.construction == actual } }
        assertEquals("Teraz is the saved state", actual, preview.viewer.construction)

        // An element's details: a standing wall of this house.
        val wall = walls.first { it in actual }
        compose.runOnIdle { preview.onPicked(wall, System.currentTimeMillis()) }
        compose.onNode(hasText(evidence.string(R.string.dock_details)) and hasClickAction()).performClick()
        evidence.awaitNode(hasText(evidence.string(R.string.inspector_about)))
        evidence.settleFrames(now)
        evidence.capture("11-inspector", "selected" to wall)
        compose.onNode(hasContentDescription(evidence.string(R.string.inspector_close))).performClick()
        compose.onNode(hasContentDescription(evidence.string(R.string.selection_clear))).performClick()

        // Leave the house for the analyzer task and come back: drawn again, same state, one engine.
        val pose = preview.pose
        evidence.openAnalyzerTask(compose, preview)
        Espresso.pressBack()
        evidence.awaitRenderer(preview, "the house again", replacing = now)
        runCatching { compose.waitUntil(5_000) { preview.viewer.construction == actual } }
        assertEquals(actual, preview.viewer.construction)
        assertEquals("the task did not move the camera", pose, preview.pose)
        evidence.capture("12-house-again")
        assertEquals("the previews never saved", ConstructionStageKey.ROOF, progress.view?.summary?.currentStage)
        assertNotNull(progress.view)
        evidence.fact("result", "PASS")
    }

    /** Rewind the time machine to the end of [key] by the rule's own action; the viewer shows exactly that stage. */
    private fun history(preview: PreviewViewModel, progress: ProgressViewModel, d: RenderDiagnostics, key: ConstructionStageKey, shot: String): Set<String> {
        val projection = checkNotNull(progress.session).projection
        val expected = checkNotNull(projection.visibleIds(ConstructionView.AtStage(key)))
        compose.onNode(hasContentDescription(evidence.string(R.string.timeline_rule_description)))
            .performSemanticsAction(SemanticsActions.SetProgress) { it(key.ordinal.toFloat()) }
        // The workspace hands the cursor's frame to the viewer on its next composition.
        runCatching { compose.waitUntil(5_000) { progress.session?.cursor == TimelineCursor.Stage(key) && preview.viewer.construction == expected } }
        assertEquals(TimelineCursor.Stage(key), progress.session?.cursor)
        assertEquals(expected, preview.viewer.construction)
        evidence.settleFrames(d)
        evidence.capture(shot, "stage" to key, "objects" to expected.size)
        return expected
    }

    /** The stage sheet's list (the only scrolling node while the sheet is open). */
    private fun list() = compose.onAllNodes(hasScrollAction()).onFirst()

    /** The completion slider, not the timeline's rule behind the sheet. */
    private fun notTheRule(): androidx.compose.ui.test.SemanticsMatcher =
        androidx.compose.ui.test.SemanticsMatcher("not the timeline's rule") { node ->
            node.config.getOrNull(androidx.compose.ui.semantics.SemanticsProperties.ContentDescription)?.contains(evidence.string(R.string.timeline_rule_description)) != true
        }

    private fun openStage(label: String) {
        list().performScrollToNode(hasText(label))
        compose.onNode(hasText(label) and hasClickAction()).performClick()
        compose.waitForIdle()
        list().performScrollToNode(hasText(evidence.string(R.string.stage_show_in_3d)) or hasText(evidence.string(R.string.stage_show_now)))
    }

    private fun stageName(key: ConstructionStageKey): String = evidence.string(
        when (key) {
            ConstructionStageKey.PLOT_PURCHASE -> R.string.stage_plot_purchase
            ConstructionStageKey.DESIGN -> R.string.stage_design
            ConstructionStageKey.PERMITS -> R.string.stage_permits
            ConstructionStageKey.SITE_PREPARATION -> R.string.stage_site_preparation
            ConstructionStageKey.FOUNDATIONS -> R.string.stage_foundations
            ConstructionStageKey.WALLS -> R.string.stage_walls
            ConstructionStageKey.FLOOR_SLAB -> R.string.stage_floor_slab
            ConstructionStageKey.ROOF -> R.string.stage_roof
            else -> error("not used by the slice: $key")
        },
    )

    private companion object {
        val DONE = listOf(
            ConstructionStageKey.PLOT_PURCHASE, ConstructionStageKey.DESIGN, ConstructionStageKey.PERMITS,
            ConstructionStageKey.SITE_PREPARATION, ConstructionStageKey.FOUNDATIONS, ConstructionStageKey.WALLS,
            ConstructionStageKey.FLOOR_SLAB,
        )
    }
}
