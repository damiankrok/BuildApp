package com.buildplan.preview

import com.buildplan.preview.AnalyzerFixtures.BASE
import com.buildplan.preview.AnalyzerFixtures.JOB
import com.buildplan.preview.AnalyzerFixtures.LINK
import com.buildplan.preview.AnalyzerFixtures.filesIn
import com.buildplan.preview.AnalyzerFixtures.status
import com.buildplan.preview.FakeTransport.Companion.bytes
import com.buildplan.preview.FakeTransport.Companion.fails
import com.buildplan.preview.FakeTransport.Companion.json
import com.buildplan.preview.FakeTransport.Companion.refusal
import com.buildplan.preview.analyzer.AnalysisStages
import com.buildplan.preview.analyzer.AnalysisState
import com.buildplan.preview.analyzer.AnalysisTracker
import com.buildplan.preview.analyzer.AnalyzerClient
import com.buildplan.preview.analyzer.AnalyzerFailure
import com.buildplan.preview.analyzer.CancelOutcome
import com.buildplan.preview.analyzer.RetryAction
import com.buildplan.preview.analyzer.StageChecklist
import com.buildplan.preview.analyzer.StageState
import com.buildplan.preview.analyzer.Step
import com.buildplan.preview.scene.BundledScenes
import com.buildplan.preview.scene.DownloadedScenes
import com.buildplan.preview.scene.SceneLoadResult
import com.buildplan.preview.scene.SceneRepository
import com.buildplan.preview.scene.SceneSourceKind
import java.io.IOException
import java.net.SocketTimeoutException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The analysis lifecycle, driven step by step against a scripted service:
 * submit, poll, finish, verify, store, open — and every way it can end
 * otherwise. Nothing here waits: each step returns the delay the app would
 * wait, and the test asserts it.
 */
class AnalysisTrackerTest {

    private val transport = FakeTransport()
    private val dir = AnalyzerFixtures.tempDir()
    private val store = DownloadedScenes(dir)
    private val tracker = AnalysisTracker(AnalyzerClient(BASE, transport), store)

    private val statusUrl = "$BASE/v1/analyses/$JOB"

    private fun serveSubmit() = transport.on("POST", "$BASE/v1/analyses", json(202, AnalyzerFixtures.submitted()))

    private fun serveResultAndScene(
        summary: String = AnalyzerFixtures.summary(),
        scene: ByteArray = AnalyzerFixtures.sceneBytes,
        header: String? = AnalyzerFixtures.sceneSha256,
    ) {
        transport.on("GET", "$statusUrl/result", json(200, summary))
        transport.on("GET", "$statusUrl/scene", bytes(200, scene, header?.let { mapOf("X-Content-SHA256" to it) } ?: emptyMap()))
    }

    /** Run the machine until it stops, returning every step. */
    private fun runToEnd(start: AnalysisState, limit: Int = 50): List<Step> {
        val steps = mutableListOf<Step>()
        var state = start
        repeat(limit) {
            val step = tracker.step(state)
            steps += step
            state = step.state
            if (step.delayMs == null) return steps
        }
        error("the machine did not stop within $limit steps: ${steps.last()}")
    }

