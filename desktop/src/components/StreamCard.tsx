import type { PreviewMode, StreamMetric } from "../types";
import { CameraPreview } from "./CameraPreview";

function duration(ms?: number) {
  if (!ms || ms <= 0) return "—";
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? [h, m, s].map(v => String(v).padStart(2, "0")).join(":")
    : [m, s].map(v => String(v).padStart(2, "0")).join(":");
}

export function StreamCard({
  stream,
  displayName,
  rename,
  previewMode = "auto"
}: {
  stream: StreamMetric;
  displayName: string;
  rename?: () => void;
  previewMode?: PreviewMode;
}) {
  const bitrate = stream.active
    ? stream.bitrateKbps >= 1000
      ? `${(stream.bitrateKbps / 1000).toFixed(1)} Мбит/с`
      : `${stream.bitrateKbps.toFixed(0)} Кбит/с`
    : "—";

  const resolution =
    stream.width && stream.height ? `${stream.width}×${stream.height}` : "—";

  return (
    <article className="stream-card">
      <CameraPreview
        active={stream.active}
        flvUrl={stream.flvUrl}
        hlsUrl={stream.hlsUrl}
        camera={0}
        mode={previewMode}
      />
      <div className="stream-head">
        <div>
          <div className="source-name-line">
            <h3>{displayName}</h3>
            {rename && (
              <button
                className="rename-button"
                title="Переименовать источник"
                onClick={rename}
              >
                ✎
              </button>
            )}
          </div>
          <p>/live/{stream.name}</p>
        </div>
        <span className={`stream-state ${stream.active ? "online" : ""}`}>
          {stream.active ? "В эфире" : "Нет сигнала"}
        </span>
      </div>

      <div className="metric-grid">
        <Metric label="Битрейт" value={bitrate} />
        <Metric label="Разрешение" value={resolution} />
        <Metric label="FPS" value={stream.fps ? stream.fps.toFixed(0) : "—"} />
        <Metric label="В эфире" value={duration(stream.liveMs)} />
      </div>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}
