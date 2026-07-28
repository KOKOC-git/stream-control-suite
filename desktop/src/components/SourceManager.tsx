import { useMemo, useState } from "react";
import type { SourceProfile, SourceType, StreamMetric } from "../types";
import { createProfile, sanitizeStreamKey } from "../services/sourceProfiles";

const labels: Record<SourceType, string> = {
  gopro: "GoPro",
  phone: "Телефон",
  dji: "DJI",
  rtmp: "RTMP"
};

export function SourceManager({
  type,
  profiles,
  streams,
  ip,
  updateProfiles,
  extra
}: {
  type: SourceType;
  profiles: SourceProfile[];
  streams: StreamMetric[];
  ip: string;
  updateProfiles: (profiles: SourceProfile[]) => void;
  extra?: (profile: SourceProfile) => React.ReactNode;
}) {
  const filtered = useMemo(
    () => profiles.filter(profile => profile.type === type),
    [profiles, type]
  );
  const [editingId, setEditingId] = useState<string | null>(null);

  const add = () => {
    const nextIndex = filtered.length + 1;
    updateProfiles([...profiles, createProfile(type, nextIndex)]);
  };

  const update = (id: string, patch: Partial<SourceProfile>) => {
    updateProfiles(
      profiles.map(profile =>
        profile.id === id
          ? {
              ...profile,
              ...patch,
              updatedAt: new Date().toISOString()
            }
          : profile
      )
    );
  };

  const remove = (id: string) => {
    updateProfiles(profiles.filter(profile => profile.id !== id));
  };

  return (
    <section>
      <div className="section-title">
        <div>
          <h2>{labels[type]}</h2>
          <p>Можно создать любое количество источников</p>
        </div>
        <button onClick={add}>Добавить источник</button>
      </div>

      <div className="source-list">
        {filtered.map(profile => {
          const stream = streams.find(item => item.name === profile.streamKey);
          const active = Boolean(stream?.active);
          const rtmp = ip
            ? `rtmp://${ip}/live/${profile.streamKey}`
            : `rtmp://IP/live/${profile.streamKey}`;

          return (
            <article className="source-profile-card" key={profile.id}>
              <div className="source-profile-head">
                <div>
                  <div className="source-profile-title">
                    <span className={`status-dot ${active ? "active" : ""}`} />
                    <strong>{profile.name}</strong>
                  </div>
                  <p>{active ? "В эфире" : "Не в сети"} · {profile.streamKey}</p>
                </div>

                <div className="profile-actions">
                  <button
                    className="secondary compact"
                    onClick={() =>
                      setEditingId(editingId === profile.id ? null : profile.id)
                    }
                  >
                    {editingId === profile.id ? "Готово" : "Изменить"}
                  </button>
                  <button
                    className="danger compact"
                    onClick={() => remove(profile.id)}
                  >
                    Удалить
                  </button>
                </div>
              </div>

              {editingId === profile.id && (
                <div className="profile-editor">
                  <label>
                    Название
                    <input
                      value={profile.name}
                      onChange={event =>
                        update(profile.id, { name: event.target.value })
                      }
                    />
                  </label>

                  <label>
                    RTMP-ключ
                    <input
                      value={profile.streamKey}
                      onChange={event =>
                        update(profile.id, {
                          streamKey: sanitizeStreamKey(event.target.value)
                        })
                      }
                    />
                  </label>

                  <label>
                    Примечание
                    <input
                      value={profile.notes ?? ""}
                      onChange={event =>
                        update(profile.id, { notes: event.target.value })
                      }
                    />
                  </label>

                  <label>
                    Движок предпросмотра
                    <select
                      value={
                        profile.previewMode ??
                        (profile.type === "dji" ? "hls" : "auto")
                      }
                      onChange={event =>
                        update(profile.id, {
                          previewMode: event.target.value as
                            | "auto"
                            | "flv"
                            | "hls"
                        })
                      }
                    >
                      <option value="auto">Автоматически</option>
                      <option value="flv">HTTP-FLV</option>
                      <option value="hls">HLS</option>
                    </select>
                  </label>
                </div>
              )}

              <div className="source-address">
                <span>Адрес публикации</span>
                <code>{rtmp}</code>
                <button
                  className="secondary compact"
                  onClick={() => navigator.clipboard.writeText(rtmp)}
                >
                  Копировать
                </button>
              </div>

              {stream && active && (
                <div className="source-live-metrics">
                  <span>{(stream.bitrateKbps / 1000).toFixed(1)} Мбит/с</span>
                  <span>
                    {stream.width && stream.height
                      ? `${stream.width}×${stream.height}`
                      : "—"}
                  </span>
                  <span>{stream.fps ? `${stream.fps.toFixed(0)} fps` : "—"}</span>
                </div>
              )}

              {extra?.(profile)}
            </article>
          );
        })}

        {!filtered.length && (
          <div className="empty-panel">
            <strong>Источников пока нет</strong>
            <p>Нажми «Добавить источник», чтобы создать первый профиль.</p>
          </div>
        )}
      </div>
    </section>
  );
}
