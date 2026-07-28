package ru.streamcontrol.remote.ui

import android.graphics.Bitmap
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel
import ru.streamcontrol.remote.model.SourceProfile

private enum class GoProQrStep(val title: String, val description: String) {
    WIFI(
        "1. Wi‑Fi",
        "Сохраняет SSID и пароль в памяти камеры. Обычно этот QR сканируется один раз."
    ),
    RTMP(
        "2. RTMP",
        "Сохраняет полный адрес SRS для выбранного профиля камеры."
    ),
    START(
        "3. Запуск",
        "Подключает GoPro к сохранённой сети и запускает прямую трансляцию."
    )
}

private enum class LiveResolution(val label: String, val commandValue: String) {
    P480("480p", "480"),
    P720("720p", "720"),
    P1080("1080p", "1080")
}

private fun labsQuote(value: String): String =
    value.replace("\\", "\\\\").replace("\"", "\\\"")

private fun wifiCommand(ssid: String, password: String): String =
    "!MJOIN=\"${labsQuote(ssid)}\",\"${labsQuote(password)}\""

private fun rtmpCommand(url: String): String =
    "!MRTMP=\"${labsQuote(url)}\""

private fun startCommand(
    resolution: LiveResolution,
    localCopy: Boolean,
    hero12Or13: Boolean
): String {
    val ending = when {
        hero12Or13 -> "!GMC"
        localCopy -> "!GLC"
        else -> "!GL"
    }
    return "oW1mVr${resolution.commandValue}!W$ending"
}

