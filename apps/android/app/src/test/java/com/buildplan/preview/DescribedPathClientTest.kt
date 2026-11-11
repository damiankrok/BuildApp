package com.buildplan.preview

import com.buildplan.preview.FakeTransport.Companion.bytes
import com.buildplan.preview.FakeTransport.Companion.json
import com.buildplan.preview.analyzer.AnalysisStages
import com.buildplan.preview.analyzer.AnalysisState
import com.buildplan.preview.analyzer.AnalysisTracker
import com.buildplan.preview.analyzer.AnalyzerClient
import com.buildplan.preview.analyzer.AnalyzerFailure
import com.buildplan.preview.analyzer.AnalyzerJson
import com.buildplan.preview.analyzer.AnalyzerMessages
import com.buildplan.preview.analyzer.DescribedPicture
import com.buildplan.preview.analyzer.DescribedPictureLoader
import com.buildplan.preview.analyzer.DescribingWords
import com.buildplan.preview.analyzer.JobStatus
import com.buildplan.preview.analyzer.Outcome
import com.buildplan.preview.analyzer.PictureFetch
import com.buildplan.preview.analyzer.PictureOriginal
import com.buildplan.preview.analyzer.PilotTokens
import com.buildplan.preview.analyzer.Step
import com.buildplan.preview.scene.BundledScenes
import com.buildplan.preview.scene.DownloadedScenes
import com.buildplan.preview.scene.SceneLoadResult
import com.buildplan.preview.scene.SceneRepository
import com.buildplan.preview.ui.ResultHeadline
import com.buildplan.preview.ui.resultHeadline
import java.io.File
import java.io.IOException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * v3.53.2: the phone against what the analyzer service REALLY says when it reads a house as a whole from a page's
 * pictures (`src/test/resources/analyzer-described/`, captured over HTTP by
 * `apps/analyzer-api/scripts/capture-android-described-contract.ts`; the service's house reader in that capture is a
 * stand-in, so nothing here was paid for and none of it says how a live reader does).
 *
 * What is held: the pilot's token rides on the submission and nowhere else; a missing token is the ordinary path and
 * a wrong one is a named refusal; the reading phase and its pictures are read and worded; an original is shown only
 * when its bytes are the ones the service hashed; a described result is never headed as a ready, measured model; a job
 * can be cancelled while the house is being read.
 */
class DescribedPathClientTest {

    private fun resource(name: String): ByteArray =
        requireNotNull(javaClass.classLoader?.getResourceAsStream("analyzer-described/$name")) { "missing test resource $name" }.use { it.readBytes() }

    private fun text(name: String) = resource(name).decodeToString()
    private fun meta(key: String) = Regex("\"$key\": \"([^\"]+)\"").find(text("meta.json"))!!.groupValues[1]
    private fun status(name: String) = AnalyzerJson.decodeFromString(JobStatus.serializer(), text(name))

    private val base = "https://analyzer.example.test"
    private val job = "d".repeat(32)
    private val page get() = meta("page")
    private val token get() = meta("pilotToken")
    private val statusUrl = "$base/v1/analyses/$job"

    private fun run(tracker: AnalysisTracker, first: AnalysisState): List<Step> {
        var state = first
        val steps = mutableListOf<Step>()
        repeat(30) {
            val step = tracker.step(state)
            steps += step
            state = step.state
            if (step.delayMs == null) return steps
        }
        return steps
    }

    // --- the token ---------------------------------------------------------------------------------------------------

    @Test
    fun `a token is a header value of 24 to 200 visible ASCII characters, and only its last four are ever shown`() {
        assertNull(PilotTokens.problem(token))
        assertNotNull(PilotTokens.problem(""))
        assertNotNull(PilotTokens.problem("too-short"))
        assertNotNull(PilotTokens.problem("x".repeat(201)))
        assertNotNull(PilotTokens.problem("a token with spaces that is long enough"))
        assertNotNull(PilotTokens.problem("zażółć-gęślą-jaźń-zażółć-gęślą-jaźń"))
        // a line break can never reach a header
        assertNull(PilotTokens.authorization("good-token-0123456789abcdef\r\nX-Injected: 1"))
        assertEquals("Bearer $token", PilotTokens.authorization("  $token  "))
        assertNull(PilotTokens.authorization(null))
        assertNull(PilotTokens.authorization(""))
        assertEquals("••••" + token.takeLast(4), PilotTokens.masked(token))
        assertFalse(PilotTokens.masked(token).contains(token.take(8)))
    }

