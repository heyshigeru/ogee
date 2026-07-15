// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { applyReorder } from '../lib/settings';
import {
  createInitialGestureState,
  reduce,
  type GestureState,
  type RowGeometry,
} from './reorder-gesture';

/**
 * Synthetic layout (clientY units):
 *
 *   x 0–40 (mid 20), facebook 40–80 (mid 60), slack 80–120 (mid 100)
 */
const rows: RowGeometry[] = [
  { id: 'x', top: 0, bottom: 40 },
  { id: 'facebook', top: 40, bottom: 80 },
  { id: 'slack', top: 80, bottom: 120 },
];

const order: GestureState['orderSnapshot'] = ['x', 'facebook', 'slack'];

function armAt(
  id: (typeof order)[number] = 'facebook',
  x = 0,
  y = 50,
  orderSnapshot = order,
): GestureState {
  return reduce(createInitialGestureState(), {
    type: 'down',
    id,
    x,
    y,
    order: orderSnapshot,
  }).state;
}

function dragPastThreshold(state: GestureState, dx = 4, dy = 0): GestureState {
  const startX = state.startX;
  const startY = state.startY;
  return reduce(state, {
    type: 'move',
    x: startX + dx,
    y: startY + dy,
  }).state;
}

describe('threshold arming (former exceedsThreshold scenarios)', () => {
  it('stays armed when Euclidean distance is below the default threshold (4px)', () => {
    // hypot(2, 2) ≈ 2.828 < 4
    let state = armAt('facebook', 0, 50);
    state = reduce(state, { type: 'move', x: 2, y: 52 }).state;
    expect(state.phase).toBe('armed');
    expect(state.suppressClick).toBe(false);
    expect(state.dx).toBe(0);
    expect(state.dy).toBe(0);
    expect(state.previewOrder).toBeNull();
  });

  it('enters dragging when distance equals the default threshold', () => {
    // hypot(4, 0) = 4 >= 4
    let state = armAt('facebook', 0, 50);
    state = reduce(state, { type: 'move', x: 4, y: 50 }).state;
    expect(state.phase).toBe('dragging');
    expect(state.suppressClick).toBe(true);
    expect(state.dx).toBe(4);
    expect(state.dy).toBe(0);
  });

  it('enters dragging when distance exceeds the default threshold', () => {
    // hypot(3, 3) ≈ 4.243 >= 4
    let state = armAt('facebook', 0, 50);
    state = reduce(state, { type: 'move', x: 3, y: 53 }).state;
    expect(state.phase).toBe('dragging');
    expect(state.suppressClick).toBe(true);
  });
});

describe('slot resolution via measure (former resolveTargetSlot scenarios)', () => {
  function measurePreview(
    pointerY: number,
    layout: RowGeometry[] = rows,
    draggingId: (typeof order)[number] = 'facebook',
  ): { beforeId: PlatformIdLike; preview: PlatformIdLike[] | null } {
    let state = armAt(draggingId);
    state = dragPastThreshold(state);
    state = reduce(state, {
      type: 'measure',
      pointerY,
      rows: layout,
    }).state;
    return {
      beforeId: state.lastBeforeId,
      preview: state.previewOrder,
    };
  }

  type PlatformIdLike = (typeof order)[number] | null;

  it('resolves the first row when pointer is above its midpoint', () => {
    // pointerY=10 < mid(x)=20
    const { beforeId, preview } = measurePreview(10, rows, 'facebook');
    expect(beforeId).toBe('x');
    expect(preview).toEqual(applyReorder(order, 'facebook', 'x'));
  });

  it('resolves the lower row when pointer is between two midpoints', () => {
    // mid(x)=20 < pointerY=40 < mid(facebook)=60 — but facebook is dragged out,
    // so layout for non-dragged rows is used. Use x as the dragged id so
    // facebook/slack remain in layout.
    const layout: RowGeometry[] = [
      { id: 'facebook', top: 40, bottom: 80 },
      { id: 'slack', top: 80, bottom: 120 },
    ];
    // pointerY=40: mid(facebook)=60 > 40 → before facebook
    let state = armAt('x', 0, 10);
    state = dragPastThreshold(state);
    state = reduce(state, {
      type: 'measure',
      pointerY: 40,
      rows: layout,
    }).state;
    expect(state.lastBeforeId).toBe('facebook');
    expect(state.previewOrder).toEqual(applyReorder(order, 'x', 'facebook'));
  });

  it('resolves null when pointer is below every row midpoint', () => {
    // mid(slack)=100 < pointerY=110
    const { beforeId, preview } = measurePreview(110, rows, 'facebook');
    expect(beforeId).toBe(null);
    expect(preview).toEqual(applyReorder(order, 'facebook', null));
  });

  it('resolves null for an empty rows array', () => {
    const { beforeId, preview } = measurePreview(50, [], 'facebook');
    expect(beforeId).toBe(null);
    expect(preview).toEqual(applyReorder(order, 'facebook', null));
  });

  it('handles a single-row layout above and below its midpoint', () => {
    /**
     * Synthetic layout (clientY units):
     *
     *   x 0–40 (mid 20)
     */
    const single: RowGeometry[] = [{ id: 'x', top: 0, bottom: 40 }];
    // pointerY=10 < mid(x)=20 → insert before x
    expect(measurePreview(10, single, 'facebook').beforeId).toBe('x');
    // mid(x)=20 < pointerY=30 → append (null)
    expect(measurePreview(30, single, 'facebook').beforeId).toBe(null);
  });

  it('skips a row when pointerY equals its midpoint (strict mid > pointerY)', () => {
    // mid(x)=20 === pointerY=20 → x is skipped; next candidate is facebook (mid 60)
    expect(measurePreview(20, rows, 'slack').beforeId).toBe('facebook');
    // mid(slack)=100 === pointerY=100 → last row skipped → null
    expect(measurePreview(100, rows, 'facebook').beforeId).toBe(null);
  });
});

