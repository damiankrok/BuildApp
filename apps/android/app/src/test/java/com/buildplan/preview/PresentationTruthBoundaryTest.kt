package com.buildplan.preview

import com.buildplan.preview.presentation.PresentationMode
import com.buildplan.preview.presentation.ScenePresentation
import com.buildplan.preview.presentation.StudyPalette
import com.buildplan.preview.render.RenderStyle
import com.buildplan.preview.scene.BundleParser
import com.buildplan.preview.scene.BundleResult
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.SceneBundle
import com.buildplan.preview.scene.ViewerState
import com.buildplan.preview.scene.VisibilityMode
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File
import java.security.MessageDigest

/**
 * The truth boundary: presentation is derived from the bundle and never flows
 * back into it.
 *
 * The CanonicalBuildingModel lives on the TypeScript side; the phone holds its
 * compiled, content-hashed derivative. These tests hold that derivative — the
 * asset bytes, the parsed bundle, and the scene the renderer uploads — to be
 * identical before and after every presentation has been derived and every
 * mode applied, and hold the presentation to be a function of that input
 * alone.
 */
class PresentationTruthBoundaryTest {

    private val json = Json { encodeDefaults = true }

    private fun sha256(bytes: ByteArray): String = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

    private fun encode(bundle: SceneBundle): String = json.encodeToString(SceneBundle.serializer(), bundle)

    private data class Snapshot(val bundleJson: String, val positions: List<List<Float>>, val tangents: List<List<Float>>, val bounds: String)

    private fun snapshot(scene: ModelScene) = Snapshot(
        encode(scene.bundle),
        scene.objects.map { it.positions.toList() },
        scene.objects.map { it.tangents.toList() },
        scene.bounds.toString(),
    )

    @Test
    fun `deriving and applying every presentation changes neither the asset, the bundle nor the uploaded scene`() {
        for (entry in TestScenes.index) {
            val file = File(assetRoot(), entry.asset)
            val bytesBefore = sha256(file.readBytes())
            val bundle = (BundleParser.parse(file.readText()) as BundleResult.Ok).bundle
            val scene = ModelScene.from(bundle, entry.key, entry.title, entry.subtitle)
            val before = snapshot(scene)

            val presentation = ScenePresentation.of(scene)
            var state = ViewerState()
            for (mode in PresentationMode.entries) for (style in RenderStyle.entries) for (layer in VisibilityMode.entries) {
                state = state.withPresentation(mode).withStyle(style).withVisibility(scene, layer)
                val visible = state.visibleObjectIds(scene)
                presentation.edges.drawn(visible, mode.edgeTiers, state.selectedObjectId)
                for (o in scene.objects) for (p in o.parts) {
                    if (mode.usesStyle) style.appearanceOf(p, p.materialId?.let { scene.materials[it] }, scene.styling) else StudyPalette.appearanceOf(mode, p)
                }
            }

            val after = snapshot(scene)
            assertEquals("${entry.key}: the bundle changed", before.bundleJson, after.bundleJson)
            assertEquals("${entry.key}: uploaded positions changed", before.positions, after.positions)
            assertEquals("${entry.key}: uploaded tangents changed", before.tangents, after.tangents)
            assertEquals(before.bounds, after.bounds)
            assertEquals("${entry.key}: the asset changed on disk", bytesBefore, sha256(file.readBytes()))
            assertEquals("${entry.key}: the content hash moved", entry.contentHash, scene.bundle.contentHash)
        }
    }

    @Test
    fun `the presentation is a function of the bundle alone`() {
        for (entry in TestScenes.index) {
            val a = ScenePresentation.of(TestScenes.scene(entry.key))
            val b = ScenePresentation.of(TestScenes.scene(entry.key))
            assertEquals(a.edges.counts, b.edges.counts)
            assertEquals(a.edges.groups.map { it.positions.toList() }, b.edges.groups.map { it.positions.toList() })
            assertEquals(a.roofCovers.map { it.positions.toList() }, b.roofCovers.map { it.positions.toList() })
            assertEquals(a.roofCovers.map { it.indices.toList() }, b.roofCovers.map { it.indices.toList() })
        }
    }

    @Test
    fun `a mode is a choice among overlays derived once, never a different derivation`() {
        // The overlays are built without knowing any mode: one build serves
        // MODEL, CLAY and LINE, so no mode can produce a different building.
        val scene = TestScenes.autoCandidateV3
        val presentation = ScenePresentation.of(scene)
        val all = ViewerState().visibleObjectIds(scene)
        val clay = presentation.edges.segmentsDrawn(all, PresentationMode.CLAY.edgeTiers, null)
        val line = presentation.edges.segmentsDrawn(all, PresentationMode.LINE.edgeTiers, null)
        assertTrue("CLAY inks a subset of what LINE inks", line.containsAll(clay))
        assertTrue(presentation.edges.segmentsDrawn(all, PresentationMode.MODEL.edgeTiers, null).isEmpty())
    }

    @Test
    fun `every overlay answers with a semantic object of the scene it was derived from`() {
        for (scene in TestScenes.all) {
            val presentation = ScenePresentation.of(scene)
            val ids = scene.renderableObjectIds
            assertTrue(presentation.edges.groups.all { it.objectId in ids && it.partners.all { p -> p in ids } })
            assertTrue(presentation.roofCovers.all { it.objectId in ids })
        }
    }

    @Test
    fun `the bundle schema carries no presentation`() {
        // Presentation is not transported: the bundle format the exporter
        // writes and this app reads has no field for edges, tiles or modes.
        val fields = SceneBundle.serializer().descriptor.let { d -> (0 until d.elementsCount).map { d.getElementName(it) } }
        assertEquals(listOf("schema", "schemaVersion", "generatedFrom", "scene", "levels", "objects", "materials", "styling", "contentHash"), fields)
    }

    private fun assetRoot(): File = sequenceOf(
        File("src/main/assets/scenes"),
        File("app/src/main/assets/scenes"),
        File("apps/android/app/src/main/assets/scenes"),
    ).first { it.isDirectory }
}
