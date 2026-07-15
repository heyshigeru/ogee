<script lang="ts">
  import type { PlatformCard } from '../../core/types';
  import { createImageFallback } from '../card-media.svelte';

  // Single prop. Theme is ambient via [data-theme] on the document root; this
  // component never reads or receives a theme prop (architecture P1-D contract).
  let { card }: { card: PlatformCard } = $props();

  // Calibrated 2026-05-28 against real desktop FB feed (see
  // Docs/plans/2026-05-27-ogee-phase-2-design/decisions/phase-3-calibration.md):
  // - With no usable image: fold to a text-only meta block (no placeholder note).
  // - With an image load error: keep an inline informative note (deliberate deviation
  //   from real FB; useful signal for a preview/debugging tool).
  const image = createImageFallback(() => card.image?.url);
</script>

<!-- Facebook feed card: meta is domain → title (no description). Large variant stacks
     image on top of meta with 1pt top/bottom hairlines on the image and a 28pt seam
     icon riding the boundary; thumbnail variant places a 158pt square on the left of
     the meta with a 12pt gap. -->
<div
  class="card"
  class:large={card.imageLayout === 'large'}
  class:thumbnail={card.imageLayout === 'thumbnail'}
>
  {#if image.showImage}
    <div class="image-wrapper">
      <img
        class="media"
        src={card.image?.url}
        alt=""
        onerror={() => image.fail()}
      />
      {#if card.imageLayout === 'large'}
        <span class="seam-icon" aria-hidden="true">
          <svg
            viewBox="0 0 20 20"
            width="20"
            height="20"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M13.502 5a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0zM7.566 8.626a2.818 2.818 0 0 1 3.734.17 2.84 2.84 0 0 1 .477 3.47l-1.26 2.146a.566.566 0 0 0 .722.803l.067-.03a.449.449 0 0 1 .602.24l.026.067c.08.199.03.427-.129.573l-.225.208a2.74 2.74 0 0 1-4.217-3.406l1.522-2.578a.434.434 0 0 0-.468-.645l-.399.089a.604.604 0 0 1-.511-1.058l.06-.049z"
              fill="currentColor"
            />
          </svg>
        </span>
      {/if}
    </div>
  {:else if image.loadFailed}
    <p class="image-note">Couldn't load the image</p>
  {/if}

  <div class="body">
    <p class="domain">{card.displayUrl}</p>
    <p class="title clamp" style="--clamp-lines: 2">{card.title}</p>
  </div>
</div>

<style>
  /* Calibrated chrome: the card is a colored block with no outer border and no
     rounded corners — real FB feed cards are square. The background tint does the
     visual separation against the popup surface. overflow: hidden is retained so
     any descendant that exceeds the card's content area (e.g., a stray oversized
     image) is still safely clipped. */
  .card {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    background: oklch(0.96 0.005 258.325);
    font-family: var(--font-sans);
  }

  /* Thumbnail variant: 158pt square on the left, 12pt gap, then the meta column. */
  .card.thumbnail {
    flex-direction: row;
    align-items: stretch;
  }

  .image-wrapper {
    position: relative;
  }

  /* Shared image/note basics — variant-specific size, padding, and borders live
     in the per-variant rule groups below so each variant's contract reads in one
     place instead of "default + override". */
  .media {
    display: block;
    width: 100%;
    object-fit: cover;
  }

  .image-note {
    margin: 0;
    text-align: center;
    font-size: 13px;
    color: oklch(0.516 0.007 255.51);
    background: oklch(0.925 0.007 268.545);
  }

  /* Large slot: 1pt hairlines top and bottom (shared by media and note); media
     keeps the OG aspect ratio, note pads to roughly match the image's footprint. */
  .card.large .media,
  .card.large .image-note {
    border-top: 1px solid oklch(0 0 0 / 0.1);
    border-bottom: 1px solid oklch(0 0 0 / 0.1);
  }
  .card.large .media {
    aspect-ratio: 1.91 / 1;
  }
  .card.large .image-note {
    padding: 24px 16px;
  }

  /* Thumbnail slot: 158pt square, 12pt right gap, 1pt borders only on top/bottom
     edges (FB lets the gap do the vertical separation). Note variant additionally
     centers its text within the square. */
  .card.thumbnail .media,
  .card.thumbnail .image-note {
    width: 158px;
    height: 158px;
    flex: 0 0 158px;
    margin-right: 12px;
    border-top: 1px solid oklch(0.866 0.006 255.48);
    border-bottom: 1px solid oklch(0.866 0.006 255.48);
  }
  .card.thumbnail .image-note {
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Seam icon (large only): 28pt circle straddling the image/meta seam, 14pt from
     the right edge. Position is relative to .image-wrapper, so bottom: 0 sits on
     the image's bottom edge and translateY(50%) centers the icon on that seam. */
  .seam-icon {
    position: absolute;
    bottom: 0;
    right: 14px;
    transform: translateY(50%);
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: oklch(1 0 0);
    border: 1px solid oklch(0 0 0 / 0.1);
    color: oklch(0.135 0.002 286.074);
  }

  /* Meta block. Padding 8pt vertical / 10pt horizontal; row spacing 4pt. */
  .body {
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 10px;
    min-width: 0;
  }

  /* Real FB uses 13/17px. The lighter weight covers visual density.
     line-height and padding stay frozen. */
  .domain {
    margin: 0;
    font-size: 13px;
    font-weight: 500;
    line-height: 1.23;
    text-transform: uppercase;
    color: oklch(0.516 0.007 255.51);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .title {
    margin: 0;
    font-size: 17px;
    font-weight: 500;
    line-height: 1.18;
    color: oklch(0.135 0.002 286.074);
    text-overflow: ellipsis;
  }

  /* Dark theme overrides. Defaults above already encode the light theme (OGee's
     default), so no separate [data-theme='light'] block is needed. */
  :global([data-theme='dark']) .card {
    background: oklch(0.321 0.002 286.301);
  }
  :global([data-theme='dark']) .card.large .media,
  :global([data-theme='dark']) .card.large .image-note {
    border-top-color: oklch(1 0 0 / 0.05);
    border-bottom-color: oklch(1 0 0 / 0.05);
  }
  :global([data-theme='dark']) .card.thumbnail .media,
  :global([data-theme='dark']) .card.thumbnail .image-note {
    border-top-color: oklch(0.516 0.007 255.51);
    border-bottom-color: oklch(0.516 0.007 255.51);
  }
  :global([data-theme='dark']) .seam-icon {
    background: oklch(0.271 0.003 228.92);
    border-color: oklch(1 0 0 / 0.05);
    color: oklch(0.921 0.006 255.477);
  }
  :global([data-theme='dark']) .domain {
    color: oklch(0.766 0.008 260.731);
  }
  :global([data-theme='dark']) .title {
    color: oklch(0.921 0.006 255.477);
  }
  :global([data-theme='dark']) .image-note {
    background: oklch(0.352 0.002 247.887);
    color: oklch(0.766 0.008 260.731);
  }
</style>
