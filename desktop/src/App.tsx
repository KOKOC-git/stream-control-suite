import { useEffect, useState } from "react";
import { StatusPill } from "./components/StatusPill";
import { AddSourceWizard } from "./components/AddSourceWizard";
import { Dashboard } from "./pages/Dashboard";
import { GoPro } from "./pages/GoPro";
import { Phones } from "./pages/Phones";
import { Dji } from "./pages/Dji";
import { CustomRtmp } from "./pages/CustomRtmp";
import { ObsControl } from "./pages/ObsControl";
import { Diagnostics } from "./pages/Diagnostics";
import { Events } from "./pages/Events";
import { Recording } from "./pages/Recording";
import {
  getDashboard,
  getProfilesPath,
  getSrsLogs,
  openExternal,
  startStack,
  stopSrs
} from "./services/backend";
import {
  loadProfiles,
  saveProfiles
} from "./services/sourceProfiles";
import {
  clearEvents,
  loadEvents,
  loadMonitoringSettings,
  processMonitoringSnapshot,
  saveEvents,
  saveMonitoringSettings
} from "./services/monitoring";
import type {
  DashboardData,
  MonitoringSettings,
  SourceProfile,
  StreamEvent
} from "./types";

type Tab =
  | "dashboard"
  | "gopro"
  | "phones"
  | "dji"
  | "rtmp"
  | "obs"
  | "recording"
  | "events"
  | "diagnostics"
  | "logs";

const empty: DashboardData = {
  system: {
    dockerRunning: false,
    srsRunning: false,
    ipAddress: "",
    interfaceName: "",
    internetReachable: false,
    ports: {}
  },
  streams: [],
  checkedAt: ""
};

