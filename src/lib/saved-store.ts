/**
 * Browser side of saved businesses (client only). Mirrors ./location-store: localStorage when available, an in-memory
 * copy when storage is blocked, and a subscription for useSyncExternalStore that also follows other tabs.
 */
import { SAVED_STORAGE_KEY, parseSaved, serializeSaved, toggleSaved } from "./saved-businesses";

const EMPTY: string[] = [];
let memory: string | null = null;
const listeners = new Set<() => void>();
let lastRaw: string | null | undefined;
let lastList: string[] = EMPTY;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(SAVED_STORAGE_KEY) ?? memory;
  } catch {
    return memory;
  }
}

/** Saved slugs, newest first. The same array is returned until the stored value changes. */
export function getSavedBusinesses(): string[] {
  if (typeof window === "undefined") return EMPTY;
  const raw = readRaw();
  if (raw !== lastRaw) {
    lastRaw = raw;
    lastList = parseSaved(raw);
  }
  return lastList;
}

export function getServerSavedBusinesses(): string[] {
  return EMPTY;
}

export function subscribeSavedBusinesses(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key === null || event.key === SAVED_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

function write(list: readonly string[]) {
  const raw = serializeSaved(list);
  memory = raw;
  try {
    if (list.length) window.localStorage.setItem(SAVED_STORAGE_KEY, raw);
    else window.localStorage.removeItem(SAVED_STORAGE_KEY);
  } catch {
    // Storage blocked or full: the in-memory copy keeps the list for this visit.
  }
  for (const listener of listeners) listener();
}

export function toggleSavedBusiness(slug: string): void {
  write(toggleSaved(getSavedBusinesses(), slug));
}

export function removeSavedBusiness(slug: string): void {
  write(getSavedBusinesses().filter((s) => s !== slug));
}

export function clearSavedBusinesses(): void {
  write(EMPTY);
}
