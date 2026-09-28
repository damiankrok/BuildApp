package com.buildplan.preview

import com.buildplan.preview.progress.ConstructionProgressState
import com.buildplan.preview.progress.ConstructionStageKey
import com.buildplan.preview.progress.ConstructionStageProgress
import com.buildplan.preview.progress.HouseId
import com.buildplan.preview.progress.ProgressEdit
import com.buildplan.preview.progress.ProgressRejection
import com.buildplan.preview.progress.StageProgressMetric
import com.buildplan.preview.progress.StageStatus
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertThrows
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The construction progress record (INTEGRATION-003C): its invariants, the
 * edits, and the one percentage every screen shows.
 */
class ConstructionProgressTest {
    private val house = HouseId("m-analysis-test-house")
    private val t0 = 1_000L

    private fun starter() = ConstructionProgressState.starter(house, t0)

    private fun ProgressEdit.applied(): ConstructionProgressState = when (this) {
        is ProgressEdit.Applied -> state
        is ProgressEdit.Rejected -> throw AssertionError("expected the edit to apply, it was rejected: $reason")
    }

    private fun ProgressEdit.rejection(): ProgressRejection = when (this) {
        is ProgressEdit.Rejected -> reason
        is ProgressEdit.Applied -> throw AssertionError("expected the edit to be rejected")
    }

    private fun id(key: ConstructionStageKey) = "stage-${key.key}"

    // -- the starter list ------------------------------------------------------

    @Test
    fun starterHasTheSeventeenStagesInOrderAllNotStartedWithEqualWeights() {
        val s = starter()
        assertEquals(ConstructionStageKey.entries.map { it.key }, s.stages.map { it.definitionKey })
        assertEquals((1..17).toList(), s.stages.map { it.order })
        assertTrue(s.stages.all { it.status == StageStatus.NOT_STARTED && it.completion == 0.0 && it.weight == 1.0 })
        assertTrue(s.isUnset)
        assertNull(s.currentStage)
        assertNull(s.currentTaskLabel)
    }

    // -- "everything before this is finished" ----------------------------------

    @Test
    fun markDoneBeforeFinishesExactlyTheEarlierUnfinishedStagesInOneEdit() {
        var s = starter().markDone(id(ConstructionStageKey.DESIGN), t0).applied()
        s = s.startStage(id(ConstructionStageKey.ROOF), 0.4, t0).applied()
        assertEquals(
            "the count the button shows: stages 1-7 minus the one already done",
            6,
            s.unfinishedBefore(id(ConstructionStageKey.ROOF)).size,
        )
        val after = s.markDoneBefore(id(ConstructionStageKey.ROOF), t0 + 5).applied()
        assertTrue(after.stages.take(7).all { it.status == StageStatus.DONE && it.completion == 1.0 })
        assertEquals("the current stage is untouched", StageStatus.IN_PROGRESS, after.stage(id(ConstructionStageKey.ROOF))?.status)
        assertEquals(0.4, after.stage(id(ConstructionStageKey.ROOF))?.completion ?: -1.0, 0.0)
        assertTrue("later stages are untouched", after.stages.drop(8).all { it.status == StageStatus.NOT_STARTED })
        assertEquals(t0 + 5, after.updatedAtEpochMs)
        assertEquals(0, after.unfinishedBefore(id(ConstructionStageKey.ROOF)).size)
    }

    @Test
    fun markDoneBeforeNeverFinishesAStageInProgressBehindTheOwnersBack() {
        val s = starter().startStage(id(ConstructionStageKey.WALLS), 0.5, t0).applied()
        assertEquals(ProgressRejection.ANOTHER_STAGE_IN_PROGRESS, s.markDoneBefore(id(ConstructionStageKey.ROOF), t0).rejection())
        assertEquals(ProgressRejection.UNKNOWN_STAGE, s.markDoneBefore("stage-nope", t0).rejection())
    }

    // -- percentage ------------------------------------------------------------

    @Test
    fun nothingStartedIsZeroPercent() {
        assertEquals(0.0, StageProgressMetric.fraction(starter()), 0.0)
        assertEquals("0%", StageProgressMetric.format(StageProgressMetric.percent(starter())))
    }

    @Test
    fun everythingDoneIsExactlyOneHundredPercent() {
        var s = starter()
        for (stage in s.stages) s = s.markDone(stage.stageId, t0).applied()
        assertEquals(1.0, StageProgressMetric.fraction(s), 0.0)
        assertEquals("100%", StageProgressMetric.format(StageProgressMetric.percent(s)))
    }

