import { defineConfig } from 'vitest/config';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { svelteTesting } from '@testing-library/svelte/vite';

// Per-file environment override via `// @vitest-environment jsdom` at the top of a
// test file; the default is `node` for the pure helpers (best-practices §5 / P1-D2).
export default defineConfig({
  plugins: [svelte(), svelteTesting()],
  test: {
    environment: 'node',
    setupFiles: ['./vitest-setup.ts'],
  },
});
