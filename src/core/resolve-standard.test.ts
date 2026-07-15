import { describe, it, expect } from 'vitest';
import type { PageMetadata } from './types';
import {
  resolveStandardCard,
  type StandardCardConfig,
} from './resolve-standard';

/** Minimal PageMetadata fixture: only pageUrl and ogImages are required. */
function meta(overrides: Partial<PageMetadata> = {}): PageMetadata {
  return {
    ogImages: [],
    pageUrl: 'https://www.example.com/some/path',
    ...overrides,
  };
}

/** Sensible baseline config; override one dimension per test. */
function baseConfig(
  overrides: Partial<StandardCardConfig> = {},
): StandardCardConfig {
  return {
    titleSource: 'og',
    descriptionSource: 'og',
    imageCandidates: 'og',
    layout: { mode: 'width', minWidth: 400 },
    linkUrl: true,
    siteName: 'resolve',
    favicon: false,
    ...overrides,
  };
}

describe('resolveStandardCard — titleSource', () => {
  it('titleSource og uses ogTitle only and ignores twitter/html', () => {
    const card = resolveStandardCard(
      meta({
        ogTitle: 'OG Title',
        twitterTitle: 'TW Title',
        htmlTitle: 'HTML Title',
      }),
      baseConfig({ titleSource: 'og' }),
    );
    expect(card.title).toBe('OG Title');
  });

  it('titleSource og yields empty title when ogTitle is absent', () => {
    const card = resolveStandardCard(
      meta({ twitterTitle: 'TW Title', htmlTitle: 'HTML Title' }),
      baseConfig({ titleSource: 'og' }),
    );
    expect(card.title).toBe('');
  });

  it('titleSource og+twitter uses twitter then ignores html', () => {
    const card = resolveStandardCard(
      meta({ twitterTitle: 'TW Title', htmlTitle: 'HTML Title' }),
      baseConfig({ titleSource: 'og+twitter' }),
    );
    expect(card.title).toBe('TW Title');
    expect(
      resolveStandardCard(
        meta({ htmlTitle: 'HTML Title' }),
        baseConfig({ titleSource: 'og+twitter' }),
      ).title,
    ).toBe('');
  });

  it('titleSource chain falls back og → twitter → html', () => {
    const card = resolveStandardCard(
      meta({ twitterTitle: 'TW Title', htmlTitle: 'HTML Title' }),
      baseConfig({ titleSource: 'chain' }),
    );
    expect(card.title).toBe('TW Title');
  });

  it('titleSource chain uses html when og and twitter are absent', () => {
    const card = resolveStandardCard(
      meta({ htmlTitle: 'HTML Title' }),
      baseConfig({ titleSource: 'chain' }),
    );
    expect(card.title).toBe('HTML Title');
  });

  it('returns the full title unchanged (no JS truncation)', () => {
    const longTitle = 'word '.repeat(40).trim();
    const card = resolveStandardCard(
      meta({ ogTitle: longTitle }),
      baseConfig(),
    );
    expect(card.title).toBe(longTitle);
  });
});

describe('resolveStandardCard — description', () => {
  it('description og uses ogDescription only', () => {
    const card = resolveStandardCard(
      meta({
        ogDescription: 'OG Desc',
        twitterDescription: 'TW Desc',
        metaDescription: 'Meta Desc',
      }),
      baseConfig({ descriptionSource: 'og' }),
    );
    expect(card.description).toBe('OG Desc');
  });

  it('description chain falls back og → twitter → meta', () => {
    const card = resolveStandardCard(
      meta({
        twitterDescription: 'TW Desc',
        metaDescription: 'Meta Desc',
      }),
      baseConfig({ descriptionSource: 'chain' }),
    );
    expect(card.description).toBe('TW Desc');
  });

  it('empty description leaves the field absent', () => {
    // Extract already trims meta values, so blank/whitespace never reaches resolvers.
    const card = resolveStandardCard(
      meta({ ogDescription: '' }),
      baseConfig({ descriptionSource: 'og' }),
    );
    expect(card.description).toBeUndefined();
  });

  it('description none never produces description even when ogDescription is set', () => {
    const card = resolveStandardCard(
      meta({ ogDescription: 'Should not appear' }),
      baseConfig({ descriptionSource: 'none' }),
    );
    expect(card.description).toBeUndefined();
  });

  it('descriptionSource og+twitter uses twitter and ignores metaDescription', () => {
    const card = resolveStandardCard(
      meta({
        twitterDescription: 'TW Desc',
        metaDescription: 'Meta Desc',
      }),
      baseConfig({ descriptionSource: 'og+twitter' }),
    );
    expect(card.description).toBe('TW Desc');
    expect(
      resolveStandardCard(
        meta({ metaDescription: 'Meta only' }),
        baseConfig({ descriptionSource: 'og+twitter' }),
      ).description,
    ).toBeUndefined();
  });

  it('returns the full description unchanged (no JS truncation)', () => {
    const longDesc = 'word '.repeat(80).trim();
    const card = resolveStandardCard(
      meta({ ogDescription: longDesc }),
      baseConfig({ descriptionSource: 'og' }),
    );
    expect(card.description).toBe(longDesc);
  });
});

