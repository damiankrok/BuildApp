package com.buildplan.preview.ui

import androidx.activity.compose.BackHandler
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.input.pointer.PointerEventPass
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.semantics.paneTitle
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.sp
import com.buildplan.preview.progress.ProgressAvailability
import com.buildplan.preview.progress.StageProgressMetric
import androidx.compose.animation.AnimatedContent
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
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.selection.selectableGroup
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
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.Immutable
import androidx.compose.runtime.derivedStateOf
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
import androidx.compose.ui.graphics.CompositingStrategy
import androidx.compose.animation.core.tween
import androidx.compose.foundation.LocalIndication
import androidx.compose.foundation.interaction.collectIsPressedAsState
import androidx.compose.foundation.interaction.MutableInteractionSource
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

/**
 * The dock and where its panels stand open, by arithmetic (round D): a function of the window alone. No label,
 * no open panel, no selection, no keyboard is an input, so nothing a tile shows or a panel does can move a slot,
 * a frame or anything laid out by them. Pure, so the rule is a unit test.
 */
@Immutable
data class DockLayout(
    val layersSlot: Rect,
    val stagesSlot: Rect,
    val layersFrame: PanelFrame,
    val stagesFrame: PanelFrame,
) {
    /** The dock's row: its left edge, width and top. */
    val left: Float get() = layersSlot.left
    val width: Float get() = stagesSlot.right - layersSlot.left
    val top: Float get() = layersSlot.top

    companion object {
        /** The Widok tile's share of the row; the Etapy tile takes the rest (both say two lines). */
        const val LAYERS_SHARE = 0.5f

        /**
         * [containerW] × [containerH]: the space inside the safe insets and the outer margin. [sidePanel]: a phone
         * on its side (the dock and its panels stand in one column at the start, the house beside it). [dockMaxW]:
         * the width a readable column allows. [headerBottom]: the foot of the header row, which an open panel never
         * covers.
         */
        fun of(
            containerW: Float,
            containerH: Float,
            sidePanel: Boolean,
            gap: Float,
            tileH: Float,
            headerBottom: Float,
            dockMaxW: Float,
        ): DockLayout {
            val dockW = minOf(containerW, dockMaxW)
            val dockLeft = if (sidePanel) 0f else ((containerW - dockW) / 2f).coerceAtLeast(0f)
            val dockTop = containerH - tileH
            val layersW = Math.round((dockW - gap) * LAYERS_SHARE).toFloat()
            val layersSlot = Rect(dockLeft, dockTop, dockLeft + layersW, containerH)
            val stagesSlot = Rect(dockLeft + layersW + gap, dockTop, dockLeft + dockW, containerH)
            val bottom = dockTop - gap
            // Never below one tile: a very short window still gets a glass that is at least the tile it grew from.
            val room = (bottom - headerBottom - gap).coerceAtLeast(tileH)
            // Both panels stand in the dock's own column, as wide as the row they grew out of: upright (also on a
            // tablet) under the house, on its side the whole height of the column beside the house (round D), so an
            // open panel never covers what it changes.
            val frame = if (sidePanel) {
                PanelFrame(dockLeft, bottom, dockW, room)
            } else {
                PanelFrame(dockLeft, bottom, dockW, minOf(room, (containerH * PANEL_MAX_SHARE).coerceAtLeast(tileH)))
            }
            return DockLayout(layersSlot, stagesSlot, frame, frame)
        }
    }
}

/*
 * The morph's path (round D). Two stages, so the glass never crosses the other tile:
 *  LIFT  (p 0 … LIFT_END): the tile rises straight up in its own column, its size unchanged, until its foot
 *        stands above the dock;
 *  GROW  (p GROW_FROM … 1): with its foot fixed above the dock, it widens and grows upward into the panel.
 * The two overlap a little (GROW_FROM < LIFT_END) so the motion is one gesture, not two; by GROW_FROM the foot is
 * already clear of the dock's top edge. The tile's words are gone during the lift; the panel's arrive only once
 * the glass is nearly the panel, pinned where they will stand and revealed by the growing edges — never sliding,
 * never readable while cut.
 */
internal const val LIFT_END = 0.45f
internal const val GROW_FROM = 0.38f
internal const val TILE_GONE_AT = 0.2f

internal fun smoothstep(x: Float): Float {
    val t = x.coerceIn(0f, 1f)
    return t * t * (3f - 2f * t)
}

/** How far the glass has risen out of its slot, 0 … 1. */
internal fun liftOf(p: Float): Float = smoothstep(p / LIFT_END)

/** How far the glass has grown from the tile into the panel, 0 … 1: corner, tint and depth follow this. */
internal fun growOf(p: Float): Float = smoothstep((p - GROW_FROM) / (1f - GROW_FROM))

/** The tile's words, by progress: there at rest, gone early in the lift. */
internal fun tileAlpha(p: Float): Float = (1f - p / TILE_GONE_AT).coerceIn(0f, 1f)

/** The panel's content, by progress: only once the glass is nearly the panel. */
internal fun panelAlpha(p: Float): Float = smoothstep((growOf(p) - PANEL_FROM_GROWTH) / (1f - PANEL_FROM_GROWTH))

