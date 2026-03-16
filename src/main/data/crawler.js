'use strict';

const cheerio = require('cheerio');
const db = require('./db');
const { matchInstructor, extractBlogContent } = require('./parser');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
};

// Use native fetch (available in Electron 28+) to avoid axios File polyfill issues
async function fetchHtml(url, extraHeaders = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      headers: { ...HEADERS, ...extraHeaders },
      signal: controller.signal,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timeout);
  }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

/**
 * Extract the place ID from a Naver Place URL.
 */
function extractPlaceId(placeUrl) {
  const match = placeUrl.match(/place\/(\d+)/);
  return match ? match[1] : null;
}

/**
 * Crawl Naver Place visitor reviews using the Naver Place API.
 * Naver Place has a JSON API that returns reviews without needing JS rendering.
 */
async function crawlNaverPlaceReviews(placeUrl) {
  const result = { reviews: [], error: null };

  if (!placeUrl) {
    result.error = 'No place URL provided';
    return result;
  }

  const placeId = extractPlaceId(placeUrl);
  if (!placeId) {
    result.error = 'Could not extract place ID from URL';
    return result;
  }

  const instructors = db.getAllInstructors();
  if (instructors.length === 0) {
    result.error = 'No instructors to match';
    return result;
  }

  console.log(`[Crawler] Fetching reviews for place ${placeId}`);

  try {
    // Naver Place uses a JSON API for reviews
    // Try the API endpoint first, fall back to HTML scraping
    const reviews = await _fetchReviewsViaApi(placeId) || await _fetchReviewsViaHtml(placeId);

    console.log(`[Crawler] ${reviews.length} reviews fetched, matching against ${instructors.length} instructors`);

    for (const raw of reviews) {
      const match = matchInstructor(raw.text, instructors);

      result.reviews.push({
        text: raw.text,
        date: raw.date,
        matchedInstructorId: match ? match.instructor.id : null,
        matchedKeyword: match ? match.matchedKeyword : null,
      });

      db.addReview({
        review_text: raw.text,
        review_date: raw.date,
        matched_instructor_id: match ? match.instructor.id : null,
      });
    }

    const matched = result.reviews.filter(r => r.matchedInstructorId);
    console.log(`[Crawler] ${matched.length}/${result.reviews.length} reviews matched`);
    for (const inst of instructors) {
      const count = matched.filter(r => r.matchedInstructorId === inst.id).length;
      if (count > 0) console.log(`[Crawler]   ${inst.name}: ${count} reviews`);
    }
  } catch (err) {
    result.error = err.message;
    console.error('[Crawler] Error:', err.message);
  }

  return result;
}

/**
 * Fetch reviews via Naver Place API (JSON endpoint).
 */
async function _fetchReviewsViaApi(placeId) {
  const reviews = [];
  const PAGE_SIZE = 50;
  const MAX_PAGES = 4;

  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const url = `https://pcmap.place.naver.com/place/${placeId}/review/visitor?reviewSort=recent&page=${page}`;
      const html = await fetchHtml(url, { Referer: 'https://map.naver.com' });

      // Naver embeds review data as JSON in a script tag
      const $ = cheerio.load(html);

      // Try extracting from __NEXT_DATA__ or embedded JSON
      const scriptTags = $('script').toArray();
      let foundData = false;

      for (const script of scriptTags) {
        const content = $(script).html() || '';

        // Look for __NEXT_DATA__ which contains review data
        if (content.includes('__NEXT_DATA__')) {
          try {
            const jsonMatch = content.match(/__NEXT_DATA__\s*=\s*({.+?})\s*;?\s*<\/script/s)
              || content.match(/__NEXT_DATA__\s*=\s*({.+})/s);
            if (jsonMatch) {
              const data = JSON.parse(jsonMatch[1]);
              const pageReviews = _extractReviewsFromNextData(data);
              if (pageReviews.length > 0) {
                reviews.push(...pageReviews);
                foundData = true;
                break;
              }
            }
          } catch { /* parse error, try next */ }
        }

        // Look for window.__APOLLO_STATE__ or similar
        if (content.includes('window.__APOLLO_STATE__') || content.includes('"reviewItems"')) {
          try {
            const jsonStr = content.match(/window\.__APOLLO_STATE__\s*=\s*({.+?});/s);
            if (jsonStr) {
              const data = JSON.parse(jsonStr[1]);
              const pageReviews = _extractReviewsFromApollo(data);
              if (pageReviews.length > 0) {
                reviews.push(...pageReviews);
                foundData = true;
                break;
              }
            }
          } catch { /* parse error */ }
        }
      }

      // If no JSON data found, fall back to HTML parsing
      if (!foundData) {
        const htmlReviews = _parseReviewsFromHtml($);
        if (htmlReviews.length > 0) {
          reviews.push(...htmlReviews);
        } else if (page === 1) {
          // First page returned nothing — try mobile fallback
          return null;
        }
      }

      if (reviews.length >= PAGE_SIZE * page) {
        await delay(1000 + Math.random() * 2000);
        continue;
      }
      break; // No more pages
    } catch (err) {
      if (page === 1) {
        console.warn(`[Crawler] API page fetch failed: ${err.message}, trying HTML fallback`);
        return null;
      }
      break;
    }
  }

  return reviews.length > 0 ? reviews : null;
}

