package com.buildplan.preview.ui

import android.graphics.BitmapFactory
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextOverflow
import com.buildplan.preview.R
import com.buildplan.preview.analyzer.LiveMark
import com.buildplan.preview.analyzer.LiveView
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.security.MessageDigest

/**
 * SHAPE-LIVE-01: the place on the running-analysis screen where the source is — there from the start, a fixed frame.
 * Before the first sheet it says what the analyzer is waiting for; while a reader works on a sheet it shows THAT
 * sheet (the job-private copy of the exact bytes the run read, shown only when their SHA-256 is the one the analyzer
 * named), its marks with their state, and what the step is; in a step that reads no picture it names the step and
 * keeps the last sheet, dimmed and marked as the last one.
 */
@Composable
internal fun LiveSourcePanel(live: LiveView?, elapsedMs: Long?) {
    Column(
        Modifier.fillMaxWidth().background(Palette.Raised, RoundedCornerShape(Radius.panel)).padding(Space.m),
        verticalArrangement = Arrangement.spacedBy(Space.xs),
    ) {
        val head = when {
            live == null -> stringResource(R.string.live_waiting)
            live.current -> stringResource(R.string.live_now, stepText(live.event.step), documentWord(live.sheet?.document))
            else -> stringResource(R.string.live_phase, stepText(live.event.step))
        }
        Text(head, style = MaterialTheme.typography.titleSmall, color = Palette.Ink, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite })
        elapsedMs?.let { StatusText(stringResource(R.string.live_elapsed, it / 1000)) }
        Box(Modifier.fillMaxWidth().aspectRatio(4f / 3f).background(Palette.Well, RoundedCornerShape(Radius.panel)), contentAlignment = Alignment.Center) {
            val sheet = live?.sheet
            if (sheet == null) {
                StatusText(stringResource(if (live == null) R.string.live_no_sheet_yet else R.string.live_no_sheet_phase), modifier = Modifier.padding(Space.m))
            } else {
                SheetWithMarks(live, sheet.byteHash, sheet.width, sheet.height, live.sheetFile)
            }
        }
        if (live != null) {
            if (!live.current && live.sheet != null) StatusText(stringResource(R.string.live_last_sheet))
            Text(live.event.detail, style = MaterialTheme.typography.bodyMedium, color = Palette.InkMuted, maxLines = 3, overflow = TextOverflow.Ellipsis)
            val m = live.sheetMarks
            if (m.isNotEmpty()) {
                StatusText(
                    stringResource(R.string.live_marks, m.count { it.status == LiveMark.CANDIDATE }, m.count { it.status == LiveMark.READ }, m.count { it.status == LiveMark.ACCEPTED }, m.count { it.status == LiveMark.REJECTED }),
                    modifier = Modifier.semantics { stateDescription = "${m.size}" },
                )
            }
            val c = live.event.counts
            StatusText(stringResource(R.string.live_counts, c.images, c.imagesRead, c.imagesRefused, c.ocrCandidates, c.measurementsRead, c.measurementsUsed))
            c.openingsBuilt?.let { StatusText(stringResource(R.string.live_openings, it)) }
            c.elementsFromReadings?.let { StatusText(stringResource(R.string.live_elements, it, c.hypotheses ?: 0)) }
            // the marks that went into an element name it; the rest say plainly that they went into none
            if (m.isNotEmpty() && live.event.step == "BUILT_FROM") {
                val linked = m.count { it.elementId != null }
                StatusText(stringResource(R.string.live_linked, linked, m.size - linked))
            }
        }
    }
}

internal sealed interface Picture {
    data object Loading : Picture
    data class Shown(val bitmap: ImageBitmap) : Picture
    data class Refused(val reason: Int) : Picture
}