    @Test
    fun `the token rides on the submission and on nothing else - not a poll, a result, a scene or a cancellation`() {
        val transport = FakeTransport()
        transport.on("POST", "$base/v1/analyses", json(202, text("submitted.json")))
        transport.on("GET", statusUrl, json(200, text("status-describing.json")))
        transport.on("GET", "$statusUrl/result", json(200, text("result.json")))
        transport.on("GET", "$statusUrl/scene", bytes(200, resource("scene.json")))
        transport.on("DELETE", statusUrl, json(200, text("cancel-response.json").replace("c".repeat(32), job)))
        val client = AnalyzerClient(base, transport, token)
        assertTrue(client.hasPilotToken)
        client.submit(page); client.status(job); client.result(job); client.downloadScene(job, 8L * 1024 * 1024); client.cancel(job)
        val sent = transport.requests
        assertEquals(listOf("POST"), sent.filter { it.authorization != null }.map { it.method })
        assertEquals("Bearer $token", sent.first { it.method == "POST" }.authorization)
        // never in an address or a body
        assertTrue(sent.none { it.url.contains(token) || it.body.orEmpty().contains(token) })
    }

    @Test
    fun `without a token, and with text that cannot be one, a submission carries no authorization at all`() {
        for (candidate in listOf(null, "", "   ", "short", "has spaces in it and is long enough")) {
            val transport = FakeTransport()
            transport.on("POST", "$base/v1/analyses", json(202, text("submitted.json")))
            val client = AnalyzerClient(base, transport, candidate)
            assertFalse(client.hasPilotToken)
            assertTrue(client.submit(page) is Outcome.Ok)
            assertNull(transport.requests.single().authorization)
        }
    }

    @Test
    fun `a wrong token is the service's named refusal - nothing is started and the owner is told what to do`() {
        val transport = FakeTransport()
        transport.on("POST", "$base/v1/analyses", json(401, text("refusal-wrong-token.json")))
        val tracker = AnalysisTracker(AnalyzerClient(base, transport, "another-token-0123456789abcdefgh"), DownloadedScenes(AnalyzerFixtures.tempDir("described-wrong")))
        val state = tracker.submit(page)
        val failed = state as AnalysisState.Failed
        assertEquals(AnalyzerFailure.PilotTokenRefused, failed.failure)
        assertFalse(failed.failure.isTransient)
        assertEquals(1, transport.requests.size)
        val words = AnalyzerMessages.describe(failed.failure)
        assertTrue(words.contains("kodu dostępu pilota") && words.contains("nie rozpoczęto"))
        assertEquals("Kod dostępu pilota nie został przyjęty", AnalyzerMessages.title(failed.failure))
    }

    @Test
    fun `without a token the same page ends as the drawings' own refusal, with no reading phase on the record`() {
        val anonymous = "a".repeat(32)
        val transport = FakeTransport()
        transport.on("POST", "$base/v1/analyses", json(202, text("submitted.json").replace(job, anonymous)))
        transport.on("GET", "$base/v1/analyses/$anonymous", json(200, text("status-failed-without-token.json")))
        val tracker = AnalysisTracker(AnalyzerClient(base, transport), DownloadedScenes(AnalyzerFixtures.tempDir("described-anon")))
        val last = run(tracker, tracker.submit(page)).last().state as AnalysisState.Failed
        assertNull(last.status?.describing)
        assertNull(transport.requests.first { it.method == "POST" }.authorization)
        assertTrue(AnalyzerMessages.describe(last.failure).isNotBlank())
    }

    // --- the reading phase -------------------------------------------------------------------------------------------

    @Test
    fun `the three phases are read from the server's own records, in order, each with its words and its pictures`() {
        val sorting = status("status-sorting.json")
        val describing = status("status-describing.json")
        val building = status("status-building.json")
        assertEquals(listOf(DescribingWords.SORTING, DescribingWords.DESCRIBING, DescribingWords.BUILDING), listOf(sorting, describing, building).map { it.describing!!.phase })
        // the progress the phone shows never moves back across them, and never reads done while the job runs
        val progress = listOf(sorting, describing, building).map { it.progress }
        assertEquals(progress.sorted(), progress)
        assertTrue(progress.all { it < 1.0 })
        assertTrue(listOf(sorting, describing, building).none { it.isTerminal })

        val s = sorting.describing!!
        assertTrue(s.pictures.isEmpty())
        assertTrue(s.picturesOnPage > 0)
        assertTrue(DescribingWords.phase(s).startsWith("Sortuję ${s.picturesOnPage} obrazów"))
        val d = describing.describing!!
        assertTrue(d.pictures.isNotEmpty())
        assertTrue(DescribingWords.phase(d).contains("${d.pictures.size} obraz"))
        assertEquals("Buduję model z opisu domu.", DescribingWords.phase(building.describing!!))
        // why the reading started: the drawings' refusal, in words
        assertEquals("NO_DRAWINGS", d.after?.code)
        assertEquals("Na stronie nie ma rysunków, z których dałoby się zmierzyć dom.", DescribingWords.reason(d.after))
        assertEquals("house-reader.stand-in", d.provider?.id)
    }

