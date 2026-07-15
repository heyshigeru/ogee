import { isSafeUrl } from '../core/url-safety';

const EXT_PATTERN = /\.(jpe?g|png|webp|gif|avif|svg)(?:[?#]|$)/i;
const DATA_MIME_PATTERN = /^data:image\/([a-z0-9.+-]+)/i;

/** Normalize a raw extension/MIME subtype to the filename extension we emit. */
function normalizeExt(raw: string): string {
  // Drop a structured-syntax suffix so a data: MIME like "svg+xml" → "svg".
  const lower = raw.toLowerCase().replace(/\+.*$/, '');
  return lower === 'jpeg' ? 'jpg' : lower;
}

/**
 * Derive the file extension for an image URL.
 * - data: URLs use the `data:image/<type>` MIME (jpeg→jpg).
 * - http(s) URLs match a known image extension in the pathname only (query
 *   strings like `?ref=banner.png` must not spoof the download extension).
 * - Anything else falls back to jpg.
 */
function deriveExtension(imageUrl: string): string {
  const mimeMatch = DATA_MIME_PATTERN.exec(imageUrl);
  if (mimeMatch) {
    const ext = normalizeExt(mimeMatch[1]);
    return EXT_PATTERN.test(`.${ext}`) ? ext : 'jpg';
  }

  // Match against pathname so a query/hash cannot spoof the extension.
  // imageUrl has already passed isSafeUrl for action paths; still guard so this
  // pure helper never throws on an unparseable string.
  let path = imageUrl;
  try {
    if (/^https?:\/\//i.test(imageUrl)) {
      path = new URL(imageUrl).pathname;
    }
  } catch {
    // Keep raw string fallback.
  }

  const pathMatch = EXT_PATTERN.exec(path);
  if (pathMatch) {
    return normalizeExt(pathMatch[1]);
  }

  return 'jpg';
}

/** Sanitize a hostname into the filename's domain portion (alnum+hyphen, ≤50). */
function sanitizeHostname(hostname: string): string {
  const cleaned = hostname
    .toLowerCase()
    .replace(/\./g, '-')
    .replace(/[^a-z0-9-]/g, '');
  return cleaned.slice(0, 50);
}

export function buildFilename(pageUrl: string, imageUrl: string): string {
  const ext = deriveExtension(imageUrl);

  let domain: string;
  try {
    domain = sanitizeHostname(new URL(pageUrl).hostname);
  } catch {
    domain = '';
  }

  const base = domain ? `${domain}-og-image` : 'og-image';
  return `${base}.${ext}`;
}

export function downloadImage(imageUrl: string, pageUrl: string): void {
  if (!isSafeUrl(imageUrl)) return;
  // download() returns a promise that can reject (blocked by policy, disk full,
  // OS-rejected filename); swallow it so a failed download can't surface as an
  // unhandled rejection. Promise.resolve guards against a void return in tests.
  void Promise.resolve(
    chrome.downloads.download({
      url: imageUrl,
      filename: buildFilename(pageUrl, imageUrl),
    }),
  ).catch(() => {});
}

export async function copyImageUrl(imageUrl: string): Promise<void> {
  if (!isSafeUrl(imageUrl)) return;
  await navigator.clipboard.writeText(imageUrl);
}
