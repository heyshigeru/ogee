/**
 * Storage access with a sync→local fallback. chrome.storage.sync can fail (not
 * signed in, quota, rate limit); when it does we pin to chrome.storage.local for
 * the rest of this session. Reads and writes MUST share one area — otherwise a
 * write that fell back to local would be shadowed by a still-readable sync value
 * and the setting would silently revert. Pinning is keyed on the sync object so a
 * fresh page/context (or a test re-stub) re-evaluates from scratch.
 */
type StorageArea = chrome.storage.StorageArea;
let pinned: { sync: StorageArea; toLocal: boolean } | undefined;

async function withArea<T>(op: (area: StorageArea) => Promise<T>): Promise<T> {
  const sync = chrome.storage.sync;
  if (!pinned || pinned.sync !== sync) {
    pinned = { sync, toLocal: false };
  }
  if (!pinned.toLocal) {
    try {
      return await op(sync);
    } catch {
      pinned.toLocal = true;
    }
  }
  return op(chrome.storage.local);
}

export async function readKey<T>(key: string): Promise<T | undefined> {
  const result = await withArea((area) => area.get(key));
  return result[key] as T | undefined;
}

export async function writeKey(key: string, value: unknown): Promise<void> {
  await withArea((area) => area.set({ [key]: value }));
}

export async function removeKey(keys: string | string[]): Promise<void> {
  await withArea((area) => area.remove(keys));
}
