// @vitest-environment node
import { describe, it, expect, afterEach, vi } from 'vitest';
import { classifyInjectionFailure, extractFromActiveTab } from './extraction';
import type { PageMetadata } from '../core/types';

const sampleMeta: PageMetadata = {
  pageUrl: 'https://example.com/',
  ogImages: [],
  ogTitle: 'Hello',
};

function stubChrome(opts: {
  tabs?: unknown[];
  executeScript?: ReturnType<typeof vi.fn>;
}) {
  const executeScript =
    opts.executeScript ?? vi.fn().mockResolvedValue([{ result: sampleMeta }]);
  const query = vi.fn().mockResolvedValue(opts.tabs ?? []);
  vi.stubGlobal('chrome', {
    tabs: { query },
    scripting: { executeScript },
  });
  return { query, executeScript };
}

describe('extraction — extractFromActiveTab', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('returns loaded meta on successful injection', async () => {
    stubChrome({
      tabs: [{ id: 1, url: 'https://example.com/' }],
    });
    const result = await extractFromActiveTab();
    expect(result).toEqual({ status: 'loaded', meta: sampleMeta });
  });

  it('returns blocked when there is no active tab and never injects', async () => {
    const { executeScript } = stubChrome({ tabs: [] });
    const result = await extractFromActiveTab();
    expect(result).toEqual({ status: 'blocked' });
    expect(executeScript).not.toHaveBeenCalled();
  });

  it('returns blocked when the tab has no id and never injects', async () => {
    const { executeScript } = stubChrome({
      tabs: [{ url: 'https://example.com/' }],
    });
    const result = await extractFromActiveTab();
    expect(result).toEqual({ status: 'blocked' });
    expect(executeScript).not.toHaveBeenCalled();
  });

  it('returns blocked when the injection result array is empty', async () => {
    stubChrome({
      tabs: [{ id: 1, url: 'https://example.com/' }],
      executeScript: vi.fn().mockResolvedValue([]),
    });
    const result = await extractFromActiveTab();
    expect(result).toEqual({ status: 'blocked' });
  });

  it('returns blocked when executeScript rejects with a Cannot access error', async () => {
    stubChrome({
      tabs: [{ id: 1, url: 'https://example.com/doc.pdf' }],
      executeScript: vi
        .fn()
        .mockRejectedValue(new Error('Cannot access contents of the page.')),
    });
    const result = await extractFromActiveTab();
    expect(result).toEqual({ status: 'blocked' });
  });

  it('returns blocked via URL classification for chromewebstore when error text is unrecognized', async () => {
    stubChrome({
      tabs: [
        {
          id: 1,
          url: 'https://chromewebstore.google.com/detail/foo',
        },
      ],
      executeScript: vi
        .fn()
        .mockRejectedValue(new Error('Une erreur inattendue')),
    });
    const result = await extractFromActiveTab();
    expect(result).toEqual({ status: 'blocked' });
  });

  it('returns error for an ordinary https URL when error text is unrecognized', async () => {
    stubChrome({
      tabs: [{ id: 1, url: 'https://example.com/page' }],
      executeScript: vi
        .fn()
        .mockRejectedValue(new Error('Une erreur inattendue')),
    });
    const result = await extractFromActiveTab();
    expect(result).toEqual({ status: 'error' });
  });
});

describe('classifyInjectionFailure', () => {
  const unrelated = 'Something went wrong';

  it.each([
    // Restricted schemes
    {
      name: 'chrome: scheme',
      tabUrl: 'chrome://settings',
      errorMessage: unrelated,
      expected: 'blocked' as const,
    },
    {
      name: 'chrome-extension: scheme',
      tabUrl: 'chrome-extension://abcdefghijklmnopqrstuvwxyz/page.html',
      errorMessage: unrelated,
      expected: 'blocked' as const,
    },
    {
      name: 'devtools: scheme',
      tabUrl: 'devtools://devtools/bundled/inspector.html',
      errorMessage: unrelated,
      expected: 'blocked' as const,
    },
    {
      name: 'view-source: scheme',
      tabUrl: 'view-source:https://example.com/',
      errorMessage: unrelated,
      expected: 'blocked' as const,
    },
    {
      name: 'about: scheme',
      tabUrl: 'about:blank',
      errorMessage: unrelated,
      expected: 'blocked' as const,
    },
    {
      name: 'edge: scheme',
      tabUrl: 'edge://settings',
      errorMessage: unrelated,
      expected: 'blocked' as const,
    },
    {
      name: 'chrome-untrusted: scheme',
      tabUrl: 'chrome-untrusted://new-tab-page/',
      errorMessage: unrelated,
      expected: 'blocked' as const,
    },
    // Webstore hosts
    {
      name: 'chromewebstore.google.com host',
      tabUrl: 'https://chromewebstore.google.com/detail/foo',
      errorMessage: unrelated,
      expected: 'blocked' as const,
    },
    {
      name: 'chrome.google.com/webstore path',
      tabUrl: 'https://chrome.google.com/webstore/detail/foo',
      errorMessage: unrelated,
      expected: 'blocked' as const,
    },
    // Error-message markers on otherwise injectable https URLs
    {
      name: 'https URL with Cannot access message',
      tabUrl: 'https://example.com/doc.pdf',
      errorMessage: 'Cannot access contents of the page.',
      expected: 'blocked' as const,
    },
    {
      name: 'https URL with chrome:// in message',
      tabUrl: 'https://example.com/page',
      errorMessage: 'Cannot access a chrome:// URL',
      expected: 'blocked' as const,
    },
    {
      name: 'https URL with chrome-extension:// in message',
      tabUrl: 'https://example.com/page',
      errorMessage: 'Cannot access a chrome-extension:// URL',
      expected: 'blocked' as const,
    },
    // Not blocked
    {
      name: 'https URL with unrelated message',
      tabUrl: 'https://example.com/page',
      errorMessage: unrelated,
      expected: 'error' as const,
    },
    {
      name: 'undefined tabUrl with unrelated message',
      tabUrl: undefined,
      errorMessage: unrelated,
      expected: 'error' as const,
    },
    // Unparseable URL falls through to message check
    {
      name: 'unparseable tabUrl with unrelated message',
      tabUrl: 'not a url',
      errorMessage: unrelated,
      expected: 'error' as const,
    },
    {
      name: 'unparseable tabUrl with blocked message',
      tabUrl: 'not a url',
      errorMessage: 'Cannot access contents of the page.',
      expected: 'blocked' as const,
    },
  ])('$name → $expected', ({ tabUrl, errorMessage, expected }) => {
    expect(classifyInjectionFailure(tabUrl, errorMessage)).toBe(expected);
  });
});
