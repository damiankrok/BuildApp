package com.buildplan.preview.presentation

import com.buildplan.preview.render.RenderStyle
import com.buildplan.preview.render.SurfaceAppearance
import com.buildplan.preview.scene.BundleMaterial
import com.buildplan.preview.scene.BundleStyling
import com.buildplan.preview.scene.GeometryPart
import com.buildplan.preview.scene.ScenePart
import com.buildplan.preview.scene.SemanticGroup

/**
 * What a look is for, which is how the Wygląd pane groups them: the house as
 * a home, a study of its mass, or a technical reading.
 */
enum class LookFamily { HOME, STUDY, TECHNICAL }

/**
 * The presentations (looks) the owner compares on one model.
 *
 * A mode is how the same uploaded building is drawn: material parameters,
 * light, post-processing, and which DERIVED overlays (feature edges, the roof
 * covering, the ground sheet) are in the Filament scene. It never changes,
 * hides or re-uploads the compiled geometry, never changes which semantic
 * objects are visible, and never touches the model or the bundle. Switching
 * it is a set of parameter writes, material bindings and entity adds/removes
 * over buffers uploaded once per model.
 *
 * - [MODEL] is the presentation BuildApp had before this stage, unchanged,
 *   with its own Style menu (Construction, Clay, Architectural).
 * - [CLAY] is the architectural study model: a light neutral backdrop, a
 *   restrained monochrome value ladder, sun shadows and ambient occlusion,
 *   structural feature edges, and the roof covering.
 * - [LINE] is the line study: near-uniform surfaces under a soft light, no
 *   shadows, and every feature edge carrying the form.
 * - [COZY] is the house as a home: warm plaster, terracotta, timber, a soft
 *   warm sun and sky fill, gentle occlusion, the roof tiles, a warm ground.
 * - [DUSK] is the same home palette at dusk: a low warm sun under a cool sky,
 *   long shadows, and glazing that gives off a warm light.
 * - [SUNLIGHT] is for a phone read in daylight on the plot: a strong value
 *   ladder, black contours on every edge, saturated glazing.
 * - [TECHNICAL] is the dark technical view: graphite ground, cool restrained
 *   values, light contours on every edge, openings that read as openings.
 * - [XRAY] is the see-through shell: every surface translucent, every edge
 *   inked, so interior walls, rooms, stairs and storeys read through it and
 *   the presentation grid under the house stays in view.
 * - [BLUEPRINT] is the drawing on the sheet: light lines on navy, surfaces
 *   nearly the colour of the paper so that only the lines carry the form.
 *
 * Looks live in `HouseLooks.kt` (`HouseLooks` for light and ground,
 * `LookPalette` for the surfaces); MODEL, CLAY and LINE keep theirs here.
 */
enum class PresentationMode(val label: String, val description: String, val family: LookFamily) {
    MODEL("MODEL", "Current BuildApp presentation; the Style menu applies", LookFamily.HOME),
    CLAY("CLAY", "Clay study: neutral values, shadows, structural edges, roof tiles", LookFamily.STUDY),
    LINE("LINE", "Line study: flat surfaces, every architectural edge, no shadows", LookFamily.STUDY),
    COZY("COZY", "Home: warm plaster, terracotta and timber in a soft warm light", LookFamily.HOME),
    DUSK("DUSK", "The home palette at dusk: low warm sun, cool sky, lit windows", LookFamily.HOME),
    SUNLIGHT("SUNLIGHT", "Daylight on site: strong value ladder, black contours", LookFamily.STUDY),
    TECHNICAL("TECHNICAL", "Dark technical view: cool values, light contours, legible openings", LookFamily.TECHNICAL),
    XRAY("XRAY", "See-through shell: every edge, rooms and storeys read through", LookFamily.TECHNICAL),
    BLUEPRINT("BLUEPRINT", "Blueprint: light lines on navy, surfaces nearly vanish", LookFamily.TECHNICAL),
    ;

    /** The edge tiers this mode inks. */
    val edgeTiers: Set<EdgeTier>
        get() = when (this) {
            MODEL, DUSK -> emptySet()
            CLAY, COZY -> setOf(EdgeTier.STRUCTURAL)
            LINE, SUNLIGHT, TECHNICAL, XRAY, BLUEPRINT -> setOf(EdgeTier.STRUCTURAL, EdgeTier.DETAIL)
        }

    /** Whether the roof covering is drawn. Only the looks with a lit, opaque roof lay tiles. */
    val showsRoofCover: Boolean get() = this == CLAY || this == COZY || this == DUSK

