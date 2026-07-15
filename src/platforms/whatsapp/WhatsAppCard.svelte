<script lang="ts">
  import type { PlatformCard } from '../../core/types';
  import { getSentTime } from '../chat-chrome';
  import { createImageFallback, mediaDisplayBox } from '../card-media.svelte';

  // Single prop. Theme is ambient via [data-theme] on the document root; this
  // component never reads or receives a theme prop (architecture P1-D contract).
  let { card }: { card: PlatformCard } = $props();

  const image = createImageFallback(() => card.image?.url);

  // phase-3-calibration.md 2026-07-15 section
  // 334 = bubble content 324 (340 − 9 − 7) + .preview negative margins 6 + 4; cover square fills the slot (real WhatsApp uses 240 + a narrowed bubble — deliberate deviation)
  const MEDIA_SLOT = 334;
  const MEDIA_BOX_CONSTRAINTS = {
    maxWidth: MEDIA_SLOT,
    coverSquare: MEDIA_SLOT,
  };
  const box = $derived(
    mediaDisplayBox(card, MEDIA_BOX_CONSTRAINTS, image.dims),
  );
</script>

<!-- WhatsApp rendered as a sent chat message (message-chrome level B): a right-aligned green
     bubble with a tail, holding the rich link preview (image on top, then title/description/
     domain), the pasted-URL line, and a timestamp. Calibrated 2026-05-30 against real
     web.whatsapp.com. No usable image → text-only preview (bubble + meta, no image slot). -->
