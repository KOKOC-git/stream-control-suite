# Stream Control Center 2.9

## Исправление предпросмотра DJI на macOS

DJI Fly может публиковать корректный RTMP-поток, который работает в OBS,
но зависает после первого кадра в `mpegts.js` внутри WebKit/Tauri.

В версии 2.9 добавлено:

- режим предпросмотра `Автоматически / HTTP-FLV / HLS` для каждого профиля;
- HLS по умолчанию для новых источников DJI;
- обнаружение зависшего первого кадра;
- автоматический переход с HTTP-FLV на HLS через 4 секунды без новых кадров;
- ручной перезапуск предпросмотра;
- кнопка `Открыть в VLC`;
- отдельная конфигурация SRS, включающая HTTP-FLV и короткий HLS.

## Конфигурация SRS

При нажатии `Запустить Docker и SRS` приложение создаёт в `~/srs`:

```text
scc-preview.conf
docker-compose.scc.yml
```

Исходный `docker-compose.yml` не изменяется. Сервер запускается командой:

```bash
docker compose \
  -f docker-compose.yml \
  -f docker-compose.scc.yml \
  up -d --force-recreate
```

HLS-поток доступен по адресу:

```text
http://IP_НОУТБУКА:8080/live/STREAM_KEY.m3u8
```

HTTP-FLV остаётся доступен:

```text
http://IP_НОУТБУКА:8080/live/STREAM_KEY.flv
```

## Настройка DJI

Во вкладке DJI открой `Изменить` и выбери:

```text
Движок предпросмотра: HLS
```

Для остальных источников можно оставить `Автоматически`.

## Запуск

```bash
npm install
npm run tauri dev
```

## Сборка

```bash
npm run tauri build
```