/**
 * Extract reviews from Next.js __NEXT_DATA__ JSON.
 */
function _extractReviewsFromNextData(data) {
  const reviews = [];
  try {
    // Navigate the Next.js data structure to find reviews
    const props = data?.props?.pageProps;
    if (!props) return reviews;

    // Try various paths where reviews might be
    const reviewData = props.review?.list || props.reviews || props.visitorReviews?.items || [];
    for (const item of reviewData) {
      const text = item.body || item.content || item.text || '';
      if (!text || text.length < 5) continue;

      let dateStr = '';
      const visitDate = item.visitDate || item.created || item.date || '';
      if (visitDate) {
        dateStr = _normalizeDate(visitDate);
      }
      if (!dateStr) dateStr = new Date().toISOString().slice(0, 10);

      reviews.push({ text, date: dateStr });
    }
  } catch { /* structure mismatch */ }
  return reviews;
}

/**
 * Extract reviews from Apollo state JSON.
 */
function _extractReviewsFromApollo(data) {
  const reviews = [];
  try {
    for (const key of Object.keys(data)) {
      const val = data[key];
      if (val && typeof val === 'object' && val.body && val.visitCount !== undefined) {
        const text = val.body || '';
        if (!text || text.length < 5) continue;
        const dateStr = _normalizeDate(val.visitDate || val.created || '') || new Date().toISOString().slice(0, 10);
        reviews.push({ text, date: dateStr });
      }
    }
  } catch { /* structure mismatch */ }
  return reviews;
}

/**
 * Parse reviews directly from HTML when JSON extraction fails.
 */
function _parseReviewsFromHtml($) {
  const reviews = [];

  // Try Naver Place review selectors
  const reviewItems = $('li.place_apply_pui, li[class*="EjjAW"], div[class*="review_item"]');

  reviewItems.each((_, el) => {
    const $el = $(el);
    const text = $el.find('[class*="vn15t2"], [class*="review_text"], [class*="content"]').text().trim()
      || $el.find('p').text().trim();

    if (!text || text.length < 5) return;

    // Extract date
    const footer = $el.find('[class*="QztK4Q"], [class*="date"], time').text();
    let dateStr = '';

    const dateMatch = footer.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
    if (dateMatch) {
      dateStr = `${dateMatch[1]}-${dateMatch[2].padStart(2, '0')}-${dateMatch[3].padStart(2, '0')}`;
    }
    if (!dateStr) {
      const shortMatch = footer.match(/(\d{1,2})\.(\d{1,2})\.[월화수목금토일]/);
      if (shortMatch) {
        const year = new Date().getFullYear();
        dateStr = `${year}-${shortMatch[1].padStart(2, '0')}-${shortMatch[2].padStart(2, '0')}`;
      }
    }
    if (!dateStr) dateStr = new Date().toISOString().slice(0, 10);

    reviews.push({ text, date: dateStr });
  });

  return reviews;
}

/**
 * Fetch reviews via mobile HTML page (fallback).
 */
