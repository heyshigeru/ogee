import type { PageMetadata, PlatformCard } from '../../core/types';
import {
  resolveStandardCard,
  type StandardCardConfig,
} from '../../core/resolve-standard';

/**
 * Telegram link-preview resolver. Pure over PageMetadata; no extension APIs.
 *
 * Field rules (user-verified 2026-07-13):
 * - Title/description: og → twitter only (html alone does not unfurl — amicro).
 * - Image: og → twitter; layout width ≥400 or undefined → large.
 * - No image + OG/Twitter text → media-less preview; no image + no social text →
 *   plain-link (bubble + URL only).
 */

const TELEGRAM_LARGE_MIN_WIDTH = 400;

const CONFIG: StandardCardConfig = {
  titleSource: 'og+twitter',
  descriptionSource: 'og+twitter',
  imageCandidates: 'og+twitter',
  layout: { mode: 'width', minWidth: TELEGRAM_LARGE_MIN_WIDTH },
  linkUrl: true,
  siteName: 'resolve',
  favicon: false,
  noImage: 'unfurl-or-link',
};

export function resolve(meta: PageMetadata): PlatformCard {
  return resolveStandardCard(meta, CONFIG);
}
