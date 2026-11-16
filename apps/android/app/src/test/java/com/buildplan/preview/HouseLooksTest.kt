package com.buildplan.preview

import com.buildplan.preview.math.Bounds
import com.buildplan.preview.math.Vec3
import com.buildplan.preview.presentation.EdgeTier
import com.buildplan.preview.presentation.GroundFootprint
import com.buildplan.preview.presentation.HouseLooks
import com.buildplan.preview.presentation.LookFamily
import com.buildplan.preview.presentation.LookPalette
import com.buildplan.preview.presentation.PresentationLook
import com.buildplan.preview.presentation.PresentationMode
import com.buildplan.preview.render.RenderStyle
import com.buildplan.preview.render.SurfaceAppearance
import com.buildplan.preview.scene.BundleMaterial
import com.buildplan.preview.scene.GeometryPart
import com.buildplan.preview.scene.SemanticGroup
import com.buildplan.preview.ui.Palette
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.abs
import kotlin.math.atan2
import kotlin.math.cbrt
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

/**
 * The house looks (COZY, DUSK, SUNLIGHT, TECHNICAL, XRAY, BLUEPRINT) as
 * arithmetic: deterministic palettes, translucency only where a look means
 * it, adjacent groups that stay apart, X-ray glazing that stays glazing, a
 * selection that stays visible, chrome that stays legible over every
 * backdrop, and the older looks left exactly as they were.
 */
class HouseLooksTest {

    private val looks = listOf(
        PresentationMode.COZY, PresentationMode.DUSK, PresentationMode.SUNLIGHT,
        PresentationMode.TECHNICAL, PresentationMode.XRAY, PresentationMode.BLUEPRINT,
    )

    /** Looks in which the surfaces' values carry the form; in the others the ink does. */
    private val valueLooks = listOf(PresentationMode.COZY, PresentationMode.DUSK, PresentationMode.SUNLIGHT, PresentationMode.TECHNICAL)
    private val inkLooks = listOf(PresentationMode.XRAY, PresentationMode.BLUEPRINT)

    private val brick = BundleMaterial(id = "m-brick", name = "Brick", color = "#b45a3c")

    // --- colour arithmetic --------------------------------------------------

    private fun luminance(r: Float, g: Float, b: Float): Double = 0.2126 * r + 0.7152 * g + 0.0722 * b

    /** CIE L* of a linear colour. */
    private fun lightness(rgb: FloatArray): Double {
        val y = luminance(rgb[0], rgb[1], rgb[2])
        return if (y > 0.008856) 116.0 * cbrt(y) - 16.0 else 903.3 * y
    }

    /** The surface's own colour, linear and not premultiplied. */
    private fun colourOf(a: SurfaceAppearance): FloatArray =
        if (a.alpha >= 0.999f) floatArrayOf(a.red, a.green, a.blue) else floatArrayOf(a.red / a.alpha, a.green / a.alpha, a.blue / a.alpha)

    private fun ofGroup(mode: PresentationMode, group: SemanticGroup, part: GeometryPart = GeometryPart.WALL): SurfaceAppearance =
        LookPalette.appearanceOf(mode, part, group)

    private fun unpremultiplied(ink: FloatArray): FloatArray = floatArrayOf(ink[0] / ink[3], ink[1] / ink[3], ink[2] / ink[3])

    /** Hue in degrees and a chroma measure of a linear colour. */
    private fun hue(rgb: FloatArray): Double = Math.toDegrees(atan2(Math.sqrt(3.0) * (rgb[1] - rgb[2]), 2.0 * rgb[0] - rgb[1] - rgb[2])).let { if (it < 0) it + 360 else it }

    private fun chroma(rgb: FloatArray): Float = (max(rgb[0], max(rgb[1], rgb[2])) - min(rgb[0], min(rgb[1], rgb[2]))) / max(1e-6f, max(rgb[0], max(rgb[1], rgb[2])))

    private fun toSrgb(c: Float): Float = if (c <= 0.0031308f) c * 12.92f else (1.055 * c.toDouble().pow(1 / 2.4) - 0.055).toFloat()

