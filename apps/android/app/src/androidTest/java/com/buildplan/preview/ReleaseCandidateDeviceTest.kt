package com.buildplan.preview

import android.content.Intent
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasScrollAction
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollToNode
import androidx.compose.ui.test.performTextReplacement
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.Espresso
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.buildplan.preview.presentation.PresentationMode
import com.buildplan.preview.progress.ConstructionStageKey
import com.buildplan.preview.progress.ConstructionView
import com.buildplan.preview.progress.EditOutcome
import com.buildplan.preview.progress.HouseId
import com.buildplan.preview.progress.ProgressStore
import com.buildplan.preview.progress.TimelineCursor
import com.buildplan.preview.render.RenderDiagnostics
import com.buildplan.preview.scene.VisibilityMode
import com.buildplan.preview.ui.PreviewViewModel
import com.buildplan.preview.ui.ProgressViewModel
import java.io.File
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Rule
import org.junit.Test
import org.junit.rules.TestName
import org.junit.runner.RunWith

/**
 * The release-candidate journeys of audit cycle 3 (INTEGRATION-003C §25X),
 * on the built-in house, through the app's own screens and state:
 *
 * - C, lifecycle: Dom → 3D → back → 3D; pause and resume; the activity
 *   recreated; the app closed and opened again with the saved progress.
 * - D, unhappy paths: a stage with no geometry of its own; a corrupt progress
 *   file recovered and said so; a link the app does not support.
 * - E, interaction collisions: the construction history combined with the
 *   roof off, with one storey, with a selection and with the LINE drawing;
 *   the inspector in the timeline's place.
 *
 * Progress is test-only, recorded through the app's own edit calls on a clean
 * store. Every combination is checked against the renderer's own count of
 * the objects it draws, not only against the view state.
 */
@RunWith(AndroidJUnit4::class)
class ReleaseCandidateDeviceTest {
    @get:Rule
    val compose = createEmptyComposeRule()

    @get:Rule
    val test = TestName()

    /** One manifest per journey: rc-c, rc-d, rc-e. */
    private val evidence by lazy { Evidence(compose, "ui-evidence", "rc-" + test.methodName.substringAfter("journey").take(1).lowercase()) }
    private var scenario: ActivityScenario<MainActivity>? = null
    private val store get() = ProgressStore(File(evidence.app.filesDir, "progress"))

    @Before
    fun setUp() {
        File(evidence.app.filesDir, "progress").deleteRecursively()
        assertEquals(0, RenderDiagnostics.liveEngines.get())
    }

    @After
    fun tearDown() {
        evidence.writeManifest()
        scenario?.close()
    }

    private fun launch(): Triple<ActivityScenario<MainActivity>, PreviewViewModel, ProgressViewModel> {
        val s = ActivityScenario.launch<MainActivity>(Intent(evidence.app, MainActivity::class.java)).also { scenario = it }
        val preview = evidence.preview(s)
        val progress = evidence.progress(s)
        compose.waitUntil(Evidence.RENDER_TIMEOUT_MS) { progress.view != null && progress.sketch != null }
        return Triple(s, preview, progress)
    }

    /** Test-only progress: stages 1-7 done, Dach current at 40 %, a task. */
    private fun record(progress: ProgressViewModel) {
        val roof = stageId(progress, ConstructionStageKey.ROOF)
        assertEquals(EditOutcome.Saved, progress.startStage(roof, 0.4))
        assertEquals(EditOutcome.Saved, progress.markDoneBefore(roof))
        assertEquals(EditOutcome.Saved, progress.setCurrentTask("Montaż więźby"))
    }

    private fun stageId(progress: ProgressViewModel, key: ConstructionStageKey): String =
        checkNotNull(progress.view?.stages?.firstOrNull { it.stageKey == key }).stageId

    private fun enter3d(preview: PreviewViewModel, step: String, replacing: RenderDiagnostics? = null): RenderDiagnostics {
        compose.onNode(evidence.tab(evidence.string(R.string.place_model))).performClick()
        return evidence.awaitRenderer(preview, step, replacing = replacing)
    }

    private fun leave3d(preview: PreviewViewModel) {
        Espresso.pressBack()
        compose.waitUntil(Evidence.RENDER_TIMEOUT_MS) { preview.renderDiagnostics == null }
        assertEquals("no engine after leaving 3D", 0, RenderDiagnostics.liveEngines.get())
    }

