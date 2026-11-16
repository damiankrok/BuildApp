package com.buildplan.preview.presentation

import com.buildplan.preview.render.RenderStyle
import com.buildplan.preview.render.SurfaceAppearance
import com.buildplan.preview.scene.GeometryPart
import com.buildplan.preview.scene.ScenePart
import com.buildplan.preview.scene.SemanticGroup

/**
 * The light, backdrop, ink and ground of the house looks (COZY, DUSK,
 * SUNLIGHT, TECHNICAL, XRAY, BLUEPRINT). Plain numbers, like the studies'
 * looks beside `PresentationMode`: every value is a PRESENTATION value, never
 * a fact about a building, and none of them names one.
 *
 * Colours are written as sRGB hex, the way a designer reads them, and handed
 * to Filament in linear space; inks are premultiplied, as the transparent
 * line material expects. The camera's exposure is the viewer's fixed daylight
 * exposure in every look, so a darker look is darker light, not a different
 * camera.
 */
object HouseLooks {

    /** The selection's contour: the viewer's selection blue, at full strength. */
    private val SELECTED_INK = PresentationLook.premultiplied(0.13f, 0.42f, 0.95f, 1.0f)

    /**
     * COZY: the house as a home. A warm sand backdrop a step darker than the
     * plaster so the walls keep their silhouette, a warm earth ground sheet
     * that takes the shadow, a lower, warmer sun than MODEL's and a warm sky
     * fill, occlusion that is wider and gentler than the studies' (a soft
     * contact, not a crease), and only a whisper of warm brown on the
     * structural edges, the way an illustrator's pen line reads.
     */
    val COZY = PresentationLook(
        background = linear(0xd4c5b0),
        sunLux = 64_000f,
        ambientIntensity = 30_000f,
        shadows = true,
        ambientOcclusion = AmbientOcclusion(intensity = 0.45f, radius = 0.7f, power = 0.8f),
        fxaa = true,
        edgeInk = PresentationLook.premultiplied(0.07f, 0.04f, 0.025f, 0.32f),
        selectedEdgeInk = SELECTED_INK,
        grid = PresentationLook.premultiplied(0.32f, 0.22f, 0.14f, 0.18f),
        surfaceDepthOffset = 1f,
        glassShadows = false,
        sunColor = floatArrayOf(1.0f, 0.88f, 0.72f),
        sunDirection = floatArrayOf(0.50f, -0.70f, -0.51f),
        ambientTint = floatArrayOf(1.0f, 0.95f, 0.86f),
        ground = linear(0xae9a80),
    )

    /**
     * DUSK: the COZY palette an hour later. A deep twilight backdrop, a low
     * orange sun throwing long shadows, a cool blue sky fill, a dark ground,
     * no ink (the silhouette against the sky is the drawing) and glazing that
     * gives off a warm light. The light in the windows is an appearance of
     * the glazing part, every pane alike: it says nothing about who is home.
     */
    val DUSK = PresentationLook(
        background = linear(0x1d2440),
        sunLux = 20_000f,
        ambientIntensity = 14_000f,
        shadows = true,
        ambientOcclusion = AmbientOcclusion(intensity = 0.5f, radius = 0.6f, power = 1.0f),
        fxaa = false,
        edgeInk = floatArrayOf(0f, 0f, 0f, 0f),
        selectedEdgeInk = SELECTED_INK,
        grid = PresentationLook.premultiplied(0.30f, 0.36f, 0.55f, 0.14f),
        surfaceDepthOffset = 0f,
        glassShadows = false,
        sunColor = floatArrayOf(1.0f, 0.58f, 0.32f),
        sunDirection = floatArrayOf(0.75f, -0.28f, -0.60f),
        ambientTint = floatArrayOf(0.55f, 0.65f, 1.0f),
        ground = linear(0x3b3a3f),
    )

