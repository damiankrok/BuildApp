package com.buildplan.preview.analyzer

import kotlinx.serialization.Serializable
import java.io.File

/**
 * SHAPE-LIVE-01: what the analyzer is looking at while it works (`source` events, capability `source.v1`,
 * `packages/analysis-service/src/live.ts`): the step, the sheet it is reading — named by the SHA-256 of the exact
 * bytes the run read and the job-private copy of them — and the marks it made on it, each with its state.
 *
 * The phone shows what the analyzer said and derives nothing; a step that reads no picture keeps the last sheet on
 * screen, marked as the last one.
 */
@Serializable
data class LiveSourceEvent(
    val seq: Long = 0,
    val step: String = "",
    val stage: String = "",
    val sheet: LiveSheet? = null,
    val keepsLastSheet: Boolean = false,
    val detail: String = "",
    val marks: List<LiveMark> = emptyList(),
    val counts: LiveCounts = LiveCounts(),
)

@Serializable
data class LiveSheet(
    val assetId: String = "",
    val url: String = "",
    val byteHash: String = "",
    val width: Int = 0,
    val height: Int = 0,
    val document: String = "",
    /** The job-relative copy of the exact bytes (`live/<sha256>`), or null when the runtime could not copy them. */
    val file: String? = null,
)

@Serializable
data class LiveMark(
    val kind: String = "",
    val status: String = "",
    val box: SourceRect? = null,
    val line: SourceRect? = null,
    val label: String = "",
    val elementId: String? = null,
) {
    companion object {
        const val CANDIDATE = "CANDIDATE"
        const val READ = "READ"
        const val ACCEPTED = "ACCEPTED"
        const val REJECTED = "REJECTED"
    }
}

@Serializable
data class LiveCounts(
    val images: Int = 0,
    val imagesRead: Int = 0,
    val imagesRefused: Int = 0,
    val ocrCandidates: Int = 0,
    val measurementsRead: Int = 0,
    val measurementsUsed: Int = 0,
    val openingsBuilt: Int? = null,
    val elementsFromReadings: Int? = null,
    val hypotheses: Int? = null,
)

/**
 * The live preview as the screen shows it: the latest step, and the sheet on screen — the step's own sheet, or the
 * last one when the step reads none (`current = false`). `sheetFile` is the absolute path of the copy, resolved
 * against the job's work folder and never outside it.
 */
data class LiveView(
    val event: LiveSourceEvent,
    val sheet: LiveSheet?,
    val sheetMarks: List<LiveMark>,
    val sheetFile: File?,
    val current: Boolean,
) {
    companion object {
        fun next(previous: LiveView?, event: LiveSourceEvent, workDir: File): LiveView {
            val sheet = event.sheet
            if (sheet == null) {
                val keep = if (event.keepsLastSheet) previous else null
                return LiveView(event, keep?.sheet, keep?.sheetMarks.orEmpty(), keep?.sheetFile, current = false)
            }
            // a step on the same sheet without marks (it has only begun) keeps what the sheet already shows
            val marks = if (event.marks.isEmpty() && previous?.sheet?.byteHash == sheet.byteHash && event.step.startsWith("READING")) previous.sheetMarks else event.marks
            return LiveView(event, sheet, marks, resolve(workDir, sheet.file), current = true)
        }

        /** Only a file inside the job's own folder, named by its hash, is ever read. */
        fun resolve(workDir: File, relative: String?): File? {
            if (relative.isNullOrBlank()) return null
            val f = File(workDir, relative).canonicalFile
            val root = workDir.canonicalFile
            return if (f.path.startsWith(root.path + File.separator)) f else null
        }
    }
}
