# План локального API Stream Control Center

Android 1.1.3 пока читает SRS напрямую и хранит профили локально. Следующий этап — API настольного приложения.

Предлагаемые маршруты:

```text
GET    /api/system
GET    /api/profiles
POST   /api/profiles
PUT    /api/profiles/{id}
DELETE /api/profiles/{id}
GET    /api/streams
GET    /api/events
GET    /api/recordings
POST   /api/recordings/{streamKey}/start
POST   /api/recordings/{streamKey}/stop
GET    /api/obs
POST   /api/obs/scenes/{scene}/activate
```

API должен слушать только локальную сеть и использовать токен сопряжения.
