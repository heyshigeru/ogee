// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { resolve } from './resolve';
import { pageMetadata as meta } from '../test-fixtures';

describe('Facebook resolve — happy path', () => {
  it('renders a large card from a wide og:image with title and image; never produces a description', () => {
    const card = resolve(
      meta({
        ogTitle: 'Launch day',
        // ogDescription is intentionally supplied to prove the resolver IGNORES it
        // (real FB feed cards render only domain + title; calibrated 2026-05-28).
        ogDescription: 'We shipped it.',
        ogImages: [{ url: 'https://cdn/og.jpg', width: 1200, height: 630 }],
        ogUrl: 'https://www.example.com/post',
      }),
    );
    expect(card.imageLayout).toBe('large');
    expect(card.title).toBe('Launch day');
    expect(card.description).toBeUndefined();
    expect(card.image?.url).toBe('https://cdn/og.jpg');
  });
});

describe('Facebook resolve — field priority', () => {
  it('uses og:title/og:image; prefers og title over twitter', () => {
    const card = resolve(
      meta({
        twitterTitle: 'TW Title',
        ogTitle: 'OG Title',
        twitterImage: { url: 'https://tw/img.jpg' },
        ogImages: [{ url: 'https://og/img.jpg', width: 1200 }],
      }),
    );
    expect(card.title).toBe('OG Title');
    expect(card.image?.url).toBe('https://og/img.jpg');
  });

  it('title falls back og → twitter → html; image stays og-only', () => {
    const card = resolve(
      meta({
        ogTitle: undefined,
        twitterTitle: undefined,
        htmlTitle: 'Amicro — Micro-transitions',
        twitterImage: { url: 'https://tw/img.jpg' },
        ogImages: [],
      }),
    );
    expect(card.title).toBe('Amicro — Micro-transitions');
    expect(card.image?.url).toBeUndefined();
    expect(card.presentation).toBeUndefined();
  });
});

describe('Facebook resolve — width-driven layout', () => {
  it('degrades a narrow (< 600px) primary image to thumbnail', () => {
    const card = resolve(
      meta({
        ogImages: [{ url: 'https://cdn/sq.jpg', width: 400, height: 400 }],
      }),
    );
    expect(card.imageLayout).toBe('thumbnail');
    expect(card.image?.url).toBe('https://cdn/sq.jpg');
  });

  it('defaults to large when width is undefined (P2-D7)', () => {
    const card = resolve(meta({ ogImages: [{ url: 'https://cdn/og.jpg' }] }));
    expect(card.imageLayout).toBe('large');
  });
});

describe('Facebook resolve — pass-through (no JS truncation)', () => {
  it('returns the full title unchanged', () => {
    const longTitle = 'word '.repeat(40).trim(); // 200 chars
    const card = resolve(
      meta({
        ogTitle: longTitle,
        ogImages: [{ url: 'https://cdn/og.jpg', width: 1200 }],
      }),
    );
    expect(card.title).toBe(longTitle);
  });
});

describe('Facebook resolve — image edges', () => {
  it('produces no usable image and a none layout when og:image is absent', () => {
    const card = resolve(
      meta({
        ogImages: [],
        ogTitle: 'Title only',
        twitterImage: { url: 'https://cdn/tw.jpg' },
      }),
    );
    // og-only: twitter:image is ignored.
    expect(card.image?.url).toBeUndefined();
    expect(card.imageLayout).toBe('none');
    expect(card.presentation).toBeUndefined();
    expect(card.linkUrl).toBeUndefined();
  });

  it('drops an unsafe og:image and uses the next safe (wide) image as large', () => {
    const card = resolve(
      meta({
        ogImages: [
          { url: 'javascript:alert(1)', width: 1200 },
          { url: 'https://og/safe.jpg', width: 1200 },
        ],
      }),
    );
    expect(card.image?.url).toBe('https://og/safe.jpg');
    expect(card.imageLayout).toBe('large');
  });
});

describe('Facebook resolve — display URL', () => {
  it('emits the lowercase hostname of the resolved URL', () => {
    const card = resolve(meta({ ogUrl: 'https://www.example.com/some/path' }));
    expect(card.displayUrl).toBe('www.example.com');
  });
});
