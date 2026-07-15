import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { PlatformId } from '../../core/types';
import type { PlatformState } from '../../lib/settings';

const mockFirstRunOrder = vi.fn();
const mockGetOrderAndEnabled = vi.fn();
const mockSetPlatformEnabled = vi.fn();
const mockReorderPlatform = vi.fn();
const mockResetPlatformSettings = vi.fn();

vi.mock('../../lib/settings', () => ({
  firstRunOrder: (...args: unknown[]) => mockFirstRunOrder(...args),
  getOrderAndEnabled: (...args: unknown[]) => mockGetOrderAndEnabled(...args),
  setPlatformEnabled: (...args: unknown[]) => mockSetPlatformEnabled(...args),
  reorderPlatform: (...args: unknown[]) => mockReorderPlatform(...args),
  resetPlatformSettings: (...args: unknown[]) =>
    mockResetPlatformSettings(...args),
}));

import { createPlatformOrderState } from './platform-order-state.svelte';

const registered: PlatformId[] = ['x', 'facebook', 'linkedin'];
const defaultOrder: PlatformId[] = ['x', 'facebook', 'linkedin'];

function states(entries: [PlatformId, boolean][]): PlatformState[] {
  return entries.map(([id, enabled]) => ({ id, enabled }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockFirstRunOrder.mockReturnValue([...defaultOrder]);
});

describe('createPlatformOrderState', () => {
  it('seeds order and enabledIds from firstRunOrder; ready is false before load', () => {
    const pos = createPlatformOrderState(registered);

    expect(mockFirstRunOrder).toHaveBeenCalledWith(registered);
    expect(pos.order).toEqual(defaultOrder);
    expect(pos.enabledIds).toEqual(defaultOrder);
    expect(pos.ready).toBe(false);
  });

  it('load() applies storage read and flips ready to true', async () => {
    mockGetOrderAndEnabled.mockResolvedValue({
      order: ['linkedin', 'x', 'facebook'] satisfies PlatformId[],
      enabled: ['linkedin', 'facebook'] satisfies PlatformId[],
    });

    const pos = createPlatformOrderState(registered);
    await pos.load();

    expect(mockGetOrderAndEnabled).toHaveBeenCalledWith(registered);
    expect(pos.order).toEqual(['linkedin', 'x', 'facebook']);
    expect(pos.enabledIds).toEqual(['linkedin', 'facebook']);
    expect(pos.ready).toBe(true);
  });

  it('toggle success applies returned PlatformState[]', async () => {
    const pos = createPlatformOrderState(registered);
    mockSetPlatformEnabled.mockResolvedValue(
      states([
        ['x', false],
        ['facebook', true],
        ['linkedin', true],
      ]),
    );

    await pos.toggle('x', false);

    expect(mockSetPlatformEnabled).toHaveBeenCalledWith('x', false, registered);
    expect(pos.order).toEqual(['x', 'facebook', 'linkedin']);
    expect(pos.enabledIds).toEqual(['facebook', 'linkedin']);
  });

  it('reorder success applies returned PlatformState[]', async () => {
    const pos = createPlatformOrderState(registered);
    mockReorderPlatform.mockResolvedValue(
      states([
        ['facebook', true],
        ['x', true],
        ['linkedin', true],
      ]),
    );

    await pos.reorder('x', 'linkedin');

    expect(mockReorderPlatform).toHaveBeenCalledWith(
      'x',
      'linkedin',
      registered,
    );
    expect(pos.order).toEqual(['facebook', 'x', 'linkedin']);
    expect(pos.enabledIds).toEqual(['facebook', 'x', 'linkedin']);
  });

  it('reset success applies returned PlatformState[]', async () => {
    const pos = createPlatformOrderState(registered);
    // Simulate a prior non-default state via a successful toggle first.
    mockSetPlatformEnabled.mockResolvedValue(
      states([
        ['x', false],
        ['facebook', true],
        ['linkedin', true],
      ]),
    );
    await pos.toggle('x', false);

    mockResetPlatformSettings.mockResolvedValue(
      states([
        ['x', true],
        ['facebook', true],
        ['linkedin', true],
      ]),
    );

    await pos.reset();

    expect(mockResetPlatformSettings).toHaveBeenCalledWith(registered);
    expect(pos.order).toEqual(['x', 'facebook', 'linkedin']);
    expect(pos.enabledIds).toEqual(['x', 'facebook', 'linkedin']);
  });

  it('mutator failure recovers via getOrderAndEnabled and applies re-read', async () => {
    const pos = createPlatformOrderState(registered);
    mockSetPlatformEnabled.mockRejectedValue(new Error('write failed'));
    mockGetOrderAndEnabled.mockResolvedValue({
      order: ['x', 'facebook', 'linkedin'] satisfies PlatformId[],
      enabled: ['facebook', 'linkedin'] satisfies PlatformId[],
    });

    await pos.toggle('x', false);

    expect(mockGetOrderAndEnabled).toHaveBeenCalledWith(registered);
    expect(pos.order).toEqual(['x', 'facebook', 'linkedin']);
    expect(pos.enabledIds).toEqual(['facebook', 'linkedin']);
  });

  it('mutator failure and re-read failure leave state unchanged and do not throw', async () => {
    const pos = createPlatformOrderState(registered);
    // Establish a known non-default state first.
    mockSetPlatformEnabled.mockResolvedValueOnce(
      states([
        ['x', false],
        ['facebook', true],
        ['linkedin', true],
      ]),
    );
    await pos.toggle('x', false);
    expect(pos.enabledIds).toEqual(['facebook', 'linkedin']);

    mockSetPlatformEnabled.mockRejectedValueOnce(new Error('write failed'));
    mockGetOrderAndEnabled.mockRejectedValueOnce(new Error('read failed'));

    await expect(pos.toggle('x', true)).resolves.toBeUndefined();

    // Last known UI state preserved.
    expect(pos.order).toEqual(['x', 'facebook', 'linkedin']);
    expect(pos.enabledIds).toEqual(['facebook', 'linkedin']);
  });

  it('isModified is false at defaults, true when reordered or an id is disabled', async () => {
    const pos = createPlatformOrderState(registered);
    expect(pos.isModified).toBe(false);

    mockReorderPlatform.mockResolvedValue(
      states([
        ['facebook', true],
        ['x', true],
        ['linkedin', true],
      ]),
    );
    await pos.reorder('facebook', 'x');
    expect(pos.isModified).toBe(true);

    // Reset back to defaults, then disable one id.
    mockResetPlatformSettings.mockResolvedValue(
      states([
        ['x', true],
        ['facebook', true],
        ['linkedin', true],
      ]),
    );
    await pos.reset();
    expect(pos.isModified).toBe(false);

    mockSetPlatformEnabled.mockResolvedValue(
      states([
        ['x', true],
        ['facebook', false],
        ['linkedin', true],
      ]),
    );
    await pos.toggle('facebook', false);
    expect(pos.isModified).toBe(true);
  });
});
