package com.buildplan.preview.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.buildplan.preview.presentation.HouseSketch
import kotlin.math.min

/**
 * Dom's picture of the house: the derived line drawing ([HouseSketch]), inked
 * by the owner's own progress.
 *
 * What stands by the owner's account is drawn in ink; the part the current
 * stage adds, in the rule's yellow — measured progress, the one thing that
 * colour means; the rest of the design as a faint outline, planned and not
 * built. With progress unset the whole design is drawn in ink, because
 * nothing has been claimed either way. A drawing, not a second 3D engine: it
 * costs nothing to keep on screen, and tapping it opens the model itself.
 */
@Composable
fun HouseDrawing(
    sketch: HouseSketch?,
    /** Objects standing by the owner's account; null while progress is unset (the whole design in ink). */
    built: Set<String>?,
    /** Objects the stage in progress adds. */
    current: Set<String>,
    description: String,
    onOpen: () -> Unit,
    modifier: Modifier = Modifier,
    height: Dp = 232.dp,
) {
    Box(
        modifier
            .fillMaxWidth()
            .height(height)
            .semantics { contentDescription = description }
            .clickable(role = Role.Button, onClick = onOpen),
        contentAlignment = Alignment.Center,
    ) {
        // The drawing arrives a moment after the screen (it is computed off the main thread).
        if (sketch != null) {
            val layers = remember(sketch, built, current) { Layers.of(sketch, built, current) }
            Canvas(Modifier.fillMaxWidth().height(height)) {
                val pad = 12.dp.toPx()
                val scale = min((size.width - 2 * pad) / sketch.aspect, size.height - 2 * pad)
                val ox = (size.width - sketch.aspect * scale) / 2
                val oy = (size.height - scale) / 2
                drawLines(layers.planned, Palette.InkMuted.copy(alpha = 0.32f), 0.8f, scale, ox, oy)
                drawLines(layers.built, Palette.Ink, 1.1f, scale, ox, oy)
                drawLines(layers.current, Palette.Rule, 1.3f, scale, ox, oy)
            }
        }
    }
}

/** The drawing's segments sorted into its three inks. */
private class Layers(val planned: List<FloatArray>, val built: List<FloatArray>, val current: List<FloatArray>) {
    companion object {
        fun of(sketch: HouseSketch, built: Set<String>?, current: Set<String>): Layers {
            val planned = ArrayList<FloatArray>()
            val ink = ArrayList<FloatArray>()
            val now = ArrayList<FloatArray>()
            for ((id, segments) in sketch.segments) {
                when {
                    built == null -> ink.add(segments)
                    id in current -> now.add(segments)
                    id in built -> ink.add(segments)
                    else -> planned.add(segments)
                }
            }
            return Layers(planned, ink, now)
        }
    }
}

private fun DrawScope.drawLines(groups: List<FloatArray>, color: Color, widthDp: Float, scale: Float, ox: Float, oy: Float) {
    val w = widthDp * density
    for (s in groups) {
        var i = 0
        while (i + 3 < s.size) {
            drawLine(
                color,
                Offset(ox + s[i] * scale, oy + s[i + 1] * scale),
                Offset(ox + s[i + 2] * scale, oy + s[i + 3] * scale),
                strokeWidth = w,
                cap = StrokeCap.Round,
            )
            i += 4
        }
    }
}
