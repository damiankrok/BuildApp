package com.buildplan.preview.analyzer.local

import android.os.Build
import java.io.File
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.longOrNull

/** Where the OCR parity self-test stands. */
sealed interface OcrSelfTestState {
    data object Idle : OcrSelfTestState

    data class Running(val done: Int, val total: Int) : OcrSelfTestState

    /** The program's compact record, as it wrote it, and the few fields shown on the screen. */
    data class Done(
        val parity: String,
        val recogniser: String,
        val modelSha256: String,
        val wasmSha256: String,
        val corpusSha256: String,
        val outputSha256: String,
        val exact: Int,
        val labels: Int,
        val perLabelMeanMs: Long,
        val totalMs: Long,
        val peakRssBytes: Long,
        /** What the person copies: the record plus the device it ran on. */
        val shareText: String,
    ) : OcrSelfTestState

    data class Failed(val message: String) : OcrSelfTestState
}

/**
 * The OCR parity self-test (BUILDPLAN-ANALYZER-005H), an OWNER diagnostic: the
 * embedded runtime runs `main.mjs --self-test ocr` — the external numeric
 * recogniser exactly as an analysis runs it (the bundle's worker, ONNX Runtime
 * Web's WebAssembly, the pinned model) — over a synthetic corpus it draws on
 * the phone (`apps/local-analyzer/src/self-test.ts`), and answers with a few
 * hashes that say whether this phone read the corpus exactly as the desktop
 * did. No publisher's pixel, no network, no file kept: the job's folder is
 * removed when the test ends.
 */
class OcrSelfTest(
    private val root: File,
    private val host: LocalRuntimeHost,
    private val install: () -> InstalledRuntime,
    private val io: (Runnable) -> Unit,
    private val scheduler: Scheduler,
    private val publish: (OcrSelfTestState) -> Unit,
    private val newId: () -> String = { LocalJobs.randomJobId() },
) {
    private var active: Run? = null

    val isRunning: Boolean get() = active != null

    /** Start the test; false when one is already running. */
    fun start(): Boolean {
        if (active != null) return false
        val run = Run(newId())
        active = run
        publish(OcrSelfTestState.Running(0, 0))
        io(
            Runnable {
                val installed = runCatching { install() }
                scheduler.post {
                    if (active !== run) return@post
                    installed.fold(
                        onSuccess = { run.begin(it) },
                        onFailure = { run.finish(OcrSelfTestState.Failed(it.message ?: "the analyzer could not be prepared on this phone")) },
                    )
                }
            },
        )
        return true
    }

    /** Stop the test now. */
    fun cancel() {
        active?.finish(OcrSelfTestState.Failed("przerwano"))
    }

    private inner class Run(val jobId: String) : LocalRunListener {
        private val dir = File(File(root, "self-test"), jobId)
        private val outDir = File(dir, "out")
        private var handle: LocalRunHandle? = null
        private var terminal = false

        fun begin(runtime: InstalledRuntime) {
            outDir.mkdirs()
            val request = LocalRunRequest(
                program = runtime.entry.absolutePath,
                arguments = listOf("--self-test", "ocr", "--job", jobId, "--out", outDir.absolutePath),
                environment = listOf("TMPDIR=${dir.absolutePath}", "HOME=${dir.absolutePath}"),
            )
            handle = host.start(request, this)
        }

        override fun onStarted(pid: Int) = Unit

        override fun onLine(line: String) {
            if (terminal) return
            val event = runCatching { JSON.parseToJsonElement(line).jsonObject }.getOrNull() ?: return
            when ((event["type"] as? JsonPrimitive)?.contentOrNull) {
                "self-test-progress" -> publish(OcrSelfTestState.Running(event.int("done"), event.int("total")))
                "self-test" -> finish(doneOf(event["record"]?.jsonObject ?: return))
                "failed" -> finish(OcrSelfTestState.Failed(event.string("message") ?: "the self-test failed"))
                "cancelled" -> finish(OcrSelfTestState.Failed("przerwano"))
            }
        }

        override fun onExited(code: Int) {
            if (!terminal) finish(OcrSelfTestState.Failed("the runtime ended without a result (exit code $code)"))
        }

        override fun onProcessGone() {
            if (!terminal) finish(OcrSelfTestState.Failed("the analyzer process stopped before the test finished"))
        }

        override fun onStartFailed(code: String, message: String) {
            if (!terminal) finish(OcrSelfTestState.Failed("$code: $message"))
        }

        fun finish(state: OcrSelfTestState) {
            if (terminal) return
            terminal = true
            handle?.terminate()
            if (active === this) active = null
            io(Runnable { dir.deleteRecursively() })
            publish(state)
        }

        private fun doneOf(record: JsonObject): OcrSelfTestState.Done {
            val recogniser = record["recogniser"]?.jsonObject
            val corpus = record["corpus"]?.jsonObject
            val timing = record["timing"]?.jsonObject
            val device = "${Build.MANUFACTURER} ${Build.MODEL} · Android ${Build.VERSION.RELEASE} (SDK ${Build.VERSION.SDK_INT}) · ${Build.SUPPORTED_ABIS.firstOrNull() ?: "?"}"
            val share = JSON.encodeToString(JsonObject.serializer(), JsonObject(record + ("device" to JsonPrimitive(device))))
            return OcrSelfTestState.Done(
                parity = record.string("parity") ?: "?",
                recogniser = recogniser?.string("id") ?: "?",
                modelSha256 = recogniser?.string("modelSha256") ?: "?",
                wasmSha256 = record.string("wasmSha256") ?: "?",
                corpusSha256 = corpus?.string("sha256") ?: "?",
                outputSha256 = record.string("outputSha256") ?: "?",
                exact = record.int("exact"),
                labels = corpus?.int("labels") ?: 0,
                perLabelMeanMs = timing?.long("perLabelMeanMs") ?: 0,
                totalMs = timing?.long("totalMs") ?: 0,
                peakRssBytes = record.long("peakRssBytes"),
                shareText = share,
            )
        }
    }

    private companion object {
        val JSON = Json { ignoreUnknownKeys = true }

        fun JsonObject.string(key: String): String? = (this[key] as? JsonPrimitive)?.contentOrNull

        fun JsonObject.int(key: String): Int = (this[key] as? JsonPrimitive)?.intOrNull ?: 0

        fun JsonObject.long(key: String): Long = (this[key] as? JsonPrimitive)?.longOrNull ?: 0
    }
}