    @Test
    fun `a job goes from queued through its stages to a stored, openable model`() {
        serveSubmit()
        transport.on(
            "GET", statusUrl,
            json(200, status(AnalysisStages.QUEUED, 0.0)),
            json(200, status("ACQUIRING_SOURCE", 0.02, running = 0)),
            json(200, status("EXTRACTING_OBSERVATIONS", 0.31, running = 2, detail = "drawing 9 of 20")),
            json(200, status("VERIFYING", 0.97, running = 8)),
            json(200, status(AnalysisStages.COMPLETED, 1.0)),
        )
        serveResultAndScene()

        val submitted = tracker.submit(LINK)
        assertEquals(AnalysisState.Polling(JOB, LINK), submitted)

        val steps = runToEnd(submitted)
        val polled = steps.map { it.state }.filterIsInstance<AnalysisState.Polling>()
        assertEquals(listOf("QUEUED", "ACQUIRING_SOURCE", "EXTRACTING_OBSERVATIONS", "VERIFYING"), polled.map { it.status!!.status })
        // The progress shown is the server's, in the order it was sent — nothing invented in between.
        assertEquals(listOf(0.0, 0.02, 0.31, 0.97), polled.map { it.status!!.progress })
        assertEquals("drawing 9 of 20", polled[2].status!!.stage!!.detail)
        // Polling waits the contract's interval between rounds, and stops when the job ends.
        assertEquals(List(4) { AnalysisTracker.POLL_INTERVAL_MS }, steps.take(4).map { it.delayMs })
        assertTrue(steps[4].state is AnalysisState.Finishing)
        assertEquals(0L, steps[4].delayMs)
        val done = steps.last()
        assertNull(done.delayMs)
        val completed = done.state as AnalysisState.Completed
        assertEquals(JOB, completed.jobId)
        assertEquals("Dom w marcówkach (GE)", completed.summary.title)
        assertEquals(12, completed.summary.quality.levels.l0)

        // Stored: under its sha256, listed under an analysis key, with the summary's facts.
        val entry = completed.entry
        assertEquals("analysis-" + AnalyzerFixtures.sceneSha256.take(12), entry.key)
        assertEquals("Dom w marcówkach (GE) (analysis)", entry.label)
        assertEquals(AnalyzerFixtures.CANDIDATE, entry.candidateHash)
        assertEquals(LINK, entry.sourceUrl)
        assertEquals(JOB, entry.jobId)
        assertEquals(listOf(12, 30, 18), listOf(entry.qualityL0, entry.qualityL1, entry.qualityL2))
        assertEquals(2, entry.unresolvedCount)
        assertEquals(3, entry.warningsCount)
        assertEquals("DETERMINISTIC_ONLY", entry.visionMode)
        assertTrue(entry.subtitle.startsWith("Analysed "))
        assertTrue(entry.subtitle.endsWith("candidate ${AnalyzerFixtures.CANDIDATE.take(12)}"))
        assertEquals(listOf("${AnalyzerFixtures.sceneSha256}.json", "index.json"), filesIn(dir))

        // Openable: the viewer lists it after the bundled scenes and loads it.
        val repository = SceneRepository(BundledScenes { TestScenes.text(it) }, store)
        val listed = repository.entries().last()
        assertEquals(entry.key, listed.key)
        assertEquals(SceneSourceKind.DOWNLOADED, listed.source)
        assertEquals("Dom w marcówkach (GE) (analysis)", listed.title)
        val loaded = repository.load(listed) as SceneLoadResult.Ok
        assertEquals(entry.key, loaded.scene.key)
        assertEquals("Dom w marcówkach (GE) (analysis)", loaded.scene.title)
        assertEquals(AnalyzerFixtures.sceneContentHash, loaded.scene.bundle.contentHash)
    }

    @Test
    fun `a failed job ends with the service's code and message, and nothing is downloaded`() {
        transport.on(
            "GET", statusUrl,
            json(200, status("ACQUIRING_SOURCE", 0.02, running = 0)),
            json(
                200,
                status(
                    AnalysisStages.FAILED, 0.14, running = 1,
                    error = """{"code":"NO_DRAWINGS","message":"the page exposes no drawing this analyzer reads"}""",
                ),
            ),
        )
        val steps = runToEnd(AnalysisState.Polling(JOB, LINK))
        val failed = steps.last().state as AnalysisState.Failed
        assertEquals(AnalyzerFailure.JobFailed("NO_DRAWINGS", "the page exposes no drawing this analyzer reads"), failed.failure)
        assertEquals(RetryAction.RESUBMIT, failed.retry)
        assertEquals(LINK, failed.sourceUrl)
        assertEquals(StageState.FAILED, StageChecklist.rows(failed.status)[1].state)
        assertEquals(0, transport.count("GET", "$statusUrl/result"))
        assertEquals(0, transport.count("GET", "$statusUrl/scene"))
        assertTrue(store.list().isEmpty())
        assertTrue(filesIn(dir).isEmpty())
    }

    @Test
    fun `a job cancelled on the service ends as cancelled`() {
        transport.on(
            "GET", statusUrl,
            json(200, status("EXTRACTING_OBSERVATIONS", 0.2, running = 2)),
            json(200, status(AnalysisStages.CANCELLED, 0.2, running = 2, error = """{"code":"CANCELLED","message":"cancelled"}""")),
        )
        val steps = runToEnd(AnalysisState.Polling(JOB, LINK))
        val cancelled = steps.last().state as AnalysisState.Cancelled
        assertEquals(JOB, cancelled.jobId)
        assertNull(steps.last().delayMs)
        assertTrue(store.list().isEmpty())
    }