    @Test
    fun aPartialStageCountsItsOwnCompletion() {
        // 7 of 17 done and the 8th at 40 %: (7 + 0.4) / 17 = 43.5 %, shown as 43 %.
        var s = starter()
        for (key in ConstructionStageKey.entries.take(7)) s = s.markDone(id(key), t0).applied()
        s = s.startStage(id(ConstructionStageKey.ROOF), 0.4, t0).applied()
        assertEquals(7.4 / 17.0, StageProgressMetric.fraction(s), 1e-12)
        assertEquals(43, StageProgressMetric.percent(s))
        assertEquals("43%", StageProgressMetric.format(43))
    }

    @Test
    fun weightsAreNormalisedAndAHeavyStageWeighsMore() {
        val stages = listOf(
            ConstructionStageProgress("a", "walls", 1, StageStatus.DONE, 1.0, weight = 3.0),
            ConstructionStageProgress("b", "roof", 2, StageStatus.IN_PROGRESS, 0.5, weight = 1.0),
            ConstructionStageProgress("c", "joinery", 3, StageStatus.NOT_STARTED, 0.0, weight = 4.0),
        )
        val s = ConstructionProgressState(house, stages, updatedAtEpochMs = t0)
        assertEquals((3.0 + 0.5) / 8.0, StageProgressMetric.fraction(s), 1e-12)
        // Scaling every weight leaves the figure unchanged.
        val scaled = s.copy(stages = stages.map { it.copy(weight = it.weight * 10) })
        assertEquals(StageProgressMetric.fraction(s), StageProgressMetric.fraction(scaled), 1e-12)
    }

    @Test
    fun percentRoundsDownSoNothingShowsAHundredBeforeItIsDone() {
        assertEquals(99, StageProgressMetric.percentOf(0.999))
        assertEquals(0, StageProgressMetric.percentOf(0.004))
        assertEquals(100, StageProgressMetric.percentOf(1.0))
        assertThrows(IllegalArgumentException::class.java) { StageProgressMetric.percentOf(1.2) }
        assertThrows(IllegalArgumentException::class.java) { StageProgressMetric.percentOf(Double.NaN) }
    }

    // -- the completion contract ----------------------------------------------

    @Test
    fun completionFollowsStatusOrTheRecordIsRefused() {
        assertThrows(IllegalArgumentException::class.java) { ConstructionStageProgress("x", "walls", 1, StageStatus.DONE, 0.8) }
        assertThrows(IllegalArgumentException::class.java) { ConstructionStageProgress("x", "walls", 1, StageStatus.NOT_STARTED, 0.1) }
        assertThrows(IllegalArgumentException::class.java) { ConstructionStageProgress("x", "walls", 1, StageStatus.IN_PROGRESS, 1.5) }
        assertThrows(IllegalArgumentException::class.java) { ConstructionStageProgress("x", "walls", 1, StageStatus.IN_PROGRESS, -0.1) }
        assertThrows(IllegalArgumentException::class.java) { ConstructionStageProgress("x", "walls", 1, StageStatus.IN_PROGRESS, Double.NaN) }
        assertThrows(IllegalArgumentException::class.java) { ConstructionStageProgress("x", "walls", 1, StageStatus.IN_PROGRESS, 0.5, weight = 0.0) }
    }

    @Test
    fun anOutOfRangeCompletionEditIsRejectedAndChangesNothing() {
        val s = starter().startStage(id(ConstructionStageKey.WALLS), 0.2, t0).applied()
        assertEquals(ProgressRejection.COMPLETION_OUT_OF_RANGE, s.setCompletion(id(ConstructionStageKey.WALLS), 1.01, t0 + 1).rejection())
        assertEquals(ProgressRejection.COMPLETION_OUT_OF_RANGE, s.setCompletion(id(ConstructionStageKey.WALLS), Double.POSITIVE_INFINITY, t0 + 1).rejection())
        assertEquals(ProgressRejection.STAGE_NOT_IN_PROGRESS, s.setCompletion(id(ConstructionStageKey.ROOF), 0.5, t0 + 1).rejection())
        assertEquals(0.2, s.stage(id(ConstructionStageKey.WALLS))?.completion)
    }

    // -- one current stage -----------------------------------------------------

    @Test
    fun atMostOneStageIsCurrent() {
        val s = starter().startStage(id(ConstructionStageKey.WALLS), 0.5, t0).applied()
        assertEquals(id(ConstructionStageKey.WALLS), s.currentStageId)
        assertEquals(ProgressRejection.ANOTHER_STAGE_IN_PROGRESS, s.startStage(id(ConstructionStageKey.ROOF), 0.0, t0 + 1).rejection())
        // The record itself refuses two stages in progress, however it was made.
        assertThrows(IllegalArgumentException::class.java) {
            s.copy(stages = s.stages.map { if (it.definitionKey == "roof") it.copy(status = StageStatus.IN_PROGRESS) else it })
        }
    }

