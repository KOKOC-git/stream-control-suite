# Сборка

## Android

Требования:

- актуальная Android Studio;
- Embedded JDK / jbr-21;
- Android SDK 35.

Команды:

```bash
cd android
./gradlew assembleDebug
```

При отсутствии Gradle Wrapper сборку запускай из Android Studio. Wrapper будет добавлен после первой подтверждённой сборки.

## Desktop macOS

```bash
cd desktop
npm install
npm run tauri build
```

## Desktop Windows

Используй `desktop/Собрать приложение Windows.bat`. Сборка Windows-инсталлятора выполняется на Windows.
