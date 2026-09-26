package com.buildplan.preview.scene

import android.content.res.AssetManager
import java.io.IOException

/** Where a scene came from. */
enum class SceneSourceKind {
    /** Shipped inside the APK; works offline, can never be changed by the app. */
    BUNDLED,

    /** Downloaded from the analyzer service and verified; kept in the app's private storage. */
    DOWNLOADED,
}

/** One scene the viewer can open, and which source holds it. */
data class SceneEntry(
    val key: String,
    val title: String,
    val subtitle: String,
    val source: SceneSourceKind,
)

/** A place scenes come from. */
interface SceneSource {
    val kind: SceneSourceKind

    /** What this source offers, in the order it should be listed. */
    fun catalog(): List<SceneEntry>

    fun load(key: String): SceneLoadResult

    /** Note that a scene was opened. Only a source that orders by use cares. */
    fun touch(key: String) {}
}

/**
 * The scene bundles that ship inside the APK.
 *
 * `read` returns the text of a file under `assets/scenes/` — the asset
 * manager in the app, the source tree in tests. The bundled scenes are listed
 * exactly as the exporter wrote `index.json`, in its order.
 */
class BundledScenes(private val read: (name: String) -> String) : SceneSource {

    override val kind: SceneSourceKind get() = SceneSourceKind.BUNDLED

    /** The scenes this build carries, in the order the exporter listed them. */
    fun index(): List<SceneIndexEntry> = try {
        BundleParser.parseIndex(read("index.json"))
    } catch (e: IOException) {
        emptyList()
    }

    override fun catalog(): List<SceneEntry> =
        index().map { SceneEntry(key = it.key, title = it.title, subtitle = it.subtitle, source = SceneSourceKind.BUNDLED) }

    override fun load(key: String): SceneLoadResult {
        val entry = index().firstOrNull { it.key == key }
            ?: return SceneLoadResult.Failed("Scene $key is not part of this build.")
        return load(entry)
    }

    fun load(entry: SceneIndexEntry): SceneLoadResult {
        val text = try {
            read(entry.asset)
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

    companion object {
        private const val DIR = "scenes"

        fun fromAssets(assets: AssetManager): BundledScenes =
            BundledScenes { name -> assets.open("$DIR/$name").use { it.readBytes().decodeToString() } }
    }
}

/**
 * Every scene the viewer can open: the bundles that ship inside the APK, in
 * their exported order, then the analyses downloaded from the analyzer
 * service, most recently used first.
 *
 * Bundled scenes need nothing but the APK, so they still open in flight mode.
 * A downloaded scene was verified against the analyzer's hashes before it was
 * kept and is verified again every time it is opened. A downloaded entry can
 * never shadow a bundled one: downloaded keys live in their own namespace,
 * and one that somehow collided would be dropped here.
 */
class SceneRepository(
    private val bundled: BundledScenes,
    private val downloaded: DownloadedScenes? = null,
) {
    constructor(assets: AssetManager, downloaded: DownloadedScenes? = null) : this(BundledScenes.fromAssets(assets), downloaded)

    fun entries(): List<SceneEntry> {
        val shipped = bundled.catalog()
        val shippedKeys = shipped.mapTo(HashSet()) { it.key }
        val analyses = downloaded?.catalog().orEmpty().filter { it.key !in shippedKeys && DownloadedScenes.isDownloadedKey(it.key) }
        return shipped + analyses
    }

    fun load(entry: SceneEntry): SceneLoadResult = when (entry.source) {
        SceneSourceKind.BUNDLED -> bundled.load(entry.key)
        SceneSourceKind.DOWNLOADED -> {
            val store = downloaded
            if (store == null || !DownloadedScenes.isDownloadedKey(entry.key)) {
                SceneLoadResult.Failed("Downloaded analyses are not available.")
            } else {
                store.load(entry.key).also { if (it is SceneLoadResult.Ok) store.touch(entry.key) }
            }
        }
    }
}

sealed interface SceneLoadResult {
    data class Ok(val scene: ModelScene) : SceneLoadResult
    data class Failed(val message: String) : SceneLoadResult
}
