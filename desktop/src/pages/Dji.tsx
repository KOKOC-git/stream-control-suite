import type { SourceProfile, StreamMetric } from "../types";
import { SourceManager } from "../components/SourceManager";

export function Dji(props: {
  profiles: SourceProfile[];
  streams: StreamMetric[];
  ip: string;
  updateProfiles: (profiles: SourceProfile[]) => void;
}) {
  return (
    <>
      <div className="panel instruction-panel">
        <h2>DJI</h2>
        <p>
          Для устройств и приложений DJI, которые поддерживают пользовательский
          RTMP, введи адрес публикации из карточки источника.
        </p>
        <p>
          Можно создать отдельные профили для Pocket, Neo, дрона, камеры
          оператора или любого другого DJI-источника.
        </p>
      </div>

      <SourceManager type="dji" {...props} />
    </>
  );
}
