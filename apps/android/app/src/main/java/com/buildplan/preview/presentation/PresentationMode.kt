package com.buildplan.preview.presentation

import com.buildplan.preview.render.RenderStyle
import com.buildplan.preview.render.SurfaceAppearance
import com.buildplan.preview.scene.GeometryPart
import com.buildplan.preview.scene.ScenePart
import com.buildplan.preview.scene.SemanticGroup

/**
 * The three presentations the owner compares on one model.
 *
 * A mode is how the same uploaded building is drawn: material parameters,
 * light, post-processing, and which DERIVED overlays (feature edges, the roof
 * covering) are in the Filament scene. It never changes, hides or re-uploads
 * the compiled geometry, never changes which semantic objects are visible, and
 * never touches the model or the bundle. Switching it is a set of parameter
 * writes and entity adds/removes over buffers uploaded once per model.
 *
 * - [MODEL] is the presentation BuildApp had before this stage, unchanged,
 *   with its own Style menu (Construction, Clay, Architectural).
 * - [CLAY] is the architectural study model: a light neutral backdrop, a
 *   restrained monochrome value ladder, sun shadows and ambient occlusion,
 *   structural feature edges, and the roof covering.
 * - [LINE] is the line study: near-uniform surfaces under a soft light, no
 *   shadows, and every feature edge carrying the form.
 */
enum class PresentationMode(val label: String, val description: String) {
    MODEL("MODEL", "Current BuildApp presentation; the Style menu applies"),
    CLAY("CLAY", "Clay study: neutral values, shadows, structural edges, roof tiles"),
    LINE("LINE", "Line study: flat surfaces, every architectural edge, no shadows"),
    ;

    /** The edge tiers this mode inks. */
    val edgeTiers: Set<EdgeTier>
        get() = when (this) {
            MODEL -> emptySet()
            CLAY -> setOf(EdgeTier.STRUCTURAL)
            LINE -> setOf(EdgeTier.STRUCTURAL, EdgeTier.DETAIL)
        }

    /** Whether the roof covering is drawn. The line study keeps its surfaces plain. */
    val showsRoofCover: Boolean get() = this == CLAY

    /** Whether the Style menu (MODEL's palettes) applies. */
    val usesStyle: Boolean get() = this == MODEL

    /** The look of this mode for a given MODEL style. */
    fun look(style: RenderStyle): PresentationLook = when (this) {
        MODEL -> PresentationLook.model(style)
        CLAY -> PresentationLook.CLAY
        LINE -> PresentationLook.LINE
    }
}

/** Screen-space ambient occlusion settings; `null` on a look means off. */
data class AmbientOcclusion(val intensity: Float, val radius: Float, val power: Float)

/**
 * Everything a mode sets on the view, the lights and the overlays. Plain
 * numbers, so the choices are unit-testable and documented where they live.
 *
 * Colours marked linear are linear RGB, as Filament reads them. Every value
 * here is a PRESENTATION value, not a fact about a building.
 */
