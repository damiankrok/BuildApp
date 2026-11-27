package com.buildplan.preview.ui

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.geometry.RoundRect
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.Layout
import androidx.compose.ui.layout.layout
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Constraints
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import com.buildplan.preview.R
import com.buildplan.preview.camera.ViewPreset
import com.buildplan.preview.progress.ConstructionStageKey
import com.buildplan.preview.progress.ProgressView
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.ViewerState
import com.buildplan.preview.scene.Visibility
import com.buildplan.preview.scene.VisibilityMode
import kotlin.math.roundToInt

/** The dock's two tiles (OWNER, variant C), each of which grows into its own panel. */
enum class DockPanel { LAYERS, STAGES }

/**
 * Where a panel stands open, in the workspace's own pixels: its start edge,
 * its bottom edge, its width and the tallest it may grow. Its height is its
 * content's, up to [maxHeight].
 */
@Immutable
data class PanelFrame(val x: Float, val bottom: Float, val width: Float, val maxHeight: Float)

/** The progress (0 tile … 1 panel) at which the tile's own content has faded out, and the panel's starts to come in. */
internal const val TILE_GONE_AT = 0.3f
internal const val PANEL_FROM = 0.3f

/** The tile's content, by progress: there at rest, gone by the time the glass has grown a third of the way. */
internal fun tileAlpha(p: Float): Float = (1f - p / TILE_GONE_AT).coerceIn(0f, 1f)

/** The panel's content, by progress: only once the glass is large enough to read as the panel. */
internal fun panelAlpha(p: Float): Float = ((p - PANEL_FROM) / (1f - PANEL_FROM)).coerceIn(0f, 1f)

internal fun lerp(a: Float, b: Float, t: Float): Float = a + (b - a) * t

/**
 * The rectangle the morphing glass occupies at progress [p], in the workspace's pixels, given the tile it
 * starts from, the panel's frame and the panel's own height. Its start edge and its bottom edge travel from
 * the tile's to the panel's; width and height grow — so the surface rises out of its tile and never jumps.
 */
internal fun morphRect(tile: Rect, frame: PanelFrame, panelHeight: Float, p: Float): Rect {
    val width = lerp(tile.width, frame.width, p)
    val height = lerp(tile.height, panelHeight.coerceAtMost(frame.maxHeight), p)
    val left = lerp(tile.left, frame.x, p)
    val bottom = lerp(tile.bottom, frame.bottom, p)
    return Rect(left, bottom - height, left + width, bottom)
}

/**
 * One piece of glass that is a dock tile at progress 0 and its panel at 1.
 *
 * There is never a second surface: the tile IS this glass at rest, and opening
 * grows the same glass — position, size, corner radius — into the panel, while
 * the tile's words fade out early and the panel's come in once there is room
 * for them (a container transform). The progress is read only in layout and
 * draw, so a frame of the morph re-lays out one node and recomposes nothing.
 * The rectangles are read fresh on every layout, so a window that changes
 * width or turns mid-morph moves the glass with it instead of finishing on a
 * stale rectangle. The glass is solid to the finger over its whole area at
 * every step, and nothing outside it is.
 */
