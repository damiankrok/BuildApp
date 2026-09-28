package com.buildplan.preview

import com.buildplan.preview.presentation.PresentationMode
import com.buildplan.preview.presentation.ScenePresentation
import com.buildplan.preview.progress.ConstructionGroup
import com.buildplan.preview.progress.ConstructionProgressState
import com.buildplan.preview.progress.ConstructionStageKey
import com.buildplan.preview.progress.ConstructionView
import com.buildplan.preview.progress.HouseId
import com.buildplan.preview.progress.ProgressEdit
import com.buildplan.preview.progress.StageProjection
import com.buildplan.preview.scene.BundleBounds
import com.buildplan.preview.scene.BundleLevel
import com.buildplan.preview.scene.BundleMesh
import com.buildplan.preview.scene.BundleOrigin
import com.buildplan.preview.scene.BundleScene
import com.buildplan.preview.scene.BundleVec3
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.SceneBundle
import com.buildplan.preview.scene.ViewerState
import com.buildplan.preview.scene.VisibilityMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The construction time machine's semantic side (INTEGRATION-003C): which
 * objects stand at which stage, and how that composes with the viewer's own
 * layers, isolation, selection and presentation — without touching the model.
 */
class StageProjectionTest {
    private val house = SyntheticStageHouse.scene()
    private val projection = StageProjection(house)

    private fun at(stage: ConstructionStageKey): Set<String> = checkNotNull(projection.visibleIds(ConstructionView.AtStage(stage)))

    // -- classification ------------------------------------------------------

    @Test
    fun everyObjectOfTheSyntheticHouseLandsInItsGroup() {
        val expected = mapOf(
            "slab-base" to ConstructionGroup.BASE_SLAB,
            "slab-upper" to ConstructionGroup.FLOORS_AND_STAIRS,
            "slab-head" to ConstructionGroup.FLOORS_AND_STAIRS,
            "wall-front" to ConstructionGroup.STRUCTURE,
            "wall-side" to ConstructionGroup.STRUCTURE,
            "opening-front" to ConstructionGroup.STRUCTURE,
            "column" to ConstructionGroup.STRUCTURE,
            "room-living" to ConstructionGroup.SPACES,
            "stair" to ConstructionGroup.FLOORS_AND_STAIRS,
            "balcony" to ConstructionGroup.FLOORS_AND_STAIRS,
            "roof-main" to ConstructionGroup.ROOF,
            "chimney" to ConstructionGroup.ROOF,
            "window-front" to ConstructionGroup.JOINERY,
            "door-front" to ConstructionGroup.JOINERY,
            "rooflight" to ConstructionGroup.JOINERY,
            "cladding" to ConstructionGroup.FACADE,
            "facade-frame" to ConstructionGroup.FACADE,
            "railing" to ConstructionGroup.FACADE,
            "terrace" to ConstructionGroup.EXTERIOR_WORKS,
            "terrace-as-balcony" to ConstructionGroup.EXTERIOR_WORKS,
            "pergola-beam" to ConstructionGroup.EXTERIOR_WORKS,
            "mystery-assembly" to ConstructionGroup.UNMAPPED,
            "mixed-member" to ConstructionGroup.UNMAPPED,
            "gazebo" to ConstructionGroup.UNMAPPED,
        )
        assertEquals(expected, projection.groups)
    }

    // -- the required visible differences --------------------------------------

    @Test
    fun beforeTheFoundationsNothingStands() {
        assertTrue(at(ConstructionStageKey.SITE_PREPARATION).isEmpty())
        assertEquals(setOf("slab-base"), at(ConstructionStageKey.FOUNDATIONS))
    }

    @Test
    fun beforeTheWallsThereAreNoWallsAndAtTheWallsTheShellStands() {
        val before = at(ConstructionStageKey.FOUNDATIONS)
        val walls = at(ConstructionStageKey.WALLS)
        assertTrue(listOf("wall-front", "wall-side", "opening-front", "column").none { it in before })
        assertTrue(listOf("wall-front", "wall-side", "opening-front", "column", "room-living").all { it in walls })
    }

    @Test
    fun beforeTheRoofThereIsNoRoofAndAtTheRoofItAppears() {
        val before = at(ConstructionStageKey.FLOOR_SLAB)
        val roof = at(ConstructionStageKey.ROOF)
        assertFalse("roof-main" in before)
        assertFalse("chimney" in before)
        assertTrue("slab-upper" in before && "stair" in before)
        assertTrue("roof-main" in roof && "chimney" in roof)
    }

    @Test
    fun beforeTheJoineryThereAreNoWindowsDoorsOrGlazingAndAtTheJoineryTheyAppear() {
        val before = at(ConstructionStageKey.ROOF)
        val joinery = at(ConstructionStageKey.JOINERY)
        val openings = listOf("window-front", "door-front", "rooflight")
        assertTrue(openings.none { it in before })
        assertTrue(openings.all { it in joinery })
    }

