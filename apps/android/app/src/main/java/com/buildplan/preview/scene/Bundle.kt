package com.buildplan.preview.scene

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * `buildapp.mobile-scene-bundle@1.0.0` as the app reads it.
 *
 * These classes mirror the asset the TypeScript exporter writes; they are a
 * transport format, not a model. Nothing here interprets building semantics —
 * the inspector rows arrive already formatted as `label: value`, precisely so
 * that this app never has to learn the CanonicalBuildingModel schema.
 */
@Serializable
class SceneBundle(
    val schema: String = "",
    val schemaVersion: String = "",
    val generatedFrom: BundleOrigin = BundleOrigin(),
    val scene: BundleScene = BundleScene(),
    val levels: List<BundleLevel> = emptyList(),
    val objects: List<BundleObject> = emptyList(),
    val materials: List<BundleMaterial> = emptyList(),
    val contentHash: String = "",
)

@Serializable
data class BundleOrigin(
    val modelId: String = "",
    val modelName: String = "",
    val modelSchema: String = "",
    val modelSchemaVersion: String = "",
    val modelContentHash: String = "",
)

@Serializable
class BundleScene(
    val modelId: String = "",
    val meshes: List<BundleMesh> = emptyList(),
    val diagnostics: List<BundleDiagnostic> = emptyList(),
    val bounds: BundleBounds? = null,
    val stats: BundleStats = BundleStats(),
)

/**
 * One compiled mesh.
 *
 * `positions` is 9 doubles per triangle — ax, ay, az, bx, by, bz, cx, cy, cz —
 * in the COMPILER's world frame (x right, y up, z into the building) with the
 * compiler's winding. It is not converted here: `ModelFrame` is the one place
 * that changes a coordinate.
 */
@Serializable
class BundleMesh(
    val objectId: String = "",
    val objectKind: String = "",
    val part: String = "",
    val levelId: String? = null,
    val solidId: String = "",
    val hostWallId: String? = null,
    val hostRoofId: String? = null,
    val openingId: String? = null,
    val structural: Boolean = false,
    val materialId: String? = null,
    val triangleCount: Int = 0,
    val positions: DoubleArray = DoubleArray(0),
)

@Serializable
data class BundleDiagnostic(
    val code: String = "",
    val severity: String = "",
    val message: String = "",
    val objectId: String? = null,
)

@Serializable
data class BundleVec3(val x: Double = 0.0, val y: Double = 0.0, val z: Double = 0.0)

@Serializable
data class BundleBounds(val min: BundleVec3 = BundleVec3(), val max: BundleVec3 = BundleVec3())

@Serializable
data class BundleStats(val triangleCount: Int = 0, val meshCount: Int = 0, val objectCount: Int = 0)

@Serializable
data class BundleLevel(
    val id: String = "",
    val label: String = "",
    val index: Int = 0,
    val elevation: Double = 0.0,
    val height: Double = 0.0,
)

@Serializable
data class BundleRelation(val role: String = "", val targetId: String = "", val targetLabel: String = "")

@Serializable
data class BundleFact(val label: String = "", val value: String = "")

@Serializable
data class BundleEvidence(
    val status: String = "",
    val source: String? = null,
    val locator: String? = null,
    val interpretation: String? = null,
    val confidence: Double? = null,
    val note: String? = null,
)

@Serializable
data class BundleObject(
    val id: String = "",
    val kind: String = "",
    val label: String = "",
    val kindLabel: String = "",
    val name: String? = null,
    val levelId: String? = null,
    val levelLabel: String? = null,
    val materialId: String? = null,
    val materialLabel: String? = null,
    val relations: List<BundleRelation> = emptyList(),
    val facts: List<BundleFact> = emptyList(),
    val evidence: BundleEvidence? = null,
    val parts: List<String> = emptyList(),
    val triangleCount: Int = 0,
    val bounds: BundleBounds? = null,
)

@Serializable
data class BundleMaterial(
    val id: String = "",
    val name: String = "",
    val color: String = "#cccccc",
    val opacity: Double? = null,
    val note: String? = null,
)

/** One entry of `scenes/index.json`: what the app offers on the start screen. */
@Serializable
data class SceneIndexEntry(
    val key: String = "",
    val title: String = "",
    val subtitle: String = "",
    val asset: String = "",
    val modelId: String = "",
    @SerialName("modelSchemaVersion") val modelSchemaVersion: String = "",
    val contentHash: String = "",
    val meshCount: Int = 0,
    val triangleCount: Int = 0,
    val objectCount: Int = 0,
)
