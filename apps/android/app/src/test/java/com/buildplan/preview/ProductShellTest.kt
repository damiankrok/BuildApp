package com.buildplan.preview

import com.buildplan.preview.camera.ViewPreset
import com.buildplan.preview.presentation.PresentationMode
import com.buildplan.preview.render.RenderStyle
import com.buildplan.preview.scene.VisibilityMode
import com.buildplan.preview.ui.AppPlace
import com.buildplan.preview.ui.ShellState
import com.buildplan.preview.ui.descriptionRes
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
 * The product shell, held without a screen: the five places, where back goes
 * from each, that the state survives being saved, that every control speaks
 * Polish from `strings.xml`, and that the three places not yet built say so
 * without a single figure.
 */
class ProductShellTest {

    @Test
    fun `the five places, in the order the bar shows them`() {
        assertEquals(listOf("HOUSE", "MODEL", "STAGES", "COSTS", "DOCUMENTS"), AppPlace.entries.map { it.name })
        assertEquals(listOf("Dom", "3D", "Etapy", "Koszty", "Dokumenty"), AppPlace.entries.map { string(it.label) })
    }

    @Test
    fun `back retraces one step and leaves the app only from Dom`() {
        val home = ShellState()
        assertNull("Dom hands back to the system", home.back())

        val analyzer = home.openAnalyzer()
        assertTrue(analyzer.analyzerOpen)
        assertEquals(home, analyzer.back())

        // 3D returns to the place it was opened from, and hides the navigation bar meanwhile.
        val fromCosts = ShellState(AppPlace.COSTS).go(AppPlace.MODEL)
        assertTrue(fromCosts.immersive)
        assertEquals(ShellState(AppPlace.COSTS), fromCosts.back())
        assertEquals(ShellState(AppPlace.HOUSE), ShellState(AppPlace.MODEL).back())

        for (place in listOf(AppPlace.STAGES, AppPlace.COSTS, AppPlace.DOCUMENTS)) {
            val there = home.go(place)
            assertFalse(there.immersive)
            assertEquals(home, there.back())
        }
    }

    @Test
    fun `going to the place you are in changes nothing, and leaving the analysis closes it`() {
        val home = ShellState()
        assertEquals(home, home.go(AppPlace.HOUSE))
        val analyzer = home.openAnalyzer()
        assertEquals(ShellState(AppPlace.HOUSE), analyzer.go(AppPlace.HOUSE))
        assertEquals(ShellState(AppPlace.STAGES), analyzer.go(AppPlace.STAGES))
    }

    @Test
    fun `the state survives being saved, and a launch can name a place`() {
        val states = listOf(
            ShellState(),
            ShellState().openAnalyzer(),
            ShellState(AppPlace.DOCUMENTS),
            ShellState(AppPlace.STAGES).go(AppPlace.MODEL),
        )
        for (s in states) assertEquals(s, ShellState.decode(s.encode()))
        assertEquals(ShellState(AppPlace.MODEL), ShellState.decode("model"))
        assertEquals(ShellState().openAnalyzer(), ShellState.decode("ANALYZER"))
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
    fun `the places not yet built say so, and show no figure`() {
        for (name in listOf("stages", "costs", "documents")) {
            val body = strings.getValue("empty_${name}_body")
            assertTrue("empty_${name}_body must say the part is not built", body.contains("nie jest jeszcze zbudowana"))
            assertFalse("empty_${name}_body shows a figure: $body", body.any { it.isDigit() })
        }
    }

    @Test
    fun `the shell's screens carry no hard-coded text`() {
        val dir = sequenceOf(
            File("src/main/java/com/buildplan/preview/ui"),
            File("app/src/main/java/com/buildplan/preview/ui"),
            File("apps/android/app/src/main/java/com/buildplan/preview/ui"),
        ).first { it.isDirectory }
        for (name in listOf("AppShell.kt", "HouseScreen.kt", "EmptyPlace.kt", "ModelWorkspace.kt", "Controls.kt", "Inspector.kt")) {
            val code = File(dir, name).readText()
            assertFalse("$name passes a literal to Text()", Regex("""Text\(\s*"""").containsMatchIn(code))
            assertFalse("$name sets a literal contentDescription", Regex("""contentDescription = "[A-Za-z]""").containsMatchIn(code))
        }
    }

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
