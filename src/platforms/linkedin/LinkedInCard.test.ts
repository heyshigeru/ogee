// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import type { PlatformCard } from '../../core/types';
import LinkedInCard from './LinkedInCard.svelte';

// Theme is ambient: set document.documentElement.dataset.theme BEFORE render.
// Theme cleanup is global (vitest-setup.ts).

// Fixtures keep `description` set on purpose — the calibrated card MUST NOT render
// it even when a value is provided. Negative assertions encode that contract.
const imageCard: PlatformCard = {
  title: 'Big news headline',
  description: 'This description must NOT be rendered by the LinkedIn card.',
  image: { url: 'https://example.com/thumb.jpg' },
  imageLayout: 'thumbnail',
  displayUrl: 'www.example.com',
  siteName: 'Example',
};

const noneCard: PlatformCard = {
  title: 'No image here',
  description:
    'Has a description but no image — description still must NOT render.',
  imageLayout: 'none',
  displayUrl: 'www.example.com',
  siteName: 'Example',
};

describe('LinkedInCard — calibrated compact layout in light and dark', () => {
  it('Thumbnail layout: image + title + domain visible; description never renders', () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText, queryByText } = render(LinkedInCard, {
      props: { card: imageCard },
    });

    const img = container.querySelector('img');
    expect(img).not.toBeNull();
    expect(img!.getAttribute('src')).toBe(imageCard.image?.url);

    expect(getByText(imageCard.title)).toBeTruthy();
    expect(getByText(imageCard.displayUrl)).toBeTruthy();

    // Calibrated contract: the preview shows only title + domain.
    expect(queryByText(imageCard.description!)).toBeNull();
  });

  it('No image: text-only fold — no <img>, no placeholder note, title and domain visible', () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText, queryByText } = render(LinkedInCard, {
      props: { card: noneCard },
    });

    expect(container.querySelector('img')).toBeNull();
    expect(queryByText(/No image available/i)).toBeNull();
    expect(queryByText(/Couldn't load the image/i)).toBeNull();
    expect(queryByText(noneCard.description!)).toBeNull();

    expect(getByText(noneCard.title)).toBeTruthy();
    expect(getByText(noneCard.displayUrl)).toBeTruthy();
  });

  it('Broken image: firing "error" hides the image and shows a friendly note', async () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText, queryByText } = render(LinkedInCard, {
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
    const light = render(LinkedInCard, { props: { card: imageCard } });
    expect(light.getByText(imageCard.title)).toBeTruthy();
    light.unmount();

    document.documentElement.dataset.theme = 'dark';
    const dark = render(LinkedInCard, { props: { card: imageCard } });
    expect(dark.getByText(imageCard.title)).toBeTruthy();
  });
});
