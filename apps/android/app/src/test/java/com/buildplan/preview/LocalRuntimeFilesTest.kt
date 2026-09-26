package com.buildplan.preview

import com.buildplan.preview.analyzer.local.LocalRuntimeFiles
import java.io.ByteArrayInputStream
import java.io.File
import java.io.IOException
import java.security.MessageDigest
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Assert.fail
import org.junit.Test

/**
 * The analyzer bundle travels inside the APK and is copied out before it
 * runs. What is copied is checked against the manifest the build wrote, on
 * the way in and every time it is reused; a file that does not match never
 * runs.
 */
class LocalRuntimeFilesTest {

    private val analyzer = "export const pipeline = 'the production analyzer'\n".encodeToByteArray()
    private val main = "import './analyzer.mjs'\n".encodeToByteArray()

    private fun sha(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it.toInt() and 0xff) }

    private fun manifest(protocol: Int = 1, analyzerSha: String = sha(analyzer)) = """
        {"schema":"buildapp.local-analyzer-runtime","protocol":$protocol,"runtime":{"name":"nodejs-mobile","node":"18.20.4","target":"node18"},"entry":"main.mjs",
         "files":{"analyzer.mjs":{"sha256":"$analyzerSha","bytes":${analyzer.size}},"main.mjs":{"sha256":"${sha(main)}","bytes":${main.size}}}}
    """.trimIndent().encodeToByteArray()

    private fun assets(vararg entries: Pair<String, ByteArray>): (String) -> java.io.InputStream? {
        val map = entries.toMap()
        return { name -> map[name]?.let { ByteArrayInputStream(it) } }
    }

    @Test
    fun `installs the bundle into a folder named by its own hash, verified`() {
        val root = AnalyzerFixtures.tempDir("runtime-files")
        val files = LocalRuntimeFiles(root, assets("local-analyzer/manifest.json" to manifest(), "local-analyzer/analyzer.mjs" to analyzer, "local-analyzer/main.mjs" to main))
        val installed = files.install()
        assertEquals(sha(analyzer).take(16), installed.dir.name)
        assertEquals(File(installed.dir, "main.mjs"), installed.entry)
        assertTrue(installed.entry.readBytes().contentEquals(main))
        assertEquals("18.20.4", installed.manifest.runtime.node)
        // reused as is the second time, and still verified
        val again = files.install()
        assertEquals(installed.dir, again.dir)
    }

    @Test
    fun `a file on disk that changed is replaced from the APK before it runs`() {
        val root = AnalyzerFixtures.tempDir("runtime-files-tamper")
        val files = LocalRuntimeFiles(root, assets("local-analyzer/manifest.json" to manifest(), "local-analyzer/analyzer.mjs" to analyzer, "local-analyzer/main.mjs" to main))
        val installed = files.install()
        File(installed.dir, "analyzer.mjs").writeText("tampered")
        files.install()
        assertTrue(File(installed.dir, "analyzer.mjs").readBytes().contentEquals(analyzer))
    }

    @Test
    fun `an asset that does not match its manifest is refused and never installed`() {
        val root = AnalyzerFixtures.tempDir("runtime-files-bad")
        val files = LocalRuntimeFiles(root, assets("local-analyzer/manifest.json" to manifest(analyzerSha = "0".repeat(64)), "local-analyzer/analyzer.mjs" to analyzer, "local-analyzer/main.mjs" to main))
        try {
            files.install()
            fail("installed a file that does not match its manifest")
        } catch (e: IOException) {
            assertTrue(e.message!!.contains("does not match"))
        }
        assertFalse(File(root, "runtime/${"0".repeat(16)}/analyzer.mjs").exists())
    }

    @Test
    fun `a bundle that speaks another protocol is refused`() {
        val root = AnalyzerFixtures.tempDir("runtime-files-protocol")
        val files = LocalRuntimeFiles(root, assets("local-analyzer/manifest.json" to manifest(protocol = 2), "local-analyzer/analyzer.mjs" to analyzer, "local-analyzer/main.mjs" to main))
        try {
            files.install()
            fail("installed a bundle of another protocol")
        } catch (e: IOException) {
            assertTrue(e.message!!.contains("protocol"))
        }
    }

    @Test
    fun `an older bundle version's folder is removed when a new one is installed`() {
        val root = AnalyzerFixtures.tempDir("runtime-files-versions")
        val old = File(root, "runtime/0123456789abcdef").apply { mkdirs() }
        File(old, "analyzer.mjs").writeText("old")
        LocalRuntimeFiles(root, assets("local-analyzer/manifest.json" to manifest(), "local-analyzer/analyzer.mjs" to analyzer, "local-analyzer/main.mjs" to main)).install()
        assertFalse(old.exists())
    }

    @Test
    fun `a build without the local analyzer has no manifest, and says so`() {
        val files = LocalRuntimeFiles(AnalyzerFixtures.tempDir("runtime-files-none"), assets())
        assertNull(files.manifest())
        try {
            files.install()
            fail("installed nothing")
        } catch (e: IOException) {
            assertTrue(e.message!!.contains("no local analyzer"))
        }
    }
}
