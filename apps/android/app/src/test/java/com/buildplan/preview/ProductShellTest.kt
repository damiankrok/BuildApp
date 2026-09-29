package com.buildplan.preview

import com.buildplan.preview.camera.ViewPreset
import com.buildplan.preview.presentation.PresentationMode
import com.buildplan.preview.render.RenderStyle
import com.buildplan.preview.scene.VisibilityMode
import com.buildplan.preview.ui.Sheet
import com.buildplan.preview.ui.ShellState
import com.buildplan.preview.ui.Task
import com.buildplan.preview.ui.descriptionRes
import com.buildplan.preview.ui.evidenceStatusRes
import com.buildplan.preview.ui.labelRes
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import org.w3c.dom.Element
import java.io.File
import javax.xml.parsers.DocumentBuilderFactory

/**
 * The product shell, held without a screen (INTEGRATION-004A, house-first):
 * the house workspace is the root, one sheet stands over it at a time, a
 * task takes the screen and returns, the state survives being saved, every
 * control speaks Polish from `strings.xml`, and no five-place navigation is
 * left in the code or the strings.
 */
class ProductShellTest {

    @Test
    fun `the house workspace is the root, and back leaves the app only from it`() {
        val root = ShellState()
        assertNull(root.task)
        assertNull(root.sheet)
        assertFalse(root.analyzerOpen)
        assertNull("the bare workspace hands back to the system", root.back())
    }

    @Test
    fun `one sheet at a time, and a sheet closes on back`() {
        val root = ShellState()
        val menu = root.open(Sheet.MENU)
        assertEquals(Sheet.MENU, menu.sheet)
        assertEquals(root, menu.back())
        // Opening another sheet replaces the first: never two over the house.
        val stages = menu.open(Sheet.STAGES)
        assertEquals(ShellState(sheet = Sheet.STAGES), stages)
        assertEquals(root, stages.closeSheet())
        assertEquals(root, stages.back())
    }

    @Test
    fun `the analyzer is a task that takes the screen and returns to the same house`() {
        val fromMenu = ShellState().open(Sheet.MENU).openAnalyzer()
        assertTrue(fromMenu.analyzerOpen)
        assertEquals(Task.ANALYZER, fromMenu.task)
        assertNull("a task has no sheet", fromMenu.sheet)
        assertEquals(ShellState(), fromMenu.back())
        // A sheet cannot open over a task.
        assertEquals(fromMenu, fromMenu.open(Sheet.SOURCE))
    }

    @Test
    fun `the state survives being saved, and a launch can name a surface`() {
        val states = listOf(ShellState(), ShellState().open(Sheet.STAGES), ShellState().open(Sheet.SOURCE), ShellState().openAnalyzer())
        for (s in states) assertEquals(s, ShellState.decode(s.encode()))
        assertEquals(ShellState(), ShellState.decode("HOUSE"))
        assertEquals("the older launch extra still opens the house", ShellState(), ShellState.decode("model"))
        assertEquals(ShellState().open(Sheet.STAGES), ShellState.decode("stages"))
        assertEquals(ShellState().open(Sheet.MENU), ShellState.decode("house:menu"))
        assertEquals(ShellState().openAnalyzer(), ShellState.decode("ANALYZER"))
        assertNull("Koszty is not a place", ShellState.decode("COSTS"))
        assertNull(ShellState.decode("nowhere"))
        assertNull(ShellState.decode(null))
    }

    @Test
    fun `every control label is Polish and comes from strings xml`() {
        val ids = ViewPreset.entries.map { it.labelRes() } +
            VisibilityMode.entries.map { it.labelRes() } +
            PresentationMode.entries.flatMap { listOf(it.labelRes(), it.descriptionRes()) } +
            RenderStyle.entries.map { it.labelRes() }
        for (id in ids) assertTrue("resource $id is empty", string(id).isNotBlank())
        // Distinct names: two views called the same would be two buttons nobody can tell apart.
        assertEquals(ViewPreset.entries.size, ViewPreset.entries.map { string(it.labelRes()) }.toSet().size)
        assertEquals(listOf("Model", "Makieta", "Kreska"), PresentationMode.entries.map { string(it.labelRes()) })
    }

