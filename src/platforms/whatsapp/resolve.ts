import type { PageMetadata, PlatformCard } from '../../core/types';
import {
  resolveStandardCard,
  type StandardCardConfig,
} from '../../core/resolve-standard';

/**
 * WhatsApp link-preview resolver. Pure over PageMetadata; no extension APIs.
 *
 * - Title/description: og → twitter → html/meta (wider than Slack/Discord/TG).
 * - Image: og → twitter; fixed large on top when present.
 * - No usable image → media-less rich preview (title + domain + link), not plain-link.
 */

const CONFIG: StandardCardConfig = {
  titleSource: 'chain',
  descriptionSource: 'chain',
  imageCandidates: 'og+twitter',
  layout: { mode: 'fixed', value: 'large' },
  linkUrl: true,
  siteName: 'none',
  favicon: false,
};

export function resolve(meta: PageMetadata): PlatformCard {
  return resolveStandardCard(meta, CONFIG);
}
