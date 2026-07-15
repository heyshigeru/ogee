import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: 'src',
  modules: ['@wxt-dev/module-svelte'],
  manifest: {
    name: 'OGee – OG Image Preview & Download',
    description:
      'Preview how your link card looks when shared across every platform.',
    // NO host_permissions — keeps the clean install (SPEC §4).
    permissions: ['activeTab', 'scripting', 'storage', 'downloads'],
    commands: {
      _execute_action: {
        suggested_key: { default: 'Alt+Shift+O' },
        description: 'Open OGee popup',
      },
    },
  },
});
