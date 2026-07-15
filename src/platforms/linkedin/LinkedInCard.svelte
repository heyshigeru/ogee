<script lang="ts">
  import type { PlatformCard } from '../../core/types';
  import { createImageFallback } from '../card-media.svelte';

  // Single prop. Theme is ambient via [data-theme] on the document root; this
  // component never reads or receives a theme prop (architecture P1-D contract).
  let { card }: { card: PlatformCard } = $props();

  // Calibrated 2026-05-29 against real desktop-web LinkedIn (see
  // Docs/plans/2026-05-27-ogee-phase-2-design/decisions/phase-3-calibration.md):
  // - With no usable image: fold to a text-only meta block (no placeholder note).
  // - With an image load error: keep an inline note in the thumbnail slot (deliberate
  //   deviation from real LinkedIn; useful signal for a preview/debugging tool).
  const image = createImageFallback(() => card.image?.url);
</script>

<!-- LinkedIn compact link preview: a fixed 128×72 thumbnail on the left, then a
     title-over-domain meta column. Single layout — no large/hero variant. -->
<div class="card">
  {#if image.showImage}
    <img
      class="media"
      src={card.image?.url}
      alt=""
      onerror={() => image.fail()}
    />
  {:else if image.loadFailed}
    <p class="image-note">Couldn't load the image</p>
  {/if}

  <div class="body">
    <p class="title clamp" style="--clamp-lines: 2">{card.title}</p>
    <p class="domain">{card.displayUrl}</p>
  </div>
</div>

<style>
  /* Calibrated chrome: 8pt rounded corners, 1pt oklch(0.64 0 0 / 0.2) border, white
     bg. The radius is pinned (not inherited from the shared 16pt --card-radius token)
     because LinkedIn's preview uses an 8pt corner. */
  .card {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 12px;
    padding: 12px;
    border: 1px solid oklch(0.64 0 0 / 0.2);
    border-radius: 8px;
    font-family: var(--font-sans);
  }

  /* Fixed 128×72 (16:9) thumbnail with its own 8pt rounding. The note box mirrors
     the thumbnail's footprint so a load error doesn't shift the meta column. */
  .media,
  .image-note {
    flex: 0 0 128px;
    width: 128px;
    height: 72px;
    border-radius: 8px;
  }

  .media {
    display: block;
    object-fit: cover;
  }

  .image-note {
    margin: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    text-align: center;
    font-size: 12px;
    color: oklch(0 0 0 / 0.6);
    background: oklch(0.971 0.004 236.497);
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    min-width: 0;
  }

  /* Real LinkedIn is 14pt semibold title / 12pt regular domain.
     Weight, line-height (1.25), and the title's 2-line clamp stay frozen. */
  .title {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.25;
    color: oklch(0 0 0 / 0.902);
    text-overflow: ellipsis;
  }

  .domain {
    margin: 0;
    padding: 0.5px 0;
    font-size: 12px;
    line-height: 1.25;
    color: oklch(0 0 0 / 0.6);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Dark variant. Real LinkedIn does have a dark mode; these values approximate it
     and keep the popup cohesive when OGee is dark. Defaults above are the light theme,
     so no separate [data-theme='light'] block is needed. */
  :global([data-theme='dark']) .card {
    border-color: oklch(0.378 0.025 250.746);
  }
  :global([data-theme='dark']) .title {
    color: oklch(1 0 0 / 0.902);
  }
  :global([data-theme='dark']) .domain {
    color: oklch(1 0 0 / 0.6);
  }
  :global([data-theme='dark']) .image-note {
    background: oklch(0.313 0.018 231.958);
    color: oklch(1 0 0 / 0.6);
  }
</style>
