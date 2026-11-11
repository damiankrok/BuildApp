package com.buildplan.preview.analyzer

import java.io.IOException
import java.security.MessageDigest
import kotlinx.serialization.Serializable

/**
 * v3.53.2 — the `describing` member of a job's status: the service is reading the house as a whole from the page's
 * pictures. The phase, why it started, and the pictures actually being interpreted — for each, the ORIGINAL the page
 * published (address, SHA-256, size) and what was SENT to the reader (a smaller JPEG with its own SHA-256, size and
 * byte count). There are no marks, boxes or lines: the reader returns a description of the house, not positions on a
 * picture, and nothing here may draw any.
 */
@Serializable
data class JobDescribing(
    val phase: String = "",
    val startedAt: String? = null,
    val updatedAt: String? = null,
    val after: DescribingReason? = null,
    val provider: DescribingProvider? = null,
    val picturesOnPage: Int = 0,
    val pictures: List<DescribedPicture> = emptyList(),
)

@Serializable
data class DescribingReason(val code: String = "", val reasonCode: String? = null)

@Serializable
data class DescribingProvider(val id: String = "", val model: String = "", val triageModel: String = "")

@Serializable
data class DescribedPicture(
    val number: Int = 0,
    val kind: String = "",
    val assetId: String = "",
    val original: PictureOriginal = PictureOriginal(),
    val sent: PictureSent = PictureSent(),
)

/** The picture as the page published it. `sha256` is of its exact bytes; null when the service did not have it. */
@Serializable
data class PictureOriginal(val url: String? = null, val sha256: String? = null, val widthPx: Int = 0, val heightPx: Int = 0)

/** What the reader was sent: a re-encoded, smaller copy. Its hash is NOT the original's and is never compared with it. */
@Serializable
data class PictureSent(val sha256: String = "", val mediaType: String = "", val widthPx: Int = 0, val heightPx: Int = 0, val bytes: Long = 0)

/** The words of the describing phase, in the owner's language. Codes this build does not know are said as codes. */
object DescribingWords {
    const val SORTING = "SORTING_PICTURES"
    const val DESCRIBING = "DESCRIBING_HOUSE"
    const val BUILDING = "BUILDING_MODEL"

    fun phase(describing: JobDescribing): String = when (describing.phase) {
        SORTING -> if (describing.picturesOnPage > 0) "Sortuję ${describing.picturesOnPage} obrazów strony: rzuty, elewacje, przekroje, widoki." else "Sortuję obrazy strony."
        DESCRIBING -> "Czytam dom z ${describing.pictures.size} ${plural(describing.pictures.size)} — to jedno dłuższe pytanie, bez postępu w środku."
        BUILDING -> "Buduję model z opisu domu."
        else -> "Czytam dom z obrazów strony (${describing.phase})."
    }

    /** Why the reading started: the drawings' refusal, or what made their model weak. */
    fun reason(after: DescribingReason?): String? {
        if (after == null) return null
        return when (after.code) {
            "NO_DRAWINGS" -> "Na stronie nie ma rysunków, z których dałoby się zmierzyć dom."
            "SOURCE_INCOMPLETE" -> "Rysunki strony nie wystarczają do zmierzenia domu."
            "RECONSTRUCTION_FAILED" -> "Rysunków nie udało się odczytać w model."
            "DRAWINGS_MODEL_UNANCHORED" -> "Model z rysunków nie ma ani sprawdzonej skali, ani zmierzonej wysokości."
            "DRAWINGS_MODEL_WEAK" -> "Model z rysunków jest niepełny: ${weaknesses(after.reasonCode)}."
            else -> "Powód: ${after.code}."
        }
    }

    private fun weaknesses(reasonCode: String?): String =
        reasonCode.orEmpty().split('+').filter { it.isNotBlank() }.joinToString(", ") {
            when (it) {
                "NO_METRIC_ANCHOR" -> "brak kotwicy wymiarowej"
                "PARTIAL_MODEL" -> "zbudowana tylko część"
                "BODY_MISSING" -> "brakuje bryły"
                "NO_ROOF_BUILT" -> "brak dachu"
                else -> it
            }
        }.ifEmpty { "brak szczegółów" }

    fun kind(kind: String): String = when (kind) {
        "FLOOR_PLAN" -> "rzut"
        "ELEVATION" -> "elewacja"
        "SECTION" -> "przekrój"
        "SITE_PLAN" -> "plan sytuacyjny"
        "EXTERIOR_VIEW" -> "widok z zewnątrz"
        else -> "obraz"
    }

    private fun plural(n: Int): String = if (n == 1) "obrazu" else "obrazów"
}

/** What became of fetching a described picture's original for display. */
sealed interface PictureFetch {
    /** The bytes the phone downloaded hash to the SHA-256 the service named for the original: they may be shown. */
    class Verified(val bytes: ByteArray) : PictureFetch

    /** Downloaded, but these are not the bytes the service read: never shown as the picture that was interpreted. */
    data object HashMismatch : PictureFetch

    /** The service named no address or no hash for the original: there is nothing the phone could verify. */
    data object NotVerifiable : PictureFetch

    data class Unavailable(val reason: String) : PictureFetch
}

/**
 * Fetches the ORIGINAL of a described picture from the address the page published it at, and shows it only when its
 * SHA-256 is the one the service named. https only, no credentials, a byte cap; the pilot token is never sent here —
 * this is the publisher's server, not the service.
 */
class DescribedPictureLoader(private val transport: HttpTransport, private val maxBytes: Long = MAX_BYTES) {
    fun fetch(picture: DescribedPicture): PictureFetch {
        val url = picture.original.url
        val expected = picture.original.sha256?.trim()?.lowercase()
        if (url.isNullOrBlank() || expected.isNullOrBlank() || !SHA256.matches(expected)) return PictureFetch.NotVerifiable
        if (ProjectLinks.problem(url) != null) return PictureFetch.Unavailable("adres obrazu nie jest zwykłym adresem https")
        val response = try {
            transport.get(url, maxBytes)
        } catch (e: ResponseTooLargeException) {
            return PictureFetch.Unavailable("obraz jest większy niż ${maxBytes / (1024 * 1024)} MB")
        } catch (e: IOException) {
            return PictureFetch.Unavailable("nie udało się pobrać obrazu")
        }
        if (response.status != 200) return PictureFetch.Unavailable("strona odpowiedziała ${response.status}")
        return if (sha256Hex(response.body) == expected) PictureFetch.Verified(response.body) else PictureFetch.HashMismatch
    }

    companion object {
        const val MAX_BYTES: Long = 12L * 1024 * 1024
        private val SHA256 = Regex("^[0-9a-f]{64}$")

        fun sha256Hex(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }
    }
}