class PresentationLook(
    /** Skybox colour behind the model, linear. */
    val background: FloatArray,
    /** Sun illuminance, lux. */
    val sunLux: Float,
    /** Intensity of the spherical-harmonic ambient light. */
    val ambientIntensity: Float,
    val shadows: Boolean,
    val ambientOcclusion: AmbientOcclusion?,
    /** FXAA on top of MSAA: one-pixel lines need it; surfaces alone do not. */
    val fxaa: Boolean,
    /** The feature-edge ink, linear and PREMULTIPLIED, as transparent blending expects. */
    val edgeInk: FloatArray,
    /** The ink of the selected object's edges, linear and premultiplied. */
    val selectedEdgeInk: FloatArray,
    /**
     * The ground grid, linear RGBA as handed to the line material. MODEL keeps
     * the value the grid always had; the studies' values are premultiplied,
     * like their ink.
     */
    val grid: FloatArray,
    /**
     * How far lit surfaces are pushed behind themselves in depth so that the
     * edge drawn along them wins the depth test instead of tying with it.
     * Zero when nothing is inked.
     */
    val surfaceDepthOffset: Float,
    /** Whether glazing casts and receives shadows. MODEL keeps what it always did. */
    val glassShadows: Boolean,
) {
    companion object {
        /** The ground and backdrop of MODEL, exactly the values the viewer had before modes existed. */
        val MODEL_BACKGROUND = floatArrayOf(
            RenderStyle.srgbToLinear(0x12 / 255f),
            RenderStyle.srgbToLinear(0x15 / 255f),
            RenderStyle.srgbToLinear(0x1a / 255f),
        )
        val MODEL_GRID = floatArrayOf(
            RenderStyle.srgbToLinear(0.29f),
            RenderStyle.srgbToLinear(0.33f),
            RenderStyle.srgbToLinear(0.38f),
            0.55f,
        )
        const val MODEL_SUN_LUX = 72_000f
        const val MODEL_AMBIENT = 26_000f

        /** MODEL: the pre-existing presentation, per style. Nothing inked, glass as before. */
        fun model(style: RenderStyle) = PresentationLook(
            background = MODEL_BACKGROUND,
            sunLux = MODEL_SUN_LUX,
            ambientIntensity = MODEL_AMBIENT,
            shadows = true,
            ambientOcclusion = if (style.ambientOcclusion) AmbientOcclusion(style.ambientOcclusionIntensity, 0.35f, 1.0f) else null,
            fxaa = false,
            edgeInk = floatArrayOf(0f, 0f, 0f, 0f),
            selectedEdgeInk = floatArrayOf(0f, 0f, 0f, 0f),
            grid = MODEL_GRID,
            surfaceDepthOffset = 0f,
            glassShadows = true,
        )

        /**
         * CLAY. Backdrop, sun-to-ambient balance and occlusion radius,
         * intensity and power follow the donor viewer's clay study, which
         * was compared on a device there; occlusion stays at BuildApp's LOW
         * quality rather than the donor's HIGH, to keep the mobile cost.
         */
        val CLAY = PresentationLook(
            background = floatArrayOf(0.58f, 0.58f, 0.57f),
            sunLux = 90_000f,
            ambientIntensity = 48_000f,
            shadows = true,
            ambientOcclusion = AmbientOcclusion(intensity = 0.9f, radius = 0.45f, power = 1.2f),
            fxaa = true,
            edgeInk = premultiplied(0.05f, 0.055f, 0.06f, 0.70f),
            selectedEdgeInk = premultiplied(0.13f, 0.42f, 0.95f, 0.95f),
            grid = premultiplied(0.30f, 0.30f, 0.29f, 0.35f),
            surfaceDepthOffset = 1f,
            glassShadows = false,
        )

        /**
         * LINE. A light, paper-like backdrop; a weak sun under a strong soft
         * ambient so faces read almost uniform; no shadows or occlusion; dark
         * ink on every opaque edge. The donor's line study was dark; this one
         * keeps its principle (the edges carry the form) with less contrast.
         */
        val LINE = PresentationLook(
            background = floatArrayOf(RenderStyle.srgbToLinear(0.86f), RenderStyle.srgbToLinear(0.86f), RenderStyle.srgbToLinear(0.85f)),
            sunLux = 30_000f,
            ambientIntensity = 60_000f,
            shadows = false,
            ambientOcclusion = null,
            fxaa = true,
            edgeInk = premultiplied(0.02f, 0.022f, 0.026f, 0.88f),
            selectedEdgeInk = premultiplied(0.13f, 0.42f, 0.95f, 1.0f),
            grid = premultiplied(0.45f, 0.45f, 0.45f, 0.30f),
            surfaceDepthOffset = 1f,
            glassShadows = false,
        )

        fun premultiplied(r: Float, g: Float, b: Float, a: Float): FloatArray = floatArrayOf(r * a, g * a, b * a, a)
    }
}

/**
 * Surface appearances of the two study modes.
 *
 * Monochrome by intent: a value ladder over the bundle's semantic groups, so
 * main walls, roof, frames and slabs stay apart without a colour, and nothing
 * here names a building. Glazing is the one exception to opacity, and only in
 * opacity: a neutral sheet, premultiplied as Filament's transparent blending
 * expects, with no tint a source never stated.
 */
object StudyPalette {

    /** A slightly warm neutral, so the clay does not read as plastic. */
    private val WARM = floatArrayOf(1.0f, 0.985f, 0.955f)

