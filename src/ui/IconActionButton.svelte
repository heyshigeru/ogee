<script lang="ts">
  import { onDestroy } from 'svelte';
  import Icon, { type IconName } from './Icon.svelte';

  // A header action that confirms itself: on click it runs the action and flips
  // its glyph to a checkmark for a beat, then settles back. Copying a URL has no
  // other visible result, so the check IS the feedback.
  let {
    icon,
    label,
    onAct,
    disabled = false,
  }: {
    icon: IconName;
    label: string;
    onAct: () => void | Promise<void>;
    disabled?: boolean;
  } = $props();

  let done = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  async function act() {
    if (disabled) return;
    try {
      await onAct();
    } catch {
      // Stay idle on failure — no console noise, no false success checkmark.
      return;
    }
    done = true;
    clearTimeout(timer);
    timer = setTimeout(() => (done = false), 1200);
  }

  onDestroy(() => clearTimeout(timer));
</script>

<button
  type="button"
  class="icon-btn"
  class:done
  onclick={() => void act()}
  {disabled}
  aria-disabled={disabled}
  aria-label={label}
>
  <span class="ico base"><Icon name={icon} size={14} /></span>
  <span class="ico check"><Icon name="check" size={14} /></span>
</button>

<style>
  .icon-btn {
    appearance: none;
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    /* 14px glyph centered in a 28×28 frame (matches the Edit circle). */
    width: 28px;
    height: 28px;
    padding: 0;
    border: none;
    background: transparent;
    color: var(--fg-secondary);
    cursor: pointer;
    transition:
      color 0.15s ease,
      transform 0.1s ease;
  }

  /* 28×28 is below the 40px tap minimum; extend the hit area vertically (the
     divider blocks horizontal growth between the two adjacent segments). */
  .icon-btn::after {
    content: '';
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 40px;
    transform: translateY(-50%);
  }

  .icon-btn:hover:not(:disabled) {
    color: var(--fg-primary);
  }

  .icon-btn:active:not(:disabled) {
    transform: scale(0.96);
  }

  .icon-btn:focus-visible {
    outline: 2px solid var(--fg-primary);
    outline-offset: 2px;
  }

  .icon-btn:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }

  /* Two glyphs stacked; cross-fade swaps them with a gentle blur + scale pop.
     blur stays at 2px (a 14px glyph dissolves under more). */
  .ico {
    position: absolute;
    display: inline-flex;
    transition:
      opacity 0.2s cubic-bezier(0.25, 1, 0.5, 1),
      transform 0.2s cubic-bezier(0.25, 1, 0.5, 1),
      filter 0.2s cubic-bezier(0.25, 1, 0.5, 1);
  }

  .base {
    opacity: 1;
    transform: scale(1);
    filter: blur(0);
  }

  .check {
    opacity: 0;
    transform: scale(0.7);
    filter: blur(2px);
    /* The success glyph reads at full strength even though the button rests muted. */
    color: var(--fg-primary);
  }

  .done .base {
    opacity: 0;
    transform: scale(0.7);
    filter: blur(2px);
  }

  .done .check {
    opacity: 1;
    transform: scale(1);
    filter: blur(0);
  }

  @media (prefers-reduced-motion: reduce) {
    .icon-btn,
    .ico {
      transition: none;
    }
  }
</style>
