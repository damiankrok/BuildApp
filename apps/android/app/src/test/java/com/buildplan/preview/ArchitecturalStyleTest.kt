package com.buildplan.preview

import com.buildplan.preview.render.ArchitecturalPalette
import com.buildplan.preview.render.RenderStyle
import com.buildplan.preview.render.SurfaceAppearance
import com.buildplan.preview.scene.BundleGroupAppearance
import com.buildplan.preview.scene.BundleParser
import com.buildplan.preview.scene.BundleResult
import com.buildplan.preview.scene.BundleStyling
import com.buildplan.preview.scene.GeometryPart
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.SceneBundle
import com.buildplan.preview.scene.ScenePart
import com.buildplan.preview.scene.SemanticGroup
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assume.assumeTrue
import org.junit.Test
import java.io.File

/**
 * The Architectural style: semantic groups drawn from the architectural
 * palette, the bundle's own copy first and the built-in copy for bundles
 * exported before the palette existed.
 *
 * Everything is checked against the committed assets and the shared
 * TypeScript constant, never against colours typed into this file: a second
 * hand-kept palette here would be exactly the drift these tests exist to
 * catch.
 */
class ArchitecturalStyleTest {

    private val v2Asset = "marcowki-auto-v2.scene.json"

    private fun parse(text: String): SceneBundle = when (val r = BundleParser.parse(text)) {
        is BundleResult.Ok -> r.bundle
        is BundleResult.Failure -> error("did not parse: ${r.message}")
    }

    private fun sceneOf(bundle: SceneBundle, key: String) = ModelScene.from(bundle, key, key, "")

    private val hex = Regex("^#[0-9a-fA-F]{6}$")

    private fun assertWellFormed(where: String, a: BundleGroupAppearance) {
        assertTrue("$where: colour ${a.color}", hex.matches(a.color))
        a.opacity?.let { assertTrue("$where: opacity $it", it > 0.0 && it <= 1.0) }
        assertTrue("$where: roughness ${a.roughness}", a.roughness in 0.0..1.0)
        assertTrue("$where: metalness ${a.metalness}", a.metalness in 0.0..1.0)
        assertTrue("$where: edge ${a.edge}", a.edge == "SOFT" || a.edge == "NONE")
    }

    private fun luminance(a: SurfaceAppearance): Float = 0.2126f * a.red + 0.7152f * a.green + 0.0722f * a.blue

    /** Every group of the palette, looked up by the name a bundle uses. */
    private fun builtInByName(): Map<String, BundleGroupAppearance> =
        ArchitecturalPalette.BUILT_IN.mapKeys { it.key.name }

    /** Remove `styling` and every mesh's `semanticGroup`: a bundle as exported before either existed. */
    private fun withoutStyling(text: String): String {
        val root = Json.parseToJsonElement(text).jsonObject
        val scene = root.getValue("scene").jsonObject
        val meshes = scene.getValue("meshes").jsonArray.map { m -> JsonObject(m.jsonObject - "semanticGroup") }
        val newScene = JsonObject(scene + ("meshes" to JsonArray(meshes)))
        return JsonObject(root - "styling" + ("scene" to newScene)).toString()
    }

    private fun withStyling(text: String, groups: Map<String, BundleGroupAppearance>): String {
        val root = Json.parseToJsonElement(text).jsonObject
        val styling = JsonObject(
            mapOf(
                "palette" to JsonPrimitive(ArchitecturalPalette.ID),
                "groups" to JsonObject(groups.mapValues { (_, a) -> Json.encodeToJsonElement(BundleGroupAppearance.serializer(), a) }),
            ),
        )
        return JsonObject(root + ("styling" to styling)).toString()
    }

    private fun mapMeshes(text: String, f: (JsonObject) -> JsonElement): String {
        val root = Json.parseToJsonElement(text).jsonObject
        val scene = root.getValue("scene").jsonObject
        val meshes = scene.getValue("meshes").jsonArray.map { f(it.jsonObject) }
        return JsonObject(root + ("scene" to JsonObject(scene + ("meshes" to JsonArray(meshes))))).toString()
    }

    // -----------------------------------------------------------------------
    // The committed candidate
    // -----------------------------------------------------------------------