describe('resolveStandardCard — imageCandidates', () => {
  it('og-only ignores twitterImage', () => {
    const card = resolveStandardCard(
      meta({
        ogImages: [],
        twitterImage: { url: 'https://cdn/tw.jpg', width: 800 },
      }),
      baseConfig({ imageCandidates: 'og' }),
    );
    expect(card.image?.url).toBeUndefined();
    expect(card.imageLayout).toBe('none');
  });

  it('og+twitter uses twitterImage when all ogImages are absent', () => {
    const card = resolveStandardCard(
      meta({
        ogImages: [],
        twitterImage: { url: 'https://cdn/tw.jpg', width: 800 },
      }),
      baseConfig({ imageCandidates: 'og+twitter' }),
    );
    expect(card.image?.url).toBe('https://cdn/tw.jpg');
  });

  it('og+twitter uses twitterImage when all ogImages are unsafe', () => {
    const card = resolveStandardCard(
      meta({
        ogImages: [{ url: 'javascript:alert(1)', width: 1200 }],
        twitterImage: { url: 'https://cdn/tw.jpg', width: 800 },
      }),
      baseConfig({ imageCandidates: 'og+twitter' }),
    );
    expect(card.image?.url).toBe('https://cdn/tw.jpg');
  });

  it('ogImages are preferred over twitterImage (document order first)', () => {
    const card = resolveStandardCard(
      meta({
        ogImages: [
          { url: 'https://cdn/og1.jpg', width: 100 },
          { url: 'https://cdn/og2.jpg', width: 200 },
        ],
        twitterImage: { url: 'https://cdn/tw.jpg', width: 800 },
      }),
      baseConfig({ imageCandidates: 'og+twitter' }),
    );
    expect(card.image?.url).toBe('https://cdn/og1.jpg');
  });

  it('skips unsafe image URLs via firstSafeImage', () => {
    const card = resolveStandardCard(
      meta({
        ogImages: [
          { url: 'javascript:alert(1)', width: 1200 },
          { url: 'https://cdn/safe.jpg', width: 1200 },
        ],
      }),
      baseConfig({ imageCandidates: 'og' }),
    );
    expect(card.image?.url).toBe('https://cdn/safe.jpg');
  });
});

describe('resolveStandardCard — image dimensions pass-through', () => {
  it('carries page-declared width and height onto card.image', () => {
    const card = resolveStandardCard(
      meta({
        ogImages: [{ url: 'https://cdn/og.jpg', width: 1200, height: 630 }],
      }),
      baseConfig({ imageCandidates: 'og' }),
    );
    expect(card.image).toEqual({
      url: 'https://cdn/og.jpg',
      width: 1200,
      height: 630,
    });
  });

  it('passes through a lone width with no both-or-neither filtering', () => {
    const card = resolveStandardCard(
      meta({
        ogImages: [{ url: 'https://cdn/og.jpg', width: 800 }],
      }),
      baseConfig({ imageCandidates: 'og' }),
    );
    expect(card.image).toEqual({
      url: 'https://cdn/og.jpg',
      width: 800,
      height: undefined,
    });
  });
});

