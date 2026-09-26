package com.buildplan.preview.render

import com.buildplan.preview.scene.BundleGroupAppearance
import com.buildplan.preview.scene.BundleMaterial
import com.buildplan.preview.scene.BundleStyling
import com.buildplan.preview.scene.GeometryPart
import com.buildplan.preview.scene.ScenePart
import com.buildplan.preview.scene.SemanticGroup
import kotlin.math.pow

/**
 * How a surface looks. Pure data and arithmetic — no Filament — so the
 * palettes and the sRGB conversion are unit-testable.
 */
data class SurfaceAppearance(
    /** Linear RGB, ready for a Filament material parameter. */
    val red: Float,
    val green: Float,
    val blue: Float,
    val alpha: Float,
    val roughness: Float,
    val metallic: Float,
    val reflectance: Float = 0.35f,
) {
    val isTranslucent: Boolean get() = alpha < 0.999f
}

/**
 * The three styles. Construction and Clay are diagnostic; Architectural is the
 * one the owner reviews. None of them changes geometry: a style only sets
 * material parameters on primitives that were uploaded once.
 *
 * CONSTRUCTION keeps the distinctions the model actually makes — wall, finish
 * region, roof, trim, glazing, frame, slab, terrace, stair, railing, chimney,
 * balcony — and prefers a model material's own colour where the model states
 * one. CLAY flattens every opaque surface to one neutral so the massing and
 * the openings read without colour noise; glazing stays readable because a
 * house with invisible windows is not a study of its mass.
 *
 * ARCHITECTURAL colours each primitive by its SEMANTIC GROUP (main wall,
 * secondary wall, roof, flat roof, trim, glass, frame, slab, terrace, ...)
 * from the architectural palette: the bundle's own `styling.groups` when the
 * bundle carries them, else `ArchitecturalPalette.BUILT_IN`, a copy of the
 * same palette. The palette is a luminance ladder, so adjacent groups never
 * blend; edges read through that value contrast and the groups' roughness,
 * not through any screen-space pass. So this style draws no outline and runs
 * no ambient occlusion (`ambientOcclusion`), and it assigns no per-object
 * colour: nothing in it can hide a geometry defect or shimmer on a phone.
 *
 * The palette's `edge = "SOFT"` asks the web viewer for a thin feature-edge
 * line on structural groups. This renderer builds no feature-edge geometry,
 * so it reads the field and draws nothing for it.
 */
enum class RenderStyle(val label: String, val description: String) {
    CONSTRUCTION("Construction", "Model materials and part colours"),
    CLAY("Clay", "Uniform neutral surfaces, glazing still readable"),
    ARCHITECTURAL("Architectural", "Semantic groups, minimal palette"),
    ;

    /**
     * Whether the view runs Filament's screen-space ambient occlusion in this
     * style. Construction and Clay keep the contact darkening they have always
     * had; Architectural leaves it off and relies on value contrast alone.
     */
    val ambientOcclusion: Boolean get() = this != ARCHITECTURAL

    /**
     * The appearance of one uploaded primitive: its part, its semantic group
     * and the bundle's palette, for every style.
     */
    fun appearanceOf(part: ScenePart, modelMaterial: BundleMaterial?, styling: BundleStyling?): SurfaceAppearance =
        appearanceOf(part.part, modelMaterial, part.semanticGroup, part.rawSemanticGroup, styling)

    /**
     * The appearance of one primitive.
     *
     * `modelMaterial` is the material the model assigned to the object, when
     * it assigned one; the palette decides whether that colour is used, so a
     * window's glazing never gets painted with its wall's brick.
     *
     * `group`, `rawGroup` and `styling` matter to ARCHITECTURAL only. Without
     * them the group is derived from the part and the built-in palette is used.
     */
    fun appearanceOf(
        part: GeometryPart,
        modelMaterial: BundleMaterial?,
        group: SemanticGroup = SemanticGroup.derive(part),
        rawGroup: String? = null,
        styling: BundleStyling? = null,
    ): SurfaceAppearance {
        if (this == ARCHITECTURAL) return architectural(part, ArchitecturalPalette.appearanceOf(group, rawGroup, styling))
        val palette = PALETTE[part] ?: DEFAULT_ENTRY
        val useModelColour = this == CONSTRUCTION && palette.acceptsModelMaterial && modelMaterial != null
        val rgb = if (useModelColour) parseHexColor(modelMaterial.color) else if (this == CLAY && !part.isTranslucent) CLAY_RGB else palette.rgb
        val alpha = modelMaterial?.opacity?.toFloat().takeIf { useModelColour && it != null } ?: palette.alpha
        val roughness = if (this == CLAY && !part.isTranslucent) 0.95f else palette.roughness
        val metallic = if (this == CLAY && !part.isTranslucent) 0f else palette.metallic
        return SurfaceAppearance(
            red = srgbToLinear(rgb[0]),
            green = srgbToLinear(rgb[1]),
            blue = srgbToLinear(rgb[2]),
            alpha = alpha,
            roughness = roughness,
            metallic = metallic,
        )
    }

