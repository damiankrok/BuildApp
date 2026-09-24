package com.buildplan.preview

import com.buildplan.preview.scene.GeometryPart
import com.buildplan.preview.scene.ModelFrame
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.SceneObject
import com.buildplan.preview.scene.Visibility
import com.buildplan.preview.scene.VisibilityMode
import com.buildplan.preview.scene.ViewerState
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.junit.runner.RunWith
import org.junit.runners.Parameterized

/**
 * The reconstructed candidate has to reach the GPU as a building, not as a
 * roof floating over nothing.
 *
 * On a real phone the candidate loaded with every object and every triangle
 * accounted for in the inspector, and drew one object: its roof. The cause was
 * not geometry. The viewport's frame callback captured the scene that was open
 * when it was installed, so after switching models it kept resolving viewer
 * state against the PREVIOUS building. Visibility answers with object ids, and
 * ids only mean something inside their own model: of this candidate's objects
 * only `roof-main` happens to be named the same in the reference model, so
 * exactly one entity was ever added to the Filament scene — and no layer mode
 * could reveal the rest, because every mode asked the wrong building.
 *
 * These tests run against the committed bundles the APK ships, so they describe
 * the real candidates rather than a fixture that could agree with a bug. They
 * run once per sealed candidate: the first solver's and analyzer v2's are
 * different buildings, and each has to reach the GPU whole.
 */
@RunWith(Parameterized::class)
class AutoCandidateRenderingTest(private val key: String) {

    companion object {
        @JvmStatic
        @Parameterized.Parameters(name = "{0}")
        fun candidates(): List<String> = TestScenes.candidateKeys
    }

    private val auto: ModelScene get() = TestScenes.candidate(key)

    /**
     * What the renderer actually puts in the Filament scene for a mode: the
     * visible ids, restricted to the objects that carry geometry and therefore
     * have an entity. This is the whole trace from viewer state to GPU, minus
     * Filament itself.
     */
    private fun entitiesInScene(scene: ModelScene, mode: VisibilityMode): List<SceneObject> {
        val visible = Visibility.visibleObjectIds(scene, mode) intersect scene.renderableObjectIds
        return scene.objects.filter { it.id in visible }
    }

    private fun countOfKind(scene: ModelScene, mode: VisibilityMode, kind: String): Int =
        entitiesInScene(scene, mode).count { it.kind == kind }

    private fun wallsOnLevel(scene: ModelScene, mode: VisibilityMode, levelId: String?): Int =
        entitiesInScene(scene, mode).count { it.kind == "wall" && it.levelId == levelId }

    // -----------------------------------------------------------------------
    // Every layer mode shows the building, not only its roof
    // -----------------------------------------------------------------------

    @Test
    fun `All shows the candidate's walls and its roof`() {
        val walls = countOfKind(auto, VisibilityMode.ALL, "wall")
        val roofs = countOfKind(auto, VisibilityMode.ALL, "roof")
        assertTrue("All must render the candidate's walls, not only its roof", walls > 0)
        assertTrue("All must render the candidate's roof", roofs > 0)
    }

    @Test
    fun `Roof off keeps the walls and drops the roof`() {
        val walls = countOfKind(auto, VisibilityMode.ROOF_OFF, "wall")
        assertTrue("Roof off must leave the walls standing", walls > 0)
        for (kind in Visibility.ROOF_KINDS) {
            assertEquals("Roof off must remove $kind", 0, countOfKind(auto, VisibilityMode.ROOF_OFF, kind))
        }
    }

    @Test
    fun `Ground shows the walls of the lowest storey`() {
        val ground = auto.groundLevelId
        assertTrue("the candidate must declare a lowest storey", ground != null)
        assertTrue(
            "Ground must render the walls that stand on $ground",
            wallsOnLevel(auto, VisibilityMode.GROUND_ONLY, ground) > 0,
        )
    }

