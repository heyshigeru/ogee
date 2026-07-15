// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, waitFor, fireEvent } from '@testing-library/svelte';
import type { PlatformDefinition, PlatformId } from '../core/types';
import { register } from '../platforms/registry';
import Header from './Header.svelte';
import EditView from './EditView.svelte';
import ThemeToggle from './ThemeToggle.svelte';
import IconActionButton from './IconActionButton.svelte';

// In-memory chrome.storage double for ThemeToggle (and any residual storage reads).
function stubChromeStorage() {
  const syncStore: Record<string, unknown> = {};
  const localStore: Record<string, unknown> = {};
  const makeArea = (store: Record<string, unknown>) => ({
    get: vi.fn(async (key: string) =>
      key in store ? { [key]: store[key] } : {},
    ),
    set: vi.fn(async (items: Record<string, unknown>) => {
      Object.assign(store, items);
    }),
  });
  vi.stubGlobal('chrome', {
    storage: { sync: makeArea(syncStore), local: makeArea(localStore) },
  });
}

function fakePlatform(id: PlatformId, name: string): PlatformDefinition {
  return {
    id,
    name,
    resolve: () => ({ title: '', imageLayout: 'none', displayUrl: '' }),
    Component: {} as PlatformDefinition['Component'],
  };
}

const fakeX = fakePlatform('x', 'X');
const fakeFacebook = fakePlatform('facebook', 'Facebook');
const fakeSlack = fakePlatform('slack', 'Slack');