    /**
     * SUNLIGHT: a phone read on the plot at noon. Glare flattens colour
     * first and value last, so the look is a value ladder (white walls, black
     * roof, black frames, saturated blue glazing) under a strong sun, with
     * black ink on every edge and a light ground sheet that takes a crisp
     * shadow. A mid-grey backdrop keeps the white walls' silhouette.
     */
    val SUNLIGHT = PresentationLook(
        background = linear(0xa7adb2),
        sunLux = 90_000f,
        ambientIntensity = 34_000f,
        shadows = true,
        ambientOcclusion = AmbientOcclusion(intensity = 0.6f, radius = 0.4f, power = 1.0f),
        fxaa = true,
        edgeInk = PresentationLook.premultiplied(0.0f, 0.0f, 0.0f, 0.95f),
        selectedEdgeInk = PresentationLook.premultiplied(0.05f, 0.30f, 0.95f, 1.0f),
        grid = PresentationLook.premultiplied(0.12f, 0.12f, 0.12f, 0.30f),
        surfaceDepthOffset = 1f,
        glassShadows = false,
        sunColor = floatArrayOf(1.0f, 0.98f, 0.95f),
        ground = linear(0xbfc3c6),
    )

    /**
     * TECHNICAL: the dark technical view the Master Plan asks for. A
     * graphite-navy backdrop, a neutral light with a strong fill and no cast
     * shadow (nothing on the facade that is not geometry), light cool ink on
     * every edge, the grid in view.
     */
    val TECHNICAL = PresentationLook(
        background = linear(0x0b0f14),
        sunLux = 46_000f,
        ambientIntensity = 42_000f,
        shadows = false,
        ambientOcclusion = AmbientOcclusion(intensity = 0.3f, radius = 0.3f, power = 1.0f),
        fxaa = true,
        edgeInk = PresentationLook.premultiplied(0.72f, 0.82f, 0.92f, 0.85f),
        selectedEdgeInk = SELECTED_INK,
        grid = PresentationLook.premultiplied(0.18f, 0.24f, 0.30f, 0.45f),
        surfaceDepthOffset = 1f,
        glassShadows = false,
        sunColor = floatArrayOf(0.96f, 0.98f, 1.0f),
        ambientTint = floatArrayOf(0.94f, 0.98f, 1.0f),
    )

    /**
     * XRAY: the see-through shell. Near-black backdrop, an almost shadowless
     * flat light (a translucent surface has nothing to shade), no shadow and
     * no occlusion (neither reads through glass), every edge inked in a light
     * cool line, and the grid clearly in view under the house. The surfaces
     * write no depth, so every edge — the far wall's, the interior wall's,
     * the stair's — is drawn: that is what X-ray means.
     */
    val XRAY = PresentationLook(
        background = linear(0x090c11),
        sunLux = 16_000f,
        ambientIntensity = 56_000f,
        shadows = false,
        ambientOcclusion = null,
        fxaa = true,
        edgeInk = PresentationLook.premultiplied(0.62f, 0.76f, 0.88f, 0.70f),
        selectedEdgeInk = SELECTED_INK,
        grid = PresentationLook.premultiplied(0.30f, 0.40f, 0.50f, 0.50f),
        surfaceDepthOffset = 0f,
        glassShadows = false,
        sunColor = floatArrayOf(1.0f, 1.0f, 1.0f),
        ambientTint = floatArrayOf(0.95f, 0.98f, 1.0f),
    )

    /**
     * BLUEPRINT: the drawing builders carried on site (światłokopia). A navy
     * sheet, a flat light so the surfaces sit just above the paper and hide
     * the lines behind them, light cyan ink on every edge and a light grid.
     * The selection's contour is white: the viewer's blue would vanish into
     * the sheet.
     */
    val BLUEPRINT = PresentationLook(
        background = linear(0x143f78),
        sunLux = 14_000f,
        ambientIntensity = 60_000f,
        shadows = false,
        ambientOcclusion = null,
        fxaa = true,
        edgeInk = PresentationLook.premultiplied(0.55f, 0.80f, 1.0f, 0.88f),
        selectedEdgeInk = PresentationLook.premultiplied(1.0f, 1.0f, 1.0f, 1.0f),
        grid = PresentationLook.premultiplied(0.45f, 0.65f, 0.90f, 0.28f),
        surfaceDepthOffset = 1f,
        glassShadows = false,
        sunColor = floatArrayOf(1.0f, 1.0f, 1.0f),
        ambientTint = floatArrayOf(0.90f, 0.95f, 1.0f),
    )

