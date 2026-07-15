// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { resolve } from './resolve';
import { pageMetadata as meta } from '../test-fixtures';

describe('Discord resolve — happy path', () => {
  it('populates the embed from og:* with a large image', () => {
    const card = resolve(
      meta({
        ogSiteName: 'Example',
        ogTitle: 'Title',
        ogDescription: 'Desc',
        ogImages: [{ url: 'https://cdn/og.jpg', width: 1200 }],
        ogUrl: 'https://www.example.com/p',
      }),
    );
    expect(card.imageLayout).toBe('large');
    expect(card.siteName).toBe('Example');
    expect(card.title).toBe('Title');
    expect(card.description).toBe('Desc');
    // The message form shows the full pasted URL (resolveUrl prefers og:url here).
    expect(card.linkUrl).toBe('https://www.example.com/p');
    expect(card.displayUrl).toBe('www.example.com');
  });
});

describe('Discord resolve — field priority (og → twitter, no html)', () => {
  it('prefers og:title/og:description over twitter', () => {
    const card = resolve(
      meta({
        twitterTitle: 'TW Title',
        ogTitle: 'OG Title',
        twitterDescription: 'TW Desc',
        ogDescription: 'OG Desc',
        ogImages: [{ url: 'https://cdn/og.jpg', width: 1200 }],
      }),
    );
    expect(card.title).toBe('OG Title');
    expect(card.description).toBe('OG Desc');
  });

  it('falls back to twitter and ignores htmlTitle', () => {
    const card = resolve(
      meta({
        ogTitle: undefined,
        twitterTitle: 'TW Title',
        htmlTitle: 'HTML Title',
        ogImages: [{ url: 'https://cdn/og.jpg', width: 1200 }],
      }),
    );
    expect(card.title).toBe('TW Title');
  });

  it('does not use htmlTitle when og and twitter titles are absent', () => {
    const card = resolve(
      meta({
        ogTitle: undefined,
        twitterTitle: undefined,
        htmlTitle: 'HTML Title',
        ogImages: [{ url: 'https://cdn/og.jpg', width: 1200 }],
      }),
    );
    expect(card.title).toBe('');
  });
});

describe('Discord resolve — theme-color is NOT consumed (P2-D2)', () => {
  it('themeColor does not change any resolved card field and adds no color field', () => {
    const base = {
      ogSiteName: 'Example',
      ogTitle: 'Title',
      ogDescription: 'Desc',
    };
    const without = resolve(meta(base));
    const withTheme = resolve(meta({ ...base, themeColor: '#5865F2' }));

    expect(withTheme).toEqual(without);
    // PlatformCard carries no color field; assert none leaked in.
    expect('color' in withTheme).toBe(false);
    expect('themeColor' in withTheme).toBe(false);
    expect('barColor' in withTheme).toBe(false);
  });
});

describe('Discord resolve — pass-through (no JS truncation)', () => {
  it('returns the full title unchanged', () => {
    const longTitle = 'word '.repeat(40).trim(); // 199 chars
    const card = resolve(meta({ ogTitle: longTitle }));
    expect(card.title).toBe(longTitle);
  });

  it('returns the full description unchanged', () => {
    const longDesc = 'word '.repeat(120).trim(); // 600 chars
    const card = resolve(meta({ ogDescription: longDesc }));
    expect(card.description).toBe(longDesc);
  });
});

describe('Discord resolve — image size', () => {
  it('renders a narrow image (< 400px) as a thumbnail', () => {
    const card = resolve(
      meta({
        ogImages: [{ url: 'https://cdn/sq.jpg', width: 200, height: 200 }],
      }),
    );
    expect(card.imageLayout).toBe('thumbnail');
  });

  it('defaults to large when the image width is undefined (P2-D7)', () => {
    const card = resolve(meta({ ogImages: [{ url: 'https://cdn/og.jpg' }] }));
    expect(card.imageLayout).toBe('large');
  });
});

describe('Discord resolve — image edges', () => {
  it('collapses to plain-link when no image and no OG/Twitter text (amicro-like)', () => {
    const card = resolve(
      meta({
        ogImages: [],
        twitterImage: undefined,
        htmlTitle: 'Amicro — Micro-transitions',
      }),
    );
    expect(card.image?.url).toBeUndefined();
    expect(card.presentation).toBe('plain-link');
    expect(card.linkUrl).toBe('https://www.example.com/some/path');
  });

  it('keeps media-less rich unfurl when no image but OG text exists (queueapp-like)', () => {
    const card = resolve(
      meta({
        ogImages: [],
        twitterImage: undefined,
        ogTitle: 'Queue',
        ogDescription: 'Beautifully Simple Podcasts.',
      }),
    );
    expect(card.image?.url).toBeUndefined();
    expect(card.presentation).toBeUndefined();
    expect(card.title).toBe('Queue');
    expect(card.description).toBe('Beautifully Simple Podcasts.');
    expect(card.linkUrl).toBe('https://www.example.com/some/path');
  });

  it('falls back to twitter:image when og:image is absent', () => {
    const card = resolve(
      meta({
        ogImages: [],
        twitterImage: { url: 'https://cdn/tw.jpg', width: 1200 },
      }),
    );
    expect(card.image?.url).toBe('https://cdn/tw.jpg');
    expect(card.imageLayout).toBe('large');
  });

  it('prefers og:image over twitter:image', () => {
    const card = resolve(
      meta({
        ogImages: [{ url: 'https://cdn/og.jpg', width: 1200 }],
        twitterImage: { url: 'https://cdn/tw.jpg', width: 1200 },
      }),
    );
    expect(card.image?.url).toBe('https://cdn/og.jpg');
  });

  it('drops an unsafe og:image and uses the next safe image', () => {
    const card = resolve(
      meta({
        ogImages: [
          { url: 'javascript:alert(1)', width: 1200 },
          { url: 'https://og/safe.jpg', width: 1200 },
        ],
      }),
    );
    expect(card.image?.url).toBe('https://og/safe.jpg');
  });
});
