package com.buildplan.preview

import android.content.Intent
import android.content.pm.ActivityInfo
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.Espresso
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.buildplan.preview.progress.ConstructionStageKey
import com.buildplan.preview.progress.ConstructionView
import com.buildplan.preview.progress.EditOutcome
import com.buildplan.preview.progress.TimelineCursor
import com.buildplan.preview.render.RenderDiagnostics
import com.buildplan.preview.ui.ProgressViewModel
import java.io.File
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The same product on its side (INTEGRATION-004A): the phone turned to
 * landscape, where the screen is wide and short. The house with the time
 * machine, an element's details as a side panel, and the stage sheet are
 * captured as the owner would see them, and the rotation itself must not
 * cost the house: after the activity is recreated the 3D draws again with
 * exactly one engine and the same construction state.
 *
 * Progress here is test-only: recorded through the app's own edit calls on a
 * clean store, never shipped.
 */
@RunWith(AndroidJUnit4::class)
class AdaptiveLayoutDeviceTest {
    @get:Rule
    val compose = createEmptyComposeRule()

    private val evidence = Evidence(compose, "ui-evidence", "landscape")
    private var scenario: ActivityScenario<MainActivity>? = null

    @Before
    fun setUp() {
        File(evidence.app.filesDir, "progress").deleteRecursively()
        evidence.forgetOpenHouse()
        assertEquals(0, RenderDiagnostics.liveEngines.get())
    }

