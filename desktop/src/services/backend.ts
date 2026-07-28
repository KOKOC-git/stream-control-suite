import { invoke } from "@tauri-apps/api/core";
import type { DashboardData, IsoRecordingEnvironment } from "../types";

export const getDashboard = () => invoke<DashboardData>("get_dashboard");
export const startStack = () => invoke<string>("start_stack");
export const stopSrs = () => invoke<string>("stop_srs");
export const openExternal = (url: string) => invoke<void>("open_external", { url });
export const getSrsLogs = () => invoke<string>("get_srs_logs");

export const launchObs = () => invoke<string>("launch_obs");
export const isObsRunning = () => invoke<boolean>("is_obs_running");

import type { SourceProfile } from "../types";

export const loadProfilesFromDisk = () =>
  invoke<SourceProfile[]>("load_profiles");

export const saveProfilesToDisk = (profiles: SourceProfile[]) =>
  invoke<void>("save_profiles", { profiles });

export const getProfilesPath = () =>
  invoke<string>("get_profiles_path");

export const getIsoRecordingEnvironment = () =>
  invoke<IsoRecordingEnvironment>("get_iso_recording_environment");

export const startIsoRecording = (
  streamKey: string,
  displayName: string,
  inputUrl: string
) =>
  invoke<IsoRecordingEnvironment>("start_iso_recording", {
    streamKey,
    displayName,
    inputUrl
  });

export const stopIsoRecording = (streamKey: string) =>
  invoke<IsoRecordingEnvironment>("stop_iso_recording", {
    streamKey
  });

export const stopAllIsoRecordings = () =>
  invoke<IsoRecordingEnvironment>("stop_all_iso_recordings");

export const openIsoRecordingsFolder = () =>
  invoke<void>("open_iso_recordings_folder");

export const openInVlc = (url: string) =>
  invoke<void>("open_in_vlc", { url });
