package com.buildplan.preview

import android.os.Build
import android.os.Process
import androidx.test.ext.junit.runners.AndroidJUnit4
import androidx.test.platform.app.InstrumentationRegistry
import com.buildplan.preview.analyzer.AnalysisState
import com.buildplan.preview.analyzer.LocalRunReport
import com.buildplan.preview.analyzer.local.InstalledRuntime
import com.buildplan.preview.analyzer.local.LocalAnalysis
import com.buildplan.preview.analyzer.local.LocalAvailability
import com.buildplan.preview.analyzer.local.LocalJobs
import com.buildplan.preview.analyzer.local.LocalRuntimeFiles
import com.buildplan.preview.analyzer.local.MainScheduler
import com.buildplan.preview.analyzer.local.ServiceRuntimeHost
import com.buildplan.preview.scene.DownloadedScenes
import java.io.File
import java.io.IOException
import java.util.concurrent.CopyOnWriteArrayList
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith

/**
 * The local analyzer ON A DEVICE: the real `:analyzer` process, the real
 * nodejs-mobile `libnode.so` loaded through the JNI bridge, and the
 * PRODUCTION `analyzer.mjs` the app ships in its assets.
 *
 * The only test-specific part is the launcher: `fixture-main.mjs` (from this
 * test APK's assets, never the app's) runs the same `analyzer.mjs` with the
 * in-memory synthetic publisher, so the pipeline runs end to end without the
 * internet. The live test runs the production launcher on a real URL.
 *
 * Instrumentation arguments (all optional):
 *   expectedCandidateHash, expectedModelHash, expectedSceneContentHash,
 *   expectedSceneSha256   the desktop pipeline's hashes for the fixture
 *   liveUrl               a real project URL for the production launcher
 *   liveTimeoutMinutes    default 40
 *
 * Every run writes a JSON report to the app's external files folder
 * (`local-analyzer-reports/`), which CI pulls with adb.
 */
@RunWith(AndroidJUnit4::class)
class LocalAnalyzerDeviceTest {
    private val instrumentation = InstrumentationRegistry.getInstrumentation()
    private val app = instrumentation.targetContext
    private val testApk = instrumentation.context
    private val args = InstrumentationRegistry.getArguments()
    private val root = File(app.filesDir, "device-test-local-analyzer")
    private val scenesRoot = File(app.filesDir, "device-test-analyses")
    private val io = Executors.newSingleThreadExecutor()

    private lateinit var files: LocalRuntimeFiles
    private lateinit var jobs: LocalJobs
    private lateinit var scenes: DownloadedScenes

    @Before
    fun setUp() {
        root.deleteRecursively()
        scenesRoot.deleteRecursively()
        files = LocalRuntimeFiles(root) { name -> openOrNull { app.assets.open(name) } }
        jobs = LocalJobs(root)
        scenes = DownloadedScenes(scenesRoot)
    }

    @After
    fun tearDown() {
        io.shutdownNow()
    }

    @Test
    fun theRuntimeIsInstalledForThisDevice() {
        val availability = LocalAvailability.of(app, files)
        assertTrue("local analyzer not available: ${availability.reason}", availability.available)
        val installed = files.install()
        val analyzer = File(installed.dir, "analyzer.mjs")
        assertEquals(installed.manifest.files.getValue("analyzer.mjs").sha256, LocalRuntimeFiles.sha256Of(analyzer))
        assertEquals("18.20.4", installed.manifest.runtime.node)
    }

