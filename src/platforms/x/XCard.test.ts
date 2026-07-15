// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import type { PlatformCard } from '../../core/types';
import XCard from './XCard.svelte';

// Theme is ambient: set document.documentElement.dataset.theme BEFORE render.
// Theme cleanup is global (vitest-setup.ts).

const largeCard: PlatformCard = {
  title: 'Large layout headline',
  description: 'This description must NOT be rendered in the large layout.',
  image: { url: 'https://example.com/large.jpg' },
  imageLayout: 'large',
  displayUrl: 'example.com',
  siteName: 'Example',
};

const thumbnailCard: PlatformCard = {
  title: 'Summary card title',
  description: 'A short summary description for the thumbnail layout.',
  image: { url: 'https://example.com/thumb.jpg' },
  imageLayout: 'thumbnail',
  displayUrl: 'example.com',
  siteName: 'Example',
};

const plainLinkCard: PlatformCard = {
  title: 'No image here',
  imageLayout: 'none',
  displayUrl: 'example.com',
  presentation: 'plain-link',
  linkUrl: 'https://www.example.com/post',
  siteName: 'Example',
};

describe('XCard — Faithful X card in light and dark', () => {
  it('Large layout: full-width image, domain visible, no description', () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText, queryByText } = render(XCard, {
      props: { card: largeCard },
    });

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe(largeCard.image?.url);

    // Domain / displayUrl is visible.
    expect(getByText(largeCard.displayUrl)).toBeTruthy();

    // No description in the large layout.
    expect(queryByText(largeCard.description!)).toBeNull();
  });

  it('Summary/thumbnail layout: thumbnail image, title, description, and domain all visible', () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText } = render(XCard, {
      props: { card: thumbnailCard },
    });

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe(thumbnailCard.image?.url);

    expect(getByText(thumbnailCard.title)).toBeTruthy();
    expect(getByText(thumbnailCard.description!)).toBeTruthy();
    expect(getByText(thumbnailCard.displayUrl)).toBeTruthy();
  });

  // Feed collapse: no usable image → plain URL row (no card chrome).
  // A genuine image-load error is still surfaced on the rich card — see "Broken image".
  it('Plain-link presentation: shows full URL, no card chrome, no image note', () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText, queryByText } = render(XCard, {
      props: { card: plainLinkCard },
    });

    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('.card')).toBeNull();
    expect(queryByText(/Couldn't load the image/i)).toBeNull();
    expect(queryByText(plainLinkCard.title)).toBeNull();
    expect(getByText(plainLinkCard.linkUrl!)).toBeTruthy();
  });

  it('Broken image: firing "error" hides the image and shows a friendly note', async () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText, queryByText } = render(XCard, {
      props: { card: largeCard },
    });

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(queryByText(/Couldn't load the image/i)).toBeNull();

    await fireEvent.error(img!);

    expect(container.querySelector('img')).toBeNull();
    expect(getByText(/Couldn't load the image/i)).toBeTruthy();
  });

  it('Recovers when the card image URL changes after a previous load error', async () => {
    document.documentElement.dataset.theme = 'light';
    const { container, rerender, getByText, queryByText } = render(XCard, {
      props: { card: largeCard },
    });

    await fireEvent.error(container.querySelector('img')!);
    expect(getByText(/Couldn't load the image/i)).toBeTruthy();

    // The same instance now resolves to a different, working image URL.
    await rerender({
      card: { ...largeCard, image: { url: 'https://example.com/other.jpg' } },
    });

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe('https://example.com/other.jpg');
    expect(queryByText(/Couldn't load the image/i)).toBeNull();
  });

  it('Renders with light then dark themes without error', () => {
    document.documentElement.dataset.theme = 'light';
    const light = render(XCard, { props: { card: largeCard } });
    expect(light.getByText(largeCard.title)).toBeTruthy();
    light.unmount();

    document.documentElement.dataset.theme = 'dark';
    const dark = render(XCard, { props: { card: largeCard } });
    expect(dark.getByText(largeCard.title)).toBeTruthy();
  });
});
