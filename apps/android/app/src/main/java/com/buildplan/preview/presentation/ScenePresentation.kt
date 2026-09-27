package com.buildplan.preview.presentation

import com.buildplan.preview.scene.ModelScene

/**
 * Everything the study modes draw on top of one model, derived once when the
 * model is uploaded and discarded with it.
 *
 * Built from the scene and nothing else, so two loads of the same bundle give
 * the same presentation, and no presentation data ever flows back: the scene,
 * its bundle and the model it was compiled from are exactly what they were.
 * A mode switch afterwards only chooses which of these are on screen.
 */
class ScenePresentation private constructor(
    val edges: FeatureEdgeSet,
    val roofCovers: List<RoofCoverBatch>,
    /** Milliseconds spent deriving the edges and the covering on this device. */
    val buildMillis: Long,
) {
    val coverByObject: Map<String, RoofCoverBatch> = roofCovers.associateBy { it.objectId }

    /** What the study overlays cost, next to the model they decorate. */
    fun stats(scene: ModelScene): PresentationStats = PresentationStats(
        modelTriangles = scene.objects.sumOf { it.triangleCount },
        modelObjects = scene.objects.size,
        modelEntities = scene.objects.count { it.hasGeometry },
        splitGlazingEntities = scene.objects.count { o -> o.parts.any { it.part.isTranslucent } && o.parts.any { !it.part.isTranslucent } },
        edgeGroups = edges.groups.size,
        mergedEdgeGroups = edges.merged.size,
        edgeSegments = edges.segmentCount,
        sharedEdgeGroups = edges.groups.count { it.isShared },
        coverBatches = roofCovers.size,
        coverTiles = roofCovers.sumOf { it.tileCount },
        coverTriangles = roofCovers.sumOf { it.triangleCount },
        coverVertices = roofCovers.sumOf { it.vertexCount },
        edgeClasses = edges.counts,
        modelBufferBytes = scene.objects.sumOf { o -> o.vertexCount.toLong() * (VERTEX_BYTES + INDEX_BYTES) },
        coverBufferBytes = roofCovers.sumOf { c -> c.vertexCount.toLong() * VERTEX_BYTES + c.indices.size.toLong() * INDEX_BYTES },
        // Each segment's two ends, position and index, uploaded twice: in its class batch and in its object's group.
        edgeBufferBytes = 2L * edges.segmentCount * 2 * (POSITION_BYTES + INDEX_BYTES),
    )

    companion object {
        /** Position (3 floats) and tangent quaternion (4 floats) per vertex, as uploaded. */
        private const val VERTEX_BYTES = 28L
        private const val POSITION_BYTES = 12L
        private const val INDEX_BYTES = 4L

        fun of(scene: ModelScene, spec: RoofCoverSpec = RoofCoverSpec.DEFAULT): ScenePresentation {
            val started = System.nanoTime()
            val edges = FeatureEdges.of(scene)
            val covers = RoofCover.of(scene, spec)
            return ScenePresentation(edges, covers, (System.nanoTime() - started) / 1_000_000)
        }
    }
}

/** Counts that say whether the overlays keep a phone comfortable. */
data class PresentationStats(
    val modelTriangles: Int,
    val modelObjects: Int,
    /** Renderables before this stage: one per object with geometry. */
    val modelEntities: Int,
    /** Objects with glazing AND opaque parts: their glazing now has its own renderable, so it can stop casting shadows. */
    val splitGlazingEntities: Int,
    /** Per-object line groups: uploaded, drawn only when a class is not shown whole (isolation, selection). */
    val edgeGroups: Int,
    /** Class batches: what a layer mode actually draws. */
    val mergedEdgeGroups: Int,
    val edgeSegments: Int,
    val sharedEdgeGroups: Int,
    val coverBatches: Int,
    val coverTiles: Int,
    val coverTriangles: Int,
    val coverVertices: Int,
    val edgeClasses: Map<EdgeClass, Int>,
    /** Vertex and index bytes of the model's own surfaces, as uploaded before this stage. */
    val modelBufferBytes: Long,
    /** Added by the roof covering. */
    val coverBufferBytes: Long,
    /** Added by the feature edges. */
    val edgeBufferBytes: Long,
) {
    /** Renderables uploaded with this stage: surfaces, split glazing, both kinds of edge group, cover batches. */
    val uploadedEntities: Int get() = modelEntities + splitGlazingEntities + edgeGroups + mergedEdgeGroups + coverBatches

    /** At most this many renderables are in the scene with every layer shown and nothing selected. */
    val drawnEntitiesWholeModel: Int get() = modelEntities + splitGlazingEntities + mergedEdgeGroups + coverBatches
}