    @Test
    fun `marcowki-auto-v2 parses and every semantic group in it has an appearance`() {
        val bundle = parse(TestScenes.text(v2Asset))
        val scene = sceneOf(bundle, "marcowki-auto-v2")
        val groupsPresent = LinkedHashSet<SemanticGroup>()
        for (obj in scene.objects) {
            for (part in obj.parts) {
                assertNotEquals("${obj.id} ${part.rawPart}: an unknown part", GeometryPart.OTHER, part.part)
                assertNotEquals("${obj.id} ${part.rawPart}: placed in no group", SemanticGroup.OTHER, part.semanticGroup)
                part.rawSemanticGroup?.let { raw ->
                    assertTrue(
                        "${obj.id}: group $raw is neither known to this build nor styled by the bundle",
                        SemanticGroup.of(raw) != null || bundle.styling?.groups?.containsKey(raw) == true,
                    )
                    if (bundle.styling != null) assertTrue("${obj.id}: the bundle does not style its own group $raw", bundle.styling!!.groups.containsKey(raw))
                }
                groupsPresent += part.semanticGroup
                val a = ArchitecturalPalette.appearanceOf(part.semanticGroup, part.rawSemanticGroup, scene.styling)
                assertWellFormed("${obj.id} ${part.rawPart} ${part.semanticGroup}", a)
                val drawn = RenderStyle.ARCHITECTURAL.appearanceOf(part, part.materialId?.let { scene.materials[it] }, scene.styling)
                assertTrue(drawn.red.isFinite() && drawn.green.isFinite() && drawn.blue.isFinite())
                assertTrue(drawn.alpha in RenderStyle.MIN_ALPHA..1f)
                // The material path is chosen per part at upload; the style must agree with it.
                assertEquals("${obj.id} ${part.rawPart}", part.part.isTranslucent, drawn.isTranslucent)
            }
        }
        // A real building: walls, a roof, glazing and frames are all there to be told apart.
        for (g in listOf(SemanticGroup.WALL_MAIN, SemanticGroup.ROOF_MAIN, SemanticGroup.WINDOW_GLASS, SemanticGroup.WINDOW_FRAME, SemanticGroup.DOOR)) {
            assertTrue("marcowki-auto-v2 has no $g", g in groupsPresent)
        }
    }

    @Test
    fun `the built-in palette equals the palette the shipped bundles carry`() {
        val builtIn = builtInByName()
        val v2 = parse(TestScenes.text(v2Asset))
        // A bundle exported before the palette existed carries none; the
        // style then draws from the built-in copy, which the next test holds
        // to the shared constant.
        v2.styling?.let { assertBundlePalette(v2Asset, it, builtIn) }
        for (entry in TestScenes.index) {
            val styling = parse(TestScenes.text(entry.asset)).styling ?: continue
            assertBundlePalette(entry.asset, styling, builtIn)
        }
    }

    private fun assertBundlePalette(asset: String, styling: BundleStyling, builtIn: Map<String, BundleGroupAppearance>) {
        assertEquals("$asset palette id", ArchitecturalPalette.ID, styling.palette)
        assertEquals("$asset names every group", builtIn.keys, styling.groups.keys)
        for ((name, expected) in builtIn) {
            val actual = styling.groups.getValue(name)
            assertWellFormed("$asset $name", actual)
            if (name in styling.toneHints) {
                // A tone hint moves only the colour, onto another rung of the same palette.
                assertEquals("$asset $name", expected.copy(color = actual.color), actual)
                assertTrue("$asset $name: hinted colour ${actual.color} is not a palette colour", builtIn.values.any { it.color == actual.color })
            } else {
                assertEquals("$asset $name", expected, actual)
            }
        }
    }

    @Test
    fun `the built-in palette is the shared constant in packages mobile-scene, value for value`() {
        val source = generateSequence(File(".").absoluteFile) { it.parentFile }
            .map { File(it, "packages/mobile-scene/src/semantics.ts") }
            .firstOrNull { it.isFile }
        assumeTrue("packages/mobile-scene is not in this checkout", source != null)
        val text = source!!.readText()
        val block = Regex("""export const ARCHITECTURAL_PALETTE: ArchitecturalPalette = \{([\s\S]*?)\n\}""").find(text)?.groupValues?.get(1)
        assertNotNull("ARCHITECTURAL_PALETTE not found in ${source.path}", block)
        assertTrue(text.contains("ARCHITECTURAL_PALETTE_ID = '${ArchitecturalPalette.ID}'"))
        val line = Regex(
            """^\s+([A-Z_]+):\s*\{\s*color:\s*'(#[0-9a-f]{6})'(?:,\s*opacity:\s*([0-9.]+))?,\s*roughness:\s*([0-9.]+),\s*metalness:\s*([0-9.]+),\s*edge:\s*'(SOFT|NONE)'\s*\},?$""",
            RegexOption.MULTILINE,
        )
        val shared = line.findAll(block!!).associate { m ->
            val (name, color, opacity, roughness, metalness, edge) = m.destructured
            name to BundleGroupAppearance(
                color = color,
                opacity = opacity.takeIf { it.isNotEmpty() }?.toDouble(),
                roughness = roughness.toDouble(),
                metalness = metalness.toDouble(),
                edge = edge,
            )
        }
        assertEquals("every group of the shared palette, and no other", SemanticGroup.entries.map { it.name }.toSet(), shared.keys)
        assertEquals(shared, builtInByName())
    }

