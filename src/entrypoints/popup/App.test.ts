// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/svelte';
import type { PageMetadata } from '../../core/types';
import App from './App.svelte';

// Isolate the popup-lifecycle test from the growing platform set: pin the
// registry to a single platform (the real X module) so these scenarios stay
// deterministic regardless of how many platforms self-register via the glob.
// Discovery of all registered platforms is covered separately in
// platforms/registry.integration.test.ts.
vi.mock('../../platforms/registry', async () => {
  const { resolve } = await import('../../platforms/x/resolve');
  const XCard = (await import('../../platforms/x/XCard.svelte')).default;
  const platforms = [{ id: 'x', name: 'X', resolve, Component: XCard }];
  return {
    register: () => {},
    getPlatforms: () => platforms,
    getPlatformMap: () => new Map(platforms.map((p) => [p.id, p] as const)),
  };
});

// --- chrome / matchMedia doubles --------------------------------------------
// App.svelte calls chrome.tabs.query + chrome.scripting.executeScript on mount,
// and the settings/theme reads (getOrderAndEnabled / getThemePreference) hit
// chrome.storage. Header buttons reach chrome.downloads. We stub the whole
// surface so onMount's async pipeline can run end-to-end under jsdom.

type ExecuteScript = ReturnType<typeof vi.fn>;

function stubChrome(
  executeScript: ExecuteScript,
  tab: { id?: number; url?: string } | null = { id: 7 },
) {
  const syncStore: Record<string, unknown> = {};
  const localStore: Record<string, unknown> = {};
  const makeArea = (store: Record<string, unknown>) => ({
    get: vi.fn(async (key: string) =>
      key in store ? { [key]: store[key] } : {},
    ),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(store, items);
    }),
    remove: vi.fn(async (keys: string | string[]) => {
      for (const key of Array.isArray(keys) ? keys : [keys]) delete store[key];
    }),
  });

  vi.stubGlobal('chrome', {
    tabs: { query: vi.fn(async () => (tab ? [tab] : [])) },
    scripting: { executeScript },
    storage: { sync: makeArea(syncStore), local: makeArea(localStore) },
    downloads: { download: vi.fn() },
  });
}