    /**
     * A group's appearance, on the material path its part was uploaded with.
     *
     * Opaque or translucent is decided per PART when the model is uploaded —
     * the same translucent path glazing has always used, so switching style
     * never re-uploads anything. A translucent part takes its group's opacity
     * (glass stays at the palette's 0.35); a translucent marker whose group is
     * opaque — a stair placeholder, a bars infill, which read as markers — keeps
     * the marker opacity it has in Construction. An opaque part is opaque. No
     * alpha drops below `MIN_ALPHA`, so no bundle value can make a surface
     * vanish.
     */
    private fun architectural(part: GeometryPart, group: BundleGroupAppearance): SurfaceAppearance {
        val rgb = parseHexColor(group.color)
        val alpha = if (part.isTranslucent) {
            (group.opacity?.toFloat() ?: PALETTE[part]?.alpha ?: 1f).coerceIn(MIN_ALPHA, 1f)
        } else {
            1f
        }
        return SurfaceAppearance(
            red = srgbToLinear(rgb[0]),
            green = srgbToLinear(rgb[1]),
            blue = srgbToLinear(rgb[2]),
            alpha = alpha,
            roughness = group.roughness.toFloat().coerceIn(0f, 1f),
            metallic = group.metalness.toFloat().coerceIn(0f, 1f),
        )
    }

    private data class Entry(
        val rgb: FloatArray,
        val alpha: Float = 1f,
        val roughness: Float = 0.9f,
        val metallic: Float = 0f,
        val acceptsModelMaterial: Boolean = false,
    )

