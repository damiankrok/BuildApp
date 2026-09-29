package com.buildplan.preview.ui

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathBuilder
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.dp

/**
 * The app's icons, drawn here as 24 dp outlines in one stroke weight, so the
 * navigation, the tool rail and the sheets speak one line — the rule's own
 * hairline grammar — instead of mixing filled Material glyphs with outlines.
 * Every icon is tinted by its caller; the black here is only a placeholder.
 */
object ShellIcons {
    private fun outline(name: String, block: PathBuilder.() -> Unit): ImageVector =
        ImageVector.Builder(name = name, defaultWidth = 24.dp, defaultHeight = 24.dp, viewportWidth = 24f, viewportHeight = 24f)
            .path(stroke = SolidColor(Color.Black), strokeLineWidth = 1.75f, strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round, pathBuilder = block)
            .build()

    /** A house: walls and a pitched roof. */
    val house: ImageVector by lazy {
        outline("House") {
            moveTo(4f, 11f); lineTo(12f, 4f); lineTo(20f, 11f)
            moveTo(6f, 9.5f); lineTo(6f, 20f); lineTo(18f, 20f); lineTo(18f, 9.5f)
            moveTo(10f, 20f); lineTo(10f, 14f); lineTo(14f, 14f); lineTo(14f, 20f)
        }
    }

    /** An isometric cube: three visible faces. */
    val cube: ImageVector by lazy {
        outline("Cube") {
            moveTo(12f, 2.5f); lineTo(20.5f, 7f); lineTo(20.5f, 17f); lineTo(12f, 21.5f); lineTo(3.5f, 17f); lineTo(3.5f, 7f); close()
            moveTo(3.5f, 7f); lineTo(12f, 11.5f); lineTo(20.5f, 7f)
            moveTo(12f, 11.5f); lineTo(12f, 21.5f)
        }
    }

    /** A folding rule, half open: the stages. */
    val rule: ImageVector by lazy {
        outline("Rule") {
            moveTo(3f, 17f); lineTo(9f, 7f); lineTo(12f, 8.8f); lineTo(6f, 18.8f); close()
            moveTo(12f, 8.8f); lineTo(21f, 8.8f); lineTo(21f, 12.2f); lineTo(10f, 12.2f)
            moveTo(15f, 8.8f); lineTo(15f, 10.4f)
            moveTo(18f, 8.8f); lineTo(18f, 10.4f)
        }
    }

    /** A receipt with a torn foot and two lines. */
    val receipt: ImageVector by lazy {
        outline("Receipt") {
            moveTo(6f, 2.5f); lineTo(18f, 2.5f); lineTo(18f, 21f); lineTo(15.5f, 19.5f); lineTo(13f, 21f); lineTo(10.5f, 19.5f); lineTo(8f, 21f); lineTo(6f, 19.5f); close()
            moveTo(9f, 8f); lineTo(15f, 8f)
            moveTo(9f, 12f); lineTo(15f, 12f)
        }
    }

    /** A page with a folded corner. */
    val page: ImageVector by lazy {
        outline("Page") {
            moveTo(6f, 2.5f); lineTo(14f, 2.5f); lineTo(19f, 7.5f); lineTo(19f, 21.5f); lineTo(6f, 21.5f); close()
            moveTo(14f, 2.5f); lineTo(14f, 7.5f); lineTo(19f, 7.5f)
            moveTo(9f, 12.5f); lineTo(16f, 12.5f)
            moveTo(9f, 16.5f); lineTo(16f, 16.5f)
        }
    }

    /** Two stacked plates: what is shown. */
    val layers: ImageVector by lazy {
        outline("Layers") {
            moveTo(12f, 4f); lineTo(21f, 9f); lineTo(12f, 14f); lineTo(3f, 9f); close()
            moveTo(3f, 13.5f); lineTo(12f, 18.5f); lineTo(21f, 13.5f)
        }
    }

    /** A half-shaded cube: how the model is drawn. */
    val look: ImageVector by lazy {
        outline("Look") {
            moveTo(12f, 3f); lineTo(20f, 7.5f); lineTo(20f, 16.5f); lineTo(12f, 21f); lineTo(4f, 16.5f); lineTo(4f, 7.5f); close()
            moveTo(12f, 12f); lineTo(12f, 21f)
            moveTo(4f, 7.5f); lineTo(12f, 12f); lineTo(20f, 7.5f)
            moveTo(14.5f, 13.5f); lineTo(17.5f, 11.8f)
            moveTo(14.5f, 16.5f); lineTo(17.5f, 14.8f)
        }
    }

