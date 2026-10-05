package com.buildplan.preview

import com.buildplan.preview.analyzer.local.InstalledRuntime
import com.buildplan.preview.analyzer.local.LocalAnalysis
import com.buildplan.preview.analyzer.local.LocalRunHandle
import com.buildplan.preview.analyzer.local.LocalRunListener
import com.buildplan.preview.analyzer.local.LocalRunRequest
import com.buildplan.preview.analyzer.local.LocalRuntimeHost
import com.buildplan.preview.analyzer.local.LocalRuntimeManifest
import com.buildplan.preview.analyzer.local.OcrSelfTest
import com.buildplan.preview.analyzer.local.OcrSelfTestState
import com.buildplan.preview.analyzer.local.Scheduler
import java.io.File
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The OCR parity self-test's runner (005H): a record, a failure or a cancel is published only once the runtime's
 * process is gone — or after the same short wait `LocalAnalysis` gives it — so nothing binds a dying process; its
 * folder goes with it, and what an earlier test left behind is swept before the next one starts.
 */
class OcrSelfTestTest {

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
        var terminated = false

        override fun cancel() = Unit

        override fun terminate() {
            terminated = true
        }

        fun arg(name: String): String = request.arguments[request.arguments.indexOf("--$name") + 1]
    }

    private class FakeHost : LocalRuntimeHost {
        val runs = mutableListOf<FakeRun>()

        override fun start(request: LocalRunRequest, listener: LocalRunListener): LocalRunHandle = FakeRun(request, listener).also { runs.add(it) }
    }

    private class World {
        val root: File = AnalyzerFixtures.tempDir("ocr-self-test")
        val host = FakeHost()
        val scheduler = ManualScheduler()
        val states = mutableListOf<OcrSelfTestState>()
        private var ids = 0
        val selfTest = OcrSelfTest(
            root = root,
            host = host,
            install = { InstalledRuntime(File(root, "runtime"), File(root, "runtime/main.mjs"), LocalRuntimeManifest()) },
            io = { it.run() },
            scheduler = scheduler,
            publish = { states.add(it) },
            newId = { "%032x".format(++ids) },
            device = { "test device" },
        )
    }

    private val record = """{"kind":"ocr-parity","recogniser":{"id":"ocr.ppocrv6-tiny-rec@9ef676d6","modelSha256":"9ef6","runtime":"ort"},"wasmSha256":"3398","corpus":{"name":"c","version":1,"labels":96,"sha256":"7343"},"outputSha256":"396c","exact":92,"timing":{"drawMs":1,"totalMs":2,"loadMs":3,"perLabelMeanMs":4,"perLabelP95Ms":5},"peakRssBytes":6,"parity":"MATCH"}"""

    @Test
    fun `the record is published once the process is gone, and the job folder goes with it`() {
        val w = World()
        assertTrue(w.selfTest.start())
        w.scheduler.drain()
        val run = w.host.runs.single()
        val jobDir = File(File(w.root, "self-test"), run.arg("job"))
        assertTrue(jobDir.isDirectory)
        run.listener.onLine("""{"type":"self-test-progress","done":3,"total":96}""")
        run.listener.onLine("""{"type":"self-test","record":$record}""")
        assertTrue(run.terminated)
        // not yet: the process may still be dying
        assertFalse(w.states.any { it is OcrSelfTestState.Done })
        assertTrue(w.selfTest.isRunning)
        assertFalse(w.selfTest.start())
        run.listener.onProcessGone()
        val done = w.states.last() as OcrSelfTestState.Done
        assertEquals("MATCH", done.parity)
        assertEquals(92, done.exact)
        assertTrue(done.shareText.contains("test device"))
        assertFalse(jobDir.exists())
        assertFalse(w.selfTest.isRunning)
    }

    @Test
    fun `a process never reported gone is waited for no longer than an analysis waits`() {
        val w = World()
        w.selfTest.start()
        w.scheduler.drain()
        w.host.runs.single().listener.onLine("""{"type":"self-test","record":$record}""")
        w.scheduler.advance(LocalAnalysis.PROCESS_GONE_WAIT_MS - 1)
        assertFalse(w.states.any { it is OcrSelfTestState.Done })
        w.scheduler.advance(1)
        assertTrue(w.states.last() is OcrSelfTestState.Done)
    }

    @Test
    fun `a cancel ends the process and says so, and a process gone mid-test is named, not left running`() {
        val w = World()
        w.selfTest.start()
        w.scheduler.drain()
        val first = w.host.runs.single()
        w.selfTest.cancel()
        assertTrue(first.terminated)
        first.listener.onProcessGone()
        assertEquals(OcrSelfTestState.Failed(OcrSelfTestState.Reason.CANCELLED), w.states.last())

        w.selfTest.start()
        w.scheduler.drain()
        w.host.runs.last().listener.onProcessGone()
        assertEquals(OcrSelfTestState.Failed(OcrSelfTestState.Reason.PROCESS_STOPPED), w.states.last())
    }

    @Test
    fun `what an earlier test left behind is swept before the next one starts`() {
        val w = World()
        val stale = File(File(w.root, "self-test"), "0".repeat(32)).apply { mkdirs() }
        File(stale, "self-test.json").writeText("{}")
        w.selfTest.start()
        w.scheduler.drain()
        assertFalse(stale.exists())
        assertEquals(1, File(w.root, "self-test").listFiles()?.size)
    }
}
