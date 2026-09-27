package com.buildplan.preview.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.consumeWindowInsets
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.Saver
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.style.TextOverflow
import com.buildplan.preview.R

private val ShellStateSaver = Saver<ShellState, String>(save = { it.encode() }, restore = { ShellState.decode(it) ?: ShellState() })

/**
 * The product shell: five places under one navigation bar, and the model on
 * the whole screen when the owner goes to `3D`.
 *
 * The navigation bar is opaque and sits below the content, never over it;
 * the 3D place hides it and carries its own way back. Navigation is the pure
 * [ShellState]; this file only draws it and routes the system back through
 * [ShellState.back], enabled only while back has somewhere to go inside the
 * app, so predictive back still works from `Dom`.
 */
@Composable
fun AppShell(preview: PreviewViewModel, analyzer: AnalyzerViewModel, initial: ShellState) {
    val motion = rememberSystemMotionPolicy()
    preview.reducedMotion = motion.reduced
    var state by rememberSaveable(stateSaver = ShellStateSaver) { mutableStateOf(initial) }

    // A job that finishes (or a download deleted) joins the list of houses at once.
    LaunchedEffect(analyzer.downloads) { preview.refreshScenes() }

    // An analysis finished on this phone opens by itself, once, on the whole screen.
    LaunchedEffect(analyzer.autoOpen) {
        val key = analyzer.autoOpen ?: return@LaunchedEffect
        analyzer.consumeAutoOpen()
        preview.refreshScenes()
        if (preview.openKey(key)) state = ShellState(AppPlace.MODEL, cameFrom = AppPlace.HOUSE)
    }

    val back = state.back()
    BackHandler(enabled = back != null) {
        state.back()?.let { state = it }
        preview.refreshScenes()
    }

    CompositionLocalProvider(LocalMotionPolicy provides motion) {
        if (state.immersive) {
            ModelWorkspace(preview, onBack = { state.back()?.let { state = it } })
            return@CompositionLocalProvider
        }
        Scaffold(
            containerColor = MaterialTheme.colorScheme.background,
            bottomBar = { PlacesBar(current = state.place, onSelect = { state = state.go(it) }) },
        ) { padding ->
            Box(Modifier.fillMaxSize().padding(padding).consumeWindowInsets(padding)) {
                when {
                    state.analyzerOpen -> AnalyzerScreen(
                        model = analyzer,
                        onBack = {
                            state.back()?.let { state = it }
                            preview.refreshScenes()
                        },
                        onOpenScene = { key ->
                            preview.refreshScenes()
                            if (preview.openKey(key)) state = ShellState(AppPlace.MODEL, cameFrom = AppPlace.HOUSE)
                        },
                    )
                    state.place == AppPlace.HOUSE -> HouseScreen(
                        preview = preview,
                        analyzer = analyzer,
                        onOpenModel = { state = state.go(AppPlace.MODEL) },
                        onAnalyze = {
                            analyzer.refreshDownloads()
                            state = state.openAnalyzer()
                        },
                    )
                    else -> EmptyPlace(state.place)
                }
            }
        }
    }
}

/** The five places; the selected one says so in words as well as in colour. */
@Composable
private fun PlacesBar(current: AppPlace, onSelect: (AppPlace) -> Unit) {
    NavigationBar(containerColor = MaterialTheme.colorScheme.surface) {
        for (place in AppPlace.entries) {
            val selected = place == current
            val stateText = stringResource(if (selected) R.string.state_selected else R.string.state_not_selected)
            NavigationBarItem(
                selected = selected,
                onClick = { onSelect(place) },
                icon = { Icon(ShellIcons.of(place), contentDescription = null) },
                label = { Text(stringResource(place.label), maxLines = 1, overflow = TextOverflow.Ellipsis) },
                // The label is the name; a contentDescription here would replace it on the merged node.
                modifier = Modifier.semantics { stateDescription = stateText },
            )
        }
    }
}