    /** `0xrrggbb` (sRGB) to linear RGB. */
    fun linear(rgb: Int): FloatArray = floatArrayOf(
        RenderStyle.srgbToLinear(((rgb shr 16) and 0xff) / 255f),
        RenderStyle.srgbToLinear(((rgb shr 8) and 0xff) / 255f),
        RenderStyle.srgbToLinear((rgb and 0xff) / 255f),
    )
}

/**
 * Surface appearances of the house looks, per SEMANTIC GROUP, like the
 * architectural palette: what a person tells apart on a drawing stays apart
 * on screen, and no colour belongs to an object. The model's own material
 * colours are not read: a look is the same look on every house.
 *
 * A group's swatch is used on the part's own material path. An opaque part is
 * opaque in every look but X-ray; a translucent part (glazing, a marker)
 * keeps its swatch's opacity, or a marker opacity when its group is opaque in
 * the look (a stair placeholder, a bars infill). In X-ray every part takes
 * its swatch's opacity, floored at [XRAY_MIN_ALPHA]. Translucent colours are
 * premultiplied, as Filament's transparent blending expects.
 */
object LookPalette {

    /** The floor under any X-ray opacity: faint, never gone. Its edges carry it the rest of the way. */
    const val XRAY_MIN_ALPHA = 0.05f

    /** A translucent part whose group is opaque in the look reads as a marker at this opacity. */
    const val MARKER_ALPHA = 0.4f

    /** The warm light DUSK's glazing gives off, linear. */
    val DUSK_WINDOW_GLOW = floatArrayOf(0.90f, 0.52f, 0.18f)

    /** One group's surface in one look: sRGB colour, opacity (1 = opaque in the look), surface response, glow. */
    class Swatch(
        val rgb: Int,
        val alpha: Float = 1f,
        val roughness: Float = 0.9f,
        val metallic: Float = 0f,
        val reflectance: Float = 0.3f,
        val glow: FloatArray? = null,
    )

    private fun glass(rgb: Int, alpha: Float, glow: FloatArray? = null) =
        Swatch(rgb, alpha = alpha, roughness = 0.12f, metallic = 0.05f, reflectance = 0.5f, glow = glow)

    /**
     * COZY and DUSK. Warm off-white plaster, a warm stone secondary body,
     * terracotta roof one value below a cream trim, walnut frames, oak doors,
     * a timber deck and pergola, a dark brick chimney below the roof's value,
     * glazing that reflects a soft sky.
     */
    val HOME: Map<SemanticGroup, Swatch> = mapOf(
        SemanticGroup.WALL_MAIN to Swatch(0xefe5d6, roughness = 0.95f),
        SemanticGroup.WALL_SECONDARY to Swatch(0xc8b49c, roughness = 0.95f),
        SemanticGroup.WALL_INTERIOR to Swatch(0xebe0cf, roughness = 0.95f),
        SemanticGroup.WALL_CLADDING to Swatch(0xb8875a, roughness = 0.75f),
        SemanticGroup.ROOF_MAIN to Swatch(0x985440, roughness = 0.85f),
        SemanticGroup.FLAT_ROOF to Swatch(0x8b7867, roughness = 0.9f),
        SemanticGroup.ROOF_TRIM to Swatch(0xf5ede1, roughness = 0.85f),
        SemanticGroup.WINDOW_GLASS to glass(0xa9c4cf, alpha = 0.40f),
        SemanticGroup.WINDOW_FRAME to Swatch(0x4e3a2d, roughness = 0.6f),
        SemanticGroup.DOOR to Swatch(0x8c5a33, roughness = 0.7f),
        SemanticGroup.GARAGE_DOOR to Swatch(0xa3825f, roughness = 0.7f),
        SemanticGroup.SLAB to Swatch(0xd6c9b6),
        SemanticGroup.BALCONY_SLAB to Swatch(0xcbbca7),
        SemanticGroup.RAILING to Swatch(0x3f3229, roughness = 0.5f, metallic = 0.3f),
        SemanticGroup.FACADE_FRAME to Swatch(0xe4d6c2, roughness = 0.85f),
        SemanticGroup.TERRACE_SURFACE to Swatch(0xa9845f, roughness = 0.8f),
        SemanticGroup.CHIMNEY to Swatch(0x6f3b2b),
        SemanticGroup.ROOFLIGHT to Swatch(0x4e3a2d, roughness = 0.6f),
        SemanticGroup.STAIR to Swatch(0xc49f74, roughness = 0.8f),
        SemanticGroup.ROOM to Swatch(0xe3b679, alpha = 0.20f, roughness = 1f),
        SemanticGroup.STRUCTURAL_MEMBER to Swatch(0xa4876a, roughness = 0.8f),
        SemanticGroup.PERGOLA_MEMBER to Swatch(0xad794b, roughness = 0.8f),
        SemanticGroup.UNKNOWN_ASSEMBLY to Swatch(0x9b8e7f, alpha = 0.5f),
        SemanticGroup.OTHER to Swatch(0xd3c5b2),
    )

