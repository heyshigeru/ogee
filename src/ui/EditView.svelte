<script lang="ts">
  import { onDestroy, untrack } from 'svelte';
  import { flip } from 'svelte/animate';
  import type { PlatformDefinition, PlatformId } from '../core/types';
  import { getPlatformMap } from '../platforms/registry';
  import PlatformIcon from './PlatformIcon.svelte';
  import Icon from './Icon.svelte';
  import SettingsSection from './SettingsSection.svelte';
  import { createDragReorder } from './edit-view-drag.svelte';

  // A dedicated view (replaces the card list) for choosing which platforms show.
  // The parent owns order + enabled and persists changes; `ready` stays false
  // until it has loaded from storage so a switch reads off rather than flickering
  // on. The back affordance + "Settings" title live in the header (the parent
  // turns the header into a nav bar while this view is open).
  //
  // Single flat list: disabling a platform keeps its position and only dims
  // its name — no divider, no cross-section drag. Arrow keys and pointer drag
  // reorder within the whole list; the switch is the membership path.
  //
  // Pointer drag (not HTML5 DnD): whole-row pointer capture, floating ghost,
  // animate:flip on siblings, live preview via applyReorder in the controller.
  let {
    order,
    enabledIds,
    onToggle,
    onReorder,
    ready = true,
  }: {
    order: PlatformId[];
    enabledIds: PlatformId[];
    // Parent handlers may be async (storage). Call sites void the promise;
    // failures are swallowed inside App so nothing floats as an unhandled rejection.
    onToggle: (id: PlatformId, on: boolean) => void | Promise<void>;
    onReorder: (
      movedId: PlatformId,
      beforeId: PlatformId | null,
    ) => void | Promise<void>;
    ready?: boolean;
  } = $props();

  const controller = createDragReorder(
    () => order,
    (movedId, beforeId) => onReorder(movedId, beforeId),
  );

  onDestroy(() => controller.cancel());

  const effectiveOrder = $derived(controller.previewOrder ?? order);

  const byId = getPlatformMap();

  const effectiveOrderPlatforms: PlatformDefinition[] = $derived(
    effectiveOrder
      .map((id) => byId.get(id))
      .filter((p): p is PlatformDefinition => p !== undefined),
  );

  const draggingPlatform = $derived(
    controller.draggingId ? (byId.get(controller.draggingId) ?? null) : null,
  );

  // After a keyboard reorder the parent re-reads storage and re-renders; restore
  // focus to the moved handle so arrow-key chaining keeps working. Also settle
  // the drag controller once props catch up after a pointer commit.
  let pendingFocusId = $state<PlatformId | null>(null);

  $effect(() => {
    void order;
    void enabledIds;
    controller.settle();
    // Do not subscribe to pendingFocusId: setting it must not re-run this
    // effect before order/enabledIds update, or focus restores at the old
    // DOM position and is then dropped when the keyed each reorders.
    const id = untrack(() => pendingFocusId);
    if (!id) return;
    // Defer until DOM reflects the new order.
    queueMicrotask(() => {
      const el = document.querySelector<HTMLElement>(
        `[data-reorder-handle="${id}"]`,
      );
      el?.focus();
      if (pendingFocusId === id) pendingFocusId = null;
    });
  });

  // Keyboard reorder has no local optimistic preview (unlike pointer drag).
  // Platform mutations are serialized through a settings queue, so key-repeat
  // presses enqueue rather than racing — successive presses always persist.
  function onHandleKeydown(e: KeyboardEvent, id: PlatformId) {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();

    const ids = effectiveOrder;
    const index = ids.indexOf(id);
    if (index === -1) return;

    let beforeId: PlatformId | null;
    if (e.key === 'ArrowUp') {
      if (index === 0) return;
      beforeId = ids[index - 1]!;
    } else {
      if (index === ids.length - 1) return;
      // Move one step down: sit before the item that currently follows the
      // neighbor below us (or at end if that neighbor is last).
      beforeId = index + 2 < ids.length ? ids[index + 2]! : null;
    }

    pendingFocusId = id;
    void onReorder(id, beforeId);
  }

  function registerRowAction(node: HTMLElement, id: PlatformId) {
    const cleanup = controller.registerRow(id, node);
    return { destroy: cleanup };
  }
</script>