/**
 * The panel's words arrive only once the glass has grown this much (round D): by then it already holds them, so
 * they are never seen cut by a growing edge — and a closing panel's words leave in its very first frames.
 */
internal const val PANEL_FROM_GROWTH = 0.93f

internal fun lerp(a: Float, b: Float, t: Float): Float = a + (b - a) * t

/**
 * The rectangle the morphing glass occupies at progress [p], in the workspace's pixels, given the tile it
 * starts from, the panel's frame and the panel's own height: first it rises in its own column (LIFT), then it
 * grows from there into the panel with its foot fixed (GROW). See [LIFT_END].
 */
internal fun morphRect(tile: Rect, frame: PanelFrame, panelHeight: Float, p: Float): Rect {
    val lift = liftOf(p)
    val grow = growOf(p)
    val bottom = lerp(tile.bottom, frame.bottom, lift)
    val height = lerp(tile.height, panelHeight.coerceAtMost(frame.maxHeight), grow)
    val left = lerp(tile.left, frame.x, grow)
    val width = lerp(tile.width, frame.width, grow)
    return Rect(left, bottom - height, left + width, bottom)
}

/**
 * One piece of glass that is a dock tile at progress 0 and its panel at 1.
 *
 * There is never a second surface: the tile IS this glass at rest, and opening
 * grows the same glass — position, size, corner radius, tint, depth — into the
 * panel along the two-stage path of [morphRect], so it never passes over the
 * other tile. The progress is read only in layout and draw, so a frame of the
 * morph re-lays out one node and recomposes nothing. The rectangles come from
 * the window's size alone (the dock is laid out by arithmetic, not measured),
 * so a window that turns mid-morph moves the glass with it, and nothing a tile
 * or a panel shows can move anything else. The glass is solid to the finger
 * over exactly its current rectangle, and nothing outside it is.
 */
@Composable
fun MorphSurface(
    progress: () -> Float,
    /** The tile's slot in the dock. */
    tile: Rect,
    frame: PanelFrame,
    /** The tile's words are composed (false only while the panel stands fully open). */
    tileShown: Boolean,
    /** The panel's content is composed (only while the glass is opening, open or closing). */
    panelShown: Boolean,
    tileContent: @Composable () -> Unit,
    panelContent: @Composable () -> Unit,
    modifier: Modifier = Modifier,
    /** The resting glass's opacity (the chrome steps back while a finger turns the model); an open panel stays. */
    restAlpha: () -> Float = { 1f },
) {
    if (tile.isEmpty) return
    val density = LocalDensity.current
    val read by rememberUpdatedState(progress)
    val rest by rememberUpdatedState(restAlpha)
    val shape = remember(density) {
        MorphShape(from = with(density) { Radius.tile.toPx() }, to = with(density) { Radius.panel.toPx() }) { growOf(read()) }
    }
    val tileW = tile.width.roundToInt()
    val tileH = tile.height.roundToInt()
    val panelW = frame.width.roundToInt()
    val panelMax = frame.maxHeight.roundToInt().coerceAtLeast(tileH)
    val rise = with(density) { PANEL_LIFT.toPx() }
    // Measured once per layout and shared with the placement below, so the content is pinned where it will stand.
    val geometry = remember { MorphGeometry() }
    Layout(
        contents = listOf(
            {
                if (tileShown) {
                    Box(Modifier.graphicsLayer { alpha = tileAlpha(read()) }) { tileContent() }
                }
            },
            {
                if (panelShown) {
                    // Live only once it stands open: a half-faded panel takes no tap and is not read out (round D).
                    val live by remember { derivedStateOf { read() >= PANEL_LIVE_AT } }
                    Box(
                        Modifier
                            .graphicsLayer {
                                val a = panelAlpha(read())
                                alpha = a
                                translationY = (1f - a) * rise
                            }
                            .pointerInput(Unit) {
                                awaitPointerEventScope {
                                    while (true) {
                                        val event = awaitPointerEvent(PointerEventPass.Initial)
                                        if (read() < PANEL_LIVE_AT) event.changes.forEach { it.consume() }
                                    }
                                }
                            }
                            .then(if (live) Modifier else Modifier.clearAndSetSemantics {}),
                    ) { panelContent() }
                }
            },
        ),
        modifier = modifier
            // Placed in the workspace's own coordinates: this node fills it, the glass after it is only the rectangle.
            .layout { measurable, constraints ->
                val placeable = measurable.measure(Constraints())
                layout(constraints.maxWidth, constraints.maxHeight) {
                    placeable.place(geometry.left, geometry.top)
                }
            }
            // On the glass-sized node: the resting tile recedes with the header, continuously with the morph.
            .graphicsLayer {
                alpha = lerp(rest(), 1f, growOf(read()))
                // Fade the drawing, not an offscreen copy clipped to the glass: the depth outside its edge stays.
                compositingStrategy = CompositingStrategy.ModulateAlpha
            }
            .solidToFinger()
            .matteGlass(
                shape,
                tint = { lerp(Palette.Glass, Palette.GlassDense, growOf(read())) },
                depth = { lerp(Depth.tile.value, Depth.panel.value, growOf(read())).dp },
            ),
    ) { (tileMeasurables, panelMeasurables), _ ->
        val p = read()
        val panel = panelMeasurables.firstOrNull()?.measure(Constraints(minWidth = panelW, maxWidth = panelW, maxHeight = panelMax))
        val words = tileMeasurables.firstOrNull()?.measure(Constraints.fixed(tileW, tileH))
        val panelH = (panel?.height ?: tileH).toFloat().coerceAtMost(frame.maxHeight)
        val rect = morphRect(tile, frame, panelH, p)
        // Integer edges first, sizes from them: the rim never shimmers by a pixel of independent rounding.
        val l = rect.left.roundToInt()
        val r = rect.right.roundToInt().coerceAtLeast(l + 1)
        val t = rect.top.roundToInt()
        val b = rect.bottom.roundToInt().coerceAtLeast(t + 1)
        geometry.left = l
        geometry.top = t
        layout(r - l, b - t) {
            // The tile's words stay at the tile's place in the glass's column; the panel's are pinned to where the
            // open panel stands, so the growing edges reveal them instead of carrying them.
            words?.place(tile.left.roundToInt() - l, (rect.bottom - tileH).roundToInt() - t)
            panel?.place(frame.x.roundToInt() - l, (frame.bottom - panelH).roundToInt() - t)
        }
    }
}

