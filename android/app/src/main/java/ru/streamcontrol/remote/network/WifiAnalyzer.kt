package ru.streamcontrol.remote.network

import android.annotation.SuppressLint
import android.content.Context
import android.net.wifi.WifiManager
import android.os.Build
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import ru.streamcontrol.remote.model.WifiSnapshot
import java.net.InetSocketAddress
import java.net.Socket
import kotlin.math.abs

class WifiAnalyzer(context: Context) {
    private val wifi = context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager

    @SuppressLint("MissingPermission")
    fun currentConnection(): WifiSnapshot {
        val i = wifi.connectionInfo; val f = i.frequency
        return WifiSnapshot(
            ssid = i.ssid.removeSurrounding("\""), bssid = i.bssid ?: "—", rssi = i.rssi, frequencyMhz = f,
            channel = when { f == 2484 -> 14; f in 2412..2472 -> (f - 2407) / 5; f in 5160..5885 -> (f - 5000) / 5; f in 5955..7115 -> (f - 5950) / 5; else -> null },
            txLinkMbps = if (Build.VERSION.SDK_INT >= 29) i.txLinkSpeedMbps else i.linkSpeed,
            rxLinkMbps = if (Build.VERSION.SDK_INT >= 29) i.rxLinkSpeedMbps else i.linkSpeed
        )
    }

    suspend fun measure(serverIp: String, attempts: Int = 8): WifiSnapshot = withContext(Dispatchers.IO) {
        val base = currentConnection(); val values = mutableListOf<Double>()
        repeat(attempts) {
            val start = System.nanoTime()
            if (runCatching { Socket().use { s -> s.connect(InetSocketAddress(serverIp, 1985), 1200) } }.isSuccess)
                values += (System.nanoTime() - start) / 1_000_000.0
        }
        val loss = (attempts - values.size) * 100.0 / attempts
        val jitter = values.zipWithNext { a, b -> abs(b - a) }.takeIf { it.isNotEmpty() }?.average()
        base.copy(pingMs = values.takeIf { it.isNotEmpty() }?.average(), jitterMs = jitter, packetLossPercent = loss)
    }
}
