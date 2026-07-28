import type { SourceProfile, StreamMetric } from "../types";
import { SourceManager } from "../components/SourceManager";

export function Phones(props: {
  profiles: SourceProfile[];
  streams: StreamMetric[];
  ip: string;
  updateProfiles: (profiles: SourceProfile[]) => void;
}) {
  return (
    <>
      <div className="panel instruction-panel">
        <h2>Телефоны</h2>
        <p>
          Подойдут Larix Broadcaster, CameraFi Live, PRISM Live Studio и другие
          приложения, умеющие отправлять RTMP.
        </p>
        <div className="instruction-code">
          <span>Server URL</span>
          <code>rtmp://{props.ip || "IP"}/live</code>
        </div>
        <p>Stream Key берётся из карточки источника: например <code>phone1</code>.</p>
      </div>

      <SourceManager type="phone" {...props} />
    </>
  );
}
