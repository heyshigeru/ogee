import type { PageMetadata, PlatformCard } from './types';
import { isSafeUrl } from './url-safety';
import {
  firstNonBlank,
  firstSafeImage,
  hostnameOf,
  layoutForWidth,
  resolveDescription,
  resolveImage,
  resolveSiteName,
  resolveSocialDescription,
  resolveSocialTitle,
  resolveTitle,
  resolveUrl,
} from './fallback';

/**
 * Shared standard-card resolution pipeline.
 *
 * Six of eight platforms (Discord, Slack, Facebook, LinkedIn, WhatsApp, Telegram)
 * share the same linear path: resolve URL → title → optional description → optional
 * chrome fields → first safe image → layout / no-image policy. Per-platform variation
 * is data — field-source chains, layout, and no-image behavior via `StandardCardConfig`.
 * Google and X stay bespoke.
 *
 * Pure over PageMetadata; no DOM, no extension APIs. Must never throw.
 * Title and description are returned full; CSS line-clamp is the sole truncation.
 */

/** Title field sources. */
export type TitleSource =
  | 'og' // og:title only
  | 'og+twitter' // og → twitter (no html) — Slack/Discord/Telegram
  | 'chain'; // og → twitter → html — WhatsApp, Facebook, LinkedIn

/** Description field sources. */
export type DescriptionSource =
  | 'og'
  | 'og+twitter' // og → twitter (no meta description)
  | 'chain' // og → twitter → meta description
  | 'none';

/**
 * No usable image policy:
 * - `rich` — keep media-less rich card (WhatsApp, FB/LI text-only). Default.
 * - `unfurl-or-link` — if resolved title/description body is non-empty → rich;
 *   otherwise plain-link (Slack/Discord/Telegram dual gate).
 */
export type NoImagePolicy = 'rich' | 'unfurl-or-link';

export interface StandardCardConfig {
  titleSource: TitleSource;
  descriptionSource: DescriptionSource;
  imageCandidates: 'og' | 'og+twitter';
  layout:
    | { mode: 'width'; minWidth: number }
    | { mode: 'fixed'; value: 'large' | 'thumbnail' };
  linkUrl: boolean;
  siteName: 'none' | 'resolve' | 'strip-www';
  favicon: boolean;
  /** Default `'rich'`. */
  noImage?: NoImagePolicy;
}

function resolveConfiguredTitle(
  meta: PageMetadata,
  source: TitleSource,
): string {
  if (source === 'og') return firstNonBlank(meta.ogTitle);
  if (source === 'og+twitter') return resolveSocialTitle(meta);
  return resolveTitle(meta);
}

function resolveConfiguredDescription(
  meta: PageMetadata,
  source: DescriptionSource,
): string | undefined {
  if (source === 'none') return undefined;
  let raw: string;
  if (source === 'og') {
    raw = firstNonBlank(meta.ogDescription);
  } else if (source === 'og+twitter') {
    raw = resolveSocialDescription(meta);
  } else {
    raw = resolveDescription(meta);
  }
  return raw || undefined;
}

export function resolveStandardCard(
  meta: PageMetadata,
  config: StandardCardConfig,
): PlatformCard {
  const url = resolveUrl(meta);
  const title = resolveConfiguredTitle(meta, config.titleSource);
  const description = resolveConfiguredDescription(
    meta,
    config.descriptionSource,
  );
  const image =
    config.imageCandidates === 'og'
      ? firstSafeImage(...meta.ogImages)
      : resolveImage(meta);

  // Dual-gate plain-link: no image + empty resolved body → minimal URL-only card.
  // Gate follows config title/description sources (not a parallel social-text oracle).
  const policy = config.noImage ?? 'rich';
  if (
    image === undefined &&
    policy === 'unfurl-or-link' &&
    title === '' &&
    description === undefined
  ) {
    return {
      title: '',
      imageLayout: 'none',
      displayUrl: hostnameOf(url),
      linkUrl: url,
      presentation: 'plain-link',
    };
  }

  const card: PlatformCard = {
    title,
    imageLayout: 'none',
    displayUrl: hostnameOf(url),
  };

  if (config.linkUrl) {
    card.linkUrl = url;
  }

  if (config.siteName === 'resolve') {
    card.siteName = resolveSiteName(meta);
  } else if (config.siteName === 'strip-www') {
    const siteName = resolveSiteName(meta);
    card.siteName = siteName.startsWith('www.') ? siteName.slice(4) : siteName;
  }

  if (config.favicon) {
    card.faviconUrl = isSafeUrl(meta.favicon) ? meta.favicon : undefined;
  }

  if (description !== undefined) card.description = description;

  if (image !== undefined) {
    card.image = { url: image.url, width: image.width, height: image.height };
    card.imageLayout =
      config.layout.mode === 'width'
        ? layoutForWidth(image.width, config.layout.minWidth)
        : config.layout.value;
  }

  return card;
}
