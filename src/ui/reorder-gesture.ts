/**
 * Pure drag-reorder gesture reducer.
 *
 * Framework-free state machine for pointer-driven list reordering. The DOM
 * adapter (edit-view-drag.svelte.ts) measures geometry, attaches listeners,
 * and dispatches GestureEvents; this module owns threshold arming, slot
 * resolution, live preview via applyReorder, commit emission, and click
 * suppression lifecycle.
 */

import type { PlatformId } from '../core/types';
import { applyReorder } from '../lib/settings';

export interface RowGeometry {
  id: PlatformId;
  top: number;
  bottom: number;
}

const DEFAULT_THRESHOLD_PX = 4;

/** True when pointer movement is far enough to count as a drag (not a click). */
function exceedsThreshold(
  dx: number,
  dy: number,
  threshold: number = DEFAULT_THRESHOLD_PX,
): boolean {
  return Math.hypot(dx, dy) >= threshold;
}

/**
 * Resolve where a dragged row should land in a single flat list.
 * @param pointerY  current pointer clientY
 * @param rows      the NON-dragged rows, in visual (top-to-bottom) order
 * @returns the id the dragged row should sit immediately before, or null to append at the end
 */
function resolveTargetSlot(
  pointerY: number,
  rows: RowGeometry[],
): PlatformId | null {
  for (const row of rows) {
    const mid = (row.top + row.bottom) / 2;
    if (mid > pointerY) {
      return row.id;
    }
  }
  return null;
}

export type GesturePhase = 'idle' | 'armed' | 'dragging';

/**
 * Gesture machine state.
 *
 * suppressClick is reset ONLY when a NEW gesture begins (`down` — the adapter
 * only dispatches down after its guards, once per real new gesture), set true
 * when the drag threshold is crossed (armed→dragging on `move`), and
 * read-and-cleared via `consumeClick` — nothing else touches it, so an
 * Escape-triggered cancel (or otherwise cancelled) drag still eats its trailing click.
 */
export interface GestureState {
  phase: GesturePhase;
  /** Row pressed at down; valid while phase is 'armed' or 'dragging'. */
  originId: PlatformId | null;
  startX: number;
  startY: number;
  dx: number;
  dy: number;
  /** Order snapshot captured at down; not re-read mid-gesture. */
  orderSnapshot: PlatformId[];
  previewOrder: PlatformId[] | null;
  suppressClick: boolean;
  lastBeforeId: PlatformId | null;
  hasResolvedSlot: boolean;
}

export type GestureEvent =
  | {
      type: 'down';
      id: PlatformId;
      x: number;
      y: number;
      order: PlatformId[];
    }
  | { type: 'move'; x: number; y: number }
  | { type: 'measure'; pointerY: number; rows: RowGeometry[] }
  | { type: 'up' }
  | { type: 'cancel' }
  | { type: 'consumeClick' };

export interface ReduceResult {
  state: GestureState;
  commit?: { movedId: PlatformId; beforeId: PlatformId | null };
}

export function createInitialGestureState(): GestureState {
  return {
    phase: 'idle',
    originId: null,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
    orderSnapshot: [],
    previewOrder: null,
    suppressClick: false,
    lastBeforeId: null,
    hasResolvedSlot: false,
  };
}

function clearOrigin(state: GestureState): GestureState {
  return {
    ...state,
    phase: 'idle',
    originId: null,
    startX: 0,
    startY: 0,
    dx: 0,
    dy: 0,
    orderSnapshot: [],
    lastBeforeId: null,
    hasResolvedSlot: false,
  };
}

export function reduce(state: GestureState, event: GestureEvent): ReduceResult {
  switch (event.type) {
    case 'down': {
      // Drop any stale suppressClick only when a NEW gesture actually begins.
      return {
        state: {
          phase: 'armed',
          originId: event.id,
          startX: event.x,
          startY: event.y,
          dx: 0,
          dy: 0,
          orderSnapshot: event.order,
          previewOrder: null,
          suppressClick: false,
          lastBeforeId: null,
          hasResolvedSlot: false,
        },
      };
    }

    case 'move': {
      if (state.phase !== 'armed' && state.phase !== 'dragging') {
        return { state };
      }

      const moveDx = event.x - state.startX;
      const moveDy = event.y - state.startY;

      if (state.phase === 'armed') {
        // Below threshold: no dx/dy tracking, no suppressClick, stay armed.
        if (!exceedsThreshold(moveDx, moveDy)) {
          return { state };
        }
        return {
          state: {
            ...state,
            phase: 'dragging',
            dx: moveDx,
            dy: moveDy,
            suppressClick: true,
          },
        };
      }

      // Already dragging: update ghost offsets.
      return {
        state: {
          ...state,
          dx: moveDx,
          dy: moveDy,
        },
      };
    }

    case 'measure': {
      if (state.phase !== 'dragging' || state.originId === null) {
        return { state };
      }

      const beforeId = resolveTargetSlot(event.pointerY, event.rows);
      if (
        state.hasResolvedSlot &&
        state.lastBeforeId === beforeId &&
        state.previewOrder !== null
      ) {
        // Same slot — skip applyReorder churn (return identical state ref).
        return { state };
      }

      return {
        state: {
          ...state,
          hasResolvedSlot: true,
          lastBeforeId: beforeId,
          previewOrder: applyReorder(
            state.orderSnapshot,
            state.originId,
            beforeId,
          ),
        },
      };
    }

    case 'up': {
      if (state.phase === 'dragging' && state.originId !== null) {
        // Keep preview until settle() after parent props catch up.
        // Do NOT clear suppressClick — trailing click must still be eaten.
        return {
          state: {
            ...clearOrigin(state),
            previewOrder: state.previewOrder,
            suppressClick: state.suppressClick,
          },
          commit: {
            movedId: state.originId,
            beforeId: state.lastBeforeId,
          },
        };
      }

      // Armed only (threshold never crossed), or idle: no commit.
      if (state.phase === 'armed') {
        return {
          state: {
            ...clearOrigin(state),
            previewOrder: null,
            suppressClick: state.suppressClick,
          },
        };
      }

      return { state };
    }

    case 'cancel': {
      // Clear preview and phase; suppressClick is intentionally left alone so
      // a cancelled drag still eats its trailing click.
      return {
        state: {
          ...clearOrigin(state),
          previewOrder: null,
          suppressClick: state.suppressClick,
        },
      };
    }

    case 'consumeClick': {
      return {
        state: {
          ...state,
          suppressClick: false,
        },
      };
    }
  }
}
