package com.buildplan.preview.scene

import android.content.res.AssetManager
import java.io.IOException

/**
 * Reading the scene bundles that ship inside the APK.
 *
 * Everything the viewer draws comes from here, and there is no other source:
 * no network, no file picker, no cache. That is what makes the preview work in
 * flight mode and what keeps the geometry traceable to a compiler run.
 */
class SceneRepository(private val assets: AssetManager) {

    /** The scenes this build carries, in the order the exporter listed them. */
    fun index(): List<SceneIndexEntry> = try {
        BundleParser.parseIndex(readAsset("$DIR/index.json"))
    } catch (e: IOException) {
        emptyList()
    }

    fun load(entry: SceneIndexEntry): SceneLoadResult {
        val text = try {
            readAsset("$DIR/${entry.asset}")
        } catch (e: IOException) {
            return SceneLoadResult.Failed("Scene asset ${entry.asset} is missing from this build.")
        }
        return when (val parsed = BundleParser.parse(text)) {
            is BundleResult.Failure -> SceneLoadResult.Failed(parsed.message)
            is BundleResult.Ok -> {
                val bundle = parsed.bundle
                // The index is a convenience copy; the bundle is the asset. If
                // they disagree the build is inconsistent and saying so beats
                // rendering something that is not what the index promised.
                if (bundle.contentHash != entry.contentHash) {
                    SceneLoadResult.Failed("Scene ${entry.key} does not match the index: the build is inconsistent.")
                } else {
                    SceneLoadResult.Ok(ModelScene.from(bundle, entry.key, entry.title, entry.subtitle))
                }
            }
        }
    }

    private fun readAsset(path: String): String = assets.open(path).use { it.readBytes().decodeToString() }

    private companion object {
        const val DIR = "scenes"
    }
}

sealed interface SceneLoadResult {
    data class Ok(val scene: ModelScene) : SceneLoadResult
    data class Failed(val message: String) : SceneLoadResult
}
