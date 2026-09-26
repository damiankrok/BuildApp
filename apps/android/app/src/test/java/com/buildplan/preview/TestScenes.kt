package com.buildplan.preview

import com.buildplan.preview.scene.BundleParser
import com.buildplan.preview.scene.BundleResult
import com.buildplan.preview.scene.ModelScene
import com.buildplan.preview.scene.SceneBundle
import com.buildplan.preview.scene.SceneIndexEntry
import java.io.File

/**
 * The real shipped scene bundles, read straight from the app's assets.
 *
 * Tests run against the same asset the APK carries — not a fixture written by
 * hand. That is deliberate: a Kotlin file holding expected Marcówki
 * coordinates would be a second source of truth, which is the failure this
 * whole architecture exists to prevent. Every expectation in these tests is
 * either a generic invariant or something derived from the bundle itself.
 */
object TestScenes {
    private val assetRoot: File = sequenceOf(
        File("src/main/assets/scenes"),
        File("app/src/main/assets/scenes"),
        File("apps/android/app/src/main/assets/scenes"),
    ).firstOrNull { it.isDirectory } ?: error("scene assets not found from ${File(".").absolutePath}")

    fun text(name: String): String = File(assetRoot, name).readText()

    val index: List<SceneIndexEntry> by lazy { BundleParser.parseIndex(text("index.json")) }

    fun bundle(key: String): SceneBundle {
        val entry = index.first { it.key == key }
        return when (val r = BundleParser.parse(text(entry.asset))) {
            is BundleResult.Ok -> r.bundle
            is BundleResult.Failure -> error("${entry.asset} did not parse: ${r.message}")
        }
    }

    fun scene(key: String): ModelScene {
        val entry = index.first { it.key == key }
        return ModelScene.from(bundle(key), entry.key, entry.title, entry.subtitle)
    }

    val marcowki: ModelScene by lazy { scene("marcowki") }
    val demo: ModelScene by lazy { scene("demo") }

    /**
     * The reconstructed candidate: a SECOND building in the same build.
     *
     * It matters that it is a different building rather than a variant of the
     * reference — it names its own storeys and its own objects, so any code
     * that reads one scene's ids against another resolves almost nothing.
     */
    val autoCandidate: ModelScene by lazy { scene("marcowki-auto") }

    /** The analyzer-v2 candidate: the same drawings through the second pipeline, and a THIRD building. */
    val autoCandidateV2: ModelScene by lazy { scene("marcowki-auto-v2") }

    /** The exterior-closure candidate (BUILDAPP-03Y): analyzer v2 again, with the assemblies closed. */
    val autoCandidateV3: ModelScene by lazy { scene("marcowki-auto-v3") }

    /** Every reconstructed candidate the build ships, by scene key, for tests that hold each one to the same bar. */
    val candidateKeys: List<String> = listOf("marcowki-auto", "marcowki-auto-v2", "marcowki-auto-v3")

    private val candidates: Map<String, ModelScene> by lazy {
        mapOf("marcowki-auto" to autoCandidate, "marcowki-auto-v2" to autoCandidateV2, "marcowki-auto-v3" to autoCandidateV3)
    }

    /**
     * Candidates written by one analyzer: successive runs of the same pipeline
     * name their members from the same features on purpose, so their ids
     * coincide where their members do. Resolving one's viewer state against
     * the other would LOOK right by coincidence — which is why the renderer
     * resolves against the scene it draws (ViewerState), not why ids may be
     * shared across different producers.
     */
    private val analyzerLineages: List<Set<String>> = listOf(setOf("marcowki-auto-v2", "marcowki-auto-v3"))

    fun sameAnalyzer(a: String, b: String): Boolean = analyzerLineages.any { a in it && b in it }

    fun candidate(key: String): ModelScene = candidates.getValue(key)

    /** Every scene the build ships, which is what a viewer can switch between. */
    val all: List<ModelScene> by lazy { index.map { scene(it.key) } }
}
