package com.buildplan.preview.ui

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.ScrollState
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.RowScope
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectable
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.drawWithContent
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.heading
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/*
 * The small pieces every screen shares, in the Folding Rule's grammar: ink
 * buttons (never colour), sentence-case group labels (never eyebrows), choices
 * whose state is a mark as well as a word, and hairline rules only where a
 * measure is drawn.
 */

/** A quiet status line. */
@Composable
fun StatusText(text: String, modifier: Modifier = Modifier, color: Color = Palette.InkMuted, maxLines: Int = Int.MAX_VALUE) {
    Text(text = text, style = MaterialTheme.typography.labelMedium, color = color, modifier = modifier, maxLines = maxLines, overflow = TextOverflow.Ellipsis)
}

/** The one primary action of a screen: filled ink, graphite text. */
@Composable
fun InkButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    icon: ImageVector? = null,
) {
    Button(
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(Radius.control),
        colors = ButtonDefaults.buttonColors(containerColor = Palette.Ink, contentColor = Palette.Ground),
        contentPadding = PaddingValues(horizontal = Space.l, vertical = Space.s),
        modifier = modifier.heightIn(min = Sizes.touch),
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(Sizes.iconSmall))
            Box(Modifier.size(Space.s))
        }
        Text(text, style = MaterialTheme.typography.labelLarge, maxLines = 1, overflow = TextOverflow.Ellipsis)
    }
}

/** A secondary action: an outline in hairline, ink text. */
@Composable
fun LineButton(
    text: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    enabled: Boolean = true,
    icon: ImageVector? = null,
    borderColor: Color = Palette.RuleEmpty,
) {
    OutlinedButton(
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(Radius.control),
        border = androidx.compose.foundation.BorderStroke(1.dp, borderColor),
        colors = ButtonDefaults.outlinedButtonColors(contentColor = Palette.Ink),
        contentPadding = PaddingValues(horizontal = Space.l, vertical = Space.s),
        modifier = modifier.heightIn(min = Sizes.touch),
    ) {
        if (icon != null) {
            Icon(icon, contentDescription = null, modifier = Modifier.size(Sizes.iconSmall))
            Box(Modifier.size(Space.s))
        }
        Text(text, style = MaterialTheme.typography.labelLarge, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

/** A heading inside a screen: more room above than below, and a heading for TalkBack. */
@Composable
fun SectionHeading(text: String, modifier: Modifier = Modifier, trailing: @Composable RowScope.() -> Unit = {}) {
    Row(
        modifier = modifier.fillMaxWidth().padding(top = Space.xl, bottom = Space.s),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            text,
            style = MaterialTheme.typography.titleMedium,
            color = Palette.Ink,
            modifier = Modifier.weight(1f).semantics { heading() },
        )
        trailing()
    }
}

/** The first row of a pane or sheet: what it is, and the one way to close it. */
@Composable
fun PanelHeader(title: String, closeLabel: String, onClose: () -> Unit, modifier: Modifier = Modifier, supporting: String? = null) {
    Row(
        modifier = modifier.fillMaxWidth().padding(start = Space.l, end = Space.xs, top = Space.xs),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(
                title,
                style = MaterialTheme.typography.titleSmall,
                color = Palette.Ink,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
                modifier = Modifier.semantics { heading() },
            )
            if (supporting != null) {
                Text(supporting, style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted, maxLines = 2, overflow = TextOverflow.Ellipsis)
            }
        }
        IconButton(onClick = onClose, modifier = Modifier.size(Sizes.touch).semantics { contentDescription = closeLabel }) {
            Icon(ShellIcons.close, contentDescription = null, tint = Palette.InkMuted, modifier = Modifier.size(Sizes.iconSmall))
        }
    }
}

/**
 * One choice in a pane: a ring that fills when chosen, the label, an
 * optional second line. The chosen one is told by its mark and its weight,
 * not by the others fading — every label stays full ink.
 */
@Composable
fun PanelOption(
    label: String,
    selected: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    supporting: String? = null,
    enabled: Boolean = true,
) {
    val motion = LocalMotionPolicy.current
    val mark by animateColorAsState(if (selected) Palette.Ink else Palette.RuleEmpty, motion.settle(), label = "optionMark")
    Row(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = Sizes.touch)
            .selectable(selected = selected, enabled = enabled, onClick = onClick, role = Role.RadioButton)
            .padding(horizontal = Space.l, vertical = Space.xs),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(Space.m),
    ) {
        Box(
            Modifier
                .size(10.dp)
                .then(if (selected) Modifier.background(mark, CircleShape) else Modifier.border(1.2.dp, mark, CircleShape)),
        )
        Column(Modifier.weight(1f)) {
            Text(
                label,
                style = MaterialTheme.typography.bodyMedium,
                color = if (enabled) Palette.Ink else Palette.InkFaint,
                fontWeight = if (selected) androidx.compose.ui.text.font.FontWeight.SemiBold else null,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            if (supporting != null) {
                Text(supporting, style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted, maxLines = 3, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

/** A plain action row in a pane: no mark, the action's name. */
@Composable
fun PanelAction(label: String, onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true, supporting: String? = null) {
    Column(
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = Sizes.touch)
            .selectable(selected = false, enabled = enabled, onClick = onClick, role = Role.Button)
            .padding(horizontal = Space.l, vertical = Space.s),
        verticalArrangement = Arrangement.Center,
    ) {
        Text(label, style = MaterialTheme.typography.bodyMedium, color = if (enabled) Palette.Ink else Palette.InkFaint, maxLines = 2, overflow = TextOverflow.Ellipsis)
        if (supporting != null) Text(supporting, style = MaterialTheme.typography.bodySmall, color = Palette.InkMuted, maxLines = 2, overflow = TextOverflow.Ellipsis)
    }
}

/** The name of a group of choices: sentence case, muted, a heading for four rows — not an eyebrow. */
@Composable
fun PanelGroupLabel(text: String, modifier: Modifier = Modifier) {
    Text(
        text,
        style = MaterialTheme.typography.labelMedium,
        color = Palette.InkMuted,
        modifier = modifier.padding(start = Space.l, end = Space.l, top = Space.m, bottom = Space.xxs).semantics { heading() },
    )
}

/** A hairline between groups. */
@Composable
fun PanelRule(modifier: Modifier = Modifier, inset: Dp = Space.l) {
    Box(modifier.fillMaxWidth().padding(horizontal = inset, vertical = Space.xs).height(1.dp).background(Palette.Hairline))
}

/** Darkens the last rows of a list that continues below its edge, so a cut list never looks complete. */
fun Modifier.fadeBelowFold(scroll: ScrollState, color: Color, height: Dp = 32.dp): Modifier = drawWithContent {
    drawContent()
    if (scroll.canScrollForward) {
        val h = height.toPx()
        drawRect(
            brush = Brush.verticalGradient(listOf(Color.Transparent, color), startY = size.height - h, endY = size.height),
            topLeft = Offset(0f, size.height - h),
            size = Size(size.width, h),
        )
    }
}
