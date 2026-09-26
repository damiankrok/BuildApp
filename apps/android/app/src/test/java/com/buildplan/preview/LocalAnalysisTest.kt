package com.buildplan.preview

import com.buildplan.preview.analyzer.AnalysisStages
import com.buildplan.preview.analyzer.AnalysisState
import com.buildplan.preview.analyzer.AnalyzerFailure
import com.buildplan.preview.analyzer.LocalRunReport
import com.buildplan.preview.analyzer.local.InstalledRuntime
import com.buildplan.preview.analyzer.local.LocalAnalysis
import com.buildplan.preview.analyzer.local.LocalEvent
import com.buildplan.preview.analyzer.local.LocalJobs
import com.buildplan.preview.analyzer.local.LocalProgress
import com.buildplan.preview.analyzer.local.LocalRunHandle
import com.buildplan.preview.analyzer.local.LocalRunListener
import com.buildplan.preview.analyzer.local.LocalRunRequest
import com.buildplan.preview.analyzer.local.LocalRuntimeHost
import com.buildplan.preview.analyzer.local.LocalRuntimeManifest
import com.buildplan.preview.analyzer.local.Scheduler
import com.buildplan.preview.scene.AnalysisOrigin
import com.buildplan.preview.scene.DownloadedScenes
import java.io.File
import java.io.IOException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The phone's side of a local analysis, on the JVM: the controller that owns
 * a job from the link to a stored scene, driven by a scripted runtime host.
 *
 * The result files are REAL: the Larchfield summary and scene bundle the
 * analyzer API served (`src/test/resources/analyzer-contract/`) — the local
 * bundle writes byte-identical ones for the same link (the TypeScript
 * program test proves that), so the scene store here verifies real bytes.
 */
class LocalAnalysisTest {

    private fun resource(name: String): ByteArray =
        requireNotNull(javaClass.classLoader?.getResourceAsStream("analyzer-contract/$name")) { "missing test resource $name" }.use { it.readBytes() }

    private val summaryJson = resource("result.json").decodeToString()
    private val sceneBytes = resource("scene.json")
    private val url = "https://drawings.synthetic-publisher.test/projects/larchfield-lf01"

    // --- a scripted world ------------------------------------------------------

    private class ManualScheduler : Scheduler {
        var now = 0L
        private val queue = ArrayDeque<() -> Unit>()
        private class Timer(val at: Long, val action: () -> Unit)
        private val timers = mutableListOf<Timer>()

        override fun post(action: () -> Unit) {
            queue.add(action)
        }

        override fun postDelayed(delayMs: Long, action: () -> Unit): () -> Unit {
            val timer = Timer(now + delayMs, action)
            timers.add(timer)
            return { timers.remove(timer) }
        }

        fun drain() {
            while (queue.isNotEmpty()) queue.removeFirst()()
        }

        fun advance(ms: Long) {
            val until = now + ms
            while (true) {
                drain()
                val due = timers.filter { it.at <= until }.minByOrNull { it.at } ?: break
                timers.remove(due)
                now = due.at
                due.action()
            }
            now = until
            drain()
        }
    }

    private class FakeRun(val request: LocalRunRequest, val listener: LocalRunListener) : LocalRunHandle {
        var cancels = 0
        var terminated = false

        override fun cancel() {
            cancels += 1
        }

        override fun terminate() {
            terminated = true
        }

        fun arg(name: String): String = request.arguments[request.arguments.indexOf("--$name") + 1]
    }

    private class FakeHost : LocalRuntimeHost {
        val runs = mutableListOf<FakeRun>()

        override fun start(request: LocalRunRequest, listener: LocalRunListener): LocalRunHandle = FakeRun(request, listener).also { runs.add(it) }
    }

