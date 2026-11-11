package com.buildplan.preview.analyzer

/**
 * The pilot's access token (v3.53.2): what lets a submission from this phone reach the service's paid house reader.
 *
 * It is typed on the phone by its owner and kept in the app's private storage (no backup: the manifest turns backup
 * off). It is NOT in the APK — no build variable, no resource, no default — and it is not the provider's key: the
 * service holds that, and no client ever does. The token travels in exactly one place: the `Authorization` header of
 * the one request that starts an analysis, over https, to the service address the owner configured. It is never put
 * in a URL, a log line, a status poll, a scene download or a cancellation.
 */
object PilotTokens {
    const val MIN_LENGTH = 24
    const val MAX_LENGTH = 200

    /** Null when the text can be a token, else why it cannot — in the owner's language. */
    fun problem(raw: String): String? {
        val text = raw.trim()
        if (text.isEmpty()) return "Wpisz kod dostępu pilota."
        if (text.length < MIN_LENGTH) return "Kod dostępu ma co najmniej $MIN_LENGTH znaki."
        if (text.length > MAX_LENGTH) return "Kod dostępu ma najwyżej $MAX_LENGTH znaków."
        // a header value: printable ASCII with no space, so nothing can break out of the header line
        if (text.any { it.code !in 0x21..0x7E }) return "Kod dostępu nie może zawierać spacji ani znaków spoza alfabetu łacińskiego."
        return null
    }

    /** The token as stored, or null when the text is empty or cannot be one. */
    fun normalize(raw: String?): String? = raw?.trim()?.takeIf { it.isNotEmpty() && problem(it) == null }

    /** What a screen may show of a saved token: that there is one, and its last four characters. */
    fun masked(token: String): String = "••••" + token.takeLast(4)

    /** The header value for a submission, or null when there is no usable token. */
    fun authorization(token: String?): String? = normalize(token)?.let { "Bearer $it" }
}
