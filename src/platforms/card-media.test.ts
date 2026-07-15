// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import type { PlatformCard } from '../core/types';
import { createImageFallback, mediaDisplayBox } from './card-media.svelte';

const constraints = { maxWidth: 360, maxHeight: 360 };

function largeCard(
  image?: PlatformCard['image'],
  imageLayout: PlatformCard['imageLayout'] = 'large',
): PlatformCard {
  return {
    title: 't',
    imageLayout,
    displayUrl: 'example.com',
    image,
  };
}

describe('mediaDisplayBox — measured dims priority', () => {
  it('measured wins over conflicting declared dims', () => {
    const card = largeCard({
      url: 'https://example.com/img.jpg',
      width: 1200,
      height: 630,
    });
    // Declared would be 360×189; measured extreme-tall → height-capped.
    const box = mediaDisplayBox(card, constraints, {
      width: 1920,
      height: 7130,
    });
    expect(box).toEqual({ width: 97, height: 360 });
  });

  it('measured alone works with no declared dims when layout is large', () => {
    const card = largeCard({ url: 'https://example.com/img.jpg' });
    const box = mediaDisplayBox(card, constraints, {
      width: 1200,
      height: 630,
    });
    expect(box).toEqual({ width: 360, height: 189 });
  });

  it('sub-slot measured dims upscale to fill maxWidth (300x195 → 360x234)', () => {
    const card = largeCard({ url: 'https://example.com/img.jpg' });
    const box = mediaDisplayBox(card, constraints, {
      width: 300,
      height: 195,
    });
    expect(box).toEqual({ width: 360, height: 234 });
  });

  it('thumbnail/non-large imageLayout returns undefined even when measured is provided', () => {
    const card = largeCard(
      { url: 'https://example.com/img.jpg', width: 1200, height: 630 },
      'thumbnail',
    );
    const box = mediaDisplayBox(card, constraints, {
      width: 1920,
      height: 7130,
    });
    expect(box).toBeUndefined();
  });
});

describe('mediaDisplayBox — non-positive dims treated as absent', () => {
  it('declared width 0 with positive height → undefined', () => {
    const card = largeCard({
      url: 'https://example.com/img.jpg',
      width: 0,
      height: 500,
    });
    expect(mediaDisplayBox(card, constraints)).toBeUndefined();
  });

  it('negative declared height → undefined', () => {
    const card = largeCard({
      url: 'https://example.com/img.jpg',
      width: 800,
      height: -1,
    });
    expect(mediaDisplayBox(card, constraints)).toBeUndefined();
  });

  it('measured {width: 0, height: 500} passed explicitly → undefined', () => {
    const card = largeCard({ url: 'https://example.com/img.jpg' });
    expect(
      mediaDisplayBox(card, constraints, { width: 0, height: 500 }),
    ).toBeUndefined();
  });
});

describe('mediaDisplayBox — zero-dimension guard', () => {
  it('declared 1200x1 → undefined (w=360, h=round(0.3)=0)', () => {
    const card = largeCard({
      url: 'https://example.com/img.jpg',
      width: 1200,
      height: 1,
    });
    expect(mediaDisplayBox(card, constraints)).toBeUndefined();
  });

  it('declared 1x1_000_000 → undefined (reclamp path: h=360, w=round(0.00036)=0)', () => {
    const card = largeCard({
      url: 'https://example.com/img.jpg',
      width: 1,
      height: 1_000_000,
    });
    expect(mediaDisplayBox(card, constraints)).toBeUndefined();
  });

  it('coverSquare with declared 1x1_000_000 → { width: 334, height: 334 } (branch unaffected)', () => {
    const card = largeCard({
      url: 'https://example.com/img.jpg',
      width: 1,
      height: 1_000_000,
    });
    expect(
      mediaDisplayBox(card, {
        maxWidth: 360,
        maxHeight: 360,
        coverSquare: 334,
      }),
    ).toEqual({ width: 334, height: 334 });
  });

  it('declared 1200x3 → { width: 360, height: 1 } (h=round(0.9)=1; guard is < 1)', () => {
    const card = largeCard({
      url: 'https://example.com/img.jpg',
      width: 1200,
      height: 3,
    });
    expect(mediaDisplayBox(card, constraints)).toEqual({
      width: 360,
      height: 1,
    });
  });
});

describe('createImageFallback — dims URL keying', () => {
  it('recorded dims reset to undefined when the URL changes', () => {
    let url = 'a.jpg';
    const image = createImageFallback(() => url);

    image.loaded({
      naturalWidth: 800,
      naturalHeight: 600,
    } as HTMLImageElement);
    expect(image.dims).toEqual({ width: 800, height: 600 });

    url = 'b.jpg';
    expect(image.dims).toBeUndefined();

    // URL-keyed: prior dims return when the original URL is restored.
    url = 'a.jpg';
    expect(image.dims).toEqual({ width: 800, height: 600 });
  });
});
