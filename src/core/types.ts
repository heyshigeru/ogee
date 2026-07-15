/**
 * The frozen core data contract (SPEC §6).
 *
 * Every platform module and worktree depends on these types. This file is pure
 * type definitions — no runtime code. Type-only imports are allowed because they
 * are erased at compile time, so core/ still carries zero runtime dependency on
 * Svelte — see ADR-0004.
 */

import type { Component } from 'svelte';

/** Raw, normalized metadata extracted once from the live DOM (page context). */
export interface PageMetadata {
  // Open Graph
  ogTitle?: string;
  ogDescription?: string;
  ogImages: ImageRef[]; // document order; [0] is the primary image
  ogUrl?: string;
  ogSiteName?: string;
  ogType?: string;
  // Twitter
  twitterCard?: string; // 'summary' | 'summary_large_image' | 'app' | 'player'
  twitterTitle?: string;
  twitterDescription?: string;
  twitterImage?: ImageRef;
  // Standard / fallback sources
  htmlTitle?: string; // <title>
  metaDescription?: string; // meta[name="description"]
  canonical?: string; // link[rel="canonical"]
  favicon?: string; // best icon, absolute URL
  themeColor?: string; // meta[name="theme-color"] (extracted; no platform consumes it — P2-D2)
  // Context
  pageUrl: string; // document URL; always present
}

export interface ImageRef {
  url: string; // absolute
  alt?: string;
  width?: number; // from og:image:width if declared
  height?: number; // from og:image:height if declared
}

export type ImageLayout = 'large' | 'thumbnail' | 'none';

/**
 * Content mode for a platform row. Omit or `'rich'` for the normal card/unfurl.
 * `'plain-link'` means URL-only content (requires `linkUrl`). Chrome is per-card:
 * X is bare; Slack/Discord/Telegram keep message chrome without embed/unfurl.
 * Facebook/LinkedIn use text-only rich cards instead of plain-link.
 */
export type CardPresentation = 'rich' | 'plain-link';

/** Platform-resolved view, ready to render. Theme-agnostic. */
export interface PlatformCard {
  title: string;
  description?: string; // omitted when the platform hides description
  /**
   * Resolved safe image. `url` is the usable image; `width`/`height` are the
   * page-declared og:image:width/height intrinsic dimensions, carried so
   * native-ratio cards can reserve layout space before decode (a lone
   * dimension cannot establish a ratio).
   */
  image?: { url: string; width?: number; height?: number };
  imageLayout: ImageLayout;
  displayUrl: string; // domain / breadcrumb as the platform shows it
  linkUrl?: string; // full resolved URL; chat-message cards (e.g. WhatsApp) show it as the pasted-link line
  /** Omit ≡ rich. `'plain-link'` = URL-only content (`linkUrl` required). */
  presentation?: CardPresentation;
  siteName?: string;
  faviconUrl?: string;
}

export type PlatformId =
  | 'x'
  | 'facebook'
  | 'linkedin'
  | 'slack'
  | 'discord'
  | 'google'
  | 'whatsapp'
  | 'telegram';

export interface PlatformDefinition {
  id: PlatformId;
  name: string; // display label in UI + settings
  resolve(meta: PageMetadata): PlatformCard;
  Component: Component<{ card: PlatformCard }>;
}
