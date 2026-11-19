package com.buildplan.preview

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * v3.54.11 (D52): the v3.54.10 checkpoint as the app reads it from the shipped assets — the H candidate and the LOCAL
 * model the host delivered, first in the list, each its own scene with the content hash of the sealed model's scene.
 */
class OwnerCheckpointV35410ScenesTest {

    @Test
    fun `the candidate and the delivered model are listed under their own titles, after the repaired H`() {
        // v3.54.13: the delivered miniature and the four-side reading come first
        assertEquals(listOf("marcowki-c-offline-v35413", "marcowki-c-live-v35413"), TestScenes.index.subList(0, 2).map { it.key })
        assertTrue(TestScenes.index[0].subtitle.contains("ODDANY"))
        // v3.54.12: the H candidate with the end caps and the sketch experiment, then the repaired H
        assertEquals(listOf("marcowki-h-v35412", "marcowki-local-szkice-v35412"), TestScenes.index.subList(2, 4).map { it.key })
        assertTrue(TestScenes.index[3].subtitle.contains("EKSPERYMENT"))
        assertEquals("marcowki-h-v35411", TestScenes.index[4].key)
        assertTrue(TestScenes.index[4].title.contains("po naprawie"))
        assertEquals(listOf("marcowki-h-v35410", "marcowki-local-v35410"), TestScenes.index.subList(5, 7).map { it.key })
        assertTrue(TestScenes.index[5].title.contains("kandydat"))
        assertTrue(TestScenes.index[6].title.contains("LOCAL oddany"))
    }

    @Test
    fun `each parses into the scene the checkpoint sealed`() {
        val repaired = TestScenes.bundle("marcowki-h-v35411")
        // v3.54.13: the same meshes, restated under model schema 1.9.0 (only the version and the hashes changed)
        assertEquals("bb28634aadabfd6d", repaired.contentHash.take(16))
        val h = TestScenes.bundle("marcowki-h-v35410")
        val local = TestScenes.bundle("marcowki-local-v35410")
        assertEquals("b2a7bcab9ffd81115d943e076d88d8aeb5d487923e8189149978badc1082891a", h.contentHash)
        assertEquals("8a37c476325b82d6a9a43b08c185d49d4b48bb825f04279f871901d38fa1b4fe", local.contentHash)
        for (b in listOf(h, local)) {
            val kinds = b.scene.meshes.map { it.objectKind }.toSet()
            assertTrue(kinds.toString(), kinds.any { it.contains("room", ignoreCase = true) })
            assertTrue(kinds.toString(), kinds.any { it.contains("window", ignoreCase = true) })
        }
    }
}
