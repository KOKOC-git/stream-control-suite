package ru.streamcontrol.remote.data

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import ru.streamcontrol.remote.model.SurveyPoint
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object SurveyExporter {
    fun shareCsv(context: Context, points: List<SurveyPoint>) {
        val directory = File(context.cacheDir, "exports").apply { mkdirs() }
        val stamp = SimpleDateFormat("yyyy-MM-dd_HH-mm", Locale.US).format(Date())
        val file = File(directory, "wifi-survey_$stamp.csv")

        file.bufferedWriter(Charsets.UTF_8).use { writer ->
            writer.appendLine(
                "Место;Дата;Точка доступа;SSID;BSSID;RSSI dBm;Качество;Частота МГц;Канал;TX Мбит/с;RX Мбит/с;Ping мс;Jitter мс;Потери %"
            )
            points.forEach { point ->
                writer.appendLine(
                    listOf(
                        point.label,
                        Date(point.timestamp).toString(),
                        point.accessPointLabel,
                        point.wifi.ssid,
                        point.wifi.bssid,
                        point.wifi.rssi,
                        point.wifi.quality,
                        point.wifi.frequencyMhz,
                        point.wifi.channel ?: "",
                        point.wifi.txLinkMbps,
                        point.wifi.rxLinkMbps,
                        point.wifi.pingMs ?: "",
                        point.wifi.jitterMs ?: "",
                        point.wifi.packetLossPercent ?: ""
                    ).joinToString(";") { it.toString().replace(";", ",") }
                )
            }
        }

        val uri = FileProvider.getUriForFile(
            context,
            "${context.packageName}.fileprovider",
            file
        )

        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/csv"
            putExtra(Intent.EXTRA_STREAM, uri)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }

        context.startActivity(
            Intent.createChooser(intent, "Экспорт замеров Wi‑Fi")
        )
    }
}