@Composable
fun MorphSurface(
    progress: () -> Float,
    /** The tile's slot in the dock, measured; null until the dock has been laid out. */
    tile: Rect?,
    frame: PanelFrame?,
    /** The tile's words are composed (false only while the panel stands fully open). */
    tileShown: Boolean,
    /** The panel's content is composed (only while the glass is opening, open or closing). */
    panelShown: Boolean,
    tileContent: @Composable () -> Unit,
    panelContent: @Composable () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (tile == null || frame == null || tile.isEmpty) return
    val density = LocalDensity.current
    val read by rememberUpdatedState(progress)
    val shape = remember(density) {
        MorphShape(from = with(density) { Radius.tile.toPx() }, to = with(density) { Radius.panel.toPx() }) { read() }
    }
    val tileW = tile.width.roundToInt()
    val tileH = tile.height.roundToInt()
    val panelW = frame.width.roundToInt()
    val panelMax = frame.maxHeight.roundToInt().coerceAtLeast(tileH)
    val lift = with(density) { PANEL_LIFT.toPx() }
    Layout(
        contents = listOf(
            {
                if (tileShown) {
                    Box(Modifier.graphicsLayer { alpha = tileAlpha(read()) }) { tileContent() }
                }
            },
            {
                if (panelShown) {
                    Box(
                        Modifier.graphicsLayer {
                            val a = panelAlpha(read())
                            alpha = a
                            translationY = (1f - a) * lift
                        },
                    ) { panelContent() }
                }
            },
        ),
        modifier = modifier
            // Placed in the workspace's own coordinates: this node fills it, the glass after it is only the rectangle.
            .layout { measurable, constraints ->
                val placeable = measurable.measure(Constraints())
                layout(constraints.maxWidth, constraints.maxHeight) {
                    val p = read()
                    val left = lerp(tile.left, frame.x, p)
                    val bottom = lerp(tile.bottom, frame.bottom, p)
                    placeable.place(left.roundToInt(), (bottom - placeable.height).roundToInt())
                }
            }
            .solidToFinger()
            .matteGlass(shape, tint = { lerp(Palette.Glass, Palette.GlassDense, read()) }, depth = Depth.tile),
    ) { (tileMeasurables, panelMeasurables), _ ->
        val p = read()
        val panel = panelMeasurables.firstOrNull()?.measure(Constraints(minWidth = panelW, maxWidth = panelW, maxHeight = panelMax))
        val words = tileMeasurables.firstOrNull()?.measure(Constraints.fixed(tileW, tileH))
        val rect = morphRect(tile, frame, (panel?.height ?: tileH).toFloat(), p)
        val width = rect.width.roundToInt().coerceAtLeast(1)
        val height = rect.height.roundToInt().coerceAtLeast(1)
        layout(width, height) {
            // The tile's words stay where the tile was (its bottom-start corner); the panel's ride with the glass's top.
            words?.place(0, height - tileH)
            panel?.place(0, 0)
        }
    }
}

/** How far the panel's content rises into place as it fades in. */
private val PANEL_LIFT = 8.dp

/** A rounded rectangle whose corner follows the morph: the tile's radius at rest, the panel's when open. */
private class MorphShape(private val from: Float, private val to: Float, private val progress: () -> Float) : Shape {
    override fun createOutline(size: Size, layoutDirection: LayoutDirection, density: Density): Outline {
        val r = lerp(from, to, progress()).coerceAtMost(minOf(size.width, size.height) / 2f)
        return Outline.Rounded(RoundRect(0f, 0f, size.width, size.height, CornerRadius(r)))
    }
}

// ---------------------------------------------------------------------------
// The tiles
// ---------------------------------------------------------------------------

/**
 * The words of the layers tile: the layers mark, the layer shown NOW ("Cały
 * dom", "Bez dachu", "Tylko: Ściana") and the chevron that says it opens.
 * [interactive] is false for the invisible copy the dock measures its slot by.
 */
