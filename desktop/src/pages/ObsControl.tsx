import { useEffect, useState } from "react";
import type { ObsStatus, SourceProfile } from "../types";
import {
  connectObs,
  disconnectObs,
  getObsStatus,
  pauseRecording,
  resumeRecording,
  selectScene,
  startRecording,
  startStreaming,
  stopRecording,
  stopStreaming,
  layoutSharedScene,
  syncProfilesToIndividualScenes,
  syncProfilesToSharedScene,
  type ObsSyncResult
} from "../services/obs";
import { isObsRunning, launchObs } from "../services/backend";

const empty: ObsStatus = {
  connected: false,
  currentScene: "",
  scenes: [],
  recording: false,
  recordingPaused: false,
  streaming: false,
  recordTimecode: "00:00:00",
  streamTimecode: "00:00:00"
};

export function ObsControl({
  report,
  profiles,
  ip
}: {
  report: (message: string) => void;
  profiles: SourceProfile[];
  ip: string;
}) {
  const [address, setAddress] = useState(
    localStorage.getItem("obs-address") ?? "ws://127.0.0.1:4455"
  );
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<ObsStatus>(empty);
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [sharedSceneName, setSharedSceneName] = useState(
    localStorage.getItem("obs-shared-scene") ?? "SCC · Все источники"
  );
  const [lastSync, setLastSync] = useState<ObsSyncResult | null>(null);

  useEffect(() => {
    localStorage.setItem("obs-address", address);
  }, [address]);

  useEffect(() => {
    localStorage.setItem("obs-shared-scene", sharedSceneName);
  }, [sharedSceneName]);

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const [obsRunning, obsStatus] = await Promise.all([
          isObsRunning(),
          status.connected ? getObsStatus() : Promise.resolve(status)
        ]);
        if (!cancelled) {
          setRunning(obsRunning);
          if (status.connected) setStatus(obsStatus);
        }
      } catch {
        // Keep last known state.
      }

      if (!cancelled) timer = window.setTimeout(poll, 1000);
    };

    poll();

    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [status.connected]);

  const perform = async (
    action: () => Promise<ObsStatus>,
    success: string
  ) => {
    setBusy(true);
    try {
      setStatus(await action());
      report(success);
    } catch (error) {
      report(`OBS: ${String(error)}`);
    } finally {
      setBusy(false);
    }
  };

  const openObs = async () => {
    try {
      report(await launchObs());
      setRunning(true);
    } catch (error) {
      report(`OBS: ${String(error)}`);
    }
  };

  const connect = () =>
    perform(
      () => connectObs(address, password),
      "Подключение к OBS WebSocket установлено."
    );

  const runSync = async (
    action: () => Promise<ObsSyncResult>,
    label: string
  ) => {
    setSyncBusy(true);
    try {
      const result = await action();
      setLastSync(result);
      setStatus(await getObsStatus());
      report(
        `${label}: сцен создано ${result.scenesCreated}, источников создано ${result.inputsCreated}, обновлено ${result.inputsUpdated}.`
      );
    } catch (error) {
      report(`OBS: ${String(error)}`);
    } finally {
      setSyncBusy(false);
    }
  };

  const disconnect = () =>
    perform(disconnectObs, "OBS WebSocket отключён.");

  return (
    <section className="obs-layout">
      <div className="panel">
        <div className="obs-title-row">
          <div>
            <h2>Подключение к OBS</h2>
            <p>OBS WebSocket 5 · стандартный порт 4455</p>
          </div>
          <span className={`obs-connection ${status.connected ? "online" : ""}`}>
            {status.connected ? "Подключено" : running ? "OBS запущен" : "OBS закрыт"}
          </span>
        </div>

        <label>
          Адрес WebSocket
          <input
            value={address}
            onChange={event => setAddress(event.target.value)}
            placeholder="ws://127.0.0.1:4455"
          />
        </label>

        <label>
          Пароль
          <input
            type="password"
            value={password}
            onChange={event => setPassword(event.target.value)}
            placeholder="Пароль из настроек OBS"
          />
        </label>

        <div className="toolbar obs-buttons">
          <button onClick={openObs}>Открыть OBS</button>
          {!status.connected ? (
            <button onClick={connect} disabled={busy}>
              Подключиться
            </button>
          ) : (
            <button className="secondary" onClick={disconnect} disabled={busy}>
              Отключиться
            </button>
          )}
        </div>

        <div className="obs-help">
          В OBS открой:
          <strong> Инструменты → Настройки сервера WebSocket</strong>.
          Включи сервер, проверь порт 4455 и пароль.
        </div>
      </div>

      <div className="panel">
        <h2>Сцены</h2>
        <p>Текущая программная сцена</p>

        <select
          value={status.currentScene}
          disabled={!status.connected || busy}
          onChange={event =>
            perform(
              () => selectScene(event.target.value),
              `Выбрана сцена «${event.target.value}».`
            )
          }
        >
          {!status.scenes.length && <option>Нет доступных сцен</option>}
          {status.scenes.map(scene => (
            <option key={scene} value={scene}>{scene}</option>
          ))}
        </select>

        <div className="scene-grid">
          {status.scenes.map(scene => (
            <button
              key={scene}
              className={scene === status.currentScene ? "scene active" : "scene secondary"}
              disabled={!status.connected || busy}
              onClick={() =>
                perform(
                  () => selectScene(scene),
                  `Выбрана сцена «${scene}».`
                )
              }
            >
              {scene}
            </button>
          ))}
        </div>
      </div>

      <div className="panel output-panel">
        <div className="output-card">
          <div>
            <span>Запись</span>
            <strong>{status.recording ? status.recordTimecode : "Остановлена"}</strong>
          </div>
          <span className={`output-dot ${status.recording ? "recording" : ""}`} />
        </div>

        <div className="output-actions">
          {!status.recording ? (
            <button
              disabled={!status.connected || busy}
              onClick={() => perform(startRecording, "Запись OBS запущена.")}
            >
              Начать запись
            </button>
          ) : (
            <>
              <button
                className="danger"
                disabled={busy}
                onClick={() => perform(stopRecording, "Запись OBS остановлена.")}
              >
                Остановить запись
              </button>
              <button
                className="secondary"
                disabled={busy}
                onClick={() =>
                  status.recordingPaused
                    ? perform(resumeRecording, "Запись продолжена.")
                    : perform(pauseRecording, "Запись приостановлена.")
                }
              >
                {status.recordingPaused ? "Продолжить" : "Пауза"}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="panel obs-automation-panel">
        <h2>Автоматическое создание</h2>
        <p>
          Приложение создаст Media Source с HTTP-FLV-адресами сохранённых
          профилей. Повторный запуск обновит URL и не создаст дубликаты.
        </p>

        <label>
          Название общей сцены
          <input
            value={sharedSceneName}
            onChange={event => setSharedSceneName(event.target.value)}
          />
        </label>

        <div className="obs-auto-actions">
          <button
            disabled={
              !status.connected ||
              !profiles.length ||
              !ip ||
              syncBusy ||
              !sharedSceneName.trim()
            }
            onClick={() =>
              runSync(
                () =>
                  syncProfilesToSharedScene(
                    profiles.map(profile => ({
                      name: profile.name,
                      streamKey: profile.streamKey
                    })),
                    ip,
                    sharedSceneName.trim()
                  ),
                "Общая сцена синхронизирована"
              )
            }
          >
            Создать общую сцену
          </button>

          <button
            className="secondary"
            disabled={
              !status.connected ||
              !profiles.length ||
              !ip ||
              syncBusy
            }
            onClick={() =>
              runSync(
                () =>
                  syncProfilesToIndividualScenes(
                    profiles.map(profile => ({
                      name: profile.name,
                      streamKey: profile.streamKey
                    })),
                    ip
                  ),
                "Отдельные сцены синхронизированы"
              )
            }
          >
            Создать сцены камер
          </button>

          <button
            className="secondary"
            disabled={
              !status.connected ||
              !profiles.length ||
              syncBusy ||
              !sharedSceneName.trim()
            }
            onClick={async () => {
              setSyncBusy(true);
              try {
                const positioned = await layoutSharedScene(
                  profiles.map(profile => ({
                    name: profile.name,
                    streamKey: profile.streamKey
                  })),
                  sharedSceneName.trim()
                );
                report(
                  `OBS: размещено элементов в общей сцене — ${positioned}.`
                );
                setStatus(await getObsStatus());
              } catch (error) {
                report(`OBS: ${String(error)}`);
              } finally {
                setSyncBusy(false);
              }
            }}
          >
            Перестроить сетку
          </button>
        </div>

        <div className="obs-sync-summary">
          <span>Профилей: {profiles.length}</span>
          <span>IP: {ip || "не определён"}</span>
          {lastSync && (
            <span>
              Последняя синхронизация: +{lastSync.inputsCreated} источников,
              {lastSync.inputsUpdated} обновлено,
              {lastSync.sceneItemsPositioned} размещено
            </span>
          )}
        </div>
      </div>

      <div className="panel output-panel">
        <div className="output-card">
          <div>
            <span>Трансляция OBS</span>
            <strong>{status.streaming ? status.streamTimecode : "Остановлена"}</strong>
          </div>
          <span className={`output-dot ${status.streaming ? "streaming" : ""}`} />
        </div>

        <div className="output-actions">
          {!status.streaming ? (
            <button
              disabled={!status.connected || busy}
              onClick={() => perform(startStreaming, "Трансляция OBS запущена.")}
            >
              Начать трансляцию
            </button>
          ) : (
            <button
              className="danger"
              disabled={busy}
              onClick={() => perform(stopStreaming, "Трансляция OBS остановлена.")}
            >
              Остановить трансляцию
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
