// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { isSafeUrl } from './url-safety';

describe('isSafeUrl', () => {
  describe('allows http/https and data:image/*', () => {
    it('allows http', () => {
      expect(isSafeUrl('http://x/y')).toBe(true);
    });

    it('allows https', () => {
      expect(isSafeUrl('https://x/y')).toBe(true);
    });

    it('allows data:image/png', () => {
      expect(isSafeUrl('data:image/png;base64,AAA')).toBe(true);
    });

    it('allows data:image/* case-insensitively', () => {
      expect(isSafeUrl('data:IMAGE/SVG+xml;utf8,<svg/>')).toBe(true);
    });
  });

  describe('rejects non-image data:, javascript:, blob:, and unparseable input', () => {
    it('rejects data:text/html', () => {
      expect(isSafeUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    it('rejects data: without an image MIME', () => {
      expect(isSafeUrl('data:text/plain,hello')).toBe(false);
      expect(isSafeUrl('data:,hello')).toBe(false);
    });

    it('rejects javascript:', () => {
      expect(isSafeUrl('javascript:alert(1)')).toBe(false);
    });

    it('rejects blob:', () => {
      expect(isSafeUrl('blob:https://x/abc')).toBe(false);
    });

    it('rejects unparseable input', () => {
      expect(isSafeUrl('not a url')).toBe(false);
    });

    it('rejects undefined', () => {
      expect(isSafeUrl(undefined)).toBe(false);
    });
  });
});
