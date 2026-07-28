import type { SourceProfile, StreamMetric } from "../types";
import { CameraPreview } from "./CameraPreview";

export function FullscreenSourceModal({
  profile,
  stream,
  close
}: {
  profile?: SourceProfile;
  stream?: StreamMetric;
  close: () => void;
}) {
  const title = profile?.name ?? stream?.name ?? "Источник";
  const key = profile?.streamKey ?? stream?.name ?? "";
  const active = Boolean(stream?.active);

  return (
    <div className="fullscreen-source" onClick={close}>
      <div
        className="fullscreen-source-inner"
        onClick={event => event.stopPropagation()}
      >
        <div className="fullscreen-header">
          <div>
            <h2>{title}</h2>
            <p>{key}</p>
          </div>
          <button className="secondary" onClick={close}>
            Закрыть
          </button>
        </div>

        <div className="fullscreen-video">
          <CameraPreview
            active={active}
            flvUrl={stream?.flvUrl}
            hlsUrl={stream?.hlsUrl}
            camera={0}
            mode={
              profile?.previewMode ??
              (profile?.type === "dji" ? "hls" : "auto")
            }
          />
        </div>

        <div className="fullscreen-metrics">
          <span>
            {stream
              ? `${(stream.bitrateKbps / 1000).toFixed(1)} Мбит/с`
              : "—"}
          </span>
          <span>
            {stream?.width && stream?.height
              ? `${stream.width}×${stream.height}`
              : "—"}
          </span>
          <span>
            {stream?.fps ? `${stream.fps.toFixed(0)} fps` : "—"}
          </span>
          <span>{active ? "В эфире" : "Не в сети"}</span>
        </div>
      </div>
    </div>
  );
}
