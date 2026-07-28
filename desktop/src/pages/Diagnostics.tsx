import type { DashboardData } from "../types";

export function Diagnostics({ data }: { data: DashboardData }) {
  const checks = [
    ["Docker Desktop", data.system.dockerRunning, data.system.dockerRunning ? "Docker Engine работает" : "Docker не запущен"],
    ["SRS", data.system.srsRunning, data.system.srsRunning ? "Контейнер srs-rtmp работает" : "Контейнер не запущен"],
    ["Локальная сеть", Boolean(data.system.ipAddress), data.system.ipAddress || "IP не определён"],
    ["Порт RTMP 1935", data.system.ports["1935"] ?? false, data.system.ports["1935"] ? "Доступен" : "Недоступен"],
    ["API SRS 1985", data.system.ports["1985"] ?? false, data.system.ports["1985"] ? "Доступен" : "Недоступен"],
    ["HTTP SRS 8080", data.system.ports["8080"] ?? false, data.system.ports["8080"] ? "Доступен" : "Недоступен"],
    ["Интернет", data.system.internetReachable, data.system.internetReachable ? "Доступ есть" : "Проверь WISP или мобильную сеть"],
    ["RTMP-источники", data.streams.length > 0, `${data.streams.length} активных потоков`]
  ] as const;

  return (
    <section>
      <h2>Предстартовая диагностика</h2>
      <div className="check-list">
        {checks.map(([label, ok, detail]) => (
          <div className="check" key={label}>
            <span className={`check-icon ${ok ? "ok" : ""}`}>{ok ? "✓" : "!"}</span>
            <div><strong>{label}</strong><p>{detail}</p></div>
          </div>
        ))}
      </div>
    </section>
  );
}
