package com.buildplan.preview

import com.buildplan.preview.analyzer.AnalysisStages
import com.buildplan.preview.analyzer.HttpResponse
import com.buildplan.preview.analyzer.HttpTransport
import com.buildplan.preview.analyzer.ResponseTooLargeException
import com.buildplan.preview.scene.DownloadedScenes
import java.io.File
import java.nio.file.Files

/**
 * A scripted analyzer service for the JVM tests.
 *
 * Each route answers from a queue; the last answer repeats. An answer may
 * throw, which is how a lost connection is simulated. Every request is
 * recorded, so a test can assert that something was NOT asked for.
 */
class FakeTransport : HttpTransport {
    data class Request(val method: String, val url: String, val body: String?, val contentType: String?, val maxBytes: Long)

    val requests = mutableListOf<Request>()
    private val routes = mutableMapOf<String, ArrayDeque<() -> HttpResponse>>()

    fun on(method: String, url: String, vararg answers: () -> HttpResponse) {
        routes["$method $url"] = ArrayDeque(answers.toList())
    }

    fun count(method: String, url: String): Int = requests.count { it.method == method && it.url == url }

    override fun get(url: String, maxBytes: Long) = dispatch("GET", url, null, null, maxBytes)

    override fun post(url: String, body: ByteArray, contentType: String, maxBytes: Long) =
        dispatch("POST", url, body.decodeToString(), contentType, maxBytes)

    override fun delete(url: String, maxBytes: Long) = dispatch("DELETE", url, null, null, maxBytes)

    private fun dispatch(method: String, url: String, body: String?, contentType: String?, maxBytes: Long): HttpResponse {
        requests += Request(method, url, body, contentType, maxBytes)
        val queue = routes["$method $url"] ?: error("unexpected request $method $url")
        val answer = if (queue.size > 1) queue.removeFirst() else queue.first()
        val response = answer()
        // The real transport refuses to hold more than the cap; so does this one.
        if (response.body.size > maxBytes) throw ResponseTooLargeException(maxBytes)
        return response
    }

    companion object {
        fun json(status: Int, text: String, headers: Map<String, String> = emptyMap()): () -> HttpResponse =
            { HttpResponse(status, headers.mapValues { listOf(it.value) } + ("Content-Type" to listOf("application/json")), text.encodeToByteArray()) }

        fun bytes(status: Int, body: ByteArray, headers: Map<String, String> = emptyMap()): () -> HttpResponse =
            { HttpResponse(status, headers.mapValues { listOf(it.value) }, body) }

        fun fails(e: java.io.IOException): () -> HttpResponse = { throw e }

        fun refusal(status: Int, code: String, message: String, headers: Map<String, String> = emptyMap()) =
            json(status, """{"error":{"code":"$code","message":"$message"}}""", headers)
    }
}

object AnalyzerFixtures {
    const val BASE = "https://analyzer.example.test"
    const val JOB = "0123456789abcdef0123456789abcdef"
    const val LINK = "https://www.archon.pl/projekty-domow/projekt-dom-w-marcowkach-ge-m2fa281446a8ca"

    /** The `GET /v1/analyses/:jobId` example of docs/ANALYZER_API.md, verbatim. */
    val CONTRACT_STATUS = """
        {
          "jobId": "3f9c…",
          "status": "EXTRACTING_OBSERVATIONS",
          "progress": 0.31,
          "stage": { "id": "EXTRACTING_OBSERVATIONS", "label": "Reading the drawings", "index": 2, "count": 9, "fraction": 0.4, "detail": "drawing 9 of 20" },
          "stages": [
            { "id": "ACQUIRING_SOURCE", "label": "Fetching the project page and its drawings", "state": "DONE", "startedAt": "…", "completedAt": "…" },
            { "id": "CLASSIFYING_SOURCES", "label": "…", "state": "DONE", "startedAt": "…", "completedAt": "…" },
            { "id": "EXTRACTING_OBSERVATIONS", "label": "…", "state": "RUNNING", "startedAt": "…" },
            { "id": "REGISTERING_VIEWS", "label": "…", "state": "PENDING" }
          ],
          "sourceUrl": "https://www.archon.pl/…",
          "createdAt": "…", "updatedAt": "…", "startedAt": "…", "completedAt": null,
          "error": null,
          "result": null,
          "links": { "self": "/v1/analyses/3f9c…" }
        }
    """.trimIndent()

    /** The short `result` member of a COMPLETED status record, verbatim from the contract. */
    val CONTRACT_SHORT_RESULT = """
        "result": {
          "title": "Dom w marcówkach (GE)",
          "label": "Dom w marcówkach (GE) (analysis)",
          "candidateHash": "…64 hex…",
          "modelHash": "…",
          "sceneSha256": "…",
          "sceneContentHash": "…",
          "sceneBytes": 3456789,
          "quality": { "L0": 12, "L1": 30, "L2": 18 },
          "unresolved": 2,
          "warnings": 3,
          "vision": "DETERMINISTIC_ONLY"
        }
    """.trimIndent()

    /** `202 Accepted` from `POST /v1/analyses`, as the contract shows it. */
    fun submitted(jobId: String = JOB) = """{ "jobId": "$jobId", "status": "QUEUED", "links": { "self": "/v1/analyses/$jobId" } }"""

    /** The demo bundle that ships in the APK: real bytes the store can verify and parse. */
    val sceneBytes: ByteArray by lazy { TestScenes.text("demo.scene.json").encodeToByteArray() }
    val sceneSha256: String by lazy { DownloadedScenes.sha256Hex(sceneBytes) }
    val sceneContentHash: String by lazy { TestScenes.bundle("demo").contentHash }

