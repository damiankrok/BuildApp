package com.buildplan.preview

import com.buildplan.preview.scene.BundledScenes
import com.buildplan.preview.scene.SceneEntry
import com.buildplan.preview.scene.SceneLoadResult
import com.buildplan.preview.scene.SceneRepository
import com.buildplan.preview.scene.SceneSourceKind
import com.buildplan.preview.ui.StartChoice
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.security.MessageDigest

/**
 * MARCOWKI-UI (OWNER, 2026-11-26): one readable showcase house on a clean start, the analyzer's history apart from
 * ordinary use, and the frozen Marcówki bytes untouched.
 */
class ShowcaseCatalogTest {

    private val repository = SceneRepository(BundledScenes { TestScenes.text(it) })

    @Test
    fun `exactly one shipped scene is the showcase, and it is the frozen Marcowki delivery`() {
        val marked = TestScenes.index.filter { it.showcase != null }
        assertEquals(listOf("marcowki-c-v35414"), marked.map { it.key })
        val entry = marked.single()
        assertEquals("Dom w marcówkach", entry.showcase?.title)
        assertTrue("the showcase says it is a demonstration model", entry.showcase?.subtitle.orEmpty().contains("Model demonstracyjny"))
        // the record keeps its technical title; the showcase name is presentation beside it
        assertEquals("Marcówki — poprawka v3.54.14 (oddany)", entry.title)
        // the freeze of the OWNER's brief: the scene's logical hash and the raw file's bytes
        assertEquals("3dc4d3bb843dc58c144459aec9cf9591da93f564681df35c9cbe7d30aea0ffb7", entry.contentHash)
        val raw = MessageDigest.getInstance("SHA-256").digest(TestScenes.text(entry.asset).toByteArray(Charsets.UTF_8))
        assertEquals("680a3f4bb731d77430c2c81db968f243076dcc65c2648dcda2348a3023d47166", raw.joinToString("") { "%02x".format(it) })
    }

    @Test
    fun `the showcase is listed under its showcase name, every other scene under its record, in the exported order`() {
        val entries = repository.entries()
        assertEquals(TestScenes.index.map { it.key }, entries.map { it.key })
        val showcase = entries.single { it.showcase }
        assertEquals("Dom w marcówkach", showcase.title)
        assertEquals("Marcówki — poprawka v3.54.14 (oddany)", showcase.recordTitle)
        assertFalse(showcase.isDevelopment)
        for ((index, entry) in TestScenes.index.zip(entries)) {
            assertEquals(index.title, entry.recordTitle)
            assertEquals(index.subtitle, entry.recordSubtitle)
            if (!entry.showcase) {
                assertEquals(index.title, entry.title)
                assertTrue("${entry.key} is a development scene", entry.isDevelopment)
            }
        }
        assertEquals(entries.size - 1, entries.count { it.isDevelopment })
    }

    @Test
    fun `the showcase opens under the name the owner reads`() {
        val loaded = repository.load(repository.entries().single { it.showcase })
        assertTrue(loaded is SceneLoadResult.Ok)
        val scene = (loaded as SceneLoadResult.Ok).scene
        assertEquals("Dom w marcówkach", scene.title)
        assertEquals("marcowki-c-v35414", scene.key)
        assertEquals("3dc4d3bb843dc58c144459aec9cf9591da93f564681df35c9cbe7d30aea0ffb7", scene.bundle.contentHash)
    }

    @Test
    fun `a clean start opens the showcase, not the first scene of the list`() {
        val entries = repository.entries()
        assertTrue("the first scene listed is not the showcase", !entries.first().showcase)
        assertEquals("marcowki-c-v35414", StartChoice.of(entries, null)?.key)
    }

    @Test
    fun `the house the owner chose is restored while the list has it, otherwise the showcase`() {
        val entries = repository.entries()
        assertEquals("anna-v35421", StartChoice.of(entries, "anna-v35421")?.key)
        assertEquals("marcowki-c-v35414", StartChoice.of(entries, "analysis-gone")?.key)
        val analysis = SceneEntry("analysis-abc", "Mój dom", "", SceneSourceKind.DOWNLOADED)
        assertEquals("analysis-abc", StartChoice.of(entries + analysis, "analysis-abc")?.key)
        assertFalse(analysis.isDevelopment)
    }

    @Test
    fun `a build without a showcase opens its first scene, as before`() {
        val plain = listOf(
            SceneEntry("a", "A", "", SceneSourceKind.BUNDLED),
            SceneEntry("b", "B", "", SceneSourceKind.BUNDLED),
        )
        assertEquals("a", StartChoice.of(plain, null)?.key)
        assertEquals("b", StartChoice.of(plain, "b")?.key)
        assertNull(StartChoice.of(emptyList(), "b"))
    }
}
