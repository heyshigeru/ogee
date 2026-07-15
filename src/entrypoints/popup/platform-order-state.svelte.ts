/**
 * Platform order + enabled state for the popup.
 *
 * Factory-over-`$state`-with-getters (same pattern as card-media.svelte.ts and
 * edit-view-drag.svelte.ts). Owns the first-run seed, storage load, and the
 * three mutators (toggle / reorder / reset) so App.svelte stays a thin view
 * over extraction + render.
 *
 * Mutators share one recovery ladder: apply the written PlatformState[] on
 * success; on failure re-read via getOrderAndEnabled; if that also fails,
 * keep the last known UI state (swallowed — storage fully down).
 */

import type { PlatformId } from '../../core/types';
import {
  firstRunOrder,
  getOrderAndEnabled,
  reorderPlatform,
  resetPlatformSettings,
  setPlatformEnabled,
  type PlatformState,
} from '../../lib/settings';

export interface PlatformOrderState {
  readonly order: PlatformId[];
  readonly enabledIds: PlatformId[];
  readonly ready: boolean;
  readonly isModified: boolean;
  load(): Promise<void>;
  toggle(id: PlatformId, on: boolean): Promise<void>;
  reorder(movedId: PlatformId, beforeId: PlatformId | null): Promise<void>;
  reset(): Promise<void>;
}

export function createPlatformOrderState(
  registered: PlatformId[],
): PlatformOrderState {
  // Single first-run seed: both order and enabledIds start from this default
  // (matching App's previous defaultOrder seeding).
  const defaultOrder = firstRunOrder(registered);

  let order = $state<PlatformId[]>(defaultOrder);
  let enabledIds = $state<PlatformId[]>(defaultOrder);
  let ready = $state(false);

  // Apply a PlatformState[] returned by a settings mutator.
  function applyMutatedStates(states: PlatformState[]): void {
    order = states.map((s) => s.id);
    enabledIds = states.filter((s) => s.enabled).map((s) => s.id);
  }

  // Recovery path: re-read platforms from storage so UI matches storage after a
  // failed mutation. Not used on the success path (mutators return written state).
  async function refreshPlatformState(): Promise<void> {
    const { order: nextOrder, enabled: nextEnabled } =
      await getOrderAndEnabled(registered);
    order = nextOrder;
    enabledIds = nextEnabled;
  }

  /**
   * Run a settings mutator and apply its returned PlatformState[]. On failure,
   * re-sync from storage so UI never drifts. Recovery failure is swallowed —
   * if storage is fully down there is nothing further to do.
   */
  async function mutateWithRecovery(
    mutator: () => Promise<PlatformState[]>,
  ): Promise<void> {
    try {
      applyMutatedStates(await mutator());
    } catch {
      try {
        await refreshPlatformState();
      } catch {
        // Storage fully down; keep last known UI state.
      }
    }
  }

  return {
    get order() {
      return order;
    },
    get enabledIds() {
      return enabledIds;
    },
    get ready() {
      return ready;
    },
    // True when order or enabled set diverge from first-run defaults (shortcuts N/A).
    get isModified() {
      const orderDiffers =
        order.length !== defaultOrder.length ||
        order.some((id, i) => id !== defaultOrder[i]);
      const enabledDiffers = !registered.every((id) => enabledIds.includes(id));
      return orderDiffers || enabledDiffers;
    },
    // Re-read from storage and flip ready. Called from App onMount (in parallel
    // with extractFromActiveTab) — replaces refreshPlatformState().then(...).
    async load(): Promise<void> {
      await refreshPlatformState();
      ready = true;
    },
    // Persist the platform toggle; apply the reconciled state the mutator wrote.
    toggle(id: PlatformId, on: boolean): Promise<void> {
      return mutateWithRecovery(() => setPlatformEnabled(id, on, registered));
    },
    // Persist a drag/keyboard reorder; membership is unchanged by a reorder.
    reorder(movedId: PlatformId, beforeId: PlatformId | null): Promise<void> {
      return mutateWithRecovery(() =>
        reorderPlatform(movedId, beforeId, registered),
      );
    },
    // Drop stored platforms (+ legacy keys), then apply first-run defaults.
    reset(): Promise<void> {
      return mutateWithRecovery(() => resetPlatformSettings(registered));
    },
  };
}