    /** An eye: where the camera looks from. */
    val view: ImageVector by lazy {
        outline("View") {
            moveTo(2.5f, 12f); curveTo(5f, 7f, 8.5f, 5f, 12f, 5f); curveTo(15.5f, 5f, 19f, 7f, 21.5f, 12f)
            curveTo(19f, 17f, 15.5f, 19f, 12f, 19f); curveTo(8.5f, 19f, 5f, 17f, 2.5f, 12f); close()
            moveTo(12f, 9f); curveTo(13.7f, 9f, 15f, 10.3f, 15f, 12f); curveTo(15f, 13.7f, 13.7f, 15f, 12f, 15f)
            curveTo(10.3f, 15f, 9f, 13.7f, 9f, 12f); curveTo(9f, 10.3f, 10.3f, 9f, 12f, 9f); close()
        }
    }

    /** Four corner brackets: fit the model to the screen. */
    val fit: ImageVector by lazy {
        outline("Fit") {
            moveTo(4f, 9f); lineTo(4f, 4f); lineTo(9f, 4f)
            moveTo(15f, 4f); lineTo(20f, 4f); lineTo(20f, 9f)
            moveTo(20f, 15f); lineTo(20f, 20f); lineTo(15f, 20f)
            moveTo(9f, 20f); lineTo(4f, 20f); lineTo(4f, 15f)
        }
    }

    val back: ImageVector by lazy {
        outline("Back") {
            moveTo(19f, 12f); lineTo(5f, 12f)
            moveTo(11f, 6f); lineTo(5f, 12f); lineTo(11f, 18f)
        }
    }

    val close: ImageVector by lazy {
        outline("Close") {
            moveTo(6f, 6f); lineTo(18f, 18f)
            moveTo(18f, 6f); lineTo(6f, 18f)
        }
    }

    val chevronUp: ImageVector by lazy {
        outline("ChevronUp") {
            moveTo(6f, 15f); lineTo(12f, 9f); lineTo(18f, 15f)
        }
    }

    val chevronRight: ImageVector by lazy {
        outline("ChevronRight") {
            moveTo(9f, 6f); lineTo(15f, 12f); lineTo(9f, 18f)
        }
    }

    /** A link: add a house from a project page. */
    val link: ImageVector by lazy {
        outline("Link") {
            moveTo(10f, 14f); lineTo(14f, 10f)
            moveTo(8.5f, 11f); lineTo(6.5f, 13f); curveTo(4.8f, 14.7f, 4.8f, 17.3f, 6.5f, 19f); curveTo(8.2f, 20.7f, 10.8f, 20.7f, 12.5f, 19f); lineTo(14.5f, 17f)
            moveTo(15.5f, 13f); lineTo(17.5f, 11f); curveTo(19.2f, 9.3f, 19.2f, 6.7f, 17.5f, 5f); curveTo(15.8f, 3.3f, 13.2f, 3.3f, 11.5f, 5f); lineTo(9.5f, 7f)
        }
    }

    /** An exclamation in a triangle: a limitation, a problem. */
    val caution: ImageVector by lazy {
        outline("Caution") {
            moveTo(12f, 3.5f); lineTo(21.5f, 20f); lineTo(2.5f, 20f); close()
            moveTo(12f, 9.5f); lineTo(12f, 14f)
            moveTo(12f, 17f); lineTo(12f, 17.2f)
        }
    }

    val check: ImageVector by lazy {
        outline("Check") {
            moveTo(5f, 12.5f); lineTo(10f, 17.5f); lineTo(19f, 7f)
        }
    }

    /** Two houses: the houses on this phone. */
    val houses: ImageVector by lazy {
        outline("Houses") {
            moveTo(2.5f, 12f); lineTo(8f, 7f); lineTo(13.5f, 12f)
            moveTo(4f, 10.8f); lineTo(4f, 19f); lineTo(12f, 19f); lineTo(12f, 10.8f)
            moveTo(13f, 7.5f); lineTo(16.5f, 4.5f); lineTo(21.5f, 9f)
            moveTo(20f, 7.8f); lineTo(20f, 19f); lineTo(15f, 19f)
        }
    }
}
