package com.buildplan.preview.analyzer

import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.URI
import java.net.UnknownHostException
import javax.net.ssl.SSLException
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject

/** A result the analyzer client hands back: the value, or why there is none. */
sealed interface Outcome<out T> {
    data class Ok<out T>(val value: T) : Outcome<T>
    data class Err(val failure: AnalyzerFailure) : Outcome<Nothing>
}

/** The exact bytes of `/scene`, plus the `X-Content-SHA256` header when the service sent one. */
class SceneDownload(val bytes: ByteArray, val headerSha256: String?)

/**
 * Checking an analyzer service address before anything is sent to it.
 *
 * `https` only — never `http`, `file` or anything else — with a host, no
 * user name or password, no query and no fragment. A trailing slash is
 * dropped so paths join cleanly. This is the address of the SERVICE; the
 * project link a person pastes is checked by [ProjectLinks].
 */
object AnalyzerAddress {
    sealed interface Check {
        data class Valid(val baseUrl: String) : Check
        data object Empty : Check
        data class Invalid(val reason: String) : Check
    }

    fun check(raw: String?): Check {
        val text = raw?.trim().orEmpty()
        if (text.isEmpty()) return Check.Empty
        if (text.any { it.isWhitespace() || it.isISOControl() }) return Check.Invalid("adres zawiera spacje lub znaki sterujące")
        val uri = try {
            URI(text)
        } catch (e: Exception) {
            return Check.Invalid("to nie jest poprawny adres")
        }
        if (!uri.isAbsolute) return Check.Invalid("adres musi zaczynać się od https://")
        if (!uri.scheme.equals("https", ignoreCase = true)) return Check.Invalid("dozwolone są tylko adresy https")
        if (uri.rawUserInfo != null) return Check.Invalid("adres nie może zawierać nazwy użytkownika ani hasła")
        val host = uri.host
        if (host.isNullOrEmpty()) return Check.Invalid("w adresie brakuje nazwy serwera")
        if (uri.rawQuery != null || uri.rawFragment != null) return Check.Invalid("adres nie może mieć parametrów ani kotwicy")
        val path = (uri.rawPath ?: "").trimEnd('/')
        val port = if (uri.port == -1) "" else ":${uri.port}"
        return Check.Valid("https://${host.lowercase()}$port$path")
    }

    /** The normalized base URL, or null for an empty or refused address. */
    fun normalize(raw: String?): String? = (check(raw) as? Check.Valid)?.baseUrl
}

/** Job ids are 32 lowercase hex characters; nothing else is ever put into a request path. */
object JobIds {
    private val PATTERN = Regex("^[0-9a-f]{32}$")
    fun isValid(id: String?): Boolean = id != null && PATTERN.matches(id)
}

/**
 * The client-side check of a project link before it is submitted: an
 * absolute https URL with a host and no credentials, at most 2048
 * characters. The service applies the full policy (no ports, no address
 * literals, no local names, a registered publisher); this only catches what
 * is obviously not a web page before the phone spends a request on it.
 */
object ProjectLinks {
    const val MAX_LENGTH = 2048

    /** Null when the link may be submitted, else the reason it may not. */
    fun problem(raw: String): String? {
        val text = raw.trim()
        if (text.isEmpty()) return "Wklej link do strony projektu."
        if (text.length > MAX_LENGTH) return "Ten link ma więcej niż $MAX_LENGTH znaków."
        if (text.any { it.isWhitespace() || it.isISOControl() }) return "Ten link zawiera spacje."
        val uri = try {
            URI(text)
        } catch (e: Exception) {
            return "To nie jest poprawny adres strony."
        }
        if (!uri.scheme.equals("https", ignoreCase = true)) return "Analizować można tylko linki https://."
        if (uri.rawUserInfo != null) return "Nie można analizować linku z nazwą użytkownika lub hasłem."
        if (uri.host.isNullOrEmpty()) return "W tym linku brakuje nazwy strony."
        return null
    }
}

/**
 * The analyzer HTTP API, `buildapp.analyzer-api` v1.
 *
 * Holds an address and nothing else: no key, no token, no cookie. Every call
 * returns an [Outcome]; nothing here throws for a network or HTTP problem.
 * A job id is checked against [JobIds] before it goes anywhere near a path,
 * so a malformed id never becomes a request.
 */
class AnalyzerClient(baseUrl: String, private val transport: HttpTransport) {

    /** The validated base URL, or null when this client is not configured. */
    val baseUrl: String? = AnalyzerAddress.normalize(baseUrl)

    fun submit(url: String): Outcome<SubmitResponse> {
        val base = baseUrl ?: return Outcome.Err(AnalyzerFailure.NotConfigured)
        ProjectLinks.problem(url)?.let { return Outcome.Err(AnalyzerFailure.InvalidUrl(it.trimEnd('.'))) }
        val body = buildJsonObject { put("url", JsonPrimitive(url.trim())) }.toString().encodeToByteArray()
        return call(setOf(200, 201, 202), { transport.post("$base/v1/analyses", body, "application/json", JSON_LIMIT) }) { response ->
            val decoded = AnalyzerJson.decodeFromString(SubmitResponse.serializer(), response.bodyText())
            if (!JobIds.isValid(decoded.jobId)) throw BadAnswer("the service returned a malformed job id")
            decoded
        }
    }

    fun status(jobId: String): Outcome<JobStatus> = withJob(jobId) { base ->
        call(setOf(200), { transport.get("$base/v1/analyses/$jobId", JSON_LIMIT) }) { response ->
            val decoded = AnalyzerJson.decodeFromString(JobStatus.serializer(), response.bodyText())
            if (decoded.status.isBlank()) throw BadAnswer("the status record has no status")
            decoded
        }
    }

