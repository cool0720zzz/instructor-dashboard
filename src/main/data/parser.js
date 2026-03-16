'use strict';

const cheerio = require('cheerio');

/**
 * Match instructor names/keywords in review text.
 * Returns the first matching instructor or null.
 *
 * @param {string} text - The review text to search
 * @param {Array} instructors - Array of instructor objects with { id, name, keywords: string[] }
 * @returns {{ instructor: object, matchedKeyword: string } | null}
 */
function matchInstructor(text, instructors) {
  if (!text || !instructors || instructors.length === 0) return null;

  for (const instructor of instructors) {
    // Build list of search terms: name + all keywords
    const searchTerms = [instructor.name];
    if (Array.isArray(instructor.keywords)) {
      searchTerms.push(...instructor.keywords);
    }

    for (const term of searchTerms) {
      if (!term) continue;
      // Escape special regex characters in the term
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'i');
      if (regex.test(text)) {
        return { instructor, matchedKeyword: term };
      }
    }
  }

  return null;
}

/**
 * Extract clean text content from blog HTML.
 * Handles Naver blog post structure and generic HTML.
 *
 * @param {string} html - Raw HTML string
 * @returns {{ text: string, title: string, images: number, internalLinks: number, hasCustomCategory: boolean, tags: string[], hasLists: boolean, hasBold: boolean, headings: number, paragraphs: string[] }}
 */
function extractBlogContent(html) {
  if (!html) {
    return {
      text: '',
      title: '',
      images: 0,
      internalLinks: 0,
      hasCustomCategory: false,
      tags: [],
      hasLists: false,
      hasBold: false,
      headings: 0,
      paragraphs: [],
    };
  }

  const $ = cheerio.load(html);

  // Remove script, style, nav, footer, header
  $('script, style, nav, footer, header, .comment, #comment').remove();

  // Extract title
  const title =
    $('meta[property="og:title"]').attr('content') ||
    $('title').text().trim() ||
    $('h1').first().text().trim() ||
    '';

  // Determine main content area
  // Naver blog: .se-main-container or #postViewArea or .post-view
  // Tistory: .entry-content or .article-view
  // Generic: article, main, .content, .post-content
  const contentSelectors = [
    '.se-main-container',
    '#postViewArea',
    '.post-view',
    '.entry-content',
    '.article-view',
    'article',
    'main',
    '.content',
    '.post-content',
    'body',
  ];

  let $content = null;
  for (const sel of contentSelectors) {
    const el = $(sel);
    if (el.length > 0 && el.text().trim().length > 50) {
      $content = el;
      break;
    }
  }

  if (!$content) {
    $content = $('body');
  }

  // Count images
  const images = $content.find('img').length;

  // Count internal links (same-domain links)
  let internalLinks = 0;
  $content.find('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    // Consider relative links and same-domain as internal
    if (href.startsWith('/') || href.startsWith('#') || href.includes('blog.naver.com') || href.includes('tistory.com')) {
      internalLinks++;
    }
  });

  // Check for custom category
  const hasCustomCategory =
    $('.blog_category').length > 0 ||
    $('.category').length > 0 ||
    $('[class*="category"]').length > 0 ||
    $('meta[property="article:section"]').attr('content') !== undefined;

  // Extract tags
  const tags = [];
  // Naver tags
  $('a.tag, .post_tag a, [class*="tag"] a, .tags a').each((_, el) => {
    const tagText = $(el).text().trim().replace(/^#/, '');
    if (tagText && tagText.length < 50) {
      tags.push(tagText);
    }
  });
  // Remove duplicates
  const uniqueTags = [...new Set(tags)];

  // Check for lists (ul, ol)
  const hasLists = $content.find('ul, ol').length > 0;

  // Check for bold/emphasis
  const hasBold = $content.find('b, strong, em, i').length > 0;

  // Count H2/H3 headings
  const headings = $content.find('h2, h3').length;

  // Extract paragraphs for SEO analysis
  const paragraphs = [];
  $content.find('p, .se-text-paragraph, div.se-module-text').each((_, el) => {
    const pText = $(el).text().trim();
    if (pText.length > 10) {
      paragraphs.push(pText);
    }
  });

  // If no structured paragraphs found, split by double newlines
  const fullText = $content.text().replace(/\s+/g, ' ').trim();
  if (paragraphs.length === 0 && fullText.length > 0) {
    const rawParagraphs = fullText.split(/\n\s*\n/).filter((p) => p.trim().length > 10);
    paragraphs.push(...rawParagraphs);
  }

  return {
    text: fullText,
    title,
    images,
    internalLinks,
    hasCustomCategory,
    tags: uniqueTags,
    hasLists,
    hasBold,
    headings,
    paragraphs,
  };
}

/**
 * Count keyword occurrences in text.
 *
 * @param {string} text - The text to search in
 * @param {string[]} keywords - Array of keywords to count
 * @returns {{ total: number, byKeyword: Object<string, number>, positions: number[] }}
 */
function countKeywords(text, keywords) {
  if (!text || !keywords || keywords.length === 0) {
    return { total: 0, byKeyword: {}, positions: [] };
  }

  const lowerText = text.toLowerCase();
  const byKeyword = {};
  const positions = [];
  let total = 0;

  for (const keyword of keywords) {
    if (!keyword) continue;
    const lowerKw = keyword.toLowerCase();
    const escaped = lowerKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    let match;
    let count = 0;

    while ((match = regex.exec(lowerText)) !== null) {
      count++;
      positions.push(match.index);
    }

    byKeyword[keyword] = count;
    total += count;
  }

  // Sort positions
  positions.sort((a, b) => a - b);

  return { total, byKeyword, positions };
}

module.exports = {
  matchInstructor,
  extractBlogContent,
  countKeywords,
};