    @Test
    fun theTargetShowsEverythingIncludingWhatNoRulePlaces() {
        assertNull(projection.visibleIds(ConstructionView.Target))
        val lastStage = at(ConstructionStageKey.GARDEN)
        assertEquals(house.objects.map { it.id }.toSet() - projection.unmapped, lastStage)
    }

    @Test
    fun stagesOnlyEverAdd() {
        var previous = emptySet<String>()
        for (stage in ConstructionStageKey.entries) {
            val now = at(stage)
            assertTrue("$stage removes something", now.containsAll(previous))
            previous = now
        }
    }

    @Test
    fun stagesWithoutGeometrySaySo() {
        val none = listOf(
            ConstructionStageKey.PLOT_PURCHASE, ConstructionStageKey.DESIGN, ConstructionStageKey.PERMITS,
            ConstructionStageKey.SITE_PREPARATION, ConstructionStageKey.ELECTRICAL, ConstructionStageKey.PLUMBING,
            ConstructionStageKey.HEATING, ConstructionStageKey.PLASTERING, ConstructionStageKey.SCREED, ConstructionStageKey.FINISHING,
        )
        for (stage in none) assertFalse("$stage has no geometry of its own", projection.hasGeometry(stage))
        for (stage in ConstructionStageKey.entries - none.toSet()) assertTrue("$stage has geometry in this house", projection.hasGeometry(stage))
    }

    // -- the unknown is never placed by convenience --------------------------

    @Test
    fun anUnknownElementIsNotAssignedToAnyStage() {
        assertEquals(setOf("mystery-assembly", "mixed-member", "gazebo"), projection.unmapped)
        for (stage in ConstructionStageKey.entries) assertTrue(projection.unmapped.none { it in at(stage) })
        val done = ConstructionStageKey.entries.fold(ConstructionProgressState.starter(HouseId("h"), 0L)) { s, key ->
            (s.markDone("stage-${key.key}", 0L) as ProgressEdit.Applied).state
        }
        assertTrue(projection.unmapped.none { it in checkNotNull(projection.visibleIds(ConstructionView.Actual(done))) })
    }

    @Test
    fun theUnknownFeatureFixtureKeepsItsAssemblyUnplaced() {
        val fixture = TestScenes.fixture("unknown-feature")
        val p = StageProjection(fixture)
        val assemblies = fixture.objects.filter { it.kind == "assembly" }.map { it.id }.toSet()
        assertTrue(assemblies.isNotEmpty())
        assertTrue(p.unmapped.containsAll(assemblies))
    }

    // -- actual progress is what the owner said --------------------------------

    @Test
    fun theActualViewShowsExactlyTheStagesStartedOrDoneWhateverTheOrder() {
        var s = ConstructionProgressState.starter(HouseId("h"), 0L)
        s = (s.markDone("stage-walls", 1L) as ProgressEdit.Applied).state
        s = (s.startStage("stage-roof", 0.4, 2L) as ProgressEdit.Applied).state
        val visible = checkNotNull(projection.visibleIds(ConstructionView.Actual(s)))
        assertTrue("wall-front" in visible && "roof-main" in visible)
        // Foundations were never marked: the base slab is not claimed as built.
        assertFalse("slab-base" in visible)
        assertFalse("window-front" in visible)
    }

    @Test
    fun unsetProgressShowsNothingBuilt() {
        assertTrue(checkNotNull(projection.visibleIds(ConstructionView.Actual(ConstructionProgressState.starter(HouseId("h"), 0L)))).isEmpty())
    }

    // -- composition with the viewer -------------------------------------------

    @Test
    fun theStageComposesWithRoofOff() {
        val v = ViewerState().withVisibility(house, VisibilityMode.ROOF_OFF).withConstruction(at(ConstructionStageKey.JOINERY))
        val visible = v.visibleObjectIds(house)
        assertFalse("roof-main" in visible)
        assertTrue("wall-front" in visible && "window-front" in visible)
    }

    @Test
    fun theStageComposesWithStoreys() {
        val v = ViewerState().withVisibility(house, VisibilityMode.GROUND_ONLY).withConstruction(at(ConstructionStageKey.FLOOR_SLAB))
        val visible = v.visibleObjectIds(house)
        assertTrue(visible.all { house.objectById(it)?.levelId == house.groundLevelId })
        assertTrue("wall-front" in visible)
        assertFalse("slab-upper" in visible)
        assertFalse("window-front" in visible)
    }

