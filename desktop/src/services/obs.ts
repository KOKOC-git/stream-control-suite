import OBSWebSocket from "obs-websocket-js";
import type { ObsStatus } from "../types";

const obs = new OBSWebSocket();
let connected = false;

const emptyStatus = (): ObsStatus => ({
  connected: false,
  currentScene: "",
  scenes: [],
  recording: false,
  recordingPaused: false,
  streaming: false,
  recordTimecode: "00:00:00",
  streamTimecode: "00:00:00"
});

export async function connectObs(
  address: string,
  password: string
): Promise<ObsStatus> {
  if (connected) {
    try {
      await obs.disconnect();
    } catch {
      // Ignore stale connection.
    }
    connected = false;
  }

  await obs.connect(address, password);
  connected = true;
  return getObsStatus();
}

export async function disconnectObs(): Promise<ObsStatus> {
  try {
    await obs.disconnect();
  } finally {
    connected = false;
  }
  return emptyStatus();
}

export async function getObsStatus(): Promise<ObsStatus> {
  if (!connected) return emptyStatus();

  try {
    const [sceneList, record, stream] = await Promise.all([
      obs.call("GetSceneList"),
      obs.call("GetRecordStatus"),
      obs.call("GetStreamStatus")
    ]);

    return {
      connected: true,
      currentScene: String(sceneList.currentProgramSceneName ?? ""),
      scenes: sceneList.scenes.map(scene => String(scene.sceneName)),
      recording: Boolean(record.outputActive),
      recordingPaused: Boolean(record.outputPaused),
      streaming: Boolean(stream.outputActive),
      recordTimecode: String(record.outputTimecode ?? "00:00:00"),
      streamTimecode: String(stream.outputTimecode ?? "00:00:00")
    };
  } catch {
    connected = false;
    return emptyStatus();
  }
}

export async function selectScene(sceneName: string): Promise<ObsStatus> {
  await obs.call("SetCurrentProgramScene", { sceneName });
  return getObsStatus();
}

export async function startRecording(): Promise<ObsStatus> {
  await obs.call("StartRecord");
  return getObsStatus();
}

export async function stopRecording(): Promise<ObsStatus> {
  await obs.call("StopRecord");
  return getObsStatus();
}

export async function pauseRecording(): Promise<ObsStatus> {
  await obs.call("PauseRecord");
  return getObsStatus();
}

export async function resumeRecording(): Promise<ObsStatus> {
  await obs.call("ResumeRecord");
  return getObsStatus();
}

export async function startStreaming(): Promise<ObsStatus> {
  await obs.call("StartStream");
  return getObsStatus();
}

export async function stopStreaming(): Promise<ObsStatus> {
  await obs.call("StopStream");
  return getObsStatus();
}

export type ObsSyncResult = {
  scenesCreated: number;
  inputsCreated: number;
  inputsUpdated: number;
  sceneItemsCreated: number;
  sceneItemsPositioned: number;
  messages: string[];
};

function sourceInputName(profileName: string, streamKey: string): string {
  const safeName = profileName.trim() || streamKey;
  return `SCC · ${safeName}`;
}

async function ensureScene(sceneName: string): Promise<boolean> {
  const response = await obs.call("GetSceneList");
  const exists = response.scenes.some(
    scene => String(scene.sceneName) === sceneName
  );

  if (!exists) {
    await obs.call("CreateScene", { sceneName });
    return true;
  }

  return false;
}

async function getInputNames(): Promise<Set<string>> {
  const response = await obs.call("GetInputList");
  return new Set(
    response.inputs.map(input => String(input.inputName))
  );
}

async function sceneContainsSource(
  sceneName: string,
  sourceName: string
): Promise<boolean> {
  const response = await obs.call("GetSceneItemList", { sceneName });
  return response.sceneItems.some(
    item => String(item.sourceName) === sourceName
  );
}

async function setMediaInputUrl(
  inputName: string,
  url: string
): Promise<void> {
  await obs.call("SetInputSettings", {
    inputName,
    inputSettings: {
      input: url,
      is_local_file: false,
      restart_on_activate: true,
      close_when_inactive: false,
      buffering_mb: 1
    },
    overlay: true
  } as never);
}

async function createMediaInput(
  sceneName: string,
  inputName: string,
  url: string
): Promise<void> {
  await obs.call("CreateInput", {
    sceneName,
    inputName,
    inputKind: "ffmpeg_source",
    inputSettings: {
      input: url,
      is_local_file: false,
      restart_on_activate: true,
      close_when_inactive: false,
      buffering_mb: 1
    },
    sceneItemEnabled: true
  } as never);
}

