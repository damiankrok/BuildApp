package com.buildplan.preview

import com.buildplan.preview.AnalyzerFixtures.BASE
import com.buildplan.preview.AnalyzerFixtures.JOB
import com.buildplan.preview.AnalyzerFixtures.LINK
import com.buildplan.preview.FakeTransport.Companion.bytes
import com.buildplan.preview.FakeTransport.Companion.fails
import com.buildplan.preview.FakeTransport.Companion.json
import com.buildplan.preview.FakeTransport.Companion.refusal
import com.buildplan.preview.analyzer.AnalyzerAddress
import com.buildplan.preview.analyzer.AnalyzerClient
import com.buildplan.preview.analyzer.AnalyzerFailure
import com.buildplan.preview.analyzer.AnalyzerMessages
import com.buildplan.preview.analyzer.HttpUrlConnectionTransport
import com.buildplan.preview.analyzer.JobIds
import com.buildplan.preview.analyzer.Outcome
import com.buildplan.preview.analyzer.ProjectLinks
import com.buildplan.preview.analyzer.ResponseTooLargeException
import java.io.InputStream
import java.net.UnknownHostException
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

/**
 * The analyzer client: where it is allowed to send requests, what it puts in
 * them, and how every refusal of the contract becomes a failure a person can
 * read.
 */
class AnalyzerClientTest {

    private fun <T> ok(outcome: Outcome<T>): T = (outcome as? Outcome.Ok<T>)?.value ?: error("expected Ok, got $outcome")
    private fun err(outcome: Outcome<*>): AnalyzerFailure = (outcome as? Outcome.Err)?.failure ?: error("expected Err, got $outcome")

    // -----------------------------------------------------------------------
    // The service address
    // -----------------------------------------------------------------------

    @Test
    fun `an https service address is accepted and its trailing slash dropped`() {
        assertEquals("https://analyzer.example.com", AnalyzerAddress.normalize("https://analyzer.example.com/"))
        assertEquals("https://analyzer.example.com", AnalyzerAddress.normalize("  HTTPS://Analyzer.Example.com  "))
        assertEquals("https://example.com/api", AnalyzerAddress.normalize("https://example.com/api///"))
        assertEquals("https://example.com:8443", AnalyzerAddress.normalize("https://example.com:8443"))
    }

    @Test
    fun `anything but https is refused as a service address`() {
        for (bad in listOf(
            "http://analyzer.example.com",
            "file:///data/data/com.buildplan.preview/files",
            "ftp://analyzer.example.com",
            "javascript:alert(1)",
            "content://com.example/x",
            "analyzer.example.com",
            "//analyzer.example.com",
            "https://",
            "https:///path-only",
            "https://exa mple.com",
        )) {
            assertTrue("$bad must be refused", AnalyzerAddress.check(bad) is AnalyzerAddress.Check.Invalid)
            assertNull(bad, AnalyzerAddress.normalize(bad))
        }
    }

    @Test
    fun `a service address carrying credentials, a query or a fragment is refused`() {
        for (bad in listOf(
            "https://user:secret@analyzer.example.com",
            "https://user@analyzer.example.com",
            "https://analyzer.example.com/?key=abc",
            "https://analyzer.example.com/#x",
        )) {
            assertTrue("$bad must be refused", AnalyzerAddress.check(bad) is AnalyzerAddress.Check.Invalid)
        }
    }

    @Test
    fun `an empty address means not configured, and a client without one sends nothing`() {
        assertEquals(AnalyzerAddress.Check.Empty, AnalyzerAddress.check(""))
        assertEquals(AnalyzerAddress.Check.Empty, AnalyzerAddress.check("   "))
        assertEquals(AnalyzerAddress.Check.Empty, AnalyzerAddress.check(null))
        val transport = FakeTransport()
        for (base in listOf("", "http://analyzer.example.com", "file:///x")) {
            val client = AnalyzerClient(base, transport)
            assertNull(client.baseUrl)
            assertEquals(AnalyzerFailure.NotConfigured, err(client.submit(LINK)))
            assertEquals(AnalyzerFailure.NotConfigured, err(client.status(JOB)))
        }
        assertTrue("no request may leave an unconfigured client", transport.requests.isEmpty())
    }

