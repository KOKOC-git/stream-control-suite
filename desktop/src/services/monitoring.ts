import type {
  DashboardData,
  MonitoringSettings,
  SourceProfile,
  StreamEvent
} from "../types";

const EVENTS_KEY = "stream-control-events-v1";
const SETTINGS_KEY = "stream-control-monitor-settings-v1";

type SourceState = {
  active: boolean;
  bitrateLow: boolean;
  fpsLow: boolean;
  bitrateSince?: number;
  fpsSince?: number;
};

type SystemState = {
  dockerRunning: boolean;
  srsRunning: boolean;
  internetReachable: boolean;
};

const sourceStates = new Map<string, SourceState>();
let previousSystem: SystemState | null = null;
let initialized = false;

export function loadMonitoringSettings(): MonitoringSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (!raw) {
      return {
        lowBitrateKbps: 1500,
        lowFps: 20,
        debounceSeconds: 5,
        maxEvents: 500
      };
    }

    const parsed = JSON.parse(raw);
    return {
      lowBitrateKbps: Number(parsed.lowBitrateKbps) || 1500,
      lowFps: Number(parsed.lowFps) || 20,
      debounceSeconds: Number(parsed.debounceSeconds) || 5,
      maxEvents: Number(parsed.maxEvents) || 500
    };
  } catch {
    return {
      lowBitrateKbps: 1500,
      lowFps: 20,
      debounceSeconds: 5,
      maxEvents: 500
    };
  }
}

export function saveMonitoringSettings(
  settings: MonitoringSettings
): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function loadEvents(): StreamEvent[] {
  try {
    const raw = localStorage.getItem(EVENTS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveEvents(events: StreamEvent[]): void {
  localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
}

export function clearEvents(): void {
  localStorage.removeItem(EVENTS_KEY);
}

function event(
  severity: StreamEvent["severity"],
  type: StreamEvent["type"],
  message: string,
  source?: SourceProfile,
  value?: number
): StreamEvent {
  return {
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    severity,
    type,
    sourceId: source?.id,
    sourceName: source?.name,
    streamKey: source?.streamKey,
    message,
    value
  };
}

export function processMonitoringSnapshot(
  data: DashboardData,
  profiles: SourceProfile[],
  settings: MonitoringSettings
): StreamEvent[] {
  const result: StreamEvent[] = [];
  const now = Date.now();
  const debounceMs = settings.debounceSeconds * 1000;

  const system: SystemState = {
    dockerRunning: data.system.dockerRunning,
    srsRunning: data.system.srsRunning,
    internetReachable: data.system.internetReachable
  };

  if (previousSystem) {
    if (previousSystem.dockerRunning !== system.dockerRunning) {
      result.push(
        event(
          system.dockerRunning ? "success" : "error",
          system.dockerRunning ? "docker_up" : "docker_down",
          system.dockerRunning
            ? "Docker снова работает."
            : "Docker остановлен или недоступен."
        )
      );
    }

    if (previousSystem.srsRunning !== system.srsRunning) {
      result.push(
        event(
          system.srsRunning ? "success" : "error",
          system.srsRunning ? "srs_up" : "srs_down",
          system.srsRunning
            ? "SRS снова работает."
            : "SRS остановлен или недоступен."
        )
      );
    }

    if (
      previousSystem.internetReachable !==
      system.internetReachable
    ) {
      result.push(
        event(
          system.internetReachable ? "success" : "warning",
          system.internetReachable
            ? "internet_up"
            : "internet_down",
          system.internetReachable
            ? "Подключение к интернету восстановлено."
            : "Интернет недоступен."
        )
      );
    }
  }

  previousSystem = system;

  for (const profile of profiles) {
    const stream = data.streams.find(
      item => item.name === profile.streamKey
    );
    const active = Boolean(stream?.active);

    const previous =
      sourceStates.get(profile.id) ??
      ({
        active,
        bitrateLow: false,
        fpsLow: false
      } satisfies SourceState);

    if (initialized && previous.active !== active) {
      result.push(
        event(
          active ? "success" : "error",
          active ? "connected" : "disconnected",
          active
            ? `${profile.name} подключён и начал передавать поток.`
            : `${profile.name} отключён или поток прерван.`,
          profile
        )
      );
    }

    const bitrate = stream?.bitrateKbps ?? 0;
    const fps = stream?.fps ?? 0;

    let bitrateLow = previous.bitrateLow;
    let bitrateSince = previous.bitrateSince;

    if (
      active &&
      settings.lowBitrateKbps > 0 &&
      bitrate > 0 &&
      bitrate < settings.lowBitrateKbps
    ) {
      bitrateSince ??= now;
      if (
        !bitrateLow &&
        now - bitrateSince >= debounceMs
      ) {
        bitrateLow = true;
        result.push(
          event(
            "warning",
            "bitrate_low",
            `${profile.name}: битрейт упал до ${Math.round(
              bitrate
            )} Кбит/с.`,
            profile,
            bitrate
          )
        );
      }
    } else {
      bitrateSince = undefined;
      if (bitrateLow && active) {
        bitrateLow = false;
        result.push(
          event(
            "success",
            "bitrate_restored",
            `${profile.name}: битрейт восстановился до ${Math.round(
              bitrate
            )} Кбит/с.`,
            profile,
            bitrate
          )
        );
      }
      if (!active) bitrateLow = false;
    }

    let fpsLow = previous.fpsLow;
    let fpsSince = previous.fpsSince;

    if (
      active &&
      settings.lowFps > 0 &&
      fps > 0 &&
      fps < settings.lowFps
    ) {
      fpsSince ??= now;
      if (!fpsLow && now - fpsSince >= debounceMs) {
        fpsLow = true;
        result.push(
          event(
            "warning",
            "fps_low",
            `${profile.name}: FPS снизился до ${fps.toFixed(1)}.`,
            profile,
            fps
          )
        );
      }
    } else {
      fpsSince = undefined;
      if (fpsLow && active) {
        fpsLow = false;
        result.push(
          event(
            "success",
            "fps_restored",
            `${profile.name}: FPS восстановился до ${fps.toFixed(1)}.`,
            profile,
            fps
          )
        );
      }
      if (!active) fpsLow = false;
    }

    sourceStates.set(profile.id, {
      active,
      bitrateLow,
      fpsLow,
      bitrateSince,
      fpsSince
    });
  }

  const validIds = new Set(profiles.map(profile => profile.id));
  for (const id of sourceStates.keys()) {
    if (!validIds.has(id)) sourceStates.delete(id);
  }

  initialized = true;
  return result;
}

export function sourceHealth(
  profile: SourceProfile,
  data: DashboardData,
  settings: MonitoringSettings
): "offline" | "warning" | "good" {
  const stream = data.streams.find(
    item => item.name === profile.streamKey
  );

  if (!stream?.active) return "offline";

  const bitrateWarning =
    settings.lowBitrateKbps > 0 &&
    stream.bitrateKbps > 0 &&
    stream.bitrateKbps < settings.lowBitrateKbps;

  const fpsWarning =
    settings.lowFps > 0 &&
    Boolean(stream.fps) &&
    (stream.fps ?? 0) < settings.lowFps;

  return bitrateWarning || fpsWarning ? "warning" : "good";
}
