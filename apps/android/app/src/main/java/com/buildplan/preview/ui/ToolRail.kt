package com.buildplan.preview.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.SizeTransform
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.isTraversalGroup
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.buildplan.preview.R
import com.buildplan.preview.camera.ViewPreset
import com.buildplan.preview.presentation.PresentationMode
import com.buildplan.preview.render.RenderStyle
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.ViewerState
import com.buildplan.preview.scene.VisibilityMode

/** The rail's tools, grouped by meaning: how it looks, what is shown, where the camera is, fit. */
enum class Tool { LOOK, LAYERS, VIEW, FIT }

/**
 * The tool rail down the right edge of the 3D, and the one pane that unfolds
 * beside it.
 *
 * Four labelled buttons, never a row of mystery glyphs: Wygląd, Warstwy,
 * Widok, Dopasuj. A button's label names the current choice once it is not
 * the default ("Makieta", "Bez dachu"), so the state is read, not recalled.
 * The pressed button sinks into the rail. Its pane grows out of it, over the
 * model, opaque because it carries a list; switching tools keeps one pane
 * and swaps its contents. Every choice in a pane is a mark and a word.
 */
@Composable
fun ToolRail(
    scene: ModelScene,
    state: ViewerState,
    open: Tool?,
    onOpen: (Tool?) -> Unit,
    onPreset: (ViewPreset) -> Unit,
    onPresentation: (PresentationMode) -> Unit,
    onStyle: (RenderStyle) -> Unit,
    onVisibility: (VisibilityMode) -> Unit,
    onIsolate: () -> Unit,
    onShowAll: () -> Unit,
    onReset: () -> Unit,
    paneMaxHeight: Dp,
    modifier: Modifier = Modifier,
) {
    val motion = LocalMotionPolicy.current
    Row(
        modifier = modifier.semantics { isTraversalGroup = true },
        horizontalArrangement = Arrangement.spacedBy(Space.s),
        verticalAlignment = Alignment.Top,
    ) {
        // The pane grows from the rail's side: rail and pane share their top edge.
        AnimatedVisibility(
            visible = open != null && open != Tool.FIT,
            enter = motion.panelEnter(TransformOrigin(1f, 0.1f)),
            exit = motion.panelExit(TransformOrigin(1f, 0.1f)),
        ) {
            GlassSurface(
                tint = Palette.GlassOpaque,
                modifier = Modifier.width(RailDefaults.PaneWidth).heightIn(max = paneMaxHeight),
            ) {
                AnimatedContent(
                    targetState = open,
                    transitionSpec = {
                        (fadeIn(motion.enterDelayed()) togetherWith fadeOut(motion.exit()))
                            .using(SizeTransform(clip = true) { _, _ -> motion.enter() })
                    },
                    label = "toolPane",
                ) { tool ->
                    Column {
                        val title = when (tool) {
                            Tool.LOOK -> R.string.tool_look
                            Tool.LAYERS -> R.string.tool_layers
                            Tool.VIEW -> R.string.tool_view
                            else -> R.string.tool_fit
                        }
                        PanelHeader(stringResource(title), stringResource(R.string.pane_close), onClose = { onOpen(null) })
                        val scroll = rememberScrollState()
                        Column(
                            Modifier
                                .fadeBelowFold(scroll, Palette.GlassOpaque)
                                .verticalScroll(scroll)
                                .padding(bottom = Space.s),
                        ) {
                            when (tool) {
                                Tool.LOOK -> LookPane(state, onPresentation, onStyle)
                                Tool.LAYERS -> LayersPane(state, onVisibility, onIsolate, onShowAll)
                                Tool.VIEW -> ViewPane(scene, onPreset, onReset)
                                else -> Unit
                            }
                        }
                    }
                }
            }
        }

        GlassSurface(shape = RoundedCornerShape(Radius.panel)) {
            Column(
                modifier = Modifier.padding(RailDefaults.Padding),
                verticalArrangement = Arrangement.spacedBy(RailDefaults.Gap),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                RailButton(
                    icon = ShellIcons.look,
                    label = if (state.presentation == PresentationMode.MODEL) stringResource(R.string.tool_look) else stringResource(state.presentation.labelRes()),
                    state = stringResource(R.string.tool_state_look, stringResource(state.presentation.labelRes())),
                    pressed = open == Tool.LOOK,
                    onClick = { onOpen(if (open == Tool.LOOK) null else Tool.LOOK) },
                )
                val layer = if (state.isIsolating) stringResource(R.string.layer_isolated) else stringResource(state.visibility.labelRes())
                RailButton(
                    icon = ShellIcons.layers,
                    label = if (state.visibility == VisibilityMode.ALL && !state.isIsolating) stringResource(R.string.tool_layers) else layer,
                    state = stringResource(R.string.tool_state_layers, layer),
                    pressed = open == Tool.LAYERS,
                    onClick = { onOpen(if (open == Tool.LAYERS) null else Tool.LAYERS) },
                )
                RailButton(
                    icon = ShellIcons.view,
                    label = stringResource(R.string.tool_view),
                    state = null,
                    pressed = open == Tool.VIEW,
                    onClick = { onOpen(if (open == Tool.VIEW) null else Tool.VIEW) },
                )
                RailButton(
                    icon = ShellIcons.fit,
                    label = stringResource(R.string.tool_fit),
                    state = null,
                    pressed = false,
                    onClick = {
                        onOpen(null)
                        onPreset(ViewPreset.FIT)
                    },
                )
            }
        }
    }
}