    @Test
    fun `every evidence status of the model reads in plain Polish, never as its code`() {
        // The model's EVIDENCE_STATUSES (packages/model/src/evidence.ts).
        val statuses = listOf("SOURCE_EXACT", "SOURCE_CORROBORATED", "SOURCE_DERIVED", "GEOMETRIC_INFERRED", "VISUAL_INFERRED", "ASSUMED", "UNRESOLVED")
        val words = statuses.map { string(evidenceStatusRes(it)) }
        assertEquals(statuses.size, words.toSet().size)
        for ((code, text) in statuses.zip(words)) assertFalse("$code reads as a code: $text", text.contains('_'))
        assertEquals(string(evidenceStatusRes("SOMETHING_NEW")), string(evidenceStatusRes("ANOTHER")))
    }

    @Test
    fun `no five-place navigation is left, and the cost boundary says it is not built without a figure`() {
        for (name in listOf("place_house", "place_model", "place_stages", "place_costs", "place_documents", "empty_costs_body", "empty_documents_body")) {
            assertFalse("$name is a string of the five-place shell", strings.containsKey(name))
        }
        val costs = strings.getValue("menu_costs_not_built")
        assertTrue("the cost boundary must say the part is not built", costs.contains("jeszcze nie powstała"))
        assertFalse("the cost boundary shows a figure: $costs", costs.any { it.isDigit() })
        val ui = uiDir()
        assertFalse("EmptyPlace.kt is gone", File(ui, "EmptyPlace.kt").exists())
        assertFalse("HouseScreen.kt (the Dom page) is gone", File(ui, "HouseScreen.kt").exists())
        for (file in ui.listFiles().orEmpty().filter { it.extension == "kt" }) {
            val code = file.readText()
            for (word in listOf("AppPlace", "PlacesBar", "PlacesRail", "NavigationBar(", "NavigationRail(")) {
                assertFalse("${file.name} still carries $word", code.contains(word))
            }
        }
    }

    @Test
    fun `the shell's screens carry no hard-coded text`() {
        val dir = uiDir()
        for (name in listOf(
            "AppShell.kt", "HouseWorkspace.kt", "HouseSheets.kt", "ToolRail.kt", "TimelineRail.kt",
            "FoldingRule.kt", "Inspector.kt", "StagesScreen.kt", "Chrome.kt", "HouseDrawing.kt",
        )) {
            val code = File(dir, name).readText()
            assertFalse("$name passes a literal to Text()", Regex("""Text\(\s*"""").containsMatchIn(code))
            assertFalse("$name sets a literal contentDescription", Regex("""contentDescription = "[A-Za-z]""").containsMatchIn(code))
        }
    }

    private fun uiDir(): File = sequenceOf(
        File("src/main/java/com/buildplan/preview/ui"),
        File("app/src/main/java/com/buildplan/preview/ui"),
        File("apps/android/app/src/main/java/com/buildplan/preview/ui"),
    ).first { it.isDirectory }

    private val strings: Map<String, String> by lazy {
        val file = sequenceOf(
            File("src/main/res/values/strings.xml"),
            File("app/src/main/res/values/strings.xml"),
            File("apps/android/app/src/main/res/values/strings.xml"),
        ).first { it.isFile }
        val doc = DocumentBuilderFactory.newInstance().newDocumentBuilder().parse(file).documentElement
        val nodes = doc.getElementsByTagName("string")
        (0 until nodes.length).associate { i -> (nodes.item(i) as Element).let { it.getAttribute("name") to it.textContent } }
    }

    /** The value of a string resource, found by its generated id. */
    private fun string(id: Int): String {
        val name = R.string::class.java.fields.firstOrNull { it.getInt(null) == id }?.name ?: error("no string resource with id $id")
        return strings.getValue(name)
    }
}