    fun result(jobId: String): Outcome<AnalysisSummary> = withJob(jobId) { base ->
        call(setOf(200), { transport.get("$base/v1/analyses/$jobId/result", JSON_LIMIT) }) { response ->
            AnalyzerJson.decodeFromString(AnalysisSummary.serializer(), response.bodyText())
        }
    }

    /**
     * The exact scene bytes, never more than `maxBytes` of them. The bytes are
     * NOT checked here: the caller compares them with the summary's hashes
     * before keeping anything.
     */
    fun downloadScene(jobId: String, maxBytes: Long): Outcome<SceneDownload> = withJob(jobId) { base ->
        call(setOf(200), { transport.get("$base/v1/analyses/$jobId/scene", maxBytes) }, isScene = true) { response ->
            if (response.body.size > maxBytes) throw ResponseTooLargeException(maxBytes)
            SceneDownload(response.body, response.header("X-Content-SHA256")?.trim()?.trim('"')?.lowercase()?.ifEmpty { null })
        }
    }

    fun cancel(jobId: String): Outcome<CancelResponse> = withJob(jobId) { base ->
        call(setOf(200, 202), { transport.delete("$base/v1/analyses/$jobId", JSON_LIMIT) }) { response ->
            if (response.body.isEmpty()) CancelResponse(jobId, AnalysisStages.CANCELLED)
            else AnalyzerJson.decodeFromString(CancelResponse.serializer(), response.bodyText())
        }
    }

    private inline fun <T> withJob(jobId: String, block: (base: String) -> Outcome<T>): Outcome<T> {
        val base = baseUrl ?: return Outcome.Err(AnalyzerFailure.NotConfigured)
        if (!JobIds.isValid(jobId)) return Outcome.Err(AnalyzerFailure.BadResponse("\"${jobId.take(40)}\" is not a job id"))
        return block(base)
    }

    private class BadAnswer(message: String) : Exception(message)

    private fun tooLarge(isScene: Boolean, limit: Long): AnalyzerFailure =
        if (isScene) AnalyzerFailure.TooLarge(limit)
        else AnalyzerFailure.BadResponse("the answer is larger than ${limit / (1024 * 1024)} MB")

    /**
     * One request. A body over the cap is [AnalyzerFailure.TooLarge] for the
     * scene, and a malformed answer for anything else: a status record or a
     * summary that size is not the contract, whatever it is.
     */
    private inline fun <T> call(
        ok: Set<Int>,
        request: () -> HttpResponse,
        isScene: Boolean = false,
        decode: (HttpResponse) -> T,
    ): Outcome<T> {
        val response = try {
            request()
        } catch (e: ResponseTooLargeException) {
            return Outcome.Err(tooLarge(isScene, e.limitBytes))
        } catch (e: IOException) {
            return Outcome.Err(AnalyzerFailure.Offline(describe(e)))
        }
        if (response.status !in ok) return Outcome.Err(failureOf(response))
        return try {
            Outcome.Ok(decode(response))
        } catch (e: ResponseTooLargeException) {
            Outcome.Err(tooLarge(isScene, e.limitBytes))
        } catch (e: BadAnswer) {
            Outcome.Err(AnalyzerFailure.BadResponse(e.message ?: "unexpected answer"))
        } catch (e: Exception) {
            Outcome.Err(AnalyzerFailure.BadResponse("the answer is not the JSON the contract describes"))
        }
    }

    companion object {
        /** Cap on any JSON answer (status, summary, refusal). The scene has its own cap. */
        const val JSON_LIMIT: Long = 4L * 1024 * 1024

        private const val MAX_MESSAGE = 400

        /** Map an HTTP refusal to a failure, reading the `{error:{code,message}}` envelope when there is one. */
        fun failureOf(response: HttpResponse): AnalyzerFailure {
            val error = try {
                AnalyzerJson.decodeFromString(ErrorEnvelope.serializer(), response.bodyText()).error
            } catch (e: Exception) {
                null
            }
            val code = error?.code?.takeIf { it.isNotBlank() }
            val message = error?.message?.takeIf { it.isNotBlank() }?.let(::clean)
            val retryAfter = response.header("Retry-After")?.trim()?.toLongOrNull()?.takeIf { it >= 0 }
            return when {
                code == "INVALID_URL" -> AnalyzerFailure.InvalidUrl(message ?: "the service refused the address")
                code == "UNSUPPORTED_PUBLISHER" -> AnalyzerFailure.UnsupportedPublisher(message ?: "")
                code == "RATE_LIMITED" || (code == null && response.status == 429) -> AnalyzerFailure.RateLimited(retryAfter)
                code == "QUEUE_FULL" -> AnalyzerFailure.QueueFull(retryAfter)
                else -> AnalyzerFailure.Http(response.status, code, message)
            }
        }

        /** A server sentence, shortened and stripped of control characters before it reaches the screen. */
        private fun clean(text: String): String {
            val flat = text.filter { !it.isISOControl() }.trim()
            return if (flat.length <= MAX_MESSAGE) flat else flat.take(MAX_MESSAGE - 1) + "…"
        }

        fun describe(e: IOException): String = when (e) {
            is UnknownHostException -> "the service's address could not be found"
            is ConnectException -> "the connection was refused"
            is SocketTimeoutException -> "the service did not answer in time"
            is SSLException -> "the secure connection could not be established"
            else -> "the connection failed"
        }
    }
}
