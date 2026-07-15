/**
 * Pointer-driven reorder controller for EditView.
 *
 * Factory-over-`$state`-with-getters (same pattern as card-media.svelte.ts).
 * Gesture math lives in reorder-gesture (pure reduce); this file is the DOM
 * adapter — listeners, measurement, pointer capture, ghost chrome.
 */

import { SvelteMap } from 'svelte/reactivity';
import type { PlatformId } from '../core/types';
import {
  createInitialGestureState,
  reduce,
  type GestureState,
  type RowGeometry,
} from './reorder-gesture';

export interface DragReorderController {
  readonly draggingId: PlatformId | null;
  readonly previewOrder: PlatformId[] | null;
  readonly flipDuration: number;
  ghostStyle(): string;
  handlePointerDown(e: PointerEvent, id: PlatformId): void;
  registerRow(id: PlatformId, el: HTMLElement): () => void;
  consumeClickSuppression(): boolean;
  cancel(): void;
  settle(): void;
}

interface OriginRect {
  left: number;
  top: number;
  width: number;
}

export function createDragReorder(
  getOrder: () => PlatformId[],
  onReorder: (
    movedId: PlatformId,
    beforeId: PlatformId | null,
  ) => void | Promise<void>,
): DragReorderController {
  let gesture = $state<GestureState>(createInitialGestureState());

  const flipDuration =
    typeof matchMedia !== 'undefined' &&
    matchMedia('(prefers-reduced-motion: reduce)').matches
      ? 0
      : 200;

  const rows = new SvelteMap<PlatformId, HTMLElement>();

  let activePointerId: number | null = null;
  let originRect: OriginRect | null = null;

  // Coalesce geometry re-reads to at most one per animation frame. Rects are
  // re-measured each frame (not cached at drag start) because FLIP moves rows.
  let slotRafId: number | null = null;
  let pendingPointerY = 0;

  let onMove: ((e: PointerEvent) => void) | null = null;
  let onUp: ((e: PointerEvent) => void) | null = null;
  let onCancel: ((e: PointerEvent) => void) | null = null;
  let onKey: ((e: KeyboardEvent) => void) | null = null;
  let captureTarget: Element | null = null;
  let capturePointerId: number | null = null;

  function cancelSlotRaf(): void {
    if (slotRafId !== null) {
      cancelAnimationFrame(slotRafId);
      slotRafId = null;
    }
  }

  function detachListeners(): void {
    if (onMove) window.removeEventListener('pointermove', onMove);
    if (onUp) window.removeEventListener('pointerup', onUp);
    if (onCancel) window.removeEventListener('pointercancel', onCancel);
    if (onKey) window.removeEventListener('keydown', onKey);
    onMove = null;
    onUp = null;
    onCancel = null;
    onKey = null;
  }

  function releaseCapture(): void {
    if (
      captureTarget &&
      capturePointerId !== null &&
      typeof captureTarget.releasePointerCapture === 'function'
    ) {
      try {
        captureTarget.releasePointerCapture(capturePointerId);
      } catch {
        // Already released or never captured (jsdom).
      }
    }
    captureTarget = null;
    capturePointerId = null;
  }

  function endChrome(): void {
    document.documentElement.classList.remove('ogee-dragging');
    releaseCapture();
    detachListeners();
    cancelSlotRaf();
    activePointerId = null;
    originRect = null;
  }

  function captureOriginRect(id: PlatformId): OriginRect | null {
    const el = rows.get(id);
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    return { left: rect.left, top: rect.top, width: rect.width };
  }

  function buildRowGeometry(excludeId: PlatformId): RowGeometry[] {
    // Visual top-to-bottom: walk registered elements by their current layout.
    const entries: { id: PlatformId; rect: DOMRect }[] = [];
    for (const [id, el] of rows) {
      if (id === excludeId) continue;
      entries.push({ id, rect: el.getBoundingClientRect() });
    }
    entries.sort((a, b) => a.rect.top - b.rect.top);
    return entries.map(({ id, rect }) => ({
      id,
      top: rect.top,
      bottom: rect.bottom,
    }));
  }

  function dispatchMeasure(pointerY: number): void {
    const draggingId = gesture.phase === 'dragging' ? gesture.originId : null;
    if (!draggingId) return;
    const rowsGeom = buildRowGeometry(draggingId);
    const result = reduce(gesture, {
      type: 'measure',
      pointerY,
      rows: rowsGeom,
    });
    gesture = result.state;
  }

  /** Schedule slot recompute on the next animation frame (latest pointerY wins). */
  function scheduleUpdateSlot(pointerY: number): void {
    pendingPointerY = pointerY;
    if (slotRafId !== null) return;
    slotRafId = requestAnimationFrame(() => {
      slotRafId = null;
      dispatchMeasure(pendingPointerY);
    });
  }

  function handlePointerDown(e: PointerEvent, id: PlatformId): void {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    // Already tracking a gesture.
    if (gesture.phase !== 'idle') return;

    // Ignore pointerdowns on genuine interactive controls (switch, links, form
    // fields) so a slightly-shaky tap cannot arm drag and suppress the intended
    // click. The row body (label.row-main) and grip handle (button) remain
    // whole-row drag surfaces.
    const target = e.target;
    if (
      target instanceof Element &&
      target.closest('input, a, select, textarea')
    ) {
      return;
    }

    activePointerId = e.pointerId;
    originRect = captureOriginRect(id);

    const result = reduce(gesture, {
      type: 'down',
      id,
      x: e.clientX,
      y: e.clientY,
      order: getOrder(),
    });
    gesture = result.state;

    onMove = (ev: PointerEvent) => {
      if (activePointerId === null || ev.pointerId !== activePointerId) return;

      const wasDragging = gesture.phase === 'dragging';
      const moveResult = reduce(gesture, {
        type: 'move',
        x: ev.clientX,
        y: ev.clientY,
      });
      gesture = moveResult.state;

      if (!wasDragging && gesture.phase === 'dragging') {
        document.documentElement.classList.add('ogee-dragging');
        const moveTarget = ev.target as Element | null;
        if (moveTarget && typeof moveTarget.setPointerCapture === 'function') {
          try {
            moveTarget.setPointerCapture(activePointerId);
            captureTarget = moveTarget;
            capturePointerId = activePointerId;
          } catch {
            // jsdom / already captured.
          }
        }
        // Seed origin rect if registerRow hadn't run yet at pointerdown.
        if (!originRect && gesture.originId) {
          originRect = captureOriginRect(gesture.originId);
        }
        scheduleUpdateSlot(ev.clientY);
        return;
      }

      if (gesture.phase === 'dragging') {
        scheduleUpdateSlot(ev.clientY);
      }
    };

    onUp = (ev: PointerEvent) => {
      if (activePointerId === null || ev.pointerId !== activePointerId) return;
      // Flush any pending slot recompute so lastBeforeId is current on commit.
      if (slotRafId !== null) {
        cancelSlotRaf();
        dispatchMeasure(pendingPointerY);
      }

      const upResult = reduce(gesture, { type: 'up' });
      gesture = upResult.state;
      endChrome();

      if (upResult.commit) {
        // Parent catches storage failures; void so a rejection never floats.
        void onReorder(upResult.commit.movedId, upResult.commit.beforeId);
      }
    };

    onCancel = (ev: PointerEvent) => {
      if (activePointerId === null || ev.pointerId !== activePointerId) return;
      cancel();
    };

    onKey = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape' && gesture.phase === 'dragging') {
        ev.preventDefault();
        cancel();
      }
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
    window.addEventListener('keydown', onKey);
  }

  function cancel(): void {
    const result = reduce(gesture, { type: 'cancel' });
    gesture = result.state;
    endChrome();
  }

  function consumeClickSuppression(): boolean {
    const v = gesture.suppressClick;
    const result = reduce(gesture, { type: 'consumeClick' });
    gesture = result.state;
    return v;
  }

  function settle(): void {
    // Clear preview only when not currently dragging (match prior semantics).
    if (gesture.phase !== 'dragging' && gesture.previewOrder !== null) {
      gesture = { ...gesture, previewOrder: null };
    }
  }

  function ghostStyle(): string {
    if (gesture.phase !== 'dragging' || !originRect) return '';
    return [
      'position: fixed',
      `left: ${originRect.left}px`,
      `top: ${originRect.top}px`,
      `width: ${originRect.width}px`,
      `transform: translate(${gesture.dx}px, ${gesture.dy}px) scale(0.98)`,
      'pointer-events: none',
      'z-index: 1000',
      'will-change: transform',
    ].join('; ');
  }

  return {
    get draggingId() {
      return gesture.phase === 'dragging' ? gesture.originId : null;
    },
    get previewOrder() {
      return gesture.previewOrder;
    },
    get flipDuration() {
      return flipDuration;
    },
    ghostStyle,
    handlePointerDown,
    registerRow(id, el) {
      rows.set(id, el);
      return () => {
        if (rows.get(id) === el) rows.delete(id);
      };
    },
    consumeClickSuppression,
    cancel,
    settle,
  };
}
