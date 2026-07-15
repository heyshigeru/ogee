// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { getPlatforms } from '../registry';

// Integration counterpart to registry.test.ts: this exercises the PRODUCTION
// discovery path — importing the registry runs its eager import.meta.glob, which
// must auto-load platforms/x/index.ts and run its top-level register() (SC-8/SC-9).
describe('X self-registration via import.meta.glob', () => {
  it('importing the registry auto-discovers and registers X', () => {
    const x = getPlatforms().find((p) => p.id === 'x');
    expect(x).toBeDefined();
    expect(x!.name).toBe('Twitter');
  });

  it('the discovered X definition is fully formed and its resolve is callable', () => {
    const x = getPlatforms().find((p) => p.id === 'x');
    expect(x!.Component).toBeDefined();
    expect(() =>
      x!.resolve({ ogImages: [], pageUrl: 'https://example.com/page' }),
    ).not.toThrow();
  });
});
