// @vitest-environment node
import { describe, it, expect, afterEach, vi } from 'vitest';
import { readKey, writeKey, removeKey } from './storage-area';
import { stubChromeStorage } from './test-support/stub-chrome-storage';

describe('storage-area — sync→local fallback and session pin', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('readKey', () => {
    it('returns undefined when the key is absent from sync', async () => {
      stubChromeStorage();
      expect(await readKey('theme')).toBeUndefined();
    });

    it('returns the stored value from sync when present', async () => {
      const { syncStore } = stubChromeStorage();
      syncStore.theme = 'dark';
      expect(await readKey('theme')).toBe('dark');
    });

    it('falls back to local when sync throws', async () => {
      const { local, localStore } = stubChromeStorage({ failSync: true });
      localStore.theme = 'light';
      expect(await readKey('theme')).toBe('light');
      expect(local.get).toHaveBeenCalledWith('theme');
    });
  });

  describe('writeKey', () => {
    it('persists to sync when available', async () => {
      const { sync, syncStore } = stubChromeStorage();
      await writeKey('theme', 'dark');
      expect(sync.set).toHaveBeenCalledWith({ theme: 'dark' });
      expect(syncStore.theme).toBe('dark');
    });

    it('falls back to local when sync throws', async () => {
      const { local, localStore } = stubChromeStorage({ failSync: true });
      await writeKey('theme', 'dark');
      expect(local.set).toHaveBeenCalledWith({ theme: 'dark' });
      expect(localStore.theme).toBe('dark');
    });
  });

  describe('removeKey', () => {
    it('removes a single key from sync when available', async () => {
      const { sync, syncStore } = stubChromeStorage();
      syncStore.platforms = [{ id: 'x' }];
      await removeKey('platforms');
      expect(sync.remove).toHaveBeenCalledWith('platforms');
      expect(syncStore.platforms).toBeUndefined();
    });

    it('removes multiple keys from sync when available', async () => {
      const { sync, syncStore } = stubChromeStorage();
      syncStore.platforms = [];
      syncStore.platformOrder = [];
      await removeKey(['platforms', 'platformOrder']);
      expect(sync.remove).toHaveBeenCalledWith(['platforms', 'platformOrder']);
      expect(syncStore.platforms).toBeUndefined();
      expect(syncStore.platformOrder).toBeUndefined();
    });

    it('falls back to local when sync throws', async () => {
      const { local, localStore } = stubChromeStorage({ failSync: true });
      localStore.platforms = [{ id: 'x' }];
      await removeKey('platforms');
      expect(local.remove).toHaveBeenCalledWith('platforms');
      expect(localStore.platforms).toBeUndefined();
    });
  });

  describe('session pin', () => {
    it('keeps subsequent ops on local after a write that fell back (split-brain)', async () => {
      // sync.set fails but sync.get still works — pin must force later reads to
      // local so the write is not shadowed by a still-readable stale sync value.
      const syncStore: Record<string, unknown> = {};
      const localStore: Record<string, unknown> = {};
      const sync = {
        get: vi.fn(async (key: string) =>
          key in syncStore ? { [key]: syncStore[key] } : {},
        ),
        set: vi.fn(async () => {
          throw new Error('QUOTA_BYTES quota exceeded');
        }),
        remove: vi.fn(async () => {}),
      };
      const local = {
        get: vi.fn(async (key: string) =>
          key in localStore ? { [key]: localStore[key] } : {},
        ),
        set: vi.fn(async (items: Record<string, unknown>) => {
          Object.assign(localStore, items);
        }),
        remove: vi.fn(async (keys: string | string[]) => {
          for (const key of Array.isArray(keys) ? keys : [keys])
            delete localStore[key];
        }),
      };
      vi.stubGlobal('chrome', { storage: { sync, local } });

      await writeKey('platforms', [{ id: 'x', enabled: false }]);
      expect(local.set).toHaveBeenCalled();
      expect(await readKey('platforms')).toEqual([{ id: 'x', enabled: false }]);
      expect(local.get).toHaveBeenCalled();
    });

    it('re-evaluates from scratch when sync object identity changes (re-stub)', async () => {
      // First session: pin to local after sync fails.
      const first = stubChromeStorage({ failSync: true });
      await writeKey('theme', 'dark');
      expect(first.local.set).toHaveBeenCalled();

      // Fresh sync object (new page/context or test re-stub) clears the pin.
      const second = stubChromeStorage();
      second.syncStore.theme = 'light';
      expect(await readKey('theme')).toBe('light');
      expect(second.sync.get).toHaveBeenCalledWith('theme');
      expect(second.local.get).not.toHaveBeenCalled();
    });

    it('pins for the rest of the session after the first sync failure', async () => {
      const { sync, local, localStore } = stubChromeStorage({ failSync: true });
      localStore.theme = 'dark';

      await readKey('theme');
      expect(local.get).toHaveBeenCalledTimes(1);

      // Second op must not re-try sync — already pinned to local.
      await writeKey('theme', 'light');
      expect(sync.set).not.toHaveBeenCalled();
      expect(local.set).toHaveBeenCalledWith({ theme: 'light' });
    });
  });
});