/** The glass's top-left corner, from the inner measurement to the outer placement of the same layout pass. */
private class MorphGeometry {
    var left = 0
    var top = 0
}

/** How far the panel's content rises into place as it fades in. */
private val PANEL_LIFT = 6.dp

/** The tile's "opens upward" mark beside its caption. */
private val CHEVRON_SIZE = 14.dp

/** From this much open the panel's content answers the finger and TalkBack. */
private const val PANEL_LIVE_AT = 0.95f

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

/** The mark of each layer, one family: a sectioned house, what is shown drawn solid, what is hidden faint. */
internal fun VisibilityMode.mark(): ImageVector = when (this) {
    VisibilityMode.ALL -> ShellIcons.layerAll
    VisibilityMode.ROOF_OFF -> ShellIcons.layerRoofOff
    VisibilityMode.GROUND_ONLY, VisibilityMode.CUTAWAY -> ShellIcons.layerGround
    VisibilityMode.UPPER_ONLY -> ShellIcons.layerUpper
}

/**
 * The layers tile (round D): a caption over a state, in one fixed rectangle — "Widok" over the layer shown
 * NOW ("Cały dom", "Bez dachu", "Tylko: Ściana"), with that layer's own mark and the chevron that says the
 * tile opens upward. A new state cross-fades in place; nothing about the tile's size depends on its words.
 */
@Composable
fun LayersTileContent(state: ViewerState, isolatedName: String?, interactive: Boolean, onOpen: () -> Unit, view: ViewPreset? = ViewPreset.WHOLE) {
    val layer = when {
        state.isIsolating && isolatedName != null -> stringResource(R.string.layer_isolated_named, isolatedName)
        state.isIsolating -> stringResource(R.string.layer_rail_isolated)
        else -> stringResource(state.visibility.railLabelRes())
    }
    // A named view other than the whole house in perspective is part of the answer (round D): "Z tyłu",
    // "Z tyłu · Bez dachu" — never "Cały dom" under an elevation, which would read as the view's name.
    val named = view?.takeIf { it != ViewPreset.WHOLE && it != ViewPreset.FIT }
    val label = when {
        named == null -> layer
        state.visibility == VisibilityMode.ALL && !state.isIsolating -> stringResource(named.labelRes())
        named.visibility != null -> stringResource(named.labelRes())
        else -> stringResource(R.string.dock_view_and_layer, stringResource(named.labelRes()), layer.replaceFirstChar { it.lowercase() })
    }
    val spoken = stringResource(R.string.tool_state_layers, label)
    val whole = state.visibility == VisibilityMode.ALL && !state.isIsolating
    TileRow(interactive = interactive, onClick = onOpen, onClickLabel = stringResource(R.string.dock_layers_open), state = spoken) {
        // A layer that leaves something out is marked in mint: the house is not whole now (said in words too).
        Icon(state.visibility.mark(), contentDescription = null, tint = if (whole) Palette.Ink else Palette.Accent, modifier = Modifier.size(Sizes.icon))
        TileWords(caption = stringResource(R.string.dock_view_caption), value = AnnotatedString(label), opens = true, modifier = Modifier.weight(1f))
    }
}

/**
 * The stages tile (round D), the same caption-over-state grammar: "Etapy" over where the build stands —
 * "Ściany · 40%" (the stage in progress and its own completion, the figure in mint Barlow), "Ostatni: Dach",
 * or "Nieustawione" — nothing invented while nothing is saved; the weighted percentage is the panel's. While a
 * stage is previewed: the hollow preview mark, "Podgląd" over the stage's name, and a 48 dp × that returns.
 */