private fun generateQrBitmap(content: String, size: Int = 960): Bitmap {
    val hints = mapOf(
        EncodeHintType.CHARACTER_SET to "UTF-8",
        EncodeHintType.ERROR_CORRECTION to ErrorCorrectionLevel.M,
        EncodeHintType.MARGIN to 2
    )
    val matrix = QRCodeWriter().encode(
        content,
        BarcodeFormat.QR_CODE,
        size,
        size,
        hints
    )
    val pixels = IntArray(size * size)
    for (y in 0 until size) {
        val offset = y * size
        for (x in 0 until size) {
            pixels[offset + x] = if (matrix[x, y]) {
                android.graphics.Color.BLACK
            } else {
                android.graphics.Color.WHITE
            }
        }
    }
    return Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888).apply {
        setPixels(pixels, 0, size, 0, 0, size, size)
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GoProQrDialog(
    profile: SourceProfile,
    serverIp: String,
    currentSsid: String,
    onDismiss: () -> Unit
) {
    var step by remember { mutableStateOf(GoProQrStep.WIFI) }
    var ssid by remember(currentSsid) {
        mutableStateOf(currentSsid.takeUnless { it == "—" || it == "<unknown ssid>" }.orEmpty())
    }
    var password by remember { mutableStateOf("") }
    var resolution by remember { mutableStateOf(LiveResolution.P1080) }
    var localCopy by remember { mutableStateOf(false) }
    var hero12Or13 by remember { mutableStateOf(false) }
    var resolutionMenu by remember { mutableStateOf(false) }

    val rtmpUrl = remember(serverIp, profile.streamKey) {
        "rtmp://${serverIp.trim()}/live/${profile.streamKey}"
    }

    val command = when (step) {
        GoProQrStep.WIFI -> wifiCommand(ssid, password)
        GoProQrStep.RTMP -> rtmpCommand(rtmpUrl)
        GoProQrStep.START -> startCommand(resolution, localCopy, hero12Or13)
    }
    val valid = when (step) {
        GoProQrStep.WIFI -> ssid.isNotBlank() && password.isNotBlank()
        GoProQrStep.RTMP -> serverIp.isNotBlank() && profile.streamKey.isNotBlank()
        GoProQrStep.START -> true
    }
    val bitmap = remember(command, valid) {
        if (valid) generateQrBitmap(command) else null
    }
    val clipboard = LocalClipboardManager.current

    Dialog(onDismissRequest = onDismiss) {
        Surface(
            modifier = Modifier
                .fillMaxWidth()
                .heightIn(max = 760.dp),
            shape = MaterialTheme.shapes.extraLarge,
            tonalElevation = 8.dp
        ) {
            Column(
                modifier = Modifier
                    .padding(18.dp)
                    .verticalScroll(rememberScrollState()),
                verticalArrangement = Arrangement.spacedBy(14.dp)
            ) {
                Row(
                    modifier = Modifier.fillMaxWidth(),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    Column(Modifier.weight(1f)) {
                        Text("GoPro Labs QR", style = MaterialTheme.typography.headlineSmall)
                        Text(
                            profile.name,
                            style = MaterialTheme.typography.labelMedium,
                            color = MaterialTheme.colorScheme.primary
                        )
                    }
                    TextButton(onClick = onDismiss) { Text("Закрыть") }
                }

                SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
                    GoProQrStep.entries.forEachIndexed { index, item ->
                        SegmentedButton(
                            selected = step == item,
                            onClick = { step = item },
                            shape = SegmentedButtonDefaults.itemShape(
                                index = index,
                                count = GoProQrStep.entries.size
                            ),
                            label = { Text(item.title) }
                        )
                    }
                }

                Text(step.description, style = MaterialTheme.typography.bodyMedium)

                when (step) {
                    GoProQrStep.WIFI -> {
                        OutlinedTextField(
                            value = ssid,
                            onValueChange = { ssid = it },
                            label = { Text("Имя Wi‑Fi (SSID)") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        OutlinedTextField(
                            value = password,
                            onValueChange = { password = it },
                            label = { Text("Пароль Wi‑Fi") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth()
                        )
                        Text(
                            "Android не позволяет приложению прочитать пароль текущей сети, поэтому его нужно ввести вручную.",
                            style = MaterialTheme.typography.labelSmall
                        )
                    }
                    GoProQrStep.RTMP -> {
                        OutlinedTextField(
                            value = rtmpUrl,
                            onValueChange = {},
                            readOnly = true,
                            label = { Text("Адрес трансляции") },
                            modifier = Modifier.fillMaxWidth()
                        )
                    }
                    GoProQrStep.START -> {
                        Box {
                            OutlinedButton(
                                onClick = { resolutionMenu = true },
                                modifier = Modifier.fillMaxWidth()
                            ) { Text("Разрешение: ${resolution.label}") }
                            DropdownMenu(
                                expanded = resolutionMenu,
                                onDismissRequest = { resolutionMenu = false }
                            ) {
                                LiveResolution.entries.forEach { item ->
                                    DropdownMenuItem(
                                        text = { Text(item.label) },
                                        onClick = {
                                            resolution = item
                                            resolutionMenu = false
                                        }
                                    )
                                }
                            }
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(
                                checked = localCopy,
                                onCheckedChange = {
                                    localCopy = it
                                    if (it) hero12Or13 = false
                                },
                                enabled = !hero12Or13
                            )
                            Text("Сохранять качественную копию на карту")
                        }
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Checkbox(
                                checked = hero12Or13,
                                onCheckedChange = {
                                    hero12Or13 = it
                                    if (it) localCopy = false
                                }
                            )
                            Text("Режим запуска для HERO12 / HERO13")
                        }
                    }
                }

                if (bitmap != null) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth()
                            .background(Color.White)
                            .padding(12.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Image(
                            bitmap = bitmap.asImageBitmap(),
                            contentDescription = "GoPro Labs QR ${step.title}",
                            modifier = Modifier
                                .fillMaxWidth()
                                .aspectRatio(1f)
                        )
                    }
                } else {
                    Surface(
                        modifier = Modifier
                            .fillMaxWidth()
                            .aspectRatio(1f),
                        color = MaterialTheme.colorScheme.surfaceVariant
                    ) {
                        Box(contentAlignment = Alignment.Center) {
                            Text(
                                "Заполни SSID и пароль",
                                textAlign = TextAlign.Center
                            )
                        }
                    }
                }

                Text(
                    command,
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.fillMaxWidth(),
                    textAlign = TextAlign.Center
                )

                OutlinedButton(
                    onClick = { clipboard.setText(AnnotatedString(command)) },
                    enabled = valid,
                    modifier = Modifier.fillMaxWidth()
                ) {
                    Text("Скопировать команду")
                }

                Text(
                    "Сканируй коды по порядку: Wi‑Fi → RTMP → Запуск. После успешного чтения GoPro обычно подаёт визуальный или звуковой сигнал.",
                    style = MaterialTheme.typography.bodySmall
                )
            }
        }
    }
}
