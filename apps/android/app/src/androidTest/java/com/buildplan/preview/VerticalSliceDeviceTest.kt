package com.buildplan.preview

import android.content.Intent
import androidx.compose.ui.semantics.SemanticsActions
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
import com.buildplan.preview.render.RenderDiagnostics
import com.buildplan.preview.scene.SceneSourceKind
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
 * A real project through the whole product (INTEGRATION-003C §25S): paste
 * its link on the analyzer page, let the analyzer on this phone read it, and
 * go on as the owner would — the model opens in 3D by itself, Dom names the
 * result and its limitations, Etapy records progress for THIS house, the time
 * machine rewinds it, and 3D opens again after leaving it.
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

        // Dom -> "Dodaj dom z linku" -> paste -> "Analizuj projekt".
        compose.onNode(hasScrollAction()).performScrollToNode(hasText(evidence.string(R.string.house_add_action)))
        compose.onAllNodes(hasText(evidence.string(R.string.house_add_action)) and hasClickAction())[0].performClick()
        evidence.awaitNode(hasText(evidence.string(R.string.analyzer_title)))
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

        // The finished analysis opens in 3D by itself: the house is drawn.
        val first = evidence.awaitRenderer(preview, "3D after the analysis")
        val scene = checkNotNull(preview.scene)
        assertEquals("the analysed scene is open", completed.entry.key, scene.key)
        val houseId = checkNotNull(progress.session?.houseId) { "an analysed house has a durable id" }
        assertTrue("the id is the model's, not the download's: $houseId", !houseId.value.startsWith("analysis-"))
        evidence.fact("houseId", houseId)
        evidence.fact("objects", scene.objectCount)
        evidence.capture("02-3d-after-analysis", "visibleObjects" to first.visibleObjects)

        // Back to Dom: the model's status says what the analysis left open.
        Espresso.pressBack()
        compose.waitUntil(Evidence.RENDER_TIMEOUT_MS) { preview.renderDiagnostics == null }
        assertEquals(SceneSourceKind.DOWNLOADED, preview.scenes.first { it.key == scene.key }.source)
        evidence.awaitNode(hasText(evidence.string(if (limited) R.string.house_status_limited else R.string.house_status_ready)))
        evidence.capture("03-dom-result")

        // The analyzer page keeps the result, in the same words.
        compose.onNode(hasScrollAction()).performScrollToNode(hasText(evidence.string(R.string.house_add_action)))
        compose.onAllNodes(hasText(evidence.string(R.string.house_add_action)) and hasClickAction())[0].performClick()
        evidence.awaitNode(hasText(evidence.string(if (limited) R.string.analyzer_result_limited else R.string.analyzer_result_ready)))
        evidence.capture("04-analyzer-result")
        Espresso.pressBack()

        // Etapy for THIS house: stages 1-5 done, Ściany current at 60 %.
        compose.onNode(evidence.tab(evidence.string(R.string.place_stages))).performClick()
        for (key in listOf(
            ConstructionStageKey.PLOT_PURCHASE, ConstructionStageKey.DESIGN, ConstructionStageKey.PERMITS,
            ConstructionStageKey.SITE_PREPARATION, ConstructionStageKey.FOUNDATIONS,
        )) {
            openStage(stageName(key))
            compose.onNode(hasText(evidence.string(R.string.stage_mark_done)) and hasClickAction()).performClick()
            compose.waitUntil(5_000) { progress.view?.stages?.firstOrNull { it.stageKey == key }?.status == StageStatus.DONE }
        }
        openStage(stageName(ConstructionStageKey.WALLS))
        compose.onNode(hasText(evidence.string(R.string.stage_make_current)) and hasClickAction()).performClick()
        compose.waitUntil(5_000) { progress.view?.summary?.currentStage == ConstructionStageKey.WALLS }
        compose.onNode(androidx.compose.ui.test.SemanticsMatcher.keyIsDefined(SemanticsActions.SetProgress))
            .performSemanticsAction(SemanticsActions.SetProgress) { it(0.6f) }
        compose.waitUntil(5_000) { progress.view?.summary?.currentStageCompletionPercent == 60 }
        evidence.capture("05-etapy-current")

        // 3D now: walls stand, no roof yet; the time machine shows the roof and the joinery.
        compose.onNode(evidence.tab(evidence.string(R.string.place_model))).performClick()
        val now = evidence.awaitRenderer(preview, "3D now")
        val projection = checkNotNull(progress.session).projection
        val actual = checkNotNull(projection.visibleIds(ConstructionView.Actual(checkNotNull(progress.session?.state))))
        assertEquals(actual, preview.viewer.construction)
        assertTrue("walls stand now", projection.introducedAt(ConstructionStageKey.WALLS).isNotEmpty() && projection.introducedAt(ConstructionStageKey.WALLS).all { it in actual })
        assertTrue("no roof yet", projection.introducedAt(ConstructionStageKey.ROOF).none { it in actual })
        evidence.fact("unplacedObjects", projection.unmapped.size)
        evidence.capture("06-3d-now")
        for ((key, shot) in listOf(ConstructionStageKey.ROOF to "07-3d-history-roof", ConstructionStageKey.JOINERY to "08-3d-history-joinery")) {
            compose.onNode(hasContentDescription(evidence.string(R.string.timeline_rule_description)))
                .performSemanticsAction(SemanticsActions.SetProgress) { it(key.ordinal.toFloat()) }
            compose.waitUntil(5_000) { progress.session?.cursor == TimelineCursor.Stage(key) }
            assertEquals(projection.visibleIds(ConstructionView.AtStage(key)), preview.viewer.construction)
            evidence.settleFrames(now)
            evidence.capture(shot, "objects" to preview.viewer.construction?.size)
        }
        compose.onNode(hasText(evidence.string(R.string.timeline_return_now)) and hasClickAction()).performClick()
        compose.waitUntil(5_000) { progress.session?.cursor == TimelineCursor.Now }
        assertEquals("Teraz is the saved state", actual, preview.viewer.construction)

        // Leave 3D, enter again: drawn again, same state, one engine.
        Espresso.pressBack()
        compose.waitUntil(Evidence.RENDER_TIMEOUT_MS) { preview.renderDiagnostics == null }
        compose.onNode(evidence.tab(evidence.string(R.string.place_model))).performClick()
        evidence.awaitRenderer(preview, "3D again")
        assertEquals(actual, preview.viewer.construction)
        evidence.capture("09-3d-again")
        assertFalse("the preview never saved", progress.view?.summary?.currentStage != ConstructionStageKey.WALLS)
        assertNotNull(progress.view)
        evidence.fact("result", "PASS")
    }

    private fun openStage(label: String) {
        compose.onNode(hasScrollAction()).performScrollToNode(hasText(label))
        compose.onNode(hasText(label) and hasClickAction()).performClick()
        compose.waitForIdle()
        compose.onNode(hasScrollAction()).performScrollToNode(hasText(evidence.string(R.string.stage_show_in_3d)) or hasText(evidence.string(R.string.stage_show_now)))
    }

    private fun stageName(key: ConstructionStageKey): String = evidence.string(
        when (key) {
            ConstructionStageKey.PLOT_PURCHASE -> R.string.stage_plot_purchase
            ConstructionStageKey.DESIGN -> R.string.stage_design
            ConstructionStageKey.PERMITS -> R.string.stage_permits
            ConstructionStageKey.SITE_PREPARATION -> R.string.stage_site_preparation
            ConstructionStageKey.FOUNDATIONS -> R.string.stage_foundations
            ConstructionStageKey.WALLS -> R.string.stage_walls
            else -> error("not used by the slice: $key")
        },
    )
}
