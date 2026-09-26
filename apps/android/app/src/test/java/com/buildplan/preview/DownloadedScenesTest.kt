package com.buildplan.preview

import com.buildplan.preview.AnalyzerFixtures.filesIn
import com.buildplan.preview.scene.AnalysisRecord
import com.buildplan.preview.scene.BundledScenes
import com.buildplan.preview.scene.DownloadedScenes
import com.buildplan.preview.scene.SaveResult
import com.buildplan.preview.scene.SceneLoadResult
import com.buildplan.preview.scene.SceneRejection
import com.buildplan.preview.scene.SceneRepository
import com.buildplan.preview.scene.SceneSourceKind
import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Keeping downloaded analyses on the phone: verified before they are kept,
 * written so that a failure leaves nothing, found again after a restart,
 * checked again when opened, and never able to take a bundled scene's place.
 */
class DownloadedScenesTest {

    private val dir = AnalyzerFixtures.tempDir()
    private var now = 1_000L
    private val clock = { now }
    private val store = DownloadedScenes(dir, clock)

    private val demoBytes = AnalyzerFixtures.sceneBytes
    private val demoSha = AnalyzerFixtures.sceneSha256
    private val demoContentHash = AnalyzerFixtures.sceneContentHash

    private fun record(
        sha: String = demoSha,
        contentHash: String = demoContentHash,
        label: String = "Dom w marcówkach (GE) (analysis)",
        jobId: String = AnalyzerFixtures.JOB,
    ) = AnalysisRecord(
        title = label.removeSuffix(" (analysis)"),
        label = label,
        sceneSha256 = sha,
        sceneContentHash = contentHash,
        candidateHash = AnalyzerFixtures.CANDIDATE,
        modelHash = AnalyzerFixtures.MODEL,
        sourceUrl = AnalyzerFixtures.LINK,
        jobId = jobId,
        analyzedAt = "2026-09-26T10:03:00.000Z",
        qualityL0 = 12,
        qualityL1 = 30,
        qualityL2 = 18,
        unresolvedCount = 2,
        warningsCount = 3,
        visionMode = "DETERMINISTIC_ONLY",
    )

    /** A second, different scene: another bundle the build ships, with its own hashes. */
    private val otherBytes: ByteArray by lazy { TestScenes.text("marcowki-auto.scene.json").encodeToByteArray() }
    private val otherSha: String by lazy { DownloadedScenes.sha256Hex(otherBytes) }
    private val otherRecord by lazy { record(otherSha, TestScenes.bundle("marcowki-auto").contentHash, "Another house (analysis)") }

    private fun saved(result: SaveResult) = (result as? SaveResult.Saved)?.entry ?: error("expected Saved, got $result")
    private fun rejected(result: SaveResult) = (result as? SaveResult.Rejected)?.reason ?: error("expected Rejected, got $result")

    @Test
    fun `a verified scene is stored under its sha256 and listed`() {
        val entry = saved(store.save(demoBytes, demoSha, record()))
        assertEquals("analysis-${demoSha.take(12)}", entry.key)
        assertEquals(demoSha, entry.sceneSha256)
        assertEquals(demoBytes.size.toLong(), entry.sizeBytes)
        assertEquals(listOf("$demoSha.json", "index.json"), filesIn(dir))
        assertTrue(File(dir, "$demoSha.json").readBytes().contentEquals(demoBytes))
        assertEquals(listOf(entry), store.list())
        val loaded = store.load(entry.key) as SceneLoadResult.Ok
        assertEquals(entry.key, loaded.scene.key)
        assertEquals("Dom w marcówkach (GE) (analysis)", loaded.scene.title)
    }

    @Test
    fun `the sha256 must match the summary, or nothing is written`() {
        val tampered = demoBytes.copyOf().also { it[100] = (it[100] + 1).toByte() }
        val reason = rejected(store.save(tampered, null, record())) as SceneRejection.HashMismatch
        assertEquals("scene sha256", reason.what)
        assertTrue(filesIn(dir).isEmpty())
        assertTrue(store.list().isEmpty())
    }