    // -----------------------------------------------------------------------
    // Job ids and links
    // -----------------------------------------------------------------------

    @Test
    fun `only 32 lowercase hex characters are a job id`() {
        assertTrue(JobIds.isValid(JOB))
        for (bad in listOf(
            null, "", "3f9c", JOB.uppercase(), JOB + "0", JOB.dropLast(1), "../../etc/passwd",
            "0123456789abcdef0123456789abcde/", "0123456789abcdef0123456789abcdeg", "$JOB\n",
        )) {
            assertTrue("$bad must be refused", !JobIds.isValid(bad))
        }
    }

    @Test
    fun `a malformed job id never becomes a request path`() {
        val transport = FakeTransport()
        val client = AnalyzerClient(BASE, transport)
        for (bad in listOf("../result", "abc", "$JOB/../../x", JOB.uppercase())) {
            assertTrue(err(client.status(bad)) is AnalyzerFailure.BadResponse)
            assertTrue(err(client.result(bad)) is AnalyzerFailure.BadResponse)
            assertTrue(err(client.downloadScene(bad, 1024)) is AnalyzerFailure.BadResponse)
            assertTrue(err(client.cancel(bad)) is AnalyzerFailure.BadResponse)
        }
        assertTrue(transport.requests.isEmpty())
    }

    @Test
    fun `a service that answers with a malformed job id is not followed`() {
        val transport = FakeTransport()
        transport.on("POST", "$BASE/v1/analyses", json(202, """{"jobId":"../../admin","status":"QUEUED"}"""))
        val failure = err(AnalyzerClient(BASE, transport).submit(LINK))
        assertTrue(failure is AnalyzerFailure.BadResponse)
    }

    @Test
    fun `the link is checked on the phone before anything is sent`() {
        assertNull(ProjectLinks.problem(LINK))
        assertNotNull(ProjectLinks.problem(""))
        assertNotNull(ProjectLinks.problem("http://www.archon.pl/projekty-domow/x"))
        assertNotNull(ProjectLinks.problem("file:///sdcard/x.html"))
        assertNotNull(ProjectLinks.problem("https://user:pw@www.archon.pl/x"))
        assertNotNull(ProjectLinks.problem("www.archon.pl/x"))
        assertNotNull(ProjectLinks.problem("https://" + "a".repeat(2050) + ".pl"))
        val transport = FakeTransport()
        val failure = err(AnalyzerClient(BASE, transport).submit("http://www.archon.pl/x"))
        assertTrue(failure is AnalyzerFailure.InvalidUrl)
        assertTrue(transport.requests.isEmpty())
    }

    // -----------------------------------------------------------------------
    // Requests
    // -----------------------------------------------------------------------

    @Test
    fun `submit posts the link as JSON to the analyses endpoint`() {
        val transport = FakeTransport()
        transport.on("POST", "$BASE/v1/analyses", json(202, AnalyzerFixtures.submitted(), mapOf("Location" to "/v1/analyses/$JOB")))
        val submitted = ok(AnalyzerClient("$BASE/", transport).submit(LINK))
        assertEquals(JOB, submitted.jobId)
        assertEquals("QUEUED", submitted.status)
        val request = transport.requests.single()
        assertEquals("application/json", request.contentType)
        assertEquals("""{"url":"$LINK"}""", request.body)
        assertTrue("a request body must stay under the service's 4 KiB limit", request.body!!.length < 4096)
    }

