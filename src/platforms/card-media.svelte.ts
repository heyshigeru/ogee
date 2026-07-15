/**
 * Shared image / favicon load-failure state for platform card components.
 *
 * Why this exists: the `showImage` / `loadFailed` / `failedUrl` trio was
 * byte-identical across seven platform cards, and the favicon pair
 * (`faviconFailed` / `showFavicon`) was duplicated in two. Failure semantics
 * belong in one module so cards cannot drift; markup and calibrated visuals
 * stay per-card (P2-D1).
 *
 * Image failure tracks the failed URL (not a boolean) so a later different
 * working URL recovers on the same instance — the documented XCard pattern.
 * Favicon failure is a simple boolean hide (no note).
 *
 * Getters re-read `getUrl()` and `$state` on each access, so they stay
 * reactive when used from a component template or `$derived` without needing
 * `$derived` inside this module.
 */

import type { PlatformCard } from '../core/types';

export interface MediaBoxConstraints {
  /** Max content width of the media slot (px, calibrated per card). */
  maxWidth: number;
  /** Max media height (px, calibrated per card); omit when the card has no height cap (WhatsApp). */
  maxHeight?: number;
  /** WhatsApp: images taller than square crop into a cover square of this size. */
  coverSquare?: number;
}

/**
 * Precomputed display box for a native-ratio LARGE image, mirroring how the
 * real platforms size link-preview media (they inline computed pixel boxes).
 *
 * Effective dims = `measured` when provided, else the declared
 * `card.image.width/height` pair. Measured wins because post-load
 * naturalWidth/naturalHeight is ground truth; lying declared meta must not
 * distort the rendered box.
 *
 * Returns undefined unless layout is 'large' and effective dims exist
 * (a lone declared dimension cannot establish a ratio; neither measured nor a
 * complete declared pair → fall back to the per-card CSS caps at load time).
 * The `imageLayout === 'large'` gate is unconditional: non-large layouts
 * never get a box, even when measured dims are supplied.
 * Non-positive dims (malformed page metadata) are treated as absent.
 */
export function mediaDisplayBox(
  card: PlatformCard,
  c: MediaBoxConstraints,
  measured?: { width: number; height: number },
): { width: number; height: number } | undefined {
  if (card.imageLayout !== 'large') {
    return undefined;
  }

  let effectiveWidth: number;
  let effectiveHeight: number;
  if (measured !== undefined) {
    effectiveWidth = measured.width;
    effectiveHeight = measured.height;
  } else if (
    card.image?.width !== undefined &&
    card.image?.height !== undefined
  ) {
    effectiveWidth = card.image.width;
    effectiveHeight = card.image.height;
  } else {
    return undefined;
  }

  if (effectiveWidth <= 0 || effectiveHeight <= 0) {
    return undefined;
  }

  if (c.coverSquare !== undefined && effectiveHeight > effectiveWidth) {
    return { width: c.coverSquare, height: c.coverSquare };
  }

  // Contain: fit inside maxWidth/maxHeight without upscaling past effective width.
  let w = Math.min(effectiveWidth, c.maxWidth);
  let h = Math.round((w * effectiveHeight) / effectiveWidth);
  if (c.maxHeight !== undefined && h > c.maxHeight) {
    h = c.maxHeight;
    w = Math.round((h * effectiveWidth) / effectiveHeight);
  }
  // Rounding can floor an extreme ratio to 0 on either axis (e.g. 1200x1
  // rounds h to 0; 1x1e6 rounds w to 0 in the reclamp). A degenerate 0px
  // box is worse than none — fall back to the CSS-cap path, same as the
  // non-positive-dims guard above.
  if (w < 1 || h < 1) {
    return undefined;
  }
  return { width: w, height: h };
}

export function createImageFallback(getUrl: () => string | undefined): {
  readonly showImage: boolean;
  readonly loadFailed: boolean;
  readonly dims: { width: number; height: number } | undefined;
  fail(): void;
  loaded(img: HTMLImageElement): void;
} {
  let failedUrl = $state<string | undefined>(undefined);
  // Stored with the URL they were recorded for so a later different URL
  // re-derives as undefined (same as-of pattern as failedUrl / loadFailed).
  let recorded = $state<
    { url: string; width: number; height: number } | undefined
  >(undefined);

  return {
    get showImage() {
      const url = getUrl();
      return !!url && url !== failedUrl;
    },
    get loadFailed() {
      const url = getUrl();
      return !!url && url === failedUrl;
    },
    get dims() {
      const url = getUrl();
      if (!url || !recorded || recorded.url !== url) return undefined;
      return { width: recorded.width, height: recorded.height };
    },
    fail() {
      failedUrl = getUrl();
    },
    loaded(img: HTMLImageElement) {
      // jsdom default / broken images report 0×0 — don't record garbage.
      if (img.naturalWidth === 0 || img.naturalHeight === 0) return;
      const url = getUrl();
      if (!url) return;
      recorded = {
        url,
        width: img.naturalWidth,
        height: img.naturalHeight,
      };
    },
  };
}

export function createFaviconFallback(getUrl: () => string | undefined): {
  readonly showFavicon: boolean;
  fail(): void;
} {
  let failed = $state(false);

  return {
    get showFavicon() {
      return !!getUrl() && !failed;
    },
    fail() {
      failed = true;
    },
  };
}
