# OGee Privacy Policy

_Effective date: 2026-07-16_

OGee does not collect, store, transmit, or sell any personal data. Everything
the extension does happens locally in your browser.

## No data collection

OGee has no backend server and makes no network requests of its own. Nothing
you view or preview is sent anywhere by the extension.

## Page reading

When you open the OGee popup on a page, it reads that page’s publicly available
Open Graph and HTML meta tags to generate the preview. This happens only for
the tab you open the popup on, only at that moment, and the data never leaves
your device.

## What is stored

The only data OGee persists is your own preferences — your theme choice and
which platform cards you have enabled and their order — saved through the
browser’s storage. If you have Chrome sync enabled, the browser may sync these
preferences across your own devices; OGee itself transmits nothing.

## Downloads and copy

The Download and Copy URL actions operate on the page’s own image URL and run
only when you click them.

## Permissions

OGee uses:

- **activeTab** and **scripting** — to read the current page on demand when you
  open the popup (no `host_permissions`, no persistent content script)
- **storage** — to remember your preferences
- **downloads** — to save an image when you choose Download

## Contact

Questions about this policy: open an issue at
[github.com/heyshigeru/ogee](https://github.com/heyshigeru/ogee/issues).

If a developer contact email is listed on the Chrome Web Store listing for
OGee, you may also use that address.
