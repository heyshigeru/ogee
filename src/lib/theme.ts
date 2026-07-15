import { readKey, writeKey } from './storage-area';

export type ThemePreference = 'system' | 'light' | 'dark';
export type ResolvedTheme = 'light' | 'dark';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const THEME_KEY = 'theme';

/**
 * Session-scoped theme cache (module-load lifetime). First getThemePreference
 * hits storage once; setThemePreference updates the cache synchronously so an
 * OS color-scheme change mid-write cannot re-read a stale pre-click value.
 * A fresh popup is a fresh JS context, so the cache always starts empty.
 */
let themeCache: ThemePreference | undefined;
/** In-flight first read, shared so concurrent gets still hit storage once. */
let themeLoad: Promise<ThemePreference> | undefined;

export async function getThemePreference(): Promise<ThemePreference> {
  if (themeCache !== undefined) return themeCache;
  if (!themeLoad) {
    themeLoad = readKey<ThemePreference>(THEME_KEY).then((stored) => {
      // setThemePreference may have filled the cache while this read was in flight.
      if (themeCache === undefined) {
        themeCache = stored ?? 'system';
      }
      return themeCache;
    });
  }
  return themeLoad;
}

export async function setThemePreference(p: ThemePreference): Promise<void> {
  themeCache = p;
  themeLoad = Promise.resolve(p);
  await writeKey(THEME_KEY, p);
}

/** Test-only: clear the session theme cache so each test starts uninitialized. */
export function __resetThemeCacheForTests(): void {
  themeCache = undefined;
  themeLoad = undefined;
}

export function resolveTheme(pref: ThemePreference): ResolvedTheme {
  if (pref === 'light' || pref === 'dark') return pref;
  return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light';
}

export function applyTheme(resolved: ResolvedTheme): void {
  document.documentElement.dataset.theme = resolved;
}

export function applyPreference(pref: ThemePreference): void {
  applyTheme(resolveTheme(pref));
}

type ThemePreferenceGetter = () => ThemePreference | Promise<ThemePreference>;

/**
 * Applies the current preference (via `getPref`) and then subscribes to OS
 * color-scheme changes. Resolves only after the theme has been applied so
 * callers can `await initTheme(...)` before mount (no FOUC).
 */
export async function initTheme(
  getPref: ThemePreferenceGetter,
): Promise<() => void> {
  applyPreference(await getPref());
  return watchSystem(getPref, applyTheme);
}

/**
 * Subscribes to OS color-scheme changes; re-applies only while the preference is
 * `system`. `getPref` is consulted on each change (it may be async, e.g. a live
 * storage read) so a Light/Dark choice made after subscribing is respected rather
 * than overwritten by a stale snapshot. Returns an unsubscribe fn.
 */
export function watchSystem(
  getPref: ThemePreferenceGetter,
  onChange: (t: ResolvedTheme) => void,
): () => void {
  const mql = window.matchMedia(DARK_QUERY);
  const listener = () => {
    void Promise.resolve(getPref()).then((pref) => {
      if (pref === 'system') onChange(resolveTheme('system'));
    });
  };
  mql.addEventListener('change', listener);
  return () => mql.removeEventListener('change', listener);
}