@Composable
private fun SheetWithMarks(live: LiveView, byteHash: String, width: Int, height: Int, file: File?) {
    var picture by remember(byteHash) { mutableStateOf<Picture>(Picture.Loading) }
    LaunchedEffect(byteHash, file) {
        picture = withContext(Dispatchers.IO) { loadVerified(file, byteHash) }
    }
    when (val p = picture) {
        Picture.Loading -> StatusText(stringResource(R.string.live_loading_sheet))
        is Picture.Refused -> StatusText(stringResource(p.reason), modifier = Modifier.padding(Space.m))
        is Picture.Shown -> Box(Modifier.fillMaxWidth().aspectRatio(width.toFloat() / height.coerceAtLeast(1)).heightIn(max = Sizes.touch * 12)) {
            val alpha = if (live.current) 1f else 0.45f
            Image(p.bitmap, contentDescription = stringResource(R.string.live_sheet_description), modifier = Modifier.fillMaxSize(), contentScale = ContentScale.FillBounds, alpha = alpha)
            Canvas(Modifier.fillMaxSize()) { drawMarks(live.sheetMarks, width, height, alpha) }
        }
    }
}

/** The colour says the state and the legend under the picture says it in words; a rejected mark is also dashed. */
internal fun markColor(status: String): Color = when (status) {
    LiveMark.ACCEPTED -> Color(0xFF2E9E5B)
    LiveMark.REJECTED -> Color(0xFFD0453A)
    LiveMark.READ -> Color(0xFF2F7FD8)
    else -> Color(0xFFB08A2E)
}

internal fun DrawScope.drawMarks(marks: List<LiveMark>, width: Int, height: Int, alpha: Float) {
    val sx = size.width / width
    val sy = size.height / height
    for (m in marks) {
        val c = markColor(m.status).copy(alpha = alpha)
        val dash = if (m.status == LiveMark.REJECTED || m.status == LiveMark.CANDIDATE) PathEffect.dashPathEffect(floatArrayOf(10f, 6f)) else null
        m.line?.let { l -> drawLine(c, Offset((l.x0 * sx).toFloat(), (l.y0 * sy).toFloat()), Offset((l.x1 * sx).toFloat(), (l.y1 * sy).toFloat()), strokeWidth = 3f, pathEffect = dash) }
        m.box?.let { b -> drawRect(c, Offset((b.x0 * sx).toFloat(), (b.y0 * sy).toFloat()), Size(((b.x1 - b.x0) * sx).toFloat(), ((b.y1 - b.y0) * sy).toFloat()), style = Stroke(width = 2.5f, pathEffect = dash)) }
    }
}

/**
 * The job-private copy, refused unless its SHA-256 is the hash the analyzer named for the bytes it read — a picture
 * shown here is the picture the run read, not one fetched again. Downsampled for the phone's heap.
 */
internal fun loadVerified(file: File?, byteHash: String): Picture {
    if (file == null || !file.isFile) return Picture.Refused(R.string.live_sheet_missing)
    val bytes = file.readBytes()
    if (sha256(bytes) != byteHash.lowercase()) return Picture.Refused(R.string.live_sheet_mismatch)
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / sample > 1600) sample *= 2
    val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample }) ?: return Picture.Refused(R.string.live_sheet_undecodable)
    return Picture.Shown(bitmap.asImageBitmap())
}

internal fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

@Composable
private fun stepText(step: String): String = when (step) {
    "FETCHING" -> stringResource(R.string.live_step_fetching)
    "CONTENT_CHECK" -> stringResource(R.string.live_step_content)
    "CONTENT_REFUSED" -> stringResource(R.string.live_step_refused)
    "READING_DRAWING" -> stringResource(R.string.live_step_reading)
    "DRAWING_READ" -> stringResource(R.string.live_step_read)
    "READING_NUMBERS" -> stringResource(R.string.live_step_numbers)
    "NUMBERS_READ" -> stringResource(R.string.live_step_numbers_read)
    "SOLVING" -> stringResource(R.string.live_step_solving)
    "BUILT_FROM" -> stringResource(R.string.live_step_built)
    "COMPILING" -> stringResource(R.string.live_step_compiling)
    "VERIFYING" -> stringResource(R.string.live_step_verifying)
    else -> step
}

@Composable
private fun documentWord(document: String?): String = when (document) {
    "FLOOR_PLAN" -> stringResource(R.string.sources_doc_plan)
    "ELEVATION" -> stringResource(R.string.sources_doc_elevation)
    "SECTION" -> stringResource(R.string.sources_doc_section)
    "SITE_PLAN" -> stringResource(R.string.sources_doc_site)
    "PERSPECTIVE_RENDER" -> stringResource(R.string.sources_doc_render)
    else -> stringResource(R.string.sources_doc_unknown)
}