describe('resolveStandardCard — layout width', () => {
  it('wide image (≥ minWidth) → large', () => {
    const card = resolveStandardCard(
      meta({ ogImages: [{ url: 'https://cdn/og.jpg', width: 800 }] }),
      baseConfig({ layout: { mode: 'width', minWidth: 400 } }),
    );
    expect(card.imageLayout).toBe('large');
    expect(card.image?.url).toBe('https://cdn/og.jpg');
  });

  it('narrow image (< minWidth) → thumbnail', () => {
    const card = resolveStandardCard(
      meta({ ogImages: [{ url: 'https://cdn/sq.jpg', width: 200 }] }),
      baseConfig({ layout: { mode: 'width', minWidth: 400 } }),
    );
    expect(card.imageLayout).toBe('thumbnail');
  });

  it('undefined width → large (P2-D7 via layoutForWidth)', () => {
    const card = resolveStandardCard(
      meta({ ogImages: [{ url: 'https://cdn/og.jpg' }] }),
      baseConfig({ layout: { mode: 'width', minWidth: 400 } }),
    );
    expect(card.imageLayout).toBe('large');
  });

  it('no usable image → none regardless of width config', () => {
    const card = resolveStandardCard(
      meta({ ogImages: [] }),
      baseConfig({ layout: { mode: 'width', minWidth: 400 } }),
    );
    expect(card.imageLayout).toBe('none');
    expect(card.image?.url).toBeUndefined();
  });
});

describe('resolveStandardCard — layout fixed', () => {
  it('fixed large applied regardless of image width', () => {
    const card = resolveStandardCard(
      meta({ ogImages: [{ url: 'https://cdn/sq.jpg', width: 50 }] }),
      baseConfig({ layout: { mode: 'fixed', value: 'large' } }),
    );
    expect(card.imageLayout).toBe('large');
  });

  it('fixed thumbnail applied regardless of image width', () => {
    const card = resolveStandardCard(
      meta({ ogImages: [{ url: 'https://cdn/wide.jpg', width: 2000 }] }),
      baseConfig({ layout: { mode: 'fixed', value: 'thumbnail' } }),
    );
    expect(card.imageLayout).toBe('thumbnail');
  });

  it('no usable image → none even with fixed layout', () => {
    const card = resolveStandardCard(
      meta({ ogImages: [] }),
      baseConfig({ layout: { mode: 'fixed', value: 'large' } }),
    );
    expect(card.imageLayout).toBe('none');
    expect(card.image?.url).toBeUndefined();
  });
});

describe('resolveStandardCard — linkUrl', () => {
  it('linkUrl true sets the resolved URL', () => {
    const card = resolveStandardCard(
      meta({ ogUrl: 'https://www.example.com/p' }),
      baseConfig({ linkUrl: true }),
    );
    expect(card.linkUrl).toBe('https://www.example.com/p');
    expect(card.displayUrl).toBe('www.example.com');
  });

  it('linkUrl false leaves the field absent', () => {
    const card = resolveStandardCard(
      meta({ ogUrl: 'https://www.example.com/p' }),
      baseConfig({ linkUrl: false }),
    );
    expect(card.linkUrl).toBeUndefined();
    // displayUrl is always set from the resolved URL hostname.
    expect(card.displayUrl).toBe('www.example.com');
  });
});

describe('resolveStandardCard — siteName', () => {
  it('siteName none leaves the field absent', () => {
    const card = resolveStandardCard(
      meta({ ogSiteName: 'Example' }),
      baseConfig({ siteName: 'none' }),
    );
    expect(card.siteName).toBeUndefined();
  });

  it('siteName resolve uses resolveSiteName (og:site_name)', () => {
    const card = resolveStandardCard(
      meta({ ogSiteName: 'Example Co' }),
      baseConfig({ siteName: 'resolve' }),
    );
    expect(card.siteName).toBe('Example Co');
  });

  it("siteName strip-www strips a leading 'www.' from the resolved name", () => {
    // No ogSiteName → hostname of pageUrl is www.example.com → strip to example.com.
    const card = resolveStandardCard(
      meta({}),
      baseConfig({ siteName: 'strip-www' }),
    );
    expect(card.siteName).toBe('example.com');
  });

  it("siteName strip-www passes through a name that does not start with 'www.'", () => {
    const card = resolveStandardCard(
      meta({ ogSiteName: 'Example Co' }),
      baseConfig({ siteName: 'strip-www' }),
    );
    expect(card.siteName).toBe('Example Co');
  });

  it("siteName strip-www strips 'www.' from ogSiteName when present", () => {
    const card = resolveStandardCard(
      meta({ ogSiteName: 'www.example.com' }),
      baseConfig({ siteName: 'strip-www' }),
    );
    expect(card.siteName).toBe('example.com');
  });
});