async function _fetchReviewsViaHtml(placeId) {
  const reviews = [];

  try {
    // Mobile page is simpler and more likely to work without JS
    const url = `https://m.place.naver.com/restaurant/${placeId}/review/visitor?reviewSort=recent`;
    const html = await fetchHtml(url, { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' });

    const $ = cheerio.load(html);

    // Try script-embedded JSON first
    $('script').each((_, script) => {
      const content = $(script).html() || '';
      if (content.includes('"body"') && content.includes('"visitDate"')) {
        try {
          // Find JSON objects with review-like structure
          const matches = content.matchAll(/"body"\s*:\s*"([^"]+?)"/g);
          for (const m of matches) {
            const text = m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
            if (text.length < 5) continue;
            reviews.push({ text, date: new Date().toISOString().slice(0, 10) });
          }
        } catch { /* parse error */ }
      }
    });

    // Also try direct HTML parsing
    if (reviews.length === 0) {
      const htmlReviews = _parseReviewsFromHtml($);
      reviews.push(...htmlReviews);
    }
  } catch (err) {
    console.error(`[Crawler] Mobile fallback failed: ${err.message}`);
  }

  return reviews;
}

/**
 * Normalize a date string to YYYY-MM-DD format.
 */
function _normalizeDate(dateStr) {
  if (!dateStr) return '';

  // ISO format
  if (dateStr.match(/^\d{4}-\d{2}-\d{2}/)) {
    return dateStr.slice(0, 10);
  }

  // Korean format: 2024년 3월 15일
  const korMatch = dateStr.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (korMatch) {
    return `${korMatch[1]}-${korMatch[2].padStart(2, '0')}-${korMatch[3].padStart(2, '0')}`;
  }

  // Dot format: 24.03.15
  const dotMatch = dateStr.match(/(\d{2,4})\.(\d{1,2})\.(\d{1,2})/);
  if (dotMatch) {
    let year = parseInt(dotMatch[1], 10);
    if (year < 100) year += 2000;
    return `${year}-${dotMatch[2].padStart(2, '0')}-${dotMatch[3].padStart(2, '0')}`;
  }

  // Relative: N일 전
  const relMatch = dateStr.match(/(\d+)(일|시간|분)\s*전/);
  if (relMatch) {
    const num = parseInt(relMatch[1], 10);
    const unit = relMatch[2];
    const now = new Date();
    if (unit === '일') now.setDate(now.getDate() - num);
    else if (unit === '시간') now.setHours(now.getHours() - num);
    return now.toISOString().slice(0, 10);
  }

  return '';
}

/**
 * Crawl a blog post URL and extract content for SEO analysis.
 * Uses native fetch + cheerio.
 */
async function crawlBlogPost(postUrl) {
  const result = { content: null, html: '', error: null };

  if (!postUrl) {
    result.error = 'No post URL provided';
    return result;
  }

  try {
    let html = '';

    if (postUrl.includes('blog.naver.com')) {
      html = await _fetchNaverBlog(postUrl);
    } else {
      const data = await fetchHtml(postUrl);
      html = data;
    }

    result.html = html;
    result.content = extractBlogContent(html);
  } catch (err) {
    result.error = err.message;
    console.error(`[Crawler] Blog crawl error (${postUrl}):`, err.message);
  }

  return result;
}

/**
 * Fetch Naver blog post content.
 * Naver blog wraps content in an iframe; we fetch the inner frame URL directly.
 */
async function _fetchNaverBlog(postUrl) {
  // Method 1: Try the mobile version (simpler, no iframe)
  try {
    const blogId = postUrl.match(/blog\.naver\.com\/([^/?#]+)/)?.[1];
    if (blogId) {
      // Fetch main page to find the logNo (post ID)
      const mainHtml = await fetchHtml(postUrl);

      // Find iframe src or logNo
      const $ = cheerio.load(mainHtml);
      const iframeSrc = $('iframe#mainFrame').attr('src');

      if (iframeSrc) {
        // Fetch the iframe content directly
        const fullUrl = iframeSrc.startsWith('http') ? iframeSrc : `https://blog.naver.com${iframeSrc}`;
        const frameHtml = await fetchHtml(fullUrl);
        return frameHtml;
      }

      // If no iframe, try mobile version
      const logNoMatch = mainHtml.match(/logNo=(\d+)/) || postUrl.match(/\/(\d+)$/);
      if (logNoMatch) {
        const mobileUrl = `https://m.blog.naver.com/PostView.naver?blogId=${blogId}&logNo=${logNoMatch[1]}`;
        const mobileHtml = await fetchHtml(mobileUrl, { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)' });
        return mobileHtml;
      }

      return mainHtml;
    }
  } catch (err) {
    console.warn(`[Crawler] Naver blog fetch method 1 failed: ${err.message}`);
  }

  // Method 2: Direct fetch as fallback
  const data = await fetchHtml(postUrl);
  return data;
}

// No browser to close, but keep the export for compatibility
async function closeBrowser() { /* noop */ }
async function getBrowser() { return null; }

module.exports = {
  crawlNaverPlaceReviews,
  crawlBlogPost,
  closeBrowser,
  getBrowser,
};
