// @vitest-environment node
import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { PlatformDefinition } from '../core/types';

// Test the registry's in-memory contract in ISOLATION with a fake definition.
// The real all-platforms auto-discovery is exercised in registry.integration.test.ts
// (and X specifically in x/index.test.ts); here we neutralize the eager glob's import
// of every platform/<id>/index.ts so none self-register and invalidate the "empty
// before registration" scenario.
// The list spans the full PlatformId union so adding a platform needs no edit
// here: mocking an as-yet-uncreated path is inert until that file exists and the
// glob imports it.
vi.mock('./x/index.ts', () => ({}));
vi.mock('./facebook/index.ts', () => ({}));
vi.mock('./linkedin/index.ts', () => ({}));
vi.mock('./slack/index.ts', () => ({}));
vi.mock('./discord/index.ts', () => ({}));
vi.mock('./google/index.ts', () => ({}));
vi.mock('./whatsapp/index.ts', () => ({}));
vi.mock('./telegram/index.ts', () => ({}));

// The registry holds module-level state. Reset modules before each test and
// re-import inside the test so every scenario starts from a clean registry.
beforeEach(() => {
  vi.resetModules();
});

const fakeX: PlatformDefinition = {
  id: 'x',
  name: 'X',
  resolve: () => ({ title: '', imageLayout: 'none', displayUrl: '' }),
  Component: {} as PlatformDefinition['Component'],
};

describe('Platform registry — self-registering platform discovery', () => {
  it('getPlatforms() includes X after its module registers', async () => {
    const { register, getPlatforms } = await import('./registry');
    register(fakeX);
    expect(getPlatforms().some((p) => p.id === 'x')).toBe(true);
  });

  it('register() dedupes by id', async () => {
    const { register, getPlatforms } = await import('./registry');
    register(fakeX);
    register(fakeX);
    expect(getPlatforms().filter((p) => p.id === 'x')).toHaveLength(1);
  });

  it('getPlatforms() returns [] before any registration', async () => {
    const { getPlatforms } = await import('./registry');
    expect(getPlatforms()).toEqual([]);
  });

  it('Each registered definition exposes id, name, resolve, Component', async () => {
    const { register, getPlatforms } = await import('./registry');
    register(fakeX);
    const def = getPlatforms().find((p) => p.id === 'x');
    expect(def).toBeDefined();
    expect(def!.id).toBe('x');
    expect(def!.name).toBe('X');
    expect(def!.Component).toBeDefined();
    expect(() =>
      def!.resolve({ ogImages: [], pageUrl: 'https://example.com' }),
    ).not.toThrow();
  });
});