    @Test
    fun isolatingSomethingNotYetBuiltShowsNothing() {
        val window = ViewerState().select("window-front").isolateSelected(house)
        assertTrue(window.withConstruction(at(ConstructionStageKey.ROOF)).visibleObjectIds(house).isEmpty())
        val wall = ViewerState().select("wall-front").isolateSelected(house)
        assertEquals(setOf("wall-front"), wall.withConstruction(at(ConstructionStageKey.ROOF)).visibleObjectIds(house))
    }

    @Test
    fun theSelectionSurvivesAScrubButIsNeitherDrawnNorPickableWhileItsObjectDoesNotStand() {
        val selected = ViewerState().select("window-front")
        val back = selected.withConstruction(at(ConstructionStageKey.WALLS))
        assertEquals("window-front", back.selectedObjectId)
        assertFalse(back.isPickable(house, "window-front"))
        val forward = back.withConstruction(at(ConstructionStageKey.JOINERY))
        assertEquals("window-front", forward.selectedObjectId)
        assertTrue(forward.isPickable(house, "window-front"))
        assertTrue(back.withConstruction(null).isPickable(house, "window-front"))
    }

    @Test
    fun thePresentationModeNeverChangesWhatTheStageShows() {
        val base = ViewerState().withConstruction(at(ConstructionStageKey.ROOF))
        for (mode in PresentationMode.entries) assertEquals(base.visibleObjectIds(house), base.withPresentation(mode).visibleObjectIds(house))
    }

    @Test
    fun onARealHouseNoEdgeOfAnObjectThatDoesNotStandIsDrawn() {
        val scene = TestScenes.marcowki
        val edges = ScenePresentation.of(scene).edges
        val p = StageProjection(scene)
        for (stage in ConstructionStageKey.entries) {
            val visible = ViewerState().withConstruction(p.visibleIds(ConstructionView.AtStage(stage))).visibleObjectIds(scene)
            for (mode in PresentationMode.entries) {
                val drawn = edges.drawn(visible, mode.edgeTiers, null)
                for (i in drawn.merged) assertTrue("$stage/$mode: a merged batch draws a hidden member", edges.merged[i].members.all { it in visible })
                for (i in drawn.perObject) assertTrue("$stage/$mode: a hidden object's edges are drawn", edges.groups[i].objectId in visible)
            }
        }
    }

    // -- the model is only read ------------------------------------------------

    @Test
    fun projectingNeverChangesTheSceneOrItsGeometry() {
        val scene = SyntheticStageHouse.scene()
        val before = scene.objects.map { it.id to it.positions.contentHashCode() }
        val hash = scene.bundle.contentHash
        val p = StageProjection(scene)
        for (stage in ConstructionStageKey.entries) p.visibleIds(ConstructionView.AtStage(stage))
        p.visibleIds(ConstructionView.Target)
        assertEquals(before, scene.objects.map { it.id to it.positions.contentHashCode() })
        assertEquals(hash, scene.bundle.contentHash)
    }

    // -- every shipped house, by the same rules ------------------------------

    @Test
    fun everyShippedSceneProjectsByTheSameGenericRules() {
        for (scene in TestScenes.all + TestScenes.fixture("roof-dormer-gable") + TestScenes.fixture("exterior-pergola") + TestScenes.fixture("exterior-entrance-canopy")) {
            val p = StageProjection(scene)
            var previous = emptySet<String>()
            for (stage in ConstructionStageKey.entries) {
                val now = checkNotNull(p.visibleIds(ConstructionView.AtStage(stage)))
                assertTrue("${scene.key}: $stage removes something", now.containsAll(previous))
                previous = now
            }
            assertEquals("${scene.key}: the last stage + the unplaced = the whole model", scene.objects.map { it.id }.toSet(), previous + p.unmapped)
            if (scene.objects.any { it.kind == "wall" }) {
                val walls = p.introducedAt(ConstructionStageKey.WALLS)
                assertTrue("${scene.key}: walls first stand at WALLS", scene.objects.filter { it.kind == "wall" }.all { it.id in walls })
            }
            val roofs = scene.objects.filter { it.kind == "roof" || it.kind == "roofPlane" }.map { it.id }
            assertTrue("${scene.key}: roofs first stand at ROOF", roofs.all { it in p.introducedAt(ConstructionStageKey.ROOF) })
            val joinery = scene.objects.filter { it.kind == "window" || it.kind == "door" || it.kind == "rooflight" }.map { it.id }
            assertTrue("${scene.key}: joinery first stands at JOINERY", joinery.all { it in p.introducedAt(ConstructionStageKey.JOINERY) })
        }
    }
}

/**
 * A house that exists only here: one of every kind of thing the stage rules
 * read, a triangle each, plus three things no rule can place. Invented, and
 * says so; no real project's numbers.
 */