    @Test
    fun fixtureRunsTheProductionAnalyzerAndMatchesTheDesktop() {
        val run = analyse(FIXTURE_URL + "larchfield-lf01", fixture = true, timeoutMs = 20 * 60_000L)
        writeReport("fixture-larchfield", run)
        val completed = run.final as? AnalysisState.Completed
        assertNotNull("expected Completed, got ${run.final}", completed)
        completed!!
        assertEquals("Larchfield (analysis)", completed.summary.label)
        assertEquals("BYTE_IDENTICAL", completed.summary.verification.replay)
        assertEquals("DETERMINISTIC_ONLY", completed.summary.vision.mode)
        // the desktop pipeline's hashes, when CI passes them
        args.getString("expectedCandidateHash")?.let { assertEquals("candidate hash vs desktop", it, completed.summary.candidateHash) }
        args.getString("expectedModelHash")?.let { assertEquals("model hash vs desktop", it, completed.summary.modelHash) }
        args.getString("expectedSceneContentHash")?.let { assertEquals("scene contentHash vs desktop", it, completed.summary.sceneContentHash) }
        args.getString("expectedSceneSha256")?.let { assertEquals("scene sha256 vs desktop", it, completed.summary.sceneSha256) }
        // the scene is in the store, verified, and loads
        assertNotNull(scenes.find(completed.entry.key))
        assertTrue(scenes.load(completed.entry.key) is com.buildplan.preview.scene.SceneLoadResult.Ok)
        assertScratchGone()
        assertEquals(LocalRunReport.OUTCOME_COMPLETED, run.report?.outcome)
        assertTrue("peak memory reported", (run.report?.peakRssBytes ?: 0) > 0)
    }

    @Test
    fun cancelWhileDownloadingStopsAtOnceAndLeavesNothing() {
        val run = analyse(FIXTURE_URL + "hangs", fixture = true, timeoutMs = 120_000L) { state ->
            // the fixture's drawings never answer: cancel once the job is fetching
            state is AnalysisState.Polling && state.status?.stage?.id == "ACQUIRING_SOURCE" && (state.status?.stage?.detail ?: "").contains("fetched")
        }
        writeReport("cancel-download", run)
        assertTrue("expected Cancelled, got ${run.final}", run.final is AnalysisState.Cancelled)
        assertFalse("the program stopped on its own, inside the fetch", run.report?.forcedStop ?: true)
        assertScratchGone()
    }

    @Test
    fun cancelWhileComputingEndsTheProcessAndLeavesNothing() {
        val run = analyse(FIXTURE_URL + "larchfield-lf01", fixture = true, timeoutMs = 120_000L) { state ->
            state is AnalysisState.Polling && state.status?.stage?.id == "EXTRACTING_OBSERVATIONS"
        }
        writeReport("cancel-compute", run)
        assertTrue("expected Cancelled, got ${run.final}", run.final is AnalysisState.Cancelled)
        assertScratchGone()
    }

    @Test
    fun liveUrlThroughTheProductionLauncher() {
        val url = args.getString("liveUrl")
        assumeTrue("no liveUrl argument: LIVE_ANDROID_ANALYSIS_NOT_RUN", !url.isNullOrBlank())
        val minutes = args.getString("liveTimeoutMinutes")?.toLongOrNull() ?: 40L
        val run = analyse(url!!, fixture = false, timeoutMs = minutes * 60_000L)
        writeReport("live", run)
        val completed = run.final as? AnalysisState.Completed
        assertNotNull("expected Completed, got ${run.final}", completed)
        args.getString("expectedLiveModelHash")?.let { assertEquals("model hash vs desktop", it, completed!!.summary.modelHash) }
        args.getString("expectedLiveSceneContentHash")?.let { assertEquals("scene contentHash vs desktop", it, completed!!.summary.sceneContentHash) }
        assertScratchGone()
    }

    // -----------------------------------------------------------------------

    private class Run(val states: List<AnalysisState>, val final: AnalysisState?, val report: LocalRunReport?, val wallMs: Long)