    /** The tiles over a HOME roof plane: one step lighter terracotta. */
    const val HOME_COVER = 0xa86048

    /** DUSK's glazing: a warm pane, nearly opaque, so the glow is what reads. */
    private val DUSK_GLASS = glass(0xc98a4a, alpha = 0.80f, glow = DUSK_WINDOW_GLOW)

    /**
     * SUNLIGHT. A value ladder that survives glare: white walls, black roof
     * and frames, mid-grey trims and slabs, saturated timber and glazing.
     */
    val SUNLIGHT: Map<SemanticGroup, Swatch> = mapOf(
        SemanticGroup.WALL_MAIN to Swatch(0xf7f7f5, roughness = 0.95f),
        SemanticGroup.WALL_SECONDARY to Swatch(0xa6a6a2, roughness = 0.95f),
        SemanticGroup.WALL_INTERIOR to Swatch(0xe8e8e5, roughness = 0.95f),
        SemanticGroup.WALL_CLADDING to Swatch(0xc98a4b, roughness = 0.8f),
        SemanticGroup.ROOF_MAIN to Swatch(0x262626, roughness = 0.85f),
        SemanticGroup.FLAT_ROOF to Swatch(0x4a4a4a, roughness = 0.85f),
        SemanticGroup.ROOF_TRIM to Swatch(0x8a8a87, roughness = 0.85f),
        SemanticGroup.WINDOW_GLASS to glass(0x1f78d1, alpha = 0.75f),
        SemanticGroup.WINDOW_FRAME to Swatch(0x111111, roughness = 0.6f),
        SemanticGroup.DOOR to Swatch(0x7a3f12, roughness = 0.7f),
        SemanticGroup.GARAGE_DOOR to Swatch(0x5a5a5a, roughness = 0.6f),
        SemanticGroup.SLAB to Swatch(0xbdbdb9),
        SemanticGroup.BALCONY_SLAB to Swatch(0xb0b0ac),
        SemanticGroup.RAILING to Swatch(0x111111, roughness = 0.5f, metallic = 0.3f),
        SemanticGroup.FACADE_FRAME to Swatch(0x8a8a87, roughness = 0.8f),
        SemanticGroup.TERRACE_SURFACE to Swatch(0x7d7d79),
        SemanticGroup.CHIMNEY to Swatch(0x6b6b68),
        SemanticGroup.ROOFLIGHT to Swatch(0x111111, roughness = 0.6f),
        SemanticGroup.STAIR to Swatch(0xc9c9c5),
        SemanticGroup.ROOM to Swatch(0x2aa38f, alpha = 0.30f, roughness = 1f),
        SemanticGroup.STRUCTURAL_MEMBER to Swatch(0x6b6b68, roughness = 0.8f),
        SemanticGroup.PERGOLA_MEMBER to Swatch(0xa86a32, roughness = 0.8f),
        SemanticGroup.UNKNOWN_ASSEMBLY to Swatch(0x7b61d1, alpha = 0.55f),
        SemanticGroup.OTHER to Swatch(0xc4c4c0),
    )

