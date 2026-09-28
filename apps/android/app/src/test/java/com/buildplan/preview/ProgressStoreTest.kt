package com.buildplan.preview

import com.buildplan.preview.progress.ConstructionProgressState
import com.buildplan.preview.progress.ConstructionStageKey
import com.buildplan.preview.progress.HouseId
import com.buildplan.preview.progress.ProgressEdit
import com.buildplan.preview.progress.ProgressLoad
import com.buildplan.preview.progress.ProgressSave
import com.buildplan.preview.progress.ProgressStore
import java.io.File
import java.nio.file.Files
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Saved progress (INTEGRATION-003C): what survives a restart, the exact
 * bytes, and what happens to a record that cannot be trusted.
 */
class ProgressStoreTest {
    private val dir: File = Files.createTempDirectory("progress-store").toFile()
    private val store = ProgressStore(dir)
    private val house = HouseId("m-analysis-dom-w-testowych")

    @After
    fun tearDown() {
        dir.deleteRecursively()
    }

    private fun ProgressEdit.applied(): ConstructionProgressState = (this as ProgressEdit.Applied).state

    private fun sample(): ConstructionProgressState {
        var s = ConstructionProgressState.starter(house, 1_000L)
        s = s.markDone("stage-${ConstructionStageKey.WALLS.key}", 2_000L).applied()
        s = s.startStage("stage-${ConstructionStageKey.ROOF.key}", 0.4, 3_000L).applied()
        s = s.setCurrentTask("Montaż więźby", 4_000L).applied()
        return s.setNote("stage-${ConstructionStageKey.WALLS.key}", "Pustak 25 cm", 5_000L).applied()
    }

    @Test
    fun nothingSavedIsMissingNotEmptyProgress() {
        assertEquals(ProgressLoad.Missing, store.load(house))
    }

    @Test
    fun aSavedRecordComesBackEqual() {
        val s = sample()
        assertEquals(ProgressSave.Saved, store.save(s))
        // A new store over the same folder is the app after a restart.
        assertEquals(ProgressLoad.Loaded(s), ProgressStore(dir).load(house))
    }

    @Test
    fun theSameStateIsAlwaysTheSameBytes() {
        val s = sample()
        assertEquals(ProgressStore.encode(s), ProgressStore.encode(sample()))
        store.save(s)
        val first = store.fileFor(house).readBytes()
        store.save(s)
        assertTrue(first.contentEquals(store.fileFor(house).readBytes()))
        // Explicit schema and version, stages in order.
        val text = String(first)
        assertTrue(text.contains("\"schema\": \"buildplan.construction-progress\""))
        assertTrue(text.contains("\"schemaVersion\": 1"))
        assertTrue(text.indexOf("\"plot_purchase\"") < text.indexOf("\"garden\""))
    }

    @Test
    fun aWriteLeavesNoTemporaryFileBehind() {
        store.save(sample())
        assertEquals(listOf(store.fileFor(house).name), dir.list()?.toList())
    }

    @Test
    fun housesDoNotShareARecord() {
        val other = HouseId("m-analysis-another-house")
        store.save(sample())
        assertEquals(ProgressLoad.Missing, store.load(other))
        assertFalse(store.fileFor(house) == store.fileFor(other))
    }

    @Test
    fun aDamagedFileIsMovedAsideAndReportedNeverSilentlyReset() {
        store.save(sample())
        store.fileFor(house).writeText("{ not json")
        val load = store.load(house)
        assertTrue("got $load", load is ProgressLoad.Corrupt)
        val kept = (load as ProgressLoad.Corrupt).keptAs
        assertNotNull(kept)
        assertEquals("{ not json", kept?.readText())
        // The house now reads as having no record; the damaged bytes are still on the phone.
        assertEquals(ProgressLoad.Missing, store.load(house))
        // And a new save works.
        assertEquals(ProgressSave.Saved, store.save(ConstructionProgressState.starter(house, 9L)))
    }

    @Test
    fun aRecordThatBreaksARuleIsCorruptNotLoaded() {
        store.save(sample())
        val file = store.fileFor(house)
        // Two stages in progress: syntactically fine, semantically impossible.
        file.writeText(file.readText().replace("\"NOT_STARTED\"", "\"IN_PROGRESS\""))
        assertTrue(store.load(house) is ProgressLoad.Corrupt)
    }

    @Test
    fun aRecordOfAnotherHouseIsNotLoadedForThisOne() {
        store.save(sample())
        val file = store.fileFor(house)
        file.writeText(file.readText().replace(house.value, "m-analysis-someone-else"))
        assertTrue(store.load(house) is ProgressLoad.Corrupt)
    }

    @Test
    fun aNewerRecordIsLeftAloneAndNotOverwritten() {
        store.save(sample())
        val file = store.fileFor(house)
        val newer = file.readText().replace("\"schemaVersion\": 1", "\"schemaVersion\": 2").replace("\"stages\"", "\"futureField\": true,\n    \"stages\"")
        file.writeText(newer)
        assertEquals(ProgressLoad.Unsupported(2), store.load(house))
        assertTrue(store.save(sample()) is ProgressSave.Failed)
        assertEquals(newer, file.readText())
    }
}
