// @vitest-environment node
import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  DEFAULT_ORDER,
  getOrderAndEnabled,
  setPlatformEnabled,
  reorderPlatform,
  resetPlatformSettings,
  reconcile,
  setEnabled,
  applyReorder,
  reorderStates,
  firstRunOrder,
  type PlatformState,
} from './settings';
import type { PlatformId } from '../core/types';
import { stubChromeStorage } from './test-support/stub-chrome-storage';

/** Assert every set() call wrote only the `platforms` key (never legacy keys). */
function expectOnlyPlatformsKey(setFn: ReturnType<typeof vi.fn>): void {
  for (const call of setFn.mock.calls) {
    const keys = Object.keys(call[0] as Record<string, unknown>);
    expect(keys).toEqual(['platforms']);
  }
}

const ALL_EIGHT = DEFAULT_ORDER;

// Shared reorder inputs: the same {movedId, beforeId} set drives the permutation
// tests for applyReorder (over ids) and reorderStates (over records).
const REORDER_CASES: Array<{
  movedId: PlatformId;
  beforeId: PlatformId | null;
}> = [
  { movedId: 'x', beforeId: 'slack' },
  { movedId: 'x', beforeId: null },
  { movedId: 'linkedin', beforeId: 'x' },
  { movedId: 'facebook', beforeId: 'linkedin' },
  { movedId: 'slack', beforeId: 'ghost' as PlatformId },
];

