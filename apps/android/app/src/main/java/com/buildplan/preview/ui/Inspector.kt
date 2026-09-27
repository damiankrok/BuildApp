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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Close
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.buildplan.preview.R
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.SceneObject
import kotlin.math.abs

/**
 * The details of the selected element.
 *
 * Every row was produced by the TypeScript exporter from the canonical model
 * and arrives already formatted; this file chooses layout and nothing else —
 * it has no second reading of the model. The header with its close button
 * stays outside the scroll, so the only way out is always on screen; the
 * panel takes at most [maxHeight], and a fade over the cut edge says there
 * is more below. Identifiers, part lists and triangle counts are folded under
 * "Dane techniczne": they are for checking, not for reading.
 */
@Composable
fun Inspector(
    scene: ModelScene,
    selected: SceneObject,
    maxHeight: Dp,
    onClose: () -> Unit,
    onFrame: () -> Unit,
    onIsolate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val meta = selected.metadata
    var technical by rememberSaveable(selected.id) { mutableStateOf(false) }
    val scroll = rememberScrollState()
    Surface(modifier = modifier.fillMaxWidth(), color = MaterialTheme.colorScheme.surface, tonalElevation = 6.dp) {
        Column(Modifier.heightIn(max = maxHeight)) {
            Row(Modifier.padding(start = 16.dp, end = 4.dp, top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(
                        text = meta?.label ?: selected.kindLabel,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                        modifier = Modifier.semantics { heading() },
                    )
                    StatusText(selected.kindLabel, maxLines = 1)
                }
                IconButton(onClick = onClose, modifier = Modifier.size(48.dp)) {
                    Icon(Icons.Filled.Close, contentDescription = stringResource(R.string.inspector_close))
                }
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f))
            Box(Modifier.weight(1f, fill = false)) {
                Column(
                    modifier = Modifier.verticalScroll(scroll).padding(horizontal = 16.dp, vertical = 10.dp),
                    verticalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    meta?.levelLabel?.let { Fact(stringResource(R.string.inspector_storey), it) }
                    meta?.materialLabel?.let { Fact(stringResource(R.string.inspector_material), it) }
                    for (fact in meta?.facts.orEmpty()) Fact(fact.label, fact.value)
                    val size = selected.bounds.size
                    if (!selected.bounds.isEmpty) Fact(stringResource(R.string.inspector_extent), "${metres(size.x)} × ${metres(size.y)} × ${metres(size.z)}")

                    val relations = meta?.relations.orEmpty()
                    if (relations.isNotEmpty()) {
                        SubHeading(stringResource(R.string.inspector_relations))
                        for (r in relations) Fact(r.role.replaceFirstChar { it.uppercase() }, r.targetLabel)
                    }

                    meta?.evidence?.let { e ->
                        SubHeading(stringResource(R.string.inspector_provenance))
                        Fact(stringResource(R.string.inspector_status), e.status)
                        e.source?.let { Fact(stringResource(R.string.inspector_source), it) }
                        e.locator?.let { Fact(stringResource(R.string.inspector_locator), it) }
                        e.interpretation?.let { Fact(stringResource(R.string.inspector_interpretation), it) }
                        e.confidence?.let { Fact(stringResource(R.string.inspector_confidence), "${(it * 100).toInt()}%") }
                        e.note?.let { Fact(stringResource(R.string.inspector_note), it) }
                    }

                    TextButton(onClick = { technical = !technical }, modifier = Modifier.heightIn(min = 48.dp)) {
                        Text(stringResource(if (technical) R.string.inspector_technical_hide else R.string.inspector_technical_show))
                    }
                    if (technical) {
                        Fact(stringResource(R.string.inspector_id), selected.id)
                        Fact(stringResource(R.string.inspector_geometry), stringResource(R.string.inspector_geometry_value, pluralStringResource(R.plurals.count_parts, selected.parts.size, selected.parts.size), pluralStringResource(R.plurals.count_triangles, selected.triangleCount, selected.triangleCount)))
                        Fact(stringResource(R.string.inspector_parts), selected.parts.joinToString(", ") { it.rawPart })
                    }
                }
                if (scroll.canScrollForward) {
                    Box(
                        Modifier
                            .align(Alignment.BottomCenter)
                            .fillMaxWidth()
                            .height(20.dp)
                            .background(Brush.verticalGradient(listOf(Color.Transparent, MaterialTheme.colorScheme.surface))),
                    )
                }
            }
            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f))
            Row(Modifier.padding(horizontal = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(onClick = onFrame, modifier = Modifier.heightIn(min = 48.dp)) { Text(stringResource(R.string.dock_frame)) }
                TextButton(onClick = onIsolate, modifier = Modifier.heightIn(min = 48.dp)) { Text(stringResource(R.string.dock_isolate)) }
            }
        }
    }
}

@Composable
private fun SubHeading(text: String) {
    HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f))
    Text(text, style = MaterialTheme.typography.labelLarge, modifier = Modifier.semantics { heading() })
}

/** A label and its value, read together: no contentDescription, so the merged node keeps both texts. */
@Composable
private fun Fact(label: String, value: String) {
    Row(
        modifier = Modifier.fillMaxWidth().semantics(mergeDescendants = true) {},
        horizontalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text(
            text = label,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.weight(0.42f),
        )
        Text(text = value, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.weight(0.58f))
    }
}

/** Dimensions read off the converted geometry, to the millimetre. */
private fun metres(v: Double): String {
    val a = abs(v)
    return "${String.format(java.util.Locale.ROOT, "%.3f", a).trimEnd('0').trimEnd('.').replace('.', ',')} m"
}