    private fun wcagLuminance(srgb: FloatArray): Double {
        fun lin(c: Float) = if (c <= 0.04045f) c / 12.92 else ((c + 0.055) / 1.055).pow(2.4)
        return 0.2126 * lin(srgb[0]) + 0.7152 * lin(srgb[1]) + 0.0722 * lin(srgb[2])
    }

    private fun contrast(a: FloatArray, b: FloatArray): Double {
        val la = wcagLuminance(a); val lb = wcagLuminance(b)
        return (max(la, lb) + 0.05) / (min(la, lb) + 0.05)
    }

    // --- determinism ----------------------------------------------------------

    @Test
    fun `every look's palette is deterministic and reads no model colour`() {
        for (scene in TestScenes.all) for (o in scene.objects) for (p in o.parts) for (mode in looks) {
            val material = p.materialId?.let { scene.materials[it] }
            val a = mode.appearanceOf(RenderStyle.CONSTRUCTION, p, material, scene.styling)
            val b = mode.appearanceOf(RenderStyle.ARCHITECTURAL, p, brick, null)
            assertEquals("${scene.key} ${o.id} ${p.part} in $mode", a, b)
            assertTrue(a.red.isFinite() && a.green.isFinite() && a.blue.isFinite())
            assertTrue(a.alpha in 0f..1f && a.roughness in 0f..1f && a.metallic in 0f..1f && a.reflectance in 0f..1f)
        }
        // Every group has a swatch of its own in every look: no look falls back for a group the build knows.
        for (mode in looks) for (group in SemanticGroup.entries) assertTrue("$mode $group", LookPalette.tableOf(mode).containsKey(group))
    }

    @Test
    fun `the looks are listed under the three families, the older ones where they were`() {
        assertEquals(listOf(PresentationMode.MODEL, PresentationMode.CLAY, PresentationMode.LINE), PresentationMode.entries.take(3))
        assertEquals(listOf(PresentationMode.MODEL, PresentationMode.COZY, PresentationMode.DUSK), PresentationMode.entries.filter { it.family == LookFamily.HOME })
        assertEquals(listOf(PresentationMode.CLAY, PresentationMode.LINE, PresentationMode.SUNLIGHT), PresentationMode.entries.filter { it.family == LookFamily.STUDY })
        assertEquals(listOf(PresentationMode.TECHNICAL, PresentationMode.XRAY, PresentationMode.BLUEPRINT), PresentationMode.entries.filter { it.family == LookFamily.TECHNICAL })
        for (mode in looks) assertFalse("$mode is not the Style menu", mode.usesStyle)
    }

    // --- translucency only where intended ------------------------------------

    @Test
    fun `translucency only where a look means it`() {
        for (scene in TestScenes.all) for (o in scene.objects) for (p in o.parts) for (mode in looks) {
            val a = mode.appearanceOf(RenderStyle.CONSTRUCTION, p, null, scene.styling)
            if (mode.seeThrough) {
                assertTrue("${scene.key} ${o.id} ${p.part}: X-ray draws every surface see-through", a.isTranslucent)
                assertTrue(a.alpha >= LookPalette.XRAY_MIN_ALPHA)
            } else {
                assertEquals("${scene.key} ${o.id} ${p.part} in $mode", p.part.isTranslucent, a.isTranslucent)
            }
            if (a.isTranslucent) {
                assertTrue("$mode ${p.part}: premultiplied", a.red <= a.alpha + 1e-6f && a.green <= a.alpha + 1e-6f && a.blue <= a.alpha + 1e-6f)
                assertTrue("$mode ${p.part}: softened, never erased", a.alpha >= min(RenderStyle.MIN_ALPHA, LookPalette.XRAY_MIN_ALPHA))
            }
        }
        assertEquals("only the X-ray look rebinds opaque parts", listOf(PresentationMode.XRAY), PresentationMode.entries.filter { it.seeThrough })
        // Every combination, not only the shipped ones: an opaque part is opaque outside X-ray, whatever its group.
        for (mode in looks.filter { !it.seeThrough }) for (part in GeometryPart.entries) for (group in SemanticGroup.entries) {
            assertEquals("$mode $part $group", part.isTranslucent, LookPalette.appearanceOf(mode, part, group).isTranslucent)
        }
    }

