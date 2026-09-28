package com.buildplan.preview.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.gestures.awaitFirstDown
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.semantics.CustomAccessibilityAction
import androidx.compose.ui.semantics.ProgressBarRangeInfo
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.customActions
import androidx.compose.ui.semantics.progressBarRangeInfo
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.setProgress
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.text.TextMeasurer
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import com.buildplan.preview.progress.ConstructionStageProgress
import com.buildplan.preview.progress.StageStatus
import kotlin.math.roundToInt

/**
 * The folding rule: the build's stages as the hinged segments of a
 * carpenter's rule, unfolded as far as the build has got.
 *
 * The rule always reads the owner's ACTUAL progress: a stage done is a solid
 * yellow segment, the stage in progress is outlined in yellow and filled as
 * far as its completion, a stage not started is a grey outline. The segment's
 * state is also its shape (filled, part-filled, empty), and every state is
 * spoken, so nothing is told by colour alone. After the last segment stands
 * the design itself, a small house: the finished project.
 *
 * Two marks stand above it. The solid tag is NOW — where the build is. The
 * hollow tag with a thin line through the rule is the PREVIEW cursor — what
 * the 3D is showing, when that is not now. The same yellow, never the same
 * shape: a look back can never be mistaken for the state of the build.
 *
 * Interactive, a touch anywhere on it moves the cursor to the nearest stop and
 * a drag scrubs stop by stop, with a tick of haptics per stop; it never
 * changes the saved progress. TalkBack reads it as an adjustable control
 * (swipe up and down), with "previous", "next" and "back to now" as actions.
 * Static, it is the same drawing on Dom and Etapy.
 *
 * Stops are the [stages] in order, then the finished design (index
 * `stages.size`).
 */
@Composable
fun FoldingRule(
    stages: List<ConstructionStageProgress>,
    /** The stop of the stage in progress, or of the last stage done; null while progress is unset. */
    nowStop: Int?,
    /** The stop the 3D previews; null while it shows now. */
    previewStop: Int?,
    modifier: Modifier = Modifier,
    height: Dp = RuleDefaults.Height,
    /** Null for a static rule. */
    onScrub: ((stop: Int) -> Unit)? = null,
    onReturnToNow: (() -> Unit)? = null,
    returnToNowLabel: String = "",
    /** Spoken name of the control, and of the stop under the cursor. */
    description: String = "",
    stateText: String = "",
    stopName: (Int) -> String = { "" },
) {
    val stopCount = stages.size + 1
    val haptics = LocalHapticFeedback.current
    val motion = LocalMotionPolicy.current
    val measurer = rememberTextMeasurer()
    val scrub by rememberUpdatedState(onScrub)
    val previewTarget = (previewStop ?: nowStop ?: 0).toFloat()
    val cursorAt by animateFloatAsState(previewTarget, motion.settle(), label = "ruleCursor")

    val interaction = if (onScrub == null) {
        Modifier
    } else {
        Modifier
            .pointerInput(stopCount) {
                awaitEachGesture {
                    val down = awaitFirstDown(requireUnconsumed = false)
                    down.consume()
                    var last = stopAt(down.position.x, size.width.toFloat(), stopCount, density)
                    haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                    scrub?.invoke(last)
                    while (true) {
                        val event = awaitPointerEvent()
                        val change = event.changes.firstOrNull { it.id == down.id } ?: break
                        if (!change.pressed) break
                        change.consume()
                        val at = stopAt(change.position.x, size.width.toFloat(), stopCount, density)
                        if (at != last) {
                            last = at
                            haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                            scrub?.invoke(at)
                        }
                    }
                }
            }
            .semantics {
                contentDescription = description
                stateDescription = stateText
                val current = (previewStop ?: nowStop ?: 0).toFloat()
                progressBarRangeInfo = ProgressBarRangeInfo(current, 0f..(stopCount - 1).toFloat(), steps = stopCount - 2)
                setProgress { value ->
                    scrub?.invoke(value.roundToInt().coerceIn(0, stopCount - 1))
                    true
                }
                val here = (previewStop ?: nowStop ?: 0)
                customActions = buildList {
                    if (here > 0) add(CustomAccessibilityAction(stopName(here - 1)) { scrub?.invoke(here - 1); true })
                    if (here < stopCount - 1) add(CustomAccessibilityAction(stopName(here + 1)) { scrub?.invoke(here + 1); true })
                    onReturnToNow?.let { back -> add(CustomAccessibilityAction(returnToNowLabel) { back(); true }) }
                }
            }
    }

    Box(modifier.fillMaxWidth().height(height).then(interaction)) {
        Canvas(Modifier.fillMaxWidth().height(height)) {
            drawRule(stages, nowStop, previewStop?.let { cursorAt }, measurer)
        }
    }
}

object RuleDefaults {
    /** The whole control: the tags above, the segments, the numerals below; the touch band is all of it. */
    val Height = 52.dp
    val StaticHeight = 40.dp
}