    @Test
    fun `cancelling sends DELETE, and a job that already finished is polled once more instead`() {
        transport.on("DELETE", statusUrl, json(202, """{"jobId":"$JOB","status":"CANCELLED"}"""))
        val outcome = tracker.cancel(JOB, LINK, null)
        assertTrue(outcome is CancelOutcome.Cancelled)
        assertEquals(1, transport.count("DELETE", statusUrl))

        transport.on("DELETE", statusUrl, refusal(409, "ALREADY_FINISHED", "the analysis has finished"))
        assertEquals(CancelOutcome.AlreadyFinished, tracker.cancel(JOB, LINK, null))

        transport.on("DELETE", statusUrl, fails(IOException("reset")))
        assertTrue((tracker.cancel(JOB, LINK, null) as CancelOutcome.Failed).failure is AnalyzerFailure.Offline)
    }

    @Test
    fun `a lost connection keeps the job, backs off, and recovers`() {
        transport.on(
            "GET", statusUrl,
            json(200, status("ACQUIRING_SOURCE", 0.05, running = 0)),
            fails(SocketTimeoutException("read timed out")),
            fails(IOException("network is unreachable")),
            fails(IOException("network is unreachable")),
            json(200, status("EXTRACTING_OBSERVATIONS", 0.4, running = 2)),
            json(200, status(AnalysisStages.COMPLETED, 1.0)),
        )
        serveResultAndScene()

        val steps = runToEnd(AnalysisState.Polling(JOB, LINK))
        val lost = steps.subList(1, 4).map { it.state as AnalysisState.Polling }
        assertTrue("the job id is kept through every failure", lost.all { it.jobId == JOB })
        assertTrue(lost.all { it.connectionLost })
        assertEquals(listOf(1, 2, 3), lost.map { it.consecutiveFailures })
        // The last status seen stays on screen while the connection is down.
        assertTrue(lost.all { it.status!!.status == "ACQUIRING_SOURCE" })
        // Backing off: each wait longer than the last, all longer than a normal poll.
        val waits = steps.subList(1, 4).map { it.delayMs!! }
        assertEquals(listOf(3_000L, 6_000L, 12_000L), waits)
        val recovered = steps[4].state as AnalysisState.Polling
        assertEquals(0, recovered.consecutiveFailures)
        assertEquals(AnalysisTracker.POLL_INTERVAL_MS, steps[4].delayMs)
        assertTrue(steps.last().state is AnalysisState.Completed)
    }

    @Test
    fun `the backoff is capped, and a Retry-After from the service is honoured`() {
        assertEquals(30_000L, AnalysisTracker.backoff(10))
        assertEquals(30_000L, AnalysisTracker.MAX_BACKOFF_MS)
        transport.on("GET", statusUrl, refusal(429, "RATE_LIMITED", "too many reads", mapOf("Retry-After" to "20")))
        val step = tracker.step(AnalysisState.Polling(JOB, LINK))
        assertEquals(20_000L, step.delayMs)
        assertTrue((step.state as AnalysisState.Polling).lastFailure is AnalyzerFailure.RateLimited)
    }

    @Test
    fun `a lost connection while downloading retries the download and writes nothing meanwhile`() {
        transport.on("GET", "$statusUrl/result", json(200, AnalyzerFixtures.summary()))
        transport.on(
            "GET", "$statusUrl/scene",
            fails(IOException("connection reset")),
            bytes(200, AnalyzerFixtures.sceneBytes, mapOf("X-Content-SHA256" to AnalyzerFixtures.sceneSha256)),
        )
        val finishing = AnalysisState.Finishing(JOB, LINK, jobStatus(status(AnalysisStages.COMPLETED, 1.0)))
        val first = tracker.step(finishing)
        val retrying = first.state as AnalysisState.Finishing
        assertTrue(retrying.connectionLost)
        assertEquals(3_000L, first.delayMs)
        assertTrue("an interrupted download leaves nothing behind", filesIn(dir).isEmpty())
        val second = tracker.step(retrying)
        assertTrue(second.state is AnalysisState.Completed)
    }

    @Test
    fun `an unknown or expired job ends polling with a failure`() {
        transport.on("GET", statusUrl, refusal(404, "NOT_FOUND", "no such analysis"))
        val step = tracker.step(AnalysisState.Polling(JOB, LINK))
        assertNull(step.delayMs)
        val failed = step.state as AnalysisState.Failed
        assertEquals(404, (failed.failure as AnalyzerFailure.Http).status)
    }