describe('Shared UI behavior', () => {
  beforeEach(() => {
    stubChromeStorage();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('[Platform Visibility] EditView lists a labeled toggle reflecting the enabled list', () => {
    register(fakeX);

    const { getByLabelText } = render(EditView, {
      props: {
        order: ['x'],
        enabledIds: ['x'],
        onToggle: () => {},
        onReorder: () => {},
      },
    });

    const toggle = getByLabelText('X') as HTMLInputElement;
    expect(toggle).toBeTruthy();
    expect(toggle.checked).toBe(true);
  });

  it('[Platform Toggle] EditView reports the next state to the parent via onToggle', async () => {
    register(fakeX);
    const onToggle = vi.fn();

    const { getByLabelText } = render(EditView, {
      props: {
        order: ['x'],
        enabledIds: ['x'],
        onToggle,
        onReorder: () => {},
      },
    });

    await fireEvent.click(getByLabelText('X'));
    expect(onToggle).toHaveBeenCalledWith('x', false);
  });

  it('[Flat list] disabled platforms keep order position and only dim their name', () => {
    // Facebook is off but must stay between X and Slack — not re-sorted to the end.
    register(fakeX);
    register(fakeFacebook);
    register(fakeSlack);

    const { container, getByLabelText } = render(EditView, {
      props: {
        order: ['x', 'facebook', 'slack'],
        enabledIds: ['x', 'slack'],
        onToggle: () => {},
        onReorder: () => {},
      },
    });

    const names = Array.from(container.querySelectorAll('.name')).map(
      (el) => el.textContent,
    );
    expect(names).toEqual(['X', 'Facebook', 'Slack']);

    const facebook = getByLabelText('Facebook') as HTMLInputElement;
    expect(facebook.checked).toBe(false);

    const facebookRow = container.querySelector(
      'li[data-id="facebook"] .row',
    ) as HTMLElement;
    expect(facebookRow.classList.contains('disabled')).toBe(true);
  });

  it('[Theming] ThemeToggle highlights the stored preference (dark) on mount, not the System default', async () => {
    const syncStore: Record<string, unknown> = { theme: 'dark' };
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn(async (key: string) =>
            key in syncStore ? { [key]: syncStore[key] } : {},
          ),
          set: vi.fn(async () => {}),
        },
        local: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) },
      },
    });

    const { getByRole } = render(ThemeToggle);
    const dark = getByRole('button', { name: 'Dark' });
    const system = getByRole('button', { name: 'System' });

    await waitFor(() => expect(dark.getAttribute('aria-pressed')).toBe('true'));
    expect(system.getAttribute('aria-pressed')).toBe('false');
  });

  it('[Image Actions] Header disables Copy and Download when there is no usable image', () => {
    const { getByRole } = render(Header, {
      props: {
        hasImage: false,
        onCopy: () => {},
        onDownload: () => {},
        onOpenEdit: () => {},
      },
    });

    const copy = getByRole('button', { name: 'Copy URL' });
    const download = getByRole('button', { name: 'Download' });
    expect(copy.getAttribute('aria-disabled')).toBe('true');
    expect(download.getAttribute('aria-disabled')).toBe('true');
  });

  it('[Platform Visibility] reads as unchecked until the list is ready, avoiding a flicker-on', () => {
    register(fakeX);

    const { getByLabelText } = render(EditView, {
      props: {
        order: ['x'],
        enabledIds: ['x'],
        onToggle: () => {},
        onReorder: () => {},
        ready: false,
      },
    });

    expect((getByLabelText('X') as HTMLInputElement).checked).toBe(false);
  });

  // Pixel placement, floating lift, FLIP make-way animation, and cursor states
  // are browser-verified manually, not asserted here (jsdom zero-rects).
  it('[Pointer drag] threshold gates click vs onReorder', async () => {
    register(fakeX);
    register(fakeFacebook);
    const onToggle = vi.fn();
    const onReorder = vi.fn();

    const { getByLabelText, container } = render(EditView, {
      props: {
        order: ['x', 'facebook'],
        enabledIds: ['x', 'facebook'],
        onToggle,
        onReorder,
      },
    });

    const row = container.querySelector('li[data-id="x"] .row') as HTMLElement;
    expect(row).toBeTruthy();

    // (a) Sub-threshold pointer sequence must not suppress a real click on the switch.
    await fireEvent.pointerDown(row, {
      button: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 10,
      pointerType: 'mouse',
    });
    await fireEvent.pointerUp(row, {
      button: 0,
      pointerId: 1,
      clientX: 11,
      clientY: 11,
      pointerType: 'mouse',
    });
    await fireEvent.click(getByLabelText('X'));
    expect(onToggle).toHaveBeenCalledWith('x', false);
    expect(onReorder).not.toHaveBeenCalled();

    onToggle.mockClear();

    // (b) Past-threshold move commits via onReorder(movedId, …); placement args
    // are geometry-dependent and meaningless under jsdom zero-rects.
    await fireEvent.pointerDown(row, {
      button: 0,
      pointerId: 2,
      clientX: 10,
      clientY: 10,
      pointerType: 'mouse',
    });
    await fireEvent.pointerMove(window, {
      button: 0,
      pointerId: 2,
      clientX: 10,
      clientY: 30,
      pointerType: 'mouse',
    });
    await fireEvent.pointerUp(window, {
      button: 0,
      pointerId: 2,
      clientX: 10,
      clientY: 30,
      pointerType: 'mouse',
    });

    expect(onReorder).toHaveBeenCalled();
    expect(onReorder.mock.calls[0]![0]).toBe('x');
  });

  it('[Pointer drag] pointerdown on the switch does not arm drag', async () => {
    register(fakeX);
    register(fakeFacebook);
    const onToggle = vi.fn();
    const onReorder = vi.fn();

    const { getByLabelText } = render(EditView, {
      props: {
        order: ['x', 'facebook'],
        enabledIds: ['x', 'facebook'],
        onToggle,
        onReorder,
      },
    });

    const sw = getByLabelText('X');
    // Past-threshold move starting on the switch must not commit a reorder.
    await fireEvent.pointerDown(sw, {
      button: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 10,
      pointerType: 'mouse',
    });
    await fireEvent.pointerMove(window, {
      button: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 40,
      pointerType: 'mouse',
    });
    await fireEvent.pointerUp(window, {
      button: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 40,
      pointerType: 'mouse',
    });
    expect(onReorder).not.toHaveBeenCalled();

    // A real click on the switch still toggles.
    await fireEvent.click(sw);
    expect(onToggle).toHaveBeenCalledWith('x', false);
  });

  it('[Pointer drag] pointerdown on the reorder handle arms drag', async () => {
    register(fakeX);
    register(fakeFacebook);
    const onReorder = vi.fn();

    const { container } = render(EditView, {
      props: {
        order: ['x', 'facebook'],
        enabledIds: ['x', 'facebook'],
        onToggle: () => {},
        onReorder,
      },
    });

    const handle = container.querySelector(
      'li[data-id="x"] [data-reorder-handle]',
    ) as HTMLElement;
    expect(handle).toBeTruthy();

    await fireEvent.pointerDown(handle, {
      button: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 10,
      pointerType: 'mouse',
    });
    await fireEvent.pointerMove(window, {
      button: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 40,
      pointerType: 'mouse',
    });
    await fireEvent.pointerUp(window, {
      button: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 40,
      pointerType: 'mouse',
    });

    expect(onReorder).toHaveBeenCalled();
    expect(onReorder.mock.calls[0]![0]).toBe('x');
  });

  it('[Pointer drag] pointerdown on label.row-main (name area) arms drag and commits reorder', async () => {
    register(fakeX);
    register(fakeFacebook);
    const onReorder = vi.fn();

    const { container } = render(EditView, {
      props: {
        order: ['x', 'facebook'],
        enabledIds: ['x', 'facebook'],
        onToggle: () => {},
        onReorder,
      },
    });

    // Title text inside the row-main label (not the switch input).
    const name = container.querySelector(
      'li[data-id="x"] label.row-main .name',
    ) as HTMLElement;
    expect(name).toBeTruthy();

    await fireEvent.pointerDown(name, {
      button: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 10,
      pointerType: 'mouse',
    });
    await fireEvent.pointerMove(window, {
      button: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 40,
      pointerType: 'mouse',
    });
    await fireEvent.pointerUp(window, {
      button: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 40,
      pointerType: 'mouse',
    });

    expect(onReorder).toHaveBeenCalled();
    expect(onReorder.mock.calls[0]![0]).toBe('x');
  });

  it('[IconActionButton] shows no checkmark when onAct rejects', async () => {
    const onAct = vi.fn(async () => {
      throw new Error('copy failed');
    });
    const { getByRole, container } = render(IconActionButton, {
      props: {
        icon: 'link',
        label: 'Copy URL',
        onAct,
      },
    });

    await fireEvent.click(getByRole('button', { name: 'Copy URL' }));
    await waitFor(() => expect(onAct).toHaveBeenCalled());
    // Stay idle: no .done class (success checkmark is gated on resolve).
    expect(
      container.querySelector('.icon-btn')?.classList.contains('done'),
    ).toBe(false);
  });

  it('[Pointer drag] Escape mid-drag keeps the trailing click suppressed', async () => {
    register(fakeX);
    register(fakeFacebook);
    const onToggle = vi.fn();
    const onReorder = vi.fn();

    const { getByLabelText, container } = render(EditView, {
      props: {
        order: ['x', 'facebook'],
        enabledIds: ['x', 'facebook'],
        onToggle,
        onReorder,
      },
    });

    const row = container.querySelector('li[data-id="x"] .row') as HTMLElement;
    await fireEvent.pointerDown(row, {
      button: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 10,
      pointerType: 'mouse',
    });
    await fireEvent.pointerMove(window, {
      button: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 30,
      pointerType: 'mouse',
    });
    await fireEvent.keyDown(window, { key: 'Escape' });
    await fireEvent.click(getByLabelText('X'));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('[Pointer drag] a second pointer mid-drag does not wipe click suppression', async () => {
    register(fakeX);
    register(fakeFacebook);
    const onToggle = vi.fn();
    const onReorder = vi.fn();

    const { getByLabelText, container } = render(EditView, {
      props: {
        order: ['x', 'facebook'],
        enabledIds: ['x', 'facebook'],
        onToggle,
        onReorder,
      },
    });

    const xRow = container.querySelector('li[data-id="x"] .row') as HTMLElement;
    const fbRow = container.querySelector(
      'li[data-id="facebook"] .row',
    ) as HTMLElement;
    await fireEvent.pointerDown(xRow, {
      button: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 10,
      pointerType: 'mouse',
    });
    await fireEvent.pointerMove(window, {
      button: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 30,
      pointerType: 'mouse',
    });
    await fireEvent.pointerDown(fbRow, {
      button: 0,
      pointerId: 2,
      clientX: 10,
      clientY: 10,
      pointerType: 'mouse',
    });
    await fireEvent.pointerUp(window, {
      button: 0,
      pointerId: 1,
      clientX: 10,
      clientY: 30,
      pointerType: 'mouse',
    });
    await fireEvent.click(getByLabelText('X'));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('[Keyboard reorder] ArrowDown on a handle moves one step down', async () => {
    register(fakeX);
    register(fakeFacebook);
    register(fakeSlack);
    const onReorder = vi.fn();

    const { getByRole } = render(EditView, {
      props: {
        order: ['x', 'facebook', 'slack'],
        enabledIds: ['x', 'facebook', 'slack'],
        onToggle: () => {},
        onReorder,
      },
    });

    const handle = getByRole('button', { name: 'Reorder X' });
    await fireEvent.keyDown(handle, { key: 'ArrowDown' });

    // List [x, facebook, slack]; move x one step down → before slack.
    expect(onReorder).toHaveBeenCalledWith('x', 'slack');
  });

  it('[Keyboard reorder] ArrowUp at the top of the list is a no-op', async () => {
    register(fakeX);
    register(fakeFacebook);
    const onReorder = vi.fn();

    const { getByRole } = render(EditView, {
      props: {
        order: ['x', 'facebook'],
        enabledIds: ['x', 'facebook'],
        onToggle: () => {},
        onReorder,
      },
    });

    const handle = getByRole('button', { name: 'Reorder X' });
    await fireEvent.keyDown(handle, { key: 'ArrowUp' });
    expect(onReorder).not.toHaveBeenCalled();
  });

  it('[Theming] a click before the stored preference resolves is not clobbered by the seed', async () => {
    let resolveGet!: () => void;
    const gate = new Promise<void>((r) => {
      resolveGet = r;
    });
    const syncStore: Record<string, unknown> = { theme: 'dark' };
    vi.stubGlobal('chrome', {
      storage: {
        sync: {
          get: vi.fn(async (key: string) => {
            await gate;
            return key in syncStore ? { [key]: syncStore[key] } : {};
          }),
          set: vi.fn(async () => {}),
        },
        local: { get: vi.fn(async () => ({})), set: vi.fn(async () => {}) },
      },
    });

    const { getByRole } = render(ThemeToggle);
    // User picks Light before the stored "dark" seed has resolved.
    await fireEvent.click(getByRole('button', { name: 'Light' }));
    resolveGet();

    await waitFor(() =>
      expect(
        getByRole('button', { name: 'Light' }).getAttribute('aria-pressed'),
      ).toBe('true'),
    );
    expect(
      getByRole('button', { name: 'Dark' }).getAttribute('aria-pressed'),
    ).toBe('false');
  });
});