/** The stop nearest a point along the rule, in the same geometry the drawing uses. */
internal fun stopAt(x: Float, width: Float, stopCount: Int, density: Float): Int {
    val g = RuleGeometry(width, stopCount, density)
    var best = 0
    var bestDistance = Float.MAX_VALUE
    for (i in 0 until stopCount) {
        val d = kotlin.math.abs(g.center(i) - x)
        if (d < bestDistance) {
            best = i
            bestDistance = d
        }
    }
    return best
}

/** Where each stop sits, in pixels. The last stop is the design's end cap. */
internal class RuleGeometry(width: Float, private val stopCount: Int, density: Float) {
    val gap = 2f * density
    val cap = 22f * density
    private val segments = stopCount - 1
    val segment = ((width - cap - gap * segments) / segments).coerceAtLeast(1f)

    fun left(i: Int): Float = i * (segment + gap)
    fun center(i: Int): Float = if (i < segments) left(i) + segment / 2 else left(segments) + cap / 2
    val capLeft: Float get() = left(segments)
}

private fun DrawScope.drawRule(
    stages: List<ConstructionStageProgress>,
    nowStop: Int?,
    cursor: Float?,
    measurer: TextMeasurer,
) {
    val stopCount = stages.size + 1
    val g = RuleGeometry(size.width, stopCount, density)
    val d = density
    val tagH = 7f * d
    val top = tagH + 5f * d
    val barH = 10f * d
    val corner = CornerRadius(1.5f * d)
    val stroke = Stroke(width = 1.2f * d)

    // Segments.
    for ((i, stage) in stages.withIndex()) {
        val x = g.left(i)
        val rectSize = Size(g.segment, barH)
        when (stage.status) {
            StageStatus.DONE -> drawRoundRect(Palette.Rule, Offset(x, top), rectSize, corner)
            StageStatus.IN_PROGRESS -> {
                val filled = (g.segment * stage.completion.toFloat()).coerceIn(0f, g.segment)
                if (filled > 0f) drawRoundRect(Palette.Rule, Offset(x, top), Size(filled, barH), corner)
                drawRoundRect(Palette.Rule, Offset(x + 0.6f * d, top + 0.6f * d), Size(g.segment - 1.2f * d, barH - 1.2f * d), corner, style = stroke)
            }
            StageStatus.NOT_STARTED ->
                drawRoundRect(Palette.RuleEmpty, Offset(x + 0.6f * d, top + 0.6f * d), Size(g.segment - 1.2f * d, barH - 1.2f * d), corner, style = stroke)
        }
    }

    // The design's end cap: a small house outline, the finished project.
    val cx = g.capLeft + g.cap / 2
    val houseW = g.cap * 0.62f
    val roofTop = top - 3f * d
    val eaves = top + barH * 0.35f
    val base = top + barH
    val house = Path().apply {
        moveTo(cx - houseW / 2, base)
        lineTo(cx - houseW / 2, eaves)
        lineTo(cx, roofTop)
        lineTo(cx + houseW / 2, eaves)
        lineTo(cx + houseW / 2, base)
        close()
    }
    drawPath(house, Palette.InkMuted, style = stroke)

    // Graduations: a tick under every hinge, a longer one and a numeral every fifth stage.
    val tickTop = top + barH + 3f * d
    for (i in 0 until stages.size) {
        val major = i == 0 || (i + 1) % 5 == 0
        val x = g.left(i) + g.segment / 2
        drawLine(Palette.RuleEmpty, Offset(x, tickTop), Offset(x, tickTop + (if (major) 4f else 2f) * d), strokeWidth = 1f * d)
        if (major) {
            val label = measurer.measure((i + 1).toString(), Measure.numeral.copy(color = Palette.InkFaint))
            val tx = (x - label.size.width / 2f).coerceIn(0f, size.width - label.size.width)
            val ty = tickTop + 5f * d
            if (ty + label.size.height <= size.height + 1f) drawText(label, topLeft = Offset(tx, ty))
        }
    }

    // NOW: a solid tag.
    nowStop?.let { s ->
        val x = g.center(s.coerceIn(0, stopCount - 1))
        drawPath(tag(x, 0f, tagH, d), Palette.Rule)
    }

    // PREVIEW: a hollow tag and a hairline through the rule.
    cursor?.let { c ->
        val lo = c.toInt().coerceIn(0, stopCount - 1)
        val hi = (lo + 1).coerceAtMost(stopCount - 1)
        val x = g.center(lo) + (g.center(hi) - g.center(lo)) * (c - lo)
        drawLine(Palette.Rule, Offset(x, tagH), Offset(x, top + barH + 2f * d), strokeWidth = 1.2f * d)
        drawPath(tag(x, 0f, tagH, d), Palette.Ground)
        drawPath(tag(x, 0f, tagH, d), Palette.Rule, style = Stroke(width = 1.4f * d))
    }
}

/** A downward tag, like the slider of a marking gauge. */
private fun tag(x: Float, top: Float, h: Float, d: Float): Path = Path().apply {
    val half = 5.5f * d
    moveTo(x - half, top)
    lineTo(x + half, top)
    lineTo(x + half, top + h * 0.45f)
    lineTo(x, top + h)
    lineTo(x - half, top + h * 0.45f)
    close()
}
