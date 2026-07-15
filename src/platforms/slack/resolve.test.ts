// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { resolve } from './resolve';
import { pageMetadata as meta } from '../test-fixtures';

describe('Slack resolve — happy path', () => {
  it('populates the unfurl from og:* with a large image and passed-through favicon', () => {
    const card = resolve(
      meta({
        ogSiteName: 'Example',
        ogTitle: 'Title',
        ogDescription: 'Desc',
        ogImages: [{ url: 'https://cdn/og.jpg', width: 1200 }],
        favicon: 'https://www.example.com/favicon.ico',
        ogUrl: 'https://www.example.com/p',
      }),
    );
    expect(card.imageLayout).toBe('large');
    expect(card.siteName).toBe('Example');
    expect(card.title).toBe('Title');
    expect(card.description).toBe('Desc');
    expect(card.faviconUrl).toBe('https://www.example.com/favicon.ico');
    // The message form shows the full pasted URL (resolveUrl prefers og:url here).
    expect(card.linkUrl).toBe('https://www.example.com/p');
    expect(card.displayUrl).toBe('www.example.com');
  });
});

describe('Slack resolve — field priority (og preferred, twitter fallback)', () => {
  it('falls back to twitter:title/description when og:* is absent', () => {
    const card = resolve(
      meta({
        ogTitle: undefined,
        twitterTitle: 'TW Title',
        ogDescription: undefined,
        twitterDescription: 'TW Desc',
      }),
    );
    expect(card.title).toBe('TW Title');
    expect(card.description).toBe('TW Desc');
  });
});

describe('Slack resolve — site name', () => {
  it('falls back to the hostname when og:site_name is absent', () => {
    const card = resolve(
      meta({
        ogSiteName: undefined,
        ogUrl: 'https://www.example.com/x',
        ogImages: [{ url: 'https://cdn/og.jpg', width: 1200 }],
      }),
    );
    expect(card.siteName).toBe('example.com');
  });
});

describe('Slack resolve — image size', () => {
  it('renders a narrow image (< 360px) as a right-side thumbnail', () => {
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

describe('Slack resolve — pass-through (no JS truncation)', () => {
  it('returns the full title unchanged', () => {
    const longTitle = 'word '.repeat(40).trim(); // 199 chars
    const card = resolve(meta({ ogTitle: longTitle }));
    expect(card.title).toBe(longTitle);
  });

  it('returns the full description unchanged', () => {
    const longDesc = 'word '.repeat(80).trim(); // 400 chars
    const card = resolve(meta({ ogDescription: longDesc }));
    expect(card.description).toBe(longDesc);
  });
});

describe('Slack resolve — image edges', () => {
  it('collapses to plain-link when no image and no OG/Twitter text', () => {
    const card = resolve(
      meta({
        ogImages: [],
        twitterImage: undefined,
        htmlTitle: 'Only HTML',
      }),
    );
    expect(card.presentation).toBe('plain-link');
    expect(card.linkUrl).toBe('https://www.example.com/some/path');
  });

  it('keeps media-less rich unfurl when no image but OG text exists', () => {
    const card = resolve(
      meta({
        ogImages: [],
        ogTitle: 'Queue',
        ogDescription: 'Desc',
      }),
    );
    expect(card.presentation).toBeUndefined();
    expect(card.title).toBe('Queue');
    expect(card.description).toBe('Desc');
  });

  it('does not use htmlTitle for unfurl title', () => {
    const card = resolve(
      meta({
        ogImages: [{ url: 'https://cdn/og.jpg', width: 1200 }],
        htmlTitle: 'HTML',
        ogTitle: undefined,
        twitterTitle: undefined,
      }),
    );
    expect(card.title).toBe('');
  });

  it('drops an unsafe primary image and uses the next safe image', () => {
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
