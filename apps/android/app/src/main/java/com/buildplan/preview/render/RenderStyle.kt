package com.buildplan.preview.render

import com.buildplan.preview.scene.BundleMaterial
import com.buildplan.preview.scene.GeometryPart
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
 * The two required styles.
 *
 * CONSTRUCTION keeps the distinctions the model actually makes — wall, finish
 * region, roof, glazing, frame, slab, stair, railing, chimney, balcony — and
 * prefers a model material's own colour where the model states one. CLAY
 * flattens every opaque surface to one neutral so the massing and the openings
 * read without colour noise; glazing stays readable because a house with
 * invisible windows is not a study of its mass.
 *
 * A line-study mode is deliberately absent rather than faked: it needs real
 * feature-edge geometry, which this bounded stage does not build.
 */
enum class RenderStyle(val label: String, val description: String) {
    CONSTRUCTION("Construction", "Model materials and part colours"),
    CLAY("Clay", "Uniform neutral surfaces, glazing still readable"),
    ;

    /**
     * The appearance of one primitive.
     *
     * `modelMaterial` is the material the model assigned to the object, when
     * it assigned one; the palette decides whether that colour is used, so a
     * window's glazing never gets painted with its wall's brick.
     */
    fun appearanceOf(part: GeometryPart, modelMaterial: BundleMaterial?): SurfaceAppearance {
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

/** The highlight of the selected object: an unmistakable emissive blue. */
object Selection {
    val EMISSIVE = floatArrayOf(0.13f, 0.42f, 0.95f)

    /** The colour of the box drawn around the selection. */
    val OUTLINE = floatArrayOf(0.62f, 0.82f, 1.0f, 0.95f)
}