    companion object {
        /** Neutral clay, warm enough not to read as plastic. */
        private val CLAY_RGB = floatArrayOf(0.835f, 0.812f, 0.776f)

        /** The floor under any translucent alpha: styling may soften a surface, never erase it. */
        const val MIN_ALPHA = 0.15f

        private val DEFAULT_ENTRY = Entry(floatArrayOf(0.70f, 0.70f, 0.70f))

        /**
         * The construction palette, kept in step with the web viewer's
         * `scene-adapter.ts` so that the same building reads the same way on a
         * phone and on a desktop.
         */
        private val PALETTE: Map<GeometryPart, Entry> = mapOf(
            GeometryPart.WALL to Entry(hex(0xcfc8bb), roughness = 0.95f, acceptsModelMaterial = true),
            GeometryPart.WALL_REVEAL to Entry(hex(0xbdb6a9), roughness = 0.95f, acceptsModelMaterial = true),
            GeometryPart.WINDOW_FRAME to Entry(hex(0x2c3036), roughness = 0.6f),
            GeometryPart.WINDOW_GLASS to Entry(hex(0x9ec7e6), alpha = 0.35f, roughness = 0.1f, metallic = 0.1f),
            GeometryPart.WINDOW_MULLION to Entry(hex(0x2c3036), roughness = 0.6f),
            GeometryPart.DOOR_FRAME to Entry(hex(0x2c3036), roughness = 0.6f),
            GeometryPart.DOOR_LEAF to Entry(hex(0x8a6a3d), roughness = 0.7f, acceptsModelMaterial = true),
            GeometryPart.DOOR_GLASS to Entry(hex(0x9ec7e6), alpha = 0.35f, roughness = 0.1f, metallic = 0.1f),
            GeometryPart.DOOR_PANEL to Entry(hex(0x3a3d42), roughness = 0.7f, acceptsModelMaterial = true),
            GeometryPart.DOOR_HANDLE to Entry(hex(0xb8b8b8), roughness = 0.3f, metallic = 0.8f),
            GeometryPart.SLAB to Entry(hex(0x9b9b98), roughness = 0.9f, acceptsModelMaterial = true),
            GeometryPart.ROOF to Entry(hex(0x6f4a3d), roughness = 0.9f, acceptsModelMaterial = true),
            GeometryPart.ROOF_REVEAL to Entry(hex(0x5e3f34), roughness = 0.9f, acceptsModelMaterial = true),
            GeometryPart.ROOFLIGHT_FRAME to Entry(hex(0x2c3036), roughness = 0.6f),
            GeometryPart.ROOFLIGHT_GLASS to Entry(hex(0x9ec7e6), alpha = 0.35f, roughness = 0.1f, metallic = 0.1f),
            GeometryPart.BALCONY to Entry(hex(0xa5a29b), roughness = 0.9f, acceptsModelMaterial = true),
            GeometryPart.RAILING_POST to Entry(hex(0x3a3d42), roughness = 0.5f, metallic = 0.6f),
            GeometryPart.RAILING_RAIL to Entry(hex(0x3a3d42), roughness = 0.5f, metallic = 0.6f),
            GeometryPart.RAILING_INFILL to Entry(hex(0x9ec7e6), alpha = 0.45f, roughness = 0.2f),
            GeometryPart.CHIMNEY to Entry(hex(0x9c5f4a), roughness = 0.9f, acceptsModelMaterial = true),
            GeometryPart.ROOM_FLOOR to Entry(hex(0x3fa7a0), alpha = 0.28f, roughness = 1f),
            GeometryPart.STAIR_PLACEHOLDER to Entry(hex(0xe0a24d), alpha = 0.5f, roughness = 1f),
            GeometryPart.STAIR_STEP to Entry(hex(0xb9b3a8), roughness = 0.9f, acceptsModelMaterial = true),
            GeometryPart.SURFACE_REGION to Entry(hex(0x9a7a4a), roughness = 0.85f, acceptsModelMaterial = true),
            GeometryPart.LINEAR_SOLID to Entry(hex(0xb0aaa0), roughness = 0.8f, acceptsModelMaterial = true),
            GeometryPart.TERRACE to Entry(hex(0x9d9488), roughness = 0.9f, acceptsModelMaterial = true),
            GeometryPart.ROOF_TRIM to Entry(hex(0xe9e4da), roughness = 0.85f, acceptsModelMaterial = true),
            GeometryPart.OTHER to DEFAULT_ENTRY,
        )

        private fun hex(rgb: Int): FloatArray = floatArrayOf(
            ((rgb shr 16) and 0xff) / 255f,
            ((rgb shr 8) and 0xff) / 255f,
            (rgb and 0xff) / 255f,
        )

        /** `#rrggbb` from a model material; unreadable text falls back to grey. */
        fun parseHexColor(text: String): FloatArray {
            val hex = text.removePrefix("#")
            if (hex.length != 6) return DEFAULT_ENTRY.rgb
            return try {
                hex(hex.toInt(16))
            } catch (e: NumberFormatException) {
                DEFAULT_ENTRY.rgb
            }
        }

        /**
         * sRGB to linear. Filament shades in linear space, so handing it an
         * sRGB value directly would wash every surface out.
         */
        fun srgbToLinear(c: Float): Float =
            if (c <= 0.04045f) c / 12.92f else ((c + 0.055f) / 1.055f).toDouble().pow(2.4).toFloat()
    }
}

/**
 * The architectural palette, `architectural-v1`.
 *
 * The bundle carries this palette in its `styling` block, and a bundle's own
 * value always wins: the phone draws what the exporter wrote. `BUILT_IN` is
 * the fallback for bundles exported before the block existed, and is a copy
 * of `ARCHITECTURAL_PALETTE` in `packages/mobile-scene/src/semantics.ts`,
 * value for value. Two tests hold the copy: `semantics.test.ts` on the
 * TypeScript side reads the lines below, and `ArchitecturalStyleTest` on this
 * side compares them with the shipped bundles and with that source file.
 *
 * The values are a ladder: a warm off-white main wall, a mid-grey secondary
 * body, a deep warm-grey roof, a lighter flat roof, trims one step lighter
 * than the walls, near-black frames, cool translucent glass, warm timber
 * doors, light concrete slabs, a darker stone terrace. Every pair of groups
 * that commonly meet differs in luminance, so adjacent elements never merge.
 */
object ArchitecturalPalette {
    const val ID = "architectural-v1"

