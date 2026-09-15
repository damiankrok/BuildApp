package com.buildplan.preview

import com.buildplan.preview.scene.BundleParser
import com.buildplan.preview.scene.BundleResult
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Loading a scene asset, and refusing a broken one.
 *
 * A viewer that renders half a corrupt building is worse than one that says it
 * cannot read the file, so every failure mode here must produce a message
 * rather than geometry.
 */
class BundleParserTest {

    @Test
    fun `the shipped bundles parse`() {
        assertTrue("the build must ship at least one scene", TestScenes.index.isNotEmpty())
        for (entry in TestScenes.index) {
            val result = BundleParser.parse(TestScenes.text(entry.asset))
            assertTrue("${entry.asset}: $result", result is BundleResult.Ok)
        }
    }

    @Test
    fun `the index agrees with the bundles it lists`() {
        for (entry in TestScenes.index) {
            val bundle = TestScenes.bundle(entry.key)
            assertEquals(entry.contentHash, bundle.contentHash)
            assertEquals(entry.modelId, bundle.generatedFrom.modelId)
            assertEquals(entry.triangleCount, bundle.scene.stats.triangleCount)
            assertEquals(entry.meshCount, bundle.scene.stats.meshCount)
            assertEquals(entry.objectCount, bundle.scene.stats.objectCount)
        }
    }

    @Test
    fun `text that is not JSON is reported`() {
        val result = BundleParser.parse("{ not json at all")
        assertTrue(result is BundleResult.Failure)
        assertTrue((result as BundleResult.Failure).message.contains("not a readable bundle"))
    }

    @Test
    fun `a truncated asset is reported`() {
        val text = TestScenes.text("marcowki.scene.json")
        val result = BundleParser.parse(text.substring(0, text.length / 2))
        assertTrue(result is BundleResult.Failure)
    }

    @Test
    fun `a foreign schema is refused`() {
        val text = TestScenes.text("demo.scene.json").replace(
            "\"schema\":\"buildapp.mobile-scene-bundle\"",
            "\"schema\":\"something.else\"",
        )
        val result = BundleParser.parse(text)
        assertTrue(result is BundleResult.Failure)
        assertTrue((result as BundleResult.Failure).message.contains("unknown scene schema"))
    }

    @Test
    fun `a future bundle version is refused rather than guessed at`() {
        val text = TestScenes.text("demo.scene.json").replace("\"schemaVersion\":\"1.0.0\"", "\"schemaVersion\":\"2.0.0\"")
        val result = BundleParser.parse(text)
        assertTrue(result is BundleResult.Failure)
        assertTrue((result as BundleResult.Failure).message.contains("not supported"))
    }

    @Test
    fun `mesh data that contradicts its own counts is refused`() {
        val bundle = TestScenes.bundle("demo")
        val broken = com.buildplan.preview.scene.SceneBundle(
            schema = bundle.schema,
            schemaVersion = bundle.schemaVersion,
            generatedFrom = bundle.generatedFrom,
            scene = com.buildplan.preview.scene.BundleScene(
                modelId = bundle.scene.modelId,
                // Same mesh list, but one mesh now claims a triangle it has no coordinates for.
                meshes = bundle.scene.meshes.mapIndexed { i, m ->
                    if (i != 0) m else com.buildplan.preview.scene.BundleMesh(
                        objectId = m.objectId,
                        objectKind = m.objectKind,
                        part = m.part,
                        solidId = m.solidId,
                        structural = m.structural,
                        triangleCount = m.triangleCount + 1,
                        positions = m.positions,
                    )
                },
                diagnostics = bundle.scene.diagnostics,
                bounds = bundle.scene.bounds,
                stats = bundle.scene.stats,
            ),
            levels = bundle.levels,
            objects = bundle.objects,
            materials = bundle.materials,
            contentHash = bundle.contentHash,
        )
        val result = BundleParser.validate(broken)
        assertTrue(result is BundleResult.Failure)
        assertTrue((result as BundleResult.Failure).message.contains("coordinates"))
    }

    @Test
    fun `a non-finite coordinate is refused`() {
        val text = TestScenes.text("demo.scene.json")
        // Break exactly one number in the first positions array.
        val marker = "\"positions\":["
        val at = text.indexOf(marker) + marker.length
        val end = text.indexOf(',', at)
        val damaged = text.substring(0, at) + "1e400" + text.substring(end)
        val result = BundleParser.parse(damaged)
        assertTrue("a coordinate of infinity must not be accepted", result is BundleResult.Failure)
    }
}
