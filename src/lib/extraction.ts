import type { PageMetadata } from '../core/types';
import { extract } from '../core/extract';

/**
 * On-demand metadata extraction from the active tab. Uses activeTab +
 * chrome.scripting.executeScript (no host_permissions, no persistent content
 * script — per the extension's spec). Classifies blocked pages from the tab
 * URL first so the result is locale- and Chrome-version-independent; Chrome's
 * error text is only a fallback for injectable-looking URLs that still reject
 * injection (e.g. the PDF viewer).
 */

export type ExtractionResult =
  | { status: 'loaded'; meta: PageMetadata }
  | { status: 'blocked' }
  | { status: 'error' };

export type InjectionFailureStatus = Exclude<
  ExtractionResult['status'],
  'loaded'
>;

// Schemes/hosts the scripting API can never inject into. Classifying from the
// tab URL is locale- and version-independent, unlike Chrome's error text.
const RESTRICTED_SCHEMES = new Set([
  'chrome:',
  'chrome-extension:',
  'devtools:',
  'view-source:',
  'about:',
  'edge:',
  'chrome-untrusted:',
]);

function isRestrictedUrl(url: string | undefined): boolean {
  if (url === undefined) return false;
  try {
    const { protocol, hostname, pathname } = new URL(url);
    if (RESTRICTED_SCHEMES.has(protocol)) return true;
    if (hostname === 'chromewebstore.google.com') return true;
    return hostname === 'chrome.google.com' && pathname.startsWith('/webstore');
  } catch {
    return false;
  }
}

// Fallback for injection failures on URLs that look injectable (e.g. the PDF
// viewer): Chrome's error markers. Combined with isRestrictedUrl above.
function isBlockedError(message: string): boolean {
  return (
    message.includes('Cannot access') ||
    message.includes('chrome://') ||
    message.includes('chrome-extension://')
  );
}

/** Exported pure classification entry point: folds isRestrictedUrl and isBlockedError into `'blocked'`, else `'error'`. */
export function classifyInjectionFailure(
  tabUrl: string | undefined,
  errorMessage: string,
): InjectionFailureStatus {
  return isRestrictedUrl(tabUrl) || isBlockedError(errorMessage)
    ? 'blocked'
    : 'error';
}

export async function extractFromActiveTab(): Promise<ExtractionResult> {
  let tabUrl: string | undefined;
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    tabUrl = tab?.url;
    if (!tab?.id) {
      return { status: 'blocked' };
    }
    const [injection] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extract,
    });
    if (!injection?.result) {
      return { status: 'blocked' };
    }
    return { status: 'loaded', meta: injection.result as PageMetadata };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return { status: classifyInjectionFailure(tabUrl, message) };
  }
}
