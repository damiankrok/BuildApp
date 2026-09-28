package com.buildplan.preview.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.buildplan.preview.R
import com.buildplan.preview.progress.ConstructionStageKey
import com.buildplan.preview.progress.StageStatus
import com.buildplan.preview.scene.SceneObject
import java.util.Locale
import kotlin.math.abs

/**
 * The details of the selected element, as a sheet rising from the bottom
 * edge in place of the timeline — never stacked on top of it.
 *
 * Human meaning first: what it is and where, then which construction stage
 * it belongs to and whether, by the owner's account, it stands yet; then its
 * sizes (to the centimetre: this is a model to understand, not to build
 * from), its relations, and how the source knows it — in words. Identifiers,
 * part lists, triangle counts and the analyzer's confidence figure are folded
 * under "Dane techniczne". Every row comes from the exporter's metadata or
 * from the progress record; this file lays them out and reads nothing else.
 */
@Composable
fun Inspector(
    selected: SceneObject,
    stage: ConstructionStageKey?,
    /** The owner's status of [stage], or null while progress is unset. */
    stageStatus: StageStatus?,
    /** Whether the element stands in what the 3D shows now (a preview may hide it). */
    visibleNow: Boolean,
    isolating: Boolean,
    maxHeight: Dp,
    onClose: () -> Unit,
    onFrame: () -> Unit,
    onIsolate: () -> Unit,
    onShowAll: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val meta = selected.metadata
    var technical by rememberSaveable(selected.id) { mutableStateOf(false) }
    val scroll = rememberScrollState()
    Column(
        modifier
            .fillMaxWidth()
            .heightIn(max = maxHeight)
            .background(Palette.Sheet, RoundedCornerShape(topStart = Radius.sheet, topEnd = Radius.sheet)),
    ) {
        val where = listOfNotNull(selected.kindLabel.takeIf { meta?.label != null }, meta?.levelLabel).joinToString(" · ")
        PanelHeader(
            title = meta?.label ?: selected.kindLabel,
            supporting = where.ifBlank { null },
            closeLabel = stringResource(R.string.inspector_close),
            onClose = onClose,
        )
        Box(Modifier.weight(1f, fill = false)) {
            Column(
                Modifier
                    .fadeBelowFold(scroll, Palette.Sheet)
                    .verticalScroll(scroll)
                    .padding(horizontal = Space.l, vertical = Space.s),
                verticalArrangement = Arrangement.spacedBy(Space.xs),
            ) {
                ConstructionLine(stage, stageStatus, visibleNow)

                Group(stringResource(R.string.inspector_about))
                meta?.materialLabel?.let { Fact(stringResource(R.string.inspector_material), it) }
                for (fact in meta?.facts.orEmpty()) Fact(fact.label, fact.value)
                val size = selected.bounds.size
                if (!selected.bounds.isEmpty) Fact(stringResource(R.string.inspector_extent), "${metres(size.x)} × ${metres(size.y)} × ${metres(size.z)}")

                val relations = meta?.relations.orEmpty()
                if (relations.isNotEmpty()) {
                    Group(stringResource(R.string.inspector_relations))
                    for (r in relations) Fact(r.role.replaceFirstChar { it.uppercase() }, r.targetLabel)
                }

                meta?.evidence?.let { e ->
                    Group(stringResource(R.string.inspector_provenance))
                    Fact(stringResource(R.string.inspector_status), stringResource(evidenceStatusRes(e.status)))
                    e.confidence?.let { Fact(stringResource(R.string.inspector_confidence), stringResource(confidenceWordRes(it))) }
                    e.source?.let { Fact(stringResource(R.string.inspector_source), it) }
                    e.locator?.let { Fact(stringResource(R.string.inspector_locator), it) }
                    e.interpretation?.let { Fact(stringResource(R.string.inspector_interpretation), it) }
                    e.note?.let { Fact(stringResource(R.string.inspector_note), it) }
                }

                TextButton(onClick = { technical = !technical }, modifier = Modifier.heightIn(min = Sizes.touch)) {
                    Text(stringResource(if (technical) R.string.inspector_technical_hide else R.string.inspector_technical_show), color = Palette.InkMuted)
                }
                if (technical) {
                    Fact(stringResource(R.string.inspector_id), selected.id)
                    meta?.evidence?.let { e ->
                        Fact(stringResource(R.string.inspector_status_code), e.status)
                        e.confidence?.let { Fact(stringResource(R.string.inspector_confidence_value), "${(it * 100).toInt()}%") }
                    }
                    Fact(
                        stringResource(R.string.inspector_geometry),
                        stringResource(
                            R.string.inspector_geometry_value,
                            pluralStringResource(R.plurals.count_parts, selected.parts.size, selected.parts.size),
                            pluralStringResource(R.plurals.count_triangles, selected.triangleCount, selected.triangleCount),
                        ),
                    )
                    Fact(stringResource(R.string.inspector_parts), selected.parts.joinToString(", ") { it.rawPart })
                }
            }
        }
        Box(Modifier.fillMaxWidth().height(1.dp).background(Palette.Hairline))
        Row(Modifier.padding(horizontal = Space.s, vertical = Space.xs), horizontalArrangement = Arrangement.spacedBy(Space.s)) {
            TextButton(onClick = onFrame, enabled = visibleNow, modifier = Modifier.heightIn(min = Sizes.touch)) {
                Text(stringResource(R.string.inspector_frame), color = if (visibleNow) Palette.Ink else Palette.InkFaint)
            }
            if (isolating) {
                TextButton(onClick = onShowAll, modifier = Modifier.heightIn(min = Sizes.touch)) { Text(stringResource(R.string.layer_show_all), color = Palette.Ink) }
            } else {
                TextButton(onClick = onIsolate, enabled = visibleNow, modifier = Modifier.heightIn(min = Sizes.touch)) {
                    Text(stringResource(R.string.inspector_isolate), color = if (visibleNow) Palette.Ink else Palette.InkFaint)
                }
            }
        }
    }
}