    const val CANDIDATE = "c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00"
    const val MODEL = "0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d0d"

    /**
     * A status record for `status`, with the nine stages in the states that
     * position implies: done before `running`, running at it, pending after.
     */
    fun status(
        status: String,
        progress: Double,
        running: Int = -1,
        detail: String? = null,
        jobId: String = JOB,
        error: String = "null",
        result: String = "null",
    ): String {
        val stages = AnalysisStages.PIPELINE.mapIndexed { i, id ->
            val state = when {
                status == AnalysisStages.COMPLETED -> "DONE"
                status == AnalysisStages.FAILED && i == running -> "FAILED"
                status == AnalysisStages.CANCELLED && i == running -> "CANCELLED"
                running < 0 -> "PENDING"
                i < running -> "DONE"
                i == running && status !in AnalysisStages.TERMINAL -> "RUNNING"
                else -> "PENDING"
            }
            """{"id":"$id","label":"${AnalysisStages.DEFAULT_LABELS[id]}","state":"$state"}"""
        }.joinToString(",")
        val stage = if (running >= 0 && status !in AnalysisStages.TERMINAL) {
            val id = AnalysisStages.PIPELINE[running]
            """{"id":"$id","label":"${AnalysisStages.DEFAULT_LABELS[id]}","index":$running,"count":9,"fraction":0.5${detail?.let { ",\"detail\":\"$it\"" } ?: ""}}"""
        } else {
            "null"
        }
        return """
            {"jobId":"$jobId","status":"$status","progress":$progress,"stage":$stage,"stages":[$stages],
             "sourceUrl":"$LINK","createdAt":"2026-09-26T10:00:00.000Z","updatedAt":"2026-09-26T10:01:00.000Z",
             "startedAt":"2026-09-26T10:00:01.000Z","completedAt":${if (status in AnalysisStages.TERMINAL) "\"2026-09-26T10:03:00.000Z\"" else "null"},
             "error":$error,"result":$result,"links":{"self":"/v1/analyses/$jobId"}}
        """.trimIndent()
    }

    /** A full `LinkAnalysisSummary` as `GET /result` returns it, naming the demo scene's hashes by default. */
    fun summary(
        sceneSha256: String = this.sceneSha256,
        sceneContentHash: String = this.sceneContentHash,
        sceneBytes: Long = this.sceneBytes.size.toLong(),
        jobId: String = JOB,
        vision: String = """{"mode":"DETERMINISTIC_ONLY","provider":null,"attempted":0,"accepted":0}""",
    ): String = """
        {
          "schema": "buildapp.link-analysis-result",
          "schemaVersion": "1.0.0",
          "jobId": "$jobId",
          "sourceUrl": "$LINK",
          "canonicalUrl": "$LINK",
          "title": "Dom w marcówkach (GE)",
          "label": "Dom w marcówkach (GE) (analysis)",
          "modelId": "m-analysis-dom-w-marcowkach-ge",
          "publisher": "archon.pl",
          "adapter": { "id": "archon.pl", "version": "1.2.0" },
          "sourcePackageId": "sp-1",
          "sourcePackageHash": "${"a".repeat(64)}",
          "observationGraphHash": "${"b".repeat(64)}",
          "metricEvidenceHash": "${"e".repeat(64)}",
          "candidateHash": "$CANDIDATE",
          "modelHash": "$MODEL",
          "modelSha256": "${"f".repeat(64)}",
          "sceneContentHash": "$sceneContentHash",
          "sceneSha256": "$sceneSha256",
          "sceneBytes": $sceneBytes,
          "counts": {
            "assets": 20, "assetsByDocument": { "PLAN": 6, "ELEVATION": 4, "SECTION": 1, "RENDER": 9 },
            "observations": 812, "frames": 11, "metricEvidence": 140, "callouts": 31, "commands": 96,
            "masses": 3, "openings": 42, "rooms": 14, "balconies": 1, "terraces": 2, "railings": 2,
            "chimneys": 1, "rooflights": 0, "meshes": 88, "triangles": 2332
          },
          "quality": { "levels": { "L0": 12, "L1": 30, "L2": 18 }, "byFamily": { "OPENING": { "L1": 20, "L2": 18 } } },
          "unresolved": [
            { "what": "rear roof overhang", "reason": "no section shows it", "status": "UNRESOLVED" },
            { "what": "stair run count", "reason": "plan and section disagree", "status": "AMBIGUOUS" }
          ],
          "warnings": [
            "no vision provider ran; every observation is from the deterministic analyzer",
            "2 of 57 source-view checks outside tolerance",
            "1 exterior joint finding in the closure audit"
          ],
          "vision": $vision,
          "verification": {
            "replay": "BYTE_IDENTICAL", "residuals": 57, "residualsOutsideTolerance": 2,
            "closure": { "exteriorErrors": 1, "exteriorFindings": 3, "interiorFindings": 5 }
          },
          "analyzer": { "service": "1.0.0", "solver": "2.0.0" },
          "startedAt": "2026-09-26T10:00:01.000Z",
          "completedAt": "2026-09-26T10:03:00.000Z",
          "links": { "self": "/v1/analyses/$jobId/result", "scene": "/v1/analyses/$jobId/scene" }
        }
    """.trimIndent()

    fun tempDir(prefix: String = "analyses"): File = Files.createTempDirectory(prefix).toFile().also { it.deleteOnExit() }

    /** Every file under `dir`, relative, sorted: what a failed write must not leave behind. */
    fun filesIn(dir: File): List<String> =
        dir.walkTopDown().filter { it.isFile }.map { it.relativeTo(dir).path }.sorted().toList()
}
