package com.buildplan.preview.ui

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Build
import androidx.compose.material.icons.filled.Home
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.path
import androidx.compose.ui.unit.dp

/**
 * Icons for the five places. `Dom` and `Etapy` take the stock Material home
 * and tool; the stock set has no cube, receipt or page, so those three are
 * drawn here as plain 24 dp outlines in the same stroke weight.
 */
object ShellIcons {
    fun of(place: AppPlace): ImageVector = when (place) {
        AppPlace.HOUSE -> Icons.Filled.Home
        AppPlace.MODEL -> cube
        AppPlace.STAGES -> Icons.Filled.Build
        AppPlace.COSTS -> receipt
        AppPlace.DOCUMENTS -> page
    }

    private fun outline(name: String, block: androidx.compose.ui.graphics.vector.PathBuilder.() -> Unit): ImageVector =
        ImageVector.Builder(name = name, defaultWidth = 24.dp, defaultHeight = 24.dp, viewportWidth = 24f, viewportHeight = 24f)
            .path(stroke = SolidColor(Color.Black), strokeLineWidth = 2f, strokeLineCap = StrokeCap.Round, strokeLineJoin = StrokeJoin.Round, pathBuilder = block)
            .build()

    /** An isometric cube: three visible faces. */
    private val cube: ImageVector by lazy {
        outline("Cube") {
            moveTo(12f, 2.5f); lineTo(20.5f, 7f); lineTo(20.5f, 17f); lineTo(12f, 21.5f); lineTo(3.5f, 17f); lineTo(3.5f, 7f); close()
            moveTo(3.5f, 7f); lineTo(12f, 11.5f); lineTo(20.5f, 7f)
            moveTo(12f, 11.5f); lineTo(12f, 21.5f)
        }
    }

    /** A receipt with a torn foot and two lines. */
    private val receipt: ImageVector by lazy {
        outline("Receipt") {
            moveTo(6f, 2.5f); lineTo(18f, 2.5f); lineTo(18f, 21f); lineTo(15.5f, 19.5f); lineTo(13f, 21f); lineTo(10.5f, 19.5f); lineTo(8f, 21f); lineTo(6f, 19.5f); close()
            moveTo(9f, 8f); lineTo(15f, 8f)
            moveTo(9f, 12f); lineTo(15f, 12f)
        }
    }

    /** A page with a folded corner. */
    private val page: ImageVector by lazy {
        outline("Page") {
            moveTo(6f, 2.5f); lineTo(14f, 2.5f); lineTo(19f, 7.5f); lineTo(19f, 21.5f); lineTo(6f, 21.5f); close()
            moveTo(14f, 2.5f); lineTo(14f, 7.5f); lineTo(19f, 7.5f)
            moveTo(9f, 12.5f); lineTo(16f, 12.5f)
            moveTo(9f, 16.5f); lineTo(16f, 16.5f)
        }
    }
}
