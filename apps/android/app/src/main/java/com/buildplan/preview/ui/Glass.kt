package com.buildplan.preview.ui

import androidx.compose.foundation.gestures.awaitEachGesture
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.drawBehind
import androidx.compose.ui.draw.drawWithCache
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.ClipOp
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.ImageShader
import androidx.compose.ui.graphics.Outline
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.ShaderBrush
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.graphics.drawOutline
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.clipPath
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import kotlin.random.Random

/**
 * The one material the 3D chrome is made of: smoky matte glass over the house
 * (OWNER, variant C "Minimalny dok").
 *
 * What it is, layer by layer, all drawn by Compose in the window above the
 * model: a soft depth falling outside the shape (concentric low-alpha rings,
 * never under the glass, so the glass stays clear), a translucent graphite
 * tint, a sheen across the top half, a fixed fine grain that makes the tint
 * read as frosted rather than as flat plastic, and a hairline rim brighter
 * along the top edge.
 *
 * What it is NOT: a backdrop blur. The model is drawn by Filament into its own
 * `SurfaceView`, a separate layer composited by the system under the window;
 * Compose's `Modifier.blur` blurs only the window's own content (the glass's
 * children), and the window cannot sample the surface beneath it. A true blur
 * would need the scene drawn twice or read back from the GPU every frame —
 * neither is done. The matte look comes from the tint, grain and rim alone,
 * and every piece of it is drawn only when the glass itself redraws (a static
 * cached grain, no animation, no per-frame cost at rest).
 *
 * Text on it is always ink or muted ink; the tint is dense enough that ink
 * stays above 7:1 over the palest wall of the model. A pane over another pane
 * takes [Palette.GlassOpaque] — glass is a one-layer material, and two tints
 * stacked never reach cover.
 *
 * A pane is solid to the finger. Compose lets a touch fall through any area
 * with no pointer handling of its own, and under every pane is the model,
 * whose handler would orbit the camera or pick a wall from behind a label.
 * The pane therefore takes part in hit testing over its whole area without
 * consuming anything, so its own buttons still work and the model behind it
 * is left alone.
 */
@Composable
fun GlassSurface(
    modifier: Modifier = Modifier,
    shape: Shape = RoundedCornerShape(Radius.panel),
    tint: Color = Palette.Glass,
    rim: Boolean = true,
    depth: Dp = Depth.tile,
    content: @Composable BoxScope.() -> Unit,
) {
    Box(
        modifier = modifier
            .solidToFinger()
            .matteGlass(shape, tint, rim, depth),
        content = content,
    )
}

/**
 * The glass itself as a modifier, for a surface whose shape changes while it
 * is drawn (a dock tile growing into its panel): the shape is read at draw
 * time, so a morphing corner radius needs no new modifier per frame.
 */
fun Modifier.matteGlass(shape: Shape, tint: Color = Palette.Glass, rim: Boolean = true, depth: Dp = Depth.tile): Modifier =
    matteGlass(shape, { tint }, rim, { depth })

/**
 * The glass with its tint and depth read at draw time: a tile's light glass thickening, and floating higher,
 * as it grows into a panel that carries text.
 *
 * Layers, bottom to top (round D): a soft depth outside the shape; a 1 dp dark contact hairline round the
 * edge, so the glass stays a separate object over the palest wall; the frosted tint; a diagonal sheen from
 * the top start; the fixed grain; the content; and a bevel — a light stroke over the top 24 dp only, the edge
 * catching the light, fading to nothing down the sides.
 */