    @Test
    fun `glazing is the only thing that glows, and at dusk it glows warm`() {
        for (mode in looks) for (part in GeometryPart.entries) for (group in SemanticGroup.entries) {
            val a = LookPalette.appearanceOf(mode, part, group)
            if (a.isEmissive) assertTrue("$mode $part $group glows but is not glazing", LookPalette.isGlazing(part))
        }
        for (part in listOf(GeometryPart.WINDOW_GLASS, GeometryPart.DOOR_GLASS, GeometryPart.ROOFLIGHT_GLASS)) {
            val lit = LookPalette.appearanceOf(PresentationMode.DUSK, part, SemanticGroup.WINDOW_GLASS)
            assertTrue("$part is lit at dusk", lit.isEmissive)
            assertTrue("a warm light: red over green over blue", lit.emissiveRed > lit.emissiveGreen && lit.emissiveGreen > lit.emissiveBlue)
            assertFalse("not by day", LookPalette.appearanceOf(PresentationMode.COZY, part, SemanticGroup.WINDOW_GLASS).isEmissive)
        }
        // A glass railing infill is glass, not a window: it never lights up.
        assertFalse(LookPalette.appearanceOf(PresentationMode.DUSK, GeometryPart.RAILING_INFILL, SemanticGroup.WINDOW_GLASS).isEmissive)
    }

    // --- contrast -------------------------------------------------------------

    /** Groups that commonly meet on a facade, a roof or a floor edge. */
    private val adjacent = listOf(
        SemanticGroup.WALL_MAIN to SemanticGroup.ROOF_MAIN,
        SemanticGroup.WALL_MAIN to SemanticGroup.WINDOW_FRAME,
        SemanticGroup.WALL_MAIN to SemanticGroup.DOOR,
        SemanticGroup.WALL_MAIN to SemanticGroup.WALL_SECONDARY,
        SemanticGroup.WALL_MAIN to SemanticGroup.WALL_CLADDING,
        SemanticGroup.WALL_MAIN to SemanticGroup.SLAB,
        SemanticGroup.WALL_MAIN to SemanticGroup.TERRACE_SURFACE,
        SemanticGroup.ROOF_MAIN to SemanticGroup.ROOF_TRIM,
        SemanticGroup.ROOF_MAIN to SemanticGroup.CHIMNEY,
    )

    @Test
    fun `adjacent semantic groups stay apart where the surfaces carry the form`() {
        for (mode in valueLooks) for ((a, b) in adjacent) {
            val la = lightness(colourOf(ofGroup(mode, a)))
            val lb = lightness(colourOf(ofGroup(mode, b)))
            assertTrue("$mode: $a (L* %.1f) and $b (L* %.1f) merge".format(la, lb), abs(la - lb) >= 8.0)
        }
    }

    @Test
    fun `where the ink carries the form, every edge is inked and stands off every surface and the backdrop`() {
        for (mode in inkLooks) {
            assertEquals("$mode inks every edge", EdgeTier.entries.toSet(), mode.edgeTiers)
            val look = mode.look(RenderStyle.CONSTRUCTION)
            val ink = lightness(unpremultiplied(look.edgeInk))
            assertTrue("$mode: ink against its backdrop", abs(ink - lightness(look.background)) >= 50.0)
            if (!mode.seeThrough) {
                for (group in SemanticGroup.entries) {
                    // Glazing, rooms and markers are translucent sheets: the lines are not drawn on them.
                    if (LookPalette.swatchOf(mode, group).alpha < 1f) continue
                    val surface = ofGroup(mode, group)
                    assertTrue("$mode: ink on $group", abs(ink - lightness(colourOf(surface))) >= 40.0)
                }
            }
        }
        // The technical view inks too, and its light ink stands off its mid-value walls.
        val technical = PresentationMode.TECHNICAL.look(RenderStyle.CONSTRUCTION)
        assertEquals(EdgeTier.entries.toSet(), PresentationMode.TECHNICAL.edgeTiers)
        assertTrue(lightness(unpremultiplied(technical.edgeInk)) - lightness(colourOf(ofGroup(PresentationMode.TECHNICAL, SemanticGroup.WALL_MAIN))) >= 25.0)
    }

