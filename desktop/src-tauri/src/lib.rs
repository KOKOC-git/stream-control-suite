use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::{
    collections::{HashMap, VecDeque},
    fs,
    io::Write,
    path::PathBuf,
    process::{Child, Command, Stdio},
    sync::Mutex,
    thread,
    time::{Duration, Instant, SystemTime, UNIX_EPOCH},
};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct SystemStatus {
    docker_running: bool,
    srs_running: bool,
    ip_address: String,
    interface_name: String,
    internet_reachable: bool,
    ports: HashMap<String, bool>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct StreamMetric {
    id: String,
    name: String,
    active: bool,
    bitrate_kbps: f64,
    width: Option<f64>,
    height: Option<f64>,
    fps: Option<f64>,
    // This field now contains elapsed stream duration in milliseconds,
    // not the raw SRS live_ms timestamp.
    live_ms: Option<f64>,
    clients: Option<f64>,
    flv_url: Option<String>,
    hls_url: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct DashboardData {
    system: SystemStatus,
    streams: Vec<StreamMetric>,
    checked_at: String,
}

#[derive(Clone)]
struct ByteSample {
    bytes: f64,
    measured_at: Instant,
}

struct StreamRuntime {
    previous: Option<ByteSample>,
    previous_frames: Option<(f64, Instant)>,
    bitrate_samples: VecDeque<f64>,
    fps_samples: VecDeque<f64>,
}

#[derive(Default)]
struct MonitorState {
    streams: Mutex<HashMap<String, StreamRuntime>>,
}
#[derive(Default)]
struct RecordingState {
    recordings: Mutex<HashMap<String, RecordingProcess>>,
}

struct RecordingProcess {
    child: Child,
    stream_key: String,
    display_name: String,
    output_path: PathBuf,
    started_at_ms: u128,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct IsoRecordingStatus {
    stream_key: String,
    display_name: String,
    output_path: String,
    started_at_ms: u128,
    pid: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct IsoRecordingEnvironment {
    ffmpeg_available: bool,
    ffmpeg_path: String,
    output_directory: String,
    recordings: Vec<IsoRecordingStatus>,
}


fn shell(command: &str) -> Result<String, String> {
    let output = Command::new("/bin/zsh")
        .args(["-lc", command])
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        let err = String::from_utf8_lossy(&output.stderr).trim().to_string();
        Err(if err.is_empty() {
            format!("Команда завершилась с кодом {:?}", output.status.code())
        } else {
            err
        })
    }
}

fn succeeds(command: &str) -> bool {
    shell(command).is_ok()
}

fn home_dir() -> PathBuf {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from("/"))
}

fn quote(value: &str) -> String {
    value.replace('\'', "'\\''")
}

fn detect_network() -> (String, String) {
    let iface =
        shell("route -n get default 2>/dev/null | awk '/interface:/{print $2}'")
            .unwrap_or_default();

    let ip = if iface.is_empty() {
        String::new()
    } else {
        shell(&format!(
            "ipconfig getifaddr '{}' 2>/dev/null",
            quote(&iface)
        ))
        .unwrap_or_default()
    };

    (iface, ip)
}

fn port_open(port: u16) -> bool {
    succeeds(&format!(
        "nc -z -w 1 127.0.0.1 {} >/dev/null 2>&1",
        port
    ))
}

fn as_num(v: Option<&Value>) -> Option<f64> {
    match v {
        Some(Value::Number(n)) => n.as_f64(),
        Some(Value::String(s)) => s.parse().ok(),
        _ => None,
    }
}

fn as_str(v: Option<&Value>) -> &str {
    v.and_then(Value::as_str).unwrap_or("")
}

fn smooth_bitrate(runtime: &mut StreamRuntime, value: f64) -> f64 {
    if value > 0.0 {
        runtime.bitrate_samples.push_back(value);
        while runtime.bitrate_samples.len() > 5 {
            runtime.bitrate_samples.pop_front();
        }
    }

    if runtime.bitrate_samples.is_empty() {
        0.0
    } else {
        runtime.bitrate_samples.iter().sum::<f64>()
            / runtime.bitrate_samples.len() as f64
    }
}

fn update_stream_runtime(
    state: &MonitorState,
    stream_name: &str,
    bytes_received: Option<f64>,
    frames: Option<f64>,
    api_bitrate_kbps: f64,
    live_timestamp_ms: Option<f64>,
) -> (f64, Option<f64>, Option<f64>) {
    let now = Instant::now();
    let mut streams = match state.streams.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    };

    let runtime = streams.entry(stream_name.to_string()).or_insert_with(|| {
        StreamRuntime {
            previous: None,
            previous_frames: None,
            bitrate_samples: VecDeque::new(),
            fps_samples: VecDeque::new(),
        }
    });

    let calculated_bitrate = match (bytes_received, runtime.previous.as_ref()) {
        (Some(bytes), Some(previous)) => {
            let elapsed = now.duration_since(previous.measured_at).as_secs_f64();
            if elapsed >= 0.5 && bytes >= previous.bytes {
                Some((bytes - previous.bytes) * 8.0 / elapsed / 1000.0)
            } else {
                None
            }
        }
        _ => None,
    };

    if let Some(bytes) = bytes_received {
        runtime.previous = Some(ByteSample {
            bytes,
            measured_at: now,
        });
    }

    let bitrate_candidate = calculated_bitrate
        .filter(|value| *value > 0.0)
        .or_else(|| (api_bitrate_kbps > 0.0).then_some(api_bitrate_kbps))
        .unwrap_or(0.0);

    let bitrate = smooth_bitrate(runtime, bitrate_candidate);

    let calculated_fps = match (frames, runtime.previous_frames.as_ref()) {
        (Some(current_frames), Some((previous_frames, previous_time))) => {
            let elapsed = now.duration_since(*previous_time).as_secs_f64();
            if elapsed >= 0.5 && current_frames >= *previous_frames {
                Some((current_frames - *previous_frames) / elapsed)
            } else {
                None
            }
        }
        _ => None,
    };

    if let Some(current_frames) = frames {
        runtime.previous_frames = Some((current_frames, now));
    }

    if let Some(value) = calculated_fps.filter(|value| *value > 0.0 && *value < 240.0) {
        runtime.fps_samples.push_back(value);
        while runtime.fps_samples.len() > 5 {
            runtime.fps_samples.pop_front();
        }
    }

    let fps = if runtime.fps_samples.is_empty() {
        None
    } else {
        Some(
            runtime.fps_samples.iter().sum::<f64>()
                / runtime.fps_samples.len() as f64,
        )
    };

    let duration_ms = live_timestamp_ms.and_then(|timestamp| {
        if timestamp > 1_000_000_000_000.0 {
            let unix_now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as f64;
            Some((unix_now - timestamp).max(0.0))
        } else if timestamp > 1_000_000_000.0 {
            let unix_now = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .unwrap_or_default()
                .as_millis() as f64;
            Some((unix_now - timestamp * 1000.0).max(0.0))
        } else if timestamp > 0.0 {
            Some(timestamp)
        } else {
            None
        }
    });

    (bitrate, fps, duration_ms)
}

fn remove_inactive_streams(state: &MonitorState, active_names: &[String]) {
    let mut streams = match state.streams.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    };
    streams.retain(|name, _| active_names.contains(name));
}

