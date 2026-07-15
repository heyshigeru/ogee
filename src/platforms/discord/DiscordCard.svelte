<script lang="ts">
  import type { PlatformCard } from '../../core/types';
  import { SENDER, SENDER_INITIAL, getDiscordSentTime } from '../chat-chrome';
  import { createImageFallback, mediaDisplayBox } from '../card-media.svelte';

  // Single prop. Theme is ambient via [data-theme] on the document root; this
  // component never reads or receives a theme prop (architecture P1-D contract).
  let { card }: { card: PlatformCard } = $props();

  const isPlainLink = $derived(card.presentation === 'plain-link');
  const image = createImageFallback(() => card.image?.url);

  // phase-3-calibration.md 2026-07-15 section
  // 365 = popup card area 448 − avatar 40 − gap 10 − embed borders 4+1 − padding 12+16 (real 432 embed cap is unreachable in the 480px popup)
  const MEDIA_BOX_CONSTRAINTS = { maxWidth: 365, maxHeight: 300 };
  const box = $derived(
    mediaDisplayBox(card, MEDIA_BOX_CONSTRAINTS, image.dims),
  );
</script>

<!-- Discord rendered as a sent chat message (message-chrome level B): a flat message row — a
     circular avatar + sender + time, the pasted-URL line, then Discord's embed.
     No usable image → plain-link: chrome + URL only (no embed). -->
<div class="card">
  <div class="avatar" aria-hidden="true">{SENDER_INITIAL}</div>
  <div class="body">
    <p class="header" aria-hidden="true">
      <span class="sender">{SENDER}</span><span class="time"
        >{getDiscordSentTime()}</span
      >
    </p>

    {#if card.linkUrl}
      <p class="message"><span class="url">{card.linkUrl}</span></p>
    {/if}

    {#if !isPlainLink}
      <article
        class="embed"
        class:large={card.imageLayout === 'large'}
        class:thumbnail={card.imageLayout === 'thumbnail'}
      >
        <div class="text">
          {#if card.siteName}
            <p class="provider">{card.siteName}</p>
          {/if}
          <p class="title clamp" style="--clamp-lines: 2">{card.title}</p>
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
      </article>
    {/if}
  </div>
</div>

<style>
  /* Flat Discord message row. Avatar in a left gutter, content to its right. */
  .card {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 10px;
    padding: 0;
    font-family: var(--font-sans);
  }

  /* Decorative placeholder avatar — a blurple circle with the sender's initial. Discord avatars
     are circular; the brand blurple reads on both surfaces. No real identity. */
  .avatar {
    flex: 0 0 40px;
    width: 40px;
    height: 40px;
    margin-top: 2px;
    border-radius: 50%;
    background: oklch(0.577 0.209 273.85);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    font-weight: 600;
    color: oklch(1 0 0);
  }

  .body {
    min-width: 0;
    flex: 1 1 auto;
  }

  /* Sender + time header. Real Discord: name 16px / weight 500; time ~12px muted. */
  .header {
    margin: 0 0 2px;
    display: flex;
    align-items: baseline;
  }
  .sender {
    font-size: 16px;
    font-weight: 500;
    line-height: 22px;
    margin-right: 4px;
    color: oklch(0.279 0.009 285.794);
  }
  .time {
    font-size: 12px;
    font-weight: 500;
    margin-left: 4px;
    color: oklch(0.483 0.013 274.69);
  }

  /* Pasted-link line (the message text above the embed). Full URL, wraps, link-colored — and NOT
     underlined (Discord links have no underline). Real message text is 16px. */
  .message {
    margin: 0 0 4px;
    font-size: 16px;
    font-weight: 400;
    line-height: 22px;
    overflow-wrap: anywhere;
  }
  .url {
    color: oklch(0.543 0.179 255.027); /* Discord light link blue */
  }

  /* The embed: a rounded card with a 4px grey left bar. */
  .embed {
    max-width: 432px;
    border-radius: 4px;
    border: 1px solid
      color-mix(
        in oklab,
        oklch(0.679 0.012 286.086 / 0.278) 100%,
        oklch(0 0 0 / 0.278) 0%
      );
    border-left: 4px solid
      color-mix(
        in oklab,
        oklch(0.679 0.012 286.086 / 0.361) 100%,
        oklch(0 0 0 / 0.361) 0%
      );
    padding: 2px 16px 16px 12px;
    background: oklch(1 0 0);
  }

  .text {
    min-width: 0;
  }

  /* Provider (site name): small, muted. Real 12px. */
  .provider {
    margin: 8px 0 0 0;
    font-size: 12px;
    font-weight: 400;
    line-height: 17px;
    color: oklch(0.304 0.011 285.745);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Title is a link: link-colored, weight 600, NOT underlined (Discord). Real 16px. */
  .title {
    margin: 8px 0 0 0;
    font-size: 16px;
    font-weight: 600;
    line-height: 22px;
    color: oklch(0.543 0.179 255.027);
    text-overflow: ellipsis;
  }

  .description {
    margin: 8px 0 0 0;
    font-size: 14px;
    font-weight: 400;
    line-height: 18px;
    color: oklch(0.304 0.011 285.745);
  }

  /* Large image: native aspect ratio; max-height cap is inline from MEDIA_BOX_CONSTRAINTS. */
  .embed.large .media {
    display: block;
    width: auto;
    height: auto;
    max-width: 100%;
    margin-top: 16px;
    border-radius: 4px;
  }

  /* Thumbnail variant: text and a small right-side square sit in a row. */
  .embed.thumbnail {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }
  .embed.thumbnail .media {
    flex: 0 0 64px;
    width: 64px;
    height: 64px;
    margin-left: 12px;
    border-radius: 4px;
    object-fit: cover;
  }

  .image-note {
    margin: 12px 0 0;
    padding: 16px;
    text-align: center;
    font-size: 11px;
    color: oklch(0.483 0.013 274.69);
    background: oklch(0.964 0.003 264.542);
    border-radius: 4px;
  }
  .embed.thumbnail .image-note {
    flex: 0 0 64px;
    width: 64px;
    margin: 0 0 0 12px;
    padding: 8px 4px;
  }

  /* Dark theme overrides. Defaults above encode the light theme, so no [data-theme='light']
     block is needed. */
  :global([data-theme='dark']) .sender {
    color: oklch(1 0 0);
  }
  :global([data-theme='dark']) .time {
    color: oklch(0.701 0.01 279.614);
  }
  :global([data-theme='dark']) .url,
  :global([data-theme='dark']) .title {
    color: oklch(0.744 0.12 254.516); /* Discord dark link blue */
  }
  :global([data-theme='dark']) .embed {
    background: oklch(0.35 0.012 279.284);
    border-color: color-mix(
      in oklab,
      oklch(0.679 0.012 286.086 / 0.122) 100%,
      oklch(0 0 0 / 0.122) 0%
    );
    border-left-color: color-mix(
      in oklab,
      oklch(0.679 0.012 286.086 / 0.361) 100%,
      oklch(0 0 0 / 0.361) 0%
    );
  }
  :global([data-theme='dark']) .provider,
  :global([data-theme='dark']) .description {
    color: oklch(0.964 0.001 286.375);
  }
  :global([data-theme='dark']) .image-note {
    background: oklch(0.297 0.008 264.449);
    color: oklch(0.745 0.009 278.589);
  }
</style>
