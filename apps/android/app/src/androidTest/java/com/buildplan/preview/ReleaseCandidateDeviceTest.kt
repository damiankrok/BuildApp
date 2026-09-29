package com.buildplan.preview

import android.content.Intent
import androidx.compose.ui.test.assertIsEnabled
import androidx.compose.ui.test.hasClickAction
import androidx.compose.ui.test.hasContentDescription
import androidx.compose.ui.test.hasSetTextAction
import androidx.compose.ui.test.hasText
import androidx.compose.ui.test.junit4.createEmptyComposeRule
import androidx.compose.ui.test.performClick
import androidx.compose.ui.test.performScrollTo
import androidx.compose.ui.test.performTextReplacement
import androidx.lifecycle.Lifecycle
import androidx.test.core.app.ActivityScenario
import androidx.test.espresso.Espresso
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.buildplan.preview.analyzer.AnalysisState
import com.buildplan.preview.analyzer.AnalyzerFailure
import com.buildplan.preview.analyzer.AnalyzerMessages
import com.buildplan.preview.analyzer.RetryAction
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
 * The release-candidate journeys (INTEGRATION-003C §25X, kept under the
 * house-first shell of INTEGRATION-004A), on the built-in house, through the
 * app's own screens and state:
 *
 * - C, lifecycle: the house → the analyzer task → back to the house; pause
 *   and resume; the activity recreated; the app closed and opened again with
 *   the saved progress.
 * - D, unhappy paths: a stage with no geometry of its own; a corrupt progress
 *   file recovered and said so, on the house; an unsafe link refused before a
 *   byte is fetched.
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
        evidence.forgetOpenHouse()
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

    /** The headline the app gives an element (ElementWords), as the list shows it. */
    private fun elementTitleOf(obj: com.buildplan.preview.scene.SceneObject): String = when (val t = com.buildplan.preview.ui.ElementWords.title(obj)) {
        is com.buildplan.preview.ui.ElementWords.Title.SourceName -> t.name
        is com.buildplan.preview.ui.ElementWords.Title.Words -> evidence.string(t.res)
    }

    private fun stageId(progress: ProgressViewModel, key: ConstructionStageKey): String =
        checkNotNull(progress.view?.stages?.firstOrNull { it.stageKey == key }).stageId

    /** The house is the root: it is drawn as soon as the app is up, or again when a task returns. */
    private fun enter3d(preview: PreviewViewModel, step: String, replacing: RenderDiagnostics? = null): RenderDiagnostics =
        evidence.awaitRenderer(preview, step, replacing = replacing)

    /** Leave the house for the analyzer task: the viewport and its engine are gone. */
    private fun leave3d(preview: PreviewViewModel) {
        evidence.openAnalyzerTask(compose, preview)
        assertEquals("no engine after leaving the house", 0, RenderDiagnostics.liveEngines.get())
    }

    /** Back from the task returns to the same house. */
    private fun returnToHouse(preview: PreviewViewModel, step: String, replacing: RenderDiagnostics? = null): RenderDiagnostics {
        Espresso.pressBack()
        return evidence.awaitRenderer(preview, step, replacing = replacing)
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

        // The house → the analyzer task → back to the house, at the same camera.
        val first = enter3d(preview, "C first entry")
        // A camera the owner has set (a nudge is enough to leave home) is what the task must give back.
        compose.runOnIdle { preview.pan(6.0, 0.0) }
        val pose = preview.pose
        leave3d(preview)
        val second = returnToHouse(preview, "C second entry", replacing = first)
        val actual = checkNotNull(progress.session).actualVisible
        runCatching { compose.waitUntil(5_000) { preview.viewer.construction == actual } }
        assertEquals(actual, preview.viewer.construction)
        assertEquals("the task did not move the camera", pose, preview.pose)

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
        evidence.fact("C first/second/recreated frames", "${first.framesRendered.get()} / ${second.framesRendered.get()} / ${recreated.framesRendered.get()}")

        // The app closed and opened again: the saved progress is read back from disk.
        s.close()
        scenario = null
        assertEquals(0, RenderDiagnostics.liveEngines.get())
        val (reopenedScenario, reopenedPreview, reopened) = launch()
        val back = checkNotNull(reopened.view).summary
        assertEquals("percent after restart", saved.percent, back.percent)
        assertEquals("current stage after restart", saved.currentStage, back.currentStage)
        assertEquals("task after restart", saved.currentTask, back.currentTask)
        evidence.awaitNode(hasText(evidence.string(R.string.progress_now_task, "Montaż więźby")))
        evidence.capture("02-house-after-restart", "percent" to back.percent)

        // The house the owner had open is the one that opens again (cycle 3, H-03): open another house,
        // close the app, open it — and put the first house back for the tests that follow.
        val home = checkNotNull(reopenedPreview.scene).key
        val other = reopenedPreview.scenes.firstOrNull { it.key != home }
        if (other != null) {
            compose.runOnIdle { assertTrue(reopenedPreview.openKey(other.key)) }
            compose.waitUntil(Evidence.RENDER_TIMEOUT_MS) { reopenedPreview.scene?.key == other.key }
            reopenedScenario.close()
            scenario = null
            val (thirdScenario, third, _) = launch()
            assertEquals("the house last open opens again", other.key, checkNotNull(third.scene).key)
            evidence.fact("C last-open house restored", other.key)
            compose.runOnIdle { assertTrue(third.openKey(home)) }
            compose.waitUntil(Evidence.RENDER_TIMEOUT_MS) { third.scene?.key == home }
            thirdScenario.close()
            scenario = null
        } else {
            evidence.fact("C last-open house restored", "single house in this build; not exercised")
        }
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
        val d = enter3d(preview, "D 3D")
        // Said on the house, where the owner lands, in the rail's header (cycle 3, C3-04), and in the stage sheet.
        evidence.awaitNode(hasText(evidence.string(R.string.progress_problem_corrupt)), unmerged = true)
        assertTrue("the damaged record was kept aside", file.parentFile?.listFiles()?.any { it.name != file.name } == true)
        evidence.settleFrames(d)
        evidence.capture("01-corrupt-recovered")

        // A refused edit is said at the foot of the stage sheet, announced, and leaves by itself (cycle 2, C2-11).
        record(progress)
        compose.onNode(hasText(evidence.string(R.string.progress_now_task, "Montaż więźby")) and hasClickAction()).performClick()
        evidence.awaitNode(hasText(evidence.string(R.string.stages_title)))
        assertTrue(progress.startStage(stageId(progress, ConstructionStageKey.JOINERY)) is EditOutcome.Refused)
        evidence.awaitNode(hasText(evidence.string(R.string.stage_other_current, evidence.string(R.string.stage_roof))), unmerged = true)
        evidence.capture("02-refusal-said")
        Espresso.pressBack()
        compose.waitUntil(5_000) { compose.onAllNodes(hasText(evidence.string(R.string.stages_title))).fetchSemanticsNodes().isEmpty() }

        // A stage the model has no geometry for: the timeline says so, the 3D keeps the last shell.
        previewStage(preview, progress, ConstructionStageKey.ELECTRICAL)
        evidence.awaitNode(hasText(evidence.string(R.string.timeline_no_geometry)))
        assertDrawnAsStated(preview, d, "D electrical")
        evidence.settleFrames(d)
        evidence.capture("03-stage-without-geometry")
        compose.runOnIdle { progress.returnToNow() }

        // An unsafe link: refused before a byte is fetched (004A: safety is checked before recognition;
        // an unknown publisher is no longer refused by its hostname), said so, nothing added to the phone.
        leave3d(preview)
        val analyzer = evidence.analyzer(checkNotNull(scenario))
        val housesBefore = preview.scenes.size
        compose.onNode(hasSetTextAction()).performTextReplacement("https://localhost/dom")
        compose.onNode(hasText(evidence.string(R.string.analyzer_analyze)) and hasClickAction()).performClick()
        compose.waitUntil(30_000) { analyzer.linkProblem != null || analyzer.state is AnalysisState.Failed }
        val failure = (analyzer.state as? AnalysisState.Failed)?.failure
        val problem = analyzer.linkProblem ?: failure?.let { AnalyzerMessages.title(it) }
        evidence.fact("unsafe link", "problem=${analyzer.linkProblem} failure=$failure")
        assertFalse("nothing keeps running", analyzer.isRunning)
        assertEquals("no house was added", housesBefore, preview.scenes.size)
        if (failure != null) {
            // The link's problem, in words, with no retry that cannot succeed (cycle 3, C3-02).
            assertTrue("the address is refused as unsafe: $failure", failure is AnalyzerFailure.UnsafeUrl || failure is AnalyzerFailure.InvalidUrl)
            assertEquals("no retry is offered for a link that cannot succeed", RetryAction.NONE, (analyzer.state as AnalysisState.Failed).retry)
            evidence.awaitNode(hasText(AnalyzerMessages.describe(failure)))
        }
        // The form is open again for another link (cycle 3, C3-01): the job has ended, and the screen knows it.
        compose.onNode(hasSetTextAction()).assertIsEnabled()
        compose.onNode(hasText(evidence.string(R.string.analyzer_analyze)) and hasClickAction()).assertIsEnabled()
        evidence.capture("04-unsafe-link", "problem" to problem)
        // Back returns to the house.
        returnToHouse(preview, "D back on the house", replacing = d)
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
        // The roof planes stand at the end of Dach, and "Bez dachu" still takes them off (chimneys stay: they are not roof).
        val planes = roof.filter { id -> scene.objects.first { it.id == id }.kind == "roof" }
        assertTrue("the roof stage has roof planes", planes.isNotEmpty())
        assertTrue("roof off wins over the stage", planes.none { preview.viewer.isVisible(scene, it) })
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
        // The inspector names the stage the wall does not stand at yet (cycle 3, C3-10).
        evidence.awaitNode(hasText(evidence.string(R.string.inspector_not_yet_at, evidence.string(R.string.stage_foundations))), unmerged = true)
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

        // Without touching the model (cycle 2, C2-10): an element chosen from a list, and zoom by a button.
        compose.onNode(hasText(evidence.string(R.string.tool_layers)) and hasClickAction()).performClick()
        val drawn = preview.viewer.visibleObjectIds(scene).count { id -> scene.objects.first { it.id == id }.hasGeometry }
        compose.onNode(hasText(evidence.string(R.string.layer_elements_show, drawn)) and hasClickAction()).performClick()
        val chosen = scene.objects.first { it.id in preview.viewer.visibleObjectIds(scene) && it.hasGeometry && it.kind == "roof" }
        // The list scrolls inside the pane: bring the item into view before tapping it.
        compose.onAllNodes(hasText(elementTitleOf(chosen)) and hasClickAction())[0].performScrollTo().performClick()
        compose.waitUntil(5_000) { preview.viewer.selectedObjectId != null }
        evidence.fact("chosen from the list", preview.viewer.selectedObjectId)
        evidence.settleFrames(d)
        evidence.capture("05-element-from-list")
        val before = preview.pose.distance
        compose.onNode(hasText(evidence.string(R.string.tool_view)) and hasClickAction()).performClick()
        compose.onNode(hasText(evidence.string(R.string.view_zoom_in)) and hasClickAction()).performScrollTo().performClick()
        compose.waitUntil(5_000) { preview.pose.distance < before }
        evidence.fact("zoom by button: distance", "$before -> ${preview.pose.distance}")

        assertNotNull(progress.view)
        assertEquals("previews never touched the record", ConstructionStageKey.ROOF, progress.view?.summary?.currentStage)
        evidence.fact("result E", "PASS")
    }
}
