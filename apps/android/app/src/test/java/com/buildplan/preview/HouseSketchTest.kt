package com.buildplan.preview

import com.buildplan.preview.presentation.FeatureEdges
import com.buildplan.preview.scene.BundleLevel
import com.buildplan.preview.scene.BundleMesh
import com.buildplan.preview.scene.BundleOrigin
import com.buildplan.preview.scene.BundleScene
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.SceneBundle
import com.buildplan.preview.ui.HouseSketch
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * Dom's house drawing (INTEGRATION-003C): a derived line drawing, never a
 * second model — every line belongs to an object of the scene, what a solid
 * hides is not drawn, and the same scene always gives the same drawing.
 */
class HouseSketchTest {
    @Test
    fun anObjectInsideAClosedBoxHasNoVisibleLine() {
        val scene = boxes(
            "outer" to (doubleArrayOf(-5.0, 0.0, -5.0) to doubleArrayOf(5.0, 10.0, 5.0)),
            "inner" to (doubleArrayOf(-1.0, 4.0, -1.0) to doubleArrayOf(1.0, 6.0, 1.0)),
        )
        val sketch = HouseSketch.of(scene)
        assertTrue("the outer box is drawn", (sketch.segments["outer"]?.size ?: 0) > 0)
        assertFalse("nothing of the hidden box is drawn", sketch.segments.containsKey("inner"))
    }

    @Test
    fun aBoxSeenFromItsHomeAngleLosesItsThreeBackEdges() {
        val scene = boxes("only" to (doubleArrayOf(0.0, 0.0, 0.0) to doubleArrayOf(4.0, 4.0, 4.0)))
        val edges = FeatureEdges.of(scene)
        val drawn = length(HouseSketch.of(scene, edges).segments.getValue("only"))
        val wire = length(HouseSketch.of(scene, edges, removeHiddenLines = false).segments.getValue("only"))
        // Seen from above one corner, 9 of a cube's 12 edges face the eye and 3 are behind it.
        val share = drawn / wire
        assertTrue("about three quarters of the wireframe is drawn, not $share", share in 0.62..0.88)
    }

    @Test
    fun everyBundledHouseGivesADeterministicDrawingInsideItsFrame() {
        for (key in listOf("marcowki", "marcowki-auto-v3", "demo")) {
            val scene = TestScenes.scene(key)
            val a = HouseSketch.of(scene)
            val b = HouseSketch.of(scene)
            assertTrue("$key: lines drawn", a.segmentCount > 50)
            assertEquals("$key: same objects", a.segments.keys.toList(), b.segments.keys.toList())
            for ((id, s) in a.segments) {
                assertTrue("$key/$id: same floats", s.contentEquals(b.segments.getValue(id)))
                assertTrue("$key/$id: an object of the scene", scene.objectById(id) != null)
                for (i in s.indices step 2) {
                    assertTrue("$key/$id: x inside the frame", s[i] >= -0.01f && s[i] <= a.aspect + 0.01f)
                    assertTrue("$key/$id: y inside the frame", s[i + 1] >= -0.01f && s[i + 1] <= 1.01f)
                }
            }
        }
    }

    @Test
    fun hiddenLineRemovalDropsARealShareOfTheLinesOfARealHouse() {
        val scene = TestScenes.scene("marcowki")
        val edges = FeatureEdges.of(scene)
        val present = scene.objects.mapTo(HashSet()) { it.id }
        val all = edges.groups.filter { g -> g.partners.none { it in present } }.sumOf { it.segmentCount }
        val sketch = HouseSketch.of(scene, edges)
        val interior = scene.objects.filter { it.kind == "room" || it.kind == "stair" }.map { it.id }
        assertTrue("there are edges to draw ($all)", all > 100)
        assertTrue("interior objects are hidden inside the walls", interior.count { it in sketch.segments } < interior.size)
    }

    // -----------------------------------------------------------------------

    private fun length(s: FloatArray): Double = (s.indices step 4).sumOf { i ->
        Math.hypot((s[i + 2] - s[i]).toDouble(), (s[i + 3] - s[i + 1]).toDouble())
    }

    private fun boxes(vararg specs: Pair<String, Pair<DoubleArray, DoubleArray>>): ModelScene {
        val meshes = specs.map { (id, box) -> boxMesh(id, box.first, box.second) }
        val bundle = SceneBundle(
            schema = "buildapp.mobile-scene-bundle",
            generatedFrom = BundleOrigin(modelId = "sketch-test"),
            scene = BundleScene(modelId = "sketch-test", meshes = meshes),
            levels = listOf(BundleLevel(id = "g", label = "Parter", index = 0, elevation = 0.0, height = 3.0)),
        )
        return ModelScene.from(bundle, key = "sketch-test", title = "Test", subtitle = "")
    }

    /** A closed box as 12 outward triangles. */
    private fun boxMesh(id: String, lo: DoubleArray, hi: DoubleArray): BundleMesh {
        val (x0, y0, z0) = Triple(lo[0], lo[1], lo[2])
        val (x1, y1, z1) = Triple(hi[0], hi[1], hi[2])
        val v = arrayOf(
            doubleArrayOf(x0, y0, z0), doubleArrayOf(x1, y0, z0), doubleArrayOf(x1, y1, z0), doubleArrayOf(x0, y1, z0),
            doubleArrayOf(x0, y0, z1), doubleArrayOf(x1, y0, z1), doubleArrayOf(x1, y1, z1), doubleArrayOf(x0, y1, z1),
        )
        val faces = listOf(
            intArrayOf(0, 2, 1), intArrayOf(0, 3, 2), // z0
            intArrayOf(4, 5, 6), intArrayOf(4, 6, 7), // z1
            intArrayOf(0, 1, 5), intArrayOf(0, 5, 4), // y0
            intArrayOf(3, 7, 6), intArrayOf(3, 6, 2), // y1
            intArrayOf(0, 4, 7), intArrayOf(0, 7, 3), // x0
            intArrayOf(1, 2, 6), intArrayOf(1, 6, 5), // x1
        )
        val positions = DoubleArray(faces.size * 9)
        var k = 0
        for (f in faces) for (i in f) for (c in 0 until 3) positions[k++] = v[i][c]
        return BundleMesh(
            objectId = id,
            objectKind = "wall",
            part = "WALL",
            levelId = "g",
            solidId = "solid-$id",
            semanticGroup = "WALL_MAIN",
            triangleCount = faces.size,
            positions = positions,
        )
    }
}
