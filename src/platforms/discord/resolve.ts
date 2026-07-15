import type { PageMetadata, PlatformCard } from '../../core/types';
import {
  resolveStandardCard,
  type StandardCardConfig,
} from '../../core/resolve-standard';

/**
 * Discord embed resolver. Pure over PageMetadata; no extension APIs.
 *
 * Field rules (user-verified 2026-07-13):
 * - Title/description: og → twitter only (html must not create an unfurl — amicro).
 * - Image: og → twitter; layout width ≥400 or undefined → large.
 * - No image + OG/Twitter text → media-less embed; no image + no social text →
 *   plain-link (message chrome + URL only).
 */

const DISCORD_LARGE_MIN_WIDTH = 400;

const CONFIG: StandardCardConfig = {
  titleSource: 'og+twitter',
  descriptionSource: 'og+twitter',
  imageCandidates: 'og+twitter',
  layout: { mode: 'width', minWidth: DISCORD_LARGE_MIN_WIDTH },
  linkUrl: true,
  siteName: 'resolve',
  favicon: false,
  noImage: 'unfurl-or-link',
};

export function resolve(meta: PageMetadata): PlatformCard {
  return resolveStandardCard(meta, CONFIG);
}