    /**
     * TECHNICAL. Restrained cool greys on a value ladder: mid walls, a dark
     * slate roof, lighter slabs so the storeys read, light frames around a
     * clear cyan glazing so every opening reads as one, darker door panels.
     * The glazing gives off a faint cool light so an opening on the shaded
     * side still reads.
     */
    val TECHNICAL: Map<SemanticGroup, Swatch> = mapOf(
        SemanticGroup.WALL_MAIN to Swatch(0x7b8792),
        SemanticGroup.WALL_SECONDARY to Swatch(0x5f6b77),
        SemanticGroup.WALL_INTERIOR to Swatch(0x8e99a4),
        SemanticGroup.WALL_CLADDING to Swatch(0x98a6b5, roughness = 0.8f),
        SemanticGroup.ROOF_MAIN to Swatch(0x3a434d, roughness = 0.85f),
        SemanticGroup.FLAT_ROOF to Swatch(0x4d5761, roughness = 0.85f),
        SemanticGroup.ROOF_TRIM to Swatch(0xa9b4be, roughness = 0.85f),
        SemanticGroup.WINDOW_GLASS to glass(0x6fc6ee, alpha = 0.55f, glow = floatArrayOf(0.02f, 0.07f, 0.11f)),
        SemanticGroup.WINDOW_FRAME to Swatch(0xd3dbe3, roughness = 0.6f),
        SemanticGroup.DOOR to Swatch(0x4a5560, roughness = 0.7f),
        SemanticGroup.GARAGE_DOOR to Swatch(0x535e69, roughness = 0.6f),
        SemanticGroup.SLAB to Swatch(0xa4afba),
        SemanticGroup.BALCONY_SLAB to Swatch(0x98a3ae),
        SemanticGroup.RAILING to Swatch(0xc3ccd5, roughness = 0.5f, metallic = 0.3f),
        SemanticGroup.FACADE_FRAME to Swatch(0x95a1ac, roughness = 0.8f),
        SemanticGroup.TERRACE_SURFACE to Swatch(0x4f5964),
        SemanticGroup.CHIMNEY to Swatch(0x5a6570),
        SemanticGroup.ROOFLIGHT to Swatch(0xc3ccd5, roughness = 0.6f),
        SemanticGroup.STAIR to Swatch(0x9ea9b4),
        SemanticGroup.ROOM to Swatch(0x4fb8ad, alpha = 0.22f, roughness = 1f),
        SemanticGroup.STRUCTURAL_MEMBER to Swatch(0x87939e, roughness = 0.8f),
        SemanticGroup.PERGOLA_MEMBER to Swatch(0x8b97a2, roughness = 0.8f),
        SemanticGroup.UNKNOWN_ASSEMBLY to Swatch(0x8c7fd0, alpha = 0.5f),
        SemanticGroup.OTHER to Swatch(0x7f8a95),
    )

