// @vitest-environment jsdom
// @vitest-environment-options { "url": "https://example.com/page" }
import { describe, it, expect, beforeEach } from 'vitest';
import { extract } from './extract';

/**
 * Append a <meta property="..." content="..."> tag to the head.
 * Open Graph / Twitter card properties use the `property` attribute.
 */
function addMetaProperty(property: string, content: string): void {
  const el = document.createElement('meta');
  el.setAttribute('property', property);
  el.setAttribute('content', content);
  document.head.appendChild(el);
}

/** Append a <meta name="..." content="..."> tag (standard metadata + twitter:*). */
function addMetaName(name: string, content: string): void {
  const el = document.createElement('meta');
  el.setAttribute('name', name);
  el.setAttribute('content', content);
  document.head.appendChild(el);
}

/** Append a <link rel="..." href="..."> tag, optionally with a sizes attribute. */
function addLink(rel: string, href: string, sizes?: string): void {
  const el = document.createElement('link');
  el.setAttribute('rel', rel);
  el.setAttribute('href', href);
  if (sizes !== undefined) el.setAttribute('sizes', sizes);
  document.head.appendChild(el);
}

/** Set a <base href="..."> to change the effective baseURI. */
function setBase(href: string): void {
  const el = document.createElement('base');
  el.setAttribute('href', href);
  document.head.appendChild(el);
}

beforeEach(() => {
  document.head.innerHTML = '';
});

