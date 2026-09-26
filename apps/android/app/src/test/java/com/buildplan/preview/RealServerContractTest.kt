package com.buildplan.preview

import com.buildplan.preview.FakeTransport.Companion.bytes
import com.buildplan.preview.FakeTransport.Companion.json
import com.buildplan.preview.analyzer.AnalysisState
import com.buildplan.preview.analyzer.AnalysisTracker
import com.buildplan.preview.analyzer.AnalyzerClient
import com.buildplan.preview.analyzer.AnalyzerFailure
import com.buildplan.preview.analyzer.Outcome
import com.buildplan.preview.analyzer.Step
import com.buildplan.preview.scene.BundledScenes
import com.buildplan.preview.scene.DownloadedScenes
import com.buildplan.preview.scene.SceneLoadResult
import com.buildplan.preview.scene.SceneRepository
import com.buildplan.preview.scene.SceneSourceKind
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The phone against what the analyzer service ACTUALLY says.
 *
 * The files under `src/test/resources/analyzer-contract/` are the real HTTP
 * responses of `apps/analyzer-api` for one synthetic job (captured by
 * `apps/analyzer-api/scripts/capture-android-contract.ts`; a TypeScript test
 * fails when the server's answers drift from them). Here the app's own client,
 * tracker and scene store run the whole job on those bytes: submit, a real
 * mid-run status, the real completed status, the real summary and the real
 * scene bundle — verified by sha256 and contentHash, stored, and opened.
 */
class RealServerContractTest {

    private fun resource(name: String): ByteArray =
        requireNotNull(javaClass.classLoader?.getResourceAsStream("analyzer-contract/$name")) { "missing test resource $name" }.use { it.readBytes() }

    private fun text(name: String) = resource(name).decodeToString()

    private val base = "https://analyzer.example.test"
    private val job = "0123456789abcdef0123456789abcdef"
    private val project = "https://drawings.synthetic-publisher.test/projects/larchfield-lf01"
    private val statusUrl = "$base/v1/analyses/$job"
    private val meta get() = text("meta.json")

    @Test
    fun `a real job, from the server's own bytes, ends as a stored and openable model`() {
        val transport = FakeTransport()
        transport.on("POST", "$base/v1/analyses", json(202, text("submitted.json")))
        transport.on("GET", statusUrl, json(200, text("status-running.json")), json(200, text("status-completed.json")))
        transport.on("GET", "$statusUrl/result", json(200, text("result.json")))
        val sceneHeader = Regex("\"sceneSha256Header\": \"([0-9a-f]{64})\"").find(meta)!!.groupValues[1]
        transport.on("GET", "$statusUrl/scene", bytes(200, resource("scene.json"), mapOf("X-Content-SHA256" to sceneHeader)))

        val dir = AnalyzerFixtures.tempDir("real-contract")
        val store = DownloadedScenes(dir)
        val tracker = AnalysisTracker(AnalyzerClient(base, transport), store)

        val submitted = tracker.submit(project)
        assertEquals(AnalysisState.Polling(job, project), submitted)
        val steps = mutableListOf<Step>()
        var state: AnalysisState = submitted
        repeat(20) {
            val step = tracker.step(state)
            steps += step
            state = step.state
            if (step.delayMs == null) return@repeat
        }

        // the real mid-run record: stage, the server's progress and its per-drawing detail
        val running = steps.map { it.state }.filterIsInstance<AnalysisState.Polling>().mapNotNull { it.status }.first()
        assertEquals("EXTRACTING_OBSERVATIONS", running.status)
        assertEquals("drawing 2 of 7", running.stage!!.detail)
        assertEquals(9, running.stages.size)
        assertTrue(running.progress > 0.0 && running.progress < 1.0)

        val completed = steps.last().state as AnalysisState.Completed
        assertNull(steps.last().delayMs)
        assertEquals("Larchfield", completed.summary.title)
        assertEquals("DETERMINISTIC_ONLY", completed.summary.vision.mode)
        assertEquals(sceneHeader, completed.entry.sceneSha256)
        assertEquals("Larchfield (analysis)", completed.entry.label)
        assertEquals(project, completed.entry.sourceUrl)

        // the stored bundle is the server's scene, and the viewer opens it beside the bundled ones
        val repository = SceneRepository(BundledScenes { TestScenes.text(it) }, store)
        val listed = repository.entries().last()
        assertEquals(SceneSourceKind.DOWNLOADED, listed.source)
        val loaded = repository.load(listed) as SceneLoadResult.Ok
        assertEquals("Larchfield (analysis)", loaded.scene.title)
        assertTrue(loaded.scene.bundle.scene.meshes.isNotEmpty())

        // a new store on the same directory — the app after a restart — still has it
        val reopened = SceneRepository(BundledScenes { TestScenes.text(it) }, DownloadedScenes(dir))
        assertTrue(reopened.load(reopened.entries().last()) is SceneLoadResult.Ok)
    }

    @Test
    fun `the server's own refusals map to the app's failures`() {
        val transport = FakeTransport()
        transport.on("POST", "$base/v1/analyses", json(422, text("refusal-unsupported-publisher.json")))
        transport.on("GET", "$base/v1/analyses/${"f".repeat(32)}", json(404, text("not-found.json")))
        val client = AnalyzerClient(base, transport)
        val refused = client.submit("https://example.com/house") as Outcome.Err
        assertTrue("got ${refused.failure}", refused.failure is AnalyzerFailure.UnsupportedPublisher)
        val missing = client.status("f".repeat(32)) as Outcome.Err
        val http = missing.failure as AnalyzerFailure.Http
        assertEquals(404, http.status)
        assertEquals("NOT_FOUND", http.code)
    }
}