    @Test
    fun startingALaterStageDoesNotMarkEarlierOnesDone() {
        val s = starter().startStage(id(ConstructionStageKey.ROOF), 0.1, t0).applied()
        val roofOrder = checkNotNull(s.stage(id(ConstructionStageKey.ROOF))).order
        val earlier = s.stages.filter { it.order < roofOrder }
        assertTrue(earlier.all { it.status == StageStatus.NOT_STARTED })
    }

    @Test
    fun markingALaterStageDoneTouchesNoOtherStage() {
        val before = starter().startStage(id(ConstructionStageKey.WALLS), 0.3, t0).applied()
        val after = before.markDone(id(ConstructionStageKey.JOINERY), t0 + 5).applied()
        for (stage in after.stages) {
            if (stage.definitionKey == "joinery") assertEquals(StageStatus.DONE, stage.status)
            else assertEquals(before.stage(stage.stageId), stage)
        }
        assertEquals(t0 + 5, after.updatedAtEpochMs)
    }

    @Test
    fun theCurrentTaskBelongsToTheCurrentStageAndEndsWithIt() {
        assertEquals(ProgressRejection.NO_CURRENT_STAGE, starter().setCurrentTask("Montaż więźby", t0).rejection())
        var s = starter().startStage(id(ConstructionStageKey.ROOF), 0.4, t0).applied()
        s = s.setCurrentTask("  Montaż więźby  ", t0).applied()
        assertEquals("Montaż więźby", s.currentTaskLabel)
        s = s.markDone(id(ConstructionStageKey.ROOF), t0 + 1).applied()
        assertNull(s.currentTaskLabel)
        assertNull(s.currentStage)
        assertEquals(ProgressRejection.TEXT_TOO_LONG, starter().startStage(id(ConstructionStageKey.ROOF), 0.0, t0).applied().setCurrentTask("x".repeat(201), t0).rejection())
    }

    @Test
    fun resettingTheCurrentStageClearsItsTaskAndCompletion() {
        val s = starter().startStage(id(ConstructionStageKey.ROOF), 0.4, t0).applied()
            .setCurrentTask("Pokrycie", t0).applied()
            .resetStage(id(ConstructionStageKey.ROOF), t0 + 1).applied()
        assertEquals(StageStatus.NOT_STARTED, s.stage(id(ConstructionStageKey.ROOF))?.status)
        assertEquals(0.0, s.stage(id(ConstructionStageKey.ROOF))?.completion)
        assertNull(s.currentTaskLabel)
        assertTrue(s.isUnset)
    }

    @Test
    fun anUnknownStageIsRejected() {
        assertEquals(ProgressRejection.UNKNOWN_STAGE, starter().markDone("stage-nope", t0).rejection())
        assertEquals(ProgressRejection.UNKNOWN_STAGE, starter().startStage("stage-nope", 0.0, t0).rejection())
    }

    @Test
    fun recordInvariantsHold() {
        val stages = starter().stages
        assertThrows(IllegalArgumentException::class.java) { ConstructionProgressState(house, emptyList(), updatedAtEpochMs = t0) }
        assertThrows(IllegalArgumentException::class.java) { ConstructionProgressState(house, stages.reversed(), updatedAtEpochMs = t0) }
        assertThrows(IllegalArgumentException::class.java) { ConstructionProgressState(house, stages + stages.first(), updatedAtEpochMs = t0) }
        assertThrows(IllegalArgumentException::class.java) { ConstructionProgressState(house, stages, currentTaskLabel = "task without a stage", updatedAtEpochMs = t0) }
        assertThrows(IllegalArgumentException::class.java) { ConstructionProgressState(house, stages, updatedAtEpochMs = t0, schemaVersion = 2) }
        assertThrows(IllegalArgumentException::class.java) { HouseId(" ") }
    }

    @Test
    fun editsReturnNewStatesAndLeaveTheOldOneAsItWas() {
        val s = starter()
        val edited = s.startStage(id(ConstructionStageKey.WALLS), 0.5, t0 + 1).applied()
        assertTrue(s.isUnset)
        assertFalse(edited.isUnset)
        assertEquals(s.houseId, edited.houseId)
    }

    @Test
    fun theHouseIdIsTheCanonicalModelIdNeverAHashOrAFileName() {
        for (scene in TestScenes.all) {
            val id = HouseId.of(scene)
            assertEquals(scene.bundle.generatedFrom.modelId, id?.value)
            assertFalse("${scene.key}: not the content hash", id?.value == scene.bundle.contentHash)
            assertFalse("${scene.key}: not the scene key or asset name", id?.value == scene.key)
        }
    }
}