fun Modifier.matteGlass(shape: Shape, tint: () -> Color, rim: Boolean = true, depth: () -> Dp = { Depth.tile }): Modifier =
    this
        .softDepth(shape, depth)
        .drawWithCache {
            val outline = shape.createOutline(size, layoutDirection, this)
            val hairline = 1.dp.toPx()
            onDrawBehind {
                // Outside the clip: half of a 2 dp stroke lands outside the glass, a 1 dp dark line round it.
                if (rim) drawOutline(outline, Palette.GlassContact, style = Stroke(width = hairline * 2))
            }
        }
        .clip(shape)
        .drawWithCache {
            val outline = shape.createOutline(size, layoutDirection, this)
            val sheen = Brush.linearGradient(
                0f to Palette.GlassSheen,
                1f to Color.Transparent,
                start = Offset.Zero,
                end = Offset(size.width * 0.6f, size.height.coerceAtMost(220.dp.toPx()) * 0.9f),
            )
            val bevelHeight = 24.dp.toPx()
            val bevel = Brush.verticalGradient(0f to Palette.GlassRimHigh, 1f to Color.Transparent, startY = 0f, endY = bevelHeight)
            val rimWidth = 1.dp.toPx()
            onDrawWithContent {
                drawOutline(outline, tint())
                drawOutline(outline, sheen)
                drawOutline(outline, GrainBrush, alpha = GRAIN_ALPHA)
                drawContent()
                if (rim) {
                    // The stroke is centred on the clipped edge: half of it shows, a 1 dp bevel; the faint rest of the rim below.
                    drawOutline(outline, Palette.GlassRimLow, style = Stroke(width = rimWidth * 2))
                    drawOutline(outline, bevel, style = Stroke(width = rimWidth * 2))
                }
            }
        }

/**
 * A soft shadow under the shape, drawn only outside it: rings of falling
 * alpha, offset a little downwards, so the glass seems to float above the
 * house without the shadow showing through its own tint.
 */
private fun Modifier.softDepth(shape: Shape, depth: () -> Dp): Modifier = drawBehind {
    val spread = depth().toPx()
    if (spread <= 0f) return@drawBehind
    val outline = shape.createOutline(size, layoutDirection, this)
    val inside = Path().apply { addOutline(outline) }
    val drop = spread * 0.4f
    val corner = when (outline) {
        is Outline.Rounded -> outline.roundRect.topLeftCornerRadius.x
        else -> 0f
    }
    clipPath(inside, ClipOp.Difference) {
        for (i in 1..DEPTH_RINGS) {
            val grow = spread * i / DEPTH_RINGS
            drawRoundRect(
                color = Palette.GlassShadow,
                topLeft = Offset(-grow, -grow + drop),
                size = Size(size.width + grow * 2, size.height + grow * 2),
                cornerRadius = CornerRadius(corner + grow),
                alpha = DEPTH_ALPHA / DEPTH_RINGS * (DEPTH_RINGS - i + 1) / DEPTH_RINGS * 2f,
            )
        }
    }
}

private fun Path.addOutline(outline: Outline) {
    when (outline) {
        is Outline.Rectangle -> addRect(outline.rect)
        is Outline.Rounded -> addRoundRect(outline.roundRect)
        is Outline.Generic -> addPath(outline.path)
    }
}

/** How many rings the depth is drawn with, and how dark it is at the shape's edge. */
private const val DEPTH_RINGS = 8
private const val DEPTH_ALPHA = 0.55f

/** The grain's strength: felt, not seen. */
private const val GRAIN_ALPHA = 0.07f

/**
 * A fixed, seeded tile of fine noise, made once per process and repeated
 * across every piece of glass: the frosting is the same everywhere and never
 * moves, so it costs one small bitmap and nothing per frame.
 */
private val GrainBrush: ShaderBrush by lazy {
    val side = 96
    val random = Random(0xB11D)
    val pixels = IntArray(side * side) {
        val a = random.nextInt(0, 256)
        (a shl 24) or 0x00FFFFFF
    }
    val bitmap = android.graphics.Bitmap.createBitmap(pixels, side, side, android.graphics.Bitmap.Config.ARGB_8888)
    val image: ImageBitmap = bitmap.asImageBitmap()
    ShaderBrush(ImageShader(image, TileMode.Repeated, TileMode.Repeated))
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
