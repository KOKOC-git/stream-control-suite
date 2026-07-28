package ru.streamcontrol.remote.model

data class SourceProfile(val id: String, val name: String, val streamKey: String, val type: SourceType)
enum class SourceType(val title: String) { GOPRO("GoPro"), DJI("DJI"), PHONE("Телефон"), RTMP("Другой RTMP") }

data class StreamInfo(
    val id: String,
    val name: String,
    val active: Boolean,
    val bitrateKbps: Double,
    val width: Int?,
    val height: Int?,
    val fps: Double?,
    val liveMs: Long?,
    val flvUrl: String
)

data class WifiSnapshot(
    val ssid: String = "—",
    val bssid: String = "—",
    val rssi: Int = -127,
    val frequencyMhz: Int = 0,
    val channel: Int? = null,
    val txLinkMbps: Int = -1,
    val rxLinkMbps: Int = -1,
    val pingMs: Double? = null,
    val jitterMs: Double? = null,
    val packetLossPercent: Double? = null
) {
    val quality: String get() = when {
        rssi >= -50 -> "Отлично"
        rssi >= -60 -> "Хорошо"
        rssi >= -67 -> "Приемлемо"
        rssi >= -75 -> "Слабый сигнал"
        else -> "Плохой сигнал"
    }
}

data class SurveyPoint(
    val id: String,
    val label: String,
    val timestamp: Long,
    val wifi: WifiSnapshot,
    val accessPointLabel: String
)
