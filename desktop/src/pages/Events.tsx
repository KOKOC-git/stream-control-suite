import { useMemo, useState } from "react";
import type {
  MonitoringSettings,
  StreamEvent
} from "../types";

function formatTime(timestamp: string) {
  const date = new Date(timestamp);
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

export function Events({
  events,
  settings,
  updateSettings,
  clear
}: {
  events: StreamEvent[];
  settings: MonitoringSettings;
  updateSettings: (settings: MonitoringSettings) => void;
  clear: () => void;
}) {
  const [filter, setFilter] = useState<
    "all" | "info" | "warning" | "error" | "success"
  >("all");

  const filtered = useMemo(
    () =>
      filter === "all"
        ? events
        : events.filter(event => event.severity === filter),
    [events, filter]
  );

  return (
    <section>
      <div className="section-title">
        <div>
          <h2>События и предупреждения</h2>
          <p>{events.length} записей в журнале</p>
        </div>

        <button
          className="danger"
          disabled={!events.length}
          onClick={clear}
        >
          Очистить журнал
        </button>
      </div>

      <div className="monitor-settings panel">
        <h2>Пороговые значения</h2>

        <div className="monitor-settings-grid">
          <label>
            Низкий битрейт, Кбит/с
            <input
              type="number"
              min="0"
              step="100"
              value={settings.lowBitrateKbps}
              onChange={event =>
                updateSettings({
                  ...settings,
                  lowBitrateKbps: Math.max(
                    0,
                    Number(event.target.value)
                  )
                })
              }
            />
          </label>

          <label>
            Низкий FPS
            <input
              type="number"
              min="0"
              step="1"
              value={settings.lowFps}
              onChange={event =>
                updateSettings({
                  ...settings,
                  lowFps: Math.max(
                    0,
                    Number(event.target.value)
                  )
                })
              }
            />
          </label>

          <label>
            Задержка предупреждения, сек.
            <input
              type="number"
              min="1"
              step="1"
              value={settings.debounceSeconds}
              onChange={event =>
                updateSettings({
                  ...settings,
                  debounceSeconds: Math.max(
                    1,
                    Number(event.target.value)
                  )
                })
              }
            />
          </label>

          <label>
            Максимум событий
            <input
              type="number"
              min="50"
              step="50"
              value={settings.maxEvents}
              onChange={event =>
                updateSettings({
                  ...settings,
                  maxEvents: Math.max(
                    50,
                    Number(event.target.value)
                  )
                })
              }
            />
          </label>
        </div>
      </div>

      <div className="event-filters">
        {(["all", "error", "warning", "success", "info"] as const).map(
          value => (
            <button
              key={value}
              className={
                filter === value ? "selected" : "secondary"
              }
              onClick={() => setFilter(value)}
            >
              {value === "all"
                ? "Все"
                : value === "error"
                  ? "Ошибки"
                  : value === "warning"
                    ? "Предупреждения"
                    : value === "success"
                      ? "Восстановления"
                      : "Информация"}
            </button>
          )
        )}
      </div>

      <div className="event-list">
        {filtered.map(item => (
          <article
            className={`event-row severity-${item.severity}`}
            key={item.id}
          >
            <span className="event-indicator" />
            <time>{formatTime(item.timestamp)}</time>
            <div>
              <strong>
                {item.sourceName ?? "Система"}
              </strong>
              <p>{item.message}</p>
            </div>
          </article>
        ))}

        {!filtered.length && (
          <div className="empty-panel">
            <strong>Событий нет</strong>
            <p>
              Журнал начнёт заполняться после подключений,
              отключений или ухудшения качества потоков.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