describe('extract', () => {
  it('reads og:title, og:description, og:url, og:site_name, og:type', () => {
    addMetaProperty('og:title', 'Hello World');
    addMetaProperty('og:description', 'A test page');
    addMetaProperty('og:url', 'https://example.com/');
    addMetaProperty('og:site_name', 'Example');
    addMetaProperty('og:type', 'article');

    const meta = extract();

    expect(meta.ogTitle).toBe('Hello World');
    expect(meta.ogDescription).toBe('A test page');
    expect(meta.ogUrl).toBe('https://example.com/');
    expect(meta.ogSiteName).toBe('Example');
    expect(meta.ogType).toBe('article');
  });

  it('collects multiple og:image entries in document order', () => {
    addMetaProperty('og:image', 'https://example.com/img1.jpg');
    addMetaProperty('og:image:width', '1200');
    addMetaProperty('og:image:height', '630');
    addMetaProperty('og:image:alt', 'Hero image');
    addMetaProperty('og:image', '/img2.jpg');

    const meta = extract();

    expect(meta.ogImages).toHaveLength(2);
    expect(meta.ogImages[0]).toEqual({
      url: 'https://example.com/img1.jpg',
      width: 1200,
      height: 630,
      alt: 'Hero image',
    });
    expect(meta.ogImages[1].url).toBe('https://example.com/img2.jpg');
  });

  it("og:image:secure_url replaces the current entry's URL (no new entry)", () => {
    addMetaProperty('og:image', 'http://example.com/img.jpg');
    addMetaProperty('og:image:secure_url', 'https://example.com/img.jpg');

    const meta = extract();

    expect(meta.ogImages).toHaveLength(1);
    expect(meta.ogImages[0].url).toBe('https://example.com/img.jpg');
  });

  it('two og:image tags with the same URL produce two entries (document order)', () => {
    addMetaProperty('og:image', 'https://example.com/img.jpg');
    addMetaProperty('og:image', 'https://example.com/img.jpg');

    const meta = extract();

    expect(meta.ogImages).toHaveLength(2);
  });

  it("accepts og:image:url as an entry's URL", () => {
    addMetaProperty('og:image:url', 'https://example.com/img.jpg');

    const meta = extract();

    expect(meta.ogImages[0].url).toBe('https://example.com/img.jpg');
  });

  it('absolutizes a relative og:image against document.baseURI', () => {
    addMetaProperty('og:image', '/img.jpg');

    const meta = extract();

    expect(meta.ogImages[0].url).toBe('https://example.com/img.jpg');
  });

  it('honors an absolute <base href> when absolutizing', () => {
    setBase('https://cdn.example.com/');
    addMetaProperty('og:image', 'images/og.jpg');

    const meta = extract();

    expect(meta.ogImages[0].url).toBe('https://cdn.example.com/images/og.jpg');
  });

  it('honors a relative <base href> when absolutizing', () => {
    // Default doc URL is https://example.com/page; a relative <base href="../">
    // resolves against it. To exercise a deeper baseURI we set an absolute base
    // matching https://example.com/a/b/page then apply the relative one.
    setBase('https://example.com/a/b/page');
    setBase('../');
    addMetaProperty('og:image', 'img.jpg');

    const meta = extract();

    const expected = new URL('img.jpg', document.baseURI).href;
    expect(meta.ogImages[0].url).toBe(expected);
    expect(meta.ogImages[0].url).toMatch(/^https?:\/\//);
  });

  it('absolutizes og:url against document.baseURI', () => {
    setBase('https://example.com/path/');
    addMetaProperty('og:url', '../other.html');

    const meta = extract();

    expect(meta.ogUrl).toBe('https://example.com/other.html');
  });

  it('trims surrounding whitespace from content values', () => {
    addMetaProperty('og:title', '  Hello World  ');

    const meta = extract();

    expect(meta.ogTitle).toBe('Hello World');
  });

  it('reads twitter:card/title/description/image via name=', () => {
    addMetaName('twitter:card', 'summary_large_image');
    addMetaName('twitter:title', 'Tweet Title');
    addMetaName('twitter:description', 'Tweet description');
    addMetaName('twitter:image', 'https://example.com/twitter.jpg');

    const meta = extract();

    expect(meta.twitterCard).toBe('summary_large_image');
    expect(meta.twitterTitle).toBe('Tweet Title');
    expect(meta.twitterDescription).toBe('Tweet description');
    expect(meta.twitterImage?.url).toBe('https://example.com/twitter.jpg');
  });

  it('reads twitter:* via property= when name= is absent (Bandcamp-style)', () => {
    addMetaProperty('twitter:card', 'player');
    addMetaProperty('twitter:title', 'Album Title');
    addMetaProperty('twitter:description', 'Album desc');
    addMetaProperty('twitter:image', 'https://example.com/cover.jpg');
    addMetaProperty('og:image', 'https://example.com/cover.jpg');

    const meta = extract();

    expect(meta.twitterCard).toBe('player');
    expect(meta.twitterTitle).toBe('Album Title');
    expect(meta.twitterDescription).toBe('Album desc');
    expect(meta.twitterImage?.url).toBe('https://example.com/cover.jpg');
  });

  it('prefers name= over property= when both are present for twitter:*', () => {
    addMetaName('twitter:card', 'summary');
    addMetaProperty('twitter:card', 'player');
    addMetaName('twitter:title', 'From Name');
    addMetaProperty('twitter:title', 'From Property');

    const meta = extract();

    expect(meta.twitterCard).toBe('summary');
    expect(meta.twitterTitle).toBe('From Name');
  });

  it('reads htmlTitle, metaDescription, canonical, theme-color', () => {
    document.title = 'My Page Title';
    addMetaName('description', 'Standard description');
    addLink('canonical', 'https://example.com/canonical');
    addMetaName('theme-color', '#1DA1F2');

    const meta = extract();

    expect(meta.htmlTitle).toBe('My Page Title');
    expect(meta.metaDescription).toBe('Standard description');
    expect(meta.canonical).toBe('https://example.com/canonical');
    expect(meta.themeColor).toBe('#1DA1F2');
  });

  it('prefers apple-touch-icon over a generic icon for favicon', () => {
    addLink('icon', '/favicon.png');
    addLink('apple-touch-icon', '/apple-touch-icon.png');

    const meta = extract();

    expect(meta.favicon).toBe('https://example.com/apple-touch-icon.png');
  });

  it('prefers the larger icon via the sizes attribute', () => {
    addLink('icon', '/icon-16.png', '16x16');
    addLink('icon', '/icon-192.png', '192x192');

    const meta = extract();

    expect(meta.favicon).toBe('https://example.com/icon-192.png');
  });

  it('prefers sizes="any" (scalable SVG) over a numeric raster size', () => {
    addLink('icon', '/icon-16.png', '16x16');
    addLink('icon', '/icon.svg', 'any');

    const meta = extract();

    expect(meta.favicon).toBe('https://example.com/icon.svg');
  });

  it('treats zero-width-only og:title as absent (falls through to html title chain later)', () => {
    addMetaProperty('og:title', '\u200B\u200C\uFEFF');
    document.title = 'HTML Title';

    const meta = extract();

    expect(meta.ogTitle).toBeUndefined();
    expect(meta.htmlTitle).toBe('HTML Title');
  });

  it('falls back to /favicon.ico when no icon link exists', () => {
    const meta = extract();

    expect(meta.favicon).toBe('https://example.com/favicon.ico');
  });

  it('always includes pageUrl from document.URL', () => {
    const meta = extract();

    expect(meta.pageUrl).toBe(document.URL);
  });

  it('returns undefined for absent optional fields; ogImages is []', () => {
    const meta = extract();

    expect(meta.ogTitle).toBeUndefined();
    expect(meta.ogDescription).toBeUndefined();
    expect(meta.ogUrl).toBeUndefined();
    expect(meta.ogSiteName).toBeUndefined();
    expect(meta.twitterCard).toBeUndefined();
    expect(meta.ogImages).toEqual([]);
    expect(meta.favicon).toBe('https://example.com/favicon.ico');
  });

  it('never throws even if document.head is missing', () => {
    document.documentElement.removeChild(document.head);

    let meta: ReturnType<typeof extract> | undefined;
    expect(() => {
      meta = extract();
    }).not.toThrow();
    expect(meta?.pageUrl).toBeTruthy();
  });
});