    @Test
    fun `a scene whose bytes do not match the summary is refused and nothing is written`() {
        val tampered = AnalyzerFixtures.sceneBytes.copyOf().also { it[it.size / 2] = (it[it.size / 2] + 1).toByte() }
        serveResultAndScene(scene = tampered, header = null)
        val step = tracker.step(AnalysisState.Finishing(JOB, LINK, jobStatus(status(AnalysisStages.COMPLETED, 1.0))))
        val failed = step.state as AnalysisState.Failed
        val mismatch = failed.failure as AnalyzerFailure.HashMismatch
        assertEquals("scene sha256", mismatch.what)
        assertEquals(AnalyzerFixtures.sceneSha256, mismatch.expected)
        assertEquals(RetryAction.REFINISH, failed.retry)
        assertTrue(filesIn(dir).isEmpty())
        assertTrue(store.list().isEmpty())
    }

    @Test
    fun `a scene larger than the phone keeps is refused before and during download`() {
        // The summary already says it is too big: the download is never started.
        serveResultAndScene(summary = AnalyzerFixtures.summary(sceneBytes = DownloadedScenes.MAX_SCENE_BYTES + 1))
        val refusedEarly = tracker.step(AnalysisState.Finishing(JOB, LINK, jobStatus(status(AnalysisStages.COMPLETED, 1.0))))
        assertEquals(AnalyzerFailure.TooLarge(DownloadedScenes.MAX_SCENE_BYTES), (refusedEarly.state as AnalysisState.Failed).failure)
        assertEquals(0, transport.count("GET", "$statusUrl/scene"))

        // The summary understates it: the body itself is cut off at the cap.
        val small = AnalysisTracker(AnalyzerClient(BASE, transport), store, maxSceneBytes = 1024)
        serveResultAndScene(summary = AnalyzerFixtures.summary(sceneBytes = 1000))
        val refusedLate = small.step(AnalysisState.Finishing(JOB, LINK, jobStatus(status(AnalysisStages.COMPLETED, 1.0))))
        val failed = refusedLate.state as AnalysisState.Failed
        assertEquals(AnalyzerFailure.TooLarge(1024), failed.failure)
        assertEquals(RetryAction.NONE, failed.retry)
        assertEquals(1024L, transport.requests.last { it.url.endsWith("/scene") }.maxBytes)
        assertTrue(filesIn(dir).isEmpty())
    }

    @Test
    fun `submit refusals become failures with the right retry offer`() {
        val url = "$BASE/v1/analyses"
        transport.on("POST", url, refusal(422, "UNSUPPORTED_PUBLISHER", "no registered publisher understands this host"))
        val unsupported = tracker.submit("https://example.com/house") as AnalysisState.Failed
        assertTrue(unsupported.failure is AnalyzerFailure.UnsupportedPublisher)
        assertEquals(RetryAction.NONE, unsupported.retry)

        transport.on("POST", url, refusal(429, "RATE_LIMITED", "slow down", mapOf("Retry-After" to "60")))
        val limited = tracker.submit(LINK) as AnalysisState.Failed
        assertEquals(AnalyzerFailure.RateLimited(60), limited.failure)
        assertEquals(RetryAction.RESUBMIT, limited.retry)

        transport.on("POST", url, refusal(503, "QUEUE_FULL", "busy", mapOf("Retry-After" to "15")))
        assertEquals(AnalyzerFailure.QueueFull(15), (tracker.submit(LINK) as AnalysisState.Failed).failure)

        transport.on("POST", url, fails(IOException("no route to host")))
        val offline = tracker.submit(LINK) as AnalysisState.Failed
        assertTrue(offline.failure is AnalyzerFailure.Offline)
        assertEquals(RetryAction.RESUBMIT, offline.retry)
    }

    @Test
    fun `terminal states do nothing more`() {
        for (s in listOf(AnalysisState.Idle, AnalysisState.Cancelled(JOB, LINK, null))) {
            val step = tracker.step(s)
            assertEquals(s, step.state)
            assertNull(step.delayMs)
        }
        assertTrue(transport.requests.isEmpty())
    }

    private fun jobStatus(text: String) =
        com.buildplan.preview.analyzer.AnalyzerJson.decodeFromString(com.buildplan.preview.analyzer.JobStatus.serializer(), text)
}
