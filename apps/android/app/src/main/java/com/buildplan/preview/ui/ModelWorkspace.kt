package com.buildplan.preview.ui

import androidx.activity.compose.BackHandler
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.safeDrawingPadding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.buildplan.preview.R
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.SceneSourceKind

/**
 * `3D`: the model on the whole screen.
 *
 * One opaque strip at the top says which house this is and where it came
 * from, with the way back; one opaque dock at the bottom holds the controls
 * in the owner's terms — view, layers, look, fit, reset, details. The details
 * panel opens above the dock and takes at most a share of the height the
 * chrome leaves, so it never covers the dock that closes it. Back closes the
 * details, then clears the selection, then leaves the model.
 */
@Composable
fun ModelWorkspace(model: PreviewViewModel, onBack: () -> Unit) {
    Surface(color = MaterialTheme.colorScheme.background, modifier = Modifier.fillMaxSize()) {
        when (val screen = model.screen) {
            is ScreenState.Loading -> WorkspaceMessage(stringResource(R.string.house_loading), null, onBack)
            is ScreenState.Failed -> WorkspaceMessage(stringResource(R.string.house_failed), screen.message, onBack)
            is ScreenState.Ready -> ReadyWorkspace(model, screen.scene, onBack)
        }
    }
}

@Composable
private fun ReadyWorkspace(model: PreviewViewModel, scene: ModelScene, onBack: () -> Unit) {
    var detailsOpen by rememberSaveable { mutableStateOf(false) }
    val selected = model.selected
    val motion = LocalMotionPolicy.current
    LaunchedEffect(selected) { if (selected == null) detailsOpen = false }

    // Only while there is something inside the model to close.
    BackHandler(enabled = detailsOpen) { detailsOpen = false }
    BackHandler(enabled = !detailsOpen && selected != null) { model.clearSelection() }

    Box(Modifier.fillMaxSize()) {
        Viewport(scene = scene, model = model, modifier = Modifier.fillMaxSize())

        BoxWithConstraints(Modifier.fillMaxSize().safeDrawingPadding()) {
            // The details panel shares the height with the top strip and the dock; it never takes more than this.
            val detailsMax = maxHeight * 0.45f
            Column(Modifier.fillMaxSize()) {
                val source = model.scenes.firstOrNull { it.key == scene.key }?.source
                WorkspaceTopBar(
                    title = scene.title,
                    context = stringResource(if (source == SceneSourceKind.DOWNLOADED) R.string.model_context_downloaded else R.string.model_context_bundled),
                    selection = selected?.let { stringResource(R.string.model_selected, it.label) },
                    onBack = onBack,
                )
                Box(Modifier.weight(1f))
                AnimatedVisibility(
                    visible = detailsOpen && selected != null,
                    enter = slideInVertically(motion.enter()) { it / 3 } + fadeIn(motion.enter()),
                    exit = slideOutVertically(motion.exit()) { it / 3 } + fadeOut(motion.exit()),
                ) {
                    if (selected != null) {
                        Inspector(
                            scene = scene,
                            selected = selected,
                            maxHeight = detailsMax,
                            onClose = { detailsOpen = false },
                            onFrame = { model.frameSelection(System.currentTimeMillis()) },
                            onIsolate = { model.isolateSelected() },
                        )
                    }
                }
                ToolDock(
                    scene = scene,
                    state = model.viewer,
                    onPreset = { model.applyPreset(it, System.currentTimeMillis()) },
                    onPresentation = { model.setPresentation(it) },
                    onStyle = { model.setStyle(it) },
                    onVisibility = { model.setVisibility(it) },
                    onIsolate = { model.isolateSelected() },
                    onShowAll = { model.showAll() },
                    onFrameSelection = { model.frameSelection(System.currentTimeMillis()) },
                    onReset = { model.reset(System.currentTimeMillis()); detailsOpen = false },
                    onDetails = { detailsOpen = true },
                    modifier = Modifier.fillMaxWidth(),
                )
            }
        }
    }
}

@Composable
private fun WorkspaceTopBar(title: String, context: String, selection: String?, onBack: () -> Unit) {
    Surface(color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(horizontal = 4.dp, vertical = 4.dp), verticalAlignment = Alignment.CenterVertically) {
            val backLabel = stringResource(R.string.model_back)
            IconButton(onClick = onBack, modifier = Modifier.size(48.dp)) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = backLabel)
            }
            Column(Modifier.weight(1f).padding(end = 12.dp)) {
                Text(
                    title,
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.SemiBold,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    modifier = Modifier.semantics { heading() },
                )
                StatusText(selection ?: context, maxLines = 1)
            }
        }
    }
}

@Composable
private fun WorkspaceMessage(title: String, detail: String?, onBack: () -> Unit) {
    Column(Modifier.fillMaxSize().safeDrawingPadding()) {
        Row(Modifier.padding(4.dp), verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onBack, modifier = Modifier.size(48.dp)) {
                Icon(Icons.AutoMirrored.Filled.ArrowBack, contentDescription = stringResource(R.string.model_back))
            }
        }
        Box(Modifier.weight(1f).fillMaxWidth(), contentAlignment = Alignment.Center) {
            Column(Modifier.padding(28.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
                Text(title, style = MaterialTheme.typography.titleMedium)
                if (detail != null) Text(detail, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
        }
    }
}
