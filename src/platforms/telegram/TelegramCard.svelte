<script lang="ts">
  import type { PlatformCard } from '../../core/types';
  import { getSentTime } from '../chat-chrome';
  import { createImageFallback, mediaDisplayBox } from '../card-media.svelte';

  // Single prop. Theme is ambient via [data-theme] on the document root; this
  // component never reads or receives a theme prop (architecture P1-D contract).
  let { card }: { card: PlatformCard } = $props();

  const isPlainLink = $derived(card.presentation === 'plain-link');
  const image = createImageFallback(() => card.image?.url);

  // phase-3-calibration.md 2026-07-15 section
  // 306 = bubble content 324 (340 − 8 − 8) − .preview border-left 3 − padding 9 + 6
  const MEDIA_BOX_CONSTRAINTS = { maxWidth: 306, maxHeight: 432 };
  const box = $derived(
    mediaDisplayBox(card, MEDIA_BOX_CONSTRAINTS, image.dims),
  );
</script>

<!-- Telegram rendered as a sent chat message (message-chrome level B): a right-aligned bubble
     (green in light, violet in dark) with a tail, holding the pasted-URL line on top and
     Telegram's link-preview block below. Calibrated 2026-05-31 against real web.telegram.org/k/.
     No usable image → plain-link: bubble + URL only (no preview block). -->
<div
  class="card"
  class:large={card.imageLayout === 'large'}
  class:thumbnail={card.imageLayout === 'thumbnail'}
  class:image-visible={image.showImage}
  class:plain-link={isPlainLink}
