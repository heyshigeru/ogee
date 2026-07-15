import type { PageMetadata, PlatformCard } from '../../core/types';
import {
  resolveStandardCard,
  type StandardCardConfig,
} from '../../core/resolve-standard';

/**
 * Facebook feed card resolver. Pure over PageMetadata; no extension APIs.
 *
 * - Title: og → twitter → html (user-verified html fallback, e.g. amicro).
 * - Description: never shown on real feed cards.
 * - Image: og only (does not use twitter:image).
 * - Layout: width ≥600 or undefined → large; narrower → thumbnail.
 * - No usable OG image → text-only card (domain + title).
 */

const FACEBOOK_LARGE_MIN_WIDTH = 600;

const CONFIG: StandardCardConfig = {
  titleSource: 'chain',
  descriptionSource: 'none',
  imageCandidates: 'og',
  layout: { mode: 'width', minWidth: FACEBOOK_LARGE_MIN_WIDTH },
  linkUrl: false,
  siteName: 'none',
  favicon: false,
};

export function resolve(meta: PageMetadata): PlatformCard {
  return resolveStandardCard(meta, CONFIG);
}
