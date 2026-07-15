import type { PageMetadata, PlatformCard } from '../../core/types';
import {
  resolveStandardCard,
  type StandardCardConfig,
} from '../../core/resolve-standard';

/**
 * Slack unfurl resolver. Pure over PageMetadata; no extension APIs.
 *
 * Field rules (user-verified 2026-07-13):
 * - Title/description: og → twitter only (html alone does not unfurl — amicro).
 * - Image: og → twitter; layout width ≥360 or undefined → large.
 * - No image + OG/Twitter text → media-less unfurl; no image + no social text →
 *   plain-link (message chrome + URL only).
 * - Favicon when rich (gated by isSafeUrl).
 */

const SLACK_LARGE_MIN_WIDTH = 360;

const CONFIG: StandardCardConfig = {
  titleSource: 'og+twitter',
  descriptionSource: 'og+twitter',
  imageCandidates: 'og+twitter',
  layout: { mode: 'width', minWidth: SLACK_LARGE_MIN_WIDTH },
  linkUrl: true,
  siteName: 'strip-www',
  favicon: true,
  noImage: 'unfurl-or-link',
};

export function resolve(meta: PageMetadata): PlatformCard {
  return resolveStandardCard(meta, CONFIG);
}
