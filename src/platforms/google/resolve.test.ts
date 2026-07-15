// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { resolve } from './resolve';
import { pageMetadata as meta } from '../test-fixtures';

describe('Google resolve — happy path', () => {
  it('takes the title from htmlTitle, description from metaDescription, no image', () => {
    const card = resolve(
      meta({
        htmlTitle: 'Page Title - Site',
        metaDescription: 'A standard meta description.',
        favicon: 'https://www.example.com/favicon.ico',
        pageUrl: 'https://www.example.com/a/b',
      }),
    );
    expect(card.title).toBe('Page Title - Site');
    expect(card.description).toBe('A standard meta description.');
    expect(card.imageLayout).toBe('none');
  });
});

describe('Google resolve — field priority (search snippet, not og)', () => {
  it('uses htmlTitle even when og:title is present', () => {
    const card = resolve(
      meta({ ogTitle: 'OG Title', htmlTitle: 'HTML Title' }),
    );
    expect(card.title).toBe('HTML Title');
  });

  it('uses metaDescription even when og:description is present', () => {
    const card = resolve(
      meta({ ogDescription: 'OG Desc', metaDescription: 'Meta Desc' }),
    );
    expect(card.description).toBe('Meta Desc');
  });
});

describe('Google resolve — pass-through (no JS truncation)', () => {
  it('returns the full title unchanged', () => {
    const longTitle = 'word '.repeat(24).trim(); // 120 chars
    const card = resolve(meta({ htmlTitle: longTitle }));
    expect(card.title).toBe(longTitle);
  });

  it('returns the full description unchanged', () => {
    const longDesc = 'word '.repeat(60).trim(); // 300 chars
    const card = resolve(meta({ metaDescription: longDesc }));
    expect(card.description).toBe(longDesc);
  });
});

describe('Google resolve — never emits an image', () => {
  it('stays imageLayout "none" with no image even when og:image exists', () => {
    const card = resolve(
      meta({ ogImages: [{ url: 'https://cdn/og.jpg', width: 1200 }] }),
    );
    expect(card.imageLayout).toBe('none');
    expect(card.image).toBeUndefined();
  });
});

// RECONCILED per architecture §3.5: the design's bdd Google scenario asserted only the
// hostname; the richer breadcrumb (hostname + path segments joined " › ") supersedes it.
describe('Google resolve — URL breadcrumb', () => {
  it('joins hostname and path segments with " › "', () => {
    const card = resolve(meta({ pageUrl: 'https://www.example.com/a/b/c' }));
    expect(card.displayUrl).toBe('https://www.example.com › a › b › c');
  });

  it('is the bare hostname when there is no path', () => {
    const card = resolve(meta({ pageUrl: 'https://www.example.com/' }));
    expect(card.displayUrl).toBe('https://www.example.com');
  });

  it('preserves the crawl URL scheme for non-HTTPS pages', () => {
    const card = resolve(meta({ pageUrl: 'http://www.example.com/a' }));
    expect(card.displayUrl).toBe('http://www.example.com › a');
  });

  it('does not invent a scheme for hostless URLs', () => {
    const card = resolve(meta({ pageUrl: 'file:///Users/example/page.html' }));
    expect(card.displayUrl).toBe('');
  });
});

describe('Google resolve — breadcrumb uses the crawl URL, not og:url', () => {
  it('prefers canonical over pageUrl and ignores og:url', () => {
    const card = resolve(
      meta({
        ogUrl: 'https://og.example.org/elsewhere',
        canonical: 'https://www.example.com/a/b/c',
        pageUrl: 'https://www.example.com/raw',
      }),
    );
    expect(card.displayUrl).toBe('https://www.example.com › a › b › c');
  });

  it('falls back to pageUrl when canonical is absent (og:url still ignored)', () => {
    const card = resolve(
      meta({
        ogUrl: 'https://og.example.org/elsewhere',
        pageUrl: 'https://www.example.com/p/q',
      }),
    );
    expect(card.displayUrl).toBe('https://www.example.com › p › q');
  });
});

describe('Google resolve — site name agrees with the breadcrumb host', () => {
  it('derives the site-name host from the crawl URL, not og:url, when og:site_name is absent', () => {
    const card = resolve(
      meta({
        ogUrl: 'https://m.example.com/p',
        canonical: 'https://www.example.com/p',
      }),
    );
    // Both the site-name line and the breadcrumb resolve to the same (canonical) host.
    expect(card.siteName).toBe('www.example.com');
    expect(card.displayUrl).toBe('https://www.example.com › p');
  });

  it('still prefers an explicit og:site_name over the host', () => {
    const card = resolve(
      meta({
        ogSiteName: 'Example Blog',
        canonical: 'https://www.example.com/p',
      }),
    );
    expect(card.siteName).toBe('Example Blog');
  });
});

describe('Google resolve — breadcrumb decodes percent-encoded segments', () => {
  it('shows decoded path segments (e.g. %20 → space)', () => {
    const card = resolve(
      meta({ pageUrl: 'https://www.example.com/my%20post/caf%C3%A9' }),
    );
    expect(card.displayUrl).toBe('https://www.example.com › my post › café');
  });
});

describe('Google resolve — favicon safety', () => {
  it('drops a javascript: favicon and keeps a safe https favicon', () => {
    const unsafe = resolve(meta({ favicon: 'javascript:alert(1)' }));
    expect(unsafe.faviconUrl).toBeUndefined();

    const safeUrl = 'https://www.example.com/favicon.ico';
    const safe = resolve(meta({ favicon: safeUrl }));
    expect(safe.faviconUrl).toBe(safeUrl);
  });
});
