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
 * The Folding Rule: BuildPlan's visual system, in one place.
 *
 * A graphite night ground under the house, chrome that is tinted graphite
 * rather than opaque slabs, achromatic text, and ONE accent — rule yellow —
 * that means measured construction progress and nothing else: the unfolded
 * segments of the rule, the solid "now" tag, the part of the house the
 * current stage adds. A preview is the same yellow as an outline, never a
 * fill, so a look back can never pass for the state of the build. Every
 * screen takes its colours, spacing, corners and type roles from here.
 *
 * The 3D ground itself is the renderer's (`PresentationLook`), darker than
 * this one on purpose: the model's backdrop is the darkest thing on screen.
 */
object Palette {
    /** The app's ground: Dom, Etapy, the analyzer, the places without the model. */
    val Ground = Color(0xFF101419)

    /** A surface lifted one step: text fields, the navigation bar. */
    val Raised = Color(0xFF161B21)

    /** Opaque sheets carrying dense text: the inspector, the tool pane, the editor. */
    val Sheet = Color(0xFF1B2128)

    /** A control pressed into its rail (the active tool, the selected place). */
    val Well = Color(0xFF0A0D11)

    val Hairline = Color(0xFF2A313A)

    /** Text, and the lines of the built part of the house. */
    val Ink = Color(0xFFE8EBEF)

    /** Secondary text (8.4:1 on the ground). */
    val InkMuted = Color(0xFFA7B0BC)

    /** Metadata (6:1 on the ground); never for a label a person must read to act. */
    val InkFaint = Color(0xFF8A94A0)

    /** Outline of a stage not started, and graduation ticks: 3.9:1, a graphic that must be seen. */
    val RuleEmpty = Color(0xFF6B7581)

    /** THE accent: measured progress. Nothing else is ever this colour. */
    val Rule = Color(0xFFF2C230)

    /** Ink on the rule's yellow (11:1). */
    val OnRule = Color(0xFF15120A)

    val Error = Color(0xFFEF8A7E)

    /** Chrome over the model: a tint, never a blur (the model is on its own surface). */
    val Glass = Color(0xE6101419)

    /** A pane over another pane: glass is a one-layer material. */
    val GlassOpaque = Color(0xFF14181E)
    val GlassRimHigh = Color(0x24FFFFFF)
    val GlassRimLow = Color(0x08FFFFFF)

    /** The shade that settles the model's top edge under the status bar. */
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

/** Rectilinear: a rule has corners, not pills. */
object Radius {
    val tick = 2.dp
    val control = 6.dp
    val panel = 8.dp
    val sheet = 12.dp
}

object Sizes {
    /** Every touch target, at least. */
    val touch = 48.dp
    val icon = 22.dp
    val iconSmall = 18.dp

    /** The widest a screen's column grows on a wide window: centred at a readable measure, never stretched. */
    val contentMax = 720.dp
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
    // Primary actions are ink, not colour: the accent is reserved for progress.
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
    tertiaryContainer = Color(0xFF3A3218),
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
    surfaceContainerLowest = Palette.Well,
    surfaceContainerLow = Palette.Raised,
    surfaceContainer = Palette.Raised,
    surfaceContainerHigh = Palette.Sheet,
    surfaceContainerHighest = Color(0xFF222932),
)

/** Material's scale in Roboto, with calmer tracking on the small roles; no role is picked per screen. */
private val BuildPlanTypography = Typography().let { t ->
    t.copy(
        headlineSmall = t.headlineSmall.copy(fontWeight = FontWeight.SemiBold, letterSpacing = (-0.005).em),
        titleLarge = t.titleLarge.copy(fontWeight = FontWeight.SemiBold),
        titleMedium = t.titleMedium.copy(fontWeight = FontWeight.SemiBold, letterSpacing = 0.sp),
        titleSmall = t.titleSmall.copy(fontWeight = FontWeight.SemiBold, letterSpacing = 0.sp),
        labelLarge = t.labelLarge.copy(letterSpacing = 0.01.em),
        labelMedium = t.labelMedium.copy(letterSpacing = 0.02.em),
        labelSmall = t.labelSmall.copy(letterSpacing = 0.02.em),
    )
}

@Composable
fun PreviewTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = TechnicalDark, typography = BuildPlanTypography, content = content)
}
