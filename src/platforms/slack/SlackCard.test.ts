// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import type { PlatformCard } from '../../core/types';
import SlackCard from './SlackCard.svelte';

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
  title: 'Slack unfurl headline',
  description: 'A three-line-clamp description for the unfurl.',
  image: { url: 'https://example.com/large.jpg' },
  imageLayout: 'large',
  displayUrl: 'www.example.com',
  linkUrl: 'https://www.example.com/post',
  siteName: 'Example',
  faviconUrl: 'https://www.example.com/favicon.ico',
};

const thumbnailCard: PlatformCard = {
  title: 'Slack thumbnail headline',
  description: 'A description beside a right-side thumbnail.',
  image: { url: 'https://example.com/thumb.jpg' },
  imageLayout: 'thumbnail',
  displayUrl: 'www.example.com',
  linkUrl: 'https://www.example.com/post',
  siteName: 'Example',
  faviconUrl: 'https://www.example.com/favicon.ico',
};

const plainLinkCard: PlatformCard = {
  title: 'No image here',
  description: 'Has a description but no image.',
  imageLayout: 'none',
  displayUrl: 'www.example.com',
  linkUrl: 'https://www.example.com/post',
  siteName: 'Example',
  faviconUrl: 'https://www.example.com/favicon.ico',
  presentation: 'plain-link',
};

