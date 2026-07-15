// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { buildFilename, downloadImage, copyImageUrl } from './image-actions';

describe('image-actions — buildFilename / download / copy', () => {
  describe('buildFilename', () => {
    it('replaces dots with hyphens in the hostname', () => {
      expect(
        buildFilename(
          'https://www.example.com/page',
          'https://cdn.example.com/og.jpg',
        ),
      ).toBe('www-example-com-og-image.jpg');
    });

    it('strips special characters and truncates long domains to alnum+hyphen, ≤50 chars', () => {
      const longHost = 'a'.repeat(80) + '.example_$.com';
      const result = buildFilename(
        `https://${longHost}/page`,
        'https://x/og.png',
      );
      const domainPart = result.replace(/-og-image\.[a-z]+$/, '');
      expect(domainPart).toMatch(/^[a-z0-9-]+$/);
      expect(domainPart.length).toBeLessThanOrEqual(50);
    });

    it('derives .png from a URL path ending in image.png', () => {
      expect(
        buildFilename(
          'https://example.com/',
          'https://cdn.example.com/image.png',
        ),
      ).toBe('example-com-og-image.png');
    });

    it('derives .webp from a URL path ending in image.webp', () => {
      expect(
        buildFilename(
          'https://example.com/',
          'https://cdn.example.com/image.webp',
        ),
      ).toBe('example-com-og-image.webp');
    });

    it('falls back to .jpg when there is no recognizable extension', () => {
      const result = buildFilename(
        'https://example.com/',
        'https://cdn.example.com/generate?id=123',
      );
      expect(result.endsWith('.jpg')).toBe(true);
    });

    it('ignores a query-string extension spoof (uses path only)', () => {
      expect(
        buildFilename(
          'https://example.com/',
          'https://cdn.example.com/generate?ref=banner.png',
        ),
      ).toBe('example-com-og-image.jpg');
    });

    it('still honors a real path extension when a query is present', () => {
      expect(
        buildFilename(
          'https://example.com/',
          'https://cdn.example.com/image.webp?ref=banner.png',
        ),
      ).toBe('example-com-og-image.webp');
    });

    it('uses "og-image" base name for an unparseable/empty hostname', () => {
      expect(
        buildFilename('file:///local.html', 'https://cdn.example.com/og.png'),
      ).toBe('og-image.png');
    });

    it('uses MIME type from a data: image URL for the extension', () => {
      expect(
        buildFilename('file:///local.html', 'data:image/png;base64,AAA'),
      ).toBe('og-image.png');
    });

    it('maps data:image/jpeg MIME to .jpg', () => {
      expect(
        buildFilename('https://example.com/', 'data:image/jpeg;base64,AAA'),
      ).toBe('example-com-og-image.jpg');
    });

    it('falls back to .jpg for unknown data: MIME', () => {
      expect(
        buildFilename('https://example.com/', 'data:image/heic;base64,AAA'),
      ).toBe('example-com-og-image.jpg');
    });

    it('maps data:image/svg+xml MIME to .svg', () => {
      expect(
        buildFilename('https://example.com/', 'data:image/svg+xml;base64,AAA'),
      ).toBe('example-com-og-image.svg');
    });
  });

  describe('downloadImage', () => {
    let download: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      download = vi.fn();
      vi.stubGlobal('chrome', { downloads: { download } });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('calls chrome.downloads.download with { url, filename }', () => {
      downloadImage('https://example.com/og.jpg', 'https://example.com/');
      expect(download).toHaveBeenCalledTimes(1);
      expect(download).toHaveBeenCalledWith({
        url: 'https://example.com/og.jpg',
        filename: 'example-com-og-image.jpg',
      });
    });

    it('passes a data: URL straight through to chrome.downloads', () => {
      const dataUrl = 'data:image/png;base64,AAA';
      downloadImage(dataUrl, 'https://example.com/');
      expect(download).toHaveBeenCalledTimes(1);
      expect(download.mock.calls[0][0].url).toBe(dataUrl);
    });

    it('does not call download for a javascript: URL', () => {
      downloadImage('javascript:alert(1)', 'https://example.com/');
      expect(download).not.toHaveBeenCalled();
    });

    it('does not call download for a blob: URL', () => {
      downloadImage('blob:https://x/abc', 'https://example.com/');
      expect(download).not.toHaveBeenCalled();
    });
  });

  describe('copyImageUrl', () => {
    let writeText: ReturnType<typeof vi.fn>;

    beforeEach(() => {
      writeText = vi.fn().mockResolvedValue(undefined);
      vi.stubGlobal('navigator', { clipboard: { writeText } });
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('writes the URL to the clipboard', async () => {
      await copyImageUrl('https://example.com/og.jpg');
      expect(writeText).toHaveBeenCalledTimes(1);
      expect(writeText).toHaveBeenCalledWith('https://example.com/og.jpg');
    });

    it('does not write unsafe URLs to the clipboard', async () => {
      await copyImageUrl('javascript:void(0)');
      expect(writeText).not.toHaveBeenCalled();
    });
  });
});