    /**
     * XRAY. Every surface faint and near-neutral, the shell fainter than the
     * partitions inside it and the roof faintest of all, so the interior is
     * what reads; then three accents a person looks for through a house:
     * glazing in a clear cyan that also gives off a little light (an opening
     * stays an opening seen through two walls), rooms as teal floor zones,
     * and the circulation — doors and stairs — in a warm salmon, never the
     * rule's yellow, which means progress.
     */
    val XRAY: Map<SemanticGroup, Swatch> = mapOf(
        SemanticGroup.WALL_MAIN to Swatch(0xc9d6e2, alpha = 0.09f, roughness = 1f),
        SemanticGroup.WALL_SECONDARY to Swatch(0xb7c4d0, alpha = 0.09f, roughness = 1f),
        SemanticGroup.WALL_INTERIOR to Swatch(0xe4ecf4, alpha = 0.14f, roughness = 1f),
        SemanticGroup.WALL_CLADDING to Swatch(0xc9d6e2, alpha = 0.09f, roughness = 1f),
        SemanticGroup.ROOF_MAIN to Swatch(0x8fa3b6, alpha = 0.05f, roughness = 1f),
        SemanticGroup.FLAT_ROOF to Swatch(0x8fa3b6, alpha = 0.06f, roughness = 1f),
        SemanticGroup.ROOF_TRIM to Swatch(0xc9d6e2, alpha = 0.10f, roughness = 1f),
        SemanticGroup.WINDOW_GLASS to glass(0x39b8ff, alpha = 0.42f, glow = floatArrayOf(0.03f, 0.14f, 0.26f)),
        SemanticGroup.WINDOW_FRAME to Swatch(0xe6eef6, alpha = 0.30f, roughness = 1f),
        SemanticGroup.DOOR to Swatch(0xe8a882, alpha = 0.28f, roughness = 1f),
        SemanticGroup.GARAGE_DOOR to Swatch(0xd99b78, alpha = 0.20f, roughness = 1f),
        SemanticGroup.SLAB to Swatch(0x9fb2c4, alpha = 0.08f, roughness = 1f),
        SemanticGroup.BALCONY_SLAB to Swatch(0x9fb2c4, alpha = 0.08f, roughness = 1f),
        SemanticGroup.RAILING to Swatch(0xe6eef6, alpha = 0.25f, roughness = 1f),
        SemanticGroup.FACADE_FRAME to Swatch(0xc9d6e2, alpha = 0.12f, roughness = 1f),
        SemanticGroup.TERRACE_SURFACE to Swatch(0x8a9aab, alpha = 0.08f, roughness = 1f),
        SemanticGroup.CHIMNEY to Swatch(0xc9d6e2, alpha = 0.12f, roughness = 1f),
        SemanticGroup.ROOFLIGHT to Swatch(0xe6eef6, alpha = 0.30f, roughness = 1f),
        SemanticGroup.STAIR to Swatch(0xf09a6b, alpha = 0.32f, roughness = 1f),
        SemanticGroup.ROOM to Swatch(0x34d1a6, alpha = 0.20f, roughness = 1f),
        SemanticGroup.STRUCTURAL_MEMBER to Swatch(0xc9d6e2, alpha = 0.16f, roughness = 1f),
        SemanticGroup.PERGOLA_MEMBER to Swatch(0xc9d6e2, alpha = 0.14f, roughness = 1f),
        SemanticGroup.UNKNOWN_ASSEMBLY to Swatch(0x9f8cff, alpha = 0.30f, roughness = 1f),
        SemanticGroup.OTHER to Swatch(0xc9d6e2, alpha = 0.08f, roughness = 1f),
    )

    /**
     * BLUEPRINT. Surfaces a shade above the navy sheet, so a face hides the
     * lines behind it and the drawing stays legible; a roof a shade below the
     * walls, slabs a shade above; pale glazing, so an opening is still an
     * opening between the lines.
     */
    val BLUEPRINT: Map<SemanticGroup, Swatch> = mapOf(
        SemanticGroup.WALL_MAIN to Swatch(0x1a4884, roughness = 1f, reflectance = 0.1f),
        SemanticGroup.WALL_SECONDARY to Swatch(0x174380, roughness = 1f, reflectance = 0.1f),
        SemanticGroup.WALL_INTERIOR to Swatch(0x1d4c88, roughness = 1f, reflectance = 0.1f),
        SemanticGroup.WALL_CLADDING to Swatch(0x174380, roughness = 1f, reflectance = 0.1f),
        SemanticGroup.ROOF_MAIN to Swatch(0x153d72, roughness = 1f, reflectance = 0.1f),
        SemanticGroup.FLAT_ROOF to Swatch(0x163f75, roughness = 1f, reflectance = 0.1f),
        SemanticGroup.ROOF_TRIM to Swatch(0x1f508f, roughness = 1f, reflectance = 0.1f),
        SemanticGroup.WINDOW_GLASS to glass(0x8fd3ff, alpha = 0.25f),
        SemanticGroup.WINDOW_FRAME to Swatch(0x2a5a9a, roughness = 1f, reflectance = 0.1f),
        SemanticGroup.DOOR to Swatch(0x2a5a9a, roughness = 1f, reflectance = 0.1f),
        SemanticGroup.GARAGE_DOOR to Swatch(0x24548f, roughness = 1f, reflectance = 0.1f),
        SemanticGroup.SLAB to Swatch(0x20508f, roughness = 1f, reflectance = 0.1f),
        SemanticGroup.BALCONY_SLAB to Swatch(0x20508f, roughness = 1f, reflectance = 0.1f),
        SemanticGroup.RAILING to Swatch(0x2a5a9a, roughness = 1f, reflectance = 0.1f),
        SemanticGroup.FACADE_FRAME to Swatch(0x1f508f, roughness = 1f, reflectance = 0.1f),
        SemanticGroup.TERRACE_SURFACE to Swatch(0x174380, roughness = 1f, reflectance = 0.1f),
        SemanticGroup.CHIMNEY to Swatch(0x1a4884, roughness = 1f, reflectance = 0.1f),
        SemanticGroup.ROOFLIGHT to Swatch(0x2a5a9a, roughness = 1f, reflectance = 0.1f),
        SemanticGroup.STAIR to Swatch(0x1f508f, roughness = 1f, reflectance = 0.1f),
        SemanticGroup.ROOM to Swatch(0x8fd3ff, alpha = 0.12f, roughness = 1f),
        SemanticGroup.STRUCTURAL_MEMBER to Swatch(0x1f508f, roughness = 1f, reflectance = 0.1f),
        SemanticGroup.PERGOLA_MEMBER to Swatch(0x1f508f, roughness = 1f, reflectance = 0.1f),
        SemanticGroup.UNKNOWN_ASSEMBLY to Swatch(0xb7a8ff, alpha = 0.3f),
        SemanticGroup.OTHER to Swatch(0x1a4884, roughness = 1f, reflectance = 0.1f),
    )

