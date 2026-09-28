package com.buildplan.preview

import com.buildplan.preview.progress.ConstructionStageKey
import com.buildplan.preview.progress.EditOutcome
import com.buildplan.preview.progress.HouseId
import com.buildplan.preview.progress.ProgressAvailability
import com.buildplan.preview.progress.ProgressProblem
import com.buildplan.preview.progress.ProgressRejection
import com.buildplan.preview.progress.ProgressSession
import com.buildplan.preview.progress.ProgressStore
import com.buildplan.preview.progress.StageStatus
import com.buildplan.preview.progress.TimelineCursor
import com.buildplan.preview.scene.BundleOrigin
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.SceneBundle
import java.io.File
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * What the screens rely on (INTEGRATION-003C): one saved record per house,
 * a cursor that only looks, `Teraz` that returns to what was saved, and a
 * record that survives an app restart.
 */
class ProgressSessionTest {
    private val dir: File = Files.createTempDirectory("progress-session").toFile()
    private var now = 1_000L
    private val clock = { now++ }
    private val house = SyntheticStageHouse.scene()

    @After
    fun tearDown() {
        dir.deleteRecursively()
    }

    private fun session(scene: ModelScene = house) = ProgressSession(scene, ProgressStore(dir), clock)

    private fun id(key: ConstructionStageKey) = "stage-${key.key}"

    @Test
    fun aHouseWithNothingSavedIsUnsetAndShowsTheWholeDesign() {
        val s = session()
        assertEquals(ProgressAvailability.EDITABLE, s.availability)
        assertTrue(s.summary.unset)
        assertNull("no percentage while unset", s.summary.percent)
        assertEquals(17, s.stages.size)
        assertTrue(s.frame.progressUnset)
        assertNull("the whole design", s.frame.visible)
        assertFalse(dir.listFiles().orEmpty().any { it.isFile }, )
    }

    @Test
    fun theFirstEditCreatesTheRecordAndEveryScreenReadsTheSameSummary() {
        val s = session()
        for (k in listOf(ConstructionStageKey.PLOT_PURCHASE, ConstructionStageKey.DESIGN, ConstructionStageKey.PERMITS, ConstructionStageKey.SITE_PREPARATION, ConstructionStageKey.FOUNDATIONS, ConstructionStageKey.WALLS, ConstructionStageKey.FLOOR_SLAB)) {
            assertEquals(EditOutcome.Saved, s.markDone(id(k)))
        }
        assertEquals(EditOutcome.Saved, s.startStage(id(ConstructionStageKey.ROOF), 0.4))
        assertEquals(EditOutcome.Saved, s.setCurrentTask("Montaż więźby"))
        val summary = s.summary
        assertFalse(summary.unset)
        assertEquals(43, summary.percent)
        assertEquals("43%", summary.percentText)
        assertEquals(ConstructionStageKey.ROOF, summary.currentStage)
        assertEquals(40, summary.currentStageCompletionPercent)
        assertEquals("Montaż więźby", summary.currentTask)
        assertEquals(7, summary.doneCount)
        assertEquals(ConstructionStageKey.FLOOR_SLAB, summary.lastDone)
    }

    @Test
    fun previewingNeverWritesAndTerazReturnsToWhatWasSaved() {
        val s = session()
        s.markDone(id(ConstructionStageKey.WALLS))
        s.startStage(id(ConstructionStageKey.ROOF), 0.4)
        val file = ProgressStore(dir).fileFor(checkNotNull(HouseId.of(house)))
        val saved = file.readBytes()
        val now = s.frame

        for (cursor in listOf(TimelineCursor.Stage(ConstructionStageKey.WALLS), TimelineCursor.Stage(ConstructionStageKey.JOINERY), TimelineCursor.Target)) {
            s.preview(cursor)
            assertTrue(s.frame.isPreview)
            assertEquals("the saved stage is still the current one", ConstructionStageKey.ROOF, s.summary.currentStage)
        }
        assertTrue("the record on disk is byte for byte what was saved", saved.contentEquals(file.readBytes()))

        s.returnToNow()
        assertEquals(TimelineCursor.Now, s.cursor)
        assertEquals(now, s.frame)
    }

