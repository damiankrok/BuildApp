package com.buildplan.preview

import com.buildplan.preview.camera.ISOMETRIC_PITCH
import com.buildplan.preview.camera.OrbitCamera
import com.buildplan.preview.camera.Projection
import com.buildplan.preview.camera.ViewPreset
import com.buildplan.preview.math.Vec3
import com.buildplan.preview.presentation.PresentationLook
import com.buildplan.preview.presentation.PresentationMode
import com.buildplan.preview.presentation.StudyPalette
import com.buildplan.preview.render.RenderStyle
import com.buildplan.preview.scene.GeometryPart
import com.buildplan.preview.scene.SemanticGroup
import com.buildplan.preview.scene.ViewerState
import com.buildplan.preview.scene.Visibility
import com.buildplan.preview.scene.VisibilityMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import kotlin.math.tan

/**
 * The presentation mode as state: what it may and may not touch, what MODEL
 * preserves, and the two generic camera presets that came with it.
 */
class PresentationModeTest {

    private val scene = TestScenes.autoCandidateV3

    @Test
    fun `the viewer opens in MODEL, the presentation BuildApp already had`() {
        assertEquals(PresentationMode.MODEL, ViewerState().presentation)
        assertEquals(RenderStyle.CONSTRUCTION, ViewerState().style)
    }

    @Test
    fun `a mode switch never touches selection, isolation, layers or style`() {
        val selected = scene.objects.first { it.kind == "window" }.id
        val base = ViewerState()
            .withVisibility(scene, VisibilityMode.ROOF_OFF)
            .withStyle(RenderStyle.ARCHITECTURAL)
            .select(selected)
        for (mode in PresentationMode.entries) {
            val next = base.withPresentation(mode)
            assertEquals(mode, next.presentation)
            assertEquals(base.copy(presentation = mode), next)
            assertEquals(base.selectedObjectId, next.selectedObjectId)
            assertEquals(base.visibility, next.visibility)
            assertEquals(base.style, next.style)
            assertEquals(base.visibleObjectIds(scene), next.visibleObjectIds(scene))
        }
        val isolated = base.isolateSelected(scene)
        for (mode in PresentationMode.entries) assertEquals(isolated.visibleObjectIds(scene), isolated.withPresentation(mode).visibleObjectIds(scene))
    }

    @Test
    fun `a style or layer change keeps the mode`() {
        val clay = ViewerState().withPresentation(PresentationMode.CLAY)
        assertEquals(PresentationMode.CLAY, clay.withStyle(RenderStyle.ARCHITECTURAL).presentation)
        assertEquals(PresentationMode.CLAY, clay.withVisibility(scene, VisibilityMode.GROUND_ONLY).presentation)
        assertEquals(PresentationMode.CLAY, clay.showAll().presentation)
        assertEquals(PresentationMode.CLAY, clay.select("x").clearSelection().presentation)
    }

    @Test
    fun `what each mode draws on top of the model`() {
        assertTrue(PresentationMode.MODEL.usesStyle)
        assertFalse(PresentationMode.MODEL.showsRoofCover)
        assertTrue(PresentationMode.MODEL.edgeTiers.isEmpty())
        assertFalse(PresentationMode.CLAY.usesStyle)
        assertTrue(PresentationMode.CLAY.showsRoofCover)
        assertFalse(PresentationMode.LINE.usesStyle)
        assertFalse("the line study keeps its surfaces plain", PresentationMode.LINE.showsRoofCover)
    }

    @Test
    fun `MODEL restores exactly the look the viewer had before modes existed`() {
        for (style in RenderStyle.entries) {
            val look = PresentationMode.MODEL.look(style)
            assertEquals(RenderStyle.srgbToLinear(0x12 / 255f), look.background[0], 0f)
            assertEquals(RenderStyle.srgbToLinear(0x15 / 255f), look.background[1], 0f)
            assertEquals(RenderStyle.srgbToLinear(0x1a / 255f), look.background[2], 0f)
            assertEquals(72_000f, look.sunLux, 0f)
            assertEquals(26_000f, look.ambientIntensity, 0f)
            assertTrue(look.shadows)
            assertEquals(style.ambientOcclusionIntensity, look.ambientOcclusion!!.intensity, 0f)
            assertEquals(0.35f, look.ambientOcclusion!!.radius, 0f)
            assertEquals("Filament's default power", 1f, look.ambientOcclusion!!.power, 0f)
            assertFalse(look.fxaa)
            assertEquals(0f, look.surfaceDepthOffset, 0f)
            assertTrue("glazing keeps its old shadow behaviour in MODEL", look.glassShadows)
        }
    }

    @Test
    fun `the studies ink, and their glazing casts no shadow slab`() {
        for (mode in listOf(PresentationMode.CLAY, PresentationMode.LINE)) {
            val look = mode.look(RenderStyle.CONSTRUCTION)
            assertFalse(look.glassShadows)
            assertTrue(look.fxaa)
            assertTrue(look.surfaceDepthOffset > 0f)
            // Premultiplied ink: no channel exceeds its alpha.
            for (ink in listOf(look.edgeInk, look.selectedEdgeInk)) for (c in 0 until 3) assertTrue(ink[c] <= ink[3] + 1e-6f)
        }
        assertTrue(PresentationLook.CLAY.shadows)
        assertTrue(PresentationLook.CLAY.ambientOcclusion != null)
        assertFalse(PresentationLook.LINE.shadows)
        assertNull(PresentationLook.LINE.ambientOcclusion)
    }

