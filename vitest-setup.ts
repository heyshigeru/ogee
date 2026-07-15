// @testing-library/svelte auto-cleanup between tests is registered by the
// svelteTesting() Vite plugin; this file is a place for additional global test
// setup (e.g. jest-dom matchers) as the suite grows.

import { afterEach } from 'vitest';

// jsdom does not implement the Web Animations API, which Svelte 5 uses to run
// `transition:`/`animate:` directives. Stub a no-op Animation so components that
// use built-in transitions (e.g. the settings panel's slide) render under jsdom.
// Guarded on `Element` so the default `node` test environment is untouched.
if (typeof Element !== 'undefined' && !Element.prototype.animate) {
  Element.prototype.animate = function animate() {
    const animation = {
      cancel() {},
      finish() {},
      play() {},
      pause() {},
      reverse() {},
      currentTime: 0,
      startTime: 0,
      playbackRate: 1,
      playState: 'finished',
      finished: Promise.resolve(),
      onfinish: null as null | (() => void),
      oncancel: null as null | (() => void),
      addEventListener() {},
      removeEventListener() {},
    };
    // Svelte assigns `onfinish` synchronously after this returns; firing it on a
    // microtask lets intro/outro transitions complete (and outros remove nodes).
    queueMicrotask(() => animation.onfinish?.());
    return animation as unknown as Animation;
  };
}

// Theme is ambient on documentElement for card component tests. Clear it after
// each test so a leftover theme cannot influence the next render. Guarded for
// the default `node` environment (no document).
afterEach(() => {
  if (typeof document !== 'undefined')
    delete document.documentElement.dataset.theme;
});
