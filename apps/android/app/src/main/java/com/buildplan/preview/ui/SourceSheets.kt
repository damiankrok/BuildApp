package com.buildplan.preview.ui

import android.graphics.BitmapFactory
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import com.buildplan.preview.R
import com.buildplan.preview.analyzer.SourceInspection
import com.buildplan.preview.analyzer.SourceReading
import com.buildplan.preview.analyzer.SourceSheet
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.net.HttpURLConnection
import java.net.URL

/**
 * SOURCE-01: the source inspection — each picture the page published, what the publisher called it, what its pixels
 * show, what the analyzer did with it and why; on a sheet, each number read off it, its crop and its line drawn on the
 * real picture, read or worked out, and what the model made of it. The phone shows the service's records only.
 */
@Composable
internal fun SourceSheetsDetails(sources: SourceInspection) {
    var open by rememberSaveable { mutableStateOf(false) }
    val c = sources.counts
    Foldout(stringResource(R.string.sources_title, c.sheets, c.read, c.refusedByContent), open, onToggle = { open = !open }) {
        StatusText(stringResource(R.string.sources_numbers, c.readings, c.printedUsed, c.derived))
        StatusText(if (sources.classifier != null) stringResource(R.string.sources_classifier, sources.classifier.id) else stringResource(R.string.sources_no_classifier))
        for (sheet in sources.sheets) SheetDetails(sheet)
    }
}

@Composable
private fun SheetDetails(sheet: SourceSheet) {
    var open by rememberSaveable(sheet.assetId) { mutableStateOf(false) }
    val title = listOfNotNull(
        documentText(sheet.claimed.document),
        sheet.content?.let { stringResource(R.string.sources_pixels, contentText(it.top), (it.probability * 100).toInt()) },
        outcomeText(sheet.outcome),
    ).joinToString(" · ")
    Foldout(title, open, onToggle = { open = !open }) {
        StatusText(stringResource(R.string.sources_publisher, sheet.claimed.basis), maxLines = 3)
        Text(sheet.why, style = MaterialTheme.typography.bodyMedium, color = Palette.Ink)
        sheet.side?.let { StatusText(stringResource(R.string.sources_side, it, sheet.sideBasis.orEmpty())) }
        var selected by remember(sheet.assetId) { mutableStateOf<String?>(null) }
        SheetPicture(sheet, selected)
        sheet.readings.firstOrNull { it.id == selected }?.let { r ->
            Text(readingText(r) + " — " + useText(r), style = MaterialTheme.typography.bodyMedium, color = Palette.Ink)
            StatusText(r.why, maxLines = 4)
        }
        Column(verticalArrangement = Arrangement.spacedBy(Space.xs)) {
            for (r in sheet.readings.take(40)) {
                StatusText(
                    readingText(r) + " · " + useText(r),
                    modifier = Modifier.fillMaxWidth().heightIn(min = Sizes.touch).clickable(role = Role.Button) { selected = r.id },
                    color = if (r.id == selected) Palette.Ink else Palette.InkMuted,
                    maxLines = 2,
                )
            }
            if (sheet.readings.size > 40) StatusText(stringResource(R.string.assessment_more, sheet.readings.size - 40))
        }
    }
}

/** The real picture, fetched from the address the analysis read it from, with each reading's crop and line on it. */
@Composable
private fun SheetPicture(sheet: SourceSheet, selected: String?) {
    var bitmap by remember(sheet.url) { mutableStateOf<ImageBitmap?>(null) }
    var failed by remember(sheet.url) { mutableStateOf(false) }
    LaunchedEffect(sheet.url) {
        val got = withContext(Dispatchers.IO) { runCatching { loadPicture(sheet.url) }.getOrNull() }
        if (got == null) failed = true else bitmap = got
    }
    val b = bitmap
    if (b == null) {
        StatusText(stringResource(if (failed) R.string.sources_picture_failed else R.string.sources_picture_loading))
        return
    }
    Box(Modifier.fillMaxWidth().aspectRatio(sheet.width.toFloat() / sheet.height.coerceAtLeast(1))) {
        Image(b, contentDescription = stringResource(R.string.sources_picture), modifier = Modifier.fillMaxSize(), contentScale = ContentScale.FillBounds)
        Canvas(Modifier.fillMaxSize()) {
            val sx = size.width / sheet.width
            val sy = size.height / sheet.height
            for (r in sheet.readings) {
                val dim = selected != null && selected != r.id
                val alpha = if (dim) 0.25f else 1f
                r.line?.let { l ->
                    drawLine(
                        color = (if (r.printed) Color(0xFF00AA77) else Color(0xFFCC8800)).copy(alpha = alpha),
                        start = Offset((l.x0 * sx).toFloat(), (l.y0 * sy).toFloat()),
                        end = Offset((l.x1 * sx).toFloat(), (l.y1 * sy).toFloat()),
                        strokeWidth = if (r.id == selected) 6f else 3f,
                        pathEffect = if (r.printed) null else PathEffect.dashPathEffect(floatArrayOf(12f, 8f)),
                    )
                }
                r.box?.let { x ->
                    drawRect(
                        color = (if (r.use == "USED_IN_MODEL") Color(0xFF0066CC) else Color(0xFF888888)).copy(alpha = alpha),
                        topLeft = Offset((x.x0 * sx).toFloat(), (x.y0 * sy).toFloat()),
                        size = Size(((x.x1 - x.x0) * sx).toFloat(), ((x.y1 - x.y0) * sy).toFloat()),
                        style = Stroke(width = if (r.id == selected) 5f else 2f),
                    )
                }
            }
        }
    }
}