    @Test
    fun `study surfaces are monochrome, glazing is a neutral premultiplied sheet`() {
        for (mode in listOf(PresentationMode.CLAY, PresentationMode.LINE)) {
            for (group in SemanticGroup.entries) {
                val opaque = StudyPalette.appearanceOf(mode, GeometryPart.WALL, group)
                assertEquals(1f, opaque.alpha, 0f)
                // A warm neutral: channels within a few percent of each other.
                assertTrue("$mode $group is not neutral", opaque.red / opaque.blue < 1.15f && opaque.red >= opaque.blue)
            }
            val glass = StudyPalette.appearanceOf(mode, GeometryPart.WINDOW_GLASS, SemanticGroup.WINDOW_GLASS)
            assertTrue(glass.isTranslucent)
            assertTrue("premultiplied", glass.red <= glass.alpha && glass.green <= glass.alpha && glass.blue <= glass.alpha)
            assertTrue("seen, and seen through", glass.alpha in 0.15f..0.5f)
            assertTrue("no strong tint", glass.blue / glass.red < 1.2f)
        }
        // The value ladder keeps the groups that commonly meet apart.
        val wall = StudyPalette.appearanceOf(PresentationMode.CLAY, GeometryPart.WALL, SemanticGroup.WALL_MAIN).red
        val roof = StudyPalette.appearanceOf(PresentationMode.CLAY, GeometryPart.ROOF, SemanticGroup.ROOF_MAIN).red
        val frame = StudyPalette.appearanceOf(PresentationMode.CLAY, GeometryPart.WINDOW_FRAME, SemanticGroup.WINDOW_FRAME).red
        assertTrue(wall > roof && roof > frame)
    }

    @Test
    fun `every shipped part has a study appearance in both studies`() {
        for (s in TestScenes.all) for (o in s.objects) for (p in o.parts) {
            for (mode in listOf(PresentationMode.CLAY, PresentationMode.LINE)) {
                val a = StudyPalette.appearanceOf(mode, p)
                assertEquals("${s.key} ${o.id} ${p.part}", p.part.isTranslucent, a.isTranslucent)
                assertTrue(a.red.isFinite() && a.green.isFinite() && a.blue.isFinite())
            }
        }
    }

    @Test
    fun `objects of one visibility class are always shown or hidden together`() {
        // What lets the renderer batch feature edges per class.
        for (s in TestScenes.all) for (mode in VisibilityMode.entries) {
            val visible = Visibility.visibleObjectIds(s, mode)
            for ((cls, members) in s.objects.groupBy { Visibility.classOf(it) }) {
                val shown = members.count { it.id in visible }
                assertTrue("${s.key} $mode $cls: $shown of ${members.size}", shown == 0 || shown == members.size)
            }
        }
    }

    // --- The two generic camera presets -------------------------------------

    @Test
    fun `fit model keeps the angle and fits the narrower side of a portrait screen`() {
        val camera = OrbitCamera(scene.bounds)
        val from = camera.orbit(camera.home(), 50.0, 10.0)
        val portrait = 9.0 / 19.5
        val pose = ViewPreset.FIT.poseIn(camera, scene, from, portrait)!!
        assertEquals(from.yawDeg, pose.yawDeg, 1e-9)
        assertEquals(from.pitchDeg, pose.pitchDeg, 1e-9)
        assertEquals(from.projection, pose.projection)
        // The bounding sphere fits the horizontal half-field with the margin.
        val horizontalHalf = tan(Math.toRadians(camera.fovDeg) / 2.0) * portrait
        assertTrue(scene.bounds.radius / (pose.distance * horizontalHalf) <= 1.0)
        // Landscape is limited by the vertical field, as every older preset is.
        val landscape = ViewPreset.FIT.poseIn(camera, scene, from, 19.5 / 9.0)!!
        assertEquals(camera.distanceToFit(scene.bounds, ViewPreset.FIT.margin), landscape.distance, 1e-9)
        assertTrue(pose.distance > landscape.distance)
    }

    @Test
    fun `isometric is a true isometric`() {
        assertEquals(35.26438968, ISOMETRIC_PITCH, 1e-6)
        assertEquals(45.0, ViewPreset.ISOMETRIC.yawDeg, 0.0)
        assertEquals(Projection.ORTHOGRAPHIC, ViewPreset.ISOMETRIC.projection)
        val camera = OrbitCamera(scene.bounds)
        val d = camera.direction(ViewPreset.ISOMETRIC.poseIn(camera, scene, camera.home())!!)
        // Equal foreshortening: the view direction makes the same angle with all three axes.
        assertEquals(kotlin.math.abs(d.x), kotlin.math.abs(d.y), 1e-9)
        assertEquals(kotlin.math.abs(d.y), kotlin.math.abs(d.z), 1e-9)
    }

    @Test
    fun `the older presets frame exactly as before, whatever the screen`() {
        val camera = OrbitCamera(scene.bounds)
        for (preset in ViewPreset.entries.filter { !it.fitsViewport }) {
            val a = preset.poseIn(camera, scene, camera.home()) ?: continue
            val b = preset.poseIn(camera, scene, camera.home(), 0.4) ?: continue
            assertEquals("${preset.label} moved with the aspect", a, b)
        }
        // And the generic presets need nothing but the bounds.
        assertTrue(ViewPreset.FIT.isAvailableIn(TestScenes.demo))
        assertTrue(ViewPreset.ISOMETRIC.isAvailableIn(TestScenes.demo))
        assertEquals(Vec3.ZERO, ViewPreset.FIT.poseIn(camera, scene, camera.home(), 0.5)!!.pan)
    }
}