export default function App() {
  const [data, setData] = useState<DashboardData>(empty);
  const [profiles, setProfiles] = useState<SourceProfile[]>([]);
  const [profilesReady, setProfilesReady] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  const [tab, setTab] = useState<Tab>("dashboard");
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState("");
  const [busy, setBusy] = useState(false);
  const [events, setEvents] = useState<StreamEvent[]>(() =>
    loadEvents()
  );
  const [monitoringSettings, setMonitoringSettings] =
    useState<MonitoringSettings>(() =>
      loadMonitoringSettings()
    );

  useEffect(() => {
    loadProfiles()
      .then(result => {
        setProfiles(result);
        setProfilesReady(true);
      })
      .catch(error => {
        setMessage(`Профили: ${String(error)}`);
        setProfilesReady(true);
      });
  }, []);

  useEffect(() => {
    saveMonitoringSettings(monitoringSettings);
  }, [monitoringSettings]);

  const updateProfiles = (next: SourceProfile[]) => {
    setProfiles(next);
    saveProfiles(next).catch(error =>
      setMessage(`Сохранение профилей: ${String(error)}`)
    );
  };

  const refresh = async () => {
    try {
      const next = await getDashboard();
      setData(next);

      if (profilesReady) {
        const generated = processMonitoringSnapshot(
          next,
          profiles,
          monitoringSettings
        );

        if (generated.length) {
          setEvents(current => {
            const merged = [
              ...generated.reverse(),
              ...current
            ].slice(0, monitoringSettings.maxEvents);
            saveEvents(merged);
            return merged;
          });
        }
      }
    } catch (error) {
      setMessage(String(error));
    }
  };

  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;

    const poll = async () => {
      await refresh();
      if (!cancelled) {
        timer = window.setTimeout(poll, 1000);
      }
    };

    poll();
    return () => {
      cancelled = true;
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, []);

  const start = async () => {
    setBusy(true);
    try {
      setMessage(await startStack());
      await refresh();
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    try {
      setMessage(await stopSrs());
      await refresh();
    } catch (error) {
      setMessage(String(error));
    } finally {
      setBusy(false);
    }
  };

  const loadLogs = async () => {
    setTab("logs");
    try {
      setLogs(await getSrsLogs());
    } catch (error) {
      setLogs(String(error));
    }
  };

  const showProfilesFile = async () => {
    try {
      const path = await getProfilesPath();
      setMessage(`Профили хранятся: ${path}`);
    } catch (error) {
      setMessage(String(error));
    }
  };

  return (
    <main>
      <header className="topbar">
        <div>
          <h1>Stream Control Center</h1>
          <p>{data.system.ipAddress || "IP не определён"}</p>
        </div>

        <div className="status-row">
          <StatusPill
            label="Docker"
            active={data.system.dockerRunning}
          />
          <StatusPill label="SRS" active={data.system.srsRunning} />
          <StatusPill
            label="Интернет"
            active={data.system.internetReachable}
          />
        </div>
      </header>

      <div className="toolbar">
        <button onClick={start} disabled={busy}>
          Запустить Docker и SRS
        </button>
        <button
          className="secondary"
          onClick={stop}
          disabled={busy || !data.system.srsRunning}
        >
          Остановить SRS
        </button>
        <button
          className="add-source-main"
          onClick={() => setShowWizard(true)}
          disabled={!profilesReady}
        >
          + Добавить источник
        </button>
        <button className="secondary" onClick={refresh}>
          Обновить
        </button>
        <button className="secondary" onClick={loadLogs}>
          Логи SRS
        </button>
        <button
          className="secondary"
          onClick={showProfilesFile}
        >
          Файл профилей
        </button>
        <button
          className="secondary"
          disabled={!data.system.ipAddress}
          onClick={() =>
            openExternal(
              `http://${data.system.ipAddress}:1985/api/v1/streams/`
            )
          }
        >
          API потоков
        </button>
      </div>

      <nav className="main-nav">
        <button
          className={tab === "dashboard" ? "selected" : ""}
          onClick={() => setTab("dashboard")}
        >
          Мультивью
        </button>
        <button
          className={tab === "gopro" ? "selected" : ""}
          onClick={() => setTab("gopro")}
        >
          GoPro
        </button>
        <button
          className={tab === "phones" ? "selected" : ""}
          onClick={() => setTab("phones")}
        >
          Телефоны
        </button>
        <button
          className={tab === "dji" ? "selected" : ""}
          onClick={() => setTab("dji")}
        >
          DJI
        </button>
        <button
          className={tab === "rtmp" ? "selected" : ""}
          onClick={() => setTab("rtmp")}
        >
          Другой RTMP
        </button>
        <button
          className={tab === "obs" ? "selected" : ""}
          onClick={() => setTab("obs")}
        >
          OBS
        </button>
        <button
          className={tab === "recording" ? "selected" : ""}
          onClick={() => setTab("recording")}
        >
          Запись
        </button>
        <button
          className={tab === "events" ? "selected" : ""}
          onClick={() => setTab("events")}
        >
          События
          {events.some(
            event =>
              event.severity === "error" ||
              event.severity === "warning"
          ) && <span className="nav-alert-dot" />}
        </button>
        <button
          className={tab === "diagnostics" ? "selected" : ""}
          onClick={() => setTab("diagnostics")}
        >
          Диагностика
        </button>
        <button
          className={tab === "logs" ? "selected" : ""}
          onClick={loadLogs}
        >
          Логи
        </button>
      </nav>

      {message && <div className="message">{message}</div>}

      {tab === "dashboard" && (
        <Dashboard
          data={data}
          profiles={profiles}
          updateProfiles={updateProfiles}
          monitoringSettings={monitoringSettings}
        />
      )}

      {tab === "gopro" && (
        <GoPro
          profiles={profiles}
          streams={data.streams}
          ip={data.system.ipAddress}
          updateProfiles={updateProfiles}
        />
      )}

      {tab === "phones" && (
        <Phones
          profiles={profiles}
          streams={data.streams}
          ip={data.system.ipAddress}
          updateProfiles={updateProfiles}
        />
      )}

      {tab === "dji" && (
        <Dji
          profiles={profiles}
          streams={data.streams}
          ip={data.system.ipAddress}
          updateProfiles={updateProfiles}
        />
      )}

      {tab === "rtmp" && (
        <CustomRtmp
          profiles={profiles}
          streams={data.streams}
          ip={data.system.ipAddress}
          updateProfiles={updateProfiles}
        />
      )}

      {tab === "obs" && (
        <ObsControl
          report={setMessage}
          profiles={profiles}
          ip={data.system.ipAddress}
        />
      )}

      {tab === "recording" && (
        <Recording
          data={data}
          profiles={profiles}
          report={setMessage}
        />
      )}

      {tab === "events" && (
        <Events
          events={events}
          settings={monitoringSettings}
          updateSettings={setMonitoringSettings}
          clear={() => {
            clearEvents();
            setEvents([]);
          }}
        />
      )}

      {tab === "diagnostics" && (
        <Diagnostics data={data} />
      )}

      {tab === "logs" && (
        <section>
          <h2>Логи SRS</h2>
          <pre>{logs || "Логи пока не загружены."}</pre>
        </section>
      )}

      {showWizard && (
        <AddSourceWizard
          profiles={profiles}
          close={() => setShowWizard(false)}
          create={profile => {
            updateProfiles([...profiles, profile]);
            setShowWizard(false);
            setTab(
              profile.type === "phone"
                ? "phones"
                : profile.type === "dji"
                  ? "dji"
                  : profile.type === "rtmp"
                    ? "rtmp"
                    : "gopro"
            );
          }}
        />
      )}
    </main>
  );
}
