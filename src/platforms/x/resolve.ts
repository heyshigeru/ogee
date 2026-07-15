import type { PageMetadata, PlatformCard, ImageRef } from '../../core/types';
import {
  firstNonBlank,
  firstSafeImage,
  hostnameOf,
  resolveDescription,
  resolveUrl,
} from '../../core/fallback';

/**
 * X (Twitter) card resolver (SPEC §8, ADR P1-D7). Pure over PageMetadata; no extension APIs.
 *
 * Differences from the shared core chains:
 * - Title prioritizes twitter:title over og:title (twitter-first), then htmlTitle.
 * - Primary image prioritizes twitter:image over og:image.
 * - Layout: `summary` / `app` / `player` render thumbnail when a usable image exists
 *   (`player`/`app` are real distinct card types; mapping them to thumbnail is a
 *   deliberate approximation — no player iframe). `summary_large_image` or an absent
 *   card render large iff a usable (safe-url) image exists.
 * - No usable image → `presentation: 'plain-link'` (feed collapse; full URL row), matching
 *   real X more closely than a text-only card shell. URL-only payload: empty title,
 *   no leftover chrome fields (title computed only for rich image cards).
 * - Description is hidden on the large card and shown on the thumbnail card.
 * - Title is returned full (already trimmed by extract); the 3-line CSS clamp in XCard.svelte
 *   is the sole bound and protects the multi-card comparison view.
 */

const THUMBNAIL_CARDS = new Set(['summary', 'app', 'player']);

/** Twitter-first title chain: twitter:title → og:title → htmlTitle → "". */
function resolveXTitle(meta: PageMetadata): string {
  return firstNonBlank(meta.twitterTitle, meta.ogTitle, meta.htmlTitle);
}

/** Twitter-first primary image: first safe of twitter:image → all ogImages. */
function resolveXImage(meta: PageMetadata): ImageRef | undefined {
  return firstSafeImage(meta.twitterImage, ...meta.ogImages);
}

export function resolve(meta: PageMetadata): PlatformCard {
  const url = resolveUrl(meta);
  const displayUrl = hostnameOf(url);

  // resolveXImage already drops unsafe URLs, so a returned image is usable as-is.
  const image = resolveXImage(meta);
  if (image === undefined) {
    // Feed-style collapse: URL-only plain-link (no computed title / card chrome).
    return {
      title: '',
      imageLayout: 'none',
      displayUrl,
      linkUrl: url,
      presentation: 'plain-link',
    };
  }

  const title = resolveXTitle(meta);
  const card: PlatformCard = { title, imageLayout: 'none', displayUrl };

  card.image = { url: image.url, width: image.width, height: image.height };

  const forcesThumbnail =
    meta.twitterCard !== undefined && THUMBNAIL_CARDS.has(meta.twitterCard);
  if (forcesThumbnail) {
    card.imageLayout = 'thumbnail';
    card.description = resolveDescription(meta) || undefined;
  } else {
    // summary_large_image or absent card, with a usable image.
    card.imageLayout = 'large';
    // Description stays undefined on the large card.
  }

  return card;
}