object SyntheticStageHouse {
    private fun mesh(objectId: String, kind: String, part: String, level: String?, y0: Double, y1: Double, group: String?) = BundleMesh(
        objectId = objectId,
        objectKind = kind,
        part = part,
        levelId = level,
        solidId = "solid-$objectId-$part",
        semanticGroup = group,
        triangleCount = 1,
        positions = doubleArrayOf(0.0, y0, 0.0, 1.0, y1, 0.0, 0.0, y1, 1.0),
    )

    fun scene(): ModelScene {
        val meshes = listOf(
            mesh("slab-base", "slab", "SLAB", "g", -0.3, 0.0, "SLAB"),
            mesh("slab-upper", "slab", "SLAB", "u", 2.75, 3.0, "SLAB"),
            mesh("slab-head", "slab", "SLAB", "g", 2.4, 3.05, "SLAB"),
            mesh("wall-front", "wall", "WALL", "g", 0.0, 3.0, "WALL_MAIN"),
            mesh("wall-side", "wall", "WALL", "g", 0.0, 3.0, "WALL_MAIN"),
            mesh("opening-front", "opening", "WALL_REVEAL", "g", 0.9, 2.1, "WALL_MAIN"),
            mesh("column", "linearSolid", "LINEAR_SOLID", "g", 0.0, 3.0, "STRUCTURAL_MEMBER"),
            mesh("room-living", "room", "ROOM_FLOOR", "g", 0.0, 0.01, "ROOM"),
            mesh("stair", "stair", "STAIR_STEP", "g", 0.0, 3.0, "STAIR"),
            mesh("balcony", "balcony", "BALCONY", "u", 2.8, 3.0, "BALCONY_SLAB"),
            mesh("roof-main", "roof", "ROOF", "u", 3.0, 6.0, "ROOF_MAIN"),
            mesh("chimney", "chimney", "CHIMNEY", "u", 3.0, 7.0, "CHIMNEY"),
            mesh("window-front", "window", "WINDOW_FRAME", "g", 0.9, 2.1, "WINDOW_FRAME"),
            mesh("window-front", "window", "WINDOW_GLASS", "g", 0.9, 2.1, "WINDOW_GLASS"),
            mesh("door-front", "door", "DOOR_FRAME", "g", 0.0, 2.1, "DOOR"),
            mesh("door-front", "door", "DOOR_LEAF", "g", 0.0, 2.1, "DOOR"),
            mesh("door-front", "door", "DOOR_GLASS", "g", 1.2, 2.0, "WINDOW_GLASS"),
            mesh("rooflight", "rooflight", "ROOFLIGHT_FRAME", "u", 4.0, 5.0, "ROOFLIGHT"),
            mesh("rooflight", "rooflight", "ROOFLIGHT_GLASS", "u", 4.0, 5.0, "WINDOW_GLASS"),
            mesh("cladding", "surfaceRegion", "SURFACE_REGION", "g", 0.0, 3.0, "WALL_CLADDING"),
            mesh("facade-frame", "linearSolid", "LINEAR_SOLID", "g", 0.0, 3.0, "FACADE_FRAME"),
            mesh("railing", "railing", "RAILING_POST", "u", 3.0, 4.0, "RAILING"),
            mesh("terrace", "terrace", "TERRACE", "g", -0.15, 0.0, "TERRACE_SURFACE"),
            mesh("terrace-as-balcony", "balcony", "BALCONY", "g", -0.3, 0.0, "TERRACE_SURFACE"),
            mesh("pergola-beam", "linearSolid", "LINEAR_SOLID", "g", 2.4, 2.6, "PERGOLA_MEMBER"),
            mesh("mystery-assembly", "assembly", "UNKNOWN_ASSEMBLY", "g", 0.0, 1.0, "UNKNOWN_ASSEMBLY"),
            mesh("mixed-member", "linearSolid", "LINEAR_SOLID", "g", 0.0, 1.0, "STRUCTURAL_MEMBER"),
            mesh("mixed-member", "linearSolid", "LINEAR_SOLID", "g", 0.0, 1.0, "PERGOLA_MEMBER"),
            mesh("gazebo", "gazebo", "OTHER", "g", 0.0, 2.0, null),
        )
        val bundle = SceneBundle(
            schema = "buildapp.mobile-scene-bundle",
            schemaVersion = "1.0.0",
            generatedFrom = BundleOrigin(modelId = "synthetic-stage-house", modelName = "Synthetic stage house"),
            scene = BundleScene(
                modelId = "synthetic-stage-house",
                meshes = meshes,
                bounds = BundleBounds(BundleVec3(0.0, -0.3, 0.0), BundleVec3(1.0, 7.0, 1.0)),
            ),
            levels = listOf(BundleLevel("g", "Ground", 0, 0.0, 3.0), BundleLevel("u", "Upper", 1, 3.0, 3.0)),
            contentHash = "synthetic",
        )
        return ModelScene.from(bundle, "synthetic-stage-house", "Synthetic stage house", "test only")
    }
}
