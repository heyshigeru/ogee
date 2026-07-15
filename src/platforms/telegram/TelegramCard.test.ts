// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import type { PlatformCard } from '../../core/types';
import TelegramCard from './TelegramCard.svelte';

// Theme is ambient: set document.documentElement.dataset.theme BEFORE render,
// reset between tests. Fake clock so getSentTime() is deterministic.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 7, 9, 41));
});

afterEach(() => {
  vi.useRealTimers();
});

const largeCard: PlatformCard = {
  title: 'Telegram large headline',
  description: 'A description shown under the accent site name.',
  image: { url: 'https://example.com/large.jpg' },
  imageLayout: 'large',
  displayUrl: 'www.example.com',
  linkUrl: 'https://www.example.com/post',
  siteName: 'Example',
};

const thumbnailCard: PlatformCard = {
  title: 'Telegram thumbnail headline',
  description: 'A description beside a right-side thumbnail.',
  image: { url: 'https://example.com/thumb.jpg' },
  imageLayout: 'thumbnail',
  displayUrl: 'www.example.com',
  linkUrl: 'https://www.example.com/post',
  siteName: 'Example',
};

const plainLinkCard: PlatformCard = {
  title: 'No image here',
  description: 'Has a description but no image.',
  imageLayout: 'none',
  displayUrl: 'www.example.com',
  linkUrl: 'https://www.example.com/post',
  siteName: 'Example',
  presentation: 'plain-link',
};

describe('TelegramCard — sent-message bubble in light and dark', () => {
  it('Large layout: pasted URL, accent site name, title, description, image, timestamp; no favicon', () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText } = render(TelegramCard, {
      props: { card: largeCard },
    });

    // The pasted URL line sits above the preview.
    expect(getByText(largeCard.linkUrl!)).toBeTruthy();
    // Accent site-name line, then title and description.
    expect(getByText(largeCard.siteName!)).toBeTruthy();
    expect(getByText(largeCard.title)).toBeTruthy();
    expect(getByText(largeCard.description!)).toBeTruthy();

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe(largeCard.image?.url);

    // Decorative static timestamp (the tick lives in a child span).
    expect(getByText(/9:41 AM/)).toBeTruthy();
    // Telegram leads with the accent site name; no favicon element at all (P2-D6).
    expect(container.querySelector('.favicon')).toBeNull();
  });

  it('Thumbnail layout: image, title, description, and the pasted URL all visible', () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText } = render(TelegramCard, {
      props: { card: thumbnailCard },
    });

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe(thumbnailCard.image?.url);

    expect(getByText(thumbnailCard.title)).toBeTruthy();
    expect(getByText(thumbnailCard.description!)).toBeTruthy();
    expect(getByText(thumbnailCard.linkUrl!)).toBeTruthy();
  });

  it('Plain-link: bubble + URL only — no preview block, no title/site name', () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText, queryByText } = render(TelegramCard, {
      props: { card: plainLinkCard },
    });

    expect(container.querySelector('.preview')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.bubble')).not.toBeNull();
    expect(getByText(plainLinkCard.linkUrl!)).toBeTruthy();
    expect(queryByText(plainLinkCard.title)).toBeNull();
    expect(queryByText(plainLinkCard.siteName!)).toBeNull();
  });

  it('Broken image: firing "error" hides the image and shows a friendly note', async () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText, queryByText } = render(TelegramCard, {
      props: { card: largeCard },
    });

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(queryByText(/Couldn't load the image/i)).toBeNull();

    await fireEvent.error(img!);

    expect(container.querySelector('img')).toBeNull();
    expect(getByText(/Couldn't load the image/i)).toBeTruthy();
  });

  it('Renders with light then dark themes without error', () => {
    document.documentElement.dataset.theme = 'light';
    const light = render(TelegramCard, { props: { card: largeCard } });
    expect(light.getByText(largeCard.title)).toBeTruthy();
    light.unmount();

    document.documentElement.dataset.theme = 'dark';
    const dark = render(TelegramCard, { props: { card: largeCard } });
    expect(dark.getByText(largeCard.title)).toBeTruthy();
  });

  it('Large layout with both image dims: precomputed display box (1200x630 → 306x161)', () => {
    document.documentElement.dataset.theme = 'light';
    const card: PlatformCard = {
      ...largeCard,
      image: { url: 'https://example.com/large.jpg', width: 1200, height: 630 },
    };
    const { container } = render(TelegramCard, { props: { card } });

    const img = container.querySelector('img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.getAttribute('width')).toBe('306');
    expect(img!.getAttribute('height')).toBe('161');
    expect(img!.style.width).toBe('306px');
    expect(img!.style.height).toBe('161px');
    expect(img!.style.maxHeight).toBe('432px');
  });

  it('Large layout with extreme tall dims: height-capped display box (1920x7130 → 116x432)', () => {
    document.documentElement.dataset.theme = 'light';
    const card: PlatformCard = {
      ...largeCard,
      image: {
        url: 'https://example.com/large.jpg',
        width: 1920,
        height: 7130,
      },
    };
    const { container } = render(TelegramCard, { props: { card } });

    const img = container.querySelector('img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.getAttribute('width')).toBe('116');
    expect(img!.getAttribute('height')).toBe('432');
    expect(img!.style.width).toBe('116px');
    expect(img!.style.height).toBe('432px');
  });

  it('Large layout with a lone width: no width/height attributes or inline styles', () => {
    document.documentElement.dataset.theme = 'light';
    const card: PlatformCard = {
      ...largeCard,
      image: { url: 'https://example.com/large.jpg', width: 1200 },
    };
    const { container } = render(TelegramCard, { props: { card } });

    const img = container.querySelector('img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.hasAttribute('width')).toBe(false);
    expect(img!.hasAttribute('height')).toBe(false);
    expect(img!.style.width).toBe('');
    expect(img!.style.height).toBe('');
  });

  it('Thumbnail layout with both image dims: no width/height attributes or inline styles', () => {
    document.documentElement.dataset.theme = 'light';
    const card: PlatformCard = {
      ...thumbnailCard,
      image: { url: 'https://example.com/thumb.jpg', width: 1200, height: 630 },
    };
    const { container } = render(TelegramCard, { props: { card } });

    const img = container.querySelector('img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.hasAttribute('width')).toBe(false);
    expect(img!.hasAttribute('height')).toBe(false);
    expect(img!.style.width).toBe('');
    expect(img!.style.height).toBe('');
    expect(img!.style.maxHeight).toBe('432px');
  });

  it('Large layout with no declared dims: no width/height box, but max-height cap is set', () => {
    document.documentElement.dataset.theme = 'light';
    const { container } = render(TelegramCard, { props: { card: largeCard } });

    const img = container.querySelector('img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.hasAttribute('width')).toBe(false);
    expect(img!.hasAttribute('height')).toBe(false);
    expect(img!.style.width).toBe('');
    expect(img!.style.height).toBe('');
    expect(img!.style.maxHeight).toBe('432px');
  });
});