export async function syncProfilesToSharedScene(
  profiles: Array<{ name: string; streamKey: string }>,
  ip: string,
  sceneName: string
): Promise<ObsSyncResult> {
  if (!connected) throw new Error("OBS WebSocket не подключён.");
  if (!ip) throw new Error("IP MacBook не определён.");

  const result: ObsSyncResult = {
    scenesCreated: 0,
    inputsCreated: 0,
    inputsUpdated: 0,
    sceneItemsCreated: 0,
    sceneItemsPositioned: 0,
    messages: []
  };

  if (await ensureScene(sceneName)) {
    result.scenesCreated += 1;
  }

  const inputNames = await getInputNames();

  for (const profile of profiles) {
    const inputName = sourceInputName(profile.name, profile.streamKey);
    const url = `http://${ip}:8080/live/${profile.streamKey}.flv`;

    if (!inputNames.has(inputName)) {
      await createMediaInput(sceneName, inputName, url);
      inputNames.add(inputName);
      result.inputsCreated += 1;
      result.sceneItemsCreated += 1;
      result.messages.push(`Создан источник «${inputName}».`);
      continue;
    }

    await setMediaInputUrl(inputName, url);
    result.inputsUpdated += 1;

    if (!(await sceneContainsSource(sceneName, inputName))) {
      await obs.call("CreateSceneItem", {
        sceneName,
        sourceName: inputName,
        sceneItemEnabled: true
      });
      result.sceneItemsCreated += 1;
    }
  }

  result.sceneItemsPositioned = await layoutSceneItems(
    sceneName,
    profiles.map(profile =>
      sourceInputName(profile.name, profile.streamKey)
    )
  );

  return result;
}

export async function syncProfilesToIndividualScenes(
  profiles: Array<{ name: string; streamKey: string }>,
  ip: string
): Promise<ObsSyncResult> {
  if (!connected) throw new Error("OBS WebSocket не подключён.");
  if (!ip) throw new Error("IP MacBook не определён.");

  const result: ObsSyncResult = {
    scenesCreated: 0,
    inputsCreated: 0,
    inputsUpdated: 0,
    sceneItemsCreated: 0,
    sceneItemsPositioned: 0,
    messages: []
  };

  const inputNames = await getInputNames();

  for (const profile of profiles) {
    const sceneName = `SCC · ${profile.name.trim() || profile.streamKey}`;
    const inputName = sourceInputName(profile.name, profile.streamKey);
    const url = `http://${ip}:8080/live/${profile.streamKey}.flv`;

    if (await ensureScene(sceneName)) {
      result.scenesCreated += 1;
    }

    if (!inputNames.has(inputName)) {
      await createMediaInput(sceneName, inputName, url);
      inputNames.add(inputName);
      result.inputsCreated += 1;
      result.sceneItemsCreated += 1;
      continue;
    }

    await setMediaInputUrl(inputName, url);
    result.inputsUpdated += 1;

    if (!(await sceneContainsSource(sceneName, inputName))) {
      await obs.call("CreateSceneItem", {
        sceneName,
        sourceName: inputName,
        sceneItemEnabled: true
      });
      result.sceneItemsCreated += 1;
    }
  }

  return result;
}

type SceneItemTransform = {
  positionX: number;
  positionY: number;
  scaleX: number;
  scaleY: number;
  boundsType: "OBS_BOUNDS_SCALE_INNER";
  boundsWidth: number;
  boundsHeight: number;
  alignment: number;
  boundsAlignment: number;
};

function gridDimensions(count: number): { columns: number; rows: number } {
  if (count <= 1) return { columns: 1, rows: 1 };
  if (count <= 4) return { columns: 2, rows: 2 };
  if (count <= 6) return { columns: 3, rows: 2 };
  if (count <= 9) return { columns: 3, rows: 3 };

  const columns = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / columns);
  return { columns, rows };
}

async function layoutSceneItems(
  sceneName: string,
  orderedSourceNames: string[],
  canvasWidth = 1920,
  canvasHeight = 1080,
  gap = 12
): Promise<number> {
  if (!orderedSourceNames.length) return 0;

  const response = await obs.call("GetSceneItemList", { sceneName });
  const bySource = new Map(
    response.sceneItems.map(item => [
      String(item.sourceName),
      Number(item.sceneItemId)
    ])
  );

  const { columns, rows } = gridDimensions(orderedSourceNames.length);
  const cellWidth = (canvasWidth - gap * (columns - 1)) / columns;
  const cellHeight = (canvasHeight - gap * (rows - 1)) / rows;

  let positioned = 0;

  for (let index = 0; index < orderedSourceNames.length; index += 1) {
    const sourceName = orderedSourceNames[index];
    const sceneItemId = bySource.get(sourceName);
    if (sceneItemId === undefined) continue;

    const column = index % columns;
    const row = Math.floor(index / columns);

    const transform: SceneItemTransform = {
      positionX: column * (cellWidth + gap),
      positionY: row * (cellHeight + gap),
      scaleX: 1,
      scaleY: 1,
      boundsType: "OBS_BOUNDS_SCALE_INNER",
      boundsWidth: cellWidth,
      boundsHeight: cellHeight,
      alignment: 5,
      boundsAlignment: 5
    };

    await obs.call("SetSceneItemTransform", {
      sceneName,
      sceneItemId,
      sceneItemTransform: transform
    } as never);

    positioned += 1;
  }

  return positioned;
}

export async function layoutSharedScene(
  profiles: Array<{ name: string; streamKey: string }>,
  sceneName: string,
  canvasWidth = 1920,
  canvasHeight = 1080
): Promise<number> {
  if (!connected) throw new Error("OBS WebSocket не подключён.");

  const names = profiles.map(profile =>
    sourceInputName(profile.name, profile.streamKey)
  );

  return layoutSceneItems(
    sceneName,
    names,
    canvasWidth,
    canvasHeight
  );
}
