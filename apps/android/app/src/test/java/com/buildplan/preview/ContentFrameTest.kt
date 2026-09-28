package com.buildplan.preview

import com.buildplan.preview.camera.ContentFrame
import com.buildplan.preview.camera.ContentInsets
import com.buildplan.preview.camera.OrbitCamera
import com.buildplan.preview.math.Bounds
import com.buildplan.preview.math.Vec3
import kotlin.math.tan
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
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

    /**
     * Filament's Camera.setShift stores twice what it is given (FCamera:
     * `mShiftCS = shift * 2.0`, added in clip space): the renderer passes half
     * the NDC shift, or the house lands twice as far as the free area's centre.
     */
    @Test
    fun filamentTakesHalfTheNdcShift() {
        val f = ContentFrame.of(1080, 2400, ContentInsets(top = 270, right = 210, bottom = 450))
        assertEquals(f.shiftX / 2.0, f.filamentShiftX, 1e-12)
        assertEquals(f.shiftY / 2.0, f.filamentShiftY, 1e-12)
        // The free area's centre is 105 px left of the screen's centre: -105 / 540 = -0.194 NDC, -0.097 for Filament.
        assertEquals(-105.0 / 540.0, f.shiftX, 1e-9)
        assertEquals(-105.0 / 1080.0, f.filamentShiftX, 1e-9)
    }

    @Test
    fun withoutChromeTheFitAspectIsTheViewportsNarrowerSide() {
        assertEquals(1080.0 / 2400.0, ContentFrame.fitAspect(1080, 2400, ContentInsets.NONE), 1e-9)
        assertEquals(1.0, ContentFrame.fitAspect(2400, 1080, ContentInsets.NONE), 1e-9)
    }

    /**
     * Cycle 1, C1-01: the home view cut the gables off a portrait phone
     * (fitted to the vertical field, then scaled). Fitted with the free
     * rectangle's aspect, the house's bounding sphere — margin included —
     * lies inside the free rectangle on every side.
     */
    @Test
    fun theHomeViewFitsTheWholeHouseInsideTheFreeRectangleOnAPortraitPhone() {
        val w = 1080
        val h = 2400
        val insets = ContentInsets(top = 270, right = 210, bottom = 450)
        val house = Bounds(Vec3(0.0, 0.0, 0.0), Vec3(12.6, 8.0, 10.0))
        val camera = OrbitCamera(house)
        val pose = camera.home(ContentFrame.fitAspect(w, h, insets))
        val frame = ContentFrame.of(w, h, insets)
        // Sphere radius on screen, in pixels, after the frame's uniform scale.
        val tanHalf = tan(Math.toRadians(camera.fovDeg) / 2.0)
        val radiusPx = frame.scale * (h / 2.0) * house.radius / (pose.distance * tanHalf)
        val freeW = w - insets.left - insets.right
        val freeH = h - insets.top - insets.bottom
        assertTrue("fits the free width: 2 × $radiusPx ≤ $freeW", 2 * radiusPx <= freeW + 1e-6)
        assertTrue("fits the free height: 2 × $radiusPx ≤ $freeH", 2 * radiusPx <= freeH + 1e-6)
        // …and uses it: the narrower free side is filled up to the framing margin.
        assertEquals(freeW / 1.35, 2 * radiusPx, 1.0)
    }

    @Test
    fun theModelIsNeverShrunkBelowTheFloorAndHugeInsetsAreClamped() {
        val f = ContentFrame.of(1000, 1000, ContentInsets(top = 5000, bottom = 5000))
        assertEquals(ContentFrame.MIN_SCALE, f.scale, 1e-9)
        assertEquals(0.0, f.shiftY, 1e-9)
    }
}
