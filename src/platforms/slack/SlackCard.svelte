<script lang="ts">
  import type { PlatformCard } from '../../core/types';
  import { SENDER, SENDER_INITIAL, getSentTime } from '../chat-chrome';
  import {
    createImageFallback,
    createFaviconFallback,
    mediaDisplayBox,
  } from '../card-media.svelte';

  // Single prop. Theme is ambient via [data-theme] on the document root; this
  // component never reads or receives a theme prop (architecture P1-D contract).
  let { card }: { card: PlatformCard } = $props();

  const isPlainLink = $derived(card.presentation === 'plain-link');
  const image = createImageFallback(() => card.image?.url);

  // Favicon error handling (§2.7), separate from the main image: a failed favicon is
  // simply hidden (no note, no effect on the row).
  const favicon = createFaviconFallback(() => card.faviconUrl);

  // phase-3-calibration.md 2026-07-15 section
  const MEDIA_BOX_CONSTRAINTS = { maxWidth: 360, maxHeight: 360 };
  const box = $derived(
    mediaDisplayBox(card, MEDIA_BOX_CONSTRAINTS, image.dims),
  );
</script>

<!-- Slack rendered as a sent chat message (message-chrome level B): a flat message row — a
     decorative avatar + sender + time, the pasted-URL line, then Slack's unfurl.
     Calibrated 2026-05-31 against real app.slack.com.
     No usable image → plain-link: chrome + URL only (no unfurl block). -->
