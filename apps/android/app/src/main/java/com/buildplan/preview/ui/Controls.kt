package com.buildplan.preview.ui

import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.buildplan.preview.camera.ViewPreset
import com.buildplan.preview.render.RenderStyle
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.ViewerState
import com.buildplan.preview.scene.VisibilityMode

/**
 * The tool row.
 *
 * Every gesture in the viewport also has a button here, because a gesture is
 * not discoverable and not everyone can perform a two-finger drag. Targets are
 * at least 48 dp and every control carries a description; nothing is signalled
 * by colour alone — the active view, style and layer are named in the button
 * itself.
 */
@Composable
fun ControlBar(
    scene: ModelScene,
    state: ViewerState,
    onPreset: (ViewPreset) -> Unit,
    onStyle: (RenderStyle) -> Unit,
    onVisibility: (VisibilityMode) -> Unit,
    onIsolate: () -> Unit,
    onShowAll: () -> Unit,
    onFrameSelection: () -> Unit,
    onReset: () -> Unit,
    onDetails: () -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        modifier = modifier,
        color = MaterialTheme.colorScheme.surface.copy(alpha = 0.92f),
        tonalElevation = 3.dp,
    ) {
        Row(
            modifier = Modifier
                .horizontalScroll(rememberScrollState())
                .padding(horizontal = 12.dp, vertical = 10.dp),
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            MenuButton(
                label = "Views",
                description = "Camera views. Current projection: ${if (state.isIsolating) "isolated" else "whole scene"}.",
            ) { dismiss ->
                for (preset in ViewPreset.availableIn(scene)) {
                    DropdownMenuItem(
                        text = { Text("${preset.label}   ·   ${preset.description}") },
                        onClick = { onPreset(preset); dismiss() },
                        modifier = Modifier.semantics { contentDescription = "${preset.label}. ${preset.description}" },
                    )
                }
            }

            MenuButton(label = "Style: ${state.style.label}", description = "Render style, currently ${state.style.label}") { dismiss ->
                for (style in RenderStyle.entries) {
                    DropdownMenuItem(
                        text = { Text(if (style == state.style) "${style.label}  ✓   ·   ${style.description}" else "${style.label}   ·   ${style.description}") },
                        onClick = { onStyle(style); dismiss() },
                        modifier = Modifier.semantics {
                            contentDescription = "${style.label}. ${style.description}.${if (style == state.style) " Selected." else ""}"
                        },
                    )
                }
            }

            MenuButton(
                label = "Layers: ${if (state.isIsolating) "Isolated" else state.visibility.label}",
                description = "Visibility layers, currently ${if (state.isIsolating) "isolating one element" else state.visibility.label}",
            ) { dismiss ->
                for (mode in VisibilityMode.entries) {
                    DropdownMenuItem(
                        text = { Text(if (mode == state.visibility && !state.isIsolating) "${mode.label}  ✓" else mode.label) },
                        onClick = { onVisibility(mode); dismiss() },
                        modifier = Modifier.semantics {
                            contentDescription = "${mode.label}. ${mode.description}.${if (mode == state.visibility && !state.isIsolating) " Selected." else ""}"
                        },
                    )
                }
                DropdownMenuItem(
                    text = { Text("Isolate selection") },
                    enabled = state.selectedObjectId != null,
                    onClick = { onIsolate(); dismiss() },
                    modifier = Modifier.semantics { contentDescription = "Isolate the selected element, hiding everything else" },
                )
                DropdownMenuItem(
                    text = { Text("Show all") },
                    onClick = { onShowAll(); dismiss() },
                    modifier = Modifier.semantics { contentDescription = "Show all elements again" },
                )
            }

            ToolButton(
                label = "Frame",
                description = if (state.selectedObjectId == null) "Frame selection. Nothing is selected yet." else "Frame the selected element",
                enabled = state.selectedObjectId != null,
                onClick = onFrameSelection,
            )

            ToolButton(
                label = "Reset",
                description = "Reset to the whole house and show every element",
                onClick = onReset,
                leading = { Icon(Icons.Filled.Refresh, contentDescription = null, modifier = Modifier.size(18.dp)) },
            )

            ToolButton(
                label = "Details",
                description = if (state.selectedObjectId == null) "Details. Tap an element in the model first." else "Open details of the selected element",
                enabled = state.selectedObjectId != null,
                onClick = onDetails,
                leading = { Icon(Icons.Filled.Info, contentDescription = null, modifier = Modifier.size(18.dp)) },
            )
        }
    }
}

@Composable
private fun ToolButton(
    label: String,
    description: String,
    onClick: () -> Unit,
    enabled: Boolean = true,
    leading: @Composable (() -> Unit)? = null,
) {
    FilledTonalButton(
        onClick = onClick,
        enabled = enabled,
        modifier = Modifier
            .defaultMinSize(minHeight = 48.dp)
            .semantics { contentDescription = description },
    ) {
        if (leading != null) {
            leading()
            Box(Modifier.width(6.dp))
        }
        Text(label, fontWeight = FontWeight.Medium)
    }
}

/** A tool button that opens its own menu. */
@Composable
private fun MenuButton(
    label: String,
    description: String,
    items: @Composable (dismiss: () -> Unit) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    Box {
        ToolButton(label = label, description = description, onClick = { open = true })
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            items { open = false }
        }
    }
}

/** A quiet status line: what is loaded and how big it is. */
@Composable
fun StatusText(text: String, modifier: Modifier = Modifier, color: Color = MaterialTheme.colorScheme.onSurfaceVariant) {
    Text(text = text, style = MaterialTheme.typography.labelSmall, color = color, modifier = modifier)
}