    @Test
    fun `every picture names its original and what was sent apart - two hashes, never compared, and no mark of any kind`() {
        val pictures = status("status-completed.json").describing!!.pictures
        assertTrue(pictures.isNotEmpty())
        assertEquals((1..pictures.size).toList(), pictures.map { it.number })
        for (p in pictures) {
            assertTrue(Regex("^[0-9a-f]{64}$").matches(p.original.sha256!!))
            assertTrue(Regex("^[0-9a-f]{64}$").matches(p.sent.sha256))
            assertNotEquals(p.original.sha256, p.sent.sha256)
            assertTrue(p.original.url!!.startsWith("https://"))
            assertEquals("image/jpeg", p.sent.mediaType)
            assertTrue(p.sent.bytes > 0 && p.sent.widthPx > 0 && p.sent.widthPx <= p.original.widthPx)
            assertEquals("widok z zewnątrz", DescribingWords.kind(p.kind))
        }
        // the record carries nothing a mark could be drawn from
        val raw = text("status-completed.json")
        for (word in listOf("\"marks\"", "\"box\"", "\"line\"", "\"pixelRect\"")) assertFalse(raw.contains(word))
    }

    @Test
    fun `an original is shown only when the bytes the phone downloads are the ones the service hashed`() {
        val first = status("status-completed.json").describing!!.pictures.first()
        assertEquals(meta("sha256"), first.original.sha256)
        val original = resource("picture-original.png")
        val url = first.original.url!!

        val right = FakeTransport().apply { on("GET", url, bytes(200, original)) }
        val shown = DescribedPictureLoader(right).fetch(first)
        assertTrue(shown is PictureFetch.Verified && shown.bytes.contentEquals(original))
        // the pilot's token is the service's, never the publisher's
        assertNull(right.requests.single().authorization)

        // one byte different: not the picture that was read
        val other = original.copyOf().also { it[it.size / 2] = (it[it.size / 2] + 1).toByte() }
        assertEquals(PictureFetch.HashMismatch, DescribedPictureLoader(FakeTransport().apply { on("GET", url, bytes(200, other)) }).fetch(first))
        // the JPEG that was SENT is not the original either: its hash is its own
        assertNotEquals(first.sent.sha256, DescribedPictureLoader.sha256Hex(original))

        assertTrue(DescribedPictureLoader(FakeTransport().apply { on("GET", url, bytes(404, ByteArray(0))) }).fetch(first) is PictureFetch.Unavailable)
        assertTrue(DescribedPictureLoader(FakeTransport().apply { on("GET", url, FakeTransport.fails(IOException("reset"))) }).fetch(first) is PictureFetch.Unavailable)
        assertTrue(DescribedPictureLoader(FakeTransport().apply { on("GET", url, bytes(200, original)) }, maxBytes = 1000).fetch(first) is PictureFetch.Unavailable)
        // nothing to verify against, or an address that is not plain https: never fetched
        val untouched = FakeTransport()
        assertEquals(PictureFetch.NotVerifiable, DescribedPictureLoader(untouched).fetch(first.copy(original = first.original.copy(sha256 = null))))
        assertEquals(PictureFetch.NotVerifiable, DescribedPictureLoader(untouched).fetch(DescribedPicture(original = PictureOriginal(url = null, sha256 = first.original.sha256))))
        assertTrue(DescribedPictureLoader(untouched).fetch(first.copy(original = first.original.copy(url = "http://example.test/a.png"))) is PictureFetch.Unavailable)
        assertTrue(untouched.requests.isEmpty())
    }

    @Test
    fun `an older service, which never reads a house this way, is read as before - the member is simply absent`() {
        val legacy = requireNotNull(javaClass.classLoader?.getResourceAsStream("analyzer-contract-current/status-running.json")).use { it.readBytes().decodeToString() }
        assertNull(AnalyzerJson.decodeFromString(JobStatus.serializer(), legacy).describing)
        // and a phase this build does not know is said as a code, not dropped
        val unknown = status("status-describing.json").describing!!.copy(phase = "SOMETHING_NEW")
        assertTrue(DescribingWords.phase(unknown).contains("SOMETHING_NEW"))
    }

    // --- the whole job, the result, and a cancellation -----------------------------------------------------------------

