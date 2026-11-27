package com.buildplan.preview.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.em
import androidx.compose.ui.unit.sp
import com.buildplan.preview.R

/**
 * Minimalny dok (OWNER, variant C): BuildPlan's visual system, in one place.
 *
 * The house is the screen. A calm graphite ground under it, and only two
 * kinds of chrome over it: small floating pieces of smoky matte glass (the
 * house pill, two dock tiles, a fit button and the menu) and the larger
 * surfaces those pieces grow into. Text on glass is achromatic ink; ONE
 * accent, mint, marks what is chosen or measured: the chosen layer, the
 * "Demo" badge, the done part of the construction axis. A chosen thing is
 * also told by its mark and weight, never by the mint alone. A preview is
 * the same mint as an outline, never a fill, so a look back can never pass
 * for the saved state of the build. Every screen takes its colours, spacing,
 * corners and type roles from here.
 *
 * The 3D ground itself is the renderer's (`PresentationLook.MODEL_BACKGROUND`),
 * a mid graphite a step lighter than this app ground, so the darker glass
 * reads as a material laid over the scene rather than a hole cut in it.
 */
object Palette {
    /** The app's ground: the places without the model, and the opaque sheets' page. */
    val Ground = Color(0xFF101419)

    /** A surface lifted one step: text fields, an open stage row. */
    val Raised = Color(0xFF181D24)

    /** Opaque sheets carrying dense text: the menu, the source, the details. */
    val Sheet = Color(0xFF1B2128)

    /** A control pressed into its glass (a chosen card, the dock tile whose panel is open). */
    val Well = Color(0x6610141A)

    val Hairline = Color(0xFF2E3640)

    /** Text, and the lines of the built part of the house. */
    val Ink = Color(0xFFEEF1F4)

    /** Secondary text (8.4:1 on the ground). */
    val InkMuted = Color(0xFFAEB7C2)

    /**
     * Muted words on the light resting glass of a tile or a pill (round D): a step brighter than [InkMuted], so a
     * caption keeps ≈ 5:1 even where the glass lies over the palest wall of the house.
     */
    val InkMutedOnGlass = Color(0xFFC3CBD4)

    /** Metadata (6:1 on the ground); never for a label a person must read to act. */
    val InkFaint = Color(0xFF8E98A4)

    /** Outline of a stage not started, and graduation ticks: 3.9:1, a graphic that must be seen. */
    val RuleEmpty = Color(0xFF6B7581)

    /** THE accent, mint: what is chosen or measured. Always with a mark or a word beside it. */
    val Accent = Color(0xFF7FE3C4)

    /** The accent laid as a quiet fill under a chosen card (with the mint rim, never alone). */
    val AccentWash = Color(0x297FE3C4)

    /** Ink on the accent (12:1). */
    val OnAccent = Color(0xFF0B1F19)

    /** Measured progress on the construction axis: the accent, by name where the rule draws it. */
    val Rule = Accent

    /** Ink on the rule's fill. */
    val OnRule = OnAccent

    val Error = Color(0xFFEF8A7E)

    /**
     * Matte glass over the model: a smoky translucent tint. Not a blur — the model is drawn
     * by Filament on its own surface, which the window cannot sample (see [GlassSurface]).
     * Round D: 88 % (was 78 %), so muted words on it keep 4.5:1 over every look's backdrop (HouseLooksTest).
     */
    val Glass = Color(0xE02A3038)

    /**
     * The same glass, thicker, for a panel that carries rows of text over the house: the model
     * still shows through as shape and light, but its edges no longer run behind the words.
     */
    val GlassDense = Color(0xF01D2329)

    /** A card's or chip's resting fill on glass: a breath lighter, so four cards read as four. */
    val CardFill = Color(0x0FFFFFFF)

    /** The sheen across the top of the glass, fading out by its middle. */
    val GlassSheen = Color(0x17FFFFFF)

    /** A pane over another pane, or a surface carrying a long list: glass is a one-layer material. */
    val GlassOpaque = Color(0xF2161B21)
    val GlassRimHigh = Color(0x4DFFFFFF)
    val GlassRimLow = Color(0x0AFFFFFF)

    /** The 1 dp dark line round every piece of glass: it keeps the glass a separate object over a pale wall. */
    val GlassContact = Color(0x59000000)

    /** The soft depth under a piece of glass. */
    val GlassShadow = Color(0xCC000000)

    /** The shade that settles the model's edges under the system bars, and the vignette. */
    val Scrim = Color(0xFF05060A)
}

/** One spacing scale. More space above a heading than below it. */
object Space {
    val xxs = 2.dp
    val xs = 4.dp
    val s = 8.dp
    val m = 12.dp
    val l = 16.dp
    val xl = 24.dp
    val xxl = 32.dp
    val xxxl = 48.dp
}

/** Soft, rounded glass: a tile, the panel it grows into, a pill. One scale, no per-screen corners. */
object Radius {
    val tick = 2.dp
    val control = 12.dp
    /** A dock tile, a chosen card, a header button. */
    val tile = 18.dp
    val panel = 22.dp
    val sheet = 26.dp
    /** The house pill and the badges: fully round ends. */
    val pill = 999.dp
}

object Sizes {
    /** Every touch target, at least. */
    val touch = 48.dp
    val icon = 22.dp
    val iconSmall = 18.dp

    /** A dock tile's height: a touch target with room for the glass around its label. */
    val tile = 56.dp

    /** The widest a screen's column grows on a wide window: centred at a readable measure, never stretched. */
    val contentMax = 720.dp
}

