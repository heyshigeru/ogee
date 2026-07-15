import type { PageMetadata } from './types';

/**
 * Extract Open Graph and page metadata from the live DOM.
 *
 * SELF-CONTAINED by design: the only import is the type-only `PageMetadata`
 * (erased at runtime), and every helper is an inner function referencing only
 * the `document` and `URL` globals. This lets it be serialized and injected via
 * the scripting API (`executeScript({ func: extract })`). Do NOT add runtime
 * imports or any browser-extension API reference. Never throws; missing fields
 * are `undefined`; `ogImages` defaults to `[]`.
 */
export function extract(): PageMetadata {
  const meta: PageMetadata = { pageUrl: document.URL, ogImages: [] };

  // No head (e.g. malformed/stripped doc): return the minimal shape, never throw.
  const head = document.head;
  if (!head) return meta;

  const baseURI = document.baseURI;

  /**
   * Invisible / zero-width characters that must not make a string "present"
   * on their own. Covers ZWSP–ZWJ, BOM, word joiner, and soft hyphen.
   * Used only for blank detection — never stripped from returned values
   * (U+200D ZWJ is part of legitimate emoji sequences).
   */
  const INVISIBLE = /[\u200B-\u200D\uFEFF\u2060\u00AD]/g;

  /** True when value has no visible content after removing invisibles + whitespace. */
  const isBlank = (value: string): boolean =>
    value.replace(INVISIBLE, '').trim() === '';

  /** Trim a tag value; treat empty/invisible-only as absent (undefined). */
  const clean = (value: string | null): string | undefined => {
    if (value == null) return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 && !isBlank(trimmed) ? trimmed : undefined;
  };

  /** Absolutize a (possibly relative) URL against the effective base. */
  const absolutize = (value: string): string => {
    try {
      return new URL(value, baseURI).href;
    } catch {
      return value;
    }
  };

  /**
   * First meta[property=...] content, trimmed. The `i` flag makes the attribute
   * value match case-insensitively (real Chrome is case-sensitive without it).
   */
  const metaProp = (property: string): string | undefined => {
    const el = head.querySelector(`meta[property="${property}" i]`);
    return clean(el?.getAttribute('content') ?? null);
  };

  /**
   * First meta[name=...] content, trimmed. Case-insensitive name match — see
   * metaProp.
   */
  const metaName = (name: string): string | undefined => {
    const el = head.querySelector(`meta[name="${name}" i]`);
    return clean(el?.getAttribute('content') ?? null);
  };

  // --- Open Graph scalar fields -----------------------------------------
  meta.ogTitle = metaProp('og:title');
  meta.ogDescription = metaProp('og:description');
  const ogUrl = metaProp('og:url');
  if (ogUrl !== undefined) meta.ogUrl = absolutize(ogUrl);
  meta.ogSiteName = metaProp('og:site_name');
  meta.ogType = metaProp('og:type');

  // --- Open Graph images (document order) -------------------------------
  // og:image / og:image:url / og:image:secure_url drive the "current" entry's
  // URL; secure_url and url set the URL of the current entry without creating a
  // new one. Adjacent og:image:width|height|alt attach to the current entry.
  // Two og:image tags with the same URL yield two entries.
  // Property comparisons are lowercased so the case-insensitive selector and
  // the branch logic agree on mixed-case markup (e.g. OG:Image).
  const images: PageMetadata['ogImages'] = [];
  let current: PageMetadata['ogImages'][number] | undefined;

  const ogTags = head.querySelectorAll('meta[property^="og:image" i]');
  for (const el of Array.from(ogTags)) {
    const property = (el.getAttribute('property') ?? '').toLowerCase();
    const content = clean(el.getAttribute('content'));
    if (property === '' || content === undefined) continue;

    if (property === 'og:image' || property === 'og:image:url') {
      if (property === 'og:image' || current === undefined) {
        // A bare og:image always opens a new entry. An og:image:url with no
        // preceding entry also opens one.
        current = { url: absolutize(content) };
        images.push(current);
      } else {
        // og:image:url sets the current entry's URL (no new entry).
        current.url = absolutize(content);
      }
    } else if (property === 'og:image:secure_url') {
      if (current === undefined) {
        current = { url: absolutize(content) };
        images.push(current);
      } else {
        current.url = absolutize(content);
      }
    } else if (current !== undefined) {
      if (property === 'og:image:width') {
        const n = Number(content);
        if (Number.isFinite(n)) current.width = n;
      } else if (property === 'og:image:height') {
        const n = Number(content);
        if (Number.isFinite(n)) current.height = n;
      } else if (property === 'og:image:alt') {
        current.alt = content;
      }
    }
  }
  meta.ogImages = images;

  // --- Twitter card fields ----------------------------------------------
  // Official docs use name=; many sites (e.g. Bandcamp) use property= instead.
  // Prefer name, fall back to property so either markup form is read.
  const metaNameOrProp = (key: string): string | undefined =>
    metaName(key) ?? metaProp(key);

  meta.twitterCard = metaNameOrProp('twitter:card');
  meta.twitterTitle = metaNameOrProp('twitter:title');
  meta.twitterDescription = metaNameOrProp('twitter:description');
  const twitterImage = metaNameOrProp('twitter:image');
  if (twitterImage !== undefined)
    meta.twitterImage = { url: absolutize(twitterImage) };

  // --- Standard / fallback sources --------------------------------------
  meta.htmlTitle = clean(document.title);
  meta.metaDescription = metaName('description');
  meta.themeColor = metaName('theme-color');

  const canonicalEl = head.querySelector('link[rel="canonical"]');
  const canonical = clean(canonicalEl?.getAttribute('href') ?? null);
  if (canonical !== undefined) meta.canonical = absolutize(canonical);

  // --- Favicon: best icon by sizes, else origin + "/favicon.ico" --------
  meta.favicon = resolveFavicon();

  return meta;

  // ---- inner helpers (closures over head/baseURI; globals only) --------

  /** Pick the largest declared icon, preferring apple-touch-icon on ties. */
  function resolveFavicon(): string {
    const links = Array.from(
      head.querySelectorAll('link[rel~="icon"], link[rel~="apple-touch-icon"]'),
    );

    let best: { href: string; area: number; apple: boolean } | undefined;
    for (const el of links) {
      const href = clean(el.getAttribute('href'));
      if (href === undefined) continue;
      const rel = (el.getAttribute('rel') ?? '').toLowerCase();
      const apple = rel.split(/\s+/).includes('apple-touch-icon');
      const area = largestSizeArea(el.getAttribute('sizes'));

      if (best === undefined) {
        best = { href, area, apple };
        continue;
      }
      // Larger declared size wins; on a tie an apple-touch-icon wins.
      if (area > best.area || (area === best.area && apple && !best.apple)) {
        best = { href, area, apple };
      }
    }

    if (best !== undefined) return absolutize(best.href);

    try {
      return new URL('/favicon.ico', baseURI).href;
    } catch {
      return '/favicon.ico';
    }
  }

  /**
   * Largest WxH area from a sizes attribute; 0 when absent/unparseable.
   * The token "any" (case-insensitive) is the standard declaration for
   * scalable SVG icons and ranks above every numeric size.
   */
  function largestSizeArea(sizes: string | null): number {
    if (sizes == null) return 0;
    let max = 0;
    for (const token of sizes.trim().split(/\s+/)) {
      if (/^any$/i.test(token)) {
        // Scalable icon — beat any finite WxH product.
        return Number.MAX_SAFE_INTEGER;
      }
      const match = /^(\d+)x(\d+)$/i.exec(token);
      if (match) {
        const area = Number(match[1]) * Number(match[2]);
        if (area > max) max = area;
      }
    }
    return max;
  }
}