    // -----------------------------------------------------------------------
    // Old bundles, new bundles, unknown groups
    // -----------------------------------------------------------------------

    @Test
    fun `a bundle with no styling and no groups parses and draws from the built-in palette`() {
        val bundle = parse(withoutStyling(TestScenes.text(v2Asset)))
        assertNull(bundle.styling)
        assertTrue(bundle.scene.meshes.all { it.semanticGroup == null })
        val scene = sceneOf(bundle, "old")
        for (obj in scene.objects) {
            for (part in obj.parts) {
                assertNull(part.rawSemanticGroup)
                assertEquals(ArchitecturalPalette.BUILT_IN.getValue(part.semanticGroup), ArchitecturalPalette.appearanceOf(part.semanticGroup, null, null))
            }
        }
        val walls = scene.objects.flatMap { o -> o.parts.filter { it.part == GeometryPart.WALL } }
        // Placed from the part and the material name alone: exterior walls are
        // the main body, a wall whose material says partition is interior.
        assertTrue(walls.any { it.semanticGroup == SemanticGroup.WALL_MAIN })
        assertTrue(walls.all { it.semanticGroup == SemanticGroup.WALL_MAIN || it.semanticGroup == SemanticGroup.WALL_INTERIOR })
        for (w in walls) {
            val drawn = RenderStyle.ARCHITECTURAL.appearanceOf(w, null, null)
            val expected = RenderStyle.parseHexColor(ArchitecturalPalette.BUILT_IN.getValue(w.semanticGroup).color)
            assertEquals(RenderStyle.srgbToLinear(expected[0]), drawn.red, 1e-6f)
        }
    }

    @Test
    fun `the bundle's own palette wins over the built-in copy`() {
        val custom = builtInByName().toMutableMap()
        custom["WALL_MAIN"] = custom.getValue("WALL_MAIN").copy(color = "#123456")
        val text = mapMeshes(withStyling(TestScenes.text(v2Asset), custom)) { m ->
            if ((m["part"] as? JsonPrimitive)?.content == "WALL") JsonObject(m + ("semanticGroup" to JsonPrimitive("WALL_MAIN"))) else m
        }
        val scene = sceneOf(parse(text), "custom")
        val wall = scene.objects.flatMap { o -> o.parts.filter { it.part == GeometryPart.WALL } }.first()
        assertEquals(SemanticGroup.WALL_MAIN, wall.semanticGroup)
        val a = RenderStyle.ARCHITECTURAL.appearanceOf(wall, null, scene.styling)
        assertEquals(RenderStyle.srgbToLinear(0x12 / 255f), a.red, 1e-6f)
        assertEquals(RenderStyle.srgbToLinear(0x56 / 255f), a.blue, 1e-6f)
    }

    @Test
    fun `a group this build does not know falls back to the part, and still takes the bundle's colour for it`() {
        val part = ScenePart(
            part = GeometryPart.SLAB,
            rawPart = "SLAB",
            materialId = null,
            first = 0,
            count = 3,
            semanticGroup = SemanticGroup.of("PODIUM") ?: SemanticGroup.derive(GeometryPart.SLAB),
            rawSemanticGroup = "PODIUM",
        )
        assertEquals(SemanticGroup.SLAB, part.semanticGroup)
        val withoutEntry = RenderStyle.ARCHITECTURAL.appearanceOf(part, null, BundleStyling(palette = "architectural-v2"))
        val slab = RenderStyle.ARCHITECTURAL.appearanceOf(GeometryPart.SLAB, null)
        assertEquals(slab, withoutEntry)
        val styling = BundleStyling(palette = "architectural-v2", groups = mapOf("PODIUM" to BundleGroupAppearance(color = "#000000", roughness = 0.4, metalness = 0.0, edge = "SOFT")))
        val withEntry = RenderStyle.ARCHITECTURAL.appearanceOf(part, null, styling)
        assertEquals(0f, withEntry.red, 1e-9f)
        assertEquals(0.4f, withEntry.roughness, 1e-6f)
    }

