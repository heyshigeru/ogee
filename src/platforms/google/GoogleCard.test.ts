// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';
import type { PlatformCard } from '../../core/types';
import GoogleCard from './GoogleCard.svelte';

// Theme is ambient: set document.documentElement.dataset.theme BEFORE render.
// Theme cleanup is global (vitest-setup.ts).

// Google is always imageLayout 'none' with no preview image.
const snippet: PlatformCard = {
  title: 'Google result title',
  description: 'A gray snippet description shown beneath the title.',
  imageLayout: 'none',
  displayUrl: 'www.example.com › a › b',
  siteName: 'Example',
  faviconUrl: 'https://www.example.com/favicon.ico',
};

describe('GoogleCard — search snippet in light and dark', () => {
  it('Layout: favicon + site name + breadcrumb row, blue title, gray description', () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText } = render(GoogleCard, {
      props: { card: snippet },
    });

    const favicon = container.querySelector('img.favicon');
    expect(favicon).not.toBeNull();
    expect(favicon!.getAttribute('src')).toBe(snippet.faviconUrl);

    expect(getByText(snippet.siteName!)).toBeTruthy();
    expect(getByText(snippet.displayUrl)).toBeTruthy(); // breadcrumb with " › "
    expect(getByText(snippet.title)).toBeTruthy();
    expect(getByText(snippet.description!)).toBeTruthy();
  });

  it('No preview image: the only <img> is the decorative favicon', () => {
    document.documentElement.dataset.theme = 'light';
    const { container, queryByText } = render(GoogleCard, {
      props: { card: snippet },
    });

    const images = container.querySelectorAll('img');
    expect(images.length).toBe(1);
    expect(images[0].classList.contains('favicon')).toBe(true);

    // No main-image notes are ever rendered.
    expect(queryByText(/No image available/i)).toBeNull();
    expect(queryByText(/Couldn't load the image/i)).toBeNull();
  });

  it('Favicon error: a broken favicon hides gracefully; title and breadcrumb remain', async () => {
    document.documentElement.dataset.theme = 'light';
    const { container, getByText } = render(GoogleCard, {
      props: { card: snippet },
    });

    const favicon = container.querySelector('img.favicon');
    expect(favicon).not.toBeNull();

    await fireEvent.error(favicon!);

    expect(container.querySelector('img.favicon')).toBeNull();
    expect(getByText(snippet.title)).toBeTruthy();
    expect(getByText(snippet.displayUrl)).toBeTruthy();
  });

  it('Renders with light then dark themes without error', () => {
    document.documentElement.dataset.theme = 'light';
    const light = render(GoogleCard, { props: { card: snippet } });
    expect(light.getByText(snippet.title)).toBeTruthy();
    light.unmount();

    document.documentElement.dataset.theme = 'dark';
    const dark = render(GoogleCard, { props: { card: snippet } });
    expect(dark.getByText(snippet.title)).toBeTruthy();
  });
});
