<script lang="ts">
  import { onMount } from 'svelte';
  import {
    applyPreference,
    getThemePreference,
    setThemePreference,
    type ThemePreference,
  } from '../lib/theme';
  import Icon, { type IconName } from './Icon.svelte';

  // Local mirror of the active preference so the segmented control reflects the
  // current choice. Seeded from the stored preference on mount (so a persisted
  // Light/Dark choice is highlighted, not the System default), then driven by
  // user clicks thereafter.
  let current = $state<ThemePreference>('system');
  // A click before the stored preference resolves must win; the seed below skips
  // the overwrite once the user has interacted (otherwise the async read would
  // clobber the click and the highlighted segment would disagree with the theme).
  let interacted = false;

  onMount(async () => {
    const stored = await getThemePreference();
    if (!interacted) current = stored;
  });

  const options: { value: ThemePreference; label: string; icon: IconName }[] = [
    { value: 'system', label: 'System', icon: 'monitor' },
    { value: 'light', label: 'Light', icon: 'sun' },
    { value: 'dark', label: 'Dark', icon: 'moon' },
  ];

  function choose(value: ThemePreference) {
    interacted = true;
    current = value;
    // Persist the preference, then apply the resolved theme immediately so the
    // popup updates without waiting for the async write to settle.
    void setThemePreference(value);
    applyPreference(value);
  }
</script>

<div class="theme-toggle" role="group" aria-label="Theme">
  {#each options as opt (opt.value)}
    <button
      type="button"
      class="seg"
      class:active={current === opt.value}
      aria-pressed={current === opt.value}
      aria-label={opt.label}
      title={opt.label}
      onclick={() => choose(opt.value)}
    >
      <Icon name={opt.icon} size={14} />
    </button>
  {/each}
</div>

<style>
  /* A filled capsule track holding three segments; the selected one lifts into a
     rounded thumb. No gap — the thumb's own rounded ends do the separating. */
  .theme-toggle {
    display: inline-flex;
    padding: 2px;
    border-radius: 999px;
    background: var(--bg-secondary);
  }

  .seg {
    appearance: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 999px;
    padding: 5px 10px;
    line-height: 0;
    color: var(--fg-secondary);
    background: transparent;
    cursor: pointer;
    transition:
      color 0.15s ease,
      background-color 0.15s ease,
      transform 0.1s ease;
  }

  .seg:hover {
    color: var(--fg-primary);
  }

  .seg:active {
    transform: scale(0.96);
  }

  .seg.active {
    color: var(--fg-primary);
    background: var(--control-bg-active);
    box-shadow:
      0 1px 2px oklch(0 0 0 / 0.08),
      0 1px 1px oklch(0 0 0 / 0.04);
  }

  .seg:focus-visible {
    outline: 2px solid var(--fg-primary);
    outline-offset: 2px;
  }

  @media (prefers-reduced-motion: reduce) {
    .seg {
      transition: none;
    }
  }
</style>
