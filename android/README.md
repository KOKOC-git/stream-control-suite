# Stream Control Remote — Android 1.1.3

Мобильный пульт и анализатор Wi‑Fi для Stream Control Center и SRS.

## Новое в версии 1.1

### Автоматический поиск ноутбука

В окне «Сервер» появилась кнопка:

```text
Найти ноутбук автоматически
```

Приложение проверяет текущую локальную подсеть `/24` и ищет SRS API на
порту `1985`. Найденный сервер можно выбрать одним нажатием.

Автопоиск работает, когда телефон и ноутбук находятся в одной подсети и
между клиентами Wi‑Fi не включена изоляция.

### Рекомендации для беспроводного репитера

Оценка учитывает:

- RSSI;
- потери соединений до SRS;
- jitter;
- задержку до ноутбука.

Для размещения MERCUSYS в режиме повторителя приложение рекомендует место,
где сигнал основного Cudy ещё составляет примерно `−50…−62 dBm`.

Ставить повторитель уже в зоне `−70 dBm` и хуже бессмысленно: он будет
ретранслировать нестабильный сигнал.

### Экспорт обследования

Историю ручных замеров можно экспортировать в CSV и открыть в Excel:

- место;
- дата;
- подпись точки доступа;
- SSID и BSSID;
- RSSI;
- канал;
- TX/RX;
- ping;
- jitter;
- потери.

## Возможности

- HTTP-FLV-предпросмотр камер;
- активные потоки SRS;
- профили GoPro, DJI, телефонов и RTMP;
- формирование RTMP-адресов;
- RSSI и BSSID текущей точки;
- подписи «Cudy основной» и «Mercusys репитер»;
- режим обхода площадки;
- автоматический поиск SRS;
- экспорт CSV.

## Открытие проекта

1. Установи Android Studio.
2. Открой папку проекта.
3. Дождись Gradle Sync.
4. Подключи Android-телефон.
5. Нажми Run.

Минимальная версия: Android 8.0, API 26.


## Исправление JVM target в версии 1.1.1

Java и Kotlin теперь собираются под одинаковую JVM 17:

```kotlin
compileOptions {
    sourceCompatibility = JavaVersion.VERSION_17
    targetCompatibility = JavaVersion.VERSION_17
}

kotlin {
    jvmToolchain(17)
}
```

В Android Studio выбери:

```text
Settings → Build, Execution, Deployment → Build Tools → Gradle
Gradle JDK → jbr-17
```

После открытия обновлённого проекта:

```text
File → Sync Project with Gradle Files
Build → Clean Project
Build → Rebuild Project
```


## Исправление JDK в версии 1.1.2

Проект теперь использует встроенный JDK 21 современной Android Studio:

```kotlin
compileOptions {
    sourceCompatibility = JavaVersion.VERSION_21
    targetCompatibility = JavaVersion.VERSION_21
}

kotlin {
    jvmToolchain(21)
}
```

В Android Studio выбери:

```text
Settings
→ Build, Execution, Deployment
→ Build Tools
→ Gradle
→ Gradle JDK
→ Embedded JDK / jbr-21
```

Отдельно устанавливать JDK 17 больше не требуется.


## Исправления 1.1.3

- создан экземпляр `ServerDiscovery` в `MainViewModel`;
- исправлен экспорт `WifiSnapshot.quality` в CSV;
- добавлен `@OptIn(ExperimentalMaterial3Api::class)` для Material 3 TopAppBar;
- Java и Kotlin остаются на JVM 21.
