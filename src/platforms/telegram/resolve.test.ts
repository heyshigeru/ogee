// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { resolve } from './resolve';
import { pageMetadata as meta } from '../test-fixtures';

describe('Telegram resolve — happy path', () => {
  it('sets accent site name, title, description, image, and the full linkUrl from og:*', () => {
    const card = resolve(
      meta({
        ogSiteName: 'Example',
        ogTitle: 'Title',
        ogDescription: 'Desc',
        ogImages: [{ url: 'https://cdn/og.jpg', width: 1200 }],
        ogUrl: 'https://www.example.com/p',
      }),
    );
    expect(card.siteName).toBe('Example');
    expect(card.title).toBe('Title');
    expect(card.description).toBe('Desc');
    expect(card.image?.url).toBe('https://cdn/og.jpg');
    // The message form shows the full pasted URL (resolveUrl prefers og:url here).
    expect(card.linkUrl).toBe('https://www.example.com/p');
    expect(card.displayUrl).toBe('www.example.com');
  });
});

describe('Telegram resolve — site name', () => {
  it('falls back to the hostname when og:site_name is absent', () => {
    const card = resolve(
      meta({
        ogSiteName: undefined,
        ogUrl: 'https://www.example.com/x',
        ogImages: [{ url: 'https://cdn/og.jpg', width: 1200 }],
      }),
    );
    expect(card.siteName).toBe('www.example.com');
  });
});

describe('Telegram resolve — field priority (og → twitter, no html)', () => {
  it('falls back to twitter:title and ignores htmlTitle', () => {
    const withTw = resolve(
      meta({
        twitterTitle: 'TW Title',
        ogTitle: undefined,
        ogImages: [{ url: 'https://cdn/og.jpg', width: 1200 }],
      }),
    );
    expect(withTw.title).toBe('TW Title');

    const withHtml = resolve(
      meta({
        ogTitle: undefined,
        twitterTitle: undefined,
        htmlTitle: 'HTML Title',
        ogImages: [{ url: 'https://cdn/og.jpg', width: 1200 }],
      }),
    );
    expect(withHtml.title).toBe('');
  });
});

describe('Telegram resolve — pass-through (no JS truncation)', () => {
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

describe('Telegram resolve — image size', () => {
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

describe('Telegram resolve — image edges', () => {
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

  it('keeps media-less rich preview when no image but OG text exists', () => {
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
