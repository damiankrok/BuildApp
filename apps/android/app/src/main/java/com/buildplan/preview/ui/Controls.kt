package com.buildplan.preview.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.defaultMinSize
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.FilledTonalButton
import androidx.compose.material3.HorizontalDivider
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
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.buildplan.preview.R
import com.buildplan.preview.camera.ViewPreset
import com.buildplan.preview.presentation.PresentationMode
import com.buildplan.preview.render.RenderStyle
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.ViewerState
import com.buildplan.preview.scene.VisibilityMode

/**
 * The 3D dock: the controls grouped the way an owner thinks of them.
 *
 * `Widok` (where the camera stands), `Warstwy` (what is visible), `Wygląd`
 * (MODEL, CLAY or LINE — Model, Makieta, Kreska — and, for Model, its
 * lighting), then the three actions that need no menu: fit, reset, details.
 * Every gesture in the viewport also has a control here, every target is at
 * least 48 dp, and every current choice is named in the button and ticked in
 * its menu — never signalled by colour alone. The dock is opaque; when it is
 * wider than the screen it scrolls, and a fade at the cut edge says so.
 */
@Composable
fun ToolDock(
    scene: ModelScene,
    state: ViewerState,
    onPreset: (ViewPreset) -> Unit,
    onPresentation: (PresentationMode) -> Unit,
    onStyle: (RenderStyle) -> Unit,
    onVisibility: (VisibilityMode) -> Unit,
    onIsolate: () -> Unit,
    onShowAll: () -> Unit,
    onFrameSelection: () -> Unit,
    onReset: () -> Unit,
    onDetails: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val scroll = rememberScrollState()
    Surface(modifier = modifier, color = MaterialTheme.colorScheme.surface, tonalElevation = 3.dp) {
        Box {
            Row(
                modifier = Modifier
                    .horizontalScroll(scroll)
                    .padding(horizontal = 12.dp, vertical = 10.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                MenuButton(label = stringResource(R.string.dock_view), description = stringResource(R.string.dock_view_description)) { dismiss ->
                    for (preset in ViewPreset.availableIn(scene)) {
                        DropdownMenuItem(
                            text = { Text(stringResource(preset.labelRes()), maxLines = 2, overflow = TextOverflow.Ellipsis) },
                            onClick = { onPreset(preset); dismiss() },
                        )
                    }
                }

                val layer = if (state.isIsolating) stringResource(R.string.layer_isolated) else stringResource(state.visibility.labelRes())
                MenuButton(label = "${stringResource(R.string.dock_layers)}: $layer", description = stringResource(R.string.dock_layers_description)) { dismiss ->
                    for (mode in VisibilityMode.entries) {
                        Choice(stringResource(mode.labelRes()), null, selected = mode == state.visibility && !state.isIsolating) { onVisibility(mode); dismiss() }
                    }
                    HorizontalDivider()
                    Choice(stringResource(R.string.dock_isolate), null, selected = state.isIsolating, enabled = state.selectedObjectId != null) { onIsolate(); dismiss() }
                    Choice(stringResource(R.string.dock_show_all), null, selected = false) { onShowAll(); dismiss() }
                }

                // The owner's comparison: the same model as Model, Makieta (CLAY) and Kreska (LINE).
                MenuButton(
                    label = "${stringResource(R.string.dock_look)}: ${stringResource(state.presentation.labelRes())}",
                    description = stringResource(R.string.dock_look_description),
                ) { dismiss ->
                    for (mode in PresentationMode.entries) {
                        Choice(stringResource(mode.labelRes()), stringResource(mode.descriptionRes()), selected = mode == state.presentation) { onPresentation(mode); dismiss() }
                    }
                    if (state.presentation.usesStyle) {
                        HorizontalDivider()
                        Text(
                            stringResource(R.string.dock_style_heading),
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
                        )
                        for (style in RenderStyle.entries) {
                            Choice(stringResource(style.labelRes()), null, selected = style == state.style) { onStyle(style); dismiss() }
                        }
                    }
                }

                ToolButton(label = stringResource(R.string.dock_fit), description = stringResource(R.string.dock_fit_description), onClick = { onPreset(ViewPreset.FIT) })

                ToolButton(
                    label = stringResource(R.string.dock_reset),
                    description = stringResource(R.string.dock_reset_description),
                    onClick = onReset,
                    leading = { Icon(Icons.Filled.Refresh, contentDescription = null, modifier = Modifier.size(18.dp)) },
                )

                if (state.selectedObjectId != null) {
                    ToolButton(label = stringResource(R.string.dock_frame), description = stringResource(R.string.dock_frame), onClick = onFrameSelection)
                }

                ToolButton(
                    label = stringResource(R.string.dock_details),
                    description = stringResource(if (state.selectedObjectId == null) R.string.dock_details_unavailable else R.string.dock_details_description),
                    enabled = state.selectedObjectId != null,
                    onClick = onDetails,
                    leading = { Icon(Icons.Filled.Info, contentDescription = null, modifier = Modifier.size(18.dp)) },
                )
            }
            // Content cut at the edge: a fade says there is more to scroll to.
            if (scroll.canScrollForward) {
                Box(
                    Modifier
                        .align(Alignment.CenterEnd)
                        .width(28.dp)
                        .fillMaxHeight()
                        .background(Brush.horizontalGradient(listOf(Color.Transparent, MaterialTheme.colorScheme.surface))),
                )
            }
        }
    }
}

/** A menu row that names its state with a tick and in words, not by colour. */
@Composable
private fun Choice(label: String, detail: String?, selected: Boolean, enabled: Boolean = true, onClick: () -> Unit) {
    val stateText = stringResource(if (selected) R.string.state_selected else R.string.state_not_selected)
    DropdownMenuItem(
        text = {
            if (detail == null) {
                Text(label, maxLines = 2, overflow = TextOverflow.Ellipsis)
            } else {
                androidx.compose.foundation.layout.Column {
                    Text(label, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 3, overflow = TextOverflow.Ellipsis)
                }
            }
        },
        leadingIcon = { if (selected) Icon(Icons.Filled.Check, contentDescription = null) else Box(Modifier.size(24.dp)) },
        enabled = enabled,
        onClick = onClick,
        modifier = Modifier.semantics { stateDescription = stateText },
    )
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
            .semantics { contentDescription = "$label. $description" },
    ) {
        if (leading != null) {
            leading()
            Box(Modifier.width(6.dp))
        }
        Text(label, fontWeight = FontWeight.Medium, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** A tool button that opens its own menu. */
@Composable
private fun MenuButton(
    label: String,
    description: String,
    enabled: Boolean = true,
    items: @Composable (dismiss: () -> Unit) -> Unit,
) {
    var open by remember { mutableStateOf(false) }
    Box {
        ToolButton(label = label, description = description, onClick = { open = true }, enabled = enabled)
        DropdownMenu(expanded = open, onDismissRequest = { open = false }) {
            items { open = false }
        }
    }
}

/** A quiet status line. */
@Composable
fun StatusText(text: String, modifier: Modifier = Modifier, color: Color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines: Int = Int.MAX_VALUE) {
    Text(text = text, style = MaterialTheme.typography.labelSmall, color = color, modifier = modifier, maxLines = maxLines, overflow = TextOverflow.Ellipsis)
}