/** Downsampled to at most ~1600 px on its long side: enough to see a dimension, small enough for a phone's heap. */
private fun loadPicture(url: String): ImageBitmap? {
    val conn = URL(url).openConnection() as HttpURLConnection
    conn.connectTimeout = 15_000
    conn.readTimeout = 30_000
    return try {
        val bytes = conn.inputStream.use { it.readBytes() }
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        var sample = 1
        while (maxOf(bounds.outWidth, bounds.outHeight) / sample > 1600) sample *= 2
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })?.asImageBitmap()
    } finally {
        conn.disconnect()
    }
}

@Composable
private fun documentText(document: String): String = when (document) {
    "FLOOR_PLAN" -> stringResource(R.string.sources_doc_plan)
    "ELEVATION" -> stringResource(R.string.sources_doc_elevation)
    "SECTION" -> stringResource(R.string.sources_doc_section)
    "SITE_PLAN" -> stringResource(R.string.sources_doc_site)
    "PERSPECTIVE_RENDER" -> stringResource(R.string.sources_doc_render)
    else -> stringResource(R.string.sources_doc_unknown)
}

@Composable
private fun contentText(top: String): String = when (top) {
    "FLOOR_PLAN" -> stringResource(R.string.sources_doc_plan)
    "ELEVATION" -> stringResource(R.string.sources_doc_elevation)
    "SECTION" -> stringResource(R.string.sources_doc_section)
    "SITE_PLAN" -> stringResource(R.string.sources_doc_site)
    "EXTERIOR_PERSPECTIVE" -> stringResource(R.string.sources_content_exterior)
    "INTERIOR" -> stringResource(R.string.sources_content_interior)
    else -> top
}

@Composable
private fun outcomeText(outcome: String): String = when (outcome) {
    SourceSheet.READ -> stringResource(R.string.sources_outcome_read)
    SourceSheet.REFUSED_BY_CONTENT -> stringResource(R.string.sources_outcome_refused)
    SourceSheet.NO_READER -> stringResource(R.string.sources_outcome_source_only)
    else -> stringResource(R.string.sources_outcome_not_read)
}

@Composable
private fun readingText(r: SourceReading): String =
    if (r.printed) stringResource(R.string.sources_reading_printed, measureText(r.measure), r.rawText, formatValue(r.value), r.unit)
    else stringResource(R.string.sources_reading_derived, measureText(r.measure), formatValue(r.value), r.unit)

@Composable
private fun measureText(measure: String): String = when (measure) {
    "OVERALL" -> stringResource(R.string.sources_measure_overall)
    "CHAIN_SEGMENT" -> stringResource(R.string.sources_measure_segment)
    "OPENING" -> stringResource(R.string.sources_measure_opening)
    "LEVEL" -> stringResource(R.string.sources_measure_level)
    "ANGLE" -> stringResource(R.string.sources_measure_angle)
    "AREA" -> stringResource(R.string.sources_measure_area)
    else -> stringResource(R.string.sources_measure_dimension)
}

@Composable
private fun useText(r: SourceReading): String {
    val use = when (r.use) {
        "USED_IN_MODEL" -> stringResource(R.string.sources_use_model)
        "USED_AS_CORROBORATION" -> stringResource(R.string.sources_use_check)
        "CONFLICTED" -> stringResource(R.string.sources_use_conflict)
        "REJECTED_WITH_REASON", "IGNORED_WITH_REASON" -> stringResource(R.string.sources_use_refused)
        else -> stringResource(R.string.sources_use_none)
    }
    return if (r.featureId != null) stringResource(R.string.sources_use_element, use, r.featureId) else use
}

private fun formatValue(v: Double): String = if (v == Math.floor(v)) v.toLong().toString() else "%.2f".format(java.util.Locale.ROOT, v)