    /** The renderer draws exactly what the viewer state says: stage ∩ layers ∩ isolation. */
    private fun assertDrawnAsStated(preview: PreviewViewModel, d: RenderDiagnostics, step: String) {
        val scene = checkNotNull(preview.scene)
        val expected = preview.viewer.visibleObjectIds(scene).count { id -> scene.objects.first { it.id == id }.hasGeometry }
        runCatching { compose.waitUntil(5_000) { d.visibleObjects == expected } }
        evidence.fact("$step: drawn objects", "${d.visibleObjects} (state says $expected)")
        assertEquals("$step: the renderer draws what the state says", expected, d.visibleObjects)
    }

    private fun previewStage(preview: PreviewViewModel, progress: ProgressViewModel, key: ConstructionStageKey) {
        compose.runOnIdle { progress.preview(key) }
        val expected = checkNotNull(progress.session).projection.visibleIds(ConstructionView.AtStage(key))
        runCatching { compose.waitUntil(5_000) { preview.viewer.construction == expected } }
        assertEquals(TimelineCursor.Stage(key), progress.session?.cursor)
        assertEquals(expected, preview.viewer.construction)
    }

    // -- Journey C: lifecycle ---------------------------------------------------

    @Test
    fun journeyC_lifecycle() {
        val (s, preview, progress) = launch()
        record(progress)
        val saved = checkNotNull(progress.view).summary

        // Dom → 3D → back → 3D.
        val first = enter3d(preview, "C first entry")
        leave3d(preview)
        val second = enter3d(preview, "C second entry")
        val actual = checkNotNull(progress.session).actualVisible
        assertEquals(actual, preview.viewer.construction)

        // Pause and resume (the app behind another one and back): drawing again, one engine.
        val before = second.framesRendered.get()
        s.moveToState(Lifecycle.State.CREATED)
        assertFalse("paused, the canvas stops asking for frames", second.resumed)
        s.moveToState(Lifecycle.State.RESUMED)
        compose.waitUntil(Evidence.RENDER_TIMEOUT_MS) { second.resumed && second.framesRendered.get() > before + 5 }
        assertEquals(1, RenderDiagnostics.liveEngines.get())
        evidence.settleFrames(second)
        evidence.capture("01-3d-after-resume")

        // The activity recreated (a configuration change): a new canvas, the same state.
        s.recreate()
        val recreated = evidence.awaitRenderer(preview, "C recreated", replacing = second)
        assertEquals(1, RenderDiagnostics.liveEngines.get())
        assertEquals("the construction state survives recreation", actual, preview.viewer.construction)
        leave3d(preview)
        evidence.fact("C first/second/recreated frames", "${first.framesRendered.get()} / ${second.framesRendered.get()} / ${recreated.framesRendered.get()}")

        // The app closed and opened again: the saved progress is read back from disk.
        s.close()
        scenario = null
        assertEquals(0, RenderDiagnostics.liveEngines.get())
        val (_, _, reopened) = launch()
        val back = checkNotNull(reopened.view).summary
        assertEquals("percent after restart", saved.percent, back.percent)
        assertEquals("current stage after restart", saved.currentStage, back.currentStage)
        assertEquals("task after restart", saved.currentTask, back.currentTask)
        evidence.awaitNode(hasText(evidence.string(R.string.progress_now_doing, "Montaż więźby")))
        evidence.capture("02-dom-after-restart", "percent" to back.percent)
        evidence.fact("result C", "PASS")
    }

    // -- Journey D: unhappy paths -------------------------------------------------

    @Test
    fun journeyD_unhappyPaths() {
        // A corrupt progress file: set aside, said so in Etapy, never silently replaced.
        val house = run {
            val (s, _, progress) = launch()
            val id = checkNotNull(progress.session?.houseId)
            s.close()
            scenario = null
            id
        }
        val file = store.fileFor(HouseId(house.value))
        file.parentFile?.mkdirs()
        file.writeText("{ this is not a progress record")
        val (_, preview, progress) = launch()
        compose.onNode(evidence.tab(evidence.string(R.string.place_stages))).performClick()
        evidence.awaitNode(hasText(evidence.string(R.string.progress_problem_corrupt)))
        assertTrue("the damaged record was kept aside", file.parentFile?.listFiles()?.any { it.name != file.name } == true)
        evidence.capture("01-corrupt-recovered")

        // A stage the model has no geometry for: the timeline says so, the 3D keeps the last shell.
        record(progress)
        val d = enter3d(preview, "D 3D")
        previewStage(preview, progress, ConstructionStageKey.ELECTRICAL)
        evidence.awaitNode(hasText(evidence.string(R.string.timeline_no_geometry)))
        assertDrawnAsStated(preview, d, "D electrical")
        evidence.settleFrames(d)
        evidence.capture("02-stage-without-geometry")
        compose.runOnIdle { progress.returnToNow() }
        leave3d(preview)

        // A link the app does not support: refused before anything is fetched, in words.
        compose.onNode(evidence.tab(evidence.string(R.string.place_house))).performClick()
        compose.onNode(hasScrollAction()).performScrollToNode(hasText(evidence.string(R.string.house_add_action)))
        compose.onAllNodes(hasText(evidence.string(R.string.house_add_action)) and hasClickAction())[0].performClick()
        evidence.awaitNode(hasText(evidence.string(R.string.analyzer_title)))
        compose.onNode(hasSetTextAction()).performTextReplacement("https://example.com/dom")
        compose.onNode(hasText(evidence.string(R.string.analyzer_analyze)) and hasClickAction()).performClick()
        compose.waitUntil(5_000) { evidence.analyzer(checkNotNull(scenario)).linkProblem != null }
        val problem = checkNotNull(evidence.analyzer(checkNotNull(scenario)).linkProblem)
        evidence.awaitNode(hasText(problem), unmerged = true)
        assertFalse("nothing started", evidence.analyzer(checkNotNull(scenario)).isRunning)
        evidence.capture("03-unsupported-link", "problem" to problem)
        evidence.fact("result D", "PASS")
    }

