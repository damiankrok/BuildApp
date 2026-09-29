package com.buildplan.preview.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.dp

/**
 * The one material the 3D chrome is made of: a tinted pane over the house.
 *
 * A translucent graphite tint with a hairline rim that catches light along
 * its top edge. It does not blur: the model is drawn by Filament on its own
 * surface, which the window cannot sample, so a blur would be faked or cost a
 * second render of the scene. Text on it is always ink or muted ink, never
 * colour, and a pane over another pane takes [Palette.GlassOpaque] instead —
 * glass is a one-layer material, and two tints stacked never reach cover.
 *
 * A pane is solid to the finger. Compose lets a touch fall through any area
 * with no pointer handling of its own, and under every pane is the model,
 * whose handler would orbit the camera or pick a wall from behind a label.
 * The pane therefore takes part in hit testing over its whole area without
 * consuming anything, so its own buttons still work and the model behind it
 * is left alone. (Adapted from the donor viewer's STAGE-013H chrome.)
 */
@Composable
fun GlassSurface(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(Radius.panel),
    tint: Color = Palette.Glass,
    rim: Boolean = true,
    content: @Composable BoxScope.() -> Unit,
) {
    Box(
        modifier = modifier
            .solidToFinger()
            .clip(shape)
            .background(tint)
            .then(
                if (rim) {
                    Modifier.border(1.dp, Brush.verticalGradient(listOf(Palette.GlassRimHigh, Palette.GlassRimLow)), shape)
                } else {
                    Modifier
                },
            ),
        content = content,
    )
}

/**
 * A surface that takes part in hit testing over its whole area without
 * consuming anything: its own buttons still work, and the model behind it is
 * left alone. Every pane, sheet and panel over the house takes this first in
 * its modifier chain (cycle 3, H-01) — a Column with only a background lets a
 * touch on its title fall through to the viewport.
 */
fun Modifier.solidToFinger(): Modifier = pointerInput(Unit) {
    awaitEachGesture {
        // In the hit path, silent in every pass: watched to its end, nothing consumed.
        do {
            val event = awaitPointerEvent()
        } while (event.changes.any { it.pressed })
    }
}
