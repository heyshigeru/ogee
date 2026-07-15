import type { PlatformId } from '../core/types';
import { readKey, writeKey, removeKey } from './storage-area';

/** Canonical platform order (SPEC §14). Seeds first-run order + rank for reconcile. */
export const DEFAULT_ORDER: PlatformId[] = [
  'x',
  'facebook',
  'linkedin',
  'slack',
  'discord',
  'whatsapp',
  'telegram',
  'google',
];

export interface PlatformState {
  id: PlatformId;
  enabled: boolean;
}

const PLATFORMS_KEY = 'platforms';
/** Legacy key — kept only so reset can purge it; never read. */
const ORDER_KEY = 'platformOrder';
/** Legacy key — kept only so reset can purge it; never read. */
const ENABLED_KEY = 'enabledPlatforms';

/** Rank of a platform id in DEFAULT_ORDER; ids not listed sort after ranked ones. */
function defaultRank(id: PlatformId): number {
  const index = DEFAULT_ORDER.indexOf(id);
  return index === -1 ? DEFAULT_ORDER.length : index;
}

/**
 * Reconcile stored platform records against the set of registered platform ids.
 * Keeps still-registered records in stored order (enabled bits untouched), drops
 * unregistered records, then appends registered-but-unstored ids as
 * `{ id, enabled: true }` ranked by DEFAULT_ORDER (unranked ids trailing,
 * tie-broken by `registered` order). Empty stored + the full eight ⇒ DEFAULT_ORDER
 * all-enabled.
 */
export function reconcile(
  stored: PlatformState[],
  registered: PlatformId[],
): PlatformState[] {
  const registeredSet = new Set(registered);
  const kept = stored.filter((s) => registeredSet.has(s.id));
  const keptSet = new Set(kept.map((s) => s.id));
  const missing = registered.filter((id) => !keptSet.has(id));

  missing.sort((a, b) => {
    const ra = defaultRank(a);
    const rb = defaultRank(b);
    if (ra !== rb) return ra - rb;
    // Same rank (both unranked): preserve registered order.
    return registered.indexOf(a) - registered.indexOf(b);
  });

  return [
    ...kept,
    ...missing.map((id): PlatformState => ({ id, enabled: true })),
  ];
}

/**
 * Flip `id`'s enabled bit to `on`; order and every other record are untouched.
 * Callers reconcile against the registry first, so `id` is always present — a
 * missing id is a no-op (same "caller reconciled first" trust as reorderStates).
 */
export function setEnabled(
  states: PlatformState[],
  id: PlatformId,
  on: boolean,
): PlatformState[] {
  return states.map((s) => (s.id === id ? { id: s.id, enabled: on } : s));
}

/**
 * Placement reducer for a drag/keyboard reorder. Removes `movedId` from
 * `order`, then inserts it immediately before `beforeId`. If `beforeId` is
 * `null` or not found in `order`, appends to the end. Output is always a
 * permutation of the input order.
 */
export function applyReorder(
  order: PlatformId[],
  movedId: PlatformId,
  beforeId: PlatformId | null,
): PlatformId[] {
  const without = order.filter((x) => x !== movedId);
  const insertAt = beforeId === null ? -1 : without.indexOf(beforeId);
  if (insertAt === -1) {
    return [...without, movedId];
  }
  return [...without.slice(0, insertAt), movedId, ...without.slice(insertAt)];
}

/**
 * Reorder platform records by position only. Derives the id order, delegates
 * placement to the shared pure `applyReorder`, then rebuilds PlatformState
 * records in the new id order via a Map lookup. No record is created or
 * dropped, no enabled bit is mutated — only position changes.
 */
export function reorderStates(
  states: PlatformState[],
  movedId: PlatformId,
  beforeId: PlatformId | null,
): PlatformState[] {
  const byId = new Map(states.map((s) => [s.id, s]));
  const nextOrder = applyReorder(
    states.map((s) => s.id),
    movedId,
    beforeId,
  );
  return nextOrder.map((id) => byId.get(id)!);
}

/**
 * First-run id order for a registry snapshot: reconcile an empty store and
 * map to ids. Equivalent to DEFAULT_ORDER when `registered` is the full eight.
 */
export function firstRunOrder(registered: PlatformId[]): PlatformId[] {
  return reconcile([], registered).map((s) => s.id);
}

async function getStates(registered: PlatformId[]): Promise<PlatformState[]> {
  const stored = (await readKey<PlatformState[]>(PLATFORMS_KEY)) ?? [];
  return reconcile(stored, registered);
}

/**
 * Single read of the `platforms` key with one reconcile. Preferred combined
 * accessor for callers that need both order and the enabled subsequence.
 * Return shape is `{ order, enabled }` to match App/EditView's existing
 * `order` + `enabledIds` props — not a storage-format artifact.
 */
export async function getOrderAndEnabled(
  registered: PlatformId[],
): Promise<{ order: PlatformId[]; enabled: PlatformId[] }> {
  const states = await getStates(registered);
  return {
    order: states.map((s) => s.id),
    enabled: states.filter((s) => s.enabled).map((s) => s.id),
  };
}

/**
 * Serialize every platforms-key mutation through one promise chain so overlapping
 * read-modify-write calls (rapid toggles, key-repeat reorder) cannot drop updates.
 * Each mutator awaits the previous work before reading, then returns the state it
 * just wrote (or the first-run reconcile after a reset).
 */
let platformMutationQueue: Promise<unknown> = Promise.resolve();

function enqueuePlatformMutation<T>(op: () => Promise<T>): Promise<T> {
  const run = platformMutationQueue.then(op, op);
  // Keep the chain alive after rejections so later mutations still serialize.
  platformMutationQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

/**
 * Toggle a platform's enabled bit and persist the full `platforms` array in a
 * single write. Order is unchanged. Returns the reconciled state just written.
 */
export async function setPlatformEnabled(
  id: PlatformId,
  on: boolean,
  registered: PlatformId[],
): Promise<PlatformState[]> {
  return enqueuePlatformMutation(async () => {
    const states = setEnabled(await getStates(registered), id, on);
    await writeKey(PLATFORMS_KEY, states);
    return states;
  });
}

/**
 * Reorder a platform in the stored list, then persist `platforms` only.
 * Membership and enabled bits are unchanged by a reorder. Returns the
 * reconciled state just written.
 */
export async function reorderPlatform(
  movedId: PlatformId,
  beforeId: PlatformId | null,
  registered: PlatformId[],
): Promise<PlatformState[]> {
  return enqueuePlatformMutation(async () => {
    const states = reorderStates(
      await getStates(registered),
      movedId,
      beforeId,
    );
    await writeKey(PLATFORMS_KEY, states);
    return states;
  });
}

/**
 * Drop the platforms key (and any stray legacy order/enabled keys) so
 * subsequent reads fall back to first-run defaults. Returns the first-run
 * reconciled state for `registered` (defaults to DEFAULT_ORDER).
 */
export async function resetPlatformSettings(
  registered: PlatformId[] = DEFAULT_ORDER,
): Promise<PlatformState[]> {
  return enqueuePlatformMutation(async () => {
    await removeKey([PLATFORMS_KEY, ORDER_KEY, ENABLED_KEY]);
    return reconcile([], registered);
  });
}
