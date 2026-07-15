<script lang="ts">
  import Icon, { type IconName } from './Icon.svelte';

  // Configurable empty state presenter. Generic component with no application-specific defaults.
  let {
    icon,
    message,
    hint,
    role = 'status',
  }: {
    icon?: IconName;
    message: string;
    hint?: string;
    role?: string;
  } = $props();
</script>

<div class="empty" {role}>
  {#if icon}
    <span class="icon"><Icon name={icon} size={32} /></span>
  {/if}
  <p class="message">{message}</p>
  {#if hint}
    <p class="hint">{hint}</p>
  {/if}
</div>

<style>
  .empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 56px 24px;
    text-align: center;
  }

  .icon {
    display: inline-flex;
    color: var(--fg-secondary);
    opacity: 0.75;
    margin-bottom: 12px;
  }

  .message {
    margin: 0;
    font-size: 14px;
    font-weight: 500;
    color: var(--fg-primary);
    text-wrap: balance;
  }

  .hint {
    margin: 8px 0 0;
    max-width: 240px;
    font-size: 12px;
    line-height: 1.45;
    color: var(--fg-secondary);
    text-wrap: pretty;
  }
</style>
