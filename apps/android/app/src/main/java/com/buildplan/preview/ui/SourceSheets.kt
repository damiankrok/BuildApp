package com.buildplan.preview.ui

import android.graphics.BitmapFactory
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.IntSize
import com.buildplan.preview.R
import com.buildplan.preview.analyzer.HttpUrlConnectionTransport
import com.buildplan.preview.analyzer.SourceInspection
import com.buildplan.preview.analyzer.SourceReading
import com.buildplan.preview.analyzer.SourceSheet
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * SOURCE-01: the source inspection — each picture the page published, what the publisher called it, what its pixels
 * show, what the analyzer did with it and why; on a sheet, each number read off it, its crop and its line drawn on the
 * real picture, read or worked out, and what the model made of it. The phone shows the service's records only.
 */
@Composable
internal fun SourceSheetsDetails(sources: SourceInspection, onShowElement: (String) -> Unit = {}) {
    var open by rememberSaveable { mutableStateOf(false) }
    val c = sources.counts
    Foldout(stringResource(R.string.sources_title, c.sheets, c.read, c.refusedByContent), open, onToggle = { open = !open }) {
        StatusText(stringResource(R.string.sources_numbers, c.readings, c.printedUsed, c.derived))
        c.openings?.let { StatusText(stringResource(R.string.sources_openings, it.plan, it.elevationReadings, it.model)) }
        StatusText(if (sources.classifier != null) stringResource(R.string.sources_classifier, sources.classifier.id) else stringResource(R.string.sources_no_classifier))
        for (sheet in sources.sheets) SheetDetails(sheet, onShowElement)
    }
}

@Composable
private fun SheetDetails(sheet: SourceSheet, onShowElement: (String) -> Unit) {
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
        var picture by remember(sheet.url) { mutableStateOf<PictureLoad>(PictureLoad.Loading) }
        LaunchedEffect(sheet.url) { picture = withContext(Dispatchers.IO) { loadPicture(sheet.url, sheet.byteHash) } }
        SheetPicture(sheet, selected, picture)
        sheet.readings.firstOrNull { it.id == selected }?.let { r ->
            Text(readingText(r) + " — " + useText(r), style = MaterialTheme.typography.bodyMedium, color = Palette.Ink)
            // v3.45: who read it and on what grounds it stands (the drawing's own checks for a recogniser's reading)
            readerText(r.reader)?.let { who -> StatusText(r.readerDetail?.let { stringResource(R.string.sources_reader_detail, who, it) } ?: who, maxLines = 4) }
            StatusText(r.why, maxLines = 4)
            // the reading's own crop, enlarged: a label of a few pixels is read here, not on the whole sheet
            (picture as? PictureLoad.Shown)?.let { shown -> (r.box ?: r.line)?.let { ReadingCrop(shown.bitmap, sheet, it) } }
            // SHAPE-LIVE-01: the element it went into, selected in the model; or, said plainly, none
            val target = r.elementIds.firstOrNull()
            if (target != null) {
                InkButton(stringResource(R.string.sources_show_in_model, r.elementIds.size), onClick = { onShowElement(target) }, modifier = Modifier.fillMaxWidth())
            } else {
                StatusText(stringResource(R.string.sources_no_element))
            }
        }
        // every reading can be chosen: the list is paged, not cut
        var page by remember(sheet.assetId) { mutableStateOf(0) }
        val pages = (sheet.readings.size + READINGS_PER_PAGE - 1) / READINGS_PER_PAGE
        Column(verticalArrangement = Arrangement.spacedBy(Space.xs)) {
            for (r in sheet.readings.drop(page * READINGS_PER_PAGE).take(READINGS_PER_PAGE)) {
                StatusText(
                    readingText(r) + " · " + useText(r),
                    modifier = Modifier.fillMaxWidth().heightIn(min = Sizes.touch).clickable(role = Role.Button) { selected = r.id },
                    color = if (r.id == selected) Palette.Ink else Palette.InkMuted,
                    maxLines = 2,
                )
            }
            if (pages > 1) {
                StatusText(stringResource(R.string.sources_page, page + 1, pages, sheet.readings.size))
                Row(horizontalArrangement = Arrangement.spacedBy(Space.s)) {
                    InkButton(stringResource(R.string.sources_page_previous), onClick = { page = (page - 1).coerceAtLeast(0) }, enabled = page > 0, modifier = Modifier.weight(1f))
                    InkButton(stringResource(R.string.sources_page_next), onClick = { page = (page + 1).coerceAtMost(pages - 1) }, enabled = page < pages - 1, modifier = Modifier.weight(1f))
                }
            }
        }
    }
}

