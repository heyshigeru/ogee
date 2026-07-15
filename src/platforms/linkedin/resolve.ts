import type { PageMetadata, PlatformCard } from '../../core/types';
import {
  resolveStandardCard,
  type StandardCardConfig,
} from '../../core/resolve-standard';

/**
 * LinkedIn link-preview resolver. Pure over PageMetadata; no extension APIs.
 *
 * - Title: og → twitter → html (html fallback when og missing).
 * - Description: never shown.
 * - Image: og only; fixed 128×72 left thumbnail when present.
 * - No usable OG image → text-only card (title + domain).
 */

const CONFIG: StandardCardConfig = {
  titleSource: 'chain',
  descriptionSource: 'none',
  imageCandidates: 'og',
  layout: { mode: 'fixed', value: 'thumbnail' },
  linkUrl: false,
  siteName: 'none',
  favicon: false,
};

export function resolve(meta: PageMetadata): PlatformCard {
  return resolveStandardCard(meta, CONFIG);
}
