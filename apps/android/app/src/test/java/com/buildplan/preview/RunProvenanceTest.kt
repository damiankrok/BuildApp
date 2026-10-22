package com.buildplan.preview

import com.buildplan.preview.analyzer.AnalysisSummary
import com.buildplan.preview.analyzer.AnalyzerJson
import com.buildplan.preview.analyzer.AppBuild
import com.buildplan.preview.analyzer.RunProvenance
import com.buildplan.preview.analyzer.RunProvenanceLog
import com.buildplan.preview.analyzer.recordOf
import com.buildplan.preview.scene.AnalysisOrigin
import com.buildplan.preview.scene.DownloadedScenes
import com.buildplan.preview.scene.SaveResult
import java.io.File
import java.time.Instant
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * N7-FIX-01 (Council F-2): every result names the analyzer that made it, the record survives a restart, and a result
 * stored before the record existed reads VERSION_UNKNOWN — never the build that happens to show it.
 */
class RunProvenanceTest {

    private fun resource(dir: String, name: String): ByteArray =
        requireNotNull(javaClass.classLoader?.getResourceAsStream("$dir/$name")) { "missing test resource $dir/$name" }.use { it.readBytes() }

    private val app = AppBuild(1307, "0.1307.0-test")

    @Test
    fun `a stored entry without a record, as an older build wrote it, has no provenance and is not given the current build's`() {
        val dir = AnalyzerFixtures.tempDir("provenance-legacy")
        val store = DownloadedScenes(dir)
        val record = recordOf(AnalyzerJson.decodeFromString(AnalysisSummary.serializer(), resource("analyzer-contract", "result.json").decodeToString()), "job", "", "", AnalysisOrigin.SERVICE)
        val saved = store.save(resource("analyzer-contract", "scene.json"), null, record) as SaveResult.Saved
        assertNull(saved.entry.provenance)
        // the index an older build wrote has no `provenance` key at all: it still reads, and still has none
        val index = File(dir, DownloadedScenes.INDEX)
        assertFalse(index.readText().contains("\"provenance\""))
        assertNull(DownloadedScenes(dir).find(saved.entry.key)?.provenance)
        assertEquals("VERSION_UNKNOWN", RunProvenance.VERSION_UNKNOWN)
    }

    @Test
    fun `a downloaded result is recorded as a service run, its bundle not visible to the phone`() {
        val summary = AnalyzerJson.decodeFromString(AnalysisSummary.serializer(), resource("analyzer-contract", "result.json").decodeToString())
        val p = RunProvenance.of(summary, "job-1", AnalysisOrigin.SERVICE, bundleSha256 = "e".repeat(64), app = app)
        assertEquals(AnalysisOrigin.SERVICE, p.mode)
        assertEquals("", p.analyzerBundleSha256)
        assertTrue(p.copyText().contains(RunProvenance.BUNDLE_NOT_VISIBLE))
        assertEquals("2.3.0", p.solverVersion)
        assertEquals(RunProvenance.STATE_COMPLETE, p.state)
        assertEquals("", p.checkpointSha256)
    }

    @Test
    fun `a partial 3D preview is recorded as PARTIAL_3D_PREVIEW with the checkpoint it kept`() {
        val summary = AnalyzerJson.decodeFromString(AnalysisSummary.serializer(), resource("analyzer-partial", "result.json").decodeToString())
        val p = RunProvenance.of(summary, "job-2", AnalysisOrigin.LOCAL, bundleSha256 = "f".repeat(64), app = app)
        assertEquals(RunProvenance.STATE_PARTIAL, p.state)
        assertEquals(summary.preview.partial?.checkpoint?.modelSha256, p.checkpointSha256)
        assertTrue(p.checkpointSha256.isNotBlank())
        assertEquals("f".repeat(64), p.analyzerBundleSha256)
    }

    @Test
    fun `the run log keeps every outcome across a restart, newest first and bounded, and never trusts a broken file`() {
        val file = File(AnalyzerFixtures.tempDir("provenance-log"), RunProvenanceLog.FILE)
        val log = RunProvenanceLog(file)
        val at = Instant.parse("2026-10-22T12:00:00Z")
        for (i in 1..(RunProvenanceLog.MAX + 5)) log.record(RunProvenance.failed("job-$i", AnalysisOrigin.SERVICE, "SOURCE_UNREACHABLE", app, now = { at }))
        val reopened = RunProvenanceLog(file).runs()
        assertEquals(RunProvenanceLog.MAX, reopened.size)
        assertEquals("job-${RunProvenanceLog.MAX + 5}", reopened.first().analysisRunId)
        assertEquals(RunProvenance.STATE_FAILED, reopened.first().state)
        assertEquals("SOURCE_UNREACHABLE", RunProvenanceLog(file).find("job-${RunProvenanceLog.MAX + 5}")?.failureCode)
        file.writeText("{ not json")
        assertEquals(emptyList<RunProvenance>(), RunProvenanceLog(file).runs())
    }
}