async fn read_streams(
    ip: &str,
    srs_running: bool,
    monitor_state: &MonitorState,
) -> Vec<StreamMetric> {
    if !srs_running || ip.is_empty() {
        remove_inactive_streams(monitor_state, &[]);
        return Vec::new();
    }

    let url = format!("http://{}:1985/api/v1/streams/", ip);
    let response = match reqwest::Client::new()
        .get(url)
        .timeout(Duration::from_secs(2))
        .send()
        .await
    {
        Ok(response) => response,
        Err(_) => return Vec::new(),
    };

    let root: Value = match response.json().await {
        Ok(value) => value,
        Err(_) => return Vec::new(),
    };

    let Some(items) = root
        .get("streams")
        .or_else(|| root.get("data"))
        .and_then(Value::as_array)
    else {
        return Vec::new();
    };

    let active_names = items
        .iter()
        .filter_map(|item| {
            let name = as_str(item.get("name"));
            (!name.is_empty()).then_some(name.to_string())
        })
        .collect::<Vec<_>>();

    remove_inactive_streams(monitor_state, &active_names);

    items
        .iter()
        .filter_map(|item| {
            let target = as_str(item.get("name")).to_string();
            if target.is_empty() {
                return None;
            }

            let kbps = item.get("kbps");
            let video = item.get("video");
            let publish = item.get("publish");

            let api_bitrate = as_num(kbps.and_then(|value| value.get("recv_30s")))
                .or_else(|| as_num(kbps.and_then(|value| value.get("recv_5s"))))
                .or_else(|| as_num(item.get("recv_kbps")))
                .unwrap_or(0.0);

            let bytes_received = as_num(item.get("recv_bytes"))
                .or_else(|| as_num(item.get("bytes_receive")))
                .or_else(|| as_num(item.get("bytes")));

            let frames = as_num(item.get("frames"));
            let raw_live_ms = as_num(item.get("live_ms"))
                .or_else(|| as_num(publish.and_then(|value| value.get("live_ms"))));

            let (bitrate, calculated_fps, duration_ms) = update_stream_runtime(
                monitor_state,
                &target,
                bytes_received,
                frames,
                api_bitrate,
                raw_live_ms,
            );

            Some(StreamMetric {
                id: item
                    .get("id")
                    .and_then(Value::as_str)
                    .unwrap_or(&target)
                    .to_string(),
                name: target.clone(),
                active: publish
                    .and_then(|value| value.get("active"))
                    .and_then(Value::as_bool)
                    .unwrap_or(true),
                bitrate_kbps: bitrate,
                width: as_num(video.and_then(|value| value.get("width")))
                    .or_else(|| as_num(item.get("width"))),
                height: as_num(video.and_then(|value| value.get("height")))
                    .or_else(|| as_num(item.get("height"))),
                fps: as_num(video.and_then(|value| value.get("fps")))
                    .or_else(|| as_num(video.and_then(|value| value.get("frame_rate"))))
                    .or_else(|| as_num(item.get("fps")))
                    .or(calculated_fps),
                live_ms: duration_ms,
                clients: as_num(item.get("clients")),
                flv_url: Some(format!(
                    "http://{}:8080/live/{}.flv",
                    ip, target
                )),
                hls_url: Some(format!(
                    "http://{}:8080/live/{}.m3u8",
                    ip, target
                )),
            })
        })
        .collect()
}