    @Test
    fun theHistoricalStagesRewindTheHouse() {
        val s = session()
        s.preview(TimelineCursor.Stage(ConstructionStageKey.FOUNDATIONS))
        val beforeWalls = checkNotNull(s.frame.visible)
        assertFalse("before walls: no walls", "wall-front" in beforeWalls)
        s.preview(TimelineCursor.Stage(ConstructionStageKey.WALLS))
        assertTrue("walls stage: walls stand", "wall-front" in checkNotNull(s.frame.visible))
        assertFalse("before roof: no roof", "roof-main" in checkNotNull(s.frame.visible))
        s.preview(TimelineCursor.Stage(ConstructionStageKey.ROOF))
        assertTrue("roof stage: the roof", "roof-main" in checkNotNull(s.frame.visible))
        assertFalse("before joinery: no window", "window-front" in checkNotNull(s.frame.visible))
        s.preview(TimelineCursor.Stage(ConstructionStageKey.JOINERY))
        assertTrue("joinery: windows and doors", checkNotNull(s.frame.visible).containsAll(listOf("window-front", "door-front")))
        s.preview(TimelineCursor.Stage(ConstructionStageKey.ELECTRICAL))
        assertTrue("a stage with no geometry of its own says so", s.frame.stageWithoutGeometry)
    }

    @Test
    fun anAppRestartReadsTheSameProgressBack() {
        val first = session()
        first.markDone(id(ConstructionStageKey.FOUNDATIONS))
        first.startStage(id(ConstructionStageKey.WALLS), 0.5)
        first.setCurrentTask("Murowanie parteru")
        val restarted = session()
        assertEquals(first.state, restarted.state)
        assertEquals(first.summary, restarted.summary)
        assertEquals(TimelineCursor.Now, restarted.cursor)
    }

    @Test
    fun aRefusedEditChangesNothingAndSaysWhy() {
        val s = session()
        s.startStage(id(ConstructionStageKey.WALLS), 0.2)
        val before = s.state
        assertEquals(EditOutcome.Refused(ProgressRejection.ANOTHER_STAGE_IN_PROGRESS), s.startStage(id(ConstructionStageKey.ROOF)))
        assertEquals(before, s.state)
        assertEquals(EditOutcome.Refused(ProgressRejection.STAGE_NOT_IN_PROGRESS), s.setCompletion(id(ConstructionStageKey.ROOF), 0.5))
        assertEquals(before, s.state)
    }

    @Test
    fun markingDoneTouchesOnlyThatStage() {
        val s = session()
        s.markDone(id(ConstructionStageKey.ROOF))
        val stages = checkNotNull(s.state).stages
        assertEquals(1, stages.count { it.status == StageStatus.DONE })
        assertEquals(StageStatus.NOT_STARTED, stages.first { it.stageKey == ConstructionStageKey.WALLS }.status)
    }

    @Test
    fun aCorruptRecordIsKeptAsideAndTheHouseStartsUnsetWithAWarning() {
        val s = session()
        s.markDone(id(ConstructionStageKey.WALLS))
        val file = ProgressStore(dir).fileFor(checkNotNull(HouseId.of(house)))
        file.writeText("{ not json")
        val after = session()
        assertTrue(after.problem is ProgressProblem.RecoveredFromCorruption)
        assertTrue(after.summary.unset)
        assertTrue("the damaged file was kept", dir.listFiles().orEmpty().any { it.name.contains(".corrupt-") })
        assertEquals("editing works again", EditOutcome.Saved, after.markDone(id(ConstructionStageKey.WALLS)))
    }

    @Test
    fun aModelWithoutAnIdIsPreviewOnlyAndCannotBeEdited() {
        val anonymous = ModelScene(
            key = "anon", title = "", subtitle = "",
            bundle = SceneBundle(generatedFrom = BundleOrigin(modelId = "")),
            objects = house.objects, levels = house.levels, bounds = house.bounds, materials = emptyMap(),
        )
        val s = session(anonymous)
        assertEquals(ProgressAvailability.PREVIEW_ONLY, s.availability)
        assertEquals(EditOutcome.NotEditable, s.markDone(id(ConstructionStageKey.WALLS)))
        s.preview(TimelineCursor.Stage(ConstructionStageKey.WALLS))
        assertTrue("the time machine still works", checkNotNull(s.frame.visible).contains("wall-front"))
    }

    @Test
    fun everyObjectReportsTheStageItFirstStandsAtAndUnknownsNone() {
        val s = session()
        assertEquals(ConstructionStageKey.WALLS, s.stageOf("wall-front"))
        assertEquals(ConstructionStageKey.ROOF, s.stageOf("roof-main"))
        assertEquals(ConstructionStageKey.JOINERY, s.stageOf("window-front"))
        assertNull("not a scene object", s.stageOf("nope"))
    }
}
