package com.buildplan.preview.scene

import kotlinx.serialization.json.Json

/**
 * Reading a scene asset.
 *
 * A damaged or foreign asset is reported, never patched up and never allowed
 * to reach the renderer as half a building. The checks are structural: the
 * schema and version the app understands, and a scene whose mesh data is
 * self-consistent with the counts it claims.
 *
 * The bundle's `contentHash` is NOT recomputed here. It is the canonical-JSON
 * hash the TypeScript exporter produced; verifying it on the phone would mean
 * a second canonical-JSON implementation in Kotlin — exactly the kind of
 * duplicated authority this architecture avoids. The hash is carried for
 * identification and shown in the inspector; parity with the compiler is
 * proven on the TypeScript side, where the compiler is.
 */
sealed interface BundleResult {
    data class Ok(val bundle: SceneBundle) : BundleResult
    data class Failure(val message: String) : BundleResult
}

object BundleParser {
    const val SCHEMA = "buildapp.mobile-scene-bundle"
    const val VERSION = "1.0.0"

    private val json = Json { ignoreUnknownKeys = true }

    fun parse(text: String): BundleResult {
        val bundle = try {
            json.decodeFromString(SceneBundle.serializer(), text)
        } catch (e: Exception) {
            return BundleResult.Failure("scene asset is not a readable bundle: ${e.message}")
        }
        return validate(bundle)
    }

    fun parseIndex(text: String): List<SceneIndexEntry> = try {
        json.decodeFromString(kotlinx.serialization.builtins.ListSerializer(SceneIndexEntry.serializer()), text)
    } catch (e: Exception) {
        emptyList()
    }

    fun validate(bundle: SceneBundle): BundleResult {
        if (bundle.schema != SCHEMA) return BundleResult.Failure("unknown scene schema \"${bundle.schema}\"")
        if (bundle.schemaVersion != VERSION) {
            return BundleResult.Failure("scene bundle version ${bundle.schemaVersion} is not supported (this build reads $VERSION)")
        }
        val meshes = bundle.scene.meshes
        if (meshes.isEmpty()) return BundleResult.Failure("scene has no meshes")

        var triangles = 0
        for ((i, mesh) in meshes.withIndex()) {
            if (mesh.positions.size != mesh.triangleCount * 9) {
                return BundleResult.Failure(
                    "mesh $i (${mesh.objectId} ${mesh.part}) claims ${mesh.triangleCount} triangles but carries ${mesh.positions.size} coordinates",
                )
            }
            if (mesh.objectId.isEmpty()) return BundleResult.Failure("mesh $i has no semantic object id")
            for (v in mesh.positions) {
                if (!v.isFinite()) return BundleResult.Failure("mesh $i (${mesh.objectId}) has a non-finite coordinate")
            }
            triangles += mesh.triangleCount
        }

        val stats = bundle.scene.stats
        if (stats.meshCount != meshes.size) {
            return BundleResult.Failure("scene says ${stats.meshCount} meshes but carries ${meshes.size}")
        }
        if (stats.triangleCount != triangles) {
            return BundleResult.Failure("scene says ${stats.triangleCount} triangles but carries $triangles")
        }
        val objectIds = meshes.map { it.objectId }.toSet()
        if (stats.objectCount != objectIds.size) {
            return BundleResult.Failure("scene says ${stats.objectCount} objects but its meshes name ${objectIds.size}")
        }
        if (bundle.scene.bounds == null) return BundleResult.Failure("scene has no bounds")

        return BundleResult.Ok(bundle)
    }
}
