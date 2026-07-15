<script lang="ts">
  import type { PlatformCard } from '../../core/types';
  import { createFaviconFallback } from '../card-media.svelte';

  // Single prop. Theme is ambient via [data-theme] on the document root; this
  // component never reads or receives a theme prop (architecture P1-D contract).
  let { card }: { card: PlatformCard } = $props();

  // Favicon error handling (§2.7): a failed favicon is simply hidden (no note).
  const favicon = createFaviconFallback(() => card.faviconUrl);
</script>

<!-- Google search snippet: a favicon + site name + breadcrumb header, a blue title,
     and a gray description. No preview image element at all (imageLayout is always
     'none'). CardShell renders the platform-name label. -->
<div class="card">
  <div class="header">
    {#if favicon.showFavicon}
      <img
        class="favicon"
        src={card.faviconUrl}
        alt=""
        onerror={() => favicon.fail()}
      />
    {/if}
    <div class="site">
      {#if card.siteName}
        <span class="site-name">{card.siteName}</span>
      {/if}
      <span class="breadcrumb">{card.displayUrl}</span>
    </div>
  </div>

  <p class="title clamp" style="--clamp-lines: 1">{card.title}</p>
  {#if card.description}
    <p class="description clamp" style="--clamp-lines: 2">
      {card.description}
    </p>
  {/if}
</div>

<style>
  /* Self-contained snippet; Google modern results are borderless / very subtle. Calibrated
     2026-06-01 against real google.com/search (light + dark; see
     Docs/plans/2026-05-27-ogee-phase-2-design/decisions/phase-3-calibration.md). */
  .card {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0;
    background: transparent;
    font-family: var(--font-sans);
  }

  .header {
    display: flex;
    align-items: center;
    gap: 0;
    min-width: 0;
  }

  /* Favicon 28x28px circle container with background and borders */
  .favicon {
    width: 28px;
    height: 28px;
    flex: 0 0 28px;
    margin-right: 12px;
    object-fit: cover;
    border-radius: 50%;
    box-sizing: border-box;
    border: 1px solid oklch(0.864 0 0);
    background-color: oklch(0.969 0.003 228.784);
  }

  .site {
    display: flex;
    flex-direction: column;
    line-height: 1.2;
    min-width: 0;
  }

  .site-name {
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    color: oklch(0.239 0 0);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .breadcrumb {
    font-size: 12px;
    font-weight: 400;
    line-height: 18px;
    color: oklch(0.433 0.01 253.934);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Header to title vertical spacing of 8px (padding-top 5px + margin-top 3px) */
  .title {
    margin: 3px 0 0 0;
    padding: 5px 0 0 0;
    font-size: 22px;
    font-weight: 400;
    line-height: 28px;
    color: oklch(0.351 0.222 269.092); /* Google result blue */
    text-overflow: ellipsis;
  }

  /* Title to description vertical spacing is 0px */
  .description {
    margin: 0;
    font-size: 14px;
    line-height: 22px;
    color: oklch(0.531 0 0);
  }

  /* Dark theme overrides. */
  :global([data-theme='dark']) .card {
    background: transparent;
  }
  :global([data-theme='dark']) .favicon {
    background-color: oklch(1 0 0);
    border-color: oklch(0.395 0.004 174.267);
  }
  :global([data-theme='dark']) .site-name {
    color: oklch(0.931 0 0);
  }
  :global([data-theme='dark']) .breadcrumb {
    color: oklch(0.809 0.008 253.865);
  }
  :global([data-theme='dark']) .description {
    color: oklch(0.699 0 0);
  }
  :global([data-theme='dark']) .title {
    color: oklch(0.809 0.097 257.291);
  }
</style>