describe('resolveStandardCard — favicon', () => {
  it('favicon true sets faviconUrl from a safe meta.favicon', () => {
    const card = resolveStandardCard(
      meta({ favicon: 'https://cdn/favicon.ico' }),
      baseConfig({ favicon: true }),
    );
    expect(card.faviconUrl).toBe('https://cdn/favicon.ico');
  });

  it('favicon true drops a javascript: favicon', () => {
    const card = resolveStandardCard(
      meta({ favicon: 'javascript:alert(1)' }),
      baseConfig({ favicon: true }),
    );
    expect(card.faviconUrl).toBeUndefined();
    // Property is still assigned (config.favicon true) but gated to undefined.
    expect('faviconUrl' in card).toBe(true);
  });

  it('favicon true passes through undefined favicon', () => {
    const card = resolveStandardCard(meta({}), baseConfig({ favicon: true }));
    expect(card.faviconUrl).toBeUndefined();
    // Property is set even when the value is undefined.
    expect('faviconUrl' in card).toBe(true);
  });

  it('favicon false leaves the field absent', () => {
    const card = resolveStandardCard(
      meta({ favicon: 'https://cdn/favicon.ico' }),
      baseConfig({ favicon: false }),
    );
    expect(card.faviconUrl).toBeUndefined();
    expect('faviconUrl' in card).toBe(false);
  });
});

describe('resolveStandardCard — always-set fields', () => {
  it('always sets title, imageLayout none by default, and displayUrl', () => {
    const card = resolveStandardCard(meta({}), baseConfig());
    expect(card.title).toBe('');
    expect(card.imageLayout).toBe('none');
    expect(card.displayUrl).toBe('www.example.com');
  });
});

describe('resolveStandardCard — noImage policy', () => {
  it('does not set plain-link when an image is present', () => {
    const card = resolveStandardCard(
      meta({ ogImages: [{ url: 'https://cdn/og.jpg', width: 800 }] }),
      baseConfig({ noImage: 'unfurl-or-link' }),
    );
    expect(card.image?.url).toBe('https://cdn/og.jpg');
    expect(card.presentation).toBeUndefined();
  });

  it('unfurl-or-link keeps rich when no image but OG/Twitter text exists', () => {
    const card = resolveStandardCard(
      meta({
        ogImages: [],
        ogTitle: 'Queue',
        ogDescription: 'Podcasts',
      }),
      baseConfig({
        titleSource: 'og+twitter',
        descriptionSource: 'og+twitter',
        noImage: 'unfurl-or-link',
      }),
    );
    expect(card.presentation).toBeUndefined();
    expect(card.imageLayout).toBe('none');
    expect(card.title).toBe('Queue');
    expect(card.description).toBe('Podcasts');
  });

  it('unfurl-or-link collapses to minimal plain-link when no image and only htmlTitle', () => {
    const card = resolveStandardCard(
      meta({
        ogImages: [],
        htmlTitle: 'Amicro — Micro-transitions',
        pageUrl: 'https://www.example.com/post',
        ogSiteName: 'Example Co',
        favicon: 'https://cdn/favicon.ico',
      }),
      baseConfig({
        titleSource: 'og+twitter',
        descriptionSource: 'og+twitter',
        siteName: 'resolve',
        favicon: true,
        noImage: 'unfurl-or-link',
      }),
    );
    // Title source does not include html → empty body → early-return plain-link.
    expect(card).toEqual({
      title: '',
      imageLayout: 'none',
      displayUrl: 'www.example.com',
      linkUrl: 'https://www.example.com/post',
      presentation: 'plain-link',
    });
    // No chrome fields on the minimal shape.
    expect(card.siteName).toBeUndefined();
    expect(card.faviconUrl).toBeUndefined();
    expect(card.description).toBeUndefined();
  });

  it('unfurl-or-link stays rich when titleSource chain fills body from htmlTitle alone', () => {
    // Gate follows resolved config body, not a parallel social-text oracle.
    const card = resolveStandardCard(
      meta({
        ogImages: [],
        htmlTitle: 'HTML only title',
      }),
      baseConfig({
        titleSource: 'chain',
        descriptionSource: 'og+twitter',
        noImage: 'unfurl-or-link',
      }),
    );
    expect(card.presentation).toBeUndefined();
    expect(card.imageLayout).toBe('none');
    expect(card.title).toBe('HTML only title');
  });
});
