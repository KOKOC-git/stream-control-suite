import { useMemo, useState } from "react";
import type {
  DashboardData,
  MonitoringSettings,
  SourceProfile,
  StreamMetric
} from "../types";
import { CameraPreview } from "../components/CameraPreview";
import { FullscreenSourceModal } from "../components/FullscreenSourceModal";
import { SaveUnknownStreamModal } from "../components/SaveUnknownStreamModal";
import { DeleteSourceModal } from "../components/DeleteSourceModal";
import { normalizeProfileOrder } from "../services/sourceProfiles";
import { sourceHealth } from "../services/monitoring";

type SelectedSource = {
  profile?: SourceProfile;
  stream?: StreamMetric;
} | null;

function formatDuration(ms?: number) {
  if (!ms || ms <= 0) return "—";
  const total = Math.floor(ms / 1000);
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;

  return hours > 0
    ? [hours, minutes, seconds]
        .map(value => String(value).padStart(2, "0"))
        .join(":")
    : [minutes, seconds]
        .map(value => String(value).padStart(2, "0"))
        .join(":");
}

function SourceTile({
  profile,
  stream,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  open,
  saveUnknown,
  removeProfile,
  health
}: {
  profile?: SourceProfile;
  stream?: StreamMetric;
  draggable?: boolean;
  onDragStart?: () => void;
  onDragOver?: (event: React.DragEvent) => void;
  onDrop?: () => void;
  open: () => void;
  saveUnknown?: () => void;
  removeProfile?: () => void;
  health?: "offline" | "warning" | "good";
}) {
  const active = Boolean(stream?.active);
  const title = profile?.name ?? stream?.name ?? "Источник";
  const streamKey = profile?.streamKey ?? stream?.name ?? "";

  return (
    <article
      className={`multiview-card ${active ? "online" : ""} ${
        health === "warning" ? "health-warning" : ""
      }`}
      draggable={Boolean(draggable)}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
    >
      <div className="multiview-preview-wrap" onDoubleClick={open}>
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

        <div className="multiview-card-actions">
          <button
            className="fullscreen-button"
            title="Открыть крупно"
            onClick={open}
          >
            ⛶
          </button>

          {removeProfile && (
            <button
              className="delete-card-button"
              title="Удалить профиль"
              onClick={event => {
                event.stopPropagation();
                removeProfile();
              }}
            >
              ×
            </button>
          )}
        </div>
      </div>

      <div className="multiview-info">
        <div className="multiview-title-row">
          <div>
            <strong>{title}</strong>
            <span>{streamKey}</span>
          </div>

          <span
            className={`stream-state ${
              health === "warning"
                ? "warning"
                : active
                  ? "online"
                  : ""
            }`}
          >
            {health === "warning"
              ? "Проблема"
              : active
                ? "В эфире"
                : "Не в сети"}
          </span>
        </div>

        <div className="multiview-metrics">
          <span>
            {active && stream
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
          <span>{formatDuration(stream?.liveMs)}</span>
        </div>

        {saveUnknown && (
          <button className="save-unknown-button" onClick={saveUnknown}>
            Сохранить как профиль
          </button>
        )}
      </div>
    </article>
  );
}

export function Dashboard({
  data,
  profiles,
  updateProfiles,
  monitoringSettings
}: {
  data: DashboardData;
  profiles: SourceProfile[];
  updateProfiles: (profiles: SourceProfile[]) => void;
  monitoringSettings: MonitoringSettings;
}) {
  const orderedProfiles = useMemo(
    () => normalizeProfileOrder(profiles),
    [profiles]
  );

  const configuredKeys = new Set(
    profiles.map(profile => profile.streamKey)
  );

  const unknownStreams = data.streams.filter(
    stream => !configuredKeys.has(stream.name)
  );

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [selected, setSelected] = useState<SelectedSource>(null);
  const [unknownToSave, setUnknownToSave] =
    useState<StreamMetric | null>(null);
  const [profileToDelete, setProfileToDelete] =
    useState<SourceProfile | null>(null);
  const [showUnknown, setShowUnknown] = useState(
    () => localStorage.getItem("multiview-show-unknown") === "true"
  );

  const activeProfileCount = profiles.filter(profile =>
    data.streams.some(
      stream =>
        stream.name === profile.streamKey && stream.active
    )
  ).length;

  const visibleProfileStreams = data.streams.filter(stream =>
    configuredKeys.has(stream.name)
  );

  const totalBitrate =
    visibleProfileStreams.reduce(
      (sum, stream) => sum + stream.bitrateKbps,
      0
    ) / 1000;

  const changeUnknownVisibility = (value: boolean) => {
    setShowUnknown(value);
    localStorage.setItem(
      "multiview-show-unknown",
      String(value)
    );
  };

  const reorder = (targetId: string) => {
    if (!draggedId || draggedId === targetId) return;

    const items = [...orderedProfiles];
    const from = items.findIndex(profile => profile.id === draggedId);
    const to = items.findIndex(profile => profile.id === targetId);

    if (from < 0 || to < 0) return;

    const [moved] = items.splice(from, 1);
    items.splice(to, 0, moved);

    updateProfiles(
      items.map((profile, index) => ({
        ...profile,
        order: index,
        updatedAt: new Date().toISOString()
      }))
    );
    setDraggedId(null);
  };

  return (
    <section>
      <div className="section-title">
        <div>
          <h2>Мультивью</h2>
          <p>
            {activeProfileCount} в эфире · {profiles.length} сохранённых профилей
          </p>
        </div>

        <div className="multiview-header-actions">
          {unknownStreams.length > 0 && (
            <label className="unknown-toggle">
              <input
                type="checkbox"
                checked={showUnknown}
                onChange={event =>
                  changeUnknownVisibility(event.target.checked)
                }
              />
              Показывать неизвестные ({unknownStreams.length})
            </label>
          )}

          <strong>{totalBitrate.toFixed(1)} Мбит/с всего</strong>
        </div>
      </div>

      <div className="multiview-grid">
        {orderedProfiles.map(profile => {
          const stream = data.streams.find(
            item => item.name === profile.streamKey
          );

          return (
            <SourceTile
              key={profile.id}
              profile={profile}
              stream={stream}
              draggable
              onDragStart={() => setDraggedId(profile.id)}
              onDragOver={event => event.preventDefault()}
              onDrop={() => reorder(profile.id)}
              open={() => setSelected({ profile, stream })}
              removeProfile={() => setProfileToDelete(profile)}
              health={sourceHealth(
                profile,
                data,
                monitoringSettings
              )}
            />
          );
        })}

        {showUnknown &&
          unknownStreams.map(stream => (
            <SourceTile
              key={stream.id}
              stream={stream}
              open={() => setSelected({ stream })}
              saveUnknown={() => setUnknownToSave(stream)}
            />
          ))}
      </div>

      {!profiles.length &&
        (!showUnknown || !unknownStreams.length) && (
          <div className="empty-panel">
            <strong>Источников пока нет</strong>
            <p>
              Создай первый профиль кнопкой «Добавить источник».
            </p>
          </div>
        )}

      {unknownStreams.length > 0 && (
        <div className="unknown-streams-note">
          Обнаружено неизвестных потоков: {unknownStreams.length}.{" "}
          {showUnknown
            ? "Они временно показаны и могут быть сохранены как профили."
            : "Они скрыты и не участвуют в мультивью."}
        </div>
      )}

      {selected && (
        <FullscreenSourceModal
          profile={selected.profile}
          stream={selected.stream}
          close={() => setSelected(null)}
        />
      )}

      {profileToDelete && (
        <DeleteSourceModal
          profile={profileToDelete}
          active={Boolean(
            data.streams.find(
              stream => stream.name === profileToDelete.streamKey
            )?.active
          )}
          close={() => setProfileToDelete(null)}
          confirm={() => {
            updateProfiles(
              normalizeProfileOrder(
                profiles.filter(
                  profile => profile.id !== profileToDelete.id
                )
              )
            );
            setProfileToDelete(null);
          }}
        />
      )}

      {unknownToSave && (
        <SaveUnknownStreamModal
          stream={unknownToSave}
          close={() => setUnknownToSave(null)}
          save={profile => {
            updateProfiles([
              ...profiles,
              {
                ...profile,
                order: profiles.length
              }
            ]);
            setUnknownToSave(null);
          }}
        />
      )}
    </section>
  );
}
