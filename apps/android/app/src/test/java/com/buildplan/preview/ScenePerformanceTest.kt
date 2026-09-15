package com.buildplan.preview

import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.Visibility
import com.buildplan.preview.scene.VisibilityMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The shape of the work, rather than its wall-clock time.
 *
 * A viewer gets slow by rebuilding geometry when it should be toggling
 * something, so these check the properties that keep the interaction cheap:
 * buffers are built once and are the size they should be, and a visibility
 * change is a set operation over object ids, not a rebuild.
 */
class ScenePerformanceTest {

    @Test
    fun `geometry is built once per model, not per mesh or per frame`() {
        val scene = TestScenes.marcowki
        // One buffer pair per semantic object — not one per compiled mesh.
        assertTrue(
            "grouping by semantic object must reduce the number of GPU buffers",
            scene.objects.size < scene.bundle.scene.stats.meshCount,
        )
        assertEquals(scene.bundle.scene.stats.objectCount, scene.objects.size)

        val floats = scene.objects.sumOf { it.positions.size + it.tangents.size }
        // 3 position + 4 tangent floats per vertex, 3 vertices per triangle.
        assertEquals(scene.triangleCount * 3 * 7, floats)
    }

    @Test
    fun `loading the same bundle twice gives identical buffers`() {
        val entry = TestScenes.index.first { it.key == "marcowki" }
        val a = ModelScene.from(TestScenes.bundle("marcowki"), entry.key, entry.title, entry.subtitle)
        val b = ModelScene.from(TestScenes.bundle("marcowki"), entry.key, entry.title, entry.subtitle)
        assertEquals(a.objects.map { it.id }, b.objects.map { it.id })
        for (i in a.objects.indices) {
            assertTrue("positions differ for ${a.objects[i].id}", a.objects[i].positions.contentEquals(b.objects[i].positions))
            assertTrue("tangents differ for ${a.objects[i].id}", a.objects[i].tangents.contentEquals(b.objects[i].tangents))
        }
    }

    @Test
    fun `a visibility change is a set of ids, so it can only toggle entities`() {
        val scene = TestScenes.marcowki
        val all = Visibility.visibleObjectIds(scene, VisibilityMode.ALL)
        val roofOff = Visibility.visibleObjectIds(scene, VisibilityMode.ROOF_OFF)
        // Everything the filter yields is an id that already exists on the GPU;
        // nothing new can be introduced by hiding something.
        assertTrue(all.containsAll(roofOff))
        for (id in all) assertTrue(scene.objectById(id) != null)
    }

    @Test
    fun `the reference model stays within a sensible size for a phone`() {
        val scene = TestScenes.marcowki
        val megabytes = scene.objects.sumOf { (it.positions.size + it.tangents.size) * 4L } / (1024.0 * 1024.0)
        assertTrue("vertex data is $megabytes MB, which is too much to upload on load", megabytes < 16.0)
        assertTrue(scene.triangleCount > 1000)
    }
}