    @After
    fun tearDown() {
        evidence.writeManifest()
        scenario?.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED }
        scenario?.close()
    }

    @Test
    fun theProductOnItsSide() {
        val scenario = ActivityScenario.launch<MainActivity>(Intent(evidence.app, MainActivity::class.java)).also { this.scenario = it }
        val preview = evidence.preview(scenario)
        val progress = evidence.progress(scenario)
        compose.waitUntil(Evidence.RENDER_TIMEOUT_MS) { progress.view != null && progress.sketch != null }
        val upright = evidence.awaitRenderer(preview, "cold start")

        // Test-only progress through the app's own edits: stages 1-7 done, Dach current at 40 %.
        for (key in DONE) assertEquals(EditOutcome.Saved, progress.markDone(stageId(progress, key)))
        assertEquals(EditOutcome.Saved, progress.startStage(stageId(progress, ConstructionStageKey.ROOF), 0.4))

        scenario.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE }
        compose.waitUntil(Evidence.RENDER_TIMEOUT_MS) { evidence.app.resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE }
        val now = evidence.awaitRenderer(preview, "3D in landscape", replacing = upright)
        val session = checkNotNull(progress.session)
        val actual = session.projection.visibleIds(ConstructionView.Actual(checkNotNull(session.state)))
        runCatching { compose.waitUntil(5_000) { preview.viewer.construction == actual } }
        assertEquals("Teraz in landscape is the saved state", actual, preview.viewer.construction)
        val shot = evidence.capture("01-house", "visibleObjects" to now.visibleObjects)
        evidence.fact("screen", "${shot.width}x${shot.height}")
        assertTrue("the capture is landscape", shot.width > shot.height)
        evidence.assertHouseInsideFreeArea(preview, shot, "landscape house now")

        // Cycle 1, C1-02: on the short screen the timeline stops beside the rail — "Dopasuj" is not under it.
        val fit = compose.onNode(hasText(evidence.string(R.string.tool_fit)) and hasClickAction()).fetchSemanticsNode().boundsInRoot
        val rule = compose.onNode(hasContentDescription(evidence.string(R.string.timeline_rule_description))).fetchSemanticsNode().boundsInRoot
        val toggle = compose.onNode(hasContentDescription(evidence.string(R.string.timeline_expand))).fetchSemanticsNode().boundsInRoot
        evidence.fact("rail Fit / rule / toggle bounds", "$fit / $rule / $toggle")
        assertFalse("the timeline's rule overlaps Dopasuj", fit.overlaps(rule))
        assertFalse("the timeline's toggle overlaps Dopasuj", fit.overlaps(toggle))

        // A pane open on the short screen never lies under the timeline (cycle 3, H-02): the bottom stack
        // ends before it, and every row of the pane can be tapped.
        compose.onNode(hasText(evidence.string(R.string.tool_layers)) and hasClickAction()).performClick()
        evidence.awaitNode(hasText(evidence.string(R.string.layer_roof_off)) and hasClickAction())
        val option = compose.onNode(hasText(evidence.string(R.string.layer_roof_off)) and hasClickAction()).fetchSemanticsNode().boundsInRoot
        val ruleUnderPane = compose.onNode(hasContentDescription(evidence.string(R.string.timeline_rule_description))).fetchSemanticsNode().boundsInRoot
        evidence.fact("layers pane option / rule bounds", "$option / $ruleUnderPane")
        assertFalse("the timeline's rule overlaps the open pane", option.overlaps(ruleUnderPane))
        evidence.settleFrames(now)
        evidence.capture("06-layers-pane")
        Espresso.pressBack()
        compose.waitUntil(5_000) { compose.onAllNodes(hasText(evidence.string(R.string.layer_roof_off)) and hasClickAction()).fetchSemanticsNodes().isEmpty() }

        progress.preview(ConstructionStageKey.WALLS)
        compose.waitUntil(5_000) { progress.session?.cursor == TimelineCursor.Stage(ConstructionStageKey.WALLS) }
        evidence.awaitNode(hasText(evidence.string(R.string.timeline_preview_of, evidence.string(R.string.stage_walls))))
        evidence.settleFrames(now)
        evidence.capture("02-history-walls")
        progress.returnToNow()

        // Cycle 2, C2-02: the details on a phone on its side are a panel at the end edge, beside the
        // house, not a sheet over the whole short window.
        val scene = checkNotNull(preview.scene)
        val wall = checkNotNull(session.projection.introducedAt(ConstructionStageKey.WALLS).firstOrNull { preview.viewer.isVisible(scene, it) })
        compose.runOnIdle { preview.onPicked(wall, System.currentTimeMillis()) }
        compose.onNode(evidence.detailsHandle()).performClick()
        evidence.awaitNode(hasText(evidence.string(R.string.inspector_about)))
        val panel = compose.onNode(hasContentDescription(evidence.string(R.string.inspector_close))).fetchSemanticsNode().boundsInRoot
        compose.waitUntil(5_000) { preview.contentInsets.right > shot.width / 4 }
        evidence.settleFrames(now)
        val details = evidence.capture("03-details-panel", "selected" to wall)
        evidence.fact("details panel close button", panel.toString())
        assertTrue("the panel stands at the end edge: its close button is in the right half", panel.left > details.width / 2f)
        assertTrue("the frame gives the house the space left of the panel (r=${preview.contentInsets.right})", preview.contentInsets.right > details.width / 4)
        compose.onNode(hasContentDescription(evidence.string(R.string.inspector_close))).performClick()
        compose.onNode(hasContentDescription(evidence.string(R.string.selection_clear))).performClick()

        // The stage sheet on the short screen: the header and the list, scrolling, the house behind.
        // The rail's header names the stage in progress and is the way to the stage sheet.
        compose.onNode(hasText(evidence.string(R.string.stage_roof)) and hasClickAction()).performClick()
        evidence.awaitStageSheet()
        evidence.capture("04-stages-sheet")
        evidence.closeSheet(evidence.stageSheet())

        // Turning back recreates the activity: one engine, the same state, drawn again.
        scenario.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT }
        compose.waitUntil(Evidence.RENDER_TIMEOUT_MS) { evidence.app.resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_PORTRAIT }
        val portrait = evidence.awaitRenderer(preview, "3D after turning back", replacing = now)
        assertEquals("the state survives the rotation", actual, preview.viewer.construction)
        assertEquals("one engine after turning back", 1, RenderDiagnostics.liveEngines.get())
        scenario.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE }
        compose.waitUntil(Evidence.RENDER_TIMEOUT_MS) { evidence.app.resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE }
        evidence.awaitRenderer(preview, "3D after turning again", replacing = portrait)
        evidence.capture("05-house-again")
        evidence.fact("result", "PASS")
    }

    private fun stageId(progress: ProgressViewModel, key: ConstructionStageKey): String =
        checkNotNull(progress.view?.stages?.firstOrNull { it.stageKey == key }) { "no stage $key" }.stageId

    private companion object {
        val DONE = listOf(
            ConstructionStageKey.PLOT_PURCHASE, ConstructionStageKey.DESIGN, ConstructionStageKey.PERMITS,
            ConstructionStageKey.SITE_PREPARATION, ConstructionStageKey.FOUNDATIONS, ConstructionStageKey.WALLS,
            ConstructionStageKey.FLOOR_SLAB,
        )
    }
}