fn unix_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}

fn ffmpeg_path() -> Option<String> {
    shell("command -v ffmpeg 2>/dev/null")
        .ok()
        .filter(|value| !value.trim().is_empty())
}

fn sanitize_filename(value: &str) -> String {
    let cleaned = value
        .chars()
        .map(|character| {
            if character.is_alphanumeric()
                || character == '-'
                || character == '_'
                || character == ' '
            {
                character
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim()
        .to_string();

    if cleaned.is_empty() {
        "source".to_string()
    } else {
        cleaned
    }
}

fn iso_recordings_dir() -> Result<PathBuf, String> {
    let date = shell("date +%Y-%m-%d")
        .unwrap_or_else(|_| "recordings".to_string());
    let dir = home_dir()
        .join("Movies")
        .join("Stream Control Center")
        .join(date);
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

fn prune_recordings(state: &RecordingState) {
    let mut recordings = match state.recordings.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    };

    recordings.retain(|_, process| {
        match process.child.try_wait() {
            Ok(Some(_)) => false,
            Ok(None) => true,
            Err(_) => false,
        }
    });
}

fn recording_environment(
    state: &RecordingState,
) -> Result<IsoRecordingEnvironment, String> {
    prune_recordings(state);

    let path = ffmpeg_path().unwrap_or_default();
    let output_directory = iso_recordings_dir()?;
    let recordings = match state.recordings.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    };

    let mut statuses = recordings
        .values()
        .map(|process| IsoRecordingStatus {
            stream_key: process.stream_key.clone(),
            display_name: process.display_name.clone(),
            output_path: process.output_path.to_string_lossy().to_string(),
            started_at_ms: process.started_at_ms,
            pid: process.child.id(),
        })
        .collect::<Vec<_>>();

    statuses.sort_by_key(|status| status.started_at_ms);

    Ok(IsoRecordingEnvironment {
        ffmpeg_available: !path.is_empty(),
        ffmpeg_path: path,
        output_directory: output_directory.to_string_lossy().to_string(),
        recordings: statuses,
    })
}

fn stop_recording_process(
    process: &mut RecordingProcess,
) -> Result<(), String> {
    if let Some(stdin) = process.child.stdin.as_mut() {
        let _ = stdin.write_all(b"q\n");
        let _ = stdin.flush();
    }

    for _ in 0..30 {
        match process.child.try_wait() {
            Ok(Some(_)) => return Ok(()),
            Ok(None) => thread::sleep(Duration::from_millis(100)),
            Err(error) => return Err(error.to_string()),
        }
    }

    process.child.kill().map_err(|error| error.to_string())?;
    let _ = process.child.wait();
    Ok(())
}

#[tauri::command]
fn get_iso_recording_environment(
    recording_state: tauri::State<'_, RecordingState>,
) -> Result<IsoRecordingEnvironment, String> {
    recording_environment(recording_state.inner())
}

#[tauri::command]
fn start_iso_recording(
    stream_key: String,
    display_name: String,
    input_url: String,
    recording_state: tauri::State<'_, RecordingState>,
) -> Result<IsoRecordingEnvironment, String> {
    if stream_key.trim().is_empty() {
        return Err("Пустой RTMP-ключ.".into());
    }

    if !(input_url.starts_with("http://")
        || input_url.starts_with("https://")
        || input_url.starts_with("rtmp://"))
    {
        return Err("Недопустимый адрес входного потока.".into());
    }

    let ffmpeg = ffmpeg_path()
        .ok_or_else(|| "FFmpeg не найден. Выполни: brew install ffmpeg".to_string())?;

    prune_recordings(recording_state.inner());

    {
        let recordings = match recording_state.recordings.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };
        if recordings.contains_key(&stream_key) {
            return Err(format!("{} уже записывается.", display_name));
        }
    }

    let directory = iso_recordings_dir()?;
    let timestamp = shell("date +%H-%M-%S")
        .unwrap_or_else(|_| unix_ms().to_string());
    let filename = format!(
        "{}_{}_{}.mkv",
        timestamp,
        sanitize_filename(&display_name),
        sanitize_filename(&stream_key)
    );
    let output_path = directory.join(filename);
    let log_path = output_path.with_extension("ffmpeg.log");
    let log_file = fs::File::create(&log_path)
        .map_err(|error| format!("Не удалось создать лог FFmpeg: {}", error))?;
    let log_error = log_file
        .try_clone()
        .map_err(|error| error.to_string())?;

    let child = Command::new(ffmpeg)
        .args([
            "-hide_banner",
            "-loglevel",
            "warning",
            "-fflags",
            "+genpts",
            "-i",
            &input_url,
            "-map",
            "0",
            "-c",
            "copy",
            "-f",
            "matroska",
            "-y",
        ])
        .arg(&output_path)
        .stdin(Stdio::piped())
        .stdout(Stdio::from(log_file))
        .stderr(Stdio::from(log_error))
        .spawn()
        .map_err(|error| format!("Не удалось запустить FFmpeg: {}", error))?;

    let process = RecordingProcess {
        child,
        stream_key: stream_key.clone(),
        display_name,
        output_path,
        started_at_ms: unix_ms(),
    };

    let mut recordings = match recording_state.recordings.lock() {
        Ok(guard) => guard,
        Err(poisoned) => poisoned.into_inner(),
    };
    recordings.insert(stream_key, process);
    drop(recordings);

    thread::sleep(Duration::from_millis(250));
    recording_environment(recording_state.inner())
}

#[tauri::command]
fn stop_iso_recording(
    stream_key: String,
    recording_state: tauri::State<'_, RecordingState>,
) -> Result<IsoRecordingEnvironment, String> {
    let mut process = {
        let mut recordings = match recording_state.recordings.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };

        recordings
            .remove(&stream_key)
            .ok_or_else(|| "Эта запись уже не активна.".to_string())?
    };

    stop_recording_process(&mut process)?;
    recording_environment(recording_state.inner())
}