    // -- Journey E: interaction collisions ----------------------------------------

    @Test
    fun journeyE_collisions() {
        val (_, preview, progress) = launch()
        record(progress)
        val d = enter3d(preview, "E 3D")
        val scene = checkNotNull(preview.scene)
        val projection = checkNotNull(progress.session).projection
        val roof = projection.introducedAt(ConstructionStageKey.ROOF)
        val walls = projection.introducedAt(ConstructionStageKey.WALLS)

        // Roof off + history: at the end of Dach the roof stands, and the layer still takes it off.
        compose.runOnIdle { preview.setVisibility(VisibilityMode.ROOF_OFF) }
        previewStage(preview, progress, ConstructionStageKey.ROOF)
        assertTrue("roof off wins over the stage", roof.none { preview.viewer.isVisible(scene, it) })
        assertTrue("the walls still stand", walls.any { preview.viewer.isVisible(scene, it) })
        assertDrawnAsStated(preview, d, "E roof off at Dach")
        evidence.settleFrames(d)
        evidence.capture("01-roof-off-history")

        // One storey + history.
        compose.runOnIdle { preview.setVisibility(VisibilityMode.GROUND_ONLY) }
        previewStage(preview, progress, ConstructionStageKey.WALLS)
        assertDrawnAsStated(preview, d, "E ground only at Ściany")
        evidence.settleFrames(d)
        evidence.capture("02-ground-only-history")
        compose.runOnIdle { preview.setVisibility(VisibilityMode.ALL) }

        // Selection + history: a wall chosen now, then the build rewound to before the walls.
        compose.runOnIdle { progress.returnToNow() }
        val wall = walls.first { preview.viewer.isVisible(scene, it) }
        compose.runOnIdle { preview.onPicked(wall, System.currentTimeMillis()) }
        previewStage(preview, progress, ConstructionStageKey.FOUNDATIONS)
        assertEquals("the selection is kept while the wall is not built yet", wall, preview.viewer.selectedObjectId)
        assertFalse("…and it is not drawn", preview.viewer.isVisible(scene, wall))
        assertDrawnAsStated(preview, d, "E selection at Fundamenty")
        compose.onNode(hasText(evidence.string(R.string.dock_details)) and hasClickAction()).performClick()
        evidence.awaitNode(hasText(evidence.string(R.string.inspector_hidden_in_view)), unmerged = true)
        // The inspector takes the timeline's place: never stacked on it.
        assertTrue(
            "the timeline is away while the details are open",
            compose.onAllNodes(hasContentDescription(evidence.string(R.string.timeline_rule_description))).fetchSemanticsNodes().isEmpty(),
        )
        evidence.settleFrames(d)
        evidence.capture("03-selection-history-inspector")
        compose.onNode(hasContentDescription(evidence.string(R.string.inspector_close))).performClick()
        compose.onNode(hasContentDescription(evidence.string(R.string.selection_clear))).performClick()

        // The LINE drawing + history.
        compose.runOnIdle { preview.setPresentation(PresentationMode.LINE) }
        previewStage(preview, progress, ConstructionStageKey.WALLS)
        assertEquals(PresentationMode.LINE, preview.viewer.presentation)
        assertDrawnAsStated(preview, d, "E LINE at Ściany")
        evidence.settleFrames(d)
        evidence.capture("04-line-history")
        compose.runOnIdle {
            preview.setPresentation(PresentationMode.MODEL)
            progress.returnToNow()
        }
        assertNotNull(progress.view)
        assertEquals("previews never touched the record", ConstructionStageKey.ROOF, progress.view?.summary?.currentStage)
        evidence.fact("result E", "PASS")
    }
}
