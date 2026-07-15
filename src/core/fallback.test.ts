// @vitest-environment node
import { describe, it, expect } from 'vitest';
import type { PageMetadata } from './types';
import {
  resolveTitle,
  resolveSocialTitle,
  resolveDescription,
  resolveSocialDescription,
  resolveImage,
  resolveUrl,
  hostnameOf,
  resolveSiteName,
  layoutForWidth,
} from './fallback';

/** Minimal PageMetadata fixture: only pageUrl and ogImages are required. */
function meta(overrides: Partial<PageMetadata> = {}): PageMetadata {
  return {
    ogImages: [],
    pageUrl: 'https://page.com',
    ...overrides,
  };
}

describe('resolveTitle', () => {
  it('falls back ogTitle → twitterTitle → htmlTitle', () => {
    const m = meta({ twitterTitle: 'Tweet T', htmlTitle: 'HTML T' });
    expect(resolveTitle(m)).toBe('Tweet T');
  });

  it('returns "" when all sources are absent', () => {
    expect(resolveTitle(meta())).toBe('');
  });

  it('treats a whitespace-only value as absent and continues the chain', () => {
    const m = meta({ ogTitle: '   ', twitterTitle: 'Tweet T' });
    expect(resolveTitle(m)).toBe('Tweet T');
  });
});

describe('resolveSocialTitle', () => {
  it('uses og → twitter and ignores htmlTitle', () => {
    expect(
      resolveSocialTitle(
        meta({ twitterTitle: 'TW', htmlTitle: 'HTML', ogTitle: undefined }),
      ),
    ).toBe('TW');
    expect(resolveSocialTitle(meta({ htmlTitle: 'HTML only' }))).toBe('');
  });
});

describe('resolveDescription', () => {
  it('falls back to metaDescription when og/twitter absent', () => {
    const m = meta({ metaDescription: 'Meta desc' });
    expect(resolveDescription(m)).toBe('Meta desc');
  });
});

describe('resolveSocialDescription', () => {
  it('uses og → twitter and ignores metaDescription', () => {
    expect(
      resolveSocialDescription(
        meta({
          metaDescription: 'Meta',
          twitterDescription: 'TW',
          ogDescription: undefined,
        }),
      ),
    ).toBe('TW');
    expect(resolveSocialDescription(meta({ metaDescription: 'Meta' }))).toBe(
      '',
    );
  });
});

describe('resolveImage', () => {
  it('uses twitterImage when ogImages is empty', () => {
    const m = meta({
      ogImages: [],
      twitterImage: { url: 'https://example.com/tw.jpg' },
    });
    expect(resolveImage(m)?.url).toBe('https://example.com/tw.jpg');
  });

  it('returns undefined when both sources are absent', () => {
    expect(resolveImage(meta())).toBeUndefined();
  });

  it('skips an unsafe og:image and falls back to a safe twitterImage', () => {
    const m = meta({
      ogImages: [{ url: 'javascript:alert(1)' }],
      twitterImage: { url: 'https://example.com/tw.jpg' },
    });
    expect(resolveImage(m)?.url).toBe('https://example.com/tw.jpg');
  });

  it('skips an unsafe first og:image and uses the second safe og:image', () => {
    const m = meta({
      ogImages: [
        { url: 'javascript:alert(1)' },
        { url: 'https://example.com/og2.jpg' },
      ],
      twitterImage: { url: 'https://example.com/tw.jpg' },
    });
    expect(resolveImage(m)?.url).toBe('https://example.com/og2.jpg');
  });

  it('returns undefined when the only candidate image is unsafe', () => {
    const m = meta({ ogImages: [{ url: 'javascript:alert(1)' }] });
    expect(resolveImage(m)).toBeUndefined();
  });
});

describe('firstNonBlank / resolveTitle — invisible-only strings', () => {
  it('treats zero-width-only og:title as absent and falls through to html title', () => {
    const m = meta({
      ogTitle: '\u200B\u200C\u200D\uFEFF\u2060\u00AD',
      htmlTitle: 'HTML T',
    });
    expect(resolveTitle(m)).toBe('HTML T');
  });

  it('treats mixed whitespace + zero-width as absent', () => {
    const m = meta({
      ogTitle: ' \u200B \uFEFF ',
      twitterTitle: 'Tweet T',
    });
    expect(resolveTitle(m)).toBe('Tweet T');
  });
});

describe('resolveUrl', () => {
  it('falls back to canonical when ogUrl absent', () => {
    const m = meta({
      canonical: 'https://canonical.com',
      pageUrl: 'https://page.com',
    });
    expect(resolveUrl(m)).toBe('https://canonical.com');
  });

  it('returns pageUrl as last resort', () => {
    const m = meta({ pageUrl: 'https://page.com' });
    expect(resolveUrl(m)).toBe('https://page.com');
  });
});

describe('resolveSiteName', () => {
  it('uses hostname of resolved url when ogSiteName absent', () => {
    const m = meta({ canonical: 'https://www.example.com/path' });
    expect(resolveSiteName(m)).toBe('www.example.com');
  });

  it('derives the host fallback from an explicit url argument when given', () => {
    const m = meta({
      ogUrl: 'https://og.example.org/x',
      canonical: 'https://www.example.com/x',
    });
    expect(resolveSiteName(m)).toBe('og.example.org'); // default: og:url-first
    expect(resolveSiteName(m, 'https://www.example.com/x')).toBe(
      'www.example.com',
    ); // override
  });

  it('still prefers og:site_name over any url argument', () => {
    const m = meta({
      ogSiteName: 'Example',
      canonical: 'https://www.example.com/x',
    });
    expect(resolveSiteName(m, 'https://other.example.net/y')).toBe('Example');
  });
});

describe('layoutForWidth', () => {
  it('defaults to large when width is undefined (P2-D7)', () => {
    expect(layoutForWidth(undefined, 400)).toBe('large');
  });

  it('is large at or above the threshold, thumbnail below (including width 0)', () => {
    expect(layoutForWidth(400, 400)).toBe('large');
    expect(layoutForWidth(399, 400)).toBe('thumbnail');
    expect(layoutForWidth(0, 400)).toBe('thumbnail');
  });
});

describe('hostnameOf', () => {
  it('returns the lowercased hostname of a URL', () => {
    expect(hostnameOf('https://WWW.Example.COM/path?q=1')).toBe(
      'www.example.com',
    );
  });

  it('returns "" for an unparseable URL', () => {
    expect(hostnameOf('not a url')).toBe('');
  });
});
