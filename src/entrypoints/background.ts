// Near-empty service worker (v1). OGee does all work on demand from the popup;
// there is no persistent content script (SPEC §5, ADR D6).
export default defineBackground(() => {});
