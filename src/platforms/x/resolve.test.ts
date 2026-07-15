// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { resolve } from './resolve';
import { pageMetadata as meta } from '../test-fixtures';

const usableImage = { url: 'https://og.com/img.jpg' };

describe('X resolve — image layout', () => {
  it('uses large layout when twitterCard is summary_large_image with a usable image', () => {
    const card = resolve(
      meta({ twitterCard: 'summary_large_image', ogImages: [usableImage] }),
    );
    expect(card.imageLayout).toBe('large');
  });

  it('defaults to large when twitterCard absent but a usable image exists', () => {
    const card = resolve(meta({ ogImages: [usableImage] }));
    expect(card.imageLayout).toBe('large');
  });

  it('uses thumbnail when twitterCard is explicitly "summary"', () => {
    const card = resolve(
      meta({ twitterCard: 'summary', ogImages: [usableImage] }),
    );
    expect(card.imageLayout).toBe('thumbnail');
  });

  it('treats twitterCard "app" like summary (thumbnail)', () => {
    const card = resolve(meta({ twitterCard: 'app', ogImages: [usableImage] }));
    expect(card.imageLayout).toBe('thumbnail');
  });

  it('treats twitterCard "player" like summary (thumbnail)', () => {
    const card = resolve(
      meta({ twitterCard: 'player', ogImages: [usableImage] }),
    );
    expect(card.imageLayout).toBe('thumbnail');
  });

  it('collapses to plain-link when no usable image (even if a card type was declared)', () => {
    const card = resolve(
      meta({
        twitterCard: 'summary_large_image',
        ogImages: [],
        twitterImage: undefined,
        twitterTitle: 'TW Title',
        ogTitle: 'OG Title',
        htmlTitle: 'HTML Title',
        pageUrl: 'https://www.example.com/post',
      }),
    );
    expect(card.image?.url).toBeUndefined();
    expect(card.imageLayout).toBe('none');
    expect(card.presentation).toBe('plain-link');
    expect(card.linkUrl).toBe('https://www.example.com/post');
    expect(card.title).toBe('');
    expect(card.displayUrl).toBe('www.example.com');
  });

  it('collapses to plain-link when no usable image and no card type', () => {
    const card = resolve(
      meta({
        ogImages: [],
        twitterImage: undefined,
        htmlTitle: 'Bare page title',
        pageUrl: 'https://www.example.com/bare',
      }),
    );
    expect(card.image?.url).toBeUndefined();
    expect(card.imageLayout).toBe('none');
    expect(card.presentation).toBe('plain-link');
    expect(card.linkUrl).toBe('https://www.example.com/bare');
    expect(card.title).toBe('');
  });
});

describe('X resolve — title', () => {
  it('prioritizes twitter:title over og:title', () => {
    const card = resolve(
      meta({
        twitterTitle: 'TW Title',
        ogTitle: 'OG Title',
        ogImages: [usableImage],
      }),
    );
    expect(card.title).toBe('TW Title');
  });

  it('falls back to og:title when twitter:title absent', () => {
    const card = resolve(
      meta({ ogTitle: 'OG Title', ogImages: [usableImage] }),
    );
    expect(card.title).toBe('OG Title');
  });

  it('is "" when all title sources absent', () => {
    const card = resolve(meta({ ogImages: [usableImage] }));
    expect(card.title).toBe('');
  });

  it('returns the full title unchanged on the large card (no JS truncation)', () => {
    const longTitle = 'word '.repeat(40).trim(); // 200 chars of "word word word ..."
    const card = resolve(
      meta({ twitterTitle: longTitle, ogImages: [usableImage] }),
    );
    expect(card.title).toBe(longTitle);
  });
});

describe('X resolve — description', () => {
  it('is undefined on the large card', () => {
    const card = resolve(
      meta({
        ogImages: [usableImage],
        ogDescription: 'A description present on a large card',
      }),
    );
    expect(card.imageLayout).toBe('large');
    expect(card.description).toBeUndefined();
  });

  it('includes the full description on a summary (thumbnail) card (no JS truncation)', () => {
    const longDesc = 'word '.repeat(50).trim(); // 250 chars
    const card = resolve(
      meta({
        twitterCard: 'summary',
        ogImages: [usableImage],
        ogDescription: longDesc,
      }),
    );
    expect(card.imageLayout).toBe('thumbnail');
    expect(card.description).toBe(longDesc);
  });
});

describe('X resolve — url and image priority', () => {
  it('sets displayUrl to the hostname of the resolved URL', () => {
    const card = resolve(meta({ ogUrl: 'https://www.example.com/some/path' }));
    expect(card.displayUrl).toBe('www.example.com');
  });

  it('prioritizes twitter:image over og:image', () => {
    const card = resolve(
      meta({
        twitterImage: { url: 'https://tw.com/img.jpg' },
        ogImages: [{ url: 'https://og.com/img.jpg' }],
      }),
    );
    expect(card.image?.url).toBe('https://tw.com/img.jpg');
  });

  it('falls back to a safe og:image when twitter:image is unsafe', () => {
    const card = resolve(
      meta({
        twitterImage: { url: 'javascript:alert(1)' },
        ogImages: [{ url: 'https://og.com/img.jpg' }],
        twitterCard: 'summary_large_image',
      }),
    );
    expect(card.image?.url).toBe('https://og.com/img.jpg');
    expect(card.imageLayout).toBe('large');
  });

  it('skips an unsafe first og:image and uses the second when twitter:image is absent', () => {
    const card = resolve(
      meta({
        ogImages: [
          { url: 'javascript:alert(1)' },
          { url: 'https://og.com/img2.jpg' },
        ],
        twitterCard: 'summary_large_image',
      }),
    );
    expect(card.image?.url).toBe('https://og.com/img2.jpg');
    expect(card.imageLayout).toBe('large');
  });
});