@Composable
fun StagesTileContent(view: ProgressView?, interactive: Boolean, onOpen: () -> Unit, onReturn: () -> Unit) {
    val stop = view?.previewStop
    val names = view?.let { stopNames(it.stages) }
    val previewName = stop?.let { names?.getOrNull(it) }
    // The stage last previewed stays written while the preview form fades out (round D: a cross-fade, not a cut).
    val lastPreview = remember { mutableStateOf(previewName) }
    if (previewName != null) lastPreview.value = previewName
    val motion = LocalMotionPolicy.current
    androidx.compose.animation.Crossfade(
        targetState = view != null && previewName != null,
        animationSpec = motion.enter(),
        modifier = Modifier.fillMaxSize(),
        label = "stagesTile",
    ) { previewing ->
        val shownName = lastPreview.value
        if (previewing && view != null && shownName != null) {
            val returnLabel = stringResource(if (view.summary.unset) R.string.timeline_return_design else R.string.timeline_return_now)
            val text = stringResource(R.string.timeline_preview_of, shownName)
            TileRow(interactive = interactive, onClick = onOpen, onClickLabel = stringResource(R.string.dock_stages_open), state = text, end = 0.dp) {
                Box(Modifier.size(Sizes.icon), contentAlignment = Alignment.Center) { PreviewMark() }
                TileWords(caption = stringResource(R.string.dock_preview), value = AnnotatedString(shownName), modifier = Modifier.weight(1f))
                IconButton(onClick = onReturn, enabled = interactive, modifier = Modifier.size(Sizes.touch).semantics { contentDescription = returnLabel }) {
                    Icon(ShellIcons.close, contentDescription = null, tint = Palette.Ink, modifier = Modifier.size(Sizes.iconSmall))
                }
            }
        } else {
            StagesTileState(view, interactive, onOpen)
        }
    }
}

/** The Etapy tile at rest: "Etapy" over where the build stands. */
@Composable
private fun StagesTileState(view: ProgressView?, interactive: Boolean, onOpen: () -> Unit) {
    val summary = view?.summary
    val current = summary?.currentStage
    val value = when {
        summary == null || summary.unset -> AnnotatedString(stringResource(R.string.dock_stages_unset))
        current != null -> AnnotatedString(stringResource(current.labelRes()))
        summary.lastDone != null -> AnnotatedString(stringResource(R.string.dock_stages_last, stringResource(summary.lastDone.labelRes())))
        else -> AnnotatedString(summary.percentText.orEmpty())
    }
    // The stage's own completion stands after its name as a measured figure — no separator: the face says it is
    // a number. It is measured first, so the ellipsis cuts the name, never the figure.
    val figure = if (current != null) summary.currentStageCompletionPercent?.let { StageProgressMetric.format(it) } else null
    val spoken = listOfNotNull(value.text, figure).joinToString(", ")
    TileRow(interactive = interactive, onClick = onOpen, onClickLabel = stringResource(R.string.dock_stages_open), state = spoken) {
        Icon(ShellIcons.stages, contentDescription = null, tint = Palette.Ink, modifier = Modifier.size(Sizes.icon))
        TileWords(caption = stringResource(R.string.dock_stages), value = value, figure = figure, opens = true, modifier = Modifier.weight(1f))
    }
}

/**
 * A caption over a state, one line each; the state cross-fades in place when it changes, the size never does.
 * [opens]: the small chevron that says the tile opens upward stands beside the caption (round D), so the state
 * below has the tile's whole width.
 */
@Composable
private fun TileWords(caption: String, value: AnnotatedString, modifier: Modifier = Modifier, opens: Boolean = false, figure: String? = null) {
    val motion = LocalMotionPolicy.current
    Column(modifier) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.xxs)) {
            Text(caption, style = MaterialTheme.typography.labelMedium, color = Palette.InkMutedOnGlass, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
            if (opens) Icon(ShellIcons.chevronUp, contentDescription = null, tint = Palette.InkMutedOnGlass, modifier = Modifier.size(CHEVRON_SIZE))
        }
        AnimatedContent(
            targetState = value to figure,
            transitionSpec = { (fadeIn(motion.enter()) togetherWith fadeOut(motion.exit())).using(null) },
            contentAlignment = Alignment.CenterStart,
            label = "tileValue",
            modifier = Modifier.fillMaxWidth(),
        ) { (shown, measured) ->
            Row(verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(Space.s)) {
                Text(shown, style = MaterialTheme.typography.titleSmall, color = Palette.Ink, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f, fill = false))
                if (measured != null) {
                    Text(measured, style = Measure.inline.copy(fontSize = 18.sp, lineHeight = 20.sp), color = Palette.Accent, maxLines = 1, softWrap = false)
                }
            }
        }
    }
}

/** A tile's row: the whole tile is the button, its state spoken for TalkBack. */
@Composable
private fun TileRow(
    interactive: Boolean,
    onClick: () -> Unit,
    onClickLabel: String,
    state: String,
    modifier: Modifier = Modifier,
    end: androidx.compose.ui.unit.Dp = Space.m,
    content: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit,
) {
    Row(
        modifier = modifier
            .fillMaxSize()
            .then(
                if (interactive) {
                    Modifier
                        .clickable(role = Role.Button, onClickLabel = onClickLabel, onClick = onClick)
                        .semantics(mergeDescendants = true) { stateDescription = state }
                } else {
                    Modifier
                },
            )
            .padding(start = Space.m, end = end),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.s + Space.xxs),
        content = content,
    )
}

