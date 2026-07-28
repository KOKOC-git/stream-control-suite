# Stream Control Center 3.0 — Windows

## Поддерживаемая система

- Windows 10 x64 или Windows 11 x64;
- Docker Desktop с WSL 2;
- OBS Studio 28+;
- Node.js LTS;
- Rust MSVC;
- FFmpeg в `PATH` — только для ISO-записи.

## Что портировано

- запуск и проверка Docker Desktop;
- запуск SRS через Docker Compose;
- определение локального IPv4;
- проверка портов 1935, 1985 и 8080;
- мультивью HTTP-FLV;
- OBS WebSocket на `ws://127.0.0.1:4455`;
- запуск OBS Studio;
- профили источников;
- журнал событий;
- ISO-запись через `ffmpeg.exe`;
- сборка установщика NSIS `.exe`.

## Пути Windows

Профили:

```text
%APPDATA%\Stream Control Center\sources.json
```

ISO-записи:

```text
%USERPROFILE%\Videos\Stream Control Center\ГГГГ-ММ-ДД\
```

SRS по умолчанию:

```text
%USERPROFILE%\srs\docker-compose.yml
```

Можно задать другую папку системной переменной:

```text
SCC_SRS_DIR
```

## Первичная подготовка

1. Установи Docker Desktop и включи WSL 2.
2. Установи Node.js LTS.
3. Установи Rust через `rustup-init.exe` с toolchain MSVC.
4. Установи Microsoft C++ Build Tools.
5. Установи OBS Studio.
6. Для ISO-записи установи FFmpeg и добавь его в `PATH`.
7. Запусти `windows-srs-example\Установить SRS в профиль.bat`.
8. Запусти `Проверить Windows.ps1`.

## Режим разработки

Двойной клик:

```text
Запустить проект Windows.bat
```

либо:

```powershell
npm install
npm run tauri dev
```

## Сборка установщика

Двойной клик:

```text
Собрать приложение Windows.bat
```

Готовый установщик:

```text
src-tauri\target\release\bundle\nsis\Stream Control Center_3.0.0_x64-setup.exe
```

## Сеть и брандмауэр

Windows Defender Firewall должен разрешать входящие TCP-подключения к:

- `1935` — RTMP;
- `1985` — API SRS;
- `8080` — HTTP-FLV/HLS.

Камеры и компьютер должны находиться в одной локальной сети.
