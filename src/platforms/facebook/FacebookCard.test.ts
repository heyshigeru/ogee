// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import type { PlatformCard } from '../../core/types';
import FacebookCard from './FacebookCard.svelte';

// Theme is ambient: set document.documentElement.dataset.theme BEFORE render.
// Theme cleanup is global (vitest-setup.ts).

// Fixtures keep `description` set on purpose — the calibrated card MUST NOT render
// it even when a value is provided. Negative assertions encode that contract.
const largeCard: PlatformCard = {
  title: 'Launch day headline',
  description: 'Description must NOT render in the calibrated Facebook card.',
  image: { url: 'https://example.com/large.jpg' },
  imageLayout: 'large',
  displayUrl: 'example.com',
  siteName: 'Example',
};

const thumbnailCard: PlatformCard = {
  title: 'Narrow image card',
  description: 'A short description that also must NOT render.',
  image: { url: 'https://example.com/thumb.jpg' },
  imageLayout: 'thumbnail',
  displayUrl: 'example.com',
  siteName: 'Example',
};

const noneCard: PlatformCard = {
  title: 'No image here',
  description:
    'Has a description but no image — description still must NOT render.',
  imageLayout: 'none',
  displayUrl: 'example.com',
  siteName: 'Example',
};

describe('FacebookCard — calibrated layout in light and dark', () => {
  it('Large layout: image, title, domain visible; description never renders; seam icon present', () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText, queryByText } = render(FacebookCard, {
      props: { card: largeCard },
    });

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe(largeCard.image?.url);

    expect(getByText(largeCard.title)).toBeTruthy();

    // DOM text node stays lowercase; CSS uppercases via the .domain rule.
    // jsdom's getComputedStyle does not resolve scoped Svelte CSS, so assert the
    // element carries the .domain class whose rule applies text-transform: uppercase.
    const domainEl = getByText(largeCard.displayUrl);
    expect(domainEl.textContent).toBe('example.com');
    expect(domainEl.classList.contains('domain')).toBe(true);

    // Calibrated contract: feed card shows only domain + title.
    expect(queryByText(largeCard.description!)).toBeNull();

    // The 28pt seam icon rides the image/meta boundary on the large variant.
    expect(container.querySelector('.seam-icon')).not.toBeNull();
  });

  it('Thumbnail layout: 158pt square image, title visible; no description, no seam icon', () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText, queryByText } = render(FacebookCard, {
      props: { card: thumbnailCard },
    });

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe(thumbnailCard.image?.url);

    expect(getByText(thumbnailCard.title)).toBeTruthy();
    expect(queryByText(thumbnailCard.description!)).toBeNull();

    // Seam icon is large-only — no horizontal seam exists in the row layout.
    expect(container.querySelector('.seam-icon')).toBeNull();
  });

  it('No image: text-only fold — no <img>, no placeholder note, no seam icon, title and domain visible', () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText, queryByText } = render(FacebookCard, {
      props: { card: noneCard },
    });

    expect(container.querySelector('img')).toBeNull();
    expect(queryByText(/No image available/i)).toBeNull();
    expect(queryByText(/Couldn't load the image/i)).toBeNull();
    expect(container.querySelector('.seam-icon')).toBeNull();
    expect(queryByText(noneCard.description!)).toBeNull();

    expect(getByText(noneCard.title)).toBeTruthy();
    expect(getByText(noneCard.displayUrl)).toBeTruthy();
  });

  it('Broken image: firing "error" hides the image and shows a friendly note', async () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText, queryByText } = render(FacebookCard, {
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
    const light = render(FacebookCard, { props: { card: largeCard } });
    expect(light.getByText(largeCard.title)).toBeTruthy();
    light.unmount();

    document.documentElement.dataset.theme = 'dark';
    const dark = render(FacebookCard, { props: { card: largeCard } });
    expect(dark.getByText(largeCard.title)).toBeTruthy();
  });
});