    @Test
    fun `the walls keep their silhouette against the backdrop`() {
        for (mode in valueLooks) {
            val look = mode.look(RenderStyle.CONSTRUCTION)
            val wall = lightness(colourOf(ofGroup(mode, SemanticGroup.WALL_MAIN)))
            val roof = lightness(colourOf(ofGroup(mode, SemanticGroup.ROOF_MAIN)))
            val backdrop = lightness(look.background)
            assertTrue("$mode: walls (L* %.1f) against the backdrop (L* %.1f)".format(wall, backdrop), abs(wall - backdrop) >= 10.0)
            assertTrue("$mode: roof against the backdrop", abs(roof - backdrop) >= 10.0)
            look.ground?.let { ground -> assertTrue("$mode: walls against the ground sheet", abs(wall - lightness(ground)) >= 10.0) }
        }
    }

    // --- X-ray ------------------------------------------------------------------

    @Test
    fun `the X-ray look keeps glazing distinguishable`() {
        val mode = PresentationMode.XRAY
        val glass = ofGroup(mode, SemanticGroup.WINDOW_GLASS, GeometryPart.WINDOW_GLASS)
        val shell = listOf(SemanticGroup.WALL_MAIN, SemanticGroup.WALL_SECONDARY, SemanticGroup.WALL_INTERIOR, SemanticGroup.WALL_CLADDING, SemanticGroup.ROOF_MAIN, SemanticGroup.SLAB)
        for (group in shell) {
            val surface = ofGroup(mode, group)
            assertTrue("glass reads over $group: ${glass.alpha} vs ${surface.alpha}", glass.alpha >= 2.5f * surface.alpha)
            assertTrue("glass is a colour, $group is a tone", chroma(colourOf(glass)) >= chroma(colourOf(surface)) + 0.4f)
        }
        assertTrue("an opening stays an opening seen through two walls: it gives off a little light", glass.isEmissive)
        // Glass is not mistaken for the other accents: rooms, the circulation, the frames.
        val glassHue = hue(colourOf(glass))
        for (accent in listOf(SemanticGroup.ROOM, SemanticGroup.STAIR, SemanticGroup.DOOR)) {
            val d = abs(glassHue - hue(colourOf(ofGroup(mode, accent)))).let { min(it, 360 - it) }
            assertTrue("glass and $accent share a hue (%.0f°)".format(d), d >= 25.0)
        }
        assertTrue(chroma(colourOf(glass)) > chroma(colourOf(ofGroup(mode, SemanticGroup.WINDOW_FRAME))) + 0.4f)
        // The same holds for every glazing part the compiler produces.
        for (part in listOf(GeometryPart.DOOR_GLASS, GeometryPart.ROOFLIGHT_GLASS)) assertEquals(glass, ofGroup(mode, SemanticGroup.WINDOW_GLASS, part))
    }