>
  <div class="bubble">
    {#if card.linkUrl}
      <p class="link"><span class="url">{card.linkUrl}</span></p>
    {/if}

    {#if !isPlainLink}
      <div class="preview">
        <div class="text">
          {#if card.siteName}
            <p class="site-name">{card.siteName}</p>
          {/if}
          <p class="title">{card.title}</p>
          {#if card.description}
            <p class="description clamp" style="--clamp-lines: 3">
              {card.description}
            </p>
          {/if}
        </div>

        {#if image.showImage}
          <img
            class="media"
            src={card.image?.url}
            alt=""
            width={box?.width}
            height={box?.height}
            style:width={box ? `${box.width}px` : undefined}
            style:height={box ? `${box.height}px` : undefined}
            style:max-height={`${MEDIA_BOX_CONSTRAINTS.maxHeight}px`}
            onload={(e) => image.loaded(e.currentTarget as HTMLImageElement)}
            onerror={() => image.fail()}
          />
        {:else if image.loadFailed}
          <p class="image-note">Couldn't load the image</p>
        {/if}
      </div>
    {/if}

    <!-- Static decorative timestamp. Size: 12px, Weight: 400.
         Tick is styled independently: light oklch(0.671 0.162 146.097), dark oklch(1 0 0). -->
    <p class="time" aria-hidden="true">
      {getSentTime()} <span class="tick">✓</span>
    </p>
  </div>
</div>

<style>
  /* Right-align the bubble: a sent message hugs the right edge, leaving empty space on the
     left — part of what reads as "a chat message". */
  .card {
    display: flex;
    justify-content: flex-end;
    font-family: var(--font-sans);
  }

  /* Sent (outgoing) bubble. Real Telegram web: light oklch(0.946 0.073 131.163) / dark oklch(0.579 0.141 287), with a small tail at
     the bottom-right. Corners rounded to clean px: 15/6/0/15. */
  .bubble {
    position: relative;
    max-width: 340px;
    box-sizing: border-box;
    padding: 5px 8px 6px 8px;
    border-radius: 15px 6px 0 15px;
    background: oklch(0.946 0.073 131.163);
  }
  .bubble::after {
    content: '';
    position: absolute;
    bottom: 0;
    right: -7px;
    width: 0;
    height: 0;
    border-bottom: 8px solid oklch(0.946 0.073 131.163);
    border-right: 7px solid transparent;
  }

  /* Pasted-link line on top of the bubble. Full URL, wraps across lines,
     underlined in the bubble's blue accent color (light oklch(0.644 0.162 251.765) / dark oklch(1 0 0)). */
  .link {
    margin: 0;
    padding: 0;
    font-size: 15px;
    line-height: 1.35;
    overflow-wrap: anywhere;
  }
  .url {
    color: oklch(0.644 0.162 251.765);
    text-decoration: underline;
  }

  /* Plain-link (no preview): give the URL line room above the absolute time stamp. */
  .card.plain-link .link {
    margin-bottom: 18px;
  }

  /* Telegram's link-preview block: an accent-tinted rounded panel with a 3px accent bar down the
     left. Margin-top: 4px, margin-bottom: 18px to clear space for the time/receipt block. */
  .preview {
    position: relative;
    overflow: hidden;
    border-radius: 4px;
    border-left: 3px solid oklch(0.671 0.162 146.097);
    padding: 3px 6px 3px 9px;
    background: oklch(0.912 0.083 134.536);
    margin-top: 4px;
    margin-bottom: 18px;
  }

  .text {
    min-width: 0;
  }

  /* Site name, title, description are 14px in native Telegram.
     Hierarchy is by color, weight, and line-height. */
  .site-name {
    margin: 0 0 2px 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 18px;
    color: oklch(0.671 0.162 146.097); /* accent */
  }

  .title {
    margin: 0 0 2px 0;
    font-size: 14px;
    font-weight: 600;
    line-height: 18px;
    color: oklch(0 0 0);
    overflow-wrap: anywhere;
  }

  .description {
    margin: 0 0 2px 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 17.5px;
    color: oklch(0 0 0);
  }

  /* Large image: native aspect ratio; max-height cap is inline from MEDIA_BOX_CONSTRAINTS. */
  .card.large .media {
    display: block;
    width: auto;
    height: auto;
    max-width: 100%;
    margin-top: 4px;
    margin-bottom: 3px;
    border-radius: 6px;
  }

  /* Thumbnail variant: text and a small right-side square sit in a row. */
  .card.thumbnail .preview {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    justify-content: space-between;
  }
  .card.thumbnail .media {
    flex: 0 0 64px;
    width: 64px;
    height: 64px;
    margin-left: 8px;
    border-radius: 6px;
    object-fit: cover;
  }

  .image-note {
    margin: 4px 0 3px;
    padding: 16px;
    text-align: center;
    font-size: 11px;
    color: oklch(0 0 0 / 0.55);
    background: oklch(0 0 0 / 0.05);
    border-radius: 6px;
  }
  .card.thumbnail .image-note {
    flex: 0 0 64px;
    width: 64px;
    margin: 0 0 0 8px;
    padding: 8px 4px;
  }

  /* Timestamp. Consistently placed at the bottom-right corner of the bubble,
     next to the read receipts. Size: 12px, Weight: 400. */
  .time {
    position: absolute;
    right: 8px;
    bottom: 4px;
    margin: 0 4px 0 0;
    text-align: right;
    font-size: 12px;
    font-weight: 400;
    line-height: 1.2;
    color: oklch(0.671 0.161 143.336);
    white-space: nowrap;
  }

  /* Tick (read receipt checkmark). Spaced slightly from the time text. */
  .tick {
    margin-left: 3px;
    color: oklch(0.671 0.162 146.097);
  }

  /* Dark theme overrides. */
  :global([data-theme='dark']) .bubble {
    background: oklch(0.579 0.141 287);
  }
  :global([data-theme='dark']) .bubble::after {
    border-bottom-color: oklch(0.579 0.141 287);
  }
  :global([data-theme='dark']) .preview {
    border-left-color: oklch(1 0 0);
    background: oklch(0.624 0.149 289.577);
  }
  :global([data-theme='dark']) .url,
  :global([data-theme='dark']) .site-name,
  :global([data-theme='dark']) .title,
  :global([data-theme='dark']) .description {
    color: oklch(1 0 0);
  }
  :global([data-theme='dark']) .time {
    color: oklch(1 0 0 / 0.533);
  }
  :global([data-theme='dark']) .tick {
    color: oklch(1 0 0);
  }
  :global([data-theme='dark']) .image-note {
    background: oklch(1 0 0 / 0.08);
    color: oklch(1 0 0 / 0.6);
  }
</style>