    @Test
    fun `Attic shows the walls of the storeys above the lowest`() {
        val upper = auto.levels.filter { it.id != auto.groundLevelId }
        assertTrue("the candidate must declare a storey above the lowest", upper.isNotEmpty())
        val walls = entitiesInScene(auto, VisibilityMode.UPPER_ONLY)
            .count { it.kind == "wall" && upper.any { l -> l.id == it.levelId } }
        assertTrue("Attic must render the walls of the upper storeys", walls > 0)
    }

    @Test
    fun `Cutaway shows meaningful non-roof building geometry`() {
        val shown = entitiesInScene(auto, VisibilityMode.CUTAWAY)
        val nonRoof = shown.filter { it.kind !in Visibility.ROOF_KINDS }
        assertTrue("Cutaway must render the walls", nonRoof.any { it.kind == "wall" })
        // A section through a building is not one object: it is most of the
        // model below the roof, so assert the bulk of it rather than a token.
        val triangles = nonRoof.sumOf { it.triangleCount }
        val roofTriangles = auto.objects.filter { it.kind in Visibility.ROOF_KINDS }.sumOf { it.triangleCount }
        assertTrue(
            "Cutaway rendered $triangles triangles of non-roof geometry, which is not a building",
            triangles > roofTriangles,
        )
    }

    @Test
    fun `no layer mode is left showing only the roof`() {
        for (mode in VisibilityMode.entries) {
            val shown = entitiesInScene(auto, mode)
            val nonRoof = shown.filter { it.kind !in Visibility.ROOF_KINDS }
            assertTrue("$mode put ${shown.size} entities in the scene, none of them building", nonRoof.isNotEmpty())
        }
    }

    // -----------------------------------------------------------------------
    // The trace: bundle -> SceneObject -> entity
    // -----------------------------------------------------------------------

    @Test
    fun `every object the bundle carries geometry for becomes an entity`() {
        val bundle = auto.bundle
        val withGeometry = bundle.scene.meshes.filter { it.triangleCount > 0 }.map { it.objectId }.toSet()
        assertEquals(
            "every compiled object must have a renderable entity",
            withGeometry,
            auto.renderableObjectIds.toSet(),
        )
        for (o in auto.objects) {
            assertTrue("${o.id} decoded with no vertices", o.hasGeometry)
            assertEquals("${o.id} has no primitive to draw", o.positions.size / 3, o.parts.sumOf { it.count })
            assertFalse("${o.id} has empty bounds and would be culled", o.bounds.isEmpty)
        }
    }

    @Test
    fun `wall triangle coordinates survive the bundle to Kotlin parsing`() {
        val walls = auto.objects.filter { it.kind == "wall" }
        assertTrue("the candidate must carry walls", walls.isNotEmpty())

        for (wall in walls) {
            val meshes = auto.bundle.scene.meshes.filter { it.objectId == wall.id }
            assertEquals("${wall.id} lost meshes on the way in", meshes.size, wall.parts.size)
            assertEquals("${wall.id} lost triangles", meshes.sumOf { it.triangleCount }, wall.triangleCount)

            // Coordinate for coordinate, through the one documented conversion.
            var cursor = 0
            for (mesh in meshes) {
                val expected = ModelFrame.renderPositions(mesh.positions)
                for (i in expected.indices) {
                    assertEquals("${wall.id} coordinate $i", expected[i], wall.positions[cursor + i], 0f)
                }
                cursor += expected.size
            }
            assertEquals("${wall.id} has stray vertices", cursor, wall.positions.size)

            // Every wall is a solid with area: nothing degenerate, nothing
            // collapsed onto a plane the camera can never see.
            assertTrue("${wall.id} is degenerate", wall.bounds.size.x > 0.0 && wall.bounds.size.y > 0.0 && wall.bounds.size.z > 0.0)
            // Wound outward, which is what back-face culling depends on.
            assertTrue(
                "${wall.id} is wound inward and would be culled away",
                ModelFrame.signedVolume6(wall.positions) > 0.0,
            )
            for (part in wall.parts) assertEquals(GeometryPart.WALL, part.part)
        }
    }