    /** Whether the Style menu (MODEL's palettes) applies. */
    val usesStyle: Boolean get() = this == MODEL

    /**
     * Whether every surface is drawn on the translucent path. Only the X-ray
     * look: its opaque parts are bound to a translucent material instance
     * over the same buffers; every other look keeps the binding the part was
     * uploaded with.
     */
    val seeThrough: Boolean get() = this == XRAY

    /** The look of this mode for a given MODEL style. */
    fun look(style: RenderStyle): PresentationLook = when (this) {
        MODEL -> PresentationLook.model(style)
        CLAY -> PresentationLook.CLAY
        LINE -> PresentationLook.LINE
        COZY -> HouseLooks.COZY
        DUSK -> HouseLooks.DUSK
        SUNLIGHT -> HouseLooks.SUNLIGHT
        TECHNICAL -> HouseLooks.TECHNICAL
        XRAY -> HouseLooks.XRAY
        BLUEPRINT -> HouseLooks.BLUEPRINT
    }

    /**
     * The appearance of one uploaded primitive in this mode: MODEL reads the
     * style, the studies read [StudyPalette], the looks read [LookPalette].
     * The one dispatch the renderer, the evidence raster and the tests share.
     */
    fun appearanceOf(style: RenderStyle, part: ScenePart, modelMaterial: BundleMaterial?, styling: BundleStyling?): SurfaceAppearance = when (this) {
        MODEL -> style.appearanceOf(part, modelMaterial, styling)
        CLAY, LINE -> StudyPalette.appearanceOf(this, part)
        else -> LookPalette.appearanceOf(this, part)
    }

    /** The roof covering's appearance in this mode (drawn only where [showsRoofCover]). */
    fun coverAppearance(): SurfaceAppearance = if (this == COZY || this == DUSK) LookPalette.coverAppearance(this) else StudyPalette.coverAppearance()
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
    /** The sun's colour, linear RGB. Every look before the house looks keeps the viewer's original warm white. */
    val sunColor: FloatArray = SUN_COLOR,
    /** The sun's direction of travel (towards the ground), not normalised. */
    val sunDirection: FloatArray = SUN_DIRECTION,
    /**
     * A per-channel tint of the sky fill (the spherical-harmonic ambient):
     * warm for a home in the afternoon, cool for dusk. Neutral leaves the
     * harmonics exactly as the viewer always had them.
     */
    val ambientTint: FloatArray = NEUTRAL_TINT,
    /**
     * The colour of the ground sheet under the house, linear RGB, or null for
     * no sheet. The sheet is presentation, like the grid: it is derived from
     * the model's bounds, has no object id, answers no pick and catches the
     * sun's shadow so the house stands on something.
     */
    val ground: FloatArray? = null,
) {
    /**
     * The ambient light's nine RGB spherical-harmonic coefficients, as
     * `IndirectLight.Builder.irradiance(3, ...)` takes them: the viewer's calm
     * sky (a constant and a brighter-from-above vertical term), tinted.
     */
    fun harmonics(): FloatArray {
        val sh = FloatArray(27)
        for (c in 0 until 3) {
            sh[c] = BASE_SKY[c] * ambientTint[c]
            sh[3 + c] = BASE_SKY_FROM_ABOVE[c] * ambientTint[c]
        }
        return sh
    }

    companion object {
        /** The sun every look had before the house looks: a warm white from the front left. */
        val SUN_COLOR = floatArrayOf(1.0f, 0.96f, 0.90f)
        val SUN_DIRECTION = floatArrayOf(0.45f, -0.82f, -0.35f)
        val NEUTRAL_TINT = floatArrayOf(1f, 1f, 1f)

        /** The sky fill's constant term, slightly cool, and its vertical term: brighter from above. */
        private val BASE_SKY = floatArrayOf(0.55f, 0.58f, 0.64f)
        private val BASE_SKY_FROM_ABOVE = floatArrayOf(0.20f, 0.21f, 0.24f)

        /**
         * The ground and backdrop of MODEL: a calm mid graphite (OWNER, variant C), a step lighter than the
         * app's own ground, so the smoky glass over it reads as a material and not as a hole. Until APK 1355
         * it was #12151A, the darkest thing on screen; only the backdrop moved — the house's light, shadows
         * and materials are exactly as before.
         */
        val MODEL_BACKGROUND = floatArrayOf(
            RenderStyle.srgbToLinear(0x1E / 255f),
            RenderStyle.srgbToLinear(0x23 / 255f),
            RenderStyle.srgbToLinear(0x29 / 255f),
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
