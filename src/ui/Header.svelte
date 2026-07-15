<script lang="ts">
  import { onDestroy } from 'svelte';
  import ThemeToggle from './ThemeToggle.svelte';
  import IconActionButton from './IconActionButton.svelte';
  import Icon from './Icon.svelte';

  let {
    hasImage,
    onCopy,
    onDownload,
    onOpenEdit,
    editOpen = false,
    scrolled = false,
    onReset,
    canReset = false,
  }: {
    hasImage: boolean;
    onCopy: () => void;
    onDownload: () => void;
    onOpenEdit: () => void;
    editOpen?: boolean;
    scrolled?: boolean;
    onReset?: () => void;
    canReset?: boolean;
  } = $props();

  // Two-step confirm for the Settings reset chip: first click arms, second
  // fires onReset. Auto-reverts after ~3s if the user never confirms.
  let confirming = $state(false);
  let confirmTimeout: ReturnType<typeof setTimeout> | undefined;

  function clearConfirmTimeout() {
    if (confirmTimeout !== undefined) {
      clearTimeout(confirmTimeout);
      confirmTimeout = undefined;
    }
  }

  function onResetClick() {
    if (confirming) {
      clearConfirmTimeout();
      confirming = false;
      onReset?.();
      return;
    }
    confirming = true;
    clearConfirmTimeout();
    confirmTimeout = setTimeout(() => {
      confirming = false;
      confirmTimeout = undefined;
    }, 3000);
  }

  // Armed state must not survive once the chip is hidden (settings back to defaults).
  $effect(() => {
    if (!canReset) {
      confirming = false;
      clearConfirmTimeout();
    }
  });

  onDestroy(() => clearConfirmTimeout());
</script>

<header class="header" class:scrolled>
  {#if editOpen}
    <!-- Edit mode turns the header into a nav bar: back + centered title, browse controls hidden. -->
    <div class="nav">
      <button type="button" class="chip" onclick={onOpenEdit} aria-label="Back">
        <Icon name="chevron-left" size={14} />
      </button>
      <h2 class="title">Settings</h2>
      {#if onReset && canReset}
        <button
          type="button"
          class="chip reset"
          class:confirming
          onclick={onResetClick}
          aria-label={confirming ? 'Confirm reset' : 'Reset to defaults'}
        >
          {#if confirming}
            <span class="reset-label">Confirm?</span>
          {:else}
            <Icon name="rotate-ccw" size={14} />
          {/if}
        </button>
      {/if}
    </div>
  {:else}
    <ThemeToggle />

    <div class="actions">
      <div class="capsule">
        <IconActionButton
          icon="link"
          label="Copy URL"
          onAct={onCopy}
          disabled={!hasImage}
        />
        <span class="divider" aria-hidden="true"></span>
        <IconActionButton
          icon="image-down"
          label="Download"
          onAct={onDownload}
          disabled={!hasImage}
        />
      </div>

      <button
        type="button"
        class="chip"
        onclick={onOpenEdit}
        aria-label="Settings"
      >
        <Icon name="settings" size={14} />
      </button>
    </div>
  {/if}
</header>

<style>
  .header {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    z-index: 20;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 16px;
    background: transparent;
    border-bottom: 0.5px solid var(--border);
    box-sizing: border-box;
    transition: border-bottom-color 0.15s ease;
  }

  .header.scrolled {
    border-bottom-color: transparent;
  }

  .nav {
    position: relative;
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
  }

  .title {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0;
    font-size: 14px;
    font-weight: 500;
    color: var(--fg-primary);
    pointer-events: none;
  }

  .actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  /* Copy + Download share one floating capsule, split by a short hairline. */
  .capsule {
    display: inline-flex;
    align-items: center;
    height: 28px;
    border-radius: 999px;
    background: var(--bg-primary);
    box-shadow: var(--chip-shadow);
  }

  .divider {
    flex: none;
    width: 0.5px;
    height: 14px;
    background: var(--border);
  }

  /* Standalone floating circle — shared by Back and Edit so they read identical. */
  .chip {
    appearance: none;
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    border-radius: 999px;
    background: var(--bg-primary);
    box-shadow: var(--chip-shadow);
    color: var(--fg-secondary);
    cursor: pointer;
    transition:
      color 0.15s ease,
      transform 0.1s ease;
  }

  .chip::after {
    content: '';
    position: absolute;
    inset: -6px;
  }

  .chip:hover {
    color: var(--fg-primary);
  }

  .chip:active {
    transform: scale(0.96);
  }

  .chip:focus-visible {
    outline: 2px solid var(--fg-primary);
    outline-offset: 2px;
  }

  /* Reset chip only: unfurl leftward (right edge pinned by nav flex) into a pill. */
  .chip.reset {
    flex: none;
    overflow: hidden;
    white-space: nowrap;
    transition:
      width 180ms ease,
      color 0.15s ease,
      transform 0.1s ease;
  }

  .chip.reset.confirming {
    width: 88px;
    color: var(--accent);
  }

  .chip.reset.confirming:hover {
    color: var(--accent);
  }

  .reset-label {
    font-size: 13px;
    font-weight: 500;
    line-height: 1;
  }

  @media (prefers-reduced-motion: reduce) {
    .chip {
      transition: none;
    }

    .chip.reset {
      transition: none;
    }
  }
</style>
