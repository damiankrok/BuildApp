package com.buildplan.preview

import android.content.Intent
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performTextReplacement
import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.Espresso
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.buildplan.preview.analyzer.AnalysisState
import com.buildplan.preview.analyzer.AnalyzerFailure
import com.buildplan.preview.analyzer.AnalyzerMessages
import com.buildplan.preview.analyzer.RetryAction
import com.buildplan.preview.render.RenderDiagnostics
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeFalse
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * A project page on a publisher the app has no specialist reader for
 * (INTEGRATION-004A §36): pasted from the house, it is never refused for its
 * hostname. The page is fetched and inspected ("Sprawdzam stronę projektu"),
 * and the outcome is one of the honest typed states — a model, or a failure
 * that names what the page lacks — never "Obsługiwane są tylko strony
 * ARCHON". Which outcome a given page reaches is recorded, not asserted:
 * the test is about the path, the evidence about the page.
 *
 * `genericUrl` and `genericName` are instrumentation arguments; without a
 * URL the test is skipped. When the publisher cannot be reached the test is
 * skipped with `SOURCE_UNREACHABLE` recorded, never passed.
 */
@RunWith(AndroidJUnit4::class)
class GenericSourceDeviceTest {
    @get:Rule
    val compose = createEmptyComposeRule()

    private val args = InstrumentationRegistry.getArguments()
    private val url: String? = args.getString("genericUrl")
    private val name = args.getString("genericName") ?: "generic"
    private val timeoutMs = (args.getString("genericTimeoutMinutes")?.toLongOrNull() ?: 40L) * 60_000L
    private val evidence = Evidence(compose, "ui-evidence", "generic-$name")
    private var scenario: ActivityScenario<MainActivity>? = null

    @Before
    fun setUp() {
        assumeTrue("no genericUrl given", !url.isNullOrBlank())
        assertEquals(0, RenderDiagnostics.liveEngines.get())
    }

    @After
    fun tearDown() {
        evidence.writeManifest()
        scenario?.close()
    }

    @Test
    fun anUnknownPublisherIsReadOnItsEvidence() {
        val link = checkNotNull(url)
        val scenario = ActivityScenario.launch<MainActivity>(Intent(evidence.app, MainActivity::class.java)).also { this.scenario = it }
        val preview = evidence.preview(scenario)
        val analyzer = evidence.analyzer(scenario)
        evidence.fact("url", link)
        compose.waitUntil(Evidence.RENDER_TIMEOUT_MS) { preview.scene != null }
        val house = evidence.awaitRenderer(preview, "the house")
        val pose = preview.pose
        val housesBefore = preview.scenes.size

        evidence.openAnalyzerTask(compose, preview)
        compose.onNode(hasSetTextAction()).performTextReplacement(link)
        compose.onNode(hasText(evidence.string(R.string.analyzer_analyze)) and hasClickAction()).performClick()
        // Never refused before a byte is fetched: the job starts.
        compose.waitUntil(30_000) { analyzer.isRunning || analyzer.state is AnalysisState.Failed }
        assertTrue("the link was refused before fetching: ${analyzer.linkProblem} ${analyzer.state}", analyzer.isRunning)
        // The first stage's own words (AnalysisStages.DEFAULT_LABELS): the page is inspected, not refused.
        evidence.awaitNode(hasText("Sprawdzam stronę projektu", substring = true))
        evidence.capture("01-checking-page")

        val started = System.currentTimeMillis()
        compose.waitUntil(timeoutMs) { analyzer.state is AnalysisState.Completed || analyzer.state is AnalysisState.Failed }
        evidence.fact("analysisMs", System.currentTimeMillis() - started)
        when (val state = analyzer.state) {
            is AnalysisState.Completed -> {
                evidence.fact("outcome", "COMPLETED")
                evidence.fact("modelHash", state.summary.modelHash)
                evidence.fact("limited", state.summary.unresolved.isNotEmpty() || state.summary.warnings.isNotEmpty())
                evidence.awaitNode(hasText(evidence.string(R.string.house_open_3d)) and hasClickAction())
            }
            is AnalysisState.Failed -> {
                val failure = state.failure
                val code = (failure as? AnalyzerFailure.JobFailed)?.diagnosticCode
                    ?: (failure as? AnalyzerFailure.LocalRuntime)?.code
                    ?: (failure as? AnalyzerFailure.SourceContent)?.code
                evidence.fact("outcome", "FAILED $code")
                evidence.fact("failure", failure.toString())
                assumeFalse("SOURCE_UNREACHABLE: the publisher could not be reached", code == "SOURCE_UNREACHABLE" || failure is AnalyzerFailure.Offline)
                assertFalse("an unknown publisher is never refused by its hostname", failure is AnalyzerFailure.UnsupportedPublisher)
                val words = AnalyzerMessages.describe(failure)
                assertFalse("the old ARCHON-only sentence is gone: $words", words.contains("ARCHON"))
                evidence.awaitNode(hasText(words))
                if (failure is AnalyzerFailure.SourceContent) assertEquals(RetryAction.NONE, state.retry)
            }
            else -> error("the job neither completed nor failed: $state")
        }
        evidence.capture("02-outcome")

        // Back returns to the same house, whatever the outcome: nothing replaced it.
        Espresso.pressBack()
        evidence.awaitRenderer(preview, "the house again", replacing = house)
        assertEquals("the task did not move the camera", pose, preview.pose)
        assertEquals("the open house is the same", housesBefore + (if (analyzer.state is AnalysisState.Completed) 1 else 0), preview.scenes.size)
        evidence.fact("result", "PASS")
    }
}
