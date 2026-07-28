package ru.streamcontrol.remote

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import ru.streamcontrol.remote.data.AppPreferences
import ru.streamcontrol.remote.model.*
import ru.streamcontrol.remote.network.SrsClient
import ru.streamcontrol.remote.network.ServerDiscovery
import ru.streamcontrol.remote.network.DiscoveredServer
import ru.streamcontrol.remote.network.WifiAnalyzer
import java.util.UUID

data class AppUiState(
    val serverIp: String = "192.168.10.144",
    val serverOnline: Boolean = false,
    val streams: List<StreamInfo> = emptyList(),
    val profiles: List<SourceProfile> = emptyList(),
    val wifi: WifiSnapshot = WifiSnapshot(),
    val survey: List<SurveyPoint> = emptyList(),
    val accessPointLabels: Map<String, String> = emptyMap(),
    val error: String? = null,
    val loading: Boolean = true,
    val discovering: Boolean = false,
    val discoveredServers: List<DiscoveredServer> = emptyList()
)

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val prefs = AppPreferences(application)
    private val srs = SrsClient()
    private val wifi = WifiAnalyzer(application)
    private val discovery = ServerDiscovery(application)
    private val _state = MutableStateFlow(AppUiState())
    val state: StateFlow<AppUiState> = _state.asStateFlow()
    private var pollJob: Job? = null

    init {
        viewModelScope.launch {
            _state.value = _state.value.copy(
                serverIp = prefs.loadServerIp(),
                profiles = prefs.loadProfiles(),
                survey = prefs.loadSurvey(),
                accessPointLabels = prefs.loadApLabels(),
                loading = false
            )
            startPolling()
        }
    }


    fun discoverServers() {
        viewModelScope.launch {
            _state.value = _state.value.copy(
                discovering = true,
                discoveredServers = emptyList()
            )

            val result = runCatching { discovery.scan() }
                .getOrElse {
                    _state.value = _state.value.copy(
                        discovering = false,
                        error = it.message
                    )
                    return@launch
                }

            _state.value = _state.value.copy(
                discovering = false,
                discoveredServers = result
            )
        }
    }

    fun selectDiscoveredServer(ip: String) {
        _state.value = _state.value.copy(serverIp = ip)
        saveServerIp()
    }

    fun setServerIp(value: String) { _state.value = _state.value.copy(serverIp = value) }
    fun saveServerIp() = viewModelScope.launch { prefs.saveServerIp(_state.value.serverIp); refreshAll() }

    private fun startPolling() {
        pollJob?.cancel()
        pollJob = viewModelScope.launch { while (true) { refreshAll(); delay(2000) } }
    }

    fun refreshAll() = viewModelScope.launch {
        val ip = _state.value.serverIp.trim()
        val streams = runCatching { srs.streams(ip) }
        val wifiResult = runCatching { wifi.measure(ip) }
        _state.value = _state.value.copy(
            streams = streams.getOrDefault(emptyList()), serverOnline = streams.isSuccess,
            wifi = wifiResult.getOrElse { wifi.currentConnection() }, error = streams.exceptionOrNull()?.message
        )
    }

    fun addProfile(name: String, streamKey: String, type: SourceType) {
        val key = streamKey.trim().lowercase()
        if (name.isBlank() || key.isBlank() || _state.value.profiles.any { it.streamKey == key }) return
        val next = _state.value.profiles + SourceProfile(UUID.randomUUID().toString(), name.trim(), key, type)
        _state.value = _state.value.copy(profiles = next)
        viewModelScope.launch { prefs.saveProfiles(next) }
    }

    fun deleteProfile(id: String) {
        val next = _state.value.profiles.filterNot { it.id == id }
        _state.value = _state.value.copy(profiles = next)
        viewModelScope.launch { prefs.saveProfiles(next) }
    }

    fun saveAccessPointLabel(label: String) {
        val bssid = _state.value.wifi.bssid
        if (bssid == "—" || label.isBlank()) return
        val labels = _state.value.accessPointLabels + (bssid to label.trim())
        _state.value = _state.value.copy(accessPointLabels = labels)
        viewModelScope.launch { prefs.saveApLabel(bssid, label.trim()) }
    }

    fun addSurveyPoint(label: String) {
        if (label.isBlank()) return
        val w = _state.value.wifi
        val point = SurveyPoint(UUID.randomUUID().toString(), label.trim(), System.currentTimeMillis(), w, _state.value.accessPointLabels[w.bssid] ?: w.bssid)
        val next = listOf(point) + _state.value.survey
        _state.value = _state.value.copy(survey = next)
        viewModelScope.launch { prefs.saveSurvey(next) }
    }

    fun clearSurvey() {
        _state.value = _state.value.copy(survey = emptyList())
        viewModelScope.launch { prefs.saveSurvey(emptyList()) }
    }
}