#[tauri::command]
fn stop_all_iso_recordings(
    recording_state: tauri::State<'_, RecordingState>,
) -> Result<IsoRecordingEnvironment, String> {
    let processes = {
        let mut recordings = match recording_state.recordings.lock() {
            Ok(guard) => guard,
            Err(poisoned) => poisoned.into_inner(),
        };
        recordings.drain().map(|(_, process)| process).collect::<Vec<_>>()
    };

    for mut process in processes {
        let _ = stop_recording_process(&mut process);
    }

    recording_environment(recording_state.inner())
}

#[tauri::command]
fn open_iso_recordings_folder() -> Result<(), String> {
    let directory = iso_recordings_dir()?;
    Command::new("open")
        .arg(directory)
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SourceProfile {
    id: String,
    name: String,
    stream_key: String,
    #[serde(rename = "type")]
    source_type: String,
    enabled: bool,
    notes: Option<String>,
    created_at: Option<String>,
    updated_at: Option<String>,
    preview_mode: Option<String>,
}

fn profiles_dir() -> Result<PathBuf, String> {
    let home = home_dir();
    let dir = home
        .join("Library")
        .join("Application Support")
        .join("Stream Control Center");
    fs::create_dir_all(&dir).map_err(|error| error.to_string())?;
    Ok(dir)
}

fn profiles_file() -> Result<PathBuf, String> {
    Ok(profiles_dir()?.join("sources.json"))
}

#[tauri::command]
fn load_profiles() -> Result<Vec<SourceProfile>, String> {
    let path = profiles_file()?;
    if !path.exists() {
        return Ok(Vec::new());
    }

    let text = fs::read_to_string(&path)
        .map_err(|error| format!("Не удалось прочитать {}: {}", path.display(), error))?;

    if text.trim().is_empty() {
        return Ok(Vec::new());
    }

    serde_json::from_str(&text)
        .map_err(|error| format!("Повреждён файл профилей: {}", error))
}

#[tauri::command]
fn save_profiles(profiles: Vec<SourceProfile>) -> Result<(), String> {
    let path = profiles_file()?;
    let temporary = path.with_extension("json.tmp");
    let data = serde_json::to_string_pretty(&profiles)
        .map_err(|error| error.to_string())?;

    fs::write(&temporary, data)
        .map_err(|error| format!("Не удалось записать профили: {}", error))?;

    fs::rename(&temporary, &path)
        .map_err(|error| format!("Не удалось сохранить профили: {}", error))?;

    Ok(())
}

#[tauri::command]
fn get_profiles_path() -> Result<String, String> {
    Ok(profiles_file()?.to_string_lossy().to_string())
}

#[tauri::command]
async fn get_dashboard(
    monitor_state: tauri::State<'_, MonitorState>,
) -> Result<DashboardData, String> {
    let docker = succeeds("docker info >/dev/null 2>&1");

    let names = if docker {
        shell("docker ps --format '{{.Names}}' 2>/dev/null").unwrap_or_default()
    } else {
        String::new()
    };

    let srs = names.lines().any(|name| name == "srs-rtmp");
    let (iface, ip) = detect_network();

    let mut ports = HashMap::new();
    for port in [1935u16, 1985, 8080] {
        ports.insert(port.to_string(), port_open(port));
    }

    let system = SystemStatus {
        docker_running: docker,
        srs_running: srs,
        ip_address: ip.clone(),
        interface_name: iface,
        internet_reachable: succeeds(
            "curl -I --max-time 3 https://1.1.1.1 >/dev/null 2>&1",
        ),
        ports,
    };

    let streams = read_streams(&ip, srs, monitor_state.inner()).await;

    Ok(DashboardData {
        system,
        streams,
        checked_at: format!("{:?}", SystemTime::now()),
    })
}

fn ensure_srs_preview_config(srs: &PathBuf) -> Result<(), String> {
    let config = r#"listen              1935;
max_connections     1000;
daemon              off;
srs_log_tank        console;

http_api {
    enabled         on;
    listen          1985;
}

http_server {
    enabled         on;
    listen          8080;
    dir             ./objs/nginx/html;
}

vhost __defaultVhost__ {
    tcp_nodelay     on;
    min_latency     on;

    play {
        gop_cache   off;
        queue_length 10;
        mw_latency  100;
    }

    http_remux {
        enabled     on;
        mount       [vhost]/[app]/[stream].flv;
    }

    hls {
        enabled     on;
        hls_path    ./objs/nginx/html;
        hls_fragment 1;
        hls_window  4;
        hls_cleanup on;
    }
}
"#;

    let override_yaml = r#"services:
  srs:
    volumes:
      - ./scc-preview.conf:/usr/local/srs/conf/scc-preview.conf:ro
    command: ./objs/srs -c conf/scc-preview.conf
"#;

    fs::write(srs.join("scc-preview.conf"), config)
        .map_err(|error| format!("Не удалось записать конфигурацию SRS: {}", error))?;
    fs::write(srs.join("docker-compose.scc.yml"), override_yaml)
        .map_err(|error| format!("Не удалось записать override Docker Compose: {}", error))?;
    Ok(())
}

#[tauri::command]
fn open_in_vlc(url: String) -> Result<(), String> {
    let status = Command::new("open")
        .args(["-a", "VLC", &url])
        .status()
        .map_err(|error| error.to_string())?;

    if status.success() {
        Ok(())
    } else {
        Err("VLC не найден или не удалось открыть поток.".into())
    }
}

#[tauri::command]
fn start_stack() -> Result<String, String> {
    if !PathBuf::from("/Applications/Docker.app").exists() {
        return Err("Docker Desktop не найден в /Applications.".into());
    }

    let srs = home_dir().join("srs");
    if !srs.exists() {
        return Err(format!("Папка SRS не найдена: {}", srs.display()));
    }

    ensure_srs_preview_config(&srs)?;

    if !succeeds("docker info >/dev/null 2>&1") {
        shell("open -a Docker")?;

        let mut ready = false;
        for _ in 0..90 {
            if succeeds("docker info >/dev/null 2>&1") {
                ready = true;
                break;
            }
            thread::sleep(Duration::from_secs(2));
        }

        if !ready {
            return Err("Docker Engine не запустился за 3 минуты.".into());
        }
    }

    shell(&format!(
        "cd '{}' && docker compose -f docker-compose.yml -f docker-compose.scc.yml up -d --force-recreate",
        quote(&srs.to_string_lossy())
    ))?;

    Ok("Docker и SRS готовы. Можно подключать камеры.".into())
}

#[tauri::command]
fn stop_srs(
    monitor_state: tauri::State<'_, MonitorState>,
) -> Result<String, String> {
    let srs = home_dir().join("srs");

    shell(&format!(
        "cd '{}' && docker compose -f docker-compose.yml -f docker-compose.scc.yml down",
        quote(&srs.to_string_lossy())
    ))?;

    match monitor_state.streams.lock() {
        Ok(mut guard) => guard.clear(),
        Err(poisoned) => poisoned.into_inner().clear(),
    }

    Ok("SRS остановлен.".into())
}

#[tauri::command]
fn get_srs_logs() -> Result<String, String> {
    shell("docker logs --tail 150 srs-rtmp 2>&1")
}

#[tauri::command]
fn launch_obs() -> Result<String, String> {
    shell("open -a OBS")?;
    Ok("OBS запускается.".into())
}

#[tauri::command]
fn is_obs_running() -> bool {
    succeeds("pgrep -x OBS >/dev/null 2>&1")
}

#[tauri::command]
fn open_external(url: String) -> Result<(), String> {
    Command::new("open")
        .arg(url)
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(MonitorState::default())
        .manage(RecordingState::default())
        .invoke_handler(tauri::generate_handler![
            get_dashboard,
            load_profiles,
            save_profiles,
            get_profiles_path,
            get_iso_recording_environment,
            start_iso_recording,
            stop_iso_recording,
            stop_all_iso_recordings,
            open_iso_recordings_folder,
            open_in_vlc,
            start_stack,
            stop_srs,
            get_srs_logs,
            launch_obs,
            is_obs_running,
            open_external
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Stream Control Center");
}