    val BUILT_IN: Map<SemanticGroup, BundleGroupAppearance> = mapOf(
        SemanticGroup.WALL_MAIN to BundleGroupAppearance(color = "#e3ddd3", opacity = null, roughness = 0.95, metalness = 0.0, edge = "SOFT"),
        SemanticGroup.WALL_SECONDARY to BundleGroupAppearance(color = "#8f8b85", opacity = null, roughness = 0.95, metalness = 0.0, edge = "SOFT"),
        SemanticGroup.WALL_INTERIOR to BundleGroupAppearance(color = "#d3cec3", opacity = null, roughness = 0.95, metalness = 0.0, edge = "SOFT"),
        SemanticGroup.ROOF_MAIN to BundleGroupAppearance(color = "#423e3b", opacity = null, roughness = 0.85, metalness = 0.0, edge = "SOFT"),
        SemanticGroup.FLAT_ROOF to BundleGroupAppearance(color = "#69645f", opacity = null, roughness = 0.85, metalness = 0.0, edge = "SOFT"),
        SemanticGroup.ROOF_TRIM to BundleGroupAppearance(color = "#f3eee6", opacity = null, roughness = 0.85, metalness = 0.0, edge = "SOFT"),
        SemanticGroup.WINDOW_GLASS to BundleGroupAppearance(color = "#9ec0d6", opacity = 0.35, roughness = 0.12, metalness = 0.1, edge = "NONE"),
        SemanticGroup.WINDOW_FRAME to BundleGroupAppearance(color = "#272626", opacity = null, roughness = 0.55, metalness = 0.05, edge = "NONE"),
        SemanticGroup.DOOR to BundleGroupAppearance(color = "#8d6c46", opacity = null, roughness = 0.7, metalness = 0.0, edge = "NONE"),
        SemanticGroup.GARAGE_DOOR to BundleGroupAppearance(color = "#58595c", opacity = null, roughness = 0.6, metalness = 0.1, edge = "NONE"),
        SemanticGroup.SLAB to BundleGroupAppearance(color = "#c1beba", opacity = null, roughness = 0.9, metalness = 0.0, edge = "SOFT"),
        SemanticGroup.BALCONY_SLAB to BundleGroupAppearance(color = "#b5b0aa", opacity = null, roughness = 0.9, metalness = 0.0, edge = "SOFT"),
        SemanticGroup.RAILING to BundleGroupAppearance(color = "#3a3c3f", opacity = null, roughness = 0.5, metalness = 0.5, edge = "NONE"),
        SemanticGroup.FACADE_FRAME to BundleGroupAppearance(color = "#a7a197", opacity = null, roughness = 0.8, metalness = 0.0, edge = "SOFT"),
        SemanticGroup.TERRACE_SURFACE to BundleGroupAppearance(color = "#a49c92", opacity = null, roughness = 0.9, metalness = 0.0, edge = "SOFT"),
        SemanticGroup.CHIMNEY to BundleGroupAppearance(color = "#837671", opacity = null, roughness = 0.9, metalness = 0.0, edge = "SOFT"),
        SemanticGroup.ROOFLIGHT to BundleGroupAppearance(color = "#5e6166", opacity = null, roughness = 0.5, metalness = 0.2, edge = "NONE"),
        SemanticGroup.STAIR to BundleGroupAppearance(color = "#b2aca4", opacity = null, roughness = 0.9, metalness = 0.0, edge = "NONE"),
        SemanticGroup.ROOM to BundleGroupAppearance(color = "#8db1a8", opacity = 0.25, roughness = 1.0, metalness = 0.0, edge = "NONE"),
        SemanticGroup.OTHER to BundleGroupAppearance(color = "#b6b2ad", opacity = null, roughness = 0.9, metalness = 0.0, edge = "NONE"),
    )

    /**
     * The appearance of a group: the bundle's entry for the group exactly as
     * the bundle named it, then for the group this build resolved, then the
     * built-in copy.
     */
    fun appearanceOf(group: SemanticGroup, rawGroup: String? = null, styling: BundleStyling? = null): BundleGroupAppearance {
        val fromBundle = styling?.groups?.let { groups -> rawGroup?.let { groups[it] } ?: groups[group.name] }
        return fromBundle ?: BUILT_IN[group] ?: BUILT_IN.getValue(SemanticGroup.OTHER)
    }
}

/** The highlight of the selected object: an unmistakable emissive blue. */
object Selection {
    val EMISSIVE = floatArrayOf(0.13f, 0.42f, 0.95f)

    /** The colour of the box drawn around the selection. */
    val OUTLINE = floatArrayOf(0.62f, 0.82f, 1.0f, 0.95f)
}