    @Test
    fun `decoded bounds agree with the bounds the bundle declares`() {
        for (o in auto.objects) {
            val declared = ModelFrame.bounds(o.metadata?.bounds ?: continue)
            if (declared.isEmpty) continue
            assertEquals("${o.id} min x", declared.min.x, o.bounds.min.x, 1e-4)
            assertEquals("${o.id} min y", declared.min.y, o.bounds.min.y, 1e-4)
            assertEquals("${o.id} min z", declared.min.z, o.bounds.min.z, 1e-4)
            assertEquals("${o.id} max x", declared.max.x, o.bounds.max.x, 1e-4)
            assertEquals("${o.id} max y", declared.max.y, o.bounds.max.y, 1e-4)
            assertEquals("${o.id} max z", declared.max.z, o.bounds.max.z, 1e-4)
        }
    }

    // -----------------------------------------------------------------------
    // Picking
    // -----------------------------------------------------------------------

    @Test
    fun `hidden entities are not pickable`() {
        for (mode in VisibilityMode.entries) {
            val state = ViewerState(visibility = mode)
            val shown = Visibility.visibleObjectIds(auto, mode)
            for (o in auto.objects) {
                val pickable = state.isPickable(auto, o.id)
                assertEquals("${o.id} pickability disagrees with $mode", o.id in shown, pickable)
            }
            // Concretely: with the roof off, the roof cannot be tapped.
            if (mode == VisibilityMode.ROOF_OFF) {
                for (o in auto.objects.filter { it.kind in Visibility.ROOF_KINDS }) {
                    assertFalse("${o.id} is still pickable with the roof off", state.isPickable(auto, o.id))
                }
            }
        }
    }

    // -----------------------------------------------------------------------
    // The regression itself: ids belong to the model they came from
    // -----------------------------------------------------------------------

    @Test
    fun `one scene's visible ids are not a substitute for another's`() {
        // This is the shape of the failure the owner saw. It is stated as a
        // property of the shipped scenes so that the renderer is never allowed
        // to rely on the opposite: applying one building's visible set to
        // another building's entities shows almost nothing, and what little it
        // does show is a coincidence of naming rather than a building.
        val ownWalls = entitiesInScene(auto, VisibilityMode.ALL).count { it.kind == "wall" }
        assertTrue(ownWalls > 0)

        for (other in TestScenes.all) {
            if (other.key == auto.key) continue
            val foreign = Visibility.visibleObjectIds(other, VisibilityMode.ALL) intersect auto.renderableObjectIds
            val foreignWalls = auto.objects.count { it.id in foreign && it.kind == "wall" }
            assertEquals(
                "a viewer state resolved against \"${other.key}\" must not be mistaken for a valid one here",
                0,
                foreignWalls,
            )
            assertNotEquals(
                "\"${other.key}\" and \"${auto.key}\" must not be interchangeable",
                auto.renderableObjectIds,
                other.renderableObjectIds,
            )
        }
    }

    @Test
    fun `every shipped scene renders its own building under every mode`() {
        // Reference and Demo behave exactly as they did; the candidate now
        // joins them instead of being the one model that draws a bare roof.
        for (scene in TestScenes.all) {
            for (mode in VisibilityMode.entries) {
                val shown = entitiesInScene(scene, mode)
                assertTrue("${scene.key} renders nothing under $mode", shown.isNotEmpty())
                assertTrue(
                    "${scene.key} renders no building under $mode",
                    shown.any { it.kind !in Visibility.ROOF_KINDS },
                )
                assertTrue(
                    "${scene.key} would be asked to show entities it never uploaded",
                    shown.map { it.id }.all { it in scene.renderableObjectIds },
                )
            }
            assertTrue("${scene.key} must render walls", countOfKind(scene, VisibilityMode.ALL, "wall") > 0)
        }
    }
}
