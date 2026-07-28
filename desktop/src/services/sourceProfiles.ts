import type {
  SourceDraft,
  SourceProfile,
  SourceType
} from "../types";
import {
  loadProfilesFromDisk,
  saveProfilesToDisk
} from "./backend";

const LEGACY_KEY = "stream-source-profiles-v2";

export async function loadProfiles(): Promise<SourceProfile[]> {
  const disk = await loadProfilesFromDisk();
  if (disk.length) return disk;

  const legacy = loadLegacyProfiles();
  if (legacy.length) {
    await saveProfilesToDisk(legacy);
    localStorage.removeItem(LEGACY_KEY);
    return legacy;
  }

  const initial = [
    createProfileFromDraft({
      name: "GoPro 1",
      streamKey: "cam1",
      type: "gopro",
      notes: ""
    })
  ];
  await saveProfilesToDisk(initial);
  return initial;
}

export async function saveProfiles(
  profiles: SourceProfile[]
): Promise<void> {
  await saveProfilesToDisk(profiles);
}

function loadLegacyProfiles(): SourceProfile[] {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function createProfile(
  type: SourceType,
  index: number
): SourceProfile {
  const defaults: Record<SourceType, { name: string; key: string }> = {
    gopro: { name: `GoPro ${index}`, key: `gopro${index}` },
    phone: { name: `Телефон ${index}`, key: `phone${index}` },
    dji: { name: `DJI ${index}`, key: `dji${index}` },
    rtmp: { name: `RTMP ${index}`, key: `source${index}` }
  };

  return createProfileFromDraft({
    name: defaults[type].name,
    streamKey: defaults[type].key,
    type,
    notes: ""
  });
}

export function createProfileFromDraft(
  draft: SourceDraft
): SourceProfile {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: draft.name.trim(),
    streamKey: sanitizeStreamKey(draft.streamKey),
    type: draft.type,
    enabled: true,
    notes: draft.notes.trim(),
    createdAt: now,
    updatedAt: now,
    order: Date.now(),
    previewMode: draft.type === "dji" ? "hls" : "auto"
  };
}

export function sanitizeStreamKey(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function nextStreamKey(
  type: SourceType,
  profiles: SourceProfile[]
): string {
  const prefix: Record<SourceType, string> = {
    gopro: "gopro",
    phone: "phone",
    dji: "dji",
    rtmp: "source"
  };

  let index = 1;
  while (
    profiles.some(
      profile => profile.streamKey === `${prefix[type]}${index}`
    )
  ) {
    index += 1;
  }
  return `${prefix[type]}${index}`;
}

export function normalizeProfileOrder(
  profiles: SourceProfile[]
): SourceProfile[] {
  return [...profiles]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((profile, index) => ({
      ...profile,
      order: index
    }));
}
