package com.buildplan.preview

import java.io.File
import javax.xml.parsers.DocumentBuilderFactory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import org.w3c.dom.Element

/**
 * The app asks for exactly one permission: INTERNET, for the Analyzer. No
 * storage, location, camera, microphone or network-state permission, no
 * network security config and no cleartext traffic — the bundled scenes
 * need nothing, and the analyzer is reached over https only.
 */
class ManifestPermissionTest {

    private val manifest: Element by lazy {
        val file = sequenceOf(
            File("src/main/AndroidManifest.xml"),
            File("app/src/main/AndroidManifest.xml"),
            File("apps/android/app/src/main/AndroidManifest.xml"),
        ).firstOrNull { it.isFile } ?: error("AndroidManifest.xml not found from ${File(".").absolutePath}")
        val factory = DocumentBuilderFactory.newInstance().apply { isNamespaceAware = true }
        factory.newDocumentBuilder().parse(file).documentElement
    }

    private fun elements(name: String): List<Element> {
        val nodes = manifest.getElementsByTagName(name)
        return (0 until nodes.length).map { nodes.item(it) as Element }
    }

    private fun Element.android(attr: String): String = getAttributeNS(ANDROID_NS, attr)

    @Test
    fun `the manifest declares exactly one permission, INTERNET`() {
        val requested = listOf("uses-permission", "uses-permission-sdk-23", "uses-permission-sdk-m")
            .flatMap { elements(it) }
            .map { it.android("name") }
        assertEquals(listOf("android.permission.INTERNET"), requested)
    }

    @Test
    fun `no cleartext traffic and no network security config`() {
        val application = elements("application").single()
        assertTrue(application.android("usesCleartextTraffic").let { it.isEmpty() || it == "false" })
        assertEquals("", application.android("networkSecurityConfig"))
    }

    private companion object {
        const val ANDROID_NS = "http://schemas.android.com/apk/res/android"
    }
}