    /** The swatch table of a house look. */
    fun tableOf(mode: PresentationMode): Map<SemanticGroup, Swatch> = when (mode) {
        PresentationMode.COZY, PresentationMode.DUSK -> HOME
        PresentationMode.SUNLIGHT -> SUNLIGHT
        PresentationMode.TECHNICAL -> TECHNICAL
        PresentationMode.XRAY -> XRAY
        PresentationMode.BLUEPRINT -> BLUEPRINT
        PresentationMode.MODEL, PresentationMode.CLAY, PresentationMode.LINE ->
            throw IllegalArgumentException("$mode is drawn by RenderStyle or StudyPalette")
    }

    /** The swatch of [group] in [mode], the look's OTHER for a group it does not list. */
    fun swatchOf(mode: PresentationMode, group: SemanticGroup): Swatch {
        val table = tableOf(mode)
        return table[group] ?: table.getValue(SemanticGroup.OTHER)
    }

    fun appearanceOf(mode: PresentationMode, part: ScenePart): SurfaceAppearance = appearanceOf(mode, part.part, part.semanticGroup)

    fun appearanceOf(mode: PresentationMode, part: GeometryPart, group: SemanticGroup): SurfaceAppearance {
        val swatch = if (mode == PresentationMode.DUSK && isGlazing(part)) DUSK_GLASS else swatchOf(mode, group)
        val alpha = when {
            mode.seeThrough -> swatch.alpha.coerceIn(XRAY_MIN_ALPHA, 1f)
            !part.isTranslucent -> 1f
            swatch.alpha < 1f -> swatch.alpha.coerceAtLeast(RenderStyle.MIN_ALPHA)
            else -> MARKER_ALPHA
        }
        // The glow belongs to glazing: a railing's glass infill or a marker never lights up.
        val glow = swatch.glow?.takeIf { isGlazing(part) }
        val rgb = HouseLooks.linear(swatch.rgb)
        return SurfaceAppearance(
            red = rgb[0] * alpha,
            green = rgb[1] * alpha,
            blue = rgb[2] * alpha,
            alpha = alpha,
            roughness = swatch.roughness,
            metallic = swatch.metallic,
            reflectance = swatch.reflectance,
            emissiveRed = glow?.get(0) ?: 0f,
            emissiveGreen = glow?.get(1) ?: 0f,
            emissiveBlue = glow?.get(2) ?: 0f,
        )
    }

    /** The roof covering of a HOME look. */
    fun coverAppearance(mode: PresentationMode): SurfaceAppearance {
        require(mode == PresentationMode.COZY || mode == PresentationMode.DUSK) { "$mode lays no tiles" }
        val rgb = HouseLooks.linear(HOME_COVER)
        return SurfaceAppearance(red = rgb[0], green = rgb[1], blue = rgb[2], alpha = 1f, roughness = 0.85f, metallic = 0f, reflectance = 0.3f)
    }

    /** A window's, a door's or a rooflight's pane: the parts a look may light. Read from the part, never the object's kind. */
    fun isGlazing(part: GeometryPart): Boolean =
        part == GeometryPart.WINDOW_GLASS || part == GeometryPart.DOOR_GLASS || part == GeometryPart.ROOFLIGHT_GLASS
}
