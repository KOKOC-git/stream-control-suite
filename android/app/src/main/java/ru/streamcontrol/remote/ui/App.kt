package ru.streamcontrol.remote.ui

import android.view.ViewGroup
import android.widget.FrameLayout
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.PlayerView
import ru.streamcontrol.remote.AppUiState
import ru.streamcontrol.remote.MainViewModel
import ru.streamcontrol.remote.model.*
import ru.streamcontrol.remote.data.SurveyExporter
import java.text.DateFormat
import java.util.Date

private enum class Tab(val title: String) { MULTIVIEW("Камеры"), SOURCES("Источники"), WIFI("Wi‑Fi"), SURVEY("Обход") }

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun App(vm: MainViewModel = viewModel()) {
    val state by vm.state.collectAsState()
    var tab by remember { mutableStateOf(Tab.MULTIVIEW) }
    var showServer by remember { mutableStateOf(false) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Column {
                        Text("Stream Control Remote")
                        Text(
                            if (state.serverOnline) "SRS ${state.serverIp} · онлайн" else "SRS ${state.serverIp} · нет связи",
                            style = MaterialTheme.typography.labelSmall,
                            color = if (state.serverOnline) MaterialTheme.colorScheme.secondary else MaterialTheme.colorScheme.error
                        )
                    }
                },
                actions = {
                    TextButton(onClick = { showServer = true }) { Text("Сервер") }
                    TextButton(onClick = vm::refreshAll) { Text("Обновить") }
                }
            )
        },
        bottomBar = {
            NavigationBar {
                Tab.entries.forEach { item ->
                    NavigationBarItem(
                        selected = tab == item,
                        onClick = { tab = item },
                        icon = { Text(if (tab == item) "●" else "○") },
                        label = { Text(item.title) }
                    )
                }
            }
        }
    ) { padding ->
        Box(Modifier.padding(padding).fillMaxSize()) {
            when (tab) {
                Tab.MULTIVIEW -> MultiviewScreen(state)
                Tab.SOURCES -> SourcesScreen(state, vm)
                Tab.WIFI -> WifiScreen(state, vm)
                Tab.SURVEY -> SurveyScreen(state, vm)
            }
        }
    }

    if (showServer) {
        AlertDialog(
            onDismissRequest = { showServer = false },
            title = { Text("Ноутбук с SRS") },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                    OutlinedTextField(state.serverIp, vm::setServerIp, label = { Text("IP ноутбука") }, singleLine = true)
                    Text("API: http://${state.serverIp}:1985/api/v1/streams/")
                }
            },
            confirmButton = { Button(onClick = { vm.saveServerIp(); showServer = false }) { Text("Сохранить") } },
            dismissButton = { TextButton(onClick = { showServer = false }) { Text("Отмена") } }
        )
    }
}

@Composable
private fun MultiviewScreen(state: AppUiState) {
    val configured = state.profiles.associateBy { it.streamKey }
    LazyColumn(contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        if (state.streams.isEmpty()) item { InfoCard("Активных потоков нет", "Проверь IP ноутбука, SRS и RTMP-публикацию камер.") }
        items(state.streams, key = { it.id }) { stream -> StreamCard(configured[stream.name]?.name ?: stream.name, stream) }
    }
}

@Composable
private fun StreamCard(title: String, stream: StreamInfo) {
    Card {
        Column {
            FlvPlayer(stream.flvUrl)
            Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text(title, style = MaterialTheme.typography.titleMedium)
                    Text("LIVE", color = MaterialTheme.colorScheme.secondary)
                }
                Text(stream.name, style = MaterialTheme.typography.labelSmall)
                Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("%.1f Мбит/с".format(stream.bitrateKbps / 1000))
                    Text(if (stream.width != null && stream.height != null) "${stream.width}×${stream.height}" else "—")
                    Text(stream.fps?.let { "%.0f fps".format(it) } ?: "—")
                }
            }
        }
    }
}

@Composable
private fun FlvPlayer(url: String) {
    val context = LocalContext.current
    val player = remember(url) {
        ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.Builder().setUri(url).setMimeType(MimeTypes.VIDEO_FLV).build())
            playWhenReady = true; volume = 0f; prepare()
        }
    }
    DisposableEffect(player) { onDispose { player.release() } }
    AndroidView(
        factory = { ctx -> PlayerView(ctx).apply {
            this.player = player; useController = false
            layoutParams = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        } },
        modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f)
    )
}

@Composable
private fun SourcesScreen(state: AppUiState, vm: MainViewModel) {
    var showAdd by remember { mutableStateOf(false) }
    LazyColumn(contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item { Button(onClick = { showAdd = true }, modifier = Modifier.fillMaxWidth()) { Text("+ Добавить источник") } }
        items(state.profiles, key = { it.id }) { p ->
            Card {
                Row(Modifier.fillMaxWidth().padding(14.dp), horizontalArrangement = Arrangement.SpaceBetween) {
                    Column {
                        Text(p.name, style = MaterialTheme.typography.titleMedium)
                        Text("${p.type.title} · ${p.streamKey}")
                        Text("rtmp://${state.serverIp}/live/${p.streamKey}", style = MaterialTheme.typography.labelSmall)
                    }
                    TextButton(onClick = { vm.deleteProfile(p.id) }) { Text("Удалить", color = MaterialTheme.colorScheme.error) }
                }
            }
        }
    }
    if (showAdd) AddSourceDialog(state.serverIp, { showAdd = false }) { name, key, type -> vm.addProfile(name, key, type); showAdd = false }
}