{#snippet row(p: PlatformDefinition)}
  {@const isDisabled = !enabledIds.includes(p.id)}
  <!-- role=group: whole-row pointer surface for drag (not a bare static div). -->
  <div
    class="row"
    class:disabled={isDisabled}
    role="group"
    onpointerdown={(e) => controller.handlePointerDown(e, p.id)}
    onclickcapture={(e) => {
      if (controller.consumeClickSuppression()) {
        e.preventDefault();
        e.stopPropagation();
      }
    }}
  >
    <button
      type="button"
      class="handle"
      data-reorder-handle={p.id}
      aria-label="Reorder {p.name}"
      onkeydown={(e) => onHandleKeydown(e, p.id)}
    >
      <Icon name="grip-vertical" size={14} />
    </button>
    <label class="row-main">
      <span class="mark"><PlatformIcon id={p.id} size={14} /></span>
      <span class="name">{p.name}</span>
      <input
        type="checkbox"
        role="switch"
        class="switch"
        checked={ready && enabledIds.includes(p.id)}
        onchange={(e) => void onToggle(p.id, e.currentTarget.checked)}
      />
    </label>
  </div>
{/snippet}

<section class="edit" aria-label="Platforms">
  <SettingsSection title="Platforms">
    <ul class="list">
      <!-- animate:flip must sit on the sole child of a keyed each (Svelte rule). -->
      {#each effectiveOrderPlatforms as p (p.id)}
        <li
          class="item"
          data-id={p.id}
          style={p.id === controller.draggingId
            ? 'visibility: hidden'
            : undefined}
          animate:flip={{
            duration:
              p.id === controller.draggingId ? 0 : controller.flipDuration,
          }}
          use:registerRowAction={p.id}
        >
          {@render row(p)}
        </li>
      {/each}
    </ul>
  </SettingsSection>

  {#if draggingPlatform}
    <div class="ghost" style={controller.ghostStyle()}>
      {@render row(draggingPlatform)}
    </div>
  {/if}
</section>

<style>
  .edit {
    display: flex;
    flex-direction: column;
    gap: 4px;
    /* Ghost uses position:fixed from viewport coords — no relative needed. */
  }

  .list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-height: 4px;
    user-select: none;
  }

  .item {
    list-style: none;
  }

  .row {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 8px 0;
    border-radius: 12px;
    transition: background-color 0.15s ease;
    cursor: grab;
  }

  .row-main {
    display: flex;
    align-items: center;
    gap: 8px;
    flex: 1;
    min-width: 0;
  }

  .handle {
    appearance: none;
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 8px;
    background: transparent;
    color: var(--fg-secondary);
    cursor: grab;
  }

  .handle:focus-visible {
    outline: 2px solid var(--fg-primary);
    outline-offset: 2px;
  }

  .handle:active {
    cursor: grabbing;
  }

  .mark {
    display: inline-flex;
    color: var(--fg-secondary);
  }

  .name {
    flex: 1;
    min-width: 0;
    font-size: 13px;
    font-weight: 400;
    color: var(--fg-primary);
  }

  .disabled .name {
    color: var(--fg-tertiary);
  }

  /* Pill switch. The off-track is defined in app.css and the thumb uses the primary background
     so it reads in both states across themes; the on-track is the accent. */
  .switch {
    appearance: none;
    position: relative;
    flex: none;
    width: 36px;
    height: 20px;
    border-radius: 999px;
    background: var(--switch-track-off);
    cursor: pointer;
    transition: background-color 0.15s ease;
  }

  .switch::after {
    content: '';
    position: absolute;
    top: 2px;
    left: 2px;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--bg-primary);
    box-shadow: 0 2px 2px oklch(0 0 0 / 0.08);
    transition: transform 0.15s ease;
  }

  .switch:checked {
    background: var(--accent);
  }

  .switch:checked::after {
    transform: translateX(16px);
  }

  .switch:focus-visible {
    outline: 2px solid var(--fg-primary);
    outline-offset: 2px;
  }

  .ghost {
    box-sizing: border-box;
    background: var(--bg-secondary);
    border-radius: 12px;
    padding: 0 12px;
  }

  .ghost .row {
    background: var(--bg-secondary);
  }

  :global(html.ogee-dragging),
  :global(html.ogee-dragging *) {
    cursor: grabbing !important;
  }

  @media (prefers-reduced-motion: reduce) {
    .row,
    .switch,
    .switch::after {
      transition: none;
    }
    /* Ghost has no CSS transition (static shadow/scale while dragging). */
  }
</style>