describe('gesture lifecycle', () => {
  it('down → small move stays armed with preview null and no suppressClick', () => {
    let state = armAt('facebook', 10, 10);
    expect(state.phase).toBe('armed');
    expect(state.orderSnapshot).toEqual(order);

    state = reduce(state, { type: 'move', x: 12, y: 11 }).state;
    expect(state.phase).toBe('armed');
    expect(state.previewOrder).toBeNull();
    expect(state.suppressClick).toBe(false);
    expect(state.dx).toBe(0);
    expect(state.dy).toBe(0);
  });

  it('crossing the threshold enters dragging and sets suppressClick', () => {
    let state = armAt('facebook', 0, 0);
    state = dragPastThreshold(state, 5, 0);
    expect(state.phase).toBe('dragging');
    expect(state.suppressClick).toBe(true);
    expect(state.dx).toBe(5);
    expect(state.dy).toBe(0);
  });

  it('measure while dragging sets previewOrder via applyReorder', () => {
    let state = armAt('facebook');
    state = dragPastThreshold(state);
    state = reduce(state, {
      type: 'measure',
      pointerY: 10,
      rows,
    }).state;
    expect(state.previewOrder).toEqual(applyReorder(order, 'facebook', 'x'));
    expect(state.lastBeforeId).toBe('x');
    expect(state.hasResolvedSlot).toBe(true);
  });

  it('second measure resolving to the same slot returns the identical state ref', () => {
    let state = armAt('facebook');
    state = dragPastThreshold(state);
    const first = reduce(state, {
      type: 'measure',
      pointerY: 10,
      rows,
    }).state;
    const second = reduce(first, {
      type: 'measure',
      pointerY: 12, // still mid(x)=20 > pointerY → before 'x'
      rows,
    }).state;
    expect(second).toBe(first);
  });

  it('up while dragging emits commit with last beforeId and keeps previewOrder', () => {
    let state = armAt('facebook');
    state = dragPastThreshold(state);
    state = reduce(state, {
      type: 'measure',
      pointerY: 110,
      rows,
    }).state;
    const preview = state.previewOrder;
    expect(preview).not.toBeNull();

    const result = reduce(state, { type: 'up' });
    expect(result.commit).toEqual({ movedId: 'facebook', beforeId: null });
    expect(result.state.phase).toBe('idle');
    expect(result.state.previewOrder).toBe(preview);
    expect(result.state.previewOrder).not.toBeNull();
    expect(result.state.originId).toBeNull();
    expect(result.state.dx).toBe(0);
    expect(result.state.dy).toBe(0);
  });

  it('up while only armed emits no commit and returns to idle', () => {
    const state = armAt('facebook');
    const result = reduce(state, { type: 'up' });
    expect(result.commit).toBeUndefined();
    expect(result.state.phase).toBe('idle');
    expect(result.state.originId).toBeNull();
    expect(result.state.previewOrder).toBeNull();
  });

  it('cancel clears preview and phase but leaves suppressClick', () => {
    let state = armAt('facebook');
    state = dragPastThreshold(state);
    state = reduce(state, {
      type: 'measure',
      pointerY: 10,
      rows,
    }).state;
    expect(state.suppressClick).toBe(true);
    expect(state.previewOrder).not.toBeNull();

    const result = reduce(state, { type: 'cancel' });
    expect(result.state.phase).toBe('idle');
    expect(result.state.previewOrder).toBeNull();
    expect(result.state.suppressClick).toBe(true);
  });

  it('a fresh down clears leftover suppressClick from a prior cancelled gesture', () => {
    let state = armAt('facebook');
    state = dragPastThreshold(state);
    state = reduce(state, { type: 'cancel' }).state;
    expect(state.suppressClick).toBe(true);

    state = reduce(state, {
      type: 'down',
      id: 'x',
      x: 0,
      y: 0,
      order,
    }).state;
    expect(state.suppressClick).toBe(false);
    expect(state.phase).toBe('armed');
    expect(state.originId).toBe('x');
  });

  it('consumeClick clears suppressClick only', () => {
    let state = armAt('facebook');
    state = dragPastThreshold(state);
    state = reduce(state, {
      type: 'measure',
      pointerY: 10,
      rows,
    }).state;
    expect(state.suppressClick).toBe(true);
    const phase = state.phase;
    const preview = state.previewOrder;

    state = reduce(state, { type: 'consumeClick' }).state;
    expect(state.suppressClick).toBe(false);
    expect(state.phase).toBe(phase);
    expect(state.previewOrder).toBe(preview);
  });
});