    @Test
    fun `status, result, scene and cancel use the contract's paths`() {
        val transport = FakeTransport()
        transport.on("GET", "$BASE/v1/analyses/$JOB", json(200, AnalyzerFixtures.status("QUEUED", 0.0)))
        transport.on("GET", "$BASE/v1/analyses/$JOB/result", json(200, AnalyzerFixtures.summary()))
        transport.on(
            "GET", "$BASE/v1/analyses/$JOB/scene",
            bytes(200, AnalyzerFixtures.sceneBytes, mapOf("X-Content-SHA256" to AnalyzerFixtures.sceneSha256.uppercase(), "ETag" to "\"x\"")),
        )
        transport.on("DELETE", "$BASE/v1/analyses/$JOB", json(202, """{"jobId":"$JOB","status":"CANCELLED"}"""))
        val client = AnalyzerClient(BASE, transport)
        assertEquals("QUEUED", ok(client.status(JOB)).status)
        assertEquals(AnalyzerFixtures.sceneSha256, ok(client.result(JOB)).sceneSha256)
        val scene = ok(client.downloadScene(JOB, 64L * 1024 * 1024))
        assertTrue(scene.bytes.contentEquals(AnalyzerFixtures.sceneBytes))
        // The header is read case-insensitively and normalized to lowercase hex.
        assertEquals(AnalyzerFixtures.sceneSha256, scene.headerSha256)
        assertEquals("CANCELLED", ok(client.cancel(JOB)).status)
        assertEquals(64L * 1024 * 1024, transport.requests.first { it.url.endsWith("/scene") }.maxBytes)
    }

    // -----------------------------------------------------------------------
    // Refusals
    // -----------------------------------------------------------------------

    @Test
    fun `every refusal in the contract maps to its failure`() {
        val transport = FakeTransport()
        val client = AnalyzerClient(BASE, transport)
        val url = "$BASE/v1/analyses"

        transport.on("POST", url, refusal(400, "INVALID_URL", "only https addresses are fetched"))
        assertEquals(AnalyzerFailure.InvalidUrl("only https addresses are fetched"), err(client.submit(LINK)))

        transport.on("POST", url, refusal(422, "UNSUPPORTED_PUBLISHER", "no registered publisher understands this host"))
        assertEquals(AnalyzerFailure.UnsupportedPublisher("no registered publisher understands this host"), err(client.submit(LINK)))

        transport.on("POST", url, refusal(429, "RATE_LIMITED", "too many analyses", mapOf("Retry-After" to "120")))
        assertEquals(AnalyzerFailure.RateLimited(120), err(client.submit(LINK)))

        transport.on("POST", url, refusal(503, "QUEUE_FULL", "the queue is full", mapOf("retry-after" to "30")))
        assertEquals(AnalyzerFailure.QueueFull(30), err(client.submit(LINK)))

        transport.on("POST", url, refusal(415, "UNSUPPORTED_MEDIA_TYPE", "not application/json"))
        assertEquals(AnalyzerFailure.Http(415, "UNSUPPORTED_MEDIA_TYPE", "not application/json"), err(client.submit(LINK)))

        transport.on("GET", "$url/$JOB", refusal(404, "NOT_FOUND", "no such analysis"))
        assertEquals(AnalyzerFailure.Http(404, "NOT_FOUND", "no such analysis"), err(client.status(JOB)))

        transport.on("GET", "$url/$JOB/result", refusal(409, "NOT_READY", "the analysis is still running"))
        assertEquals(409, (err(client.result(JOB)) as AnalyzerFailure.Http).status)

        transport.on("DELETE", "$url/$JOB", refusal(409, "ALREADY_FINISHED", "the analysis has finished"))
        assertEquals("ALREADY_FINISHED", (err(client.cancel(JOB)) as AnalyzerFailure.Http).code)
    }

    @Test
    fun `a 429 with no envelope and an unreadable error body still map sensibly`() {
        val transport = FakeTransport()
        val client = AnalyzerClient(BASE, transport)
        transport.on("GET", "$BASE/v1/analyses/$JOB", bytes(429, "slow down".encodeToByteArray(), mapOf("Retry-After" to "7")))
        assertEquals(AnalyzerFailure.RateLimited(7), err(client.status(JOB)))
        transport.on("GET", "$BASE/v1/analyses/$JOB", bytes(502, "<html>Bad gateway</html>".encodeToByteArray()))
        val failure = err(client.status(JOB))
        assertEquals(AnalyzerFailure.Http(502, null, null), failure)
        assertTrue("a gateway error is worth retrying", failure.isTransient)
    }

    @Test
    fun `a lost connection is Offline, and a malformed answer is BadResponse`() {
        val transport = FakeTransport()
        val client = AnalyzerClient(BASE, transport)
        transport.on("GET", "$BASE/v1/analyses/$JOB", fails(UnknownHostException("analyzer.example.test")))
        val offline = err(client.status(JOB))
        assertTrue(offline is AnalyzerFailure.Offline)
        assertTrue(offline.isTransient)
        assertTrue("the host name is not repeated to the user", "analyzer.example.test" !in AnalyzerMessages.describe(offline))

        transport.on("GET", "$BASE/v1/analyses/$JOB", json(200, "{ not json"))
        assertTrue(err(client.status(JOB)) is AnalyzerFailure.BadResponse)
    }