    @Test
    fun `the X-ray look shows what is inside over the shell around it`() {
        val mode = PresentationMode.XRAY
        fun alpha(g: SemanticGroup) = ofGroup(mode, g).alpha
        assertTrue("partitions read over the facade", alpha(SemanticGroup.WALL_INTERIOR) > alpha(SemanticGroup.WALL_MAIN))
        assertTrue("the roof is the faintest of the shell", alpha(SemanticGroup.ROOF_MAIN) < alpha(SemanticGroup.WALL_MAIN) && alpha(SemanticGroup.ROOF_MAIN) < alpha(SemanticGroup.SLAB) + 1e-6f)
        assertTrue("rooms and stairs read through the storeys", alpha(SemanticGroup.ROOM) > alpha(SemanticGroup.SLAB) && alpha(SemanticGroup.STAIR) > alpha(SemanticGroup.SLAB))
        for (group in SemanticGroup.entries) assertTrue("$group is see-through", alpha(group) <= 0.5f)
        val look = mode.look(RenderStyle.CONSTRUCTION)
        assertFalse("nothing shades through glass", look.shadows)
        assertNull(look.ambientOcclusion)
        assertNull("no sheet hides the grid", look.ground)
        // The grid stays in view: composited over the backdrop, it stands off it.
        val grid = look.grid
        val over = FloatArray(3) { grid[it] + (1 - grid[3]) * look.background[it] }
        assertTrue("the grid under the house is visible", lightness(over) - lightness(look.background) >= 10.0)
        // The circulation accents are never the rule's yellow, which means progress.
        for (accent in listOf(SemanticGroup.STAIR, SemanticGroup.DOOR)) {
            val h = hue(colourOf(ofGroup(mode, accent)))
            assertTrue("$accent at %.0f° reads as the progress yellow".format(h), h !in 38.0..62.0)
        }
    }

    // --- selection, ink, cover, ground ------------------------------------------

    @Test
    fun `the selection stays distinguishable in every look that inks`() {
        for (mode in looks) {
            val look = mode.look(RenderStyle.CONSTRUCTION)
            for (ink in listOf(look.edgeInk, look.selectedEdgeInk, look.grid)) for (c in 0 until 3) assertTrue("$mode: premultiplied", ink[c] <= ink[3] + 1e-6f)
            if (mode.edgeTiers.isEmpty()) continue
            assertTrue("$mode: edges need FXAA", look.fxaa)
            assertTrue("$mode: a lit surface must not tie with its own edge", look.surfaceDepthOffset > 0f || mode.seeThrough)
            val difference = (0 until 4).maxOf { abs(look.selectedEdgeInk[it] - look.edgeInk[it]) }
            assertTrue("$mode: the selected contour is lost in the others", difference >= 0.25f)
            assertTrue("$mode: the selected contour is drawn at full strength", look.selectedEdgeInk[3] >= 0.95f)
        }
    }

    @Test
    fun `the home looks lay tiles a step lighter than the roof and stand the house on a warm ground`() {
        for (mode in listOf(PresentationMode.COZY, PresentationMode.DUSK)) {
            assertTrue(mode.showsRoofCover)
            val tiles = lightness(colourOf(mode.coverAppearance()))
            val roof = lightness(colourOf(ofGroup(mode, SemanticGroup.ROOF_MAIN)))
            assertTrue("$mode: tiles %.1f over roof %.1f".format(tiles, roof), tiles - roof in 2.0..12.0)
            assertNotNull("$mode stands on a ground sheet", mode.look(RenderStyle.CONSTRUCTION).ground)
        }
        val cozy = HouseLooks.COZY
        val ground = cozy.ground ?: error("COZY has a ground")
        assertTrue("a warm ground: red over blue", ground[0] > ground[2] * 1.3f)
        assertTrue("a warm sun", cozy.sunColor[0] > cozy.sunColor[2])
        assertTrue("a warm sky fill", cozy.ambientTint[0] > cozy.ambientTint[2])
        val clay = PresentationLook.CLAY.ambientOcclusion ?: error("CLAY has occlusion")
        val soft = cozy.ambientOcclusion ?: error("COZY has occlusion")
        assertTrue("softer occlusion than the clay study", soft.intensity < clay.intensity && soft.radius > clay.radius && soft.power < clay.power)
        assertTrue("dusk's sky fill is cool", HouseLooks.DUSK.ambientTint[2] > HouseLooks.DUSK.ambientTint[0])
        assertTrue("dusk's sun is low", abs(HouseLooks.DUSK.sunDirection[1]) < abs(cozy.sunDirection[1]))
        for (mode in listOf(PresentationMode.TECHNICAL, PresentationMode.XRAY, PresentationMode.BLUEPRINT)) {
            assertFalse("$mode lays no tiles", mode.showsRoofCover)
            assertNull("$mode lays no sheet", mode.look(RenderStyle.CONSTRUCTION).ground)
        }
        assertTrue("the technical view is dark", lightness(HouseLooks.TECHNICAL.background) < 10.0)
    }

