package com.buildplan.preview

import com.buildplan.preview.progress.ConstructionProgressState
import com.buildplan.preview.progress.ConstructionStageKey
import com.buildplan.preview.progress.ConstructionTimeline
import com.buildplan.preview.progress.HouseId
import com.buildplan.preview.progress.ProgressEdit
import com.buildplan.preview.progress.ProgressLoad
import com.buildplan.preview.progress.ProgressStore
import com.buildplan.preview.progress.StageProjection
import com.buildplan.preview.progress.TimelineCursor
import java.nio.file.Files
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** The time machine's cursor (INTEGRATION-003C): previews never touch what was built. */
class ConstructionTimelineTest {
    private val scene = SyntheticStageHouse.scene()
    private val timeline = ConstructionTimeline(StageProjection(scene))
    private val house = HouseId("synthetic-stage-house")

    private fun roofInProgress(): ConstructionProgressState {
        var s = ConstructionProgressState.starter(house, 0L)
        for (key in listOf(ConstructionStageKey.FOUNDATIONS, ConstructionStageKey.WALLS, ConstructionStageKey.FLOOR_SLAB)) {
            s = (s.markDone("stage-${key.key}", 1L) as ProgressEdit.Applied).state
        }
        return (s.startStage("stage-roof", 0.4, 2L) as ProgressEdit.Applied).state
    }

    @Test
    fun nowWithNothingStatedShowsTheDesignAndSaysProgressIsNotSet() {
        val frame = timeline.frame(TimelineCursor.Now, null)
        assertNull(frame.visible)
        assertTrue(frame.progressUnset)
        assertFalse(frame.isPreview)
        assertTrue(timeline.frame(TimelineCursor.Now, ConstructionProgressState.starter(house, 0L)).progressUnset)
    }

    @Test
    fun nowShowsTheStatedStateAndIsNotAPreview() {
        val frame = timeline.frame(TimelineCursor.Now, roofInProgress())
        assertFalse(frame.isPreview)
        assertFalse(frame.progressUnset)
        val visible = checkNotNull(frame.visible)
        assertTrue("roof-main" in visible && "wall-front" in visible)
        assertFalse("window-front" in visible)
    }

    @Test
    fun aStageIsAlwaysCaptionedAsAPreviewAndSaysWhenItHasNoGeometry() {
        val progress = roofInProgress()
        val walls = timeline.frame(TimelineCursor.Stage(ConstructionStageKey.WALLS), progress)
        assertTrue(walls.isPreview)
        assertFalse(walls.stageWithoutGeometry)
        assertFalse("roof-main" in checkNotNull(walls.visible))
        assertTrue(timeline.frame(TimelineCursor.Stage(ConstructionStageKey.ELECTRICAL), progress).stageWithoutGeometry)
        assertTrue(timeline.frame(TimelineCursor.Target, progress).isPreview)
    }

    @Test
    fun scrubbingNeverChangesTheSavedProgressAndNowRestoresIt() {
        val dir = Files.createTempDirectory("timeline").toFile()
        try {
            val store = ProgressStore(dir)
            val actual = roofInProgress()
            store.save(actual)
            val saved = store.fileFor(house).readBytes()
            for (cursor in ConstructionTimeline.STOPS) timeline.frame(cursor, (store.load(house) as ProgressLoad.Loaded).state)
            assertTrue("a preview wrote to the saved progress", saved.contentEquals(store.fileFor(house).readBytes()))
            val now = timeline.frame(TimelineCursor.Now, (store.load(house) as ProgressLoad.Loaded).state)
            assertEquals(timeline.frame(TimelineCursor.Now, actual), now)
        } finally {
            dir.deleteRecursively()
        }
    }

    @Test
    fun theRailSnapsToStagesAndEndsAtTheDesign() {
        assertEquals(18, ConstructionTimeline.STOPS.size)
        assertEquals(TimelineCursor.Stage(ConstructionStageKey.PLOT_PURCHASE), ConstructionTimeline.snap(0.0))
        assertEquals(TimelineCursor.Target, ConstructionTimeline.snap(1.0))
        assertEquals(TimelineCursor.Stage(ConstructionStageKey.WALLS), ConstructionTimeline.snap(5.0 / 17.0))
        assertEquals(TimelineCursor.Stage(ConstructionStageKey.WALLS), ConstructionTimeline.snap(5.3 / 17.0))
        assertEquals(TimelineCursor.Stage(ConstructionStageKey.PLOT_PURCHASE), ConstructionTimeline.snap(-3.0))
    }
}
