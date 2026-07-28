# Stream Control Suite

Единый репозиторий системы многокамерной RTMP-трансляции.

## Состав

- `desktop/` — Stream Control Center для macOS и Windows на Tauri 2;
- `android/` — Stream Control Remote для Android;
- `shared/` — общие модели и контракты локального API;
- `docs/` — документация по сети, SRS, OBS и сборке;
- `scripts/` — вспомогательные проверки и команды;
- `releases/` — место для готовых сборок, не хранящихся в Git.

## Архитектура

```text
GoPro / DJI / телефоны
          │ RTMP :1935
          ▼
Ноутбук: SRS + Stream Control Center + OBS
          │ SRS API :1985 / HTTP-FLV :8080
          ▼
Android: Stream Control Remote
```

Сервер, OBS и ISO-запись работают на ноутбуке. Android используется как мобильный мультивью, мастер подключения камер и анализатор Wi‑Fi.

## Быстрый старт

### Desktop

```bash
cd desktop
npm install
npm run tauri dev
```

### Android

Открой папку `android/` в Android Studio и выбери встроенный JDK 21. Затем выполни Gradle Sync и `assembleDebug`.

## Текущий статус

- Android 1.1.3: исправлены известные ошибки Kotlin-компиляции из 1.1.2;
- Desktop 3.0: кроссплатформенная ветка macOS/Windows;
- синхронизация профилей Android ↔ Desktop пока не реализована;
- десктопная Windows-сборка должна проверяться непосредственно на Windows.