    @Test
    fun `the described job, from the server's own bytes, ends as a stored model that says it is approximate - never a ready one`() {
        val transport = FakeTransport()
        transport.on("POST", "$base/v1/analyses", json(202, text("submitted.json")))
        transport.on("GET", statusUrl, json(200, text("status-sorting.json")), json(200, text("status-describing.json")), json(200, text("status-building.json")), json(200, text("status-completed.json")))
        transport.on("GET", "$statusUrl/result", json(200, text("result.json")))
        transport.on("GET", "$statusUrl/scene", bytes(200, resource("scene.json"), mapOf("X-Content-SHA256" to meta("sceneSha256Header"))))
        val store = DownloadedScenes(AnalyzerFixtures.tempDir("described-job"))
        val tracker = AnalysisTracker(AnalyzerClient(base, transport, token), store)
        val steps = run(tracker, tracker.submit(page))

        val phases = steps.mapNotNull { (it.state as? AnalysisState.Polling)?.status?.describing?.phase }
        assertEquals(listOf(DescribingWords.SORTING, DescribingWords.DESCRIBING, DescribingWords.BUILDING), phases.distinct())
        val completed = steps.last().state as AnalysisState.Completed
        assertEquals(meta("sceneSha256Header"), completed.entry.sceneSha256)

        val summary = completed.summary
        assertTrue(summary.isFromDescription)
        assertTrue(summary.title.isNotBlank() && summary.label.contains("model z opisu źródeł"))
        assertEquals(ResultHeadline.LIMITED, resultHeadline(summary))
        assertTrue(summary.limitingWarnings.isNotEmpty())
        assertTrue(summary.preview.provisional.map { it.code }.containsAll(listOf("SCALE_NOT_VERIFIED", "HEIGHT_ASSUMED_FOR_PREVIEW")))

        val repository = SceneRepository(BundledScenes { TestScenes.text(it) }, store)
        val loaded = repository.load(repository.entries().last()) as SceneLoadResult.Ok
        assertTrue(loaded.scene.bundle.scene.meshes.isNotEmpty())
    }

    @Test
    fun `a job is cancelled while the house is being read - the record keeps what was being read, and nothing is stored`() {
        val cancelledJob = "c".repeat(32)
        val url = "$base/v1/analyses/$cancelledJob"
        val dir = AnalyzerFixtures.tempDir("described-cancel")
        val transport = FakeTransport()
        transport.on("POST", "$base/v1/analyses", json(202, text("submitted.json").replace(job, cancelledJob)))
        transport.on("GET", url, json(200, text("status-describing.json").replace(job, cancelledJob)), json(200, text("status-cancelled.json")))
        transport.on("DELETE", url, json(200, text("cancel-response.json")))
        val tracker = AnalysisTracker(AnalyzerClient(base, transport, token), DownloadedScenes(dir))
        val reading = tracker.step(tracker.submit(page)).state as AnalysisState.Polling
        assertEquals(DescribingWords.DESCRIBING, reading.status?.describing?.phase)

        tracker.cancel(reading.jobId, reading.sourceUrl, reading.status)
        val after = status("status-cancelled.json")
        assertEquals(AnalysisStages.CANCELLED, after.status)
        assertTrue(after.isTerminal)
        assertEquals(DescribingWords.DESCRIBING, after.describing?.phase)
        assertNull(after.result)
        // the cancellation carried no token, and nothing was written to the phone
        assertNull(transport.requests.single { it.method == "DELETE" }.authorization)
        assertTrue(AnalyzerFixtures.filesIn(dir).isEmpty())
        assertEquals(0, transport.requests.count { it.url.endsWith("/scene") || it.url.endsWith("/result") })
    }

    @Test
    fun `no build variable, resource or source of the app carries a pilot token or a provider key`() {
        // run from the module directory (Gradle's working directory for unit tests)
        val module = generateSequence(File("").absoluteFile) { it.parentFile }.first { File(it, "app/build.gradle.kts").isFile || File(it, "build.gradle.kts").isFile && it.name == "app" }
        val app = if (module.name == "app") module else File(module, "app")
        val gradle = File(app, "build.gradle.kts").readText()
        assertFalse(Regex("buildConfigField\\([^)]*(PILOT|TOKEN|ANTHROPIC|API_KEY)", RegexOption.IGNORE_CASE).containsMatchIn(gradle))
        val shipped = File(app, "src/main").walkTopDown().filter { it.isFile && (it.extension in setOf("kt", "xml", "json", "properties")) }
        for (file in shipped) {
            val content = file.readText()
            assertFalse("${file.name} names a provider key", Regex("sk-ant-|ANTHROPIC_API_KEY").containsMatchIn(content))
            assertFalse("${file.name} carries the fixture token", content.contains(token))
        }
    }
}
