package ru.streamcontrol.remote.data

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first
import org.json.JSONArray
import org.json.JSONObject
import ru.streamcontrol.remote.model.*

private val Context.dataStore by preferencesDataStore("stream_remote")

class AppPreferences(private val context: Context) {
    private object Keys {
        val serverIp = stringPreferencesKey("server_ip")
        val profiles = stringPreferencesKey("profiles")
        val survey = stringPreferencesKey("survey")
        val apLabels = stringPreferencesKey("ap_labels")
    }

    suspend fun loadServerIp() = context.dataStore.data.first()[Keys.serverIp] ?: "192.168.10.144"
    suspend fun saveServerIp(value: String) { context.dataStore.edit { it[Keys.serverIp] = value.trim() } }

    suspend fun loadProfiles(): List<SourceProfile> {
        val raw = context.dataStore.data.first()[Keys.profiles] ?: return emptyList()
        return runCatching {
            val a = JSONArray(raw)
            buildList {
                repeat(a.length()) { i ->
                    val o = a.getJSONObject(i)
                    add(SourceProfile(o.getString("id"), o.getString("name"), o.getString("streamKey"), SourceType.valueOf(o.getString("type"))))
                }
            }
        }.getOrDefault(emptyList())
    }

    suspend fun saveProfiles(items: List<SourceProfile>) {
        val a = JSONArray()
        items.forEach { p -> a.put(JSONObject().put("id", p.id).put("name", p.name).put("streamKey", p.streamKey).put("type", p.type.name)) }
        context.dataStore.edit { it[Keys.profiles] = a.toString() }
    }

    suspend fun loadApLabels(): Map<String, String> {
        val raw = context.dataStore.data.first()[Keys.apLabels] ?: return emptyMap()
        return runCatching { val o = JSONObject(raw); o.keys().asSequence().associateWith { o.getString(it) } }.getOrDefault(emptyMap())
    }

    suspend fun saveApLabel(bssid: String, label: String) {
        val current = loadApLabels().toMutableMap(); current[bssid] = label
        val o = JSONObject(); current.forEach { (k, v) -> o.put(k, v) }
        context.dataStore.edit { it[Keys.apLabels] = o.toString() }
    }

    suspend fun loadSurvey(): List<SurveyPoint> {
        val raw = context.dataStore.data.first()[Keys.survey] ?: return emptyList()
        return runCatching {
            val a = JSONArray(raw)
            buildList {
                repeat(a.length()) { i ->
                    val o = a.getJSONObject(i); val w = o.getJSONObject("wifi")
                    add(SurveyPoint(
                        o.getString("id"), o.getString("label"), o.getLong("timestamp"),
                        WifiSnapshot(
                            ssid = w.optString("ssid", "—"), bssid = w.optString("bssid", "—"), rssi = w.optInt("rssi", -127),
                            frequencyMhz = w.optInt("frequencyMhz", 0), channel = if (w.has("channel")) w.optInt("channel") else null,
                            txLinkMbps = w.optInt("txLinkMbps", -1), rxLinkMbps = w.optInt("rxLinkMbps", -1),
                            pingMs = if (w.has("pingMs")) w.optDouble("pingMs") else null,
                            jitterMs = if (w.has("jitterMs")) w.optDouble("jitterMs") else null,
                            packetLossPercent = if (w.has("packetLossPercent")) w.optDouble("packetLossPercent") else null
                        ),
                        o.optString("accessPointLabel")
                    ))
                }
            }
        }.getOrDefault(emptyList())
    }

    suspend fun saveSurvey(items: List<SurveyPoint>) {
        val a = JSONArray()
        items.forEach { p ->
            val w = JSONObject().put("ssid", p.wifi.ssid).put("bssid", p.wifi.bssid).put("rssi", p.wifi.rssi)
                .put("frequencyMhz", p.wifi.frequencyMhz).put("txLinkMbps", p.wifi.txLinkMbps).put("rxLinkMbps", p.wifi.rxLinkMbps)
            p.wifi.channel?.let { w.put("channel", it) }; p.wifi.pingMs?.let { w.put("pingMs", it) }
            p.wifi.jitterMs?.let { w.put("jitterMs", it) }; p.wifi.packetLossPercent?.let { w.put("packetLossPercent", it) }
            a.put(JSONObject().put("id", p.id).put("label", p.label).put("timestamp", p.timestamp).put("accessPointLabel", p.accessPointLabel).put("wifi", w))
        }
        context.dataStore.edit { it[Keys.survey] = a.toString() }
    }
}