private const val READINGS_PER_PAGE = 40

internal sealed interface PictureLoad {
    data object Loading : PictureLoad
    data class Shown(val bitmap: ImageBitmap) : PictureLoad
    data class Refused(val reason: Int) : PictureLoad
}

/** The reading's box (or line), with a margin, cut from the verified picture and drawn at the panel's width. */
@Composable
private fun ReadingCrop(bitmap: ImageBitmap, sheet: SourceSheet, r: com.buildplan.preview.analyzer.SourceRect) {
    val k = bitmap.width.toDouble() / sheet.width.coerceAtLeast(1)
    val margin = 24.0
    val x0 = ((minOf(r.x0, r.x1) - margin) * k).toInt().coerceIn(0, bitmap.width - 1)
    val y0 = ((minOf(r.y0, r.y1) - margin) * k).toInt().coerceIn(0, bitmap.height - 1)
    val x1 = ((maxOf(r.x0, r.x1) + margin) * k).toInt().coerceIn(x0 + 1, bitmap.width)
    val y1 = ((maxOf(r.y0, r.y1) + margin) * k).toInt().coerceIn(y0 + 1, bitmap.height)
    val w = x1 - x0
    val h = y1 - y0
    Box(Modifier.fillMaxWidth().aspectRatio((w.toFloat() / h).coerceIn(0.5f, 6f)).semantics { contentDescription = "" }) {
        Canvas(Modifier.fillMaxSize()) {
            drawImage(bitmap, srcOffset = IntOffset(x0, y0), srcSize = IntSize(w, h), dstSize = IntSize(size.width.toInt(), size.height.toInt()))
        }
    }
}

/** The real picture, fetched from the address the analysis read it from, with each reading's crop and line on it. */
@Composable
private fun SheetPicture(sheet: SourceSheet, selected: String?, picture: PictureLoad) {
    val b = when (picture) {
        PictureLoad.Loading -> { StatusText(stringResource(R.string.sources_picture_loading)); return }
        is PictureLoad.Refused -> { StatusText(stringResource(picture.reason)); return }
        is PictureLoad.Shown -> picture.bitmap
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

/**
 * Fetched through the app's one transport (HTTPS, no redirects, a size limit), from the address the analysis read it
 * from, and shown only when its SHA-256 is the hash of the bytes the analysis read (SHAPE-LIVE-01): a publisher that has
 * since replaced the picture shows a refusal, not a different picture under the old readings. Downsampled to at most
 * ~1600 px on its long side — enough to see a dimension, small enough for a phone's heap.
 */
private fun loadPicture(url: String, byteHash: String): PictureLoad {
    val response = runCatching { HttpUrlConnectionTransport().get(url, PICTURE_MAX_BYTES) }.getOrNull() ?: return PictureLoad.Refused(R.string.sources_picture_failed)
    if (response.status != 200) return PictureLoad.Refused(R.string.sources_picture_failed)
    val bytes = response.body
    if (byteHash.isBlank() || sha256(bytes) != byteHash.lowercase()) return PictureLoad.Refused(R.string.sources_picture_changed)
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
    var sample = 1
    while (maxOf(bounds.outWidth, bounds.outHeight) / sample > 1600) sample *= 2
    val bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample }) ?: return PictureLoad.Refused(R.string.sources_picture_failed)
    return PictureLoad.Shown(bitmap.asImageBitmap())
}

private const val PICTURE_MAX_BYTES = 20L * 1024 * 1024

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
    when {
        !r.printed -> stringResource(R.string.sources_reading_derived, measureText(r.measure), formatValue(r.value), r.unit)
        r.origin == "CHAIN_CORRECTED" -> stringResource(R.string.sources_reading_corrected, measureText(r.measure), r.rawText, formatValue(r.value), r.unit)
        else -> stringResource(R.string.sources_reading_printed, measureText(r.measure), r.rawText, formatValue(r.value), r.unit)
    }

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
private fun readerText(reader: String?): String? = when (reader) {
    "NUMERIC_OCR" -> stringResource(R.string.sources_reader_template)
    "RECOGNISER_VALIDATED" -> stringResource(R.string.sources_reader_recogniser)
    "CHAIN_SOLVER" -> stringResource(R.string.sources_reader_chain)
    "VISION_VALIDATED" -> stringResource(R.string.sources_reader_vision)
    null, "" -> null
    else -> stringResource(R.string.sources_reader_other)
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