<div class="card">
  <div class="bubble">
    <div class="preview">
      {#if image.showImage}
        <img
          class="media"
          src={card.image?.url}
          alt=""
          width={box?.width}
          height={box?.height}
          style:width={box ? `${box.width}px` : undefined}
          style:height={box ? `${box.height}px` : undefined}
          style:max-height={`${MEDIA_BOX_CONSTRAINTS.coverSquare}px`}
          onload={(e) => image.loaded(e.currentTarget as HTMLImageElement)}
          onerror={() => image.fail()}
        />
      {:else if image.loadFailed}
        <p class="image-note">Couldn't load the image</p>
      {/if}
      <div class="meta">
        <p class="title clamp" style="--clamp-lines: 2">{card.title}</p>
        {#if card.description}<p
            class="description clamp"
            style="--clamp-lines: 2"
          >
            {card.description}
          </p>{/if}
        <p class="domain">{card.displayUrl}</p>
      </div>
    </div>

    {#if card.linkUrl}
      <!-- url, spacer, and time are kept whitespace-tight on one line: the spacer reserves
           the time's width on the URL's last line, and any text node between them would add
           a stray gap. -->
      <p class="link">
        <span class="url">{card.linkUrl}</span><span
          class="time-spacer"
          aria-hidden="true"
        ></span><span class="time" aria-hidden="true">{getSentTime()} ✓</span>
      </p>
    {/if}
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

  /* Sent (outgoing) bubble. Real WhatsApp web: light oklch(0.957 0.067 141.121) / dark oklch(0.377 0.07 163.416), ~7.5px corners
     with a small flap (tail) at the top-right where the corner is squared off. */
  .bubble {
    position: relative;
    max-width: 340px;
    box-sizing: border-box;
    padding: 6px 7px 8px 9px;
    border-radius: 7.5px;
    border-top-right-radius: 0;
    background: oklch(0.957 0.067 141.121);
  }
  .bubble::after {
    content: '';
    position: absolute;
    top: 0;
    right: -7.5px;
    width: 0;
    height: 0;
    border-top: 7.5px solid oklch(0.957 0.067 141.121);
    border-right: 7.5px solid transparent;
  }

  /* The rich preview sits inside the bubble as a rounded panel with a subtle overlay tint
     over the bubble color. negative margins pull it close to the bubble edges. */
  .preview {
    overflow: hidden;
    border-radius: 6px;
    background: oklch(0.801 0.009 67.698 / 0.15);
    margin: -3px -4px 6px -6px;
  }

  /* Large image: native aspect ratio up to WhatsApp's media width. The pre-measurement bound
     is the inline style:max-height sourced from MEDIA_BOX_CONSTRAINTS.coverSquare — tall
     no-dims images render as a cover-cropped ≤334 square even before the box is computed;
     object-fit: cover is a no-op whenever the box matches the intrinsic ratio.
     334 = bubble content 324 (340 − 9 − 7) + .preview negative margins 6 + 4; cover square
     fills the slot (real WhatsApp uses 240 + a narrowed bubble — deliberate deviation;
     phase-3-calibration.md 2026-07-15). */
  .media {
    display: block;
    width: 100%;
    height: auto;
    object-fit: cover;
  }

  .image-note {
    margin: 0;
    padding: 24px 12px;
    text-align: center;
    font-size: 11px;
    color: oklch(0 0 0 / 0.6);
    background: oklch(0 0 0 / 0.05);
  }

  /* Meta padding 6/10 (measured). Order: title → description → domain. Real WhatsApp is
     13.6/12/12 px; we use native font sizing. */
  .meta {
    padding: 6px 10px;
  }

  .title {
    margin: 0 0 2px 0;
    font-size: 13.6px;
    font-weight: 600;
    line-height: 19px;
    color: oklch(0.145 0 0);
    text-overflow: ellipsis;
  }

  .description {
    margin: 0;
    font-size: 12px;
    font-weight: 400;
    line-height: 19px;
    color: oklch(0 0 0 / 0.6);
  }

  .domain {
    margin: 0;
    padding: 1px 0 0 0;
    font-size: 12px;
    font-weight: 400;
    line-height: 19px;
    color: oklch(0 0 0 / 0.6);
  }

  /* Pasted-link line, below the preview panel. Full URL, wraps across as many
     lines as needed (long URLs break mid-string), underlined throughout — matching real
     WhatsApp. The timestamp is absolutely positioned at the bottom-right; an invisible inline
     spacer the width of the time reserves room on the URL's last line, so the time sits inline
     when it fits and drops to its own line when it doesn't (the standard WhatsApp time trick). */
  .link {
    position: relative;
    margin: 0;
    padding: 0;
    font-size: 14px;
    line-height: 20px;
    overflow-wrap: anywhere;
  }

  .url {
    color: oklch(0.553 0.122 157.306);
    text-decoration: underline;
    letter-spacing: 0.16px;
  }

  .time-spacer {
    display: inline-block;
    width: 64px;
  }

  .time {
    position: absolute;
    right: 0;
    bottom: -2px;
    font-size: 12px;
    font-weight: 400;
    line-height: 1.4;
    color: oklch(0 0 0 / 0.45);
    white-space: nowrap;
  }

  /* Dark theme overrides. Defaults above encode the light theme, so no [data-theme='light']
     block is needed. */
  :global([data-theme='dark']) .bubble {
    background: oklch(0.377 0.07 163.416);
  }
  :global([data-theme='dark']) .bubble::after {
    border-top-color: oklch(0.377 0.07 163.416);
  }
  :global([data-theme='dark']) .preview {
    background: oklch(0 0 0 / 0.2);
  }
  :global([data-theme='dark']) .title {
    color: oklch(0.985 0 0);
  }
  :global([data-theme='dark']) .description,
  :global([data-theme='dark']) .domain {
    color: oklch(1 0 0 / 0.6);
  }
  :global([data-theme='dark']) .url {
    color: oklch(0.71 0.182 151.181);
  }
  :global([data-theme='dark']) .time {
    color: oklch(1 0 0 / 0.6);
  }
  :global([data-theme='dark']) .image-note {
    background: oklch(1 0 0 / 0.06);
    color: oklch(1 0 0 / 0.6);
  }
</style>