    /** CLAY values (sRGB grey) per semantic group. */
    private val CLAY_VALUE: Map<SemanticGroup, Float> = mapOf(
        SemanticGroup.WALL_MAIN to 0.86f,
        SemanticGroup.WALL_INTERIOR to 0.84f,
        SemanticGroup.WALL_CLADDING to 0.80f,
        SemanticGroup.WALL_SECONDARY to 0.74f,
        SemanticGroup.ROOF_MAIN to 0.60f,
        SemanticGroup.FLAT_ROOF to 0.70f,
        SemanticGroup.ROOF_TRIM to 0.90f,
        SemanticGroup.WINDOW_FRAME to 0.40f,
        SemanticGroup.ROOFLIGHT to 0.40f,
        SemanticGroup.RAILING to 0.42f,
        SemanticGroup.DOOR to 0.60f,
        SemanticGroup.GARAGE_DOOR to 0.55f,
        SemanticGroup.SLAB to 0.80f,
        SemanticGroup.BALCONY_SLAB to 0.78f,
        SemanticGroup.TERRACE_SURFACE to 0.72f,
        SemanticGroup.STAIR to 0.80f,
        SemanticGroup.CHIMNEY to 0.70f,
        SemanticGroup.FACADE_FRAME to 0.82f,
        SemanticGroup.STRUCTURAL_MEMBER to 0.70f,
        SemanticGroup.PERGOLA_MEMBER to 0.72f,
        SemanticGroup.WINDOW_GLASS to 0.30f,
        SemanticGroup.ROOM to 0.55f,
        SemanticGroup.UNKNOWN_ASSEMBLY to 0.60f,
        SemanticGroup.OTHER to 0.80f,
    )

    /** The tiles, one step lighter than the roof plane under them. */
    const val CLAY_COVER_VALUE = 0.66f

    /** LINE keeps a whisper of the ladder, so a roof is not a wall even in a line drawing. */
    private fun lineValue(group: SemanticGroup): Float = when (group) {
        SemanticGroup.ROOF_MAIN, SemanticGroup.FLAT_ROOF -> 0.88f
        SemanticGroup.WINDOW_FRAME, SemanticGroup.ROOFLIGHT, SemanticGroup.RAILING -> 0.78f
        SemanticGroup.DOOR, SemanticGroup.GARAGE_DOOR -> 0.86f
        SemanticGroup.WINDOW_GLASS -> 0.55f
        else -> 0.95f
    }

    /** Opacity of glazing in the studies: seen at all on a light ground, and seen through. */
    const val CLAY_GLASS_ALPHA = 0.40f
    const val LINE_GLASS_ALPHA = 0.22f

    fun appearanceOf(mode: PresentationMode, part: ScenePart): SurfaceAppearance =
        appearanceOf(mode, part.part, part.semanticGroup)

    fun appearanceOf(mode: PresentationMode, part: GeometryPart, group: SemanticGroup): SurfaceAppearance {
        require(mode != PresentationMode.MODEL) { "MODEL is drawn by RenderStyle" }
        val clay = mode == PresentationMode.CLAY
        val value = if (clay) CLAY_VALUE[group] ?: 0.80f else lineValue(group)
        val translucent = part.isTranslucent
        val glass = translucent && group == SemanticGroup.WINDOW_GLASS
        val alpha = when {
            glass -> if (clay) CLAY_GLASS_ALPHA else LINE_GLASS_ALPHA
            translucent -> minOf(markerAlpha(group), if (clay) 0.5f else 0.3f)
            else -> 1f
        }
        val tint = if (translucent) floatArrayOf(1f, 1.02f, 1.06f) else WARM
        // Premultiplied for the translucent path; opaque alpha is 1, so the same arithmetic holds.
        return SurfaceAppearance(
            red = RenderStyle.srgbToLinear((value * tint[0]).coerceAtMost(1f)) * alpha,
            green = RenderStyle.srgbToLinear((value * tint[1]).coerceAtMost(1f)) * alpha,
            blue = RenderStyle.srgbToLinear((value * tint[2]).coerceAtMost(1f)) * alpha,
            alpha = alpha,
            roughness = when {
                glass -> 0.15f
                !clay -> 1.0f
                group == SemanticGroup.WINDOW_FRAME || group == SemanticGroup.RAILING || group == SemanticGroup.ROOFLIGHT -> 0.6f
                else -> 0.92f
            },
            metallic = 0f,
            reflectance = if (glass) 0.5f else if (clay) 0.3f else 0.1f,
        )
    }

    /** The covering's appearance: CLAY only. */
    fun coverAppearance(): SurfaceAppearance = SurfaceAppearance(
        red = RenderStyle.srgbToLinear(CLAY_COVER_VALUE * WARM[0]),
        green = RenderStyle.srgbToLinear(CLAY_COVER_VALUE * WARM[1]),
        blue = RenderStyle.srgbToLinear(CLAY_COVER_VALUE * WARM[2]),
        alpha = 1f,
        roughness = 0.85f,
        metallic = 0f,
        reflectance = 0.3f,
    )

    /** Diagnostic markers keep reading as markers: a floor zone faint, an unknown assembly clearer. */
    private fun markerAlpha(group: SemanticGroup): Float = when (group) {
        SemanticGroup.ROOM -> 0.18f
        SemanticGroup.UNKNOWN_ASSEMBLY -> 0.5f
        else -> 0.4f
    }
}