    @Test
    fun `the parser reads the two new parts and the mesh group`() {
        assertEquals(GeometryPart.TERRACE, GeometryPart.of("TERRACE"))
        assertEquals(GeometryPart.ROOF_TRIM, GeometryPart.of("ROOF_TRIM"))
        assertEquals(SemanticGroup.TERRACE_SURFACE, SemanticGroup.derive(GeometryPart.TERRACE))
        assertEquals(SemanticGroup.ROOF_TRIM, SemanticGroup.derive(GeometryPart.ROOF_TRIM))
        val text = mapMeshes(TestScenes.text(v2Asset)) { m ->
            when ((m["part"] as? JsonPrimitive)?.content) {
                "SLAB" -> JsonObject(m + ("part" to JsonPrimitive("TERRACE")) + ("semanticGroup" to JsonPrimitive("TERRACE_SURFACE")))
                "ROOF_REVEAL" -> JsonObject(m + ("part" to JsonPrimitive("ROOF_TRIM")) + ("semanticGroup" to JsonPrimitive("ROOF_TRIM")))
                else -> m
            }
        }
        val scene = sceneOf(parse(text), "new-parts")
        val parts = scene.objects.flatMap { it.parts }
        val terraces = parts.filter { it.part == GeometryPart.TERRACE }
        val trims = parts.filter { it.part == GeometryPart.ROOF_TRIM }
        assertTrue(terraces.isNotEmpty() && trims.isNotEmpty())
        assertTrue(terraces.all { it.semanticGroup == SemanticGroup.TERRACE_SURFACE && it.rawSemanticGroup == "TERRACE_SURFACE" })
        assertTrue(trims.all { it.semanticGroup == SemanticGroup.ROOF_TRIM })
    }

    // -----------------------------------------------------------------------
    // What the style draws
    // -----------------------------------------------------------------------

    @Test
    fun `every group has a built-in appearance`() {
        assertEquals(SemanticGroup.entries.toSet(), ArchitecturalPalette.BUILT_IN.keys)
        for ((g, a) in ArchitecturalPalette.BUILT_IN) assertWellFormed(g.name, a)
    }

    @Test
    fun `glass stays translucent at the palette's opacity, and a marker stays a marker`() {
        for (p in listOf(GeometryPart.WINDOW_GLASS, GeometryPart.DOOR_GLASS, GeometryPart.ROOFLIGHT_GLASS)) {
            val a = RenderStyle.ARCHITECTURAL.appearanceOf(p, null)
            assertTrue("$p", a.isTranslucent)
            assertEquals("$p", 0.35f, a.alpha, 1e-6f)
            // The same alpha as Construction: switching style does not make glazing flicker.
            assertEquals("$p", RenderStyle.CONSTRUCTION.appearanceOf(p, null).alpha, a.alpha, 1e-6f)
        }
        assertEquals(0.25f, RenderStyle.ARCHITECTURAL.appearanceOf(GeometryPart.ROOM_FLOOR, null).alpha, 1e-6f)
        // A placeholder footprint is opaque in no style: it would read as a solid stair.
        val placeholder = RenderStyle.ARCHITECTURAL.appearanceOf(GeometryPart.STAIR_PLACEHOLDER, null)
        assertEquals(RenderStyle.CONSTRUCTION.appearanceOf(GeometryPart.STAIR_PLACEHOLDER, null).alpha, placeholder.alpha, 1e-6f)
        for (p in GeometryPart.entries.filter { !it.isTranslucent }) {
            assertFalse("$p", RenderStyle.ARCHITECTURAL.appearanceOf(p, null).isTranslucent)
        }
    }

