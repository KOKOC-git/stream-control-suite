package ru.streamcontrol.remote.network

import android.content.Context
import android.net.wifi.WifiManager
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.net.InetAddress
import java.util.concurrent.TimeUnit

data class DiscoveredServer(
    val ip: String,
    val responseMs: Long
)

class ServerDiscovery(context: Context) {
    private val wifiManager =
        context.applicationContext.getSystemService(Context.WIFI_SERVICE) as WifiManager

    private val client = OkHttpClient.Builder()
        .connectTimeout(350, TimeUnit.MILLISECONDS)
        .readTimeout(500, TimeUnit.MILLISECONDS)
        .build()

    suspend fun scan(): List<DiscoveredServer> = withContext(Dispatchers.IO) {
        val currentIp = wifiManager.connectionInfo.ipAddress
        if (currentIp == 0) return@withContext emptyList()

        val a = currentIp and 0xFF
        val b = currentIp shr 8 and 0xFF
        val c = currentIp shr 16 and 0xFF
        val prefix = "$a.$b.$c"

        coroutineScope {
            (1..254)
                .chunked(32)
                .flatMap { chunk ->
                    chunk.map { host ->
                        async {
                            val ip = "$prefix.$host"
                            checkServer(ip)
                        }
                    }.awaitAll()
                }
                .filterNotNull()
                .sortedBy { it.responseMs }
        }
    }

    private fun checkServer(ip: String): DiscoveredServer? {
        val started = System.nanoTime()
        val request = Request.Builder()
            .url("http://$ip:1985/api/v1/versions")
            .build()

        return runCatching {
            client.newCall(request).execute().use { response ->
                if (!response.isSuccessful) return null
                val body = response.body?.string().orEmpty()
                if (!body.contains("\"code\":0")) return null

                DiscoveredServer(
                    ip = ip,
                    responseMs = (System.nanoTime() - started) / 1_000_000
                )
            }
        }.getOrNull()
    }
}
