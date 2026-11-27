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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
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
import com.buildplan.preview.presentation.LookFamily
import com.buildplan.preview.presentation.PresentationMode
import com.buildplan.preview.render.RenderStyle
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.ViewerState
import com.buildplan.preview.scene.Visibility
import com.buildplan.preview.scene.VisibilityMode

/**
 * The full set of the viewer's tools, as the panes of the one sheet the menu
 * opens (variant C, "Wszystkie widoki, warstwy i wygląd"): every look, every
 * layer with isolation and the list of elements, every named view with zoom
 * and reset. The dock offers the everyday four layers and seven views; these
 * stay one tap away, never as main actions. Every choice is a mark and a word.
 * (Until APK 1355 they unfolded from a tool rail at the right edge.)
 */

/** One step of "Przybliż" (and its inverse for "Oddal"): a fifth closer. */
private const val ZOOM_STEP = 0.8

/**
 * The looks, under the three things a look is for (the house as a home, a
 * study of its mass, a technical reading), each a mark, its name and one line
 * on what it shows. MODEL's own lighting styles follow when MODEL is chosen.
 */
@Composable
internal fun LookPane(state: ViewerState, onPresentation: (PresentationMode) -> Unit, onStyle: (RenderStyle) -> Unit) {
    for (family in LookFamily.entries) {
        PanelGroupLabel(stringResource(family.labelRes()))
        for (mode in PresentationMode.entries.filter { it.family == family }) {
            PanelOption(
                label = stringResource(mode.labelRes()),
                supporting = stringResource(mode.descriptionRes()),
                selected = mode == state.presentation,
                onClick = { onPresentation(mode) },
            )
        }
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
internal fun LayersPane(
    scene: ModelScene,
    state: ViewerState,
    onVisibility: (VisibilityMode) -> Unit,
    onIsolate: () -> Unit,
    onShowAll: () -> Unit,
    onSelectElement: (String) -> Unit,
) {
    for (mode in Visibility.availableModes(scene)) {
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
    ElementList(scene, state, onSelectElement)
}

/**
 * Every element drawn now, by name and storey: the way to an element's
 * details without tapping the model (TalkBack, switch access, a gloved hand
 * on site). Folded until asked for; choosing one selects and frames it.
 */
@Composable
private fun ElementList(scene: ModelScene, state: ViewerState, onSelectElement: (String) -> Unit) {
    var open by rememberSaveable { mutableStateOf(false) }
    val drawn = remember(scene, state) {
        val visible = state.visibleObjectIds(scene)
        scene.objects.filter { it.id in visible && it.hasGeometry }
    }
    PanelRule()
    PanelAction(
        stringResource(if (open) R.string.layer_elements_hide else R.string.layer_elements_show, drawn.size),
        onClick = { open = !open },
    )
    if (open) {
        for (obj in drawn) {
            val storey = ElementWords.storey(obj.metadata?.levelLabel ?: scene.levelLabel(obj.levelId), scene.levels.firstOrNull { it.id == obj.levelId }?.index)
            PanelOption(
                label = elementTitle(obj),
                supporting = storey?.let { storeyText(it) },
                selected = obj.id == state.selectedObjectId,
                onClick = { onSelectElement(obj.id) },
            )
        }
    }
}

@Composable
internal fun ViewPane(scene: ModelScene, onPreset: (ViewPreset) -> Unit, onReset: () -> Unit, onZoom: (Double) -> Unit) {
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
        // Zoom without a pinch, first in the pane where TalkBack and a gloved hand find it.
        if (label == R.string.view_group_whole) {
            PanelAction(stringResource(R.string.view_zoom_in), onClick = { onZoom(ZOOM_STEP) })
            PanelAction(stringResource(R.string.view_zoom_out), onClick = { onZoom(1.0 / ZOOM_STEP) })
        }
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
