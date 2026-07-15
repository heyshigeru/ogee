// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { resolve } from './resolve';
import { pageMetadata as meta } from '../test-fixtures';

describe('WhatsApp resolve — happy path', () => {
  it('renders a large image-on-top preview with title, description, domain, and full linkUrl', () => {
    const card = resolve(
      meta({
        ogTitle: 'Title',
        ogDescription: 'Short desc',
        ogImages: [{ url: 'https://cdn/sq.jpg' }],
        ogUrl: 'https://www.example.com/p',
      }),
    );
    expect(card.imageLayout).toBe('large');
    expect(card.title).toBe('Title');
    expect(card.description).toBe('Short desc');
    expect(card.displayUrl).toBe('www.example.com');
    // The message form shows the full pasted URL (resolveUrl prefers og:url here).
    expect(card.linkUrl).toBe('https://www.example.com/p');
  });
});

describe('WhatsApp resolve — field priority (chain)', () => {
  it('prefers og:title over twitter:title', () => {
    const card = resolve(
      meta({ twitterTitle: 'TW Title', ogTitle: 'OG Title' }),
    );
    expect(card.title).toBe('OG Title');
  });

  it('falls back to htmlTitle when og and twitter titles are absent', () => {
    const card = resolve(
      meta({
        ogTitle: undefined,
        twitterTitle: undefined,
        htmlTitle: 'Amicro — Micro-transitions',
      }),
    );
    expect(card.title).toBe('Amicro — Micro-transitions');
  });

  it('falls back to metaDescription for description when og/twitter desc absent', () => {
    const card = resolve(
      meta({
        ogDescription: undefined,
        twitterDescription: undefined,
        metaDescription: 'A short meta description',
      }),
    );
    expect(card.description).toBe('A short meta description');
  });
});

describe('WhatsApp resolve — image-on-top, no thumbnail variant', () => {
  it('uses large for any usable image (wide or square)', () => {
    const wide = resolve(
      meta({
        ogImages: [{ url: 'https://cdn/wide.jpg', width: 1200, height: 630 }],
      }),
    );
    expect(wide.imageLayout).toBe('large');
    const square = resolve(
      meta({
        ogImages: [{ url: 'https://cdn/sq.jpg', width: 400, height: 400 }],
      }),
    );
    expect(square.imageLayout).toBe('large');
  });
});

describe('WhatsApp resolve — pass-through (no JS truncation)', () => {
  it('returns the full title unchanged', () => {
    const longTitle = 'word '.repeat(40).trim(); // 200 chars
    const card = resolve(meta({ ogTitle: longTitle }));
    expect(card.title).toBe(longTitle);
  });

  it('returns the full description unchanged', () => {
    const longDesc = 'word '.repeat(60).trim(); // 300 chars
    const card = resolve(
      meta({
        ogDescription: longDesc,
        ogImages: [{ url: 'https://cdn/sq.jpg' }],
      }),
    );
    expect(card.description).toBe(longDesc);
  });
});

describe('WhatsApp resolve — image edges', () => {
  it('produces no usable image and a none layout when og and twitter images are absent', () => {
    const card = resolve(meta({ ogImages: [], twitterImage: undefined }));
    expect(card.image?.url).toBeUndefined();
    expect(card.imageLayout).toBe('none');
    // The message still carries its URL even with no image (text-only preview).
    expect(card.linkUrl).toBe('https://www.example.com/some/path');
  });

  it('falls back to twitter:image when og:image is absent', () => {
    const card = resolve(
      meta({
        ogImages: [],
        twitterImage: { url: 'https://cdn/tw.jpg' },
      }),
    );
    expect(card.image?.url).toBe('https://cdn/tw.jpg');
    expect(card.imageLayout).toBe('large');
  });

  it('prefers og:image over twitter:image', () => {
    const card = resolve(
      meta({
        ogImages: [{ url: 'https://cdn/og.jpg' }],
        twitterImage: { url: 'https://cdn/tw.jpg' },
      }),
    );
    expect(card.image?.url).toBe('https://cdn/og.jpg');
  });

  it('drops an unsafe og:image and uses the next safe image', () => {
    const card = resolve(
      meta({
        ogImages: [
          { url: 'javascript:alert(1)' },
          { url: 'https://og/safe.jpg' },
        ],
      }),
    );
    expect(card.image?.url).toBe('https://og/safe.jpg');
  });
});