    @Test
    fun `the X-Content-SHA256 header must match too when the service sends it`() {
        val reason = rejected(store.save(demoBytes, "0".repeat(64), record())) as SceneRejection.HashMismatch
        assertEquals("X-Content-SHA256 header", reason.what)
        assertTrue(filesIn(dir).isEmpty())
        // Case does not matter; the value does.
        saved(store.save(demoBytes, demoSha.uppercase(), record()))
    }

    @Test
    fun `an oversize scene is refused before anything else`() {
        assertEquals(64L * 1024 * 1024, DownloadedScenes.MAX_SCENE_BYTES)
        val small = DownloadedScenes(dir, clock, maxSceneBytes = 1024)
        val reason = rejected(small.save(demoBytes, null, record())) as SceneRejection.TooLarge
        assertEquals(1024L, reason.limitBytes)
        assertEquals(demoBytes.size.toLong(), reason.actualBytes)
        assertTrue(filesIn(dir).isEmpty())
    }

    @Test
    fun `bytes that are not a mobile scene bundle are refused even when the hash matches`() {
        val foreign = TestScenes.text("demo.scene.json")
            .replace("\"schema\":\"buildapp.mobile-scene-bundle\"", "\"schema\":\"something.else\"")
            .encodeToByteArray()
        val reason = rejected(store.save(foreign, null, record(sha = DownloadedScenes.sha256Hex(foreign)))) as SceneRejection.InvalidScene
        assertTrue(reason.message, reason.message.contains("unknown scene schema"))

        val notJson = "{ not a scene".encodeToByteArray()
        assertTrue(rejected(store.save(notJson, null, record(sha = DownloadedScenes.sha256Hex(notJson)))) is SceneRejection.InvalidScene)
        assertTrue(filesIn(dir).isEmpty())
    }

    @Test
    fun `the bundle's contentHash must be the summary's sceneContentHash`() {
        val reason = rejected(store.save(demoBytes, null, record(contentHash = "9".repeat(64)))) as SceneRejection.HashMismatch
        assertEquals("scene contentHash", reason.what)
        assertTrue(filesIn(dir).isEmpty())
    }

    @Test
    fun `file names come only from a well-formed sha256`() {
        for (bad in listOf("../../../evil", "ABC", "", "$demoSha/../x", demoSha.uppercase() + "0")) {
            val reason = rejected(store.save(demoBytes, null, record(sha = bad)))
            assertTrue("$bad: $reason", reason is SceneRejection.InvalidScene || reason is SceneRejection.HashMismatch)
        }
        assertTrue(filesIn(dir).isEmpty())
        assertTrue("nothing may be written outside the store", dir.parentFile!!.listFiles()!!.none { it.name == "evil" })
    }

    @Test
    fun `a failed rename leaves no partial file and no entry`() {
        // A directory where the scene file must go makes the atomic rename fail.
        val blocker = File(dir, "$demoSha.json").apply { mkdirs() }
        File(blocker, "occupied").writeText("x")
        val reason = rejected(store.save(demoBytes, null, record()))
        assertTrue(reason is SceneRejection.StorageFailed)
        assertEquals(listOf("$demoSha.json/occupied"), filesIn(dir))
        assertTrue(store.list().isEmpty())
    }

    @Test
    fun `a failed index write removes the scene it had just written`() {
        val blocker = File(dir, DownloadedScenes.INDEX).apply { mkdirs() }
        File(blocker, "occupied").writeText("x")
        val reason = rejected(store.save(demoBytes, null, record()))
        assertTrue(reason is SceneRejection.StorageFailed)
        assertEquals(listOf("index.json/occupied"), filesIn(dir))
    }

