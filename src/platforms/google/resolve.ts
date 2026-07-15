import type { PageMetadata, PlatformCard } from '../../core/types';
import { firstNonBlank, resolveSiteName } from '../../core/fallback';
import { isSafeUrl } from '../../core/url-safety';

/**
 * Google search-snippet resolver (SPEC §8, architecture §3.5, archetype (d); calibrated
 * 2026-06-01 against real google.com/search, see
 * Docs/plans/2026-05-27-ogee-phase-2-design/decisions/phase-3-calibration.md). Pure over
 * PageMetadata; no extension APIs.
 *
 * This platform is NOT og-based and never emits a preview image:
 * - Title comes from `meta.htmlTitle` (the <title>), NOT og:title.
 * - Description comes from `meta.metaDescription`, NOT og:description; omitted when blank.
 * - imageLayout is ALWAYS 'none' (image undefined), even when an og:image exists.
 * - displayUrl is a URL breadcrumb built from the crawl URL — `canonical` then `pageUrl`, NOT
 *   og:url (Google indexes the canonical/page address, not the OG hint): scheme + hostname
 *   + up to 3 percent-decoded path segments joined with " › ".
 * - siteName uses that SAME crawl URL for its hostname fallback (not og:url), so the site-name
 *   line and the breadcrumb always agree on the host; an explicit og:site_name still wins.
 * - Title and description are returned full (already trimmed by extract); CSS line-clamp
 *   is the sole truncation mechanism.
 */

const MAX_BREADCRUMB_SEGMENTS = 3;
const SEPARATOR = ' › ';

/** Percent-decode a single path segment; leave it untouched if it isn't valid encoding. */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

/**
 * Scheme + hostname followed by up to 3 non-empty path segments joined with " › "
 * (e.g. https://www.example.com/a/b/c → "https://www.example.com › a › b › c").
 * A bare hostname (no path) yields just the scheme + hostname; on parse failure returns "".
 */
function breadcrumb(url: string): string {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return '';
  }
  if (parsed.hostname === '') return '';

  const segments = parsed.pathname
    .split('/')
    .filter((s) => s !== '')
    .slice(0, MAX_BREADCRUMB_SEGMENTS)
    .map(decodeSegment);
  return [
    `${parsed.protocol}//${parsed.hostname.toLowerCase()}`,
    ...segments,
  ].join(SEPARATOR);
}

export function resolve(meta: PageMetadata): PlatformCard {
  const title = meta.htmlTitle ?? '';
  // extract guarantees metaDescription is a non-empty trimmed string or undefined.
  const description = meta.metaDescription || undefined;

  // Google indexes the canonical/page URL, not og:url — derive both the breadcrumb and the
  // site-name host fallback from the same crawl URL so they can never disagree.
  const crawlUrl = firstNonBlank(meta.canonical, meta.pageUrl);

  const card: PlatformCard = {
    title,
    imageLayout: 'none',
    displayUrl: breadcrumb(crawlUrl),
    siteName: resolveSiteName(meta, crawlUrl),
    faviconUrl: isSafeUrl(meta.favicon) ? meta.favicon : undefined,
  };
  if (description) card.description = description;

  return card;
}
