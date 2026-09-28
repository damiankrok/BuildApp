package com.buildplan.preview.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.dp
import com.buildplan.preview.R

/**
 * A place that exists in the product but not yet in the app: Koszty and
 * Dokumenty. It sits where content will sit — top left, a heading and one
 * paragraph — not as a centred poster, and it says in the same breath that
 * nothing lives here yet: no sample rows, no zero totals, no button that
 * pretends to add something. One real way onward is offered: to what the app
 * does keep today.
 */
@Composable
fun EmptyPlace(place: AppPlace, onGoStages: () -> Unit, onGoHouse: () -> Unit) {
    val (title, body) = when (place) {
        AppPlace.COSTS -> R.string.empty_costs_title to R.string.empty_costs_body
        AppPlace.DOCUMENTS -> R.string.empty_documents_title to R.string.empty_documents_body
        AppPlace.HOUSE, AppPlace.MODEL, AppPlace.STAGES -> return
    }
    Column(
        Modifier
            .fillMaxSize()
            .statusBarsPadding()
            .verticalScroll(rememberScrollState())
            .padding(horizontal = Space.l)
            .padding(top = Space.l, bottom = Space.xl)
            .widthIn(max = 560.dp),
        verticalArrangement = Arrangement.spacedBy(Space.m),
    ) {
        Text(
            stringResource(title),
            style = MaterialTheme.typography.headlineSmall,
            color = Palette.Ink,
            modifier = Modifier.semantics { heading() },
        )
        // The status in words and in a drawn mark, not only in a muted colour.
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(Space.s)) {
            Icon(ShellIcons.of(place), contentDescription = null, tint = Palette.InkMuted, modifier = Modifier.size(Sizes.iconSmall))
            Text(stringResource(R.string.empty_not_built), style = MaterialTheme.typography.labelLarge, color = Palette.InkMuted)
        }
        Text(stringResource(body), style = MaterialTheme.typography.bodyLarge, color = Palette.Ink)
        when (place) {
            AppPlace.COSTS -> {
                Text(stringResource(R.string.empty_costs_meanwhile), style = MaterialTheme.typography.bodyMedium, color = Palette.InkMuted)
                LineButton(stringResource(R.string.empty_go_stages), onClick = onGoStages, icon = ShellIcons.rule)
            }
            else -> {
                Text(stringResource(R.string.empty_documents_meanwhile), style = MaterialTheme.typography.bodyMedium, color = Palette.InkMuted)
                LineButton(stringResource(R.string.empty_go_house), onClick = onGoHouse, icon = ShellIcons.house)
            }
        }
    }
}