// ---------------------------------------------------------------------------
// The panels
// ---------------------------------------------------------------------------

/** A panel's head, outside its scroll: the mark, what it is, and the one way to close it. */
@Composable
private fun PanelTop(icon: ImageVector, title: String, onClose: () -> Unit, supporting: String? = null) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(start = Space.l, end = Space.xs, top = Space.xs)
            .semantics { paneTitle = title },
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = Palette.Ink, modifier = Modifier.size(Sizes.icon))
        Column(Modifier.weight(1f).padding(start = Space.m, top = Space.xs, bottom = Space.xs)) {
            Text(title, style = MaterialTheme.typography.titleMedium, color = Palette.Ink, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.semantics { heading() })
            if (supporting != null) {
                Text(supporting, style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        val close = stringResource(R.string.pane_close)
        IconButton(onClick = onClose, modifier = Modifier.size(Sizes.touch).semantics { contentDescription = close }) {
            Icon(ShellIcons.close, contentDescription = null, tint = Palette.InkMuted, modifier = Modifier.size(Sizes.iconSmall))
        }
    }
}

/** A small section name inside a panel: sentence case, faint, a heading for TalkBack. */
@Composable
private fun SectionLabel(text: String, modifier: Modifier = Modifier, trailing: String? = null) {
    Row(modifier.fillMaxWidth().padding(horizontal = Space.xs), verticalAlignment = Alignment.CenterVertically) {
        Text(text, style = MaterialTheme.typography.labelMedium, color = Palette.InkFaint, modifier = Modifier.weight(1f).semantics { heading() })
        if (trailing != null) Text(trailing, style = MaterialTheme.typography.labelMedium, color = Palette.InkMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** The four layers the dock offers, in the owner's words. Others (Przekrój, isolation) stay in the tools sheet. */
private val DockLayers = listOf(VisibilityMode.ALL, VisibilityMode.ROOF_OFF, VisibilityMode.GROUND_ONLY, VisibilityMode.UPPER_ONLY)

/** The views the Widok panel offers, always in view: the three-quarter view, the four sides, from above, the two plans, the parallel view. */
private val DockViews = listOf(
    ViewPreset.WHOLE, ViewPreset.FRONT, ViewPreset.REAR, ViewPreset.LEFT, ViewPreset.RIGHT,
    ViewPreset.TOP, ViewPreset.GROUND_PLAN, ViewPreset.ATTIC_PLAN, ViewPreset.AXONOMETRIC,
)

/** The name of a view: the three-quarter view is the perspective; any other, its own name; a hand-turned camera, its own angle. */
@Composable
private fun viewName(preset: ViewPreset?): String = when (preset) {
    null -> stringResource(R.string.view_custom)
    ViewPreset.WHOLE -> stringResource(R.string.view_perspective)
    else -> stringResource(preset.labelRes())
}

/**
 * The Widok panel (round D): what is shown and from where, in one panel of a constant height — choosing never
 * moves the panel's head or the card under the finger. "Co widać": the four layers as cards in one row (mark
 * over name; the chosen one with a mint rim, a wash, a mint mark and a check — never the colour alone), and one
 * fixed-height line with what the chosen layer leaves out, in words from the filter, and "Pokaż wszystko".
 * "Skąd patrzysz": every named view as a chip, always in view, the one on screen checked. A layer is answered in
 * place; a view closes the panel ([onPreset] does), because its answer is the house.
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
    val haptics = androidx.compose.ui.platform.LocalHapticFeedback.current
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
            SectionLabel(stringResource(R.string.layers_what))
            // One choice among four, for TalkBack too: "1 z 4, zaznaczone". Four in a row while every name's longest
            // word fits its card at the current text size; otherwise two rows of two, so no word is ever broken
            // ("Poddasz-e" at large text). Decided by the width and the font alone, never by what is chosen (round D).
            val modes = DockLayers.filter { it in available }
            val labels = modes.map { stringResource(it.railLabelRes()) }
            val measurer = androidx.compose.ui.text.rememberTextMeasurer()
            val wordStyle = MaterialTheme.typography.labelLarge.copy(fontWeight = FontWeight.SemiBold)
            BoxWithConstraints(Modifier.fillMaxWidth()) {
                val density = LocalDensity.current
                val slot = with(density) { ((maxWidth - Space.s * 3) / 4 - Space.xs * 2).toPx() }
                val crowded = !wide && labels.any { label ->
                    label.split(' ').any { word -> measurer.measure(word, wordStyle).size.width > slot }
                }
                val rows = if (crowded) modes.indices.chunked(2) else listOf(modes.indices.toList())
                Column(Modifier.selectableGroup(), verticalArrangement = Arrangement.spacedBy(Space.s)) {
                    for (row in rows) {
                        Row(horizontalArrangement = Arrangement.spacedBy(Space.s)) {
                            for (i in row) {
                                val mode = modes[i]
                                LayerCard(
                                    icon = mode.mark(),
                                    label = labels[i],
                                    selected = mode == state.visibility && !state.isIsolating,
                                    wide = wide || crowded,
                                    onClick = {
                                        haptics.performHapticFeedback(androidx.compose.ui.hapticfeedback.HapticFeedbackType.TextHandleMove)
                                        onVisibility(mode)
                                    },
                                    modifier = Modifier.weight(1f),
                                )
                            }
                        }
                    }
                }
            }
            HiddenLine(scene, state, onShowAll)
            SectionLabel(stringResource(R.string.layers_from_where), modifier = Modifier.padding(top = Space.xs), trailing = viewName(shownView))
            val chips = rememberScrollState()
            Row(
                horizontalArrangement = Arrangement.spacedBy(Space.s),
                modifier = Modifier
                    .fillMaxWidth()
                    .selectableGroup()
                    .fadePastEnd(chips, Palette.GlassDense)
                    .horizontalScroll(chips),
            ) {
                for (preset in DockViews.filter { it in presets }) {
                    ViewChip(viewName(preset), selected = preset == shownView, onClick = { onPreset(preset) })
                }
            }
        }
    }
}

/**
 * One layer as a card: its mark over its name in one row of four (mark beside name when the panel is wide);
 * chosen, a mint rim, a quiet wash, a mint mark, a heavier name and a small check in the corner.
 */
@Composable
private fun LayerCard(icon: ImageVector, label: String, selected: Boolean, wide: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(Radius.control)
    val motion = LocalMotionPolicy.current
    val wash by animateColorAsState(if (selected) Palette.AccentWash else Palette.CardFill, motion.settle(), label = "cardWash")
    val rim by animateColorAsState(if (selected) Palette.Accent else Palette.GlassRimHigh, motion.settle(), label = "cardRim")
    val press = remember { MutableInteractionSource() }
    Box(
        // The dip scales the drawing only, inside the pointer node: the target under a finger never shrinks.
        modifier = modifier
            .heightIn(min = if (wide) Sizes.tile else LAYER_CARD_HEIGHT)
            .selectable(selected = selected, interactionSource = press, indication = LocalIndication.current, onClick = onClick, role = Role.RadioButton)
            .pressDip(press)
            .background(wash, shape)
            .border(if (selected) 1.5.dp else 1.dp, rim, shape),
    ) {
        if (wide) {
            Row(Modifier.align(Alignment.CenterStart).padding(horizontal = Space.m), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.s)) {
                Icon(icon, contentDescription = null, tint = if (selected) Palette.Accent else Palette.Ink, modifier = Modifier.size(Sizes.icon))
                Text(label, style = MaterialTheme.typography.bodyMedium, color = Palette.Ink, fontWeight = if (selected) FontWeight.SemiBold else null, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        } else {
            Column(
                Modifier.align(Alignment.Center).padding(horizontal = Space.xs, vertical = Space.s),
                horizontalAlignment = Alignment.CenterHorizontally,
                verticalArrangement = Arrangement.spacedBy(Space.xs),
            ) {
                Icon(icon, contentDescription = null, tint = if (selected) Palette.Accent else Palette.Ink, modifier = Modifier.size(Sizes.icon + Space.xs))
                Text(
                    label,
                    style = MaterialTheme.typography.labelLarge,
                    color = Palette.Ink,
                    fontWeight = if (selected) FontWeight.SemiBold else null,
                    // Always two lines tall: choosing (a heavier label that may wrap) never changes the card's height.
                    minLines = 2,
                    maxLines = 2,
                    overflow = TextOverflow.Ellipsis,
                    textAlign = androidx.compose.ui.text.style.TextAlign.Center,
                )
            }
        }
        if (selected) {
            Icon(ShellIcons.check, contentDescription = null, tint = Palette.Accent, modifier = Modifier.align(Alignment.TopEnd).padding(Space.xs).size(Space.l - Space.xxs))
        }
    }
}

/**
 * What the layers leave out now, in words taken from the filter (true for any building), and the one way back
 * to the whole house. Always the same height, with the button's place always laid out: choosing a layer never
 * moves anything in the panel.
 */
@Composable
private fun HiddenLine(scene: ModelScene, state: ViewerState, onShowAll: () -> Unit) {
    val hidden = remember(scene, state.visibility) { Visibility.hidden(scene, state.visibility).wordsRes() }
    val isolatedName = state.isolatedObjectId?.let { scene.objectById(it) }?.let { elementTitle(it) }
    val whole = state.visibility == VisibilityMode.ALL && !state.isIsolating
    val motion = LocalMotionPolicy.current
    val buttonAlpha by animateFloatAsState(if (whole) 0f else 1f, motion.settle(), label = "showAll")
    val words = when {
        state.isIsolating -> (isolatedName?.let { stringResource(R.string.layer_isolated_named, it) } ?: stringResource(R.string.layer_isolated)) +
            ". " + stringResource(R.string.layer_hidden_isolated)
        else -> stringResource(hidden)
    }
    Row(
        Modifier.fillMaxWidth().height(Sizes.touch).padding(start = Space.xs),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.s),
    ) {
        Text(words, style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted, maxLines = 2, overflow = TextOverflow.Ellipsis, modifier = Modifier.weight(1f))
        Box(Modifier.graphicsLayer { alpha = buttonAlpha }.then(if (whole) Modifier.clearAndSetSemantics {} else Modifier)) {
            LineButton(stringResource(R.string.layer_show_all), onClick = onShowAll, enabled = !whole)
        }
    }
}

/** One named view: a pill; the one on screen with the mint rim and a check. */
@Composable
private fun ViewChip(label: String, selected: Boolean, onClick: () -> Unit) {
    val shape = RoundedCornerShape(Radius.pill)
    val press = remember { MutableInteractionSource() }
    Row(
        Modifier
            .heightIn(min = Sizes.touch)
            .selectable(selected = selected, interactionSource = press, indication = LocalIndication.current, onClick = onClick, role = Role.RadioButton)
            .pressDip(press)
            .background(if (selected) Palette.AccentWash else Palette.CardFill, shape)
            .border(if (selected) 1.5.dp else 1.dp, if (selected) Palette.Accent else Palette.GlassRimHigh, shape)
            .padding(horizontal = Space.l),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.xs),
    ) {
        if (selected) Icon(ShellIcons.check, contentDescription = null, tint = Palette.Accent, modifier = Modifier.size(Sizes.iconSmall))
        Text(label, style = MaterialTheme.typography.labelLarge, color = Palette.Ink, fontWeight = if (selected) FontWeight.SemiBold else null, maxLines = 1)
    }
}

/**
 * The Etapy panel (round D). It opens LOW — the head (what is saved, and nothing when nothing is), the
 * construction axis, one line saying what the 3D shows, and the ways on: "Odtwórz budowę" and the list — so the
 * house it rewinds stays in view above it. The list of 17 stages opens on request, growing the same glass
 * upward; a preview folds it again, because the answer is in the 3D. The axis only PREVIEWS (nothing is saved),
 * the playback only previews, and every edit in the list is an explicit action.
 */
@Composable
fun StagesPanel(progress: ProgressViewModel, onShowInModel: (ConstructionStageKey?) -> Unit, onClose: () -> Unit, active: Boolean = true) {
    val view = progress.view
    var listOpen by rememberSaveable { mutableStateOf(false) }
    var playing by remember { mutableStateOf(false) }
    // Closed while playing (the house tapped, Back, the ×): the look back ends with the panel, never stranded on
    // whichever stage it had reached. A scrub stops the playback first, so its own preview stays.
    val stillPlaying by rememberUpdatedState(playing)
    DisposableEffect(Unit) { onDispose { if (stillPlaying) progress.returnToNow() } }
    val motion = LocalMotionPolicy.current
    // Only while this panel is the one asked for: a closing or handed-over panel leaves Back to the workspace.
    BackHandler(enabled = listOpen && active) { listOpen = false }
    Column(Modifier.fillMaxWidth().animateContentSize(motion.settle())) {
        PanelTop(ShellIcons.stages, stringResource(R.string.stages_panel_title), onClose, supporting = view?.let { savedLine(it) })
        if (view == null) {
            Text(stringResource(R.string.house_loading), style = MaterialTheme.typography.bodyMedium, color = Palette.InkMuted, modifier = Modifier.padding(Space.l))
            return@Column
        }
        val names = stopNames(view.stages)
        val returnLabel = stringResource(if (view.summary.unset) R.string.timeline_return_design else R.string.timeline_return_now)
        // A look back folds the list: the answer to a preview is the house, which the list would cover.
        LaunchedEffect(view.previewStop) { if (view.previewStop != null) listOpen = false }
        // "Odtwórz budowę": the preview steps through the stages that change the house, then back to what was shown.
        LaunchedEffect(playing) {
            if (!playing) return@LaunchedEffect
            val last = view.nowStop?.takeIf { !view.summary.unset } ?: (names.size - 1)
            val session = progress.session
            for (stop in 0..last) {
                val key = view.stages.getOrNull(stop)?.stageKey
                if (key != null && session?.projection?.hasGeometry(key) == false) continue
                progress.previewStop(stop)
                kotlinx.coroutines.delay(PLAYBACK_STEP_MS)
            }
            progress.returnToNow()
            playing = false
        }
        // Short frames (a phone on its side, split screen, large text): the axis, the line and the actions scroll
        // inside the panel instead of being cut; with the list open, they stand and the list scrolls (round D).
        Column(if (listOpen) Modifier else Modifier.weight(1f, fill = false).verticalScroll(rememberScrollState())) {
            FoldingRule(
                stages = view.stages,
                nowStop = view.nowStop,
                previewStop = view.previewStop,
                onScrub = {
                    playing = false
                    progress.previewStop(it)
                },
                onReturnToNow = if (view.previewStop != null) ({ playing = false; progress.returnToNow() }) else null,
                returnToNowLabel = returnLabel,
                description = stringResource(R.string.timeline_rule_description),
                stateText = view.previewStop?.let { stringResource(R.string.timeline_preview_of, names[it]) }
                    ?: (view.summary.percentText ?: stringResource(R.string.timeline_target)),
                stopName = { names[it] },
                modifier = Modifier.padding(horizontal = Space.l).padding(top = Space.s),
            )
            // One line, one fixed height, keyed on its KIND: scrubbing changes the stage's name in place and never
            // re-runs a transition or moves what is under it.
            val kind = when {
                view.previewStop != null -> LineKind.PREVIEW
                view.summary.unset -> LineKind.DESIGN
                else -> LineKind.NOW
            }
            // The stage last previewed, kept while the preview line fades out (it would otherwise go blank first).
            val lastPreview = remember { mutableStateOf(view.previewStop) }
            if (view.previewStop != null) lastPreview.value = view.previewStop
            AnimatedContent(
                targetState = kind,
                transitionSpec = { (fadeIn(motion.enter()) togetherWith fadeOut(motion.exit())).using(null) },
                label = "stagesPanelLine",
            ) { shown ->
                Row(
                    Modifier.fillMaxWidth().height(NOW_LINE_HEIGHT).padding(start = Space.l, end = Space.m),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(Space.s),
                ) {
                    when (shown) {
                        LineKind.PREVIEW -> {
                            PreviewMark()
                            Column(Modifier.weight(1f)) {
                                Text((view.previewStop ?: lastPreview.value)?.let { stringResource(R.string.timeline_preview_of, names[it]) }.orEmpty(), style = MaterialTheme.typography.titleSmall, color = Palette.Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                                Text(stringResource(R.string.stages_panel_preview_note), style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                            }
                            LineButton(returnLabel, onClick = { playing = false; progress.returnToNow() }, borderColor = Palette.Ink)
                        }
                        LineKind.DESIGN -> Text(stringResource(R.string.stages_panel_design), style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted, maxLines = 2, overflow = TextOverflow.Ellipsis)
                        LineKind.NOW -> Text(stringResource(R.string.stages_panel_now, nowWords(view)), style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted, maxLines = 2, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
            if (!listOpen) {
                // The ways on, in one row: play the build back, and open the stages to record where it is.
                Row(
                    Modifier.fillMaxWidth().padding(start = Space.m, end = Space.m, bottom = Space.m),
                    horizontalArrangement = Arrangement.spacedBy(Space.s),
                ) {
                    LineButton(
                        stringResource(if (playing) R.string.stages_play_stop else R.string.stages_play),
                        onClick = { if (playing) { playing = false; progress.returnToNow() } else playing = true },
                        icon = if (playing) ShellIcons.close else ShellIcons.play,
                        modifier = Modifier.weight(1f),
                    )
                    val editable = view.summary.availability == ProgressAvailability.EDITABLE
                    val listLabel = if (view.summary.unset && editable) stringResource(R.string.stages_set_where) else stringResource(R.string.stages_list_open, view.stages.size)
                    InkButton(
                        listLabel,
                        onClick = {
                            // The list replaces the playback: it stops and the house is back where it was.
                            if (playing) {
                                playing = false
                                progress.returnToNow()
                            }
                            listOpen = true
                        },
                        modifier = Modifier.weight(1f),
                    )
                }
            }
        }
        if (listOpen) {
            PanelRule(Modifier.padding(top = Space.xs))
            StagesScreen(progress, onShowInModel, modifier = Modifier.weight(1f, fill = false), compact = true)
        }
    }
}

/** What the Etapy panel's one line says: the design, the saved state, or a preview. */
private enum class LineKind { DESIGN, NOW, PREVIEW }

/** The head's second line: the saved weighted percentage and the date; or plainly that nothing is set. */
@Composable
private fun savedLine(view: ProgressView): String {
    val summary = view.summary
    val percent = summary.percentText
    if (summary.unset || percent == null) return stringResource(R.string.progress_unset)
    val date = summary.savedAtEpochMs?.let { stringResource(R.string.progress_saved_on, savedDate(it)) }
    return listOfNotNull(stringResource(R.string.stages_weighted, percent), date).joinToString(". ")
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

/** The widest a panel grows: on a phone upright it is the dock's width; on a wide window, a readable column. */
internal val PANEL_MAX_WIDTH = 440.dp


/** Upright, the open panel leaves the top of the house in view: at most this share of the workspace's height. */
internal const val PANEL_MAX_SHARE = 0.62f

/** A layer card's height in the row of four: the mark over a name of up to two lines. */
private val LAYER_CARD_HEIGHT = 76.dp

/** The Etapy panel's one line: always this tall, whatever it says. */
private val NOW_LINE_HEIGHT = 52.dp

/** How long "Odtwórz budowę" stays on each stage. */
private const val PLAYBACK_STEP_MS = 750L

/**
 * The press of a card or a chip (round D): it dips to [PRESS_SCALE] while the finger is on it and springs back —
 * drawn only (a layer scale), so nothing beside it moves; none with animations off.
 */
@Composable
private fun Modifier.pressDip(source: MutableInteractionSource): Modifier {
    val motion = LocalMotionPolicy.current
    val pressed by source.collectIsPressedAsState()
    val scale by animateFloatAsState(if (pressed && !motion.reduced) PRESS_SCALE else 1f, tween(PRESS_MS), label = "pressDip")
    return graphicsLayer {
        scaleX = scale
        scaleY = scale
    }
}

private const val PRESS_SCALE = 0.96f
private const val PRESS_MS = 90
