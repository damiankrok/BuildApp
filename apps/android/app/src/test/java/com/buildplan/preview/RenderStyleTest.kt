package com.buildplan.preview

import com.buildplan.preview.render.RenderStyle
import com.buildplan.preview.render.Selection
import com.buildplan.preview.scene.BundleMaterial
import com.buildplan.preview.scene.GeometryPart
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** The two required styles, and the colour arithmetic behind them. */
class RenderStyleTest {

    private val brick = BundleMaterial(id = "m-brick", name = "Brick", color = "#b45a3c")

    @Test
    fun `Construction keeps the distinctions the model makes`() {
        val style = RenderStyle.CONSTRUCTION
        val wall = style.appearanceOf(GeometryPart.WALL, null)
        val roof = style.appearanceOf(GeometryPart.ROOF, null)
        val slab = style.appearanceOf(GeometryPart.SLAB, null)
        val stair = style.appearanceOf(GeometryPart.STAIR_STEP, null)
        val railing = style.appearanceOf(GeometryPart.RAILING_POST, null)
        val chimney = style.appearanceOf(GeometryPart.CHIMNEY, null)
        val balcony = style.appearanceOf(GeometryPart.BALCONY, null)
        val frame = style.appearanceOf(GeometryPart.DOOR_FRAME, null)
        val region = style.appearanceOf(GeometryPart.SURFACE_REGION, null)
        val distinct = listOf(wall, roof, slab, stair, railing, chimney, balcony, frame, region)
            .map { Triple(it.red, it.green, it.blue) }
            .toSet()
        assertEquals("every part must stay tellable apart", 9, distinct.size)
    }

    @Test
    fun `Construction prefers the model's own material where the model states one`() {
        val plain = RenderStyle.CONSTRUCTION.appearanceOf(GeometryPart.WALL, null)
        val painted = RenderStyle.CONSTRUCTION.appearanceOf(GeometryPart.WALL, brick)
        assertNotEquals(plain.red, painted.red)
        assertEquals(RenderStyle.srgbToLinear(0xb4 / 255f), painted.red, 1e-6f)
    }

    @Test
    fun `a window's glazing is never painted with its wall's material`() {
        val glass = RenderStyle.CONSTRUCTION.appearanceOf(GeometryPart.WINDOW_GLASS, brick)
        val unpainted = RenderStyle.CONSTRUCTION.appearanceOf(GeometryPart.WINDOW_GLASS, null)
        assertEquals(unpainted.red, glass.red, 1e-9f)
        assertTrue("glazing must read through", glass.isTranslucent)
    }

    @Test
    fun `Clay flattens the opaque surfaces to one neutral`() {
        val style = RenderStyle.CLAY
        val opaqueParts = listOf(
            GeometryPart.WALL, GeometryPart.ROOF, GeometryPart.SLAB, GeometryPart.STAIR_STEP,
            GeometryPart.CHIMNEY, GeometryPart.BALCONY, GeometryPart.DOOR_LEAF, GeometryPart.SURFACE_REGION,
        )
        val colours = opaqueParts.map { style.appearanceOf(it, brick) }.map { Triple(it.red, it.green, it.blue) }.toSet()
        assertEquals("clay is one colour, model material and all", 1, colours.size)
        for (p in opaqueParts) assertFalse(style.appearanceOf(p, null).isTranslucent)
    }

    @Test
    fun `Clay still lets the openings read`() {
        val glass = RenderStyle.CLAY.appearanceOf(GeometryPart.WINDOW_GLASS, null)
        val wall = RenderStyle.CLAY.appearanceOf(GeometryPart.WALL, null)
        assertTrue("a clay study with invisible windows is not a study of its mass", glass.isTranslucent)
        assertNotEquals(Triple(wall.red, wall.green, wall.blue), Triple(glass.red, glass.green, glass.blue))
    }

    @Test
    fun `glazing is translucent in both styles`() {
        for (style in RenderStyle.entries) {
            for (part in listOf(GeometryPart.WINDOW_GLASS, GeometryPart.DOOR_GLASS, GeometryPart.ROOFLIGHT_GLASS)) {
                assertTrue("$style $part", style.appearanceOf(part, null).isTranslucent)
            }
        }
    }

    @Test
    fun `every part the shipped scenes use has an appearance in both styles`() {
        for (scene in listOf(TestScenes.marcowki, TestScenes.demo)) {
            for (obj in scene.objects) {
                for (part in obj.parts) {
                    assertNotEquals(
                        "${scene.key} ${obj.id}: part ${part.rawPart} is unknown to the renderer",
                        GeometryPart.OTHER,
                        part.part,
                    )
                    for (style in RenderStyle.entries) {
                        val a = style.appearanceOf(part.part, part.materialId?.let { scene.materials[it] })
                        assertTrue(a.red.isFinite() && a.green.isFinite() && a.blue.isFinite())
                        assertTrue(a.alpha in 0f..1f)
                        assertTrue(a.roughness in 0f..1f)
                        assertTrue(a.metallic in 0f..1f)
                    }
                }
            }
        }
    }

    @Test
    fun `sRGB becomes linear, which is what Filament shades in`() {
        assertEquals(0f, RenderStyle.srgbToLinear(0f), 1e-9f)
        assertEquals(1f, RenderStyle.srgbToLinear(1f), 1e-6f)
        // Mid grey is darker in linear space; handing sRGB straight to the
        // shader is exactly how a render ends up washed out.
        assertTrue(RenderStyle.srgbToLinear(0.5f) < 0.25f)
        assertTrue(RenderStyle.srgbToLinear(0.5f) > 0.2f)
    }

    @Test
    fun `an unreadable material colour falls back instead of throwing`() {
        for (bad in listOf("", "#12", "not a colour", "#zzzzzz")) {
            val rgb = RenderStyle.parseHexColor(bad)
            assertEquals(3, rgb.size)
            for (c in rgb) assertTrue(c in 0f..1f)
        }
    }

    @Test
    fun `the selection highlight is its own colour, not a status colour`() {
        assertEquals(3, Selection.EMISSIVE.size)
        assertTrue("the highlight must actually glow", Selection.EMISSIVE.any { it > 0.1f })
        // Blue, not the red or amber a viewer would read as an error or a warning.
        assertTrue(Selection.EMISSIVE[2] > Selection.EMISSIVE[0])
        assertTrue(Selection.OUTLINE[3] > 0.5f)
    }
}
