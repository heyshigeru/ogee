import type { PageMetadata, ImageRef } from './types';
import { isSafeUrl } from './url-safety';

/**
 * Shared field-fallback chains over PageMetadata (SPEC §7).
 *
 * A value that is empty after trimming counts as ABSENT — the chain skips it and
 * continues (ADR P1-D7). Pure functions; no DOM, no extension APIs.
 */

/**
 * True when `value` is empty after removing whitespace and common invisible
 * characters (ZWSP/ZWNJ/ZWJ, BOM, word joiner, soft hyphen). Attackers and
 * broken scrapers sometimes pad fields with these so a "present" string is
 * still blank to a human reader — treat that as absent for fallback chains.
 */
function isBlank(value: string): boolean {
  return value.replace(/[\u200B-\u200D\uFEFF\u2060\u00AD]/g, '').trim() === '';
}

/** First chain value that is non-empty after blank-normalization, else "". */
export function firstNonBlank(...values: Array<string | undefined>): string {
  for (const value of values) {
    if (value !== undefined && !isBlank(value)) {
      return value;
    }
  }
  return '';
}

/** Full share title chain: og → twitter → html. Used by WhatsApp, FB/LI titles. */
export function resolveTitle(meta: PageMetadata): string {
  return firstNonBlank(meta.ogTitle, meta.twitterTitle, meta.htmlTitle);
}

/**
 * Unfurl title without HTML fallback: og → twitter.
 * Slack/Discord/Telegram — html alone must not create a rich card (amicro).
 */
export function resolveSocialTitle(meta: PageMetadata): string {
  return firstNonBlank(meta.ogTitle, meta.twitterTitle);
}

/** Full description chain: og → twitter → meta description. */
export function resolveDescription(meta: PageMetadata): string {
  return firstNonBlank(
    meta.ogDescription,
    meta.twitterDescription,
    meta.metaDescription,
  );
}

/** Unfurl description without meta/html: og → twitter. */
export function resolveSocialDescription(meta: PageMetadata): string {
  return firstNonBlank(meta.ogDescription, meta.twitterDescription);
}

/** First image in priority order whose URL is usable (safe to load and act on). */
export function firstSafeImage(
  ...candidates: Array<ImageRef | undefined>
): ImageRef | undefined {
  return candidates.find((image) => isSafeUrl(image?.url));
}

export function resolveImage(meta: PageMetadata): ImageRef | undefined {
  return firstSafeImage(...meta.ogImages, meta.twitterImage);
}

/**
 * Width-driven image layout (P2-D7): an image with no declared width defaults to 'large';
 * a declared width is 'large' at or above `minWidth`, else 'thumbnail'. Callers pass their
 * own calibrated threshold.
 */
export function layoutForWidth(
  width: number | undefined,
  minWidth: number,
): 'large' | 'thumbnail' {
  return width === undefined || width >= minWidth ? 'large' : 'thumbnail';
}

export function resolveUrl(meta: PageMetadata): string {
  return firstNonBlank(meta.ogUrl, meta.canonical, meta.pageUrl);
}

/** Hostname of a URL, lowercased for display; "" when the URL can't be parsed. */
export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Display site name: the page's `og:site_name` when present, else the hostname of `url`
 * (defaulting to the resolved page URL). Callers that index a different address than og:url
 * — e.g. Google, which uses the canonical/page URL — pass their own `url` so the site name
 * and any URL breadcrumb agree on the same host.
 */
export function resolveSiteName(
  meta: PageMetadata,
  url: string = resolveUrl(meta),
): string {
  if (meta.ogSiteName !== undefined && !isBlank(meta.ogSiteName)) {
    return meta.ogSiteName;
  }
  return hostnameOf(url);
}
