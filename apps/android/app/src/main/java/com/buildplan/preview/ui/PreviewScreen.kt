package com.buildplan.preview.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.SceneSourceKind

/**
 * The whole app: a viewport with a thin band of chrome.
 *
 * The 3D model gets the screen. The top strip says what is loaded, the bottom
 * strip holds the tools, and the inspector only appears once there is
 * something to inspect. `onAnalyze` opens the Analyzer screen, which turns a
 * project link into a downloaded scene listed beside the bundled ones.
 */
@Composable
fun PreviewScreen(model: PreviewViewModel, onAnalyze: () -> Unit = {}) {
    Surface(color = MaterialTheme.colorScheme.background, modifier = Modifier.fillMaxSize()) {
        when (val screen = model.screen) {
            is ScreenState.Loading -> CentredMessage("Loading model…", null)
            is ScreenState.Failed -> CentredMessage("The model could not be loaded", screen.message) {
                // A downloaded scene can fail to open (a damaged file); never strand the owner here.
                model.scenes.firstOrNull()?.let { first ->
                    FilledTonalButton(onClick = { model.open(first) }) { Text("Open ${first.title}") }
                }
                TextButton(onClick = onAnalyze) { Text("Analyze link") }
            }
            is ScreenState.Ready -> ReadyScreen(model, screen.scene, onAnalyze)
        }
    }
}

@Composable
private fun ReadyScreen(model: PreviewViewModel, scene: ModelScene, onAnalyze: () -> Unit) {
    var showInspector by remember { mutableStateOf(false) }
    val selected = model.selected

    Box(Modifier.fillMaxSize()) {
        Viewport(scene = scene, model = model, modifier = Modifier.fillMaxSize())

        Column(Modifier.fillMaxSize().safeDrawingPadding()) {
            TopStrip(model, scene, onAnalyze)
            Box(Modifier.weight(1f))

            AnimatedVisibility(
                visible = showInspector && selected != null,
                enter = slideInVertically { it },
                exit = slideOutVertically { it },
            ) {
                if (selected != null) {
                    Inspector(
                        scene = scene,
                        selected = selected,
                        onClose = { showInspector = false },
                        onFrame = { model.frameSelection(System.currentTimeMillis()) },
                        onIsolate = { model.isolateSelected() },
                    )
                }
            }

            ControlBar(
                scene = scene,
                state = model.viewer,
                onPreset = { model.applyPreset(it, System.currentTimeMillis()) },
                onStyle = { model.setStyle(it) },
                onVisibility = { model.setVisibility(it) },
                onIsolate = { model.isolateSelected() },
                onShowAll = { model.showAll() },
                onFrameSelection = { model.frameSelection(System.currentTimeMillis()) },
                onReset = { model.reset(System.currentTimeMillis()); showInspector = false },
                onDetails = { showInspector = true },
                modifier = Modifier.fillMaxWidth(),
            )
        }
    }

    // Tapping an element is itself a request to know what it is.
    if (selected == null && showInspector) showInspector = false
}

@Composable
private fun TopStrip(model: PreviewViewModel, scene: ModelScene, onAnalyze: () -> Unit) {
    var pickerOpen by remember { mutableStateOf(false) }
    Surface(
        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.88f),
        modifier = Modifier.fillMaxWidth(),
    ) {
        Row(
            modifier = Modifier.padding(horizontal = 14.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Column(Modifier.weight(1f)) {
                Text(scene.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                val selectedLabel = model.selected?.let { " · selected: ${it.label}" } ?: ""
                StatusText(
                    "model ${scene.bundle.generatedFrom.modelSchemaVersion} · ${scene.objectCount} objects · " +
                        "${scene.triangleCount} triangles · bundle ${scene.bundle.contentHash.take(8)}$selectedLabel",
                )
            }
            TextButton(
                onClick = onAnalyze,
                modifier = Modifier.semantics { contentDescription = "Analyze link: turn a project page into a model on this phone" },
            ) { Text("Analyze link") }
            if (model.scenes.size > 1) {
                Box {
                    TextButton(
                        onClick = { pickerOpen = true },
                        modifier = Modifier.semantics { contentDescription = "Choose which model to inspect. Currently ${scene.title}." },
                    ) { Text("Model") }
                    DropdownMenu(expanded = pickerOpen, onDismissRequest = { pickerOpen = false }) {
                        for ((i, entry) in model.scenes.withIndex()) {
                            val downloaded = entry.source == SceneSourceKind.DOWNLOADED
                            // Bundled scenes first, then downloaded analyses, with a rule between the two sources.
                            if (downloaded && model.scenes.getOrNull(i - 1)?.source == SceneSourceKind.BUNDLED) HorizontalDivider()
                            DropdownMenuItem(
                                text = { Text(if (entry.key == scene.key) "${entry.title}  ✓" else entry.title) },
                                onClick = { pickerOpen = false; if (entry.key != scene.key) model.open(entry) },
                                modifier = Modifier.semantics {
                                    contentDescription = "${entry.title}. ${entry.subtitle}" + if (downloaded) ". Downloaded analysis." else ""
                                },
                            )
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun CentredMessage(title: String, detail: String?, actions: (@Composable () -> Unit)? = null) {
    Box(Modifier.fillMaxSize().safeDrawingPadding(), contentAlignment = Alignment.Center) {
        Column(
            modifier = Modifier.padding(28.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
            Text(title, style = MaterialTheme.typography.titleMedium)
            if (detail != null) {
                Text(
                    detail,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            actions?.invoke()
        }
    }
}