/** The soft depth under glass, by how far the piece floats above the house. */
object Depth {
    val tile = 6.dp
    val panel = 16.dp
}

/** The rule's own face: condensed, tabular numerals for measured values. */
val MeasureFamily = FontFamily(Font(R.font.barlow_condensed_semibold, FontWeight.SemiBold))

/** Type roles beyond Material's scale: the measured figures. */
object Measure {
    /** The one monumental figure in the app: "Postęp wg etapów" at the head of the stage sheet. */
    val monumental = TextStyle(
        fontFamily = MeasureFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 64.sp,
        lineHeight = 64.sp,
        letterSpacing = (-0.01).em,
        fontFeatureSettings = "tnum",
    )

    /** A measured value inside a line of chrome: "43%" on the 3D and Etapy. */
    val inline = TextStyle(
        fontFamily = MeasureFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 20.sp,
        lineHeight = 22.sp,
        fontFeatureSettings = "tnum",
    )

    /** Stage numbers and graduation numerals on the rule. */
    val numeral = TextStyle(
        fontFamily = MeasureFamily,
        fontWeight = FontWeight.SemiBold,
        fontSize = 13.sp,
        lineHeight = 14.sp,
        fontFeatureSettings = "tnum",
    )
}

private val TechnicalDark = darkColorScheme(
    // Primary actions are ink, not colour: the accent is reserved for what is chosen or measured.
    primary = Palette.Ink,
    onPrimary = Palette.Ground,
    primaryContainer = Color(0xFF262D36),
    onPrimaryContainer = Palette.Ink,
    inversePrimary = Palette.Ground,
    secondary = Palette.InkMuted,
    onSecondary = Palette.Ground,
    secondaryContainer = Color(0xFF262D36),
    onSecondaryContainer = Palette.Ink,
    tertiary = Palette.Rule,
    onTertiary = Palette.OnRule,
    tertiaryContainer = Color(0xFF173A30),
    onTertiaryContainer = Palette.Rule,
    background = Palette.Ground,
    onBackground = Palette.Ink,
    surface = Palette.Ground,
    onSurface = Palette.Ink,
    surfaceVariant = Palette.Raised,
    onSurfaceVariant = Palette.InkMuted,
    surfaceTint = Color.Transparent,
    inverseSurface = Palette.Ink,
    inverseOnSurface = Palette.Ground,
    error = Palette.Error,
    onError = Color(0xFF1C0B08),
    errorContainer = Color(0xFF3A1D19),
    onErrorContainer = Palette.Error,
    outline = Palette.RuleEmpty,
    outlineVariant = Palette.Hairline,
    scrim = Color.Black,
    surfaceBright = Color(0xFF232A33),
    surfaceDim = Palette.Ground,
    surfaceContainerLowest = Color(0xFF0A0D11),
    surfaceContainerLow = Palette.Raised,
    surfaceContainer = Palette.Raised,
    surfaceContainerHigh = Palette.Sheet,
    surfaceContainerHighest = Color(0xFF222932),
)

/**
 * The words' face (taste pass): Barlow, a low-contrast grotesk drawn from road and site signage — the lettering
 * of the place this app is about. One family in two widths: Barlow for everything read, Barlow Condensed
 * ([MeasureFamily]) for measured figures, so a percentage and its label are clearly kin and clearly different.
 * Until APK 1357 the words were Roboto, the face of every Android app.
 */
val WordFamily = FontFamily(
    Font(R.font.barlow_regular, FontWeight.Normal),
    Font(R.font.barlow_medium, FontWeight.Medium),
    Font(R.font.barlow_semibold, FontWeight.SemiBold),
)

/**
 * Material's scale set in Barlow. Barlow is a little narrower and rounder than Roboto, so titles take its
 * Medium/SemiBold with plain tracking and the small roles a touch of tracking; no role is picked per screen.
 */
private val BuildPlanTypography = Typography().let { t ->
    fun TextStyle.words(weight: FontWeight? = fontWeight, tracking: androidx.compose.ui.unit.TextUnit = letterSpacing) =
        copy(fontFamily = WordFamily, fontWeight = weight, letterSpacing = tracking)
    t.copy(
        displayLarge = t.displayLarge.words(),
        displayMedium = t.displayMedium.words(),
        displaySmall = t.displaySmall.words(),
        headlineLarge = t.headlineLarge.words(FontWeight.SemiBold),
        headlineMedium = t.headlineMedium.words(FontWeight.SemiBold),
        headlineSmall = t.headlineSmall.words(FontWeight.SemiBold, (-0.005).em),
        titleLarge = t.titleLarge.words(FontWeight.SemiBold, 0.sp),
        titleMedium = t.titleMedium.words(FontWeight.SemiBold, 0.sp),
        titleSmall = t.titleSmall.words(FontWeight.SemiBold, 0.sp),
        bodyLarge = t.bodyLarge.words(FontWeight.Normal, 0.005.em),
        bodyMedium = t.bodyMedium.words(FontWeight.Normal, 0.01.em),
        bodySmall = t.bodySmall.words(FontWeight.Normal, 0.015.em),
        labelLarge = t.labelLarge.words(FontWeight.Medium, 0.01.em),
        labelMedium = t.labelMedium.words(FontWeight.Medium, 0.02.em),
        labelSmall = t.labelSmall.words(FontWeight.Medium, 0.02.em),
    )
}

@Composable
fun PreviewTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = TechnicalDark, typography = BuildPlanTypography, content = content)
}
