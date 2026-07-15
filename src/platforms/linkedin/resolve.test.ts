// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { resolve } from './resolve';
import { pageMetadata as meta } from '../test-fixtures';

const usableImage = { url: 'https://cdn/og.jpg' };

describe('LinkedIn resolve — happy path', () => {
  it('produces a thumbnail card with title + domain and no description', () => {
    const card = resolve(
      meta({
        ogTitle: 'Big news',
        ogDescription: 'Should not appear',
        ogImages: [usableImage],
        ogUrl: 'https://www.example.com/p',
      }),
    );
    expect(card.imageLayout).toBe('thumbnail');
    expect(card.title).toBe('Big news');
    expect(card.description).toBeUndefined();
    expect(card.displayUrl).toBe('www.example.com');
  });
});

describe('LinkedIn resolve — field priority', () => {
  it('uses og:title over twitter:title', () => {
    const card = resolve(
      meta({ twitterTitle: 'TW Title', ogTitle: 'OG Title' }),
    );
    expect(card.title).toBe('OG Title');
  });

  it('title falls back og → twitter → html', () => {
    expect(
      resolve(meta({ twitterTitle: 'TW Title', ogTitle: undefined })).title,
    ).toBe('TW Title');
    expect(
      resolve(
        meta({
          ogTitle: undefined,
          twitterTitle: undefined,
          htmlTitle: 'HTML Title',
        }),
      ).title,
    ).toBe('HTML Title');
  });
});

describe('LinkedIn resolve — description is never set', () => {
  it('leaves description undefined regardless of available metadata', () => {
    const card = resolve(
      meta({
        ogDescription: 'Present',
        twitterDescription: 'Also present',
        ogImages: [usableImage],
      }),
    );
    expect(card.description).toBeUndefined();
  });
});

describe('LinkedIn resolve — pass-through (no JS truncation)', () => {
  it('returns the full title unchanged', () => {
    const longTitle = 'word '.repeat(40).trim(); // 200 chars
    const card = resolve(meta({ ogTitle: longTitle, ogImages: [usableImage] }));
    expect(card.title).toBe(longTitle);
  });
});

describe('LinkedIn resolve — image edges', () => {
  it('produces no usable image when og image absent (ignores twitter:image)', () => {
    const card = resolve(
      meta({
        ogImages: [],
        ogTitle: 'Title only',
        twitterImage: { url: 'https://cdn/tw.jpg' },
      }),
    );
    expect(card.image?.url).toBeUndefined();
    expect(card.imageLayout).toBe('none');
    expect(card.presentation).toBeUndefined();
    expect(card.title).toBe('Title only');
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