    @Test
    fun `a scene larger than the cap is TooLarge and never held`() {
        val transport = FakeTransport()
        transport.on("GET", "$BASE/v1/analyses/$JOB/scene", bytes(200, ByteArray(2048)))
        assertEquals(AnalyzerFailure.TooLarge(1024), err(AnalyzerClient(BASE, transport).downloadScene(JOB, 1024)))
    }

    @Test
    fun `an oversized status answer is a malformed answer, not an oversized model`() {
        val transport = FakeTransport()
        transport.on("GET", "$BASE/v1/analyses/$JOB", bytes(200, ByteArray((AnalyzerClient.JSON_LIMIT + 1).toInt())))
        assertTrue(err(AnalyzerClient(BASE, transport).status(JOB)) is AnalyzerFailure.BadResponse)
    }

    @Test
    fun `the real transport stops reading at the cap however much the other end sends`() {
        var served = 0L
        val endless = object : InputStream() {
            override fun read(): Int = 0.also { served++ }
            override fun read(b: ByteArray, off: Int, len: Int): Int {
                served += len
                return len
            }
        }
        try {
            HttpUrlConnectionTransport.readCapped(endless, 1_000_000)
            fail("an endless body must be refused")
        } catch (e: ResponseTooLargeException) {
            assertEquals(1_000_000, e.limitBytes)
        }
        assertTrue("reading stopped within one buffer of the cap (read $served)", served <= 1_000_000 + 64 * 1024)
        val small = HttpUrlConnectionTransport.readCapped("hello".byteInputStream(), 5)
        assertEquals("hello", small.decodeToString())
    }

    @Test
    fun `the real transport refuses anything but https and keeps the contract's timeouts`() {
        assertEquals(15_000, HttpUrlConnectionTransport.CONNECT_TIMEOUT_MS)
        assertEquals(30_000, HttpUrlConnectionTransport.READ_TIMEOUT_MS)
        try {
            HttpUrlConnectionTransport().get("http://analyzer.example.test/health", 1024)
            fail("http must be refused before any connection is made")
        } catch (e: IllegalArgumentException) {
            // expected
        }
    }

    @Test
    fun `every failure reads as a sentence`() {
        val failures = listOf(
            AnalyzerFailure.Offline("the connection was refused"),
            AnalyzerFailure.Http(500, "INTERNAL", "Something went wrong."),
            AnalyzerFailure.RateLimited(90),
            AnalyzerFailure.QueueFull(null),
            AnalyzerFailure.InvalidUrl("only https addresses are fetched"),
            AnalyzerFailure.UnsupportedPublisher("no registered publisher understands this host"),
            AnalyzerFailure.JobFailed("NO_DRAWINGS", "the page exposes no drawing this analyzer reads"),
            AnalyzerFailure.HashMismatch("scene sha256", "a", "b"),
            AnalyzerFailure.TooLarge(64L * 1024 * 1024),
            AnalyzerFailure.InvalidScene("unknown scene schema"),
            AnalyzerFailure.BadResponse("x"),
            AnalyzerFailure.StorageFailed("disk full"),
            AnalyzerFailure.NotConfigured,
        )
        for (f in failures) {
            val text = AnalyzerMessages.describe(f)
            assertTrue("$f: \"$text\"", text.isNotBlank() && text.first().isUpperCase())
            assertTrue("$f must not dump JSON: $text", '{' !in text)
        }
        assertTrue(AnalyzerMessages.describe(AnalyzerFailure.RateLimited(90)).contains("2 minutes"))
        assertTrue(AnalyzerMessages.describe(AnalyzerFailure.JobFailed("NO_DRAWINGS", "none")).contains("NO_DRAWINGS"))
        assertEquals("No analyzer service is configured in this build.", AnalyzerMessages.describe(AnalyzerFailure.NotConfigured))
    }
}