/** Which stage the element belongs to, and whether it stands yet by the owner's account. */
@Composable
private fun ConstructionLine(stage: ConstructionStageKey?, status: StageStatus?, visibleNow: Boolean) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.m),
        modifier = Modifier.fillMaxWidth().padding(vertical = Space.xs).semantics(mergeDescendants = true) {},
    ) {
        StageMark(status, if (status == StageStatus.IN_PROGRESS) 0.5 else 0.0)
        Column(Modifier.weight(1f)) {
            if (stage == null) {
                Text(stringResource(R.string.inspector_stage_unmapped), style = MaterialTheme.typography.bodyMedium, color = Palette.Ink)
                Text(stringResource(R.string.inspector_stage_unmapped_detail), style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted)
            } else {
                Text(
                    stringResource(R.string.inspector_stage, stringResource(stage.labelRes()), stage.ordinal + 1),
                    style = MaterialTheme.typography.bodyMedium,
                    color = Palette.Ink,
                )
                val state = when (status) {
                    null -> R.string.inspector_stage_progress_unset
                    StageStatus.DONE -> R.string.inspector_stage_done
                    StageStatus.IN_PROGRESS -> R.string.inspector_stage_in_progress
                    StageStatus.NOT_STARTED -> R.string.inspector_stage_not_started
                }
                Text(stringResource(state), style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted)
            }
            if (!visibleNow) {
                Text(stringResource(R.string.inspector_hidden_in_view), style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted)
            }
        }
    }
}

@Composable
private fun Group(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.labelLarge,
        color = Palette.InkMuted,
        modifier = Modifier.padding(top = Space.m, bottom = Space.xxs).semantics { heading() },
    )
}

/** A label and its value, read together: no contentDescription, so the merged node keeps both texts. */
@Composable
private fun Fact(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(Space.m),
    ) {
        Text(label, style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted, modifier = Modifier.weight(0.42f))
        Text(value, style = MaterialTheme.typography.bodyMedium, color = Palette.Ink, modifier = Modifier.weight(0.58f))
    }
}

/** The model's evidence status in plain words; the code itself stays under "Dane techniczne". */
@androidx.annotation.StringRes
fun evidenceStatusRes(status: String): Int = when (status) {
    "SOURCE_EXACT" -> R.string.evidence_source_exact
    "SOURCE_CORROBORATED" -> R.string.evidence_source_corroborated
    "SOURCE_DERIVED" -> R.string.evidence_source_derived
    "GEOMETRIC_INFERRED" -> R.string.evidence_geometric_inferred
    "VISUAL_INFERRED" -> R.string.evidence_visual_inferred
    "ASSUMED" -> R.string.evidence_assumed
    "UNRESOLVED" -> R.string.evidence_unresolved
    else -> R.string.evidence_unknown
}

/**
 * The analyzer's confidence in words, so the only percentage in the owner's
 * way is the progress. The bands are presentation, stated here: from 0.85
 * "high", from 0.6 "medium", below "low". The figure itself is under
 * "Dane techniczne".
 */
@androidx.annotation.StringRes
fun confidenceWordRes(confidence: Double): Int = when {
    confidence >= 0.85 -> R.string.confidence_high
    confidence >= 0.6 -> R.string.confidence_medium
    else -> R.string.confidence_low
}

/** Dimensions read off the converted geometry, to the centimetre: "4,25 m". */
fun metres(v: Double): String =
    "${String.format(Locale.ROOT, "%.2f", abs(v)).trimEnd('0').trimEnd('.').replace('.', ',')} m"
