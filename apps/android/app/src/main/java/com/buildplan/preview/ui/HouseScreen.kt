package com.buildplan.preview.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
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
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.buildplan.preview.R
import com.buildplan.preview.analyzer.AnalysisState
import com.buildplan.preview.scene.SceneSourceKind
import kotlin.math.roundToInt

/**
 * `Dom`: which house this is, where it came from, and how to add another.
 *
 * The house card says in words whether the model is a built-in example or an
 * analysis of a link, and that an analysis is a candidate to check, not a
 * construction drawing. A running analysis shows its progress here too, so
 * the owner never has to open the analyzer to know whether it is working.
 * Technical figures (schema, object and triangle counts, the bundle hash)
 * are folded under one "Szczegóły techniczne" row, beside the way into the
 * analyzer's own diagnostics.
 */
@Composable
fun HouseScreen(preview: PreviewViewModel, analyzer: AnalyzerViewModel, onOpenModel: () -> Unit, onAnalyze: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .safeDrawingPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Text(
            stringResource(R.string.house_title),
            style = MaterialTheme.typography.headlineSmall,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.semantics { heading() },
        )
        CurrentHouse(preview, onOpenModel)
        AddHouse(analyzer, onAnalyze)
        SavedHouses(preview)
        Diagnostics(preview, onAnalyze)
    }
}

@Composable
private fun Panel(content: @Composable () -> Unit) {
    // Opaque: a card is never a pane of glass over something else to read.
    Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface), modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) { content() }
    }
}

@Composable
private fun SectionTitle(text: String) {
    Text(text, style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.SemiBold, modifier = Modifier.semantics { heading() })
}

@Composable
private fun Muted(text: String) {
    Text(text, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
}

@Composable
private fun CurrentHouse(preview: PreviewViewModel, onOpenModel: () -> Unit) {
    Panel {
        Text(stringResource(R.string.house_current_heading), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onSurfaceVariant)
        when (val screen = preview.screen) {
            is ScreenState.Loading -> Muted(stringResource(R.string.house_loading))
            is ScreenState.Failed -> {
                Text(stringResource(R.string.house_failed), style = MaterialTheme.typography.titleMedium)
                Muted(screen.message)
            }
            is ScreenState.Ready -> {
                val scene = screen.scene
                val source = preview.scenes.firstOrNull { it.key == scene.key }?.source
                Text(scene.title, style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.SemiBold, maxLines = 2, overflow = TextOverflow.Ellipsis)
                Muted(stringResource(if (source == SceneSourceKind.DOWNLOADED) R.string.house_source_downloaded else R.string.house_source_bundled))
                Text(stringResource(R.string.house_candidate_note), style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Button(onClick = onOpenModel, modifier = Modifier.heightIn(min = 48.dp)) { Text(stringResource(R.string.house_open_3d)) }
            }
        }
    }
}

@Composable
private fun AddHouse(analyzer: AnalyzerViewModel, onAnalyze: () -> Unit) {
    Panel {
        val state = analyzer.state
        if (analyzer.isRunning) {
            SectionTitle(stringResource(R.string.house_analysis_running))
            val progress = when (state) {
                is AnalysisState.Polling -> state.status?.progress ?: 0.0
                is AnalysisState.Finishing -> state.status.progress
                else -> 0.0
            }.coerceIn(0.0, 1.0).toFloat()
            val percent = (progress * 100).roundToInt()
            LinearProgressIndicator(
                progress = { progress },
                modifier = Modifier.fillMaxWidth().semantics { stateDescription = "$percent%" },
            )
            Muted(stringResource(R.string.house_analysis_running_detail, percent))
            FilledTonalButton(onClick = onAnalyze, modifier = Modifier.heightIn(min = 48.dp)) { Text(stringResource(R.string.house_analysis_show)) }
        } else {
            SectionTitle(stringResource(R.string.house_add_heading))
            Muted(stringResource(R.string.house_add_body))
            if (state is AnalysisState.Failed) {
                Text(stringResource(R.string.house_analysis_failed), style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.error)
            }
            Button(onClick = onAnalyze, modifier = Modifier.heightIn(min = 48.dp)) { Text(stringResource(R.string.house_add_action)) }
        }
    }
}

@Composable
private fun SavedHouses(preview: PreviewViewModel) {
    if (preview.scenes.isEmpty()) return
    val openKey = preview.scene?.key
    Panel {
        SectionTitle(stringResource(R.string.house_saved_heading))
        for ((i, entry) in preview.scenes.withIndex()) {
            if (i > 0) HorizontalDivider(color = MaterialTheme.colorScheme.outline.copy(alpha = 0.5f))
            val current = entry.key == openKey
            val stateText = stringResource(if (current) R.string.house_saved_current else R.string.state_not_selected)
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
                modifier = Modifier.fillMaxWidth().semantics(mergeDescendants = true) { stateDescription = stateText },
            ) {
                Column(Modifier.weight(1f)) {
                    Text(entry.title, style = MaterialTheme.typography.bodyLarge, fontWeight = FontWeight.Medium, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    Text(
                        stringResource(if (entry.source == SceneSourceKind.DOWNLOADED) R.string.house_source_downloaded else R.string.house_source_bundled),
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                if (current) {
                    Text(stringResource(R.string.house_saved_current), style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
                } else {
                    // Several "Wybierz" buttons in a list: each names the house it opens.
                    val openLabel = stringResource(R.string.house_saved_open_description, entry.title)
                    OutlinedButton(onClick = { preview.open(entry) }, modifier = Modifier.heightIn(min = 48.dp).semantics { contentDescription = openLabel }) {
                        Text(stringResource(R.string.house_saved_open), maxLines = 1)
                    }
                }
            }
        }
    }
}

@Composable
private fun Diagnostics(preview: PreviewViewModel, onAnalyze: () -> Unit) {
    var open by rememberSaveable { mutableStateOf(false) }
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        TextButton(onClick = { open = !open }, modifier = Modifier.heightIn(min = 48.dp)) {
            Text(stringResource(if (open) R.string.house_diagnostics_hide else R.string.house_diagnostics_show))
        }
        if (open) {
            preview.scene?.let { scene ->
                StatusText(
                    stringResource(
                        R.string.house_diagnostics_rows,
                        scene.bundle.generatedFrom.modelSchemaVersion,
                        pluralStringResource(R.plurals.count_objects, scene.objectCount, scene.objectCount),
                        pluralStringResource(R.plurals.count_triangles, scene.triangleCount, scene.triangleCount),
                        scene.bundle.contentHash.take(8),
                    ),
                    modifier = Modifier.padding(horizontal = 12.dp),
                )
            }
            TextButton(onClick = onAnalyze, modifier = Modifier.heightIn(min = 48.dp)) { Text(stringResource(R.string.house_diagnostics_analyzer)) }
        }
    }
}