@Composable
fun LayersTileContent(state: ViewerState, isolatedName: String?, interactive: Boolean, onOpen: () -> Unit) {
    val label = when {
        state.isIsolating && isolatedName != null -> stringResource(R.string.layer_isolated_named, isolatedName)
        state.isIsolating -> stringResource(R.string.layer_rail_isolated)
        else -> stringResource(state.visibility.railLabelRes())
    }
    val spoken = stringResource(R.string.tool_state_layers, label)
    TileRow(
        interactive = interactive,
        onClick = onOpen,
        onClickLabel = stringResource(R.string.dock_layers_open),
        state = spoken,
    ) {
        Icon(ShellIcons.layers, contentDescription = null, tint = Palette.Ink, modifier = Modifier.size(Sizes.icon))
        Text(label, style = MaterialTheme.typography.titleSmall, color = Palette.Ink, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
        Icon(ShellIcons.chevronDown, contentDescription = null, tint = Palette.InkMuted, modifier = Modifier.size(Sizes.iconSmall))
    }
}

/**
 * The words of the stages tile. At rest: "Etapy", and the saved percentage
 * only when one is saved — nothing is invented while progress is unset. While
 * a stage is previewed: the hollow preview mark, "Podgląd: Ściany" and the
 * one-tap way back, so a look into the past is never mistaken for the build.
 */
@Composable
fun StagesTileContent(view: ProgressView?, interactive: Boolean, onOpen: () -> Unit, onReturn: () -> Unit) {
    val stop = view?.previewStop
    val names = view?.let { stopNames(it.stages) }
    val previewName = stop?.let { names?.getOrNull(it) }
    if (view != null && previewName != null) {
        val returnLabel = stringResource(if (view.summary.unset) R.string.timeline_return_design else R.string.timeline_return_now)
        val text = stringResource(R.string.timeline_preview_of, previewName)
        Row(verticalAlignment = Alignment.CenterVertically) {
            TileRow(interactive = interactive, onClick = onOpen, onClickLabel = stringResource(R.string.dock_stages_open), state = text, modifier = Modifier.weight(1f, fill = false), end = Space.xs) {
                PreviewMark()
                // Two short lines rather than one long one: "Podgląd" over the stage's name, so the name is never cut.
                Column(Modifier.weight(1f, fill = false)) {
                    Text(stringResource(R.string.dock_preview), style = MaterialTheme.typography.labelMedium, color = Palette.InkMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    Text(previewName, style = MaterialTheme.typography.titleSmall, color = Palette.Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
            IconButton(
                onClick = onReturn,
                enabled = interactive,
                modifier = Modifier.size(Sizes.touch).semantics { contentDescription = returnLabel },
            ) {
                Icon(ShellIcons.close, contentDescription = null, tint = Palette.Ink, modifier = Modifier.size(Sizes.iconSmall))
            }
        }
        return
    }
    val percent = view?.summary?.takeIf { !it.unset }?.percentText
    val spoken = percent ?: stringResource(R.string.progress_unset)
    TileRow(interactive = interactive, onClick = onOpen, onClickLabel = stringResource(R.string.dock_stages_open), state = spoken) {
        Icon(ShellIcons.rule, contentDescription = null, tint = Palette.Ink, modifier = Modifier.size(Sizes.icon))
        Text(stringResource(R.string.dock_stages), style = MaterialTheme.typography.titleSmall, color = Palette.Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
        if (percent != null) {
            Text(percent, style = Measure.inline, color = Palette.Accent, maxLines = 1)
        }
    }
}

/** A tile's row: a 56 dp touch target, its words, and its state for TalkBack. */
@Composable
private fun TileRow(
    interactive: Boolean,
    onClick: () -> Unit,
    onClickLabel: String,
    state: String,
    modifier: Modifier = Modifier,
    end: androidx.compose.ui.unit.Dp = Space.l,
    content: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit,
) {
    Row(
        modifier = modifier
            .heightIn(min = Sizes.tile)
            .then(
                if (interactive) {
                    Modifier
                        .clickable(role = Role.Button, onClickLabel = onClickLabel, onClick = onClick)
                        .semantics(mergeDescendants = true) { stateDescription = state }
                } else {
                    Modifier
                },
            )
            .padding(start = Space.l, end = end),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.s),
        content = content,
    )
}

// ---------------------------------------------------------------------------
// The panels
// ---------------------------------------------------------------------------

/** A panel's head, outside its scroll: the mark, what it is, and the one way to close it. */
@Composable
private fun PanelTop(icon: ImageVector, title: String, onClose: () -> Unit, supporting: String? = null) {
    Row(Modifier.fillMaxWidth().padding(start = Space.l, end = Space.xs, top = Space.xs), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = Palette.Ink, modifier = Modifier.size(Sizes.icon))
        Column(Modifier.weight(1f).padding(start = Space.m, top = Space.xs, bottom = Space.xs)) {
            Text(title, style = MaterialTheme.typography.titleMedium, color = Palette.Ink, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.semantics { heading() })
            if (supporting != null) {
                Text(supporting, style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }
        val close = stringResource(R.string.pane_close)
        IconButton(onClick = onClose, modifier = Modifier.size(Sizes.touch).semantics { contentDescription = close }) {
            Icon(ShellIcons.close, contentDescription = null, tint = Palette.InkMuted, modifier = Modifier.size(Sizes.iconSmall))
        }
    }
}

/** The four layers the dock offers, in the owner's words, with their marks. Others stay in the full tool sheet. */
private val DockLayers = listOf(
    VisibilityMode.ALL to ShellIcons.house,
    VisibilityMode.ROOF_OFF to ShellIcons.roofOff,
    VisibilityMode.GROUND_ONLY to ShellIcons.groundFloor,
    VisibilityMode.UPPER_ONLY to ShellIcons.attic,
)

/** The views the Widok row offers: the three-quarter view, the four sides, the roof from above, the parallel view. */
private val DockViews = listOf(ViewPreset.WHOLE, ViewPreset.FRONT, ViewPreset.REAR, ViewPreset.LEFT, ViewPreset.RIGHT, ViewPreset.TOP, ViewPreset.AXONOMETRIC)

/** The Widok row's name for a view: the three-quarter view is the perspective; any other, its own name. */
@Composable
private fun viewName(preset: ViewPreset?): String = when (preset) {
    null -> stringResource(R.string.view_custom)
    ViewPreset.WHOLE -> stringResource(R.string.view_perspective)
    else -> stringResource(preset.labelRes())
}

/**
 * The Warstwy panel: the four layers as cards (the chosen one in mint, with a
 * check and a heavier label — never the colour alone), what the chosen layer
 * leaves out in words taken from the filter itself, and the Widok row, which
 * names the view on screen and unfolds the camera's named views in place.
 * Choosing a layer keeps the panel open: what it says is the answer to the
 * choice. Choosing a view closes it ([onPreset] does), because the answer to
 * that is the house itself, which the open panel would cover.
 */
@Composable
fun LayersPanel(
    scene: ModelScene,
    state: ViewerState,
    shownView: ViewPreset?,
    wide: Boolean,
    onVisibility: (VisibilityMode) -> Unit,
    onShowAll: () -> Unit,
    onPreset: (ViewPreset) -> Unit,
    onClose: () -> Unit,
) {
    val available = remember(scene) { Visibility.availableModes(scene).toSet() }
    val presets = remember(scene) { ViewPreset.availableIn(scene).toSet() }
    var viewsOpen by rememberSaveable { mutableStateOf(false) }
    Column(Modifier.fillMaxWidth()) {
        PanelTop(ShellIcons.layers, stringResource(R.string.layers_panel_title), onClose)
        val scroll = rememberScrollState()
        Column(
            Modifier
                .weight(1f, fill = false)
                .fadeBelowFold(scroll, Palette.GlassDense)
                .verticalScroll(scroll)
                .padding(start = Space.m, end = Space.m, bottom = Space.m),
            verticalArrangement = Arrangement.spacedBy(Space.s),
        ) {
            val cards = DockLayers.filter { it.first in available }
            for (row in cards.chunked(if (wide) 4 else 2)) {
                Row(horizontalArrangement = Arrangement.spacedBy(Space.s)) {
                    for ((mode, icon) in row) {
                        LayerCard(
                            icon = icon,
                            label = stringResource(mode.railLabelRes()),
                            selected = mode == state.visibility && !state.isIsolating,
                            onClick = { onVisibility(mode) },
                            modifier = Modifier.weight(1f),
                        )
                    }
                    // A short last row keeps the cards' width: the grid never stretches one card across.
                    repeat((if (wide) 4 else 2) - row.size) { Box(Modifier.weight(1f)) }
                }
            }
            HiddenLine(scene, state, onShowAll)
            PanelRule(inset = Space.xs)
            ViewRow(
                name = viewName(shownView),
                open = viewsOpen,
                onToggle = { viewsOpen = !viewsOpen },
            )
            val motion = LocalMotionPolicy.current
            AnimatedVisibility(visible = viewsOpen, enter = motion.foldEnter(), exit = motion.foldExit()) {
                // One row that scrolls sideways: the panel stays low enough to leave the house in view.
                val chips = rememberScrollState()
                Row(
                    horizontalArrangement = Arrangement.spacedBy(Space.s),
                    modifier = Modifier
                        .fillMaxWidth()
                        .fadePastEnd(chips, Palette.GlassDense)
                        .horizontalScroll(chips)
                        .padding(horizontal = Space.xs),
                ) {
                    for (preset in DockViews.filter { it in presets }) {
                        ViewChip(
                            viewName(preset),
                            selected = preset == shownView,
                            onClick = {
                                viewsOpen = false
                                onPreset(preset)
                            },
                        )
                    }
                }
            }
        }
    }
}

/** One layer: its mark and name on a card; chosen, a mint rim, a quiet wash, a check and a heavier label. */
@Composable
private fun LayerCard(icon: ImageVector, label: String, selected: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(Radius.control)
    Row(
        modifier = modifier
            .heightIn(min = Sizes.tile)
            .background(if (selected) Palette.AccentWash else Palette.CardFill, shape)
            .border(if (selected) 1.5.dp else 1.dp, if (selected) Palette.Accent else Palette.GlassRimHigh, shape)
            .selectable(selected = selected, onClick = onClick, role = Role.RadioButton)
            .padding(horizontal = Space.m, vertical = Space.s),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.s),
    ) {
        Icon(icon, contentDescription = null, tint = if (selected) Palette.Accent else Palette.Ink, modifier = Modifier.size(Sizes.icon))
        Text(
            label,
            style = MaterialTheme.typography.bodyMedium,
            color = Palette.Ink,
            fontWeight = if (selected) FontWeight.SemiBold else null,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
            modifier = Modifier.weight(1f),
        )
        if (selected) Icon(ShellIcons.check, contentDescription = null, tint = Palette.Accent, modifier = Modifier.size(Sizes.iconSmall))
    }
}


/**
 * What the layers leave out now, in words taken from the filter (true for any
 * building), and — when anything is left out — the one way back to the whole
 * house. Isolation is said the same way.
 */
@Composable
private fun HiddenLine(scene: ModelScene, state: ViewerState, onShowAll: () -> Unit) {
    val hidden = remember(scene, state.visibility) { Visibility.hidden(scene, state.visibility).wordsRes() }
    val isolatedName = state.isolatedObjectId?.let { scene.objectById(it) }?.let { elementTitle(it) }
    val whole = state.visibility == VisibilityMode.ALL && !state.isIsolating
    Row(
        // A touch target's height only when the line carries its button; the plain sentence stays one line high.
        Modifier.fillMaxWidth().heightIn(min = if (whole) 0.dp else Sizes.touch).padding(start = Space.xs, top = Space.xxs, bottom = Space.xxs),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.s),
    ) {
        Column(Modifier.weight(1f).semantics(mergeDescendants = true) {}) {
            if (state.isIsolating) {
                Text(
                    isolatedName?.let { stringResource(R.string.layer_isolated_named, it) } ?: stringResource(R.string.layer_isolated),
                    style = MaterialTheme.typography.bodyMedium,
                    color = Palette.Ink,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                )
            }
            Text(
                stringResource(if (state.isIsolating) R.string.layer_hidden_isolated else hidden),
                style = MaterialTheme.typography.bodySmall,
                color = Palette.InkMuted,
                maxLines = 3,
                overflow = TextOverflow.Ellipsis,
            )
        }
        if (!whole) {
            LineButton(stringResource(R.string.layer_show_all), onClick = onShowAll)
        }
    }
}

/** "Widok · Perspektywa ⌄": the view on screen, named; tapping unfolds the named views under it. */
@Composable
private fun ViewRow(name: String, open: Boolean, onToggle: () -> Unit) {
    val stateText = stringResource(if (open) R.string.state_expanded else R.string.state_collapsed)
    Row(
        Modifier
            .fillMaxWidth()
            .heightIn(min = Sizes.touch)
            .clickable(role = Role.Button, onClickLabel = stringResource(R.string.view_change), onClick = onToggle)
            .semantics(mergeDescendants = true) { stateDescription = stateText }
            .padding(horizontal = Space.xs),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.s),
    ) {
        Icon(ShellIcons.view, contentDescription = null, tint = Palette.Ink, modifier = Modifier.size(Sizes.icon))
        Text(stringResource(R.string.view_row), style = MaterialTheme.typography.bodyMedium, color = Palette.Ink, modifier = Modifier.weight(1f))
        Text(name, style = MaterialTheme.typography.titleSmall, color = Palette.Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Icon(
            if (open) ShellIcons.chevronUp else ShellIcons.chevronDown,
            contentDescription = null,
            tint = Palette.InkMuted,
            modifier = Modifier.size(Sizes.iconSmall),
        )
    }
}

/** One named view: a pill; the one on screen with the mint rim and a check. */
@Composable
private fun ViewChip(label: String, selected: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(Radius.pill)
    Row(
        Modifier
            .heightIn(min = Sizes.touch)
            .background(if (selected) Palette.AccentWash else Palette.CardFill, shape)
            .border(if (selected) 1.5.dp else 1.dp, if (selected) Palette.Accent else Palette.GlassRimHigh, shape)
            .selectable(selected = selected, onClick = onClick, role = Role.RadioButton)
            .padding(horizontal = Space.l),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.xs),
    ) {
        if (selected) Icon(ShellIcons.check, contentDescription = null, tint = Palette.Accent, modifier = Modifier.size(Sizes.iconSmall))
        Text(label, style = MaterialTheme.typography.labelLarge, color = Palette.Ink, fontWeight = if (selected) FontWeight.SemiBold else null, maxLines = 1)
    }
}

/**
 * The Etapy panel: what is saved, said once at its head (and nothing when
 * nothing is — no percentage, stage or date is ever invented); the
 * construction axis, whose scrub only PREVIEWS a stage; while previewing, a
 * line that says so with the way back; and the stages, each opening in place
 * to be edited by explicit actions. The axis drags sideways and the list
 * scrolls up and down, so scrolling the list can never move the axis or an
 * editor — completion is changed by steps and saved by its own button.
 */
@Composable
fun StagesPanel(progress: ProgressViewModel, onShowInModel: (ConstructionStageKey?) -> Unit, onClose: () -> Unit) {
    val view = progress.view
    Column(Modifier.fillMaxWidth()) {
        PanelTop(ShellIcons.rule, stringResource(R.string.stages_panel_title), onClose, supporting = view?.let { savedLine(it) })
        if (view == null) {
            Text(stringResource(R.string.house_loading), style = MaterialTheme.typography.bodyMedium, color = Palette.InkMuted, modifier = Modifier.padding(Space.l))
            return@Column
        }
        val names = stopNames(view.stages)
        val returnLabel = stringResource(if (view.summary.unset) R.string.timeline_return_design else R.string.timeline_return_now)
        FoldingRule(
            stages = view.stages,
            nowStop = view.nowStop,
            previewStop = view.previewStop,
            onScrub = { progress.previewStop(it) },
            onReturnToNow = if (view.previewStop != null) ({ progress.returnToNow() }) else null,
            returnToNowLabel = returnLabel,
            description = stringResource(R.string.timeline_rule_description),
            stateText = view.previewStop?.let { stringResource(R.string.timeline_preview_of, names[it]) }
                ?: (view.summary.percentText ?: stringResource(R.string.timeline_target)),
            stopName = { names[it] },
            modifier = Modifier.padding(horizontal = Space.l).padding(top = Space.s),
        )
        val motion = LocalMotionPolicy.current
        AnimatedContent(
            targetState = view.previewStop,
            transitionSpec = { fadeIn(motion.enterDelayed()) togetherWith fadeOut(motion.exit()) },
            label = "stagesPanelLine",
        ) { stop ->
            Row(
                Modifier.fillMaxWidth().heightIn(min = Sizes.touch).padding(start = Space.l, end = Space.m, top = Space.xs),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(Space.s),
            ) {
                if (stop != null) {
                    PreviewMark()
                    Column(Modifier.weight(1f)) {
                        Text(stringResource(R.string.timeline_preview_of, names[stop]), style = MaterialTheme.typography.titleSmall, color = Palette.Ink, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        Text(stringResource(R.string.stages_panel_preview_note), style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    }
                    LineButton(returnLabel, onClick = { progress.returnToNow() }, borderColor = Palette.Ink)
                } else if (view.summary.unset) {
                    Text(stringResource(R.string.stages_panel_design), style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted, maxLines = 4, overflow = TextOverflow.Ellipsis)
                } else {
                    Text(stringResource(R.string.stages_panel_now, nowWords(view)), style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted, maxLines = 2, overflow = TextOverflow.Ellipsis)
                }
            }
        }
        PanelRule(Modifier.padding(top = Space.xs))
        StagesScreen(progress, onShowInModel, modifier = Modifier.weight(1f, fill = false), compact = true)
    }
}

/** The head's second line: the saved percentage, the stage and the date; or plainly that nothing is set. */
@Composable
private fun savedLine(view: ProgressView): String {
    val summary = view.summary
    val percent = summary.percentText
    if (summary.unset || percent == null) return stringResource(R.string.progress_unset)
    val date = summary.savedAtEpochMs?.let { stringResource(R.string.progress_saved_on, savedDate(it)) }
    return listOfNotNull(percent, date).joinToString(" · ")
}

/** "Dach · w toku 40 %" or "ostatnio zakończony: Fundamenty": the stage the saved record stands at. */
@Composable
private fun nowWords(view: ProgressView): String {
    val summary = view.summary
    summary.currentStage?.let { stage ->
        val name = stringResource(stage.labelRes())
        return summary.currentStageCompletionPercent?.let { "$name · ${stringResource(R.string.progress_stage_in_progress, it)}" } ?: name
    }
    summary.lastDone?.let { return stringResource(R.string.progress_last_done, stringResource(it.labelRes())) }
    return summary.percentText.orEmpty()
}

/** The workspace's height below which the panels open beside the dock instead of above it (a phone on its side). */
internal val DOCK_SIDE_BELOW = 480.dp

/** The widest a panel grows: on a phone upright it is the dock's width; on a wide window, a readable column. */
internal val PANEL_MAX_WIDTH = 440.dp
internal val PANEL_SIDE_WIDTH = 400.dp

/** Upright, the open panel leaves the top of the house in view: at most this share of the workspace's height. */
internal const val PANEL_MAX_SHARE = 0.62f
