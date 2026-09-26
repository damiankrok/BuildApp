package com.buildplan.preview.analyzer

import java.io.ByteArrayOutputStream
import java.io.IOException
import java.io.InputStream
import java.net.HttpURLConnection
import java.net.URL

/** One HTTP answer: status, headers and at most the byte cap the caller asked for. */
class HttpResponse(
    val status: Int,
    headers: Map<String, List<String>>,
    val body: ByteArray,
) {
    private val headers: Map<String, List<String>> = headers.mapKeys { it.key.lowercase() }

    /** A header's first value, looked up without regard to case. */
    fun header(name: String): String? = headers[name.lowercase()]?.firstOrNull()

    fun bodyText(): String = body.decodeToString()
}

/** The body is longer than the caller agreed to hold. Nothing beyond the cap was kept. */
class ResponseTooLargeException(val limitBytes: Long) : IOException("response body exceeds $limitBytes bytes")

/**
 * The only way the analyzer client reaches the network.
 *
 * Small on purpose: tests replace it with a scripted fake, and the app uses
 * [HttpUrlConnectionTransport]. A network failure is an [IOException]; a body
 * longer than `maxBytes` is a [ResponseTooLargeException]; any HTTP status,
 * error or not, is a normal [HttpResponse].
 */
interface HttpTransport {
    fun get(url: String, maxBytes: Long): HttpResponse
    fun post(url: String, body: ByteArray, contentType: String, maxBytes: Long): HttpResponse
    fun delete(url: String, maxBytes: Long): HttpResponse
}

/**
 * [HttpTransport] on the platform's `HttpURLConnection`.
 *
 * HTTPS only, no redirects followed (the API never redirects, and a redirect
 * is not a place this client agreed to talk to), no cache, and no cookies:
 * this app never installs a `CookieHandler`, so the connection neither sends
 * nor stores one. Nothing here carries a credential; the API has none.
 */
class HttpUrlConnectionTransport(
    private val connectTimeoutMs: Int = CONNECT_TIMEOUT_MS,
    private val readTimeoutMs: Int = READ_TIMEOUT_MS,
) : HttpTransport {

    override fun get(url: String, maxBytes: Long): HttpResponse = execute("GET", url, null, null, maxBytes)

    override fun post(url: String, body: ByteArray, contentType: String, maxBytes: Long): HttpResponse =
        execute("POST", url, body, contentType, maxBytes)

    override fun delete(url: String, maxBytes: Long): HttpResponse = execute("DELETE", url, null, null, maxBytes)

    private fun execute(method: String, url: String, body: ByteArray?, contentType: String?, maxBytes: Long): HttpResponse {
        val target = URL(url)
        require(target.protocol.equals("https", ignoreCase = true)) { "the analyzer is only reached over https" }
        val connection = target.openConnection() as HttpURLConnection
        try {
            connection.requestMethod = method
            connection.connectTimeout = connectTimeoutMs
            connection.readTimeout = readTimeoutMs
            connection.instanceFollowRedirects = false
            connection.useCaches = false
            connection.setRequestProperty("Accept", "application/json")
            if (body != null) {
                connection.doOutput = true
                connection.setRequestProperty("Content-Type", contentType ?: "application/json")
                connection.setFixedLengthStreamingMode(body.size)
                connection.outputStream.use { it.write(body) }
            }
            val status = connection.responseCode
            val headers = connection.headerFields.filterKeys { it != null }.mapKeys { it.key!! }
            val declared = connection.contentLengthLong
            if (declared > maxBytes) throw ResponseTooLargeException(maxBytes)
            val stream = if (status >= 400) connection.errorStream else connection.inputStream
            val bytes = stream?.use { readCapped(it, maxBytes) } ?: ByteArray(0)
            return HttpResponse(status, headers, bytes)
        } finally {
            connection.disconnect()
        }
    }

    companion object {
        const val CONNECT_TIMEOUT_MS = 15_000
        const val READ_TIMEOUT_MS = 30_000

        /**
         * Read a whole stream, refusing it the moment it passes `maxBytes`.
         *
         * Never holds more than the cap plus one buffer, whatever the other
         * end claims or sends.
         */
        fun readCapped(input: InputStream, maxBytes: Long): ByteArray {
            val out = ByteArrayOutputStream()
            val buffer = ByteArray(64 * 1024)
            var total = 0L
            while (true) {
                val n = input.read(buffer)
                if (n < 0) break
                total += n
                if (total > maxBytes) throw ResponseTooLargeException(maxBytes)
                out.write(buffer, 0, n)
            }
            return out.toByteArray()
        }
    }
}
