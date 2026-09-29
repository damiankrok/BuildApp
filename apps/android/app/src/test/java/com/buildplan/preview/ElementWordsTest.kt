package com.buildplan.preview

import com.buildplan.preview.scene.BundleFact
import com.buildplan.preview.scene.BundleParser
import com.buildplan.preview.scene.BundleResult
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.ui.ElementWords
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The inspector speaks the owner's Polish (INTEGRATION-003C, audit cycle 1,
 * C1-03): the export's engineering English never becomes a headline, a fact
 * label or a storey name, for the built-in house and for an analysed one.
 */
class ElementWordsTest {
    private val analysed: ModelScene by lazy {
        val text = requireNotNull(javaClass.classLoader?.getResourceAsStream("analyzer-contract/scene.json")) { "missing contract scene" }
            .use { it.readBytes().decodeToString() }
        val bundle = when (val r = BundleParser.parse(text)) {
            is BundleResult.Ok -> r.bundle
            is BundleResult.Failure -> error("contract scene did not parse: ${r.message}")
        }
        ModelScene.from(bundle, "contract", "Contract", "")
    }

    @Test
    fun everyElementOfBothHousesHasAPolishHeadline() {
        for (scene in listOf(TestScenes.marcowki, analysed)) {
            for (obj in scene.objects) {
                when (val t = ElementWords.title(obj)) {
                    is ElementWords.Title.Words -> assertNotEquals("${scene.key}/${obj.id} (${obj.kind}) has a noun", R.string.el_other, t.res)
                    is ElementWords.Title.SourceName -> {
                        assertEquals("only rooms keep the source's own name: ${obj.id}", "room", obj.kind)
                        assertTrue("never a fallback name: ${t.name}", !t.name.endsWith(obj.id))
                    }
                }
            }
        }
    }

    @Test
    fun anAnalysedHousesFallbackNamesAreNeverHeadlines() {
        val room = analysed.objects.first { it.kind == "room" }
        assertTrue("'${room.label}' is the exporter's fallback", ElementWords.isFallbackName(room))
        assertEquals(ElementWords.Title.Words(R.string.el_room), ElementWords.title(room))
        val builtInRoom = TestScenes.marcowki.objects.first { it.kind == "room" }
        assertEquals(ElementWords.Title.SourceName(builtInRoom.label), ElementWords.title(builtInRoom))
    }

    @Test
    fun wallsAndRoofsSayWhichKindTheyAre() {
        val walls = TestScenes.marcowki.objects.filter { it.kind == "wall" }.map { ElementWords.title(it) }.toSet()
        assertTrue(ElementWords.Title.Words(R.string.el_wall_exterior) in walls)
        assertTrue(ElementWords.Title.Words(R.string.el_wall_interior) in walls)
        val roofs = TestScenes.marcowki.objects.filter { it.kind == "roof" }.map { ElementWords.title(it) }.toSet()
        assertEquals(setOf(ElementWords.Title.Words(R.string.el_roof_flat), ElementWords.Title.Words(R.string.el_roof_gable)), roofs)
    }

    @Test
    fun storeysAreTheSourcesPolishNameOrTheirPosition() {
        assertEquals(ElementWords.Storey.SourceName("Parter"), ElementWords.storey("Parter (ground floor)", 0))
        assertEquals(ElementWords.Storey.SourceName("Poddasze"), ElementWords.storey("Poddasze (attic)", 1))
        assertEquals(ElementWords.Storey.Ground, ElementWords.storey("Ground", 0))
        assertEquals(ElementWords.Storey.Numbered(1), ElementWords.storey("Level 1", 1))
        assertNull(ElementWords.storey(null, null))
    }

    @Test
    fun ownerFactsArePolishWithDecimalCommasAndEngineeringStaysTechnical() {
        assertEquals(ElementWords.OwnerFact(R.string.fact_length, "12,6 m"), ElementWords.ownerFact(BundleFact("Length", "12.6 m")))
        assertEquals(ElementWords.OwnerFact(R.string.fact_footprint, "4,15 × 7,5 m"), ElementWords.ownerFact(BundleFact("Footprint", "4.15 × 7.5 m")))
        assertEquals(ElementWords.OwnerFact(R.string.fact_pitch, "40°"), ElementWords.ownerFact(BundleFact("Pitch", "40°")))
        assertEquals("to the centimetre, like every size", ElementWords.OwnerFact(R.string.fact_length, "0,45 m"), ElementWords.ownerFact(BundleFact("Length", "0.448 m")))
        assertEquals(ElementWords.OwnerFact(R.string.fact_thickness, "0,1 m"), ElementWords.ownerFact(BundleFact("Thickness", "0.100 m")))
        assertEquals("areas keep their figure", ElementWords.OwnerFact(R.string.fact_floor_area, "12,345 m²"), ElementWords.ownerFact(BundleFact("Floor area", "12.345 m²")))
        assertEquals(ElementWords.OwnerFact(R.string.fact_usage, null, R.string.usage_bathroom), ElementWords.ownerFact(BundleFact("Usage", "bathroom")))
        for (engineering in listOf("Ridge axis" to "X", "Eave offset" to "2.88 m", "Top offset" to "0.2 m", "Swing" to "In 0°", "Type" to "Gable")) {
            assertNull("${engineering.first} belongs under Dane techniczne", ElementWords.ownerFact(BundleFact(engineering.first, engineering.second)))
        }
        assertNull("an unknown use is not guessed", ElementWords.ownerFact(BundleFact("Usage", "sauna")))
        assertNull("words are never passed through as a measurement", ElementWords.ownerFact(BundleFact("Length", "follows roof")))
    }

    @Test
    fun everyMaterialOfTheBuiltInHouseHasAPolishWord() {
        val materials = (TestScenes.marcowki.objects + analysed.objects).mapNotNull { it.metadata?.materialLabel }.toSet()
        for (m in materials) assertTrue("material '$m'", ElementWords.material(m) != null || ElementWords.isNotAMaterial(m))
        assertNull("an element type is never shown as a material", ElementWords.material("partition"))
    }

    @Test
    fun aFlatRoofsZeroPitchAndOverhangAreNotFacts() {
        assertNull(ElementWords.ownerFact(BundleFact("Pitch", "0°")))
        assertNull(ElementWords.ownerFact(BundleFact("Overhang", "0 m")))
        assertNull(ElementWords.ownerFact(BundleFact("Overhang", "0.00 m")))
        assertEquals(ElementWords.OwnerFact(R.string.fact_overhang, "0,6 m"), ElementWords.ownerFact(BundleFact("Overhang", "0.6 m")))
    }

    @Test
    fun onlyTheDecimalPointOfANumberBecomesAComma() {
        assertEquals("4,15 × 7,5 m", ElementWords.decimalComma("4.15 × 7.5 m"))
        assertEquals("a full stop after a number stays", "Etap 1. Zakup", ElementWords.decimalComma("Etap 1. Zakup"))
    }
}
