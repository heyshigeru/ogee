<script lang="ts">
  import type { PlatformCard } from '../../core/types';
  import { createImageFallback } from '../card-media.svelte';
  import PlainLinkRow from '../../ui/PlainLinkRow.svelte';

  // Single prop. Theme is ambient via [data-theme] on the document root; this
  // component never reads or receives a theme prop (architecture P1-D contract).
  let { card }: { card: PlatformCard } = $props();

  const isPlainLink = $derived(card.presentation === 'plain-link');

  // Show the image when we have a usable URL that hasn't failed. (A resolver only sets
  // image when the layout calls for an image, so the URL check alone is sufficient.)
  // `loadFailed` distinguishes "we tried and it broke" (informative inline note) from
  // "the page had no usable image at all" (plain-link presentation from the resolver).
  const image = createImageFallback(() => card.image?.url);

  // hasImageSlot drives whether the card has a media/note area at all.
  const hasImageSlot = $derived(image.showImage || image.loadFailed);
</script>

<!-- X (Twitter) card. Meta order: domain → title (and description below title on the
     thumbnail variant). No usable image → plain URL row (feed collapse). Image load
     error keeps the card shell with an inline note. -->
{#if isPlainLink && card.linkUrl}
  <PlainLinkRow url={card.linkUrl} />
{:else}
  <div
    class="card"
    class:large={card.imageLayout === 'large'}
    class:thumbnail={card.imageLayout === 'thumbnail' && hasImageSlot}
    class:text-only={!hasImageSlot}
  >
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
      <p class="domain">{card.displayUrl}</p>
      <p class="title clamp" style="--clamp-lines: 3">{card.title}</p>
      {#if card.imageLayout !== 'large' && card.description}
        <p class="description clamp" style="--clamp-lines: 2">
          {card.description}
        </p>
      {/if}
    </div>
  </div>
{/if}

<style>
  /* Shared chrome consumed from card tokens (defined in app.css); fallbacks keep
     the component self-contained when rendered in isolation. */
  .card {
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border: 1px solid var(--border, oklch(0.879 0.013 228.946));
    border-radius: var(--card-radius, 16px);
    background: var(--bg-primary, oklch(1 0 0));
    font-family: var(--font-sans);
  }

  /* Thumbnail/summary layout: square thumbnail on the left, text on the right. Only
     applies when an actual image slot is rendered — see hasImageSlot. */
  .card.thumbnail {
    flex-direction: row;
    align-items: stretch;
  }

  .media {
    display: block;
    width: 100%;
    object-fit: cover;
  }

  .card.large .media {
    aspect-ratio: 1.91 / 1;
  }

  .card.thumbnail .media {
    width: 129px;
    height: 129px;
    flex: 0 0 129px;
  }

  .image-note {
    margin: 0;
    padding: 24px 16px;
    text-align: center;
    font-size: 13px;
    color: oklch(0.494 0.029 241.156);
    background: oklch(0.981 0.002 197.122);
  }

  .card.thumbnail .image-note {
    width: 129px;
    flex: 0 0 129px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Separator line between the image (or image-note) and the meta section, matching the
     card's outer border. Applied per variant so we never set a border and then have to
     override it back to none. */
  .card.large .media,
  .card.large .image-note {
    border-bottom: 1px solid var(--border, oklch(0.879 0.013 228.946));
  }
  .card.thumbnail .media,
  .card.thumbnail .image-note {
    border-right: 1px solid var(--border, oklch(0.879 0.013 228.946));
  }

  .body {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 12px;
    min-width: 0;
  }

  /* Real X uses 14pt padding on the large card and 12pt on the thumbnail card. */
  .card.large .body,
  .card.text-only .body {
    padding: 14px;
  }

  /* Real X uses 15px Regular on all three meta lines. Color (not size) still
     carries the visual hierarchy. */
  .domain {
    margin: 0;
    font-size: 15px;
    font-weight: 400;
    color: oklch(0.494 0.029 241.156);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    text-transform: lowercase;
  }

  .title {
    margin: 0;
    font-size: 15px;
    font-weight: 400;
    color: oklch(0.188 0.013 248.51);
    text-overflow: ellipsis;
  }

  .description {
    margin: 0;
    font-size: 15px;
    font-weight: 400;
    line-height: 1.3;
    color: oklch(0.494 0.029 241.156);
  }

  /* Brand color branches only on the ambient theme — no media queries, no prop.
     [data-theme] lives on the document root (an ancestor of this component), so
     it must be wrapped in :global(...) or Svelte prunes these as "unused". */
  :global([data-theme='light']) .card {
    background: oklch(1 0 0);
    border-color: oklch(0.879 0.013 228.946);
  }
  :global([data-theme='light']) .media,
  :global([data-theme='light']) .image-note {
    border-color: oklch(0.879 0.013 228.946);
  }
  :global([data-theme='light']) .title {
    color: oklch(0.188 0.013 248.51);
  }
  :global([data-theme='light']) .description,
  :global([data-theme='light']) .domain {
    color: oklch(0.494 0.029 241.156);
  }

  :global([data-theme='dark']) .card {
    background: oklch(0 0 0);
    border-color: oklch(0.318 0.008 240.077);
  }
  :global([data-theme='dark']) .media,
  :global([data-theme='dark']) .image-note {
    border-color: oklch(0.318 0.008 240.077);
  }
  :global([data-theme='dark']) .title {
    color: oklch(0.933 0.003 228.786);
  }
  :global([data-theme='dark']) .description,
  :global([data-theme='dark']) .domain {
    color: oklch(0.563 0.01 248.002);
  }
  :global([data-theme='dark']) .image-note {
    background: oklch(0.209 0.009 264.373);
    color: oklch(0.563 0.01 248.002);
  }
</style>