    @Test
    fun `temporary files left by an interrupted write are swept on the next save`() {
        dir.mkdirs()
        File(dir, ".$demoSha.json.123.tmp").writeText("half a scene")
        saved(store.save(demoBytes, null, record()))
        assertEquals(listOf("$demoSha.json", "index.json"), filesIn(dir))
    }

    @Test
    fun `a new store on the same folder sees the same analyses, as after a restart`() {
        val entry = saved(store.save(demoBytes, demoSha, record()))
        val afterRestart = DownloadedScenes(dir)
        assertEquals(listOf(entry), afterRestart.list())
        assertTrue(afterRestart.load(entry.key) is SceneLoadResult.Ok)
    }

    @Test
    fun `downloading the same scene again reuses its file and keeps one entry`() {
        val first = saved(store.save(demoBytes, null, record()))
        val file = File(dir, "$demoSha.json")
        file.setLastModified(1_000_000L)
        now = 2_000L
        val again = store.save(demoBytes, null, record(jobId = "fedcba9876543210fedcba9876543210")) as SaveResult.Saved
        assertTrue(again.reusedFile)
        assertEquals(1_000_000L, file.lastModified())
        assertEquals(first.key, again.entry.key)
        assertEquals("fedcba9876543210fedcba9876543210", again.entry.jobId)
        assertEquals(1, store.list().size)
    }

    @Test
    fun `delete removes the file and the entry`() {
        val entry = saved(store.save(demoBytes, null, record()))
        val other = saved(store.save(otherBytes, null, otherRecord))
        assertTrue(store.delete(entry.key))
        assertEquals(listOf(other.key), store.list().map { it.key })
        assertFalse(File(dir, "$demoSha.json").exists())
        assertTrue(File(dir, "$otherSha.json").exists())
        assertFalse(store.delete(entry.key))
        assertTrue(store.load(entry.key) is SceneLoadResult.Failed)
    }

    @Test
    fun `the most recently used analysis is listed first`() {
        now = 10
        val a = saved(store.save(demoBytes, null, record()))
        now = 20
        val b = saved(store.save(otherBytes, null, otherRecord))
        assertEquals(listOf(b.key, a.key), store.list().map { it.key })
        now = 30
        store.touch(a.key)
        assertEquals(listOf(a.key, b.key), store.list().map { it.key })
        assertEquals(30L, store.find(a.key)!!.lastUsedAt)
        // Opening through the repository counts as use.
        now = 40
        val repository = SceneRepository(BundledScenes { TestScenes.text(it) }, store)
        val entryB = repository.entries().first { it.key == b.key }
        assertTrue(repository.load(entryB) is SceneLoadResult.Ok)
        assertEquals(listOf(b.key, a.key), store.list().map { it.key })
    }

    @Test
    fun `a file damaged on disk is reported when opened, and can be deleted`() {
        val entry = saved(store.save(demoBytes, null, record()))
        val file = File(dir, "$demoSha.json")
        file.writeBytes(demoBytes.copyOf().also { it[10] = 'X'.code.toByte() })
        val failed = store.load(entry.key) as SceneLoadResult.Failed
        assertTrue(failed.message, failed.message.contains("damaged"))
        assertTrue(store.delete(entry.key))
        assertTrue(store.list().isEmpty())
        assertTrue(filesIn(dir) == listOf("index.json"))
    }

    @Test
    fun `a damaged file is replaced when the same scene is downloaded again`() {
        saved(store.save(demoBytes, null, record()))
        File(dir, "$demoSha.json").writeText("garbage")
        val again = store.save(demoBytes, null, record()) as SaveResult.Saved
        assertFalse(again.reusedFile)
        assertTrue(store.load(again.entry.key) is SceneLoadResult.Ok)
    }

    // -----------------------------------------------------------------------
    // Bundled scenes are never overwritten or shadowed
    // -----------------------------------------------------------------------

