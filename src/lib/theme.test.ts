// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  resolveTheme,
  applyTheme,
  applyPreference,
  initTheme,
  watchSystem,
  getThemePreference,
  setThemePreference,
  __resetThemeCacheForTests,
  type ThemePreference,
} from './theme';
import { stubChromeStorage } from './test-support/stub-chrome-storage';

/**
 * Controllable matchMedia mock. Only the dark-scheme query is exercised.
 * `matches` is mutable; the `change` listeners can be dispatched via `emit()`.
 */
function stubMatchMedia(initialDark: boolean) {
  let matches = initialDark;
  const listeners = new Set<(e: MediaQueryListEvent) => void>();

  const mql = {
    get matches() {
      return matches;
    },
    media: '(prefers-color-scheme: dark)',
    addEventListener: (_type: string, cb: (e: MediaQueryListEvent) => void) => {
      listeners.add(cb);
    },
    removeEventListener: (
      _type: string,
      cb: (e: MediaQueryListEvent) => void,
    ) => {
      listeners.delete(cb);
    },
  };

  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => {
      // Always return the same controllable object for the dark query.
      return { ...mql, media: query };
    }),
  );

  return {
    setDark(value: boolean) {
      matches = value;
    },
    emit() {
      const e = { matches } as MediaQueryListEvent;
      for (const cb of listeners) cb(e);
    },
    listenerCount() {
      return listeners.size;
    },
  };
}

describe('theme preference', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
    __resetThemeCacheForTests();
  });

  it('returns "system" when storage.sync has no "theme" key', async () => {
    stubChromeStorage();
    expect(await getThemePreference()).toBe('system');
  });

  it('returns the saved preference subsequently', async () => {
    const { syncStore } = stubChromeStorage();
    syncStore.theme = 'light';
    expect(await getThemePreference()).toBe('light');
  });

  it('persists to storage.sync when set', async () => {
    const { sync } = stubChromeStorage();
    await setThemePreference('dark');
    expect(sync.set).toHaveBeenCalledWith({ theme: 'dark' });
  });

  it('falls back to storage.local for reads when sync throws', async () => {
    const { local, localStore } = stubChromeStorage({ failSync: true });
    localStore.theme = 'dark';
    expect(await getThemePreference()).toBe('dark');
    expect(local.get).toHaveBeenCalled();
  });

  it('reads storage only once across sequential getThemePreference calls', async () => {
    const { sync } = stubChromeStorage();
    expect(await getThemePreference()).toBe('system');
    expect(await getThemePreference()).toBe('system');
    expect(sync.get).toHaveBeenCalledTimes(1);
  });

  it('reflects setThemePreference immediately even while storage set is pending', async () => {
    const { sync, syncStore } = stubChromeStorage();
    let resolveSet!: () => void;
    const setPending = new Promise<void>((r) => {
      resolveSet = r;
    });
    sync.set.mockImplementationOnce(async (items: Record<string, unknown>) => {
      await setPending;
      Object.assign(syncStore, items);
    });

    const write = setThemePreference('dark');
    // Cache is updated synchronously — get must not wait on the write.
    expect(await getThemePreference()).toBe('dark');
    expect(sync.get).not.toHaveBeenCalled();

    resolveSet();
    await write;
    expect(syncStore.theme).toBe('dark');
  });
});

