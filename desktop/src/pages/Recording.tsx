import { useEffect, useMemo, useState } from "react";
import type {
  DashboardData,
  IsoRecordingEnvironment,
  SourceProfile
} from "../types";
import {
  getIsoRecordingEnvironment,
  openIsoRecordingsFolder,
  startIsoRecording,
  stopAllIsoRecordings,
  stopIsoRecording
} from "../services/backend";

const empty: IsoRecordingEnvironment = {
  ffmpegAvailable: false,
  ffmpegPath: "",
  outputDirectory: "",
  recordings: []
};

function elapsed(startedAtMs: number, now: number) {
  const seconds = Math.max(
    0,
    Math.floor((now - startedAtMs) / 1000)
  );
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;

  return [hours, minutes, rest]
    .map(value => String(value).padStart(2, "0"))
    .join(":");
}

export function Recording({
  data,
  profiles,
  report
}: {
  data: DashboardData;
  profiles: SourceProfile[];
  report: (message: string) => void;
}) {
  const [environment, setEnvironment] =
    useState<IsoRecordingEnvironment>(empty);
  const [busyKeys, setBusyKeys] = useState<Set<string>>(
    () => new Set()
  );
  const [now, setNow] = useState(Date.now());

  const refresh = async () => {
    try {
      setEnvironment(await getIsoRecordingEnvironment());
    } catch (error) {
      report(`ISO-запись: ${String(error)}`);
    }
  };

  useEffect(() => {
    refresh();
    const statusTimer = window.setInterval(refresh, 1500);
    const clockTimer = window.setInterval(
      () => setNow(Date.now()),
      1000
    );

    return () => {
      window.clearInterval(statusTimer);
      window.clearInterval(clockTimer);
    };
  }, []);

  const activeProfiles = useMemo(
    () =>
      profiles.filter(profile =>
        data.streams.some(
          stream =>
            stream.name === profile.streamKey &&
            stream.active
        )
      ),
    [profiles, data.streams]
  );

  const recordingMap = useMemo(
    () =>
      new Map(
        environment.recordings.map(item => [
          item.streamKey,
          item
        ])
      ),
    [environment.recordings]
  );

  const withBusy = async (
    streamKey: string,
    action: () => Promise<IsoRecordingEnvironment>
  ) => {
    setBusyKeys(current => new Set(current).add(streamKey));
    try {
      setEnvironment(await action());
    } catch (error) {
      report(`ISO-запись: ${String(error)}`);
    } finally {
      setBusyKeys(current => {
        const next = new Set(current);
        next.delete(streamKey);
        return next;
      });
    }
  };

  const start = (profile: SourceProfile) => {
    const stream = data.streams.find(
      item => item.name === profile.streamKey
    );

    if (!stream?.active || !stream.flvUrl) {
      report(`${profile.name}: активный поток не найден.`);
      return;
    }

    withBusy(profile.streamKey, () =>
      startIsoRecording(
        profile.streamKey,
        profile.name,
        stream.flvUrl!
      )
    );
  };

  const stop = (streamKey: string) =>
    withBusy(streamKey, () =>
      stopIsoRecording(streamKey)
    );

  const startAll = async () => {
    for (const profile of activeProfiles) {
      if (recordingMap.has(profile.streamKey)) continue;
      const stream = data.streams.find(
        item => item.name === profile.streamKey
      );
      if (!stream?.flvUrl) continue;

      try {
        const next = await startIsoRecording(
          profile.streamKey,
          profile.name,
          stream.flvUrl
        );
        setEnvironment(next);
      } catch (error) {
        report(`${profile.name}: ${String(error)}`);
      }
    }
  };

  const stopAll = async () => {
    try {
      setEnvironment(await stopAllIsoRecordings());
      report("Все ISO-записи остановлены.");
    } catch (error) {
      report(`ISO-запись: ${String(error)}`);
    }
  };

  return (
    <section>
      <div className="section-title">
        <div>
          <h2>ISO-запись</h2>
          <p>
            Отдельный файл для каждого RTMP-источника без
            перекодирования
          </p>
        </div>

        <div className="recording-top-actions">
          <button
            disabled={
              !environment.ffmpegAvailable ||
              !activeProfiles.length
            }
            onClick={startAll}
          >
            Записать все активные
          </button>
          <button
            className="danger"
            disabled={!environment.recordings.length}
            onClick={stopAll}
          >
            Остановить все
          </button>
        </div>
      </div>

      <div
        className={`recording-environment ${
          environment.ffmpegAvailable ? "ready" : "missing"
        }`}
      >
        <div>
          <strong>
            {environment.ffmpegAvailable
              ? "FFmpeg готов"
              : "FFmpeg не найден"}
          </strong>
          <p>
            {environment.ffmpegAvailable
              ? environment.ffmpegPath
              : "Установи FFmpeg через Homebrew: brew install ffmpeg"}
          </p>
        </div>

        <button
          className="secondary"
          onClick={openIsoRecordingsFolder}
        >
          Открыть папку записей
        </button>
      </div>

      <div className="recording-summary">
        <span>
          Активных потоков: {activeProfiles.length}
        </span>
        <span>
          Записывается: {environment.recordings.length}
        </span>
        <span>
          Формат: MKV · Copy
        </span>
      </div>

      <div className="recording-list">
        {profiles.map(profile => {
          const stream = data.streams.find(
            item => item.name === profile.streamKey
          );
          const active = Boolean(stream?.active);
          const recording = recordingMap.get(profile.streamKey);
          const busy = busyKeys.has(profile.streamKey);

          return (
            <article
              className={`recording-card ${
                recording ? "is-recording" : ""
              }`}
              key={profile.id}
            >
              <div className="recording-source-info">
                <span
                  className={`status-dot ${active ? "active" : ""}`}
                />
                <div>
                  <strong>{profile.name}</strong>
                  <p>
                    {profile.streamKey} ·{" "}
                    {active ? "В эфире" : "Не в сети"}
                  </p>
                </div>
              </div>

              <div className="recording-state">
                {recording ? (
                  <>
                    <span className="recording-live-dot" />
                    <strong>
                      {elapsed(recording.startedAtMs, now)}
                    </strong>
                    <small title={recording.outputPath}>
                      {recording.outputPath.split("/").pop()}
                    </small>
                  </>
                ) : (
                  <span>Не записывается</span>
                )}
              </div>

              <div className="recording-card-actions">
                {recording ? (
                  <button
                    className="danger"
                    disabled={busy}
                    onClick={() => stop(profile.streamKey)}
                  >
                    Остановить
                  </button>
                ) : (
                  <button
                    disabled={
                      busy ||
                      !active ||
                      !environment.ffmpegAvailable
                    }
                    onClick={() => start(profile)}
                  >
                    Начать запись
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>

      {!profiles.length && (
        <div className="empty-panel">
          <strong>Нет сохранённых источников</strong>
          <p>
            Сначала добавь камеры или телефоны как профили.
          </p>
        </div>
      )}

      <div className="recording-note">
        Файлы сохраняются в:
        <code>{environment.outputDirectory || "—"}</code>
        Контейнер MKV лучше переносит аварийную остановку, чем MP4.
      </div>
    </section>
  );
}
