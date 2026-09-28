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
 * Human meaning first, in the owner's Polish ([ElementWords]): what it is and
 * on which storey, with its size in plan; then which construction stage it
 * belongs to and whether, by the owner's account, it stands yet; then the
 * facts an owner asks about (sizes to the centimetre, area, use, material)
 * and how the source knows it, in words. Everything the export says in its
 * own engineering English — its name for the element, every fact, the
 * relations, the source locators — plus identifiers, parts, triangle counts
 * and the confidence figure is folded under "Dane techniczne". Every row
 * comes from the exporter's metadata or from the progress record.
 */
@Composable
fun Inspector(
    selected: SceneObject,
    /** The element's storey in the owner's words, when the model places it on one. */
    storey: ElementWords.Storey?,
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
        val size = selected.bounds.size
        val plan = if (selected.bounds.isEmpty) null else "${metresValue(maxOf(size.x, size.z))} × ${metres(minOf(size.x, size.z))}"
        PanelHeader(
            title = elementTitle(selected),
            supporting = listOfNotNull(storey?.let { storeyText(it) }, plan).joinToString(" · ").ifBlank { null },
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
                ElementWords.material(meta?.materialLabel)?.let { Fact(stringResource(R.string.inspector_material), stringResource(it)) }
                for (fact in meta?.facts.orEmpty()) {
                    val owner = ElementWords.ownerFact(fact) ?: continue
                    Fact(stringResource(owner.label), owner.valueRes?.let { stringResource(it) } ?: owner.value.orEmpty())
                }
                if (!selected.bounds.isEmpty) {
                    Fact(
                        stringResource(R.string.inspector_dimensions),
                        "${metresValue(maxOf(size.x, size.z))} × ${metresValue(minOf(size.x, size.z))} × ${metres(size.y)}",
                    )
                }

                meta?.evidence?.let { e ->
                    Group(stringResource(R.string.inspector_provenance))
                    Fact(stringResource(R.string.inspector_status), stringResource(evidenceStatusRes(e.status)))
                    e.confidence?.let { Fact(stringResource(R.string.inspector_confidence), stringResource(confidenceWordRes(it))) }
                }

                QuietAction(stringResource(if (technical) R.string.inspector_technical_hide else R.string.inspector_technical_show), onClick = { technical = !technical })
                if (technical) {
                    meta?.label?.takeIf { it.isNotBlank() }?.let { Fact(stringResource(R.string.inspector_model_name), it) }
                    Fact(stringResource(R.string.inspector_model_kind), selected.kindLabel)
                    meta?.levelLabel?.let { Fact(stringResource(R.string.inspector_model_storey), it) }
                    meta?.materialLabel?.let { Fact(stringResource(R.string.inspector_model_material), it) }
                    Fact(stringResource(R.string.inspector_id), selected.id)
                    val facts = meta?.facts.orEmpty()
                    if (facts.isNotEmpty()) {
                        Group(stringResource(R.string.inspector_export_facts))
                        for (fact in facts) Fact(fact.label, fact.value)
                    }
                    val relations = meta?.relations.orEmpty()
                    if (relations.isNotEmpty()) {
                        Group(stringResource(R.string.inspector_relations_export))
                        for (r in relations) Fact(r.role, r.targetLabel)
                    }
                    meta?.evidence?.let { e ->
                        Group(stringResource(R.string.inspector_provenance))
                        Fact(stringResource(R.string.inspector_status_code), e.status)
                        e.confidence?.let { Fact(stringResource(R.string.inspector_confidence_value), "${(it * 100).toInt()}%") }
                        e.source?.let { Fact(stringResource(R.string.inspector_source), it) }
                        e.locator?.let { Fact(stringResource(R.string.inspector_locator), it) }
                        e.interpretation?.let { Fact(stringResource(R.string.inspector_interpretation), it) }
                        e.note?.let { Fact(stringResource(R.string.inspector_note), it) }
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
fun metres(v: Double): String = "${metresValue(v)} m"

/** The number of [metres] without its unit, for "4,25 × 7,5 m". */
fun metresValue(v: Double): String =
    String.format(Locale.ROOT, "%.2f", abs(v)).trimEnd('0').trimEnd('.').replace('.', ',')

/** The element's headline in the owner's words. */
@Composable
fun elementTitle(obj: SceneObject): String = when (val t = ElementWords.title(obj)) {
    is ElementWords.Title.SourceName -> t.name
    is ElementWords.Title.Words -> stringResource(t.res)
}

@Composable
fun storeyText(storey: ElementWords.Storey): String = when (storey) {
    is ElementWords.Storey.SourceName -> storey.name
    ElementWords.Storey.Ground -> stringResource(R.string.storey_ground)
    is ElementWords.Storey.Numbered -> stringResource(R.string.storey_numbered, storey.number + 1)
}
