package com.buildplan.preview

import com.buildplan.preview.camera.ContentFrame
import com.buildplan.preview.camera.ContentInsets
import org.junit.Assert.assertEquals
import org.junit.Test

/**
 * Framing the model inside the space the 3D chrome leaves free
 * (INTEGRATION-003C): pure arithmetic handed to Filament's shift and scaling.
 */
class ContentFrameTest {
    @Test
    fun noInsetsChangeNothing() {
        assertEquals(ContentFrame.IDENTITY, ContentFrame.of(1080, 2400, ContentInsets.NONE))
    }

    @Test
    fun aTopContextAndABottomTimelineCentreTheModelBetweenThemAndShrinkItToFit() {
        // 1080 x 2400 px: 200 px of chrome at the top, 500 px at the bottom.
        val f = ContentFrame.of(1080, 2400, ContentInsets(top = 200, bottom = 500))
        assertEquals(0.0, f.shiftX, 1e-9)
        // The free band's centre, (200 + 1900) / 2 = 1050 px from the top, is 150 px above the middle: +0.125 in NDC.
        assertEquals(300.0 / 2400.0, f.shiftY, 1e-9)
        assertEquals(1700.0 / 2400.0, f.scale, 1e-9)
    }

    @Test
    fun aSideRailMovesTheCentreAwayFromIt() {
        val f = ContentFrame.of(1000, 2000, ContentInsets(right = 200))
        assertEquals(-0.2, f.shiftX, 1e-9)
        assertEquals(0.8, f.scale, 1e-9)
    }

    @Test
    fun theModelIsNeverShrunkBelowTheFloorAndHugeInsetsAreClamped() {
        val f = ContentFrame.of(1000, 1000, ContentInsets(top = 5000, bottom = 5000))
        assertEquals(ContentFrame.MIN_SCALE, f.scale, 1e-9)
        assertEquals(0.0, f.shiftY, 1e-9)
    }
}
