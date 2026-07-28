export type SystemStatus = {
  dockerRunning: boolean;
  srsRunning: boolean;
  ipAddress: string;
  interfaceName: string;
  internetReachable: boolean;
  ports: Record<string, boolean>;
};

export type StreamMetric = {
  id: string;
  name: string;
  active: boolean;
  bitrateKbps: number;
  width?: number;
  height?: number;
  fps?: number;
  liveMs?: number;
  clients?: number;
  flvUrl?: string;
  hlsUrl?: string;
};

export type DashboardData = {
  system: SystemStatus;
  streams: StreamMetric[];
  checkedAt: string;
};

export type SourceType = "gopro" | "phone" | "dji" | "rtmp";
export type PreviewMode = "auto" | "flv" | "hls";

export type SourceProfile = {
  id: string;
  name: string;
  streamKey: string;
  type: SourceType;
  enabled: boolean;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  order?: number;
  previewMode?: PreviewMode;
};

export type ObsStatus = {
  connected: boolean;
  currentScene: string;
  scenes: string[];
  recording: boolean;
  recordingPaused: boolean;
  streaming: boolean;
  recordTimecode: string;
  streamTimecode: string;
};

export type SourceDraft = {
  name: string;
  streamKey: string;
  type: SourceType;
  notes: string;
};

export type EventSeverity = "info" | "warning" | "error" | "success";

export type StreamEvent = {
  id: string;
  timestamp: string;
  severity: EventSeverity;
  type:
    | "connected"
    | "disconnected"
    | "bitrate_low"
    | "bitrate_restored"
    | "fps_low"
    | "fps_restored"
    | "docker_down"
    | "docker_up"
    | "srs_down"
    | "srs_up"
    | "internet_down"
    | "internet_up";
  sourceId?: string;
  sourceName?: string;
  streamKey?: string;
  message: string;
  value?: number;
};

export type MonitoringSettings = {
  lowBitrateKbps: number;
  lowFps: number;
  debounceSeconds: number;
  maxEvents: number;
};

export type IsoRecordingStatus = {
  streamKey: string;
  displayName: string;
  outputPath: string;
  startedAtMs: number;
  pid: number;
};

export type IsoRecordingEnvironment = {
  ffmpegAvailable: boolean;
  ffmpegPath: string;
  outputDirectory: string;
  recordings: IsoRecordingStatus[];
};
