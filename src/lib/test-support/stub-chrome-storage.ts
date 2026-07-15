import { vi } from 'vitest';

/**
 * In-memory chrome.storage double. `sync` and `local` are independent stores
 * backed by plain objects; get/set/remove are vi.fn() spies that resolve like
 * MV3's Promise-based API. `failSync` flips sync ops to reject so the fallback
 * to local can be asserted.
 */
export function stubChromeStorage(opts: { failSync?: boolean } = {}) {
  const syncStore: Record<string, unknown> = {};
  const localStore: Record<string, unknown> = {};

  const makeArea = (store: Record<string, unknown>, fail: boolean) => ({
    get: vi.fn(async (key: string) => {
      if (fail) throw new Error('sync unavailable');
      return key in store ? { [key]: store[key] } : {};
    }),
    set: vi.fn(async (items: Record<string, unknown>) => {
      if (fail) throw new Error('sync unavailable');
      Object.assign(store, items);
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      if (fail) throw new Error('sync unavailable');
      for (const key of Array.isArray(keys) ? keys : [keys]) delete store[key];
    }),
  });

  const sync = makeArea(syncStore, !!opts.failSync);
  const local = makeArea(localStore, false);

  vi.stubGlobal('chrome', { storage: { sync, local } });

  return { sync, local, syncStore, localStore };
}
