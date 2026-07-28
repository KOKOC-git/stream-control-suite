package ru.streamcontrol.remote.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val Scheme = darkColorScheme(
    primary = Color(0xFF5B8CFF), secondary = Color(0xFF35C759),
    background = Color(0xFF101114), surface = Color(0xFF191A1F),
    surfaceVariant = Color(0xFF24262D), error = Color(0xFFFF5B52)
)
@Composable fun StreamControlTheme(content: @Composable () -> Unit) { MaterialTheme(colorScheme = Scheme, content = content) }