describe('theme — 3-way resolution, application, live OS tracking', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.theme;
    __resetThemeCacheForTests();
  });

  describe('resolveTheme("system") follows matchMedia', () => {
    it('resolves to "dark" when OS prefers dark', () => {
      stubMatchMedia(true);
      expect(resolveTheme('system')).toBe('dark');
    });

    it('resolves to "light" when OS does not prefer dark', () => {
      stubMatchMedia(false);
      expect(resolveTheme('system')).toBe('light');
    });
  });

  describe('resolveTheme("light"|"dark") ignores the OS', () => {
    it('passes "light" through even when OS prefers dark', () => {
      stubMatchMedia(true);
      expect(resolveTheme('light')).toBe('light');
    });

    it('passes "dark" through even when OS prefers light', () => {
      stubMatchMedia(false);
      expect(resolveTheme('dark')).toBe('dark');
    });
  });

  describe('applyTheme sets documentElement.dataset.theme', () => {
    it('sets data-theme to "dark"', () => {
      applyTheme('dark');
      expect(document.documentElement.dataset.theme).toBe('dark');
    });

    it('sets data-theme to "light"', () => {
      applyTheme('light');
      expect(document.documentElement.dataset.theme).toBe('light');
    });
  });

  describe('Live OS change updates data-theme only while in system mode', () => {
    it('updates data-theme when pref is "system" and OS flips to dark', async () => {
      const media = stubMatchMedia(false);
      const pref: ThemePreference = 'system';

      applyTheme('light');
      expect(document.documentElement.dataset.theme).toBe('light');

      const stop = watchSystem(
        () => pref,
        (t) => applyTheme(t),
      );

      media.setDark(true);
      media.emit();
      // getPref is consulted via a resolved Promise, so flush the microtask queue.
      await Promise.resolve();

      expect(document.documentElement.dataset.theme).toBe('dark');
      stop();
    });

    it('re-reads an async preference getter on each OS change', async () => {
      const media = stubMatchMedia(false);
      // Preference starts as "system" but flips to "light" before the OS change,
      // mimicking a ThemeToggle write the watcher must observe (not a stale snapshot).
      let pref: ThemePreference = 'system';
      const getPref = () => Promise.resolve(pref);

      applyTheme('light');
      const stop = watchSystem(getPref, (t) => applyTheme(t));

      pref = 'light';
      media.setDark(true);
      media.emit();
      await Promise.resolve();

      expect(document.documentElement.dataset.theme).toBe('light');
      stop();
    });

    it('does NOT update data-theme when pref is not "system"', () => {
      const media = stubMatchMedia(false);
      const pref: ThemePreference = 'light';

      applyTheme('light');
      expect(document.documentElement.dataset.theme).toBe('light');

      const stop = watchSystem(
        () => pref,
        (t) => applyTheme(t),
      );

      media.setDark(true);
      media.emit();

      expect(document.documentElement.dataset.theme).toBe('light');
      stop();
    });

    it('stops reacting after the returned unsubscribe is called', () => {
      const media = stubMatchMedia(false);
      const pref: ThemePreference = 'system';
      const onChange = vi.fn();

      const stop = watchSystem(() => pref, onChange);
      stop();

      media.setDark(true);
      media.emit();

      expect(onChange).not.toHaveBeenCalled();
      expect(media.listenerCount()).toBe(0);
    });

    it('does not re-apply system when setThemePreference updated the cache mid-race', async () => {
      // Real settings cache + watchSystem: after an explicit Light/Dark click,
      // an OS change must not re-read a stale pre-write 'system' from storage.
      const syncStore: Record<string, unknown> = {};
      const sync = {
        get: vi.fn(async (key: string) =>
          key in syncStore ? { [key]: syncStore[key] } : {},
        ),
        set: vi.fn(async (items: Record<string, unknown>) => {
          Object.assign(syncStore, items);
        }),
        remove: vi.fn(async () => {}),
      };
      vi.stubGlobal('chrome', {
        storage: {
          sync,
          local: {
            get: vi.fn(async () => ({})),
            set: vi.fn(async () => {}),
            remove: vi.fn(async () => {}),
          },
        },
      });
      __resetThemeCacheForTests();

      const media = stubMatchMedia(false);
      // Seed as system (first-run default); watchSystem is subscribed with the
      // real getThemePreference so it re-reads the session cache on each change.
      expect(await getThemePreference()).toBe('system');

      const onChange = vi.fn();
      const stop = watchSystem(getThemePreference, onChange);

      // User picks Dark — cache updates sync before the storage write settles.
      await setThemePreference('dark');

      media.setDark(true);
      media.emit();
      await Promise.resolve();
      await Promise.resolve();

      // Preference is explicit 'dark', not 'system' — onChange must not fire.
      expect(onChange).not.toHaveBeenCalled();
      stop();
      __resetThemeCacheForTests();
    });
  });
});

describe('applyPreference', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.theme;
  });

  it('sets data-theme to "dark" for pref "dark"', () => {
    applyPreference('dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('sets data-theme to "light" for pref "light"', () => {
    applyPreference('light');
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('resolves "system" via matchMedia when OS prefers dark', () => {
    stubMatchMedia(true);
    applyPreference('system');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('resolves "system" via matchMedia when OS prefers light', () => {
    stubMatchMedia(false);
    applyPreference('system');
    expect(document.documentElement.dataset.theme).toBe('light');
  });
});

describe('initTheme', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete document.documentElement.dataset.theme;
  });

  it('applies the theme before the promise resolves (sync getPref)', async () => {
    stubMatchMedia(false);
    await initTheme(() => 'dark');
    expect(document.documentElement.dataset.theme).toBe('dark');
  });

  it('applies the theme before the promise resolves (async getPref)', async () => {
    stubMatchMedia(false);
    await initTheme(() => Promise.resolve('light'));
    expect(document.documentElement.dataset.theme).toBe('light');
  });

  it('wires the OS watcher for "system" and unsubscribes cleanly', async () => {
    const media = stubMatchMedia(false);
    const pref: ThemePreference = 'system';

    const stop = await initTheme(() => pref);
    expect(document.documentElement.dataset.theme).toBe('light');

    media.setDark(true);
    media.emit();
    await Promise.resolve();
    expect(document.documentElement.dataset.theme).toBe('dark');

    stop();
    media.setDark(false);
    media.emit();
    await Promise.resolve();
    // Unsubscribed: no further updates.
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(media.listenerCount()).toBe(0);
  });
});