    private inner class World(
        val installFails: Boolean = false,
    ) {
        val root = AnalyzerFixtures.tempDir("local-analysis")
        val jobs = LocalJobs(File(root, "local-analyzer"))
        val scenes = DownloadedScenes(File(root, "analyses"))
        val host = FakeHost()
        val scheduler = ManualScheduler()
        val states = mutableListOf<AnalysisState>()
        val finished = mutableListOf<LocalRunReport>()
        val runtimeDir = File(root, "runtime").apply { mkdirs() }
        val local = LocalAnalysis(
            jobs = jobs,
            scenes = scenes,
            host = host,
            install = {
                if (installFails) throw IOException("the APK lacks local-analyzer/analyzer.mjs")
                InstalledRuntime(runtimeDir, File(runtimeDir, "main.mjs"), LocalRuntimeManifest())
            },
            abi = "arm64-v8a",
            io = { it() },
            scheduler = scheduler,
            publish = { states.add(it) },
            onFinished = { finished.add(it) },
        )

        val run: FakeRun get() = host.runs.single()
        val last: AnalysisState get() = states.last()

        fun start(): FakeRun {
            assertTrue(local.start(url))
            scheduler.drain()
            return run
        }

        fun line(json: String) {
            run.listener.onLine(json)
            scheduler.drain()
        }

        fun hello(protocol: Int = 1) = line(
            """{"type":"hello","protocol":$protocol,"jobId":"${run.arg("job")}","pid":4242,""" +
                """"runtime":{"node":"v18.20.4","v8":"10.2.154.26-node.36","icu":"74.1","platform":"android","arch":"arm64","cpus":8,"totalMemoryBytes":8000000000,"collatorLocale":"en-US"},""" +
                """"analyzer":{"service":"1.0.0","solver":"2.3.0"}}""",
        )

        fun progress(stage: String, progress: Double, detail: String? = null) = line(
            """{"type":"progress","event":{"stage":"$stage","stageIndex":${AnalysisStages.PIPELINE.indexOf(stage)},"stageCount":9,"stageFraction":0.5,"progress":$progress""" +
                (detail?.let { ""","detail":"$it"""" } ?: "") + """},"elapsedMs":12000,"rssBytes":400000000}""",
        )

        fun writeResult(scene: ByteArray = sceneBytes) {
            val out = File(run.arg("out"))
            File(out, "scene.json").writeBytes(scene)
            File(out, "result.json").writeText(summaryJson)
        }

        fun done() = line(
            """{"type":"done","summary":$summaryJson,"files":{},""" +
                """"metrics":{"elapsedMs":245000,"memory":{"rssBytes":900000000,"peakRssBytes":1650000000,"peakSource":"VmHWM","heapUsedBytes":60000000,"arrayBuffersBytes":120000000},""" +
                """"timings":{"acquisitionMs":19000,"observationMs":21000,"metricExtractionMs":190000,"reconstructionMs":9000,"compileMs":400,"verificationMs":1500,"totalMs":241000},"sceneBytes":${sceneBytes.size}},""" +
                """"sources":{"packageHash":"${"a".repeat(64)}","pageHash":"${"b".repeat(64)}","assets":[]}}""",
        )

        fun processGone() {
            run.listener.onProcessGone()
            scheduler.drain()
        }

        fun assertNothingLeft() {
            assertEquals("scratch bytes left", 0L, jobs.scratchBytes())
            assertTrue("job folders left: ${jobs.jobsDir.list()?.toList()}", jobs.jobsDir.list().isNullOrEmpty())
            assertFalse("journal left", File(jobs.root, LocalJobs.ACTIVE_JOB).exists())
        }
    }

    // --- the happy path ----------------------------------------------------------

    @Test
    fun `a completed local run stores the verified scene, removes its folder and reports what it cost`() {
        val w = World()
        val run = w.start()
        // the production launcher, the link, and private folders for this job only
        assertEquals(File(w.runtimeDir, "main.mjs").absolutePath, run.request.program)
        assertEquals(url, run.arg("url"))
        assertTrue(LocalJobs.JOB_ID.matches(run.arg("job")))
        assertTrue(File(run.arg("work")).isDirectory && File(run.arg("out")).isDirectory)
        assertTrue("journal written before the runtime starts", File(w.jobs.root, LocalJobs.ACTIVE_JOB).isFile)
        assertTrue(run.request.environment.contains("TMPDIR=${run.arg("work")}"))

        w.hello()
        w.progress("EXTRACTING_OBSERVATIONS", 0.4, "drawing 3 of 9")
        val polling = w.last as AnalysisState.Polling
        assertEquals("v18.20.4", polling.local?.runtime?.node)
        assertEquals(400000000L, polling.local?.rssBytes)
        assertEquals("EXTRACTING_OBSERVATIONS", polling.status?.stage?.id)
        assertEquals("drawing 3 of 9", polling.status?.stage?.detail)

        w.writeResult()
        w.done()
        assertTrue("the process is ended as soon as the result is in", run.terminated)
        assertTrue(w.last is AnalysisState.Finishing)
        // the folder goes only once the process is gone
        assertTrue(File(run.arg("out"), "scene.json").isFile)
        w.processGone()

        val completed = w.last as AnalysisState.Completed
        assertEquals("analysis-6fa5a2b3929c", completed.entry.key)
        assertEquals(AnalysisOrigin.LOCAL, completed.entry.origin)
        assertTrue(completed.entry.subtitle, completed.entry.subtitle.startsWith("Analysed on this phone"))
        assertEquals("Larchfield (analysis)", completed.entry.label)
        assertNotNull(w.scenes.find(completed.entry.key))
        // after a restart (a new store on the same folder) the model is still there, and still opens
        val restarted = DownloadedScenes(File(w.root, "analyses"))
        assertEquals(completed.entry.key, restarted.find(completed.entry.key)?.key)
        assertTrue(restarted.load(completed.entry.key) is com.buildplan.preview.scene.SceneLoadResult.Ok)
        val report = completed.local!!
        assertEquals(LocalRunReport.OUTCOME_COMPLETED, report.outcome)
        assertEquals(1650000000L, report.peakRssBytes)
        assertEquals("VmHWM", report.peakSource)
        assertEquals(241000L, report.timings?.totalMs)
        assertEquals(sceneBytes.size.toLong(), report.sceneBytes)
        assertEquals("arm64-v8a", report.abi)
        assertNotNull(report.sources)
        assertEquals(listOf(report), w.finished)
        w.assertNothingLeft()
        assertFalse(w.local.isBusy)
    }

    @Test
    fun `the checklist is the program's own progress - done before it, running at it, pending after`() {
        val status = LocalAnalysis.statusOf(LocalProgress(stage = "SOLVING_TOPOLOGY", stageIndex = 4, stageCount = 9, progress = 0.93), null)
        assertEquals(listOf("DONE", "DONE", "DONE", "DONE", "RUNNING", "PENDING", "PENDING", "PENDING", "PENDING"), status.stages.map { it.state })
        assertEquals(0.93, status.progress, 0.0)
        assertEquals("SOLVING_TOPOLOGY", status.stage?.id)
        assertEquals(LocalAnalysis.STARTING, LocalAnalysis.statusOf(null, null).status)
        assertTrue(LocalAnalysis.statusOf(null, null).stages.all { it.state == "PENDING" })
        val cancelled = LocalAnalysis.statusOf(LocalProgress(stage = "ACQUIRING_SOURCE"), AnalysisStages.CANCELLED)
        assertEquals("CANCELLED", cancelled.stages.first().state)
        assertEquals(1.0, LocalAnalysis.statusOf(null, AnalysisStages.COMPLETED).progress, 0.0)
    }

    // --- failures --------------------------------------------------------------

    @Test
    fun `a pipeline failure is reported with the analyzer's code, and nothing is left`() {
        val w = World()
        w.start()
        w.hello()
        w.progress("ACQUIRING_SOURCE", 0.0, "3 addresses fetched")
        w.line("""{"type":"failed","code":"SOURCE_UNREACHABLE","message":"the page could not be fetched (HTTP 404)","metrics":{"elapsedMs":2100,"memory":{"rssBytes":1,"peakRssBytes":2,"peakSource":"VmHWM"}}}""")
        assertTrue(w.run.terminated)
        w.processGone()
        val failed = w.last as AnalysisState.Failed
        assertEquals(AnalyzerFailure.JobFailed("SOURCE_UNREACHABLE", "the page could not be fetched (HTTP 404)"), failed.failure)
        assertEquals(LocalRunReport.OUTCOME_FAILED, failed.local?.outcome)
        assertEquals("SOURCE_UNREACHABLE", failed.local?.code)
        assertEquals("FAILED", failed.status?.stages?.first()?.state)
        assertTrue(w.scenes.list().isEmpty())
        w.assertNothingLeft()
    }

    @Test
    fun `a process that dies without a result is a failure, never a result, even with files on disk`() {
        val w = World()
        w.start()
        w.hello()
        w.progress("EXTRACTING_OBSERVATIONS", 0.5)
        w.writeResult()
        // e.g. ended by Android for memory: no terminal event ever came
        w.processGone()
        val failed = w.last as AnalysisState.Failed
        assertEquals("RUNTIME_STOPPED", (failed.failure as AnalyzerFailure.LocalRuntime).code)
        assertTrue("nothing stored", w.scenes.list().isEmpty())
        w.assertNothingLeft()
    }

    @Test
    fun `a result whose files are not what it reported is refused and not stored`() {
        val w = World()
        w.start()
        w.hello()
        val tampered = sceneBytes.copyOf().also { it[it.size - 2] = 'x'.code.toByte() }
        w.writeResult(tampered)
        w.done()
        w.processGone()
        val failed = w.last as AnalysisState.Failed
        assertTrue(failed.failure.toString(), failed.failure is AnalyzerFailure.HashMismatch)
        assertTrue(w.scenes.list().isEmpty())
        w.assertNothingLeft()
    }

    @Test
    fun `a result that names files that are not there is a named failure`() {
        val w = World()
        w.start()
        w.hello()
        w.done()
        w.processGone()
        assertEquals("RESULT_MISSING", ((w.last as AnalysisState.Failed).failure as AnalyzerFailure.LocalRuntime).code)
        w.assertNothingLeft()
    }

    @Test
    fun `a runtime that speaks another protocol is refused before it runs anything`() {
        val w = World()
        w.start()
        w.hello(protocol = 2)
        assertTrue(w.run.terminated)
        w.processGone()
        assertEquals("RUNTIME_PROTOCOL", ((w.last as AnalysisState.Failed).failure as AnalyzerFailure.LocalRuntime).code)
        w.assertNothingLeft()
    }

    @Test
    fun `a runtime missing for this phone is a named failure`() {
        val w = World()
        w.start()
        w.run.listener.onStartFailed("RUNTIME_UNAVAILABLE", "the embedded Node runtime is not part of this app for this device's processor")
        w.processGone()
        assertEquals("RUNTIME_UNAVAILABLE", ((w.last as AnalysisState.Failed).failure as AnalyzerFailure.LocalRuntime).code)
        w.assertNothingLeft()
    }

    @Test
    fun `a program that ends without a terminal event is a failure`() {
        val w = World()
        w.start()
        w.run.listener.onExited(1)
        w.scheduler.drain()
        w.processGone()
        assertEquals("RUNTIME_EXITED", ((w.last as AnalysisState.Failed).failure as AnalyzerFailure.LocalRuntime).code)
        w.assertNothingLeft()
    }

    @Test
    fun `a bundle that cannot be installed is a named failure and starts nothing`() {
        val w = World(installFails = true)
        assertTrue(w.local.start(url))
        w.scheduler.drain()
        assertTrue(w.host.runs.isEmpty())
        assertEquals("RUNTIME_INSTALL_FAILED", ((w.last as AnalysisState.Failed).failure as AnalyzerFailure.LocalRuntime).code)
        assertFalse(w.local.isBusy)
    }

    // --- cancel and lifecycle -----------------------------------------------------

    @Test
    fun `a cancel is asked for first, the program's own cancelled event ends the job and nothing is left`() {
        val w = World()
        w.start()
        w.hello()
        w.progress("ACQUIRING_SOURCE", 0.0, "8 addresses fetched")
        w.local.cancel()
        assertEquals(1, w.run.cancels)
        assertFalse("not ended yet: it was asked", w.run.terminated)
        assertTrue(w.local.isCancelling)
        w.local.cancel()
        assertEquals("a second tap sends nothing more", 1, w.run.cancels)
        w.line("""{"type":"cancelled","metrics":{"elapsedMs":2300,"memory":{"rssBytes":120000000,"peakRssBytes":130000000,"peakSource":"VmHWM"}}}""")
        assertTrue(w.run.terminated)
        w.processGone()
        val cancelled = w.last as AnalysisState.Cancelled
        assertEquals(LocalRunReport.OUTCOME_CANCELLED, cancelled.local?.outcome)
        assertFalse(cancelled.local!!.forcedStop)
        w.assertNothingLeft()
    }

    @Test
    fun `a cancel the program cannot answer (it is computing) ends the process after the grace period`() {
        val w = World()
        w.start()
        w.hello()
        w.progress("EXTRACTING_OBSERVATIONS", 0.6, "reading printed dimensions and callouts")
        w.local.cancel()
        w.scheduler.advance(LocalAnalysis.CANCEL_GRACE_MS - 1)
        assertFalse(w.run.terminated)
        w.scheduler.advance(1)
        assertTrue("the process is ended", w.run.terminated)
        assertFalse("not reported cancelled until the process is gone", w.states.last() is AnalysisState.Cancelled)
        w.processGone()
        val cancelled = w.last as AnalysisState.Cancelled
        assertTrue(cancelled.local!!.forcedStop)
        w.assertNothingLeft()
    }

    @Test
    fun `a process that never reports its death is cleaned up anyway after a short wait`() {
        val w = World()
        w.start()
        w.hello()
        w.local.cancel()
        w.scheduler.advance(LocalAnalysis.CANCEL_GRACE_MS + LocalAnalysis.PROCESS_GONE_WAIT_MS)
        assertTrue(w.last is AnalysisState.Cancelled)
        w.assertNothingLeft()
    }

    @Test
    fun `one job at a time - a second start while one runs is refused and starts nothing`() {
        val w = World()
        w.start()
        assertFalse(w.local.start(url))
        assertFalse(w.local.start("https://drawings.synthetic-publisher.test/projects/holloway-hw02"))
        w.scheduler.drain()
        assertEquals(1, w.host.runs.size)
    }

    @Test
    fun `after a job ends the next one gets a fresh process`() {
        val w = World()
        w.start()
        w.hello()
        w.writeResult()
        w.done()
        w.processGone()
        assertTrue(w.local.start(url))
        w.scheduler.drain()
        assertEquals(2, w.host.runs.size)
        assertTrue(w.host.runs[0].terminated)
        assertFalse(w.host.runs[1].terminated)
    }

    @Test
    fun `when the owner goes away the job goes with it - process ended, folder removed, nothing published after`() {
        val w = World()
        w.start()
        w.hello()
        w.progress("EXTRACTING_OBSERVATIONS", 0.2)
        val before = w.states.size
        w.local.shutdown()
        assertTrue(w.run.terminated)
        w.assertNothingLeft()
        assertEquals("APP_CLOSED", w.finished.single().code)
        w.processGone()
        assertEquals(before, w.states.size)
        assertFalse(w.local.start(url))
    }

    @Test
    fun `a job the app was running when it stopped is reported interrupted at the next start, and its folder removed`() {
        val root = AnalyzerFixtures.tempDir("local-interrupted")
        val before = LocalJobs(root)
        val job = before.create(url)
        File(job.workDir, "bytes").mkdirs()
        File(job.workDir, "bytes/0617fe3c.bin").writeBytes(ByteArray(4096))
        // the process dies here; a new one starts
        val after = LocalJobs(root)
        val left = after.recoverInterrupted()
        assertNotNull(left)
        assertEquals(job.jobId, left!!.jobId)
        assertEquals(url, left.sourceUrl)
        assertEquals(0L, after.scratchBytes())
        assertFalse(job.dir.exists())
        assertNull("reported once", after.recoverInterrupted())
    }

    @Test
    fun `the run log keeps the newest reports, whatever their outcome`() {
        val jobs = LocalJobs(AnalyzerFixtures.tempDir("local-runs"))
        for (i in 1..(LocalJobs.MAX_RUNS + 3)) jobs.record(LocalRunReport(jobId = "%032x".format(i), outcome = LocalRunReport.OUTCOME_COMPLETED, elapsedMs = i * 1000L))
        val runs = jobs.runs()
        assertEquals(LocalJobs.MAX_RUNS, runs.size)
        assertEquals((LocalJobs.MAX_RUNS + 3) * 1000L, runs.first().elapsedMs)
    }

    // --- the event lines -----------------------------------------------------------

    @Test
    fun `event lines parse into events, and anything else is unreadable rather than fatal`() {
        assertTrue(LocalEvent.parse("not json") is LocalEvent.Unreadable)
        assertTrue(LocalEvent.parse("""{"type":"surprise"}""") is LocalEvent.Unreadable)
        assertTrue(LocalEvent.parse("""{"type":"progress"}""") is LocalEvent.Unreadable)
        val cancelled = LocalEvent.parse("""{"type":"cancelled","metrics":{"elapsedMs":5,"memory":{"peakRssBytes":7}}}""")
        assertEquals(7L, (cancelled as LocalEvent.Cancelled).metrics.memory.peakRssBytes)
        val done = LocalEvent.parse("""{"type":"done","summary":$summaryJson,"metrics":{},"sources":{"assets":[]}}""") as LocalEvent.Done
        assertEquals("6fa5a2b3929c8a874c9e39f2066d2e89b5fae53ff4b40e189b6800621ad4ae63", done.summary.sceneSha256)
        assertTrue(done.isTerminal)
    }
}