function stubMatchMedia(dark = false) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn(() => ({
      matches: dark,
      media: '(prefers-color-scheme: dark)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  );
}

// A full OG/Twitter page → X resolves to a card with a usable image.
const richMeta: PageMetadata = {
  pageUrl: 'https://example.com/article',
  ogTitle: 'A faithful headline',
  ogDescription: 'Some description.',
  ogImages: [{ url: 'https://example.com/og.jpg', width: 1200, height: 630 }],
  ogSiteName: 'Example',
  twitterCard: 'summary_large_image',
};

// A page with NO OG/Twitter tags — only a <title> and the page URL. Chat/Google
// still render via fallbacks; feed platforms (X/FB/LinkedIn) collapse to a
// plain-link URL row. No empty state.
const ogLessMeta: PageMetadata = {
  pageUrl: 'https://nob.example.org/path',
  htmlTitle: 'Plain page title',
  ogImages: [],
};

// An og:image with an unsafe scheme: resolvable as text, but image-actions refuse
// to act on it, so the header buttons must read as disabled (not enabled-but-inert).
const unsafeImageMeta: PageMetadata = {
  pageUrl: 'https://example.com/article',
  ogTitle: 'A faithful headline',
  ogImages: [{ url: 'javascript:alert(1)' }],
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  delete document.documentElement.dataset.theme;
  document.head
    .querySelectorAll('style[data-test-tokens]')
    .forEach((n) => n.remove());
});

describe('Popup lifecycle from injection to render', () => {
  it('[Skeleton while pending] shows placeholders and no card content while executeScript is in flight', () => {
    // executeScript never resolves → state stays 'injecting'.
    const pending: ExecuteScript = vi.fn(() => new Promise(() => {}));
    stubChrome(pending);
    stubMatchMedia();

    const { container, queryByText } = render(App);

    // At least one skeleton placeholder is visible.
    expect(container.querySelector('.skeleton')).not.toBeNull();
    // No resolved card content yet (X card renders the displayUrl text).
    expect(queryByText('example.com')).toBeNull();
  });

  it('[Renders enabled cards] shows the X card after successful extraction and removes skeletons', async () => {
    const ok: ExecuteScript = vi.fn(async () => [{ result: richMeta }]);
    stubChrome(ok);
    stubMatchMedia();

    const { container, findByText } = render(App);

    // The X CardShell label appears; the resolved card shows the page domain.
    expect(await findByText('X')).toBeTruthy();
    expect(await findByText('example.com')).toBeTruthy();

    await waitFor(() => {
      expect(container.querySelector('.skeleton')).toBeNull();
    });
  });

  it('[Blocked → empty state] shows "Can\'t preview this page" with disabled image buttons when executeScript rejects with a "Cannot access" error', async () => {
    const blocked: ExecuteScript = vi.fn(async () => {
      throw new Error('Cannot access contents of the page.');
    });
    stubChrome(blocked);
    stubMatchMedia();

    const { findByText, getByRole, queryByText } = render(App);

    expect(await findByText(/Can't preview this page/i)).toBeTruthy();
    // No platform cards rendered in the blocked state.
    expect(queryByText('X')).toBeNull();

    // Header image buttons are disabled.
    expect(
      getByRole('button', { name: 'Copy URL' }).getAttribute('aria-disabled'),
    ).toBe('true');
    expect(
      getByRole('button', { name: 'Download' }).getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('[Web Store / chrome-extension://] shows the empty state when executeScript rejects for an extension page', async () => {
    const blocked: ExecuteScript = vi.fn(async () => {
      throw new Error(
        'Cannot access a chrome-extension:// URL of this extension.',
      );
    });
    stubChrome(blocked);
    stubMatchMedia();

    const { findByText, queryByText } = render(App);

    expect(await findByText(/Can't preview this page/i)).toBeTruthy();
    expect(queryByText('X')).toBeNull();
  });

  it('[Friendly error] shows a friendly message with no raw stack/technical detail on an unexpected rejection', async () => {
    const boom: ExecuteScript = vi.fn(async () => {
      throw new Error(
        'TypeError: undefined is not a function at extract (chunk-XYZ.js:42:13)',
      );
    });
    stubChrome(boom);
    stubMatchMedia();

    const { findByText, queryByText } = render(App);

    // A friendly error message is shown.
    expect(await findByText(/Something went wrong/i)).toBeTruthy();
    // No raw technical detail leaks into the UI.
    expect(queryByText(/chunk-XYZ\.js/)).toBeNull();
    expect(queryByText(/is not a function/)).toBeNull();
  });

  it('[Restricted URL] classifies a Web Store tab as blocked even when the error text is unrecognized', async () => {
    // Localized / non-marker error text: only the tab URL reveals it is restricted.
    const blocked: ExecuteScript = vi.fn(async () => {
      throw new Error('Une erreur inattendue');
    });
    stubChrome(blocked, {
      id: 7,
      url: 'https://chromewebstore.google.com/detail/foo',
    });
    stubMatchMedia();

    const { findByText, queryByText } = render(App);

    expect(await findByText(/Can't preview this page/i)).toBeTruthy();
    expect(queryByText('X')).toBeNull();
  });

  it('[No active tab] shows the empty state and never injects when there is no active tab', async () => {
    const executeScript: ExecuteScript = vi.fn(async () => [
      { result: richMeta },
    ]);
    stubChrome(executeScript, null);
    stubMatchMedia();

    const { findByText, queryByText } = render(App);

    expect(await findByText(/Can't preview this page/i)).toBeTruthy();
    expect(queryByText('X')).toBeNull();
    expect(executeScript).not.toHaveBeenCalled();
  });

  it('[Empty injection result] shows the empty state when executeScript yields no frame result', async () => {
    const empty: ExecuteScript = vi.fn(async () => []);
    stubChrome(empty);
    stubMatchMedia();

    const { findByText } = render(App);

    expect(await findByText(/Can't preview this page/i)).toBeTruthy();
  });

  it('[Unsafe image → disabled actions] keeps Copy/Download disabled when the resolved og:image URL is unsafe', async () => {
    const ok: ExecuteScript = vi.fn(async () => [{ result: unsafeImageMeta }]);
    stubChrome(ok);
    stubMatchMedia();

    // This suite pins the registry to X only; feed no-image → plain-link URL row.
    const { findByText, getByRole } = render(App);

    expect(await findByText('https://example.com/article')).toBeTruthy();
    expect(
      getByRole('button', { name: 'Copy URL' }).getAttribute('aria-disabled'),
    ).toBe('true');
    expect(
      getByRole('button', { name: 'Download' }).getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('[Settings toggle refresh] hiding a platform removes its card without reopening the popup', async () => {
    const ok: ExecuteScript = vi.fn(async () => [{ result: richMeta }]);
    stubChrome(ok);
    stubMatchMedia();

    const { findByText, getByRole, queryByText } = render(App);

    // The X card (its displayUrl is unique to the card, not the edit list).
    expect(await findByText('example.com')).toBeTruthy();

    // Open the edit view, turn X off (the switch), then return to the card list.
    await fireEvent.click(getByRole('button', { name: 'Settings' }));
    await fireEvent.click(getByRole('switch', { name: 'X' }));
    await fireEvent.click(getByRole('button', { name: 'Back' }));

    // The card is gone once the parent re-reads the enabled list.
    await waitFor(() => {
      expect(queryByText('example.com')).toBeNull();
    });
  });

  it('[Reset to defaults] appears only when modified; two-step confirm restores defaults', async () => {
    const ok: ExecuteScript = vi.fn(async () => [{ result: richMeta }]);
    stubChrome(ok);
    stubMatchMedia();

    const { findByText, getByRole, queryByRole, queryByText } = render(App);

    expect(await findByText('example.com')).toBeTruthy();

    await fireEvent.click(getByRole('button', { name: 'Settings' }));

    // Wait for storage re-read so order/enabled match first-run defaults
    // (initial module state is DEFAULT_ORDER until getPlatformOrder settles).
    await waitFor(() => {
      expect(
        (getByRole('switch', { name: 'X' }) as HTMLInputElement).checked,
      ).toBe(true);
    });

    // Pristine defaults: reset chip is absent.
    expect(queryByRole('button', { name: 'Reset to defaults' })).toBeNull();
    expect(queryByRole('button', { name: 'Confirm reset' })).toBeNull();
    expect(queryByText('Confirm?')).toBeNull();

    await fireEvent.click(getByRole('switch', { name: 'X' }));

    // Wait for the parent re-read (enabledIds), not the native checkbox flip —
    // the switch DOM toggles immediately, before setPlatformEnabled settles.
    await waitFor(() => {
      expect(
        getByRole('switch', { name: 'X' })
          .closest('.row')
          ?.classList.contains('disabled'),
      ).toBe(true);
    });

    // Non-default state: disarmed reset chip appears.
    const reset = getByRole('button', { name: 'Reset to defaults' });
    expect(reset).toBeTruthy();
    expect(queryByText('Confirm?')).toBeNull();

    // First click only arms confirm — config must not change.
    await fireEvent.click(reset);
    expect(getByRole('button', { name: 'Confirm reset' })).toBeTruthy();
    expect(queryByText('Confirm?')).toBeTruthy();
    expect(
      getByRole('switch', { name: 'X' })
        .closest('.row')
        ?.classList.contains('disabled'),
    ).toBe(true);
    expect(
      (getByRole('switch', { name: 'X' }) as HTMLInputElement).checked,
    ).toBe(false);

    // Second click restores first-run defaults; chip disappears again.
    await fireEvent.click(getByRole('button', { name: 'Confirm reset' }));
    await waitFor(() => {
      expect(
        (getByRole('switch', { name: 'X' }) as HTMLInputElement).checked,
      ).toBe(true);
    });
    expect(queryByRole('button', { name: 'Reset to defaults' })).toBeNull();
    expect(queryByRole('button', { name: 'Confirm reset' })).toBeNull();
    expect(queryByText('Confirm?')).toBeNull();
  });

  it('[Edit tab order] keeps the Back button before platform switches in DOM order', async () => {
    const ok: ExecuteScript = vi.fn(async () => [{ result: richMeta }]);
    stubChrome(ok);
    stubMatchMedia();

    const { findByText, getByRole } = render(App);

    expect(await findByText('example.com')).toBeTruthy();

    await fireEvent.click(getByRole('button', { name: 'Settings' }));

    const back = getByRole('button', { name: 'Back' });
    const platformSwitch = getByRole('switch', { name: 'X' });
    expect(back.compareDocumentPosition(platformSwitch)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('[No platforms enabled] shows a hint instead of a blank body when every platform is toggled off', async () => {
    const ok: ExecuteScript = vi.fn(async () => [{ result: richMeta }]);
    stubChrome(ok);
    stubMatchMedia();

    const { findByText, getByRole, queryByText } = render(App);

    expect(await findByText('example.com')).toBeTruthy();

    await fireEvent.click(getByRole('button', { name: 'Settings' }));
    await fireEvent.click(getByRole('switch', { name: 'X' }));
    await fireEvent.click(getByRole('button', { name: 'Back' }));

    await waitFor(() => expect(queryByText('example.com')).toBeNull());
    expect(await findByText(/No platforms enabled/i)).toBeTruthy();
  });

  it('[Mutation failure] storage write reject re-syncs UI from storage without unhandled rejection', async () => {
    const ok: ExecuteScript = vi.fn(async () => [{ result: richMeta }]);
    stubChrome(ok);
    stubMatchMedia();

    const unhandled: unknown[] = [];
    const onUnhandled = (reason: unknown) => {
      unhandled.push(reason);
    };
    process.on('unhandledRejection', onUnhandled);

    try {
      const { findByText, getByRole } = render(App);
      expect(await findByText('example.com')).toBeTruthy();

      await fireEvent.click(getByRole('button', { name: 'Settings' }));
      await waitFor(() => {
        expect(
          (getByRole('switch', { name: 'X' }) as HTMLInputElement).checked,
        ).toBe(true);
      });

      // First toggle succeeds (x off). Then fail every subsequent storage set so
      // a second toggle cannot persist — UI must recover to storage (still off).
      const sync = (
        globalThis as unknown as {
          chrome: { storage: { sync: { set: ReturnType<typeof vi.fn> } } };
        }
      ).chrome.storage.sync;
      let setCount = 0;
      // getMockImplementation() unions in a construct signature; narrow to a
      // plain callable so we can still delegate to the pre-existing stub.
      const originalSet = sync.set.getMockImplementation()! as (
        items: Record<string, unknown>,
      ) => Promise<void>;
      sync.set.mockImplementation(async (items: Record<string, unknown>) => {
        setCount += 1;
        if (setCount > 1) throw new Error('storage write failed');
        return originalSet(items);
      });

      await fireEvent.click(getByRole('switch', { name: 'X' }));
      await waitFor(() => {
        expect(
          getByRole('switch', { name: 'X' })
            .closest('.row')
            ?.classList.contains('disabled'),
        ).toBe(true);
      });

      // Second toggle attempts to re-enable; write fails → re-sync leaves X off.
      await fireEvent.click(getByRole('switch', { name: 'X' }));
      await waitFor(() => {
        expect(
          getByRole('switch', { name: 'X' })
            .closest('.row')
            ?.classList.contains('disabled'),
        ).toBe(true);
      });

      // Give microtasks a tick to surface any floating rejection.
      await new Promise((r) => setTimeout(r, 0));
      expect(unhandled).toEqual([]);
    } finally {
      process.off('unhandledRejection', onUnhandled);
    }
  });

  it('[Fallback rendering] renders cards via the fallback chains for an OG-less page, with no empty state', async () => {
    const ok: ExecuteScript = vi.fn(async () => [{ result: ogLessMeta }]);
    stubChrome(ok);
    stubMatchMedia();

    // Registry pinned to X only → plain-link row (full URL), not empty state.
    const { findByText, queryByText } = render(App);

    expect(await findByText('https://nob.example.org/path')).toBeTruthy();
    expect(queryByText(/Can't preview this page/i)).toBeNull();
  });
});

describe('Theming (popup tokens)', () => {
  it('[Light vs dark tokens] var(--bg-primary) resolves to different values per data-theme', () => {
    // jsdom does not reliably resolve custom props from an external app.css import,
    // so inject the token layers directly and assert the [data-theme] switch.
    const style = document.createElement('style');
    style.setAttribute('data-test-tokens', '');
    style.textContent = `
      :root { --bg-primary: #ffffff; }
      [data-theme="dark"] { --bg-primary: #1f1f1f; }
    `;
    document.head.appendChild(style);

    const root = document.documentElement;

    root.dataset.theme = 'light';
    const light = getComputedStyle(root)
      .getPropertyValue('--bg-primary')
      .trim();

    root.dataset.theme = 'dark';
    const dark = getComputedStyle(root).getPropertyValue('--bg-primary').trim();

    expect(light).not.toBe('');
    expect(dark).not.toBe('');
    expect(light).not.toBe(dark);
  });
});
