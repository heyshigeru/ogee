// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import type { PlatformCard } from '../../core/types';
import DiscordCard from './DiscordCard.svelte';

// Theme is ambient: set document.documentElement.dataset.theme BEFORE render,
// reset between tests. Fake clock so getDiscordSentTime() is deterministic.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 7, 9, 41));
});

afterEach(() => {
  vi.useRealTimers();
});

const largeCard: PlatformCard = {
  title: 'Discord embed headline',
  description: 'A generous embed description shown under the site name.',
  image: { url: 'https://example.com/large.jpg' },
  imageLayout: 'large',
  displayUrl: 'www.example.com',
  linkUrl: 'https://www.example.com/post',
  siteName: 'Example',
};

const thumbnailCard: PlatformCard = {
  title: 'Discord thumbnail headline',
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

describe('DiscordCard — flat message row with an embed in light and dark', () => {
  it('Static grey bar: the embed (with its left bar) renders in both themes (driven by CSS, not card data)', () => {
    // The card carries no color-related field; the bar is static CSS in both themes.
    document.documentElement.dataset.theme = 'light';
    const light = render(DiscordCard, { props: { card: largeCard } });
    expect(light.container.querySelector('.embed')).not.toBeNull();
    light.unmount();

    document.documentElement.dataset.theme = 'dark';
    const dark = render(DiscordCard, { props: { card: largeCard } });
    expect(dark.container.querySelector('.embed')).not.toBeNull();
  });

  it('Large layout: sender + time, pasted URL, embed (provider, title, description, image); no favicon', () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText } = render(DiscordCard, {
      props: { card: largeCard },
    });

    // Message header (decorative sender + time) and the pasted URL line.
    expect(getByText('You')).toBeTruthy();
    expect(getByText('6/7/26, 9:41 AM')).toBeTruthy();
    expect(getByText(largeCard.linkUrl!)).toBeTruthy();

    expect(getByText(largeCard.siteName!)).toBeTruthy();
    expect(getByText(largeCard.title)).toBeTruthy();
    expect(getByText(largeCard.description!)).toBeTruthy();

    const main = container.querySelector('img.media');
    expect(main).not.toBeNull();
    expect(main!.getAttribute('src')).toBe(largeCard.image?.url);

    // Discord leads with the site name; no favicon element at all (P2-D6).
    expect(container.querySelector('.favicon')).toBeNull();
  });

  it('Thumbnail layout: image, title, description, and the pasted URL all visible', () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText } = render(DiscordCard, {
      props: { card: thumbnailCard },
    });

    const img = container.querySelector('img.media');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe(thumbnailCard.image?.url);

    expect(getByText(thumbnailCard.title)).toBeTruthy();
    expect(getByText(thumbnailCard.description!)).toBeTruthy();
    expect(getByText(thumbnailCard.linkUrl!)).toBeTruthy();
  });

  it('Image error: broken main <img> shows "Couldn\'t load the image"', async () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText, queryByText } = render(DiscordCard, {
      props: { card: largeCard },
    });

    const img = container.querySelector('img.media');
    expect(img).not.toBeNull();
    expect(queryByText(/Couldn't load the image/i)).toBeNull();

    await fireEvent.error(img!);

    expect(container.querySelector('img.media')).toBeNull();
    expect(getByText(/Couldn't load the image/i)).toBeTruthy();
  });

  it('Plain-link: message chrome + URL only — no embed, no title/provider', () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText, queryByText } = render(DiscordCard, {
      props: { card: plainLinkCard },
    });

    expect(container.querySelector('.embed')).toBeNull();
    expect(container.querySelector('img.media')).toBeNull();
    expect(getByText('You')).toBeTruthy();
    expect(getByText(plainLinkCard.linkUrl!)).toBeTruthy();
    expect(queryByText(plainLinkCard.title)).toBeNull();
    expect(queryByText(plainLinkCard.siteName!)).toBeNull();
  });

  it('Media-less rich: embed without image still shows title and provider', () => {
    document.documentElement.dataset.theme = 'light';
    const mediaLess: PlatformCard = {
      title: 'Queue',
      description: 'Podcasts',
      imageLayout: 'none',
      displayUrl: 'www.example.com',
      linkUrl: 'https://www.example.com/post',
      siteName: 'Example',
    };
    const { container, getByText } = render(DiscordCard, {
      props: { card: mediaLess },
    });
    expect(container.querySelector('.embed')).not.toBeNull();
    expect(container.querySelector('img.media')).toBeNull();
    expect(getByText('Queue')).toBeTruthy();
    expect(getByText('Example')).toBeTruthy();
  });

  it('Renders with light then dark themes without error', () => {
    document.documentElement.dataset.theme = 'light';
    const light = render(DiscordCard, { props: { card: largeCard } });
    expect(light.getByText(largeCard.title)).toBeTruthy();
    light.unmount();

    document.documentElement.dataset.theme = 'dark';
    const dark = render(DiscordCard, { props: { card: largeCard } });
    expect(dark.getByText(largeCard.title)).toBeTruthy();
  });

  it('Large layout with both image dims: precomputed display box (1200x630 → 365x192)', () => {
    document.documentElement.dataset.theme = 'light';
    const card: PlatformCard = {
      ...largeCard,
      image: { url: 'https://example.com/large.jpg', width: 1200, height: 630 },
    };
    const { container } = render(DiscordCard, { props: { card } });

    const main = container.querySelector(
      'img.media',
    ) as HTMLImageElement | null;
    expect(main).not.toBeNull();
    expect(main!.getAttribute('width')).toBe('365');
    expect(main!.getAttribute('height')).toBe('192');
    expect(main!.style.width).toBe('365px');
    expect(main!.style.height).toBe('192px');
    expect(main!.style.maxHeight).toBe('300px');
  });

  it('Large layout with extreme tall dims: height-capped display box (1920x7130 → 81x300)', () => {
    document.documentElement.dataset.theme = 'light';
    const card: PlatformCard = {
      ...largeCard,
      image: {
        url: 'https://example.com/large.jpg',
        width: 1920,
        height: 7130,
      },
    };
    const { container } = render(DiscordCard, { props: { card } });

    const main = container.querySelector(
      'img.media',
    ) as HTMLImageElement | null;
    expect(main).not.toBeNull();
    expect(main!.getAttribute('width')).toBe('81');
    expect(main!.getAttribute('height')).toBe('300');
    expect(main!.style.width).toBe('81px');
    expect(main!.style.height).toBe('300px');
  });

  it('Large layout with small image dims: upscales to fill slot (300x195 → 365x237)', () => {
    document.documentElement.dataset.theme = 'light';
    const card: PlatformCard = {
      ...largeCard,
      image: { url: 'https://example.com/large.jpg', width: 300, height: 195 },
    };
    const { container } = render(DiscordCard, { props: { card } });

    const main = container.querySelector(
      'img.media',
    ) as HTMLImageElement | null;
    expect(main).not.toBeNull();
    expect(main!.getAttribute('width')).toBe('365');
    expect(main!.getAttribute('height')).toBe('237');
    expect(main!.style.width).toBe('365px');
    expect(main!.style.height).toBe('237px');
  });

  it('Large layout with a lone width: no width/height attributes or inline styles', () => {
    document.documentElement.dataset.theme = 'light';
    const card: PlatformCard = {
      ...largeCard,
      image: { url: 'https://example.com/large.jpg', width: 1200 },
    };
    const { container } = render(DiscordCard, { props: { card } });

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
    const { container } = render(DiscordCard, { props: { card } });

    const main = container.querySelector(
      'img.media',
    ) as HTMLImageElement | null;
    expect(main).not.toBeNull();
    expect(main!.hasAttribute('width')).toBe(false);
    expect(main!.hasAttribute('height')).toBe(false);
    expect(main!.style.width).toBe('');
    expect(main!.style.height).toBe('');
    expect(main!.style.maxHeight).toBe('300px');
  });

  it('Large layout with no declared dims: no width/height box, but max-height cap is set', () => {
    document.documentElement.dataset.theme = 'light';
    const { container } = render(DiscordCard, { props: { card: largeCard } });

    const main = container.querySelector(
      'img.media',
    ) as HTMLImageElement | null;
    expect(main).not.toBeNull();
    expect(main!.hasAttribute('width')).toBe(false);
    expect(main!.hasAttribute('height')).toBe(false);
    expect(main!.style.width).toBe('');
    expect(main!.style.height).toBe('');
    expect(main!.style.maxHeight).toBe('300px');
  });
});
