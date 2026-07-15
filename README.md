<div align="center">
  <img src="assets/logo.png" width="128" height="128" alt="OGee" />
  <h1>OGee</h1>
  <p><em>Preview how pages look, everywhere.</em></p>
</div>

OGee is a Chromium extension that shows how the current page’s Open Graph link
card will look when it is shared. Open the popup on any page to see the real
thumbnail, title, description, and domain each platform would display, side by
side, in both light and dark themes.

## Features

- Previews eight platforms: Twitter (X), Facebook, LinkedIn, Slack, Discord,
  Google, WhatsApp, and Telegram.
- Reproduces each platform’s real image crop, title truncation, domain
  formatting, and fallbacks.
- Renders every card in both light and dark themes.
- Downloads the OG image or copies its URL in one click.
- Runs entirely locally, with no network calls, no data collected, and a
  minimal permission set.

## Privacy

OGee reads only the page you explicitly open it on, and everything runs locally
in your browser:

- **No data collected.** Nothing is sent anywhere; there is no backend.
- **No `host_permissions`, no persistent content script.** Extraction is
  injected on demand via `activeTab` only when you open the popup.
- Permissions used: `activeTab` and `scripting` (read the current page on
  demand), `storage` (remember your theme preference), `downloads` (save the
  image).

Full policy: [PRIVACY.md](./PRIVACY.md).

## Installation

- **Chrome Web Store:** _(link coming once published)_

### From source (unpacked)

Prerequisites: [Node.js](https://nodejs.org) 18+ and [pnpm](https://pnpm.io).

1. Clone and install dependencies:
   ```bash
   git clone https://github.com/heyshigeru/ogee.git
   cd ogee
   pnpm install
   ```
2. Build the extension: `pnpm build`
3. Open `chrome://extensions` in your browser.
4. Turn on **Developer mode** (toggle, top-right).
5. Click **Load unpacked** and select the `.output/chrome-mv3` folder.
6. Open OGee from the toolbar, or press `Alt+Shift+O`.

## Development

Requires [Node.js](https://nodejs.org) and [pnpm](https://pnpm.io).

```bash
pnpm install     # installs deps; postinstall runs `wxt prepare`
pnpm dev         # dev build with HMR (loads into a temp browser profile)
pnpm build       # production build → .output/chrome-mv3/
pnpm test        # vitest unit + component suite
pnpm check       # svelte-check typecheck
pnpm lint        # ESLint
```

## Tech stack

- **[WXT](https://wxt.dev)** — Manifest V3 extension framework
- **[Svelte 5](https://svelte.dev)** — popup UI and platform cards
- **[Vitest](https://vitest.dev)** — unit and component tests
- TypeScript throughout

Each platform lives in its own self-registered module under
`src/platforms/<id>/`, so platforms are independent and easy to add. The
metadata extractor (`src/core/extract.ts`) is a self-contained function
serialized and injected into the page on demand.

## License

[MIT](./LICENSE)
