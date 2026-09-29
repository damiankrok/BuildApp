package com.buildplan.preview

import android.content.Intent
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.performClick
import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.Espresso
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.buildplan.preview.render.RenderDiagnostics
import com.buildplan.preview.ui.ShellState
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

/**
 * A phone with no house on it (INTEGRATION-004A §24): the root is the
 * minimal add-house state — one paragraph and "Dodaj dom z linku" — with no
 * viewport, no engine and no dashboard; the button opens the analyzer task;
 * back returns to the same state. The scenes shipped in the APK are hidden
 * by the launch extra, which is the only way to see this state on a build
 * that carries a reference house.
 */
@RunWith(AndroidJUnit4::class)
class NoHouseDeviceTest {
    @get:Rule
    val compose = createEmptyComposeRule()

    private val evidence = Evidence(compose, "ui-evidence", "no-house")
    private var scenario: ActivityScenario<MainActivity>? = null

    @Before
    fun setUp() {
        assertEquals(0, RenderDiagnostics.liveEngines.get())
    }

    @After
    fun tearDown() {
        evidence.writeManifest()
        scenario?.close()
    }

    @Test
    fun aPhoneWithoutAHouseOffersOneThing() {
        val intent = Intent(evidence.app, MainActivity::class.java).putExtra(ShellState.EXTRA_WITHOUT_BUNDLED, true)
        val scenario = ActivityScenario.launch<MainActivity>(intent).also { this.scenario = it }
        val preview = evidence.preview(scenario)
        compose.waitUntil(Evidence.RENDER_TIMEOUT_MS) { preview.scenes.isEmpty() }
        evidence.awaitNode(hasText(evidence.string(R.string.no_house_title)))
        evidence.awaitNode(hasText(evidence.string(R.string.house_add_action)) and hasClickAction())
        assertNull("no viewport without a house", preview.renderDiagnostics)
        assertEquals("no engine without a house", 0, RenderDiagnostics.liveEngines.get())
        assertTrue("no house menu without a house", compose.onAllNodes(evidence.menuButton()).fetchSemanticsNodes().isEmpty())
        evidence.capture("01-add-link")

        compose.onNode(hasText(evidence.string(R.string.house_add_action)) and hasClickAction()).performClick()
        evidence.awaitNode(hasText(evidence.string(R.string.analyzer_title)))
        evidence.capture("02-analyzer-task")

        Espresso.pressBack()
        evidence.awaitNode(hasText(evidence.string(R.string.no_house_title)))
        assertEquals(0, RenderDiagnostics.liveEngines.get())
        evidence.fact("result", "PASS")
    }
}
