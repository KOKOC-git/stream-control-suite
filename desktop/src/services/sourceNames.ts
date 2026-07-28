const STORAGE_KEY = "rtmp-source-names";

export type SourceNames = Record<string, string>;

export function loadSourceNames(): SourceNames {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function saveSourceNames(names: SourceNames): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(names));
}

export function defaultSourceName(streamKey: string, camera?: number): string {
  if (camera) return `Камера ${camera}`;
  return streamKey;
}
