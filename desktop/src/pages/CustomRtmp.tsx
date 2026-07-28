import type {
  SourceProfile,
  StreamMetric
} from "../types";
import { SourceManager } from "../components/SourceManager";

export function CustomRtmp(props: {
  profiles: SourceProfile[];
  streams: StreamMetric[];
  ip: string;
  updateProfiles: (profiles: SourceProfile[]) => void;
}) {
  return (
    <>
      <div className="panel instruction-panel">
        <h2>Другие RTMP-источники</h2>
        <p>
          Аппаратные энкодеры, IP-камеры, OBS, видеомикшеры и любые
          устройства, которые умеют публиковать RTMP.
        </p>
        <div className="instruction-code">
          <span>Базовый сервер</span>
          <code>rtmp://{props.ip || "IP"}/live</code>
        </div>
      </div>

      <SourceManager type="rtmp" {...props} />
    </>
  );
}