    @Test
    fun `light elements that meet stay apart in value`() {
        fun lum(g: SemanticGroup): Float {
            val rgb = RenderStyle.parseHexColor(ArchitecturalPalette.BUILT_IN.getValue(g).color)
            return 0.2126f * RenderStyle.srgbToLinear(rgb[0]) + 0.7152f * RenderStyle.srgbToLinear(rgb[1]) + 0.0722f * RenderStyle.srgbToLinear(rgb[2])
        }
        val pairs = listOf(
            SemanticGroup.WALL_MAIN to SemanticGroup.ROOF_TRIM,
            SemanticGroup.WALL_MAIN to SemanticGroup.SLAB,
            SemanticGroup.WALL_MAIN to SemanticGroup.TERRACE_SURFACE,
            SemanticGroup.WALL_MAIN to SemanticGroup.BALCONY_SLAB,
            SemanticGroup.WALL_MAIN to SemanticGroup.WALL_INTERIOR,
            SemanticGroup.WALL_MAIN to SemanticGroup.WALL_SECONDARY,
            SemanticGroup.WALL_MAIN to SemanticGroup.FACADE_FRAME,
            SemanticGroup.WALL_MAIN to SemanticGroup.WALL_CLADDING,
            SemanticGroup.WALL_SECONDARY to SemanticGroup.WALL_CLADDING,
            SemanticGroup.WALL_CLADDING to SemanticGroup.TERRACE_SURFACE,
            SemanticGroup.SLAB to SemanticGroup.TERRACE_SURFACE,
            SemanticGroup.SLAB to SemanticGroup.BALCONY_SLAB,
            SemanticGroup.ROOF_MAIN to SemanticGroup.ROOF_TRIM,
            SemanticGroup.ROOF_MAIN to SemanticGroup.FLAT_ROOF,
            SemanticGroup.WINDOW_FRAME to SemanticGroup.WINDOW_GLASS,
        )
        for ((a, b) in pairs) {
            val gap = kotlin.math.abs(lum(a) - lum(b))
            assertTrue("$a and $b differ by only $gap in luminance", gap >= 0.06f)
        }
        // And what is drawn is that ladder: the style does not flatten it.
        val wall = RenderStyle.ARCHITECTURAL.appearanceOf(GeometryPart.WALL, null)
        val trim = RenderStyle.ARCHITECTURAL.appearanceOf(GeometryPart.ROOF_TRIM, null)
        assertTrue(kotlin.math.abs(luminance(wall) - luminance(trim)) >= 0.06f)
    }

    @Test
    fun `Architectural ignores the model's own colours and assigns none per object`() {
        val brick = com.buildplan.preview.scene.BundleMaterial(id = "m-brick", name = "Brick", color = "#b45a3c")
        assertEquals(
            RenderStyle.ARCHITECTURAL.appearanceOf(GeometryPart.WALL, null),
            RenderStyle.ARCHITECTURAL.appearanceOf(GeometryPart.WALL, brick),
        )
    }

    @Test
    fun `Architectural leaves ambient occlusion off, Construction and Clay keep theirs`() {
        assertFalse(RenderStyle.ARCHITECTURAL.ambientOcclusion)
        assertTrue(RenderStyle.CONSTRUCTION.ambientOcclusion)
        assertTrue(RenderStyle.CLAY.ambientOcclusion)
    }

    @Test
    fun `Construction and Clay give the terrace and the roof trim their own entries`() {
        val grey = RenderStyle.CONSTRUCTION.appearanceOf(GeometryPart.OTHER, null)
        for (p in listOf(GeometryPart.TERRACE, GeometryPart.ROOF_TRIM)) {
            val c = RenderStyle.CONSTRUCTION.appearanceOf(p, null)
            assertNotEquals("$p falls back to the default grey", Triple(grey.red, grey.green, grey.blue), Triple(c.red, c.green, c.blue))
            assertFalse(c.isTranslucent)
            assertEquals(RenderStyle.CLAY.appearanceOf(GeometryPart.WALL, null), RenderStyle.CLAY.appearanceOf(p, null))
        }
        val colours = listOf(GeometryPart.WALL, GeometryPart.SLAB, GeometryPart.ROOF, GeometryPart.TERRACE, GeometryPart.ROOF_TRIM, GeometryPart.BALCONY)
            .map { RenderStyle.CONSTRUCTION.appearanceOf(it, null) }
            .map { Triple(it.red, it.green, it.blue) }
            .toSet()
        assertEquals(6, colours.size)
    }

    @Test
    fun `the style menu offers all three`() {
        assertEquals(listOf("Construction", "Clay", "Architectural"), RenderStyle.entries.map { it.label })
        assertEquals("Semantic groups, minimal palette", RenderStyle.ARCHITECTURAL.description)
        assertEquals(RenderStyle.CONSTRUCTION, com.buildplan.preview.scene.ViewerState().style)
    }
}
