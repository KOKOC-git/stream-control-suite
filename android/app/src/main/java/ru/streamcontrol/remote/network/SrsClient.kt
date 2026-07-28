package ru.streamcontrol.remote.network

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import ru.streamcontrol.remote.model.StreamInfo
import java.util.concurrent.TimeUnit

class SrsClient {
    private val client = OkHttpClient.Builder().connectTimeout(2, TimeUnit.SECONDS).readTimeout(3, TimeUnit.SECONDS).build()
    suspend fun streams(serverIp: String): List<StreamInfo> = withContext(Dispatchers.IO) {
        val req = Request.Builder().url("http://$serverIp:1985/api/v1/streams/").build()
        client.newCall(req).execute().use { response ->
            if (!response.isSuccessful) error("SRS API: HTTP ${response.code}")
            val root = JSONObject(response.body?.string().orEmpty())
            val array = root.optJSONArray("streams") ?: return@withContext emptyList()
            buildList {
                repeat(array.length()) { i ->
                    val item = array.getJSONObject(i); val name = item.optString("name")
                    if (name.isBlank()) return@repeat
                    val video = item.optJSONObject("video"); val kbps = item.optJSONObject("kbps")
                    add(StreamInfo(
                        id = item.optString("id", name), name = name,
                        active = item.optJSONObject("publish")?.optBoolean("active", true) ?: true,
                        bitrateKbps = kbps?.optDouble("recv_30s", 0.0) ?: 0.0,
                        width = video?.optInt("width")?.takeIf { it > 0 }, height = video?.optInt("height")?.takeIf { it > 0 },
                        fps = video?.optDouble("fps")?.takeIf { it > 0 }, liveMs = item.optLong("live_ms").takeIf { it > 0 },
                        flvUrl = "http://$serverIp:8080/live/$name.flv"
                    ))
                }
            }
        }
    }
}
