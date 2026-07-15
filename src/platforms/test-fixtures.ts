import type { PageMetadata } from '../core/types';

/** Minimal PageMetadata fixture: only pageUrl and ogImages are required. */
export function pageMetadata(
  overrides: Partial<PageMetadata> = {},
): PageMetadata {
  return {
    ogImages: [],
    pageUrl: 'https://www.example.com/some/path',
    ...overrides,
  };
}