    private fun analyse(url: String, fixture: Boolean, timeoutMs: Long, cancelWhen: ((AnalysisState) -> Boolean)? = null): Run {
        val states = CopyOnWriteArrayList<AnalysisState>()
        val done = CountDownLatch(1)
        var report: LocalRunReport? = null
        var local: LocalAnalysis? = null
        val installRuntime: () -> InstalledRuntime = {
            val installed = files.install()
            if (fixture) {
                // the TEST launcher beside the production analyzer.mjs it imports
                for (name in listOf("fixture.mjs", "fixture-main.mjs")) {
                    testApk.assets.open("local-analyzer-fixture/$name").use { input -> File(installed.dir, name).outputStream().use { input.copyTo(it) } }
                }
            }
            installed
        }
        val started = System.currentTimeMillis()
        instrumentation.runOnMainSync {
            var cancelled = false
            local = LocalAnalysis(
                jobs = jobs,
                scenes = scenes,
                host = ServiceRuntimeHost(app),
                install = installRuntime,
                abi = LocalAvailability.of(app, files).abi,
                io = { work -> io.execute(work) },
                scheduler = MainScheduler(),
                publish = { state ->
                    states.add(state)
                    if (!cancelled && cancelWhen != null && cancelWhen(state)) {
                        cancelled = true
                        local?.cancel()
                    }
                    if (state is AnalysisState.Completed || state is AnalysisState.Failed || state is AnalysisState.Cancelled) done.countDown()
                },
                onFinished = { report = it },
                program = { installed -> if (fixture) File(installed.dir, "fixture-main.mjs") else installed.entry },
            )
            assertTrue(local!!.start(url))
        }
        val finished = done.await(timeoutMs, TimeUnit.MILLISECONDS)
        if (!finished) instrumentation.runOnMainSync { local?.shutdown() }
        // the final report is recorded just before the final state is published
        instrumentation.waitForIdleSync()
        return Run(states.toList(), states.lastOrNull()?.takeIf { finished }, report, System.currentTimeMillis() - started)
    }

    private fun assertScratchGone() {
        assertEquals("scratch bytes left in job folders", 0L, jobs.scratchBytes())
        assertTrue("job folders left: ${jobs.jobsDir.list()?.toList()}", jobs.jobsDir.list().isNullOrEmpty())
        assertFalse("journal left", File(root, LocalJobs.ACTIVE_JOB).exists())
        // no analyzer process of this app is left running (the system's list may lag the kill by a moment)
        val manager = app.getSystemService(android.app.ActivityManager::class.java)
        val deadline = System.currentTimeMillis() + 10_000
        var left: List<Int>
        do {
            left = (manager.runningAppProcesses ?: emptyList()).filter { it.processName.endsWith(":analyzer") && it.pid != Process.myPid() }.map { it.pid }
            if (left.isEmpty()) break
            Thread.sleep(200)
        } while (System.currentTimeMillis() < deadline)
        assertTrue("analyzer process still running: $left", left.isEmpty())
    }

    private fun writeReport(name: String, run: Run) {
        val dir = File(app.getExternalFilesDir(null), "local-analyzer-reports").apply { mkdirs() }
        val final = run.final
        val summary = (final as? AnalysisState.Completed)?.summary
        val json = buildJsonObject {
            put("test", name)
            put("device", "${Build.MANUFACTURER} ${Build.MODEL}")
            put("sdk", Build.VERSION.SDK_INT)
            put("supportedAbis", Build.SUPPORTED_ABIS.joinToString(","))
            put("final", final?.let { it::class.simpleName } ?: "TIMEOUT")
            put("wallMs", run.wallMs)
            put("states", run.states.size)
            (final as? AnalysisState.Failed)?.let { put("failure", it.failure.toString()) }
            if (summary != null) {
                put("title", summary.title)
                put("label", summary.label)
                put("sourcePackageHash", summary.sourcePackageHash)
                put("observationGraphHash", summary.observationGraphHash)
                put("metricEvidenceHash", summary.metricEvidenceHash)
                put("candidateHash", summary.candidateHash)
                put("modelHash", summary.modelHash)
                put("modelSha256", summary.modelSha256)
                put("sceneContentHash", summary.sceneContentHash)
                put("sceneSha256", summary.sceneSha256)
                put("sceneBytes", summary.sceneBytes)
                put("observations", summary.counts.observations)
                put("meshes", summary.counts.meshes)
                put("triangles", summary.counts.triangles)
            }
            run.report?.let { put("report", REPORT_JSON.encodeToJsonElement(LocalRunReport.serializer(), it)) }
        }
        File(dir, "$name.json").writeText(REPORT_JSON.encodeToString(JsonObject.serializer(), json) + "\n")
    }

    private fun <T> openOrNull(open: () -> T): T? = try {
        open()
    } catch (e: IOException) {
        null
    }

    private companion object {
        const val FIXTURE_URL = "https://drawings.synthetic-publisher.test/projects/"
        val REPORT_JSON = Json { prettyPrint = true; encodeDefaults = true }
    }
}
