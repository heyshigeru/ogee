const SAFE_NETWORK_PROTOCOLS = new Set(['http:', 'https:']);

/** Case-insensitive data: URL whose MIME type is an image subtype. */
const DATA_IMAGE = /^data:image\//i;

export function isSafeUrl(url: string | undefined): url is string {
  if (url === undefined) return false;
  try {
    const protocol = new URL(url).protocol;
    if (SAFE_NETWORK_PROTOCOLS.has(protocol)) return true;
    if (protocol === 'data:') return DATA_IMAGE.test(url);
    return false;
  } catch {
    return false;
  }
}