    @Test
    fun `downloaded keys live in their own namespace, which no bundled key is in`() {
        val bundledKeys = TestScenes.index.map { it.key }
        val entry = saved(store.save(demoBytes, null, record()))
        assertTrue(entry.key.startsWith(DownloadedScenes.KEY_PREFIX))
        assertTrue(bundledKeys.none { it.startsWith(DownloadedScenes.KEY_PREFIX) })
        assertTrue(entry.key !in bundledKeys)
        // The demo bundle is ALSO shipped; storing its exact bytes still cannot take its key.
        assertTrue(TestScenes.index.any { it.key == "demo" })
    }

    @Test
    fun `an index entry claiming a bundled key or a foreign file is ignored`() {
        saved(store.save(demoBytes, null, record()))
        val index = File(dir, DownloadedScenes.INDEX)
        val forged = index.readText()
            .replace("\"key\":\"analysis-${demoSha.take(12)}\"", "\"key\":\"marcowki\"")
        index.writeText(forged)
        assertTrue("a forged key is never listed", store.list().isEmpty())
        val repository = SceneRepository(BundledScenes { TestScenes.text(it) }, store)
        assertEquals(TestScenes.index.map { it.key }, repository.entries().map { it.key })

        index.writeText("""{"entries":[{"key":"analysis-../../x","sceneSha256":"../../x"}]}""")
        assertTrue(store.list().isEmpty())
        index.writeText("not json")
        assertTrue(store.list().isEmpty())
    }

    @Test
    fun `the viewer lists bundled scenes unchanged and in order, then downloaded analyses`() {
        val bundled = BundledScenes { TestScenes.text(it) }
        val before = SceneRepository(bundled, store).entries()
        assertEquals(listOf("marcowki", "marcowki-auto-v3", "marcowki-auto", "marcowki-auto-v2", "demo"), before.map { it.key })
        assertTrue(before.all { it.source == SceneSourceKind.BUNDLED })
        assertEquals(TestScenes.index.map { it.title }, before.map { it.title })

        now = 10
        val a = saved(store.save(demoBytes, null, record()))
        now = 20
        val b = saved(store.save(otherBytes, null, otherRecord))
        val after = SceneRepository(bundled, store).entries()
        assertEquals(before, after.take(5))
        assertEquals(listOf(b.key, a.key), after.drop(5).map { it.key })
        assertTrue(after.drop(5).all { it.source == SceneSourceKind.DOWNLOADED })
        assertEquals("Dom w marcówkach (GE) (analysis)", after.last().title)

        // Loading dispatches to the right source.
        val repository = SceneRepository(bundled, store)
        val reference = repository.load(after.first()) as SceneLoadResult.Ok
        assertEquals("marcowki", reference.scene.key)
        val analysis = repository.load(after.last()) as SceneLoadResult.Ok
        assertEquals(a.key, analysis.scene.key)
    }

    @Test
    fun `without a downloaded store the viewer lists only the bundled scenes`() {
        val repository = SceneRepository(BundledScenes { TestScenes.text(it) })
        assertEquals(5, repository.entries().size)
        val entry = repository.entries().first()
        assertTrue(repository.load(entry) is SceneLoadResult.Ok)
        assertNull(DownloadedScenes(AnalyzerFixtures.tempDir()).find("analysis-000000000000"))
        assertNotNull(repository.entries().firstOrNull { it.key == "demo" })
    }

    @Test
    fun `the subtitle says when it was analysed and which candidate it is`() {
        val subtitle = DownloadedScenes.subtitleFor("2026-09-26T10:03:00.000Z", AnalyzerFixtures.CANDIDATE)
        assertTrue(subtitle, subtitle.startsWith("Analysed "))
        assertTrue(subtitle, subtitle.contains("2026"))
        assertTrue(subtitle, subtitle.endsWith(" · candidate ${AnalyzerFixtures.CANDIDATE.take(12)}"))
    }
}
