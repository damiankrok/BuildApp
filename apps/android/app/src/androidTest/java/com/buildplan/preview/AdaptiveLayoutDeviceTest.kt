package com.buildplan.preview

import android.content.Intent
import android.content.pm.ActivityInfo
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
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The same product on its side (INTEGRATION-003C, audit cycle 2): the phone
 * turned to landscape, where the screen is wide and short. Dom, 3D with the
 * time machine and Etapy are captured as the owner would see them, and the
 * rotation itself must not cost the house: after the activity is recreated
 * the 3D draws again with exactly one engine and the same construction state.
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

        // Test-only progress through the app's own edits: stages 1-7 done, Dach current at 40 %.
        for (key in DONE) assertEquals(EditOutcome.Saved, progress.markDone(stageId(progress, key)))
        assertEquals(EditOutcome.Saved, progress.startStage(stageId(progress, ConstructionStageKey.ROOF), 0.4))

        scenario.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE }
        compose.waitUntil(Evidence.RENDER_TIMEOUT_MS) { evidence.app.resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE }
        evidence.awaitNode(hasText(evidence.string(R.string.progress_metric_label)))
        val dom = evidence.capture("01-dom")
        evidence.fact("screen", "${dom.width}x${dom.height}")
        assertTrue("the capture is landscape", dom.width > dom.height)

        compose.onNode(evidence.tab(evidence.string(R.string.place_model))).performClick()
        val now = evidence.awaitRenderer(preview, "3D in landscape")
        val session = checkNotNull(progress.session)
        val actual = session.projection.visibleIds(ConstructionView.Actual(checkNotNull(session.state)))
        assertEquals("Teraz in landscape is the saved state", actual, preview.viewer.construction)
        evidence.capture("02-3d-now", "visibleObjects" to now.visibleObjects)

        progress.preview(ConstructionStageKey.WALLS)
        compose.waitUntil(5_000) { progress.session?.cursor == TimelineCursor.Stage(ConstructionStageKey.WALLS) }
        evidence.awaitNode(hasText(evidence.string(R.string.timeline_preview_of, evidence.string(R.string.stage_walls))))
        evidence.settleFrames(now)
        evidence.capture("03-3d-history-walls")
        progress.returnToNow()

        // Turning back recreates the activity: one engine, the same state, drawn again.
        scenario.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_PORTRAIT }
        compose.waitUntil(Evidence.RENDER_TIMEOUT_MS) { evidence.app.resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_PORTRAIT }
        val portrait = evidence.awaitRenderer(preview, "3D after turning back", replacing = now)
        assertEquals("the state survives the rotation", actual, preview.viewer.construction)
        assertEquals("one engine after turning back", 1, RenderDiagnostics.liveEngines.get())
        scenario.onActivity { it.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_LANDSCAPE }
        compose.waitUntil(Evidence.RENDER_TIMEOUT_MS) { evidence.app.resources.configuration.orientation == android.content.res.Configuration.ORIENTATION_LANDSCAPE }
        evidence.awaitRenderer(preview, "3D after turning again", replacing = portrait)

        Espresso.pressBack()
        compose.waitUntil(Evidence.RENDER_TIMEOUT_MS) { preview.renderDiagnostics == null }
        compose.onNode(evidence.tab(evidence.string(R.string.place_stages))).performClick()
        evidence.awaitNode(hasText(evidence.string(R.string.stages_title)))
        evidence.capture("04-etapy")
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