object RailDefaults {
    val ButtonWidth = 64.dp
    val ButtonHeight = 60.dp
    val Padding = 4.dp
    val Gap = 2.dp
    val PaneWidth = 236.dp
}

/** One labelled tool. Pressed, it sinks into the rail — a well, not a colour. */
@Composable
private fun RailButton(icon: ImageVector, label: String, state: String?, pressed: Boolean, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .width(RailDefaults.ButtonWidth)
            .heightIn(min = RailDefaults.ButtonHeight)
            .background(if (pressed) Palette.Well else androidx.compose.ui.graphics.Color.Transparent, RoundedCornerShape(Radius.control))
            .selectable(selected = pressed, onClick = onClick, role = Role.Button)
            .semantics { if (state != null) stateDescription = state }
            .padding(vertical = Space.xs, horizontal = Space.xxs),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Icon(icon, contentDescription = null, tint = if (pressed) Palette.Ink else Palette.InkMuted, modifier = Modifier.size(Sizes.icon))
        Text(
            label,
            style = MaterialTheme.typography.labelSmall,
            color = if (pressed) Palette.Ink else Palette.InkMuted,
            textAlign = TextAlign.Center,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.padding(top = Space.xxs),
        )
    }
}

@Composable
private fun LookPane(state: ViewerState, onPresentation: (PresentationMode) -> Unit, onStyle: (RenderStyle) -> Unit) {
    for (mode in PresentationMode.entries) {
        PanelOption(
            label = stringResource(mode.labelRes()),
            supporting = stringResource(mode.descriptionRes()),
            selected = mode == state.presentation,
            onClick = { onPresentation(mode) },
        )
    }
    if (state.presentation.usesStyle) {
        PanelRule()
        PanelGroupLabel(stringResource(R.string.tool_look_light))
        for (style in RenderStyle.entries) {
            PanelOption(stringResource(style.labelRes()), selected = style == state.style, onClick = { onStyle(style) })
        }
    }
}

@Composable
private fun LayersPane(state: ViewerState, onVisibility: (VisibilityMode) -> Unit, onIsolate: () -> Unit, onShowAll: () -> Unit) {
    for (mode in VisibilityMode.entries) {
        PanelOption(stringResource(mode.labelRes()), selected = mode == state.visibility && !state.isIsolating, onClick = { onVisibility(mode) })
    }
    PanelRule()
    PanelOption(
        label = stringResource(R.string.layer_isolated),
        supporting = if (state.selectedObjectId == null) stringResource(R.string.layer_isolated_needs_selection) else null,
        selected = state.isIsolating,
        enabled = state.selectedObjectId != null || state.isIsolating,
        onClick = onIsolate,
    )
    PanelAction(stringResource(R.string.layer_show_all), onClick = onShowAll)
}

@Composable
private fun ViewPane(scene: ModelScene, onPreset: (ViewPreset) -> Unit, onReset: () -> Unit) {
    val available = ViewPreset.availableIn(scene).toSet()
    fun group(label: Int, presets: List<ViewPreset>) = label to presets.filter { it in available }
    val groups = listOf(
        group(R.string.view_group_whole, listOf(ViewPreset.WHOLE)),
        group(R.string.view_group_elevations, listOf(ViewPreset.FRONT, ViewPreset.REAR, ViewPreset.LEFT, ViewPreset.RIGHT)),
        group(R.string.view_group_above, listOf(ViewPreset.TOP, ViewPreset.GROUND_PLAN, ViewPreset.ATTIC_PLAN)),
        group(R.string.view_group_parallel, listOf(ViewPreset.AXONOMETRIC, ViewPreset.ISOMETRIC)),
        group(R.string.view_group_places, listOf(ViewPreset.STAIRS, ViewPreset.ENTRANCE)),
    )
    for ((label, presets) in groups) {
        if (presets.isEmpty()) continue
        if (label != R.string.view_group_whole) PanelGroupLabel(stringResource(label))
        for (preset in presets) PanelAction(stringResource(preset.labelRes()), onClick = { onPreset(preset) }, supporting = preset.supportingRes()?.let { stringResource(it) })
    }
    PanelRule()
    PanelAction(stringResource(R.string.view_reset), onClick = onReset, supporting = stringResource(R.string.view_reset_detail))
}

/** A second line only where two presets would otherwise read as synonyms. */
private fun ViewPreset.supportingRes(): Int? = when (this) {
    ViewPreset.AXONOMETRIC -> R.string.view_axonometric_detail
    ViewPreset.ISOMETRIC -> R.string.view_isometric_detail
    else -> null
}