<div class="card">
  <div class="avatar" aria-hidden="true">{SENDER_INITIAL}</div>
  <div class="body">
    <p class="header" aria-hidden="true">
      <span class="sender">{SENDER}</span><span class="time"
        >{getSentTime()}</span
      >
    </p>

    {#if card.linkUrl}
      <p class="message"><span class="url">{card.linkUrl}</span></p>
    {/if}

    {#if !isPlainLink}
      <div
        class="unfurl"
        class:large={card.imageLayout === 'large'}
        class:thumbnail={card.imageLayout === 'thumbnail'}
      >
        <div class="text">
          <div class="meta-row">
            {#if favicon.showFavicon}
              <img
                class="favicon"
                src={card.faviconUrl}
                alt=""
                onerror={() => favicon.fail()}
              />
            {/if}
            {#if card.siteName}
              <span class="service">{card.siteName}</span>
            {/if}
          </div>
          <p class="title">{card.title}</p>
          {#if card.description}
            <p class="description">
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
            style:max-width={`${MEDIA_BOX_CONSTRAINTS.maxWidth}px`}
            style:max-height={`${MEDIA_BOX_CONSTRAINTS.maxHeight}px`}
            onload={(e) => image.loaded(e.currentTarget as HTMLImageElement)}
            onerror={() => image.fail()}
          />
        {:else if image.loadFailed}
          <p class="image-note">Couldn't load the image</p>
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  /* Flat Slack message row. Avatar in a left gutter, content to its right. */
  .card {
    display: flex;
    flex-direction: row;
    align-items: flex-start;
    gap: 8px;
    padding: 0;
    font-family: var(--font-sans);
  }

  /* Decorative placeholder avatar (rounded square, ~36px, like Slack). Mirrors Slack's real
     no-photo default: a solid color + a white initial — here the sender's "Y" (for "You"). No real
     identity. Aubergine (Slack's brand) reads on both the light and dark message surfaces. */
  .avatar {
    flex: 0 0 36px;
    width: 36px;
    height: 36px;
    border-radius: clamp(4px, min(22.222%, 12px), 12px);
    background: oklch(0.374 0.136 323.219);
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

  /* Sender + time header. Real Slack: name 15px / weight 900; time 12px oklch(0.49 0.002 325.607). */
  .header {
    margin: 0 0 2px;
    display: flex;
    align-items: baseline;
    gap: 8px;
  }
  .sender {
    font-size: 15px;
    font-weight: 900;
    line-height: 22.0002px;
    color: oklch(0.228 0.002 325.656);
  }
  .time {
    font-size: 12px;
    font-weight: 400;
    line-height: 22.0002px;
    color: oklch(0.49 0.002 325.607);
  }

  /* Pasted-link line (the message text above the unfurl). Full URL, wraps, underlined in the
     Slack link color. Real message text is 15px. */
  .message {
    margin: 0 0 4px;
    font-size: 15px;
    font-weight: 400;
    line-height: 22.0002px;
    overflow-wrap: anywhere;
  }
  .url {
    color: oklch(0.491 0.124 248.138); /* Slack light link blue */
    text-decoration: underline;
  }

  /* The unfurl (attachment). A 4px grey rounded bar runs the full height down the left (a ::before
     so its ends round independently of the content); content is inset 12px past it. The default
     unfurl bar is neutral grey when the link declares no brand color — which OG previews never do. */
  .unfurl {
    position: relative;
    padding-left: 12px;
  }
  .unfurl::before {
    content: '';
    position: absolute;
    left: 0;
    top: 0;
    bottom: 0;
    width: 4px;
    border-radius: 8px;
    background: oklch(0.898 0 0);
  }

  .text {
    min-width: 0;
  }

  .meta-row {
    display: flex;
    align-items: center;
    min-width: 0;
  }
  .favicon {
    flex: 0 0 16px;
    width: 16px;
    height: 16px;
    object-fit: contain;
    border-radius: 2px;
    margin-right: 8px;
  }
  /* Service name: real Slack is 15px / weight 900. */
  .service {
    margin: 0;
    padding: 2px 0;
    font-size: 15px;
    font-weight: 900;
    line-height: 22.0001px;
    color: oklch(0.228 0.002 325.656);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* Title is a link: underlined, Slack link blue, weight 700. Real 15px. */
  .title {
    margin: 0;
    padding: 2px 0;
    font-size: 15px;
    font-weight: 700;
    line-height: 22.0001px;
    color: oklch(0.491 0.124 248.138);
    text-decoration: underline;
    overflow-wrap: anywhere;
  }

  .description {
    margin: 0;
    padding: 2px 0;
    font-size: 15px;
    font-weight: 400;
    line-height: 22.0001px;
    color: oklch(0.228 0.002 325.656);
    overflow-wrap: anywhere;
  }

  /* Large image: native aspect ratio; max-width/max-height caps are inline from MEDIA_BOX_CONSTRAINTS.
     box-shadow simulates a 1px border. */
  .unfurl.large .media {
    display: block;
    width: auto;
    height: auto;
    max-width: 100%;
    margin-top: 5px;
    border-radius: 8px;
    box-shadow: 0 0 0 1px oklch(0 0 0 / 0.1);
  }

  /* Thumbnail variant: text and a small right-side square sit in a row. */
  .unfurl.thumbnail {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
  }
  .unfurl.thumbnail .media {
    flex: 0 0 64px;
    width: 64px;
    height: 64px;
    margin-left: 8px;
    border-radius: 8px;
    object-fit: cover;
    box-shadow: 0 0 0 1px oklch(0 0 0 / 0.1);
  }

  .image-note {
    margin: 5px 0 0;
    padding: 16px;
    text-align: center;
    font-size: 11px;
    color: oklch(0.49 0.002 325.607);
    background: oklch(0.967 0 0);
    border-radius: 8px;
  }
  .unfurl.thumbnail .image-note {
    flex: 0 0 64px;
    width: 64px;
    margin: 0 0 0 8px;
    padding: 8px 4px;
  }

  /* Dark theme overrides. Defaults above encode the light theme, so no [data-theme='light']
     block is needed. */
  :global([data-theme='dark']) .sender,
  :global([data-theme='dark']) .service,
  :global([data-theme='dark']) .description {
    color: oklch(0.863 0.002 247.842);
  }
  :global([data-theme='dark']) .time {
    color: oklch(0.742 0.003 286.33);
  }
  :global([data-theme='dark']) .url,
  :global([data-theme='dark']) .title {
    color: oklch(0.675 0.118 225.974); /* Slack dark link cyan */
  }
  :global([data-theme='dark']) .unfurl::before {
    background: oklch(0.336 0.008 264.467);
  }
  :global([data-theme='dark']) .image-note {
    background: oklch(0.263 0.009 255.582);
    color: oklch(0.742 0.003 286.33);
  }
  :global([data-theme='dark']) .media {
    box-shadow: 0 0 0 1px oklch(1 0 0 / 0.15);
  }
</style>
