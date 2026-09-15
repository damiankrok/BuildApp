package com.buildplan.preview.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.buildplan.preview.math.Bounds
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.SceneObject
import kotlin.math.abs

/**
 * The inspector: what the selected element actually is.
 *
 * Every row here was produced by the TypeScript exporter from the
 * CanonicalBuildingModel and arrives already formatted. This file chooses
 * layout and nothing else — it has no idea what a sill or a pitch is, which is
 * exactly the point: there is no second reading of the model on the phone.
 */
@Composable
fun Inspector(
    scene: ModelScene,
    selected: SceneObject,
    onClose: () -> Unit,
    onFrame: () -> Unit,
    onIsolate: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val meta = selected.metadata
    Surface(
        modifier = modifier.fillMaxWidth(),
        color = MaterialTheme.colorScheme.surface,
        tonalElevation = 6.dp,
    ) {
        Column(
            modifier = Modifier
                .heightIn(max = 340.dp)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Column(Modifier.weight(1f)) {
                    Text(
                        text = meta?.label ?: selected.id,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.SemiBold,
                    )
                    StatusText("${selected.kindLabel} · ${selected.id}")
                }
                IconButton(
                    onClick = onClose,
                    modifier = Modifier
                        .size(48.dp)
                        .semantics { contentDescription = "Close details" },
                ) {
                    Icon(Icons.Filled.Close, contentDescription = null)
                }
            }

            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f))

            meta?.levelLabel?.let { Fact("Storey", it) }
            meta?.materialLabel?.let { Fact("Material", it) }
            for (fact in meta?.facts.orEmpty()) Fact(fact.label, fact.value)

            val size = selected.bounds.size
            if (!selected.bounds.isEmpty) {
                Fact("Extent", "${metres(size.x)} × ${metres(size.y)} × ${metres(size.z)}")
            }
            Fact("Geometry", "${selected.parts.size} part${if (selected.parts.size == 1) "" else "s"} · ${selected.triangleCount} triangles")
            Fact("Parts", selected.parts.joinToString(", ") { it.rawPart })

            val relations = meta?.relations.orEmpty()
            if (relations.isNotEmpty()) {
                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f))
                Text("Relationships", style = MaterialTheme.typography.labelLarge)
                for (r in relations) Fact(r.role.replaceFirstChar { it.uppercase() }, r.targetLabel)
            }

            meta?.evidence?.let { e ->
                HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f))
                Text("Provenance", style = MaterialTheme.typography.labelLarge)
                Fact("Status", e.status)
                e.source?.let { Fact("Source", it) }
                e.locator?.let { Fact("Locator", it) }
                e.interpretation?.let { Fact("Interpretation", it) }
                e.confidence?.let { Fact("Confidence", "${(it * 100).toInt()}%") }
                e.note?.let { Fact("Note", it) }
            }

            HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.4f))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TextButton(
                    onClick = onFrame,
                    modifier = Modifier.semantics { contentDescription = "Frame this element in the viewport" },
                ) { Text("Frame") }
                TextButton(
                    onClick = onIsolate,
                    modifier = Modifier.semantics { contentDescription = "Isolate this element, hiding everything else" },
                ) { Text("Isolate") }
            }
        }
    }
}

@Composable
private fun Fact(label: String, value: String) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .semantics { contentDescription = "$label: $value" },
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
    return "${String.format("%.3f", a).trimEnd('0').trimEnd('.')} m"
}
