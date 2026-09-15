package com.buildplan.preview.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/**
 * A restrained dark technical palette, the same register as the web
 * BuildWorld editor. The viewport is the subject; the chrome stays quiet.
 */
private val TechnicalDark = darkColorScheme(
    primary = Color(0xFF6FB3F2),
    onPrimary = Color(0xFF07121C),
    primaryContainer = Color(0xFF1C3350),
    secondary = Color(0xFF8FA3B8),
    background = Color(0xFF12151A),
    onBackground = Color(0xFFE4E9F0),
    surface = Color(0xFF191D24),
    onSurface = Color(0xFFE4E9F0),
    surfaceVariant = Color(0xFF232932),
    onSurfaceVariant = Color(0xFFB9C3D0),
    outline = Color(0xFF3A424E),
    error = Color(0xFFE5766A),
)

@Composable
fun PreviewTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = TechnicalDark, content = content)
}