describe('SlackCard — flat message row with an unfurl in light and dark', () => {
  it('Large layout: sender + time, pasted URL, unfurl (favicon + service, title, description, image)', () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText } = render(SlackCard, {
      props: { card: largeCard },
    });

    // Message header (decorative sender + time) and the unfurl block.
    expect(getByText('You')).toBeTruthy();
    expect(getByText(/9:41 AM/)).toBeTruthy();
    expect(container.querySelector('.unfurl')).not.toBeNull();
    // Pasted URL line above the unfurl.
    expect(getByText(largeCard.linkUrl!)).toBeTruthy();

    // Favicon image in the service row (distinct from the main media image).
    const favicon = container.querySelector('img.favicon');
    expect(favicon).not.toBeNull();
    expect(favicon!.getAttribute('src')).toBe(largeCard.faviconUrl);

    expect(getByText(largeCard.siteName!)).toBeTruthy();
    expect(getByText(largeCard.title)).toBeTruthy();
    expect(getByText(largeCard.description!)).toBeTruthy();

    // Main media image is a separate <img> (not the favicon).
    const main = container.querySelector('img.media');
    expect(main).not.toBeNull();
    expect(main!.getAttribute('src')).toBe(largeCard.image?.url);
  });

  it('Thumbnail layout: main image, title, description, and the pasted URL all visible', () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText } = render(SlackCard, {
      props: { card: thumbnailCard },
    });

    const main = container.querySelector('img.media');
    expect(main).not.toBeNull();
    expect(main!.getAttribute('src')).toBe(thumbnailCard.image?.url);

    expect(getByText(thumbnailCard.title)).toBeTruthy();
    expect(getByText(thumbnailCard.description!)).toBeTruthy();
    expect(getByText(thumbnailCard.linkUrl!)).toBeTruthy();
  });

  it('Favicon error: a broken favicon hides gracefully; service name and title remain', async () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText } = render(SlackCard, {
      props: { card: largeCard },
    });

    const favicon = container.querySelector('img.favicon');
    expect(favicon).not.toBeNull();

    await fireEvent.error(favicon!);

    // Favicon element removed; no note rendered; the row keeps its meaning.
    expect(container.querySelector('img.favicon')).toBeNull();
    expect(getByText(largeCard.siteName!)).toBeTruthy();
    expect(getByText(largeCard.title)).toBeTruthy();
  });

  it('Main-image error: broken main <img> shows "Couldn\'t load the image"', async () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText, queryByText } = render(SlackCard, {
      props: { card: largeCard },
    });

    const main = container.querySelector('img.media');
    expect(main).not.toBeNull();
    expect(queryByText(/Couldn't load the image/i)).toBeNull();

    await fireEvent.error(main!);

    expect(container.querySelector('img.media')).toBeNull();
    expect(getByText(/Couldn't load the image/i)).toBeTruthy();
  });

  it('Plain-link: message chrome + URL only — no unfurl, no title/service', () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText, queryByText } = render(SlackCard, {
      props: { card: plainLinkCard },
    });

    expect(container.querySelector('.unfurl')).toBeNull();
    expect(container.querySelector('img.media')).toBeNull();
    expect(getByText('You')).toBeTruthy();
    expect(getByText(plainLinkCard.linkUrl!)).toBeTruthy();
    expect(queryByText(plainLinkCard.title)).toBeNull();
    expect(queryByText(plainLinkCard.siteName!)).toBeNull();
  });

  it('Renders with light then dark themes without error', () => {
    document.documentElement.dataset.theme = 'light';
    const light = render(SlackCard, { props: { card: largeCard } });
    expect(light.getByText(largeCard.title)).toBeTruthy();
    light.unmount();

    document.documentElement.dataset.theme = 'dark';
    const dark = render(SlackCard, { props: { card: largeCard } });
    expect(dark.getByText(largeCard.title)).toBeTruthy();
  });

  it('Large layout with both image dims: precomputed display box (1200x630 → 360x189)', () => {
    document.documentElement.dataset.theme = 'light';
    const card: PlatformCard = {
      ...largeCard,
      image: { url: 'https://example.com/large.jpg', width: 1200, height: 630 },
    };
    const { container } = render(SlackCard, { props: { card } });

    const main = container.querySelector(
      'img.media',
    ) as HTMLImageElement | null;
    expect(main).not.toBeNull();
    expect(main!.getAttribute('width')).toBe('360');
    expect(main!.getAttribute('height')).toBe('189');
    expect(main!.style.width).toBe('360px');
    expect(main!.style.height).toBe('189px');
    expect(main!.style.maxWidth).toBe('360px');
    expect(main!.style.maxHeight).toBe('360px');
  });

  it('Large layout with extreme tall dims: height-capped display box (1920x7130 → 97x360)', () => {
    document.documentElement.dataset.theme = 'light';
    const card: PlatformCard = {
      ...largeCard,
      image: {
        url: 'https://example.com/large.jpg',
        width: 1920,
        height: 7130,
      },
    };
    const { container } = render(SlackCard, { props: { card } });

    const main = container.querySelector(
      'img.media',
    ) as HTMLImageElement | null;
    expect(main).not.toBeNull();
    expect(main!.getAttribute('width')).toBe('97');
    expect(main!.getAttribute('height')).toBe('360');
    expect(main!.style.width).toBe('97px');
    expect(main!.style.height).toBe('360px');
  });

  it('Large layout with a lone width: no width/height attributes or inline styles', () => {
    document.documentElement.dataset.theme = 'light';
    const card: PlatformCard = {
      ...largeCard,
      image: { url: 'https://example.com/large.jpg', width: 1200 },
    };
    const { container } = render(SlackCard, { props: { card } });

    const main = container.querySelector(
      'img.media',
    ) as HTMLImageElement | null;
    expect(main).not.toBeNull();
    expect(main!.hasAttribute('width')).toBe(false);
    expect(main!.hasAttribute('height')).toBe(false);
    expect(main!.style.width).toBe('');
    expect(main!.style.height).toBe('');
  });

  it('Thumbnail layout with both image dims: no width/height attributes or inline styles', () => {
    document.documentElement.dataset.theme = 'light';
    const card: PlatformCard = {
      ...thumbnailCard,
      image: { url: 'https://example.com/thumb.jpg', width: 1200, height: 630 },
    };
    const { container } = render(SlackCard, { props: { card } });

    const main = container.querySelector(
      'img.media',
    ) as HTMLImageElement | null;
    expect(main).not.toBeNull();
    expect(main!.hasAttribute('width')).toBe(false);
    expect(main!.hasAttribute('height')).toBe(false);
    expect(main!.style.width).toBe('');
    expect(main!.style.height).toBe('');
    expect(main!.style.maxWidth).toBe('360px');
    expect(main!.style.maxHeight).toBe('360px');
  });

  it('Large layout with no declared dims: no width/height box, but max caps are set', () => {
    document.documentElement.dataset.theme = 'light';
    const { container } = render(SlackCard, { props: { card: largeCard } });

    const main = container.querySelector(
      'img.media',
    ) as HTMLImageElement | null;
    expect(main).not.toBeNull();
    expect(main!.hasAttribute('width')).toBe(false);
    expect(main!.hasAttribute('height')).toBe(false);
    expect(main!.style.width).toBe('');
    expect(main!.style.height).toBe('');
    expect(main!.style.maxWidth).toBe('360px');
    expect(main!.style.maxHeight).toBe('360px');
  });

  it('Lying meta: measured natural dims override declared 1200x630 after load (→ 97x360)', async () => {
    document.documentElement.dataset.theme = 'light';
    const card: PlatformCard = {
      ...largeCard,
      image: { url: 'https://example.com/large.jpg', width: 1200, height: 630 },
    };
    const { container } = render(SlackCard, { props: { card } });

    const main = container.querySelector(
      'img.media',
    ) as HTMLImageElement | null;
    expect(main).not.toBeNull();
    // Pre-load: declared wide dims drive the box.
    expect(main!.getAttribute('width')).toBe('360');
    expect(main!.getAttribute('height')).toBe('189');

    Object.defineProperty(main!, 'naturalWidth', {
      configurable: true,
      value: 1920,
    });
    Object.defineProperty(main!, 'naturalHeight', {
      configurable: true,
      value: 7130,
    });
    await fireEvent.load(main!);

    // Post-load: measured tall natural size is ground truth.
    expect(main!.getAttribute('width')).toBe('97');
    expect(main!.getAttribute('height')).toBe('360');
    expect(main!.style.width).toBe('97px');
    expect(main!.style.height).toBe('360px');
  });
});