describe('settings — platforms (sync→local fallback)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe('reconcile', () => {
    it('returns DEFAULT_ORDER all-enabled when stored is empty and registered is the full eight', () => {
      const result = reconcile([], ALL_EIGHT);
      expect(result.map((s) => s.id)).toEqual(DEFAULT_ORDER);
      expect(result.every((s) => s.enabled)).toBe(true);
    });

    it('keeps stored records in stored order with mixed enabled bits untouched', () => {
      const stored: PlatformState[] = [
        { id: 'slack', enabled: false },
        { id: 'x', enabled: true },
        { id: 'facebook', enabled: false },
      ];
      const registered: PlatformId[] = ['x', 'facebook', 'slack'];
      expect(reconcile(stored, registered)).toEqual([
        { id: 'slack', enabled: false },
        { id: 'x', enabled: true },
        { id: 'facebook', enabled: false },
      ]);
    });

    it('drops stored ids that are not registered', () => {
      const stored: PlatformState[] = [
        { id: 'x', enabled: true },
        { id: 'ghost' as PlatformId, enabled: false },
        { id: 'facebook', enabled: true },
      ];
      const registered: PlatformId[] = ['x', 'facebook'];
      expect(reconcile(stored, registered)).toEqual([
        { id: 'x', enabled: true },
        { id: 'facebook', enabled: true },
      ]);
    });

    it('appends registered-but-unstored ids as enabled, ranked by DEFAULT_ORDER', () => {
      // Only x is stored; facebook (rank 1) then linkedin (rank 2) append in rank order.
      const stored: PlatformState[] = [{ id: 'x', enabled: false }];
      const registered: PlatformId[] = ['linkedin', 'facebook', 'x'];
      expect(reconcile(stored, registered)).toEqual([
        { id: 'x', enabled: false },
        { id: 'facebook', enabled: true },
        { id: 'linkedin', enabled: true },
      ]);
    });

    it('appends ids absent from DEFAULT_ORDER after ranked ones, in registered order', () => {
      const stored: PlatformState[] = [{ id: 'x', enabled: true }];
      // 'future' is not in DEFAULT_ORDER; it must trail facebook (which is ranked).
      const registered = ['future', 'facebook', 'x'] as PlatformId[];
      expect(reconcile(stored, registered)).toEqual([
        { id: 'x', enabled: true },
        { id: 'facebook', enabled: true },
        { id: 'future', enabled: true },
      ]);
    });
  });

  describe('setEnabled', () => {
    const states: PlatformState[] = [
      { id: 'x', enabled: true },
      { id: 'facebook', enabled: true },
      { id: 'slack', enabled: false },
    ];

    it('toggles a platform off', () => {
      expect(setEnabled(states, 'facebook', false)).toEqual([
        { id: 'x', enabled: true },
        { id: 'facebook', enabled: false },
        { id: 'slack', enabled: false },
      ]);
    });

    it('toggles a platform on', () => {
      expect(setEnabled(states, 'slack', true)).toEqual([
        { id: 'x', enabled: true },
        { id: 'facebook', enabled: true },
        { id: 'slack', enabled: true },
      ]);
    });

    it('is idempotent when toggling on an already-enabled id', () => {
      expect(setEnabled(states, 'facebook', true)).toEqual(states);
    });

    it('is idempotent when toggling off an already-disabled id', () => {
      expect(setEnabled(states, 'slack', false)).toEqual(states);
    });
  });

  describe('applyReorder', () => {
    const order: PlatformId[] = ['x', 'facebook', 'slack', 'linkedin'];

    it('repositions before a given beforeId', () => {
      // Move facebook before x → facebook, x, slack, linkedin
      expect(applyReorder(order, 'facebook', 'x')).toEqual([
        'facebook',
        'x',
        'slack',
        'linkedin',
      ]);
    });

    it('appends when beforeId is null', () => {
      expect(applyReorder(order, 'x', null)).toEqual([
        'facebook',
        'slack',
        'linkedin',
        'x',
      ]);
    });

    it('appends when beforeId is not present in order', () => {
      // 'ghost' is not in order — treat as append.
      expect(applyReorder(order, 'facebook', 'ghost' as PlatformId)).toEqual([
        'x',
        'slack',
        'linkedin',
        'facebook',
      ]);
    });

    it('never loses or duplicates ids — output is a permutation of input order', () => {
      for (const c of REORDER_CASES) {
        const result = applyReorder(order, c.movedId, c.beforeId);
        expect([...result].sort()).toEqual([...order].sort());
        expect(new Set(result).size).toBe(order.length);
      }
    });
  });

  describe('reorderStates', () => {
    const states: PlatformState[] = [
      { id: 'x', enabled: true },
      { id: 'facebook', enabled: false },
      { id: 'slack', enabled: true },
      { id: 'linkedin', enabled: false },
    ];

    it('repositions before a given beforeId', () => {
      expect(reorderStates(states, 'facebook', 'x')).toEqual([
        { id: 'facebook', enabled: false },
        { id: 'x', enabled: true },
        { id: 'slack', enabled: true },
        { id: 'linkedin', enabled: false },
      ]);
    });

    it('appends when beforeId is null', () => {
      expect(reorderStates(states, 'x', null)).toEqual([
        { id: 'facebook', enabled: false },
        { id: 'slack', enabled: true },
        { id: 'linkedin', enabled: false },
        { id: 'x', enabled: true },
      ]);
    });

    it('appends when beforeId is missing from states', () => {
      expect(reorderStates(states, 'facebook', 'ghost' as PlatformId)).toEqual([
        { id: 'x', enabled: true },
        { id: 'slack', enabled: true },
        { id: 'linkedin', enabled: false },
        { id: 'facebook', enabled: false },
      ]);
    });

    it('never loses or duplicates ids — output is a permutation of input ids', () => {
      const ids = states.map((s) => s.id);
      for (const c of REORDER_CASES) {
        const result = reorderStates(states, c.movedId, c.beforeId);
        expect(result.map((s) => s.id).sort()).toEqual([...ids].sort());
        expect(new Set(result.map((s) => s.id)).size).toBe(ids.length);
      }
    });

    it('leaves every record enabled bit unchanged after a reorder', () => {
      const result = reorderStates(states, 'linkedin', 'x');
      const bitsBefore = new Map(states.map((s) => [s.id, s.enabled]));
      for (const s of result) {
        expect(s.enabled).toBe(bitsBefore.get(s.id));
      }
    });
  });

  describe('getOrderAndEnabled + platforms storage', () => {
    it('returns first-run defaults when no platforms key is stored', async () => {
      stubChromeStorage();
      const { order, enabled } = await getOrderAndEnabled(ALL_EIGHT);
      expect(order).toEqual(DEFAULT_ORDER);
      expect(enabled).toEqual(DEFAULT_ORDER);
      expect(enabled).toHaveLength(8);
    });

    it('toggle via setPlatformEnabled persists and is visible on next read', async () => {
      const { sync } = stubChromeStorage();
      const written = await setPlatformEnabled('x', false, ALL_EIGHT);
      expectOnlyPlatformsKey(sync.set as ReturnType<typeof vi.fn>);
      expect(written.find((s) => s.id === 'x')?.enabled).toBe(false);
      const { enabled } = await getOrderAndEnabled(ALL_EIGHT);
      expect(enabled).not.toContain('x');
    });

    it('serializes overlapping toggles so both persist', async () => {
      // Without a queue both mutators would read the same snapshot and the
      // second write would clobber the first — x or facebook would stay enabled.
      stubChromeStorage();
      const [a, b] = await Promise.all([
        setPlatformEnabled('x', false, ALL_EIGHT),
        setPlatformEnabled('facebook', false, ALL_EIGHT),
      ]);
      expect(a.find((s) => s.id === 'x')?.enabled).toBe(false);
      expect(b.find((s) => s.id === 'facebook')?.enabled).toBe(false);
      // The later write must include both toggles.
      expect(b.find((s) => s.id === 'x')?.enabled).toBe(false);
      const { enabled } = await getOrderAndEnabled(ALL_EIGHT);
      expect(enabled).not.toContain('x');
      expect(enabled).not.toContain('facebook');
    });

    it('custom stored order + mixed enabled bits ⇒ enabled follows stored order', async () => {
      const { syncStore } = stubChromeStorage();
      syncStore.platforms = [
        { id: 'slack', enabled: false },
        { id: 'facebook', enabled: true },
        { id: 'x', enabled: true },
        { id: 'linkedin', enabled: false },
      ] satisfies PlatformState[];

      const registered: PlatformId[] = ['slack', 'facebook', 'x', 'linkedin'];
      const { order, enabled } = await getOrderAndEnabled(registered);
      expect(order).toEqual(['slack', 'facebook', 'x', 'linkedin']);
      expect(enabled).toEqual(['facebook', 'x']);
    });

    it('drops a stored ghost id (unregistered) on read', async () => {
      const { syncStore } = stubChromeStorage();
      syncStore.platforms = [
        { id: 'x', enabled: true },
        { id: 'ghost' as PlatformId, enabled: true },
        { id: 'facebook', enabled: false },
      ] satisfies PlatformState[];

      const { order, enabled } = await getOrderAndEnabled(['x', 'facebook']);
      expect(order).toEqual(['x', 'facebook']);
      expect(enabled).toEqual(['x']);
    });

    it('falls back to storage.local for reads/writes when sync throws', async () => {
      const { local } = stubChromeStorage({ failSync: true });
      await setPlatformEnabled('x', false, ALL_EIGHT);
      expect(local.set).toHaveBeenCalled();
      expectOnlyPlatformsKey(local.set as ReturnType<typeof vi.fn>);
      const { enabled } = await getOrderAndEnabled(ALL_EIGHT);
      expect(local.get).toHaveBeenCalled();
      expect(enabled).not.toContain('x');
    });

    it('does not revert a toggle when sync.set fails but sync.get still works', async () => {
      // The split-brain case: the write falls back to local, so the next read must
      // also come from local — not the still-readable, stale sync value.
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

      await setPlatformEnabled('x', false, ALL_EIGHT);
      expect(local.set).toHaveBeenCalled();
      expect((await getOrderAndEnabled(ALL_EIGHT)).enabled).not.toContain('x');
    });

    it('every set() from platform mutations writes only { platforms }', async () => {
      const { sync } = stubChromeStorage();
      await setPlatformEnabled('x', false, ALL_EIGHT);
      await reorderPlatform('x', 'slack', ALL_EIGHT);
      expectOnlyPlatformsKey(sync.set as ReturnType<typeof vi.fn>);
    });

    it('ignores legacy platformOrder + enabledPlatforms keys (never read)', async () => {
      const { syncStore } = stubChromeStorage();
      // Seed ONLY the legacy keys — no platforms key. Read must return first-run defaults.
      syncStore.platformOrder = [
        'slack',
        'x',
        'facebook',
      ] satisfies PlatformId[];
      syncStore.enabledPlatforms = ['facebook'] satisfies PlatformId[];

      const { order, enabled } = await getOrderAndEnabled(ALL_EIGHT);
      expect(order).toEqual(DEFAULT_ORDER);
      expect(enabled).toEqual(DEFAULT_ORDER);
    });

    it('unrelated reorder never drops a never-before-seen platform from enabled', async () => {
      // THE regression test: a newly-registered platform must stay enabled after
      // reorderPlatform mutates only the positions of already-known ids.
      const { syncStore } = stubChromeStorage();
      const seven: PlatformState[] = [
        { id: 'slack', enabled: true },
        { id: 'x', enabled: false },
        { id: 'facebook', enabled: true },
        { id: 'linkedin', enabled: false },
        { id: 'discord', enabled: true },
        { id: 'whatsapp', enabled: false },
        { id: 'telegram', enabled: true },
      ];
      syncStore.platforms = seven;

      // Eighth id 'google' is registered but not in the seeded seven.
      const registered = ALL_EIGHT; // includes 'google'
      const before = await getOrderAndEnabled(registered);
      expect(before.order).toContain('google');
      expect(before.enabled).toContain('google');
      expect(before.order).toHaveLength(8);

      // Move two EXISTING ids relative to each other (not the new one).
      await reorderPlatform('slack', 'facebook', registered);

      const after = await getOrderAndEnabled(registered);
      expect(after.order).toContain('google');
      expect(after.enabled).toContain('google');
      // Existing disabled bits still stick.
      expect(after.enabled).not.toContain('x');
      expect(after.enabled).not.toContain('linkedin');
    });
  });

  describe('resetPlatformSettings', () => {
    it('removes the platforms key so the next read is first-run defaults', async () => {
      const { syncStore } = stubChromeStorage();
      syncStore.platforms = [
        { id: 'x', enabled: false },
        { id: 'facebook', enabled: true },
      ] satisfies PlatformState[];

      await resetPlatformSettings();
      expect(syncStore.platforms).toBeUndefined();

      const { order, enabled } = await getOrderAndEnabled(ALL_EIGHT);
      expect(order).toEqual(DEFAULT_ORDER);
      expect(enabled).toEqual(DEFAULT_ORDER);
    });

    it('removes platforms + legacy platformOrder + enabledPlatforms when all three are seeded', async () => {
      const { sync, syncStore } = stubChromeStorage();
      syncStore.platforms = [
        { id: 'x', enabled: false },
      ] satisfies PlatformState[];
      syncStore.platformOrder = ['x'] satisfies PlatformId[];
      syncStore.enabledPlatforms = [] satisfies PlatformId[];

      await resetPlatformSettings();

      expect(sync.remove).toHaveBeenCalledWith([
        'platforms',
        'platformOrder',
        'enabledPlatforms',
      ]);
      expect(syncStore.platforms).toBeUndefined();
      expect(syncStore.platformOrder).toBeUndefined();
      expect(syncStore.enabledPlatforms).toBeUndefined();
    });

    it('falls back to storage.local for removal when sync throws', async () => {
      const { local, localStore } = stubChromeStorage({ failSync: true });
      localStore.platforms = [
        { id: 'x', enabled: false },
      ] satisfies PlatformState[];
      localStore.platformOrder = ['x'] satisfies PlatformId[];
      localStore.enabledPlatforms = [] satisfies PlatformId[];

      await resetPlatformSettings();
      expect(local.remove).toHaveBeenCalled();
      expect(localStore.platforms).toBeUndefined();
      expect(localStore.platformOrder).toBeUndefined();
      expect(localStore.enabledPlatforms).toBeUndefined();
    });
  });

  describe('firstRunOrder', () => {
    it('matches DEFAULT_ORDER for the full eight', () => {
      expect(firstRunOrder(ALL_EIGHT)).toEqual(DEFAULT_ORDER);
    });
  });
});
