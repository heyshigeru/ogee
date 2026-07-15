// @vitest-environment jsdom
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import type { PlatformCard } from '../../core/types';
import WhatsAppCard from './WhatsAppCard.svelte';

// Theme is ambient: set document.documentElement.dataset.theme BEFORE render,
// reset between tests. Fake clock so getSentTime() is deterministic.
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 5, 7, 9, 41));
});

afterEach(() => {
  vi.useRealTimers();
});

const imageCard: PlatformCard = {
  title: 'Chat preview title',
  description: 'A short link preview description.',
  image: { url: 'https://example.com/large.jpg' },
  imageLayout: 'large',
  displayUrl: 'www.example.com',
  linkUrl: 'https://www.example.com/post',
  siteName: 'Example',
};

const noneCard: PlatformCard = {
  title: 'No image here',
  description: 'Has a description but no image.',
  imageLayout: 'none',
  displayUrl: 'www.example.com',
  linkUrl: 'https://www.example.com/post',
  siteName: 'Example',
};

describe('WhatsAppCard — sent-message bubble in light and dark', () => {
  it('Image layout: image on top, title/description/domain, the pasted URL, and a timestamp', () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText } = render(WhatsAppCard, {
      props: { card: imageCard },
    });

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe(imageCard.image?.url);

    expect(getByText(imageCard.title)).toBeTruthy();
    expect(getByText(imageCard.description!)).toBeTruthy();
    expect(getByText(imageCard.displayUrl)).toBeTruthy();
    // The full pasted URL renders as its own line.
    expect(getByText(imageCard.linkUrl!)).toBeTruthy();
    // Decorative static timestamp (matched loosely; the tick lives in a child span).
    expect(getByText(/9:41 AM/)).toBeTruthy();
  });

  it('No image: text-only preview — no <img>, no placeholder note, meta + URL still visible', () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText, queryByText } = render(WhatsAppCard, {
      props: { card: noneCard },
    });

    expect(container.querySelector('img')).toBeNull();
    expect(queryByText(/No image available/i)).toBeNull();
    expect(queryByText(/Couldn't load the image/i)).toBeNull();

    expect(getByText(noneCard.title)).toBeTruthy();
    expect(getByText(noneCard.displayUrl)).toBeTruthy();
    expect(getByText(noneCard.linkUrl!)).toBeTruthy();
  });

  it('Broken image: firing "error" hides the image and shows a friendly note', async () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText, queryByText } = render(WhatsAppCard, {
      props: { card: imageCard },
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
    const light = render(WhatsAppCard, { props: { card: imageCard } });
    expect(light.getByText(imageCard.title)).toBeTruthy();
    light.unmount();

    document.documentElement.dataset.theme = 'dark';
    const dark = render(WhatsAppCard, { props: { card: imageCard } });
    expect(dark.getByText(imageCard.title)).toBeTruthy();
  });

  it('Large layout with both image dims: precomputed display box (1200x630 → 334x175)', () => {
    document.documentElement.dataset.theme = 'light';
    const card: PlatformCard = {
      ...imageCard,
      image: { url: 'https://example.com/large.jpg', width: 1200, height: 630 },
    };
    const { container } = render(WhatsAppCard, { props: { card } });

    const img = container.querySelector('img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.getAttribute('width')).toBe('334');
    expect(img!.getAttribute('height')).toBe('175');
    expect(img!.style.width).toBe('334px');
    expect(img!.style.height).toBe('175px');
    expect(img!.style.maxHeight).toBe('334px');
  });

  it('Large layout with taller-than-square dims: square box (1920x7130 → 334x334)', () => {
    document.documentElement.dataset.theme = 'light';
    const card: PlatformCard = {
      ...imageCard,
      image: {
        url: 'https://example.com/large.jpg',
        width: 1920,
        height: 7130,
      },
    };
    const { container } = render(WhatsAppCard, { props: { card } });

    const img = container.querySelector('img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.getAttribute('width')).toBe('334');
    expect(img!.getAttribute('height')).toBe('334');
    expect(img!.style.width).toBe('334px');
    expect(img!.style.height).toBe('334px');
  });

  it('Large layout with a lone width: no width/height attributes or inline styles', () => {
    document.documentElement.dataset.theme = 'light';
    const card: PlatformCard = {
      ...imageCard,
      image: { url: 'https://example.com/large.jpg', width: 1200 },
    };
    const { container } = render(WhatsAppCard, { props: { card } });

    const img = container.querySelector('img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.hasAttribute('width')).toBe(false);
    expect(img!.hasAttribute('height')).toBe(false);
    expect(img!.style.width).toBe('');
    expect(img!.style.height).toBe('');
  });

  it('Large layout with no declared dims: measured natural size fills the box after load (1920x7130 → 334x334)', async () => {
    document.documentElement.dataset.theme = 'light';
    const card: PlatformCard = {
      ...imageCard,
      image: { url: 'https://example.com/large.jpg' },
    };
    const { container } = render(WhatsAppCard, { props: { card } });

    const img = container.querySelector('img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    // Pre-load: no declared dims → mediaDisplayBox returns undefined.
    expect(img!.hasAttribute('width')).toBe(false);
    expect(img!.hasAttribute('height')).toBe(false);
    // max-height cap is set immediately from MEDIA_BOX_CONSTRAINTS.coverSquare.
    expect(img!.style.maxHeight).toBe('334px');

    Object.defineProperty(img!, 'naturalWidth', {
      configurable: true,
      value: 1920,
    });
    Object.defineProperty(img!, 'naturalHeight', {
      configurable: true,
      value: 7130,
    });
    await fireEvent.load(img!);

    expect(img!.getAttribute('width')).toBe('334');
    expect(img!.getAttribute('height')).toBe('334');
    expect(img!.style.width).toBe('334px');
    expect(img!.style.height).toBe('334px');
    expect(img!.style.maxHeight).toBe('334px');
  });

  it('Large layout with no declared dims: no width/height box, but max-height cap is set', () => {
    document.documentElement.dataset.theme = 'light';
    const { container } = render(WhatsAppCard, { props: { card: imageCard } });

    const img = container.querySelector('img') as HTMLImageElement | null;
    expect(img).not.toBeNull();
    expect(img!.hasAttribute('width')).toBe(false);
    expect(img!.hasAttribute('height')).toBe(false);
    expect(img!.style.width).toBe('');
    expect(img!.style.height).toBe('');
    expect(img!.style.maxHeight).toBe('334px');
  });
});