@Composable
private fun AddSourceDialog(serverIp: String, onDismiss: () -> Unit, onCreate: (String, String, SourceType) -> Unit) {
    var name by remember { mutableStateOf("") }; var key by remember { mutableStateOf("") }; var type by remember { mutableStateOf(SourceType.GOPRO) }; var expanded by remember { mutableStateOf(false) }
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Добавить источник") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
                OutlinedTextField(name, { name = it }, label = { Text("Название") })
                OutlinedTextField(key, { key = it.lowercase().replace(Regex("[^a-z0-9_-]"), "-") }, label = { Text("RTMP-ключ") })
                Box {
                    OutlinedButton(onClick = { expanded = true }) { Text(type.title) }
                    DropdownMenu(expanded = expanded, onDismissRequest = { expanded = false }) {
                        SourceType.entries.forEach { t -> DropdownMenuItem(text = { Text(t.title) }, onClick = { type = t; expanded = false }) }
                    }
                }
                Text("rtmp://$serverIp/live/${key.ifBlank { "stream-key" }}")
            }
        },
        confirmButton = { Button(onClick = { onCreate(name, key, type) }, enabled = name.isNotBlank() && key.isNotBlank()) { Text("Создать") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Отмена") } }
    )
}

@Composable
private fun WifiScreen(state: AppUiState, vm: MainViewModel) {
    var apLabel by remember(state.wifi.bssid) { mutableStateOf(state.accessPointLabels[state.wifi.bssid].orEmpty()) }
    LazyColumn(contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
        item {
            Card {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(state.wifi.ssid, style = MaterialTheme.typography.headlineSmall)
                    Text(state.accessPointLabels[state.wifi.bssid] ?: "Неизвестная точка доступа", color = MaterialTheme.colorScheme.primary)
                    Metric("Сигнал", "${state.wifi.rssi} dBm · ${state.wifi.quality}")
                    Metric("BSSID", state.wifi.bssid)
                    Metric("Частота", "${state.wifi.frequencyMhz} МГц")
                    Metric("Канал", state.wifi.channel?.toString() ?: "—")
                    Metric("TX / RX", "${state.wifi.txLinkMbps} / ${state.wifi.rxLinkMbps} Мбит/с")
                    Metric("Задержка до SRS", state.wifi.pingMs?.let { "%.1f мс".format(it) } ?: "—")
                    Metric("Jitter", state.wifi.jitterMs?.let { "%.1f мс".format(it) } ?: "—")
                    Metric("Потери", state.wifi.packetLossPercent?.let { "%.0f %%".format(it) } ?: "—")
                }
            }
        }
        item {
            Card {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Подписать точку доступа", style = MaterialTheme.typography.titleMedium)
                    OutlinedTextField(apLabel, { apLabel = it }, label = { Text("Cudy основной или Mercusys репитер") }, modifier = Modifier.fillMaxWidth())
                    Button(onClick = { vm.saveAccessPointLabel(apLabel) }, enabled = apLabel.isNotBlank()) { Text("Сохранить для этого BSSID") }
                }
            }
        }
        item {
            val text = when {
                state.wifi.rssi >= -60 && (state.wifi.packetLossPercent ?: 100.0) <= 1.0 -> "Точка подходит для стабильного RTMP."
                state.wifi.rssi >= -67 && (state.wifi.packetLossPercent ?: 100.0) <= 5.0 -> "Работать можно, но проверь камеру тестовым потоком."
                else -> "Покрытие слабое. Перемести репитер ближе к основной точке или к зоне съёмки."
            }
            InfoCard("Оценка покрытия", text)
        }
    }
}

@Composable
private fun SurveyScreen(state: AppUiState, vm: MainViewModel) {
    var label by remember { mutableStateOf("") }
    LazyColumn(contentPadding = PaddingValues(12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
        item {
            Card {
                Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Добавить точку замера", style = MaterialTheme.typography.titleMedium)
                    OutlinedTextField(label, { label = it }, label = { Text("Сцена, финиш, поворот…") }, modifier = Modifier.fillMaxWidth())
                    Button(onClick = { vm.addSurveyPoint(label); label = "" }, enabled = label.isNotBlank(), modifier = Modifier.fillMaxWidth()) { Text("Сохранить текущий замер") }
                }
            }
        }
        item { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text("История замеров", style = MaterialTheme.typography.titleLarge); TextButton(onClick = vm::clearSurvey) { Text("Очистить", color = MaterialTheme.colorScheme.error) } } }
        items(state.survey, key = { it.id }) { point ->
            Card {
                Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
                    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(point.label, style = MaterialTheme.typography.titleMedium); Text(point.wifi.quality) }
                    Text(point.accessPointLabel, color = MaterialTheme.colorScheme.primary)
                    Text("${point.wifi.rssi} dBm · канал ${point.wifi.channel ?: "—"}")
                    Text("Ping ${point.wifi.pingMs?.let { "%.1f".format(it) } ?: "—"} мс · потери ${point.wifi.packetLossPercent?.let { "%.0f".format(it) } ?: "—"} %")
                    Text(DateFormat.getDateTimeInstance(DateFormat.SHORT, DateFormat.MEDIUM).format(Date(point.timestamp)), style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}

@Composable private fun Metric(label: String, value: String) { Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) { Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant); Text(value) } }
@Composable private fun InfoCard(title: String, text: String) { Card { Column(Modifier.fillMaxWidth().padding(16.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) { Text(title, style = MaterialTheme.typography.titleMedium); Text(text) } } }