    @Test
    fun `the looks before the house looks keep the viewer's sun, sky and bare ground`() {
        val original = FloatArray(27).also {
            it[0] = 0.55f; it[1] = 0.58f; it[2] = 0.64f
            it[3] = 0.20f; it[4] = 0.21f; it[5] = 0.24f
        }
        val older = RenderStyle.entries.map { PresentationMode.MODEL.look(it) } + listOf(PresentationLook.CLAY, PresentationLook.LINE)
        for (look in older) {
            assertArrayEquals(floatArrayOf(1.0f, 0.96f, 0.90f), look.sunColor, 0f)
            assertArrayEquals(floatArrayOf(0.45f, -0.82f, -0.35f), look.sunDirection, 0f)
            assertArrayEquals(original, look.harmonics(), 0f)
            assertNull(look.ground)
        }
        for (mode in listOf(PresentationMode.MODEL, PresentationMode.CLAY, PresentationMode.LINE)) assertFalse(mode.seeThrough)
        assertTrue(PresentationMode.CLAY.showsRoofCover)
        assertFalse(PresentationMode.LINE.showsRoofCover)
        assertFalse(PresentationMode.MODEL.showsRoofCover)
    }

    @Test
    fun `a tinted sky fill is the viewer's sky, tinted`() {
        val dusk = HouseLooks.DUSK.harmonics()
        val neutral = PresentationLook.model(RenderStyle.CONSTRUCTION).harmonics()
        for (c in 0 until 3) {
            assertEquals(neutral[c] * HouseLooks.DUSK.ambientTint[c], dusk[c], 1e-6f)
            assertEquals(neutral[3 + c] * HouseLooks.DUSK.ambientTint[c], dusk[3 + c], 1e-6f)
        }
        for (i in 6 until 27) assertEquals(0f, dusk[i], 0f)
    }

    // --- accessibility of the chrome over each backdrop -------------------------------------

    @Test
    fun `the chrome stays legible over every look's backdrop`() {
        val glass = Palette.Glass
        for (mode in PresentationMode.entries) {
            val bg = mode.look(RenderStyle.CONSTRUCTION).background.map { toSrgb(it) }
            // The glass tint composited over the backdrop as the window does: source-over in sRGB.
            val pane = floatArrayOf(
                glass.alpha * glass.red + (1 - glass.alpha) * bg[0],
                glass.alpha * glass.green + (1 - glass.alpha) * bg[1],
                glass.alpha * glass.blue + (1 - glass.alpha) * bg[2],
            )
            for ((name, ink) in listOf("Ink" to Palette.Ink, "InkMuted" to Palette.InkMuted)) {
                val ratio = contrast(floatArrayOf(ink.red, ink.green, ink.blue), pane)
                assertTrue("$mode: $name on glass is %.1f:1".format(ratio), ratio >= 4.5)
            }
        }
    }

    // --- the ground footprint -------------------------------------------------------

    @Test
    fun `the ground footprint lies under the model, the grid over the sheet`() {
        for (scene in TestScenes.all) {
            val b = scene.bounds
            val f = GroundFootprint.of(b)
            assertTrue(f.minX < b.min.x && f.maxX > b.max.x && f.minZ < b.min.z && f.maxZ > b.max.z)
            assertTrue("the grid is under the model", f.gridY < b.min.y)
            assertTrue("the sheet is under the grid", f.sheetY < f.gridY)
        }
        val unit = GroundFootprint.of(Bounds(Vec3(0.0, 1.0, 0.0), Vec3(1.0, 2.0, 1.0)))
        assertEquals("whole metres, so the grid's lines land on its edges", unit.minX, Math.floor(unit.minX), 0.0)
        assertEquals(unit.maxZ, Math.floor(unit.maxZ), 0.0)
    }
}
