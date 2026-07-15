// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { getPlatforms } from './registry';
import { DEFAULT_ORDER, firstRunOrder } from '../lib/settings';

// PRODUCTION discovery path (no mocks): importing the registry runs its eager
// import.meta.glob, which auto-loads every platforms/<id>/index.ts and runs its
// top-level register(). This is the cross-cutting FR-P2-9 / self-registration check —
// unlike registry.test.ts (which neutralizes the glob to test the empty store contract),
// this file exercises the real all-eight discovery.
describe('Phase 2 — all eight platforms self-register via the registry glob', () => {
  it('discovers all eight canonical platform ids', () => {
    const ids = getPlatforms()
      .map((p) => p.id)
      .sort();
    expect(ids).toEqual([...DEFAULT_ORDER].sort());
  });

  it('first-run order against the registry seeds DEFAULT_ORDER', () => {
    const registered = getPlatforms().map((p) => p.id);
    expect(firstRunOrder(registered)).toEqual(DEFAULT_ORDER);
  });

  it('every discovered definition is fully formed (id, name, callable resolve, Component)', () => {
    for (const def of getPlatforms()) {
      expect(typeof def.id).toBe('string');
      expect(typeof def.name).toBe('string');
      expect(def.Component).toBeDefined();
      expect(() =>
        def.resolve({ ogImages: [], pageUrl: 'https://example.com/page' }),
      ).not.toThrow();
    }
  });
});
