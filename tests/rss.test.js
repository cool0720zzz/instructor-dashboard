'use strict';

const { blogUrlToRss } = require('../src/main/data/rss');

describe('blogUrlToRss', () => {
  // ─── Naver Blog ──────────────────────────────────────────────────────────
  describe('Naver Blog URLs', () => {
    test('converts standard Naver blog URL to RSS', () => {
      expect(blogUrlToRss('https://blog.naver.com/hong')).toBe(
        'https://rss.blog.naver.com/hong'
      );
    });

    test('converts Naver blog URL with trailing slash', () => {
      expect(blogUrlToRss('https://blog.naver.com/hong/')).toBe(
        'https://rss.blog.naver.com/hong'
      );
    });

    test('converts Naver blog URL with subpath', () => {
      expect(blogUrlToRss('https://blog.naver.com/hong/12345')).toBe(
        'https://rss.blog.naver.com/hong'
      );
    });

    test('converts Naver blog URL with query parameters', () => {
      expect(blogUrlToRss('https://blog.naver.com/hong?tab=1')).toBe(
        'https://rss.blog.naver.com/hong'
      );
    });

    test('converts Naver blog URL without protocol', () => {
      expect(blogUrlToRss('blog.naver.com/hong')).toBe(
        'https://rss.blog.naver.com/hong'
      );
    });

    test('converts http Naver blog URL', () => {
      expect(blogUrlToRss('http://blog.naver.com/hong')).toBe(
        'https://rss.blog.naver.com/hong'
      );
    });
  });

  // ─── Tistory ─────────────────────────────────────────────────────────────
  describe('Tistory URLs', () => {
    test('converts standard Tistory URL to RSS', () => {
      expect(blogUrlToRss('https://myname.tistory.com')).toBe(
        'https://myname.tistory.com/rss'
      );
    });

    test('converts Tistory URL with trailing slash', () => {
      expect(blogUrlToRss('https://myname.tistory.com/')).toBe(
        'https://myname.tistory.com/rss'
      );
    });

    test('converts Tistory URL without protocol', () => {
      expect(blogUrlToRss('myname.tistory.com')).toBe(
        'https://myname.tistory.com/rss'
      );
    });
  });

  // ─── WordPress ───────────────────────────────────────────────────────────
  describe('WordPress URLs', () => {
    test('converts wordpress.com URL to feed', () => {
      expect(blogUrlToRss('https://myblog.wordpress.com')).toBe(
        'https://myblog.wordpress.com/feed'
      );
    });

    test('converts wordpress.com URL with trailing slash', () => {
      expect(blogUrlToRss('https://myblog.wordpress.com/')).toBe(
        'https://myblog.wordpress.com/feed'
      );
    });

    test('converts URL with /wp-content/ pattern to feed', () => {
      expect(blogUrlToRss('https://example.com/wp-content/')).toBe(
        'https://example.com/wp-content/feed'
      );
    });
  });

  // ─── Default fallback ────────────────────────────────────────────────────
  describe('Default fallback', () => {
    test('appends /rss for unknown blog platforms', () => {
      expect(blogUrlToRss('https://example.com')).toBe(
        'https://example.com/rss'
      );
    });

    test('appends /rss and strips trailing slash', () => {
      expect(blogUrlToRss('https://example.com/')).toBe(
        'https://example.com/rss'
      );
    });

    test('adds https and appends /rss for bare domain', () => {
      expect(blogUrlToRss('example.com')).toBe(
        'https://example.com/rss'
      );
    });
  });

  // ─── Edge cases ──────────────────────────────────────────────────────────
  describe('Edge cases', () => {
    test('returns empty string for null input', () => {
      expect(blogUrlToRss(null)).toBe('');
    });

    test('returns empty string for undefined input', () => {
      expect(blogUrlToRss(undefined)).toBe('');
    });

    test('returns empty string for empty string input', () => {
      expect(blogUrlToRss('')).toBe('');
    });

    test('trims whitespace from URL', () => {
      expect(blogUrlToRss('  https://blog.naver.com/hong  ')).toBe(
        'https://rss.blog.naver.com/hong'
      );
    });
  });
});
