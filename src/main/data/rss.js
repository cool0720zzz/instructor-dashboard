'use strict';

const RssParser = require('rss-parser');
const db = require('./db');

const rssParser = new RssParser({
  timeout: 15000,
  headers: {
    'User-Agent': 'InstructorDashboard/1.0',
    Accept: 'application/rss+xml, application/xml, text/xml',
  },
});

/**
 * Convert a blog URL to its RSS feed URL.
 *
 * Supports:
 *   - Naver Blog:   blog.naver.com/ID  ->  rss.blog.naver.com/ID
 *   - Tistory:      ID.tistory.com     ->  ID.tistory.com/rss
 *   - WordPress:    domain             ->  domain/feed
 *   - Default:      domain             ->  domain/rss
 *
 * @param {string} url - The blog URL
 * @returns {string} The RSS feed URL
 */
function blogUrlToRss(url) {
  if (!url) return '';

  // Normalize: ensure protocol
  let normalized = url.trim();
  if (!normalized.match(/^https?:\/\//)) {
    normalized = 'https://' + normalized;
  }

  // Naver Blog
  // https://blog.naver.com/ID  ->  https://rss.blog.naver.com/ID
  if (normalized.includes('blog.naver.com')) {
    const id = normalized.split('blog.naver.com/')[1]?.split('/')[0]?.split('?')[0];
    if (id) {
      return `https://rss.blog.naver.com/${id}`;
    }
  }

  // Tistory
  // https://ID.tistory.com  ->  https://ID.tistory.com/rss
  if (normalized.includes('.tistory.com')) {
    return normalized.replace(/\/$/, '') + '/rss';
  }

  // WordPress
  // https://domain  ->  https://domain/feed
  if (normalized.includes('wordpress.com') || normalized.match(/\/wp-content\//)) {
    return normalized.replace(/\/$/, '') + '/feed';
  }

  // Default: try /rss
  return normalized.replace(/\/$/, '') + '/rss';
}

/**
 * Fetch and parse RSS feed for a single instructor.
 * Saves new posts to the database.
 *
 * @param {object} instructor - Instructor object with { id, blog_url, blog_rss_url }
 * @returns {Promise<{ added: number, total: number, error: string|null }>}
 */
async function fetchRss(instructor) {
  const result = { added: 0, total: 0, error: null };

  try {
    // Determine RSS URL: use pre-computed blog_rss_url or convert blog_url
    const rssUrl = instructor.blog_rss_url || blogUrlToRss(instructor.blog_url);
    if (!rssUrl) {
      result.error = 'No blog URL configured';
      return result;
    }

    const feed = await rssParser.parseURL(rssUrl);
    const items = feed.items || [];
    result.total = items.length;

    for (const item of items) {
      const postUrl = item.link || item.guid;
      if (!postUrl) continue;

      const publishedAt = item.pubDate
        ? new Date(item.pubDate).toISOString()
        : item.isoDate || new Date().toISOString();

      try {
        const insertResult = db.addBlogPost({
          instructor_id: instructor.id,
          post_url: postUrl,
          post_title: item.title || '',
          published_at: publishedAt,
        });
        // INSERT OR IGNORE returns changes=0 if duplicate
        if (insertResult.changes > 0) {
          result.added++;
        }
      } catch (err) {
        // Silently skip duplicates (UNIQUE constraint on post_url)
        if (!err.message.includes('UNIQUE')) {
          console.error(`Error saving blog post for instructor ${instructor.id}:`, err.message);
        }
      }
    }
  } catch (err) {
    result.error = err.message;
    console.error(`RSS fetch error for instructor ${instructor.id} (${instructor.name}):`, err.message);
  }

  return result;
}

/**
 * Refresh RSS feeds for all active instructors.
 *
 * @returns {Promise<Array<{ instructorId: number, name: string, added: number, total: number, error: string|null }>>}
 */
async function refreshAllFeeds() {
  const instructors = db.getAllInstructors();
  const results = [];

  for (const instructor of instructors) {
    if (!instructor.blog_url && !instructor.blog_rss_url) {
      results.push({
        instructorId: instructor.id,
        name: instructor.name,
        added: 0,
        total: 0,
        error: 'No blog URL configured',
      });
      continue;
    }

    const feedResult = await fetchRss(instructor);
    results.push({
      instructorId: instructor.id,
      name: instructor.name,
      ...feedResult,
    });
  }

  return results;
}

module.exports = {
  blogUrlToRss,
  fetchRss,
  refreshAllFeeds,
};
