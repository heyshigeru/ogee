import { mount } from 'svelte';
import App from './App.svelte';
import './app.css';
import { getThemePreference, initTheme } from '../../lib/theme';

// Apply the resolved theme BEFORE mounting so the popup paints in the correct
// colors immediately (no FOUC). An inline <script> is impossible under the MV3
// CSP (`script-src 'self'`), so the pre-mount apply happens via initTheme
// (ADR P1-D1). initTheme also wires the OS watcher; the subscription only
// registers a matchMedia listener and does not touch the DOM/App.
async function start() {
  await initTheme(getThemePreference);
  mount(App, { target: document.getElementById('app')! });
}

void start();
