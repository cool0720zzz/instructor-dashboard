'use strict';

const cheerio = require('cheerio');
const db = require('./db');
const { matchInstructor, extractBlogContent } = require('./parser');

// Safe console.log that ignores EPIPE errors (broken pipe when dev process exits)
const _log = (...args) => { try { console.log(...args); } catch {} };

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
 * Crawl Naver Place reviews (both visitor and receipt tabs).
 * Fetches from both /review/visitor and /review/receipt, deduplicates, then matches instructors.
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

  _log(`[Crawler] Fetching reviews for place ${placeId} (visitor + receipt)`);

  try {
    // Fetch both visitor and receipt reviews in parallel
    const [visitorReviews, receiptReviews] = await Promise.all([
      _fetchReviewsForTab(placeId, 'visitor'),
      _fetchReviewsForTab(placeId, 'receipt'),
    ]);

    _log(`[Crawler] visitor: ${visitorReviews.length}, receipt: ${receiptReviews.length}`);

    // Combine and deduplicate by review text
    const seen = new Set();
    const allReviews = [];
    for (const r of [...visitorReviews, ...receiptReviews]) {
      const key = r.text.trim();
      if (!seen.has(key)) {
        seen.add(key);
        allReviews.push(r);
      }
    }

    _log(`[Crawler] ${allReviews.length} unique reviews, matching against ${instructors.length} instructors`);

    for (const raw of allReviews) {
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
    _log(`[Crawler] ${matched.length}/${result.reviews.length} reviews matched`);
    for (const inst of instructors) {
      const count = matched.filter(r => r.matchedInstructorId === inst.id).length;
      if (count > 0) _log(`[Crawler]   ${inst.name}: ${count} reviews`);
    }
  } catch (err) {
    result.error = err.message;
    console.error('[Crawler] Error:', err.message);
  }

  // Also crawl booking (reservation) reviews — fails silently if no booking tab
  try {
    const bookingResult = await crawlBookingReviews(placeUrl);
    if (bookingResult.reviews.length > 0) {
      result.reviews.push(...bookingResult.reviews);
      _log(`[Crawler] Total with booking: ${result.reviews.length} reviews`);
    }
  } catch (err) {
    console.warn(`[Crawler] Booking crawl skipped: ${err.message}`);
  }

  return result;
}

/**
 * Fetch reviews for a specific tab (visitor or receipt).
 * Returns an array of { text, date } objects, never throws.
 */
async function _fetchReviewsForTab(placeId, tab) {
  try {
    // Use mobile page directly — it has Apollo state with accurate created dates.
    // The PC API (_fetchReviewsViaApi) often returns reviews without dates,
    // causing all reviews to fallback to today's date.
    const reviews = await _fetchReviewsViaHtml(placeId, tab);
    _log(`[Crawler] _fetchReviewsViaHtml(${tab}): ${reviews ? reviews.length + ' reviews' : 'empty'}`);
    if (reviews && reviews.length > 0) {
      _log(`[Crawler] dates sample:`, reviews.slice(0, 3).map(r => r.date));
    }
    return reviews || [];
  } catch (err) {
    console.warn(`[Crawler] Failed to fetch ${tab} reviews: ${err.message}`);
    return [];
  }
}

/**
 * Fetch reviews via Naver Place API (JSON endpoint).
 * @param {string} tab - 'visitor' or 'receipt'
 */
async function _fetchReviewsViaApi(placeId, tab = 'visitor') {
  const reviews = [];
  const PAGE_SIZE = 50;
  const MAX_PAGES = 4;

  for (let page = 1; page <= MAX_PAGES; page++) {
    try {
      const url = `https://pcmap.place.naver.com/place/${placeId}/review/${tab}?reviewSort=recent&page=${page}`;
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
 * Parses Apollo state JSON embedded in script tags for VisitorReview objects.
 * @param {string} tab - 'visitor' or 'receipt'
 * @param {string} [bizItemId] - optional booking item ID to filter reviews
 */
async function _fetchReviewsViaHtml(placeId, tab = 'visitor', bizItemId = null) {
  const reviews = [];

  try {
    // Mobile page contains Apollo state JSON with full review data
    let url = `https://m.place.naver.com/restaurant/${placeId}/review/${tab}?reviewSort=recent`;
    if (bizItemId) url += `&bizItemId=${bizItemId}`;
    const html = await fetchHtml(url, { 'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1' });

    const $ = cheerio.load(html);

    // Extract VisitorReview objects from Apollo state in script tags
    // Naver embeds Apollo cache as JSON in scripts with structure:
    //   "VisitorReview:<id>:true": { "body":"...", "created":"M.D.요일", ... }
    $('script').each((_, script) => {
      if (reviews.length > 0) return; // already found
      const content = $(script).html() || '';
      if (!content.includes('"body"') || content.length < 5000) return;

      try {
        // Strategy: find "VisitorReview:<id>:true" keys, then extract body+created
        // from each object block (delimited by the next top-level key)
        const seen = new Set();
        const vrKeyRegex = /"VisitorReview:([a-f0-9]+):true":\{/g;
        let keyMatch;

        while ((keyMatch = vrKeyRegex.exec(content)) !== null) {
          const startIdx = keyMatch.index + keyMatch[0].length;
          // Find a reasonable chunk (review objects are typically 500-1500 chars)
          const chunk = content.substring(startIdx, startIdx + 2000);

          // Must be a VisitorReview object (not a reference)
          if (!chunk.includes('"__typename":"VisitorReview"')) continue;

          // Extract body
          const bodyMatch = chunk.match(/"body":"((?:[^"\\]|\\.)*)"/);
          if (!bodyMatch) continue;
          const text = bodyMatch[1]
            .replace(/\\n/g, '\n')
            .replace(/\\"/g, '"')
            .replace(/\\u002F/g, '/');
          if (text.length < 5) continue;

          // Deduplicate by first 50 chars of body text
          const dedupeKey = text.substring(0, 50);
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);

          // Extract date from "created" field (format: "M.D.요일" e.g. "3.9.월")
          let dateStr = '';
          const createdMatch = chunk.match(/"created":"([^"]+)"/);
          if (createdMatch) {
            dateStr = _parseNaverShortDate(createdMatch[1]);
          }
          // Fallback: try "visited" field
          if (!dateStr) {
            const visitedMatch = chunk.match(/"visited":"([^"]+)"/);
            if (visitedMatch) {
              dateStr = _parseNaverShortDate(visitedMatch[1]);
            }
          }
          // Last resort: try thumbnail filename for date (e.g. 20260309_185858.jpg)
          if (!dateStr) {
            const filenameDateMatch = chunk.match(/(\d{4})(\d{2})(\d{2})_\d{6}\.\w+/);
            if (filenameDateMatch) {
              dateStr = `${filenameDateMatch[1]}-${filenameDateMatch[2]}-${filenameDateMatch[3]}`;
            }
          }
          if (!dateStr) dateStr = new Date().toISOString().slice(0, 10);

          reviews.push({ text, date: dateStr });
        }
      } catch { /* parse error */ }

      // Fallback: simple body-only extraction if Apollo parsing got nothing
      if (reviews.length === 0) {
        try {
          const bodyRegex = /"body"\s*:\s*"((?:[^"\\]|\\.)*)"/g;
          let m;
          while ((m = bodyRegex.exec(content)) !== null) {
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
 * Parse Naver's short date format: "M.D.요일" (e.g. "3.9.월", "12.25.수")
 * Year is inferred: if the date is in the future, use last year.
 * Also handles "N월 N일" format.
 * @returns {string} YYYY-MM-DD or empty string
 */
function _parseNaverShortDate(str) {
  if (!str) return '';
  const trimmed = str.trim();

  // Format with year: "YY.M.D.요일" (e.g. "25.2.24.월" = 2025-02-24)
  const longMatch = trimmed.match(/^(\d{2})\.(\d{1,2})\.(\d{1,2})\.[월화수목금토일]/);
  if (longMatch) {
    const year = 2000 + parseInt(longMatch[1], 10);
    const month = parseInt(longMatch[2], 10);
    const day = parseInt(longMatch[3], 10);
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Format without year: "M.D.요일" (e.g. "3.9.월")
  const shortMatch = trimmed.match(/^(\d{1,2})\.(\d{1,2})\.[월화수목금토일]/);
  if (shortMatch) {
    const month = parseInt(shortMatch[1], 10);
    const day = parseInt(shortMatch[2], 10);
    const now = new Date();
    let year = now.getFullYear();

    // If the date would be in the future, it's from last year
    const candidate = new Date(year, month - 1, day);
    if (candidate > now) year--;

    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  }

  // Try existing _normalizeDate for other formats (relative dates, etc.)
  return _normalizeDate(trimmed);
}

/**
 * Normalize a date string to YYYY-MM-DD format.
 * Handles absolute dates, Korean dates, dot format, and relative dates.
 *
 * Relative date conversions:
 *   "오늘"        → today's date
 *   "어제"        → yesterday
 *   "N일 전"      → today minus N days
 *   "N시간 전"    → today (same day)
 *   "N분 전"      → today (same day)
 *   "1주일 전"    → today minus 7 days
 *   "N주일 전"    → today minus N*7 days
 *   "1개월 전"    → first day of last month
 *   "N개월 전"    → first day of N months ago
 *   "YYYY.MM.DD"  → parse directly
 */
function _normalizeDate(dateStr) {
  if (!dateStr) return '';

  const trimmed = dateStr.trim();

  // ISO format
  if (trimmed.match(/^\d{4}-\d{2}-\d{2}/)) {
    return trimmed.slice(0, 10);
  }

  // "오늘" → today
  if (trimmed === '오늘') {
    return new Date().toISOString().slice(0, 10);
  }

  // "어제" → yesterday
  if (trimmed === '어제') {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  // Korean format: 2024년 3월 15일
  const korMatch = trimmed.match(/(\d{4})년\s*(\d{1,2})월\s*(\d{1,2})일/);
  if (korMatch) {
    return `${korMatch[1]}-${korMatch[2].padStart(2, '0')}-${korMatch[3].padStart(2, '0')}`;
  }

  // Dot format: 2024.03.15 or 24.03.15
  const dotMatch = trimmed.match(/(\d{2,4})\.(\d{1,2})\.(\d{1,2})/);
  if (dotMatch) {
    let year = parseInt(dotMatch[1], 10);
    if (year < 100) year += 2000;
    return `${year}-${dotMatch[2].padStart(2, '0')}-${dotMatch[3].padStart(2, '0')}`;
  }

  // Relative: N개월 전 → first day of N months ago
  const monthMatch = trimmed.match(/(\d+)\s*개월\s*전/);
  if (monthMatch) {
    const n = parseInt(monthMatch[1], 10);
    const d = new Date();
    d.setMonth(d.getMonth() - n, 1);
    return d.toISOString().slice(0, 10);
  }

  // Relative: N주일 전 → today minus N*7 days
  const weekMatch = trimmed.match(/(\d+)\s*주일?\s*전/);
  if (weekMatch) {
    const n = parseInt(weekMatch[1], 10);
    const d = new Date();
    d.setDate(d.getDate() - n * 7);
    return d.toISOString().slice(0, 10);
  }

  // Relative: N일/시간/분 전
  const relMatch = trimmed.match(/(\d+)\s*(일|시간|분)\s*전/);
  if (relMatch) {
    const num = parseInt(relMatch[1], 10);
    const unit = relMatch[2];
    const now = new Date();
    if (unit === '일') now.setDate(now.getDate() - num);
    // 시간/분 → same day
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

// ═══ Booking (Reservation) Review Crawling ═══

/**
 * Extract businessId from a Naver Place booking page.
 * The booking page embeds businessId in script tags or Apollo state.
 */
async function _fetchBusinessId(placeId) {
  try {
    const url = `https://m.place.naver.com/restaurant/${placeId}/booking`;
    const html = await fetchHtml(url, {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    });

    // Look for businessId — bizes/ pattern is most reliable (excludes placeId)
    const patterns = [
      /bizes\/(\d+)/,
      /bookingBusinessId["':=\s]+["']?(\d+)/,
      /"businessId":"(\d+)"/,
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        _log(`[Crawler] Found businessId: ${match[1]} for placeId: ${placeId}`);
        return match[1];
      }
    }

    _log(`[Crawler] No businessId found for placeId: ${placeId} (no booking tab)`);
    return null;
  } catch (err) {
    console.warn(`[Crawler] Failed to fetch businessId: ${err.message}`);
    return null;
  }
}

/**
 * Fetch booking items (bizItems) via Naver Place GraphQL API.
 * Returns array of { bizItemId, name, businessId }.
 */
async function _fetchBizItems(businessId) {
  const query = `query bizItems($input: BizItemsParams, $withReviewStat: Boolean = false) {
  bizItems(input: $input) {
    bizItemId
    businessId
    name
    reviewStatDetails @include(if: $withReviewStat) {
      totalCount
      avgRating
    }
    __typename
  }
}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch('https://m.booking.naver.com/graphql', {
      method: 'POST',
      headers: {
        ...HEADERS,
        'Content-Type': 'application/json',
        'Referer': 'https://m.place.naver.com/',
      },
      body: JSON.stringify({
        operationName: 'bizItems',
        query,
        variables: {
          input: { businessId, lang: 'ko', projections: 'RESOURCE' },
          withReviewStat: true,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    const items = data?.data?.bizItems || [];
    _log(`[Crawler] Found ${items.length} booking items for businessId: ${businessId}`);
    return items.map(item => ({
      bizItemId: item.bizItemId,
      name: item.name,
      businessId: item.businessId,
      reviewCount: item.reviewStatDetails?.totalCount || 0,
    }));
  } catch (err) {
    console.warn(`[Crawler] Failed to fetch bizItems: ${err.message}`);
    return [];
  }
}

/**
 * Fetch reviews for a specific booking item via GraphQL API.
 * Uses the Naver Place review GraphQL endpoint with bizItemId filter.
 * Returns array of { text, date }.
 */
/**
 * Fetch ALL receipt reviews with booking item info from Apollo state.
 * Returns array of { text, date, bizItemId, bizItemName }.
 */
async function _fetchReceiptReviewsWithBookingInfo(placeId) {
  const reviews = [];
  try {
    const url = `https://m.place.naver.com/restaurant/${placeId}/review/receipt?reviewSort=recent`;
    const html = await fetchHtml(url, {
      'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    });
    const $ = cheerio.load(html);

    $('script').each((_, script) => {
      if (reviews.length > 0) return;
      const content = $(script).html() || '';
      if (!content.includes('"body"') || content.length < 5000) return;

      try {
        // Find VisitorReview objects and extract body + visit items
        const vrKeyRegex = /"VisitorReview:([a-f0-9]+):true":\{/g;
        const seen = new Set();
        let keyMatch;

        while ((keyMatch = vrKeyRegex.exec(content)) !== null) {
          const reviewId = keyMatch[1];
          const startIdx = keyMatch.index + keyMatch[0].length;
          const chunk = content.substring(startIdx, startIdx + 3000);

          if (!chunk.includes('"__typename":"VisitorReview"')) continue;

          // Extract body
          const bodyMatch = chunk.match(/"body":"((?:[^"\\]|\\.)*)"/);
          if (!bodyMatch) continue;
          const text = bodyMatch[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\u002F/g, '/');
          if (text.length < 5) continue;

          const dedupeKey = text.substring(0, 50);
          if (seen.has(dedupeKey)) continue;
          seen.add(dedupeKey);

          // Extract date
          let dateStr = '';
          const createdMatch = chunk.match(/"created":"([^"]+)"/);
          if (createdMatch) dateStr = _parseNaverShortDate(createdMatch[1]);
          if (!dateStr) {
            const visitedMatch = chunk.match(/"visited":"([^"]+)"/);
            if (visitedMatch) dateStr = _parseNaverShortDate(visitedMatch[1]);
          }
          if (!dateStr) dateStr = new Date().toISOString().slice(0, 10);

          // Try to find the associated Visit object with booking item info
          // Look for Visit:<id> that references this review
          let bizItemId = null;
          let bizItemName = null;

          // Search for the visit reference in the same review chunk
          // The visit object has "items" which contains the booking item
          const visitRef = content.match(new RegExp(`"Visit:[^"]*":\\{[^}]*"reviewGroupId":"${reviewId}"[^}]*\\}`));
          if (visitRef) {
            const visitChunk = content.substring(visitRef.index, visitRef.index + 2000);
            const itemIdMatch = visitChunk.match(/"items":\[\{"id":"(\d+)"/);
            if (itemIdMatch) bizItemId = itemIdMatch[1];
            const itemNameMatch = visitChunk.match(/"items":\[\{[^}]*"name":"((?:[^"\\]|\\.)*)"/);
            if (itemNameMatch) bizItemName = itemNameMatch[1].replace(/\\"/g, '"');
          }

          // Alternative: look for bookingItemId pattern near the review
          if (!bizItemId) {
            const nearbyContent = content.substring(Math.max(0, keyMatch.index - 2000), startIdx + 3000);
            const bizMatch = nearbyContent.match(/"bizItemId":"(\d+)"/);
            if (bizMatch) bizItemId = bizMatch[1];
          }

          reviews.push({ text, date: dateStr, bizItemId, bizItemName });
        }
      } catch { /* parse error */ }
    });
  } catch (err) {
    console.error(`[Crawler] Receipt reviews with booking info failed: ${err.message}`);
  }
  return reviews;
}

async function _fetchBookingItemReviews(placeId, bizItemId, businessId, size = 50) {
  // Fallback: try Node.js fetch with correct ReviewParams format
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const res = await fetch(`https://m.booking.naver.com/graphql?opName=review`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://m.booking.naver.com/',
        'Origin': 'https://m.booking.naver.com',
      },
      body: JSON.stringify({
        operationName: 'review',
        variables: {
          reviewParams: {
            businessId: String(businessId),
            bizItemId: String(bizItemId),
            bizItemType: 'STANDARD',
            size,
            isProgramBizItem: false,
          },
        },
        query: 'query review($reviewParams: ReviewParams) { review(input: $reviewParams) { id reviewCount totalCount reviews { id body completedDateTime useDate visit __typename } __typename } }',
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!res.ok) {
      _log(`[Crawler] Node.js GraphQL returned ${res.status} for ${bizItemId}`);
      return [];
    }

    const data = await res.json();
    if (data.errors) {
      _log(`[Crawler] GraphQL errors for ${bizItemId}: ${JSON.stringify(data.errors[0]?.message || '').substring(0, 100)}`);
      return [];
    }

    const reviews = data?.data?.review?.reviews || [];
    return reviews.map(r => {
      const visit = typeof r.visit === 'string' ? JSON.parse(r.visit) : r.visit;
      const dateStr = visit?.visitDateTime || r.completedDateTime || r.useDate;
      let date = null;
      if (dateStr) {
        const d = new Date(dateStr);
        if (!isNaN(d.getTime())) date = d.toISOString().split('T')[0];
      }
      return { text: (r.body || '').trim(), date: date || new Date().toISOString().split('T')[0] };
    }).filter(r => r.text);
  } catch (err) {
    _log(`[Crawler] Node.js booking review fetch failed (${bizItemId}): ${err.message}`);
    return [];
  }
}

/**
 * Crawl booking (reservation) reviews from Naver Place.
 * Matches booking items to instructors by name/keywords,
 * then fetches reviews for each matched item.
 */
async function crawlBookingReviews(placeUrl) {
  const result = { reviews: [], error: null };

  if (!placeUrl) return result;

  const placeId = extractPlaceId(placeUrl);
  if (!placeId) return result;

  const instructors = db.getAllInstructors();
  if (instructors.length === 0) return result;

  try {
    // Step 1: Get businessId from booking page
    const businessId = await _fetchBusinessId(placeId);
    if (!businessId) {
      console.log('[Crawler] No booking tab — skipping booking review crawl');
      return result;
    }

    // Step 2: Get booking items
    const bizItems = await _fetchBizItems(businessId);
    if (bizItems.length === 0) return result;

    // Step 3: Match booking items to instructors
    const matchedItems = [];
    for (const item of bizItems) {
      const match = matchInstructor(item.name, instructors);
      if (match) {
        matchedItems.push({
          ...item,
          instructorId: match.instructor.id,
          instructorName: match.instructor.name,
          matchedKeyword: match.matchedKeyword,
        });
      }
    }

    _log(`[Crawler] Matched ${matchedItems.length}/${bizItems.length} booking items to instructors`);
    for (const m of matchedItems) {
      _log(`[Crawler]   ${m.name} → ${m.instructorName} (keyword: ${m.matchedKeyword})`);
    }

    // Step 4: Use Electron BrowserWindow to fetch reviews via GraphQL (with real browser cookies)
    _log(`[Crawler] Fetching booking reviews via Electron headless browser...`);

    for (const item of matchedItems) {
      try {
        const reviews = await _fetchBookingReviewsViaElectron(placeId, item.bizItemId, item.businessId);
        _log(`[Crawler] ${item.instructorName}: ${reviews.length} booking reviews (Electron)`);

        for (const raw of reviews) {
          result.reviews.push({
            text: raw.text, date: raw.date,
            matchedInstructorId: item.instructorId,
            matchedKeyword: item.matchedKeyword,
            source: 'booking',
          });
          db.addReview({
            review_text: raw.text,
            review_date: raw.date,
            matched_instructor_id: item.instructorId,
          });
        }
      } catch (err) {
        _log(`[Crawler] ${item.instructorName} Electron fetch error: ${err.message}`);
      }

      await delay(300 + Math.random() * 300);
    }

    _log(`[Crawler] Booking total: ${result.reviews.length} reviews collected`);
  } catch (err) {
    result.error = err.message;
    console.error('[Crawler] Booking crawl error:', err.message);
  }

  return result;
}

/**
 * Fetch booking item reviews using Electron's hidden BrowserWindow.
 * This gives us real Chromium cookies/session so the GraphQL API works.
 */
async function _fetchBookingReviewsViaElectron(placeId, bizItemId, businessId) {
  const { BrowserWindow } = require('electron');

  return new Promise((resolve) => {
    let win = null;
    const timeout = setTimeout(() => {
      if (win && !win.isDestroyed()) win.close();
      resolve([]);
    }, 30000);

    try {
      win = new BrowserWindow({
        show: false,
        width: 800,
        height: 600,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: false, // Disable CORS for headless GraphQL requests
        },
      });

      // Navigate to m.booking.naver.com (same origin as the GraphQL API)
      const placeUrl = `https://m.booking.naver.com/booking/12/bizes/${businessId}/items/${bizItemId}`;

      win.webContents.on('did-finish-load', async () => {
        try {
          // Execute GraphQL fetch from within the browser context (has cookies)
          const reviewData = await win.webContents.executeJavaScript(`
            (async () => {
              try {
                const res = await fetch('https://m.booking.naver.com/graphql?opName=review', {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    operationName: 'review',
                    variables: {
                      reviewParams: {
                        businessId: '${businessId}',
                        bizItemId: '${bizItemId}',
                        bizItemType: 'STANDARD',
                        size: 50,
                        isProgramBizItem: false,
                      },
                    },
                    query: 'query review($reviewParams: ReviewParams) { review(input: $reviewParams) { id reviewCount totalCount reviews { id body completedDateTime useDate visit __typename } __typename } }',
                  }),
                });

                if (!res.ok) {
                  const text = await res.text().catch(() => '');
                  return { error: 'HTTP ' + res.status, body: text.substring(0, 500) };
                }
                const data = await res.json();
                if (data.errors) return { error: JSON.stringify(data.errors[0]) };
                return data;
              } catch (e) {
                return { error: e.message };
              }
            })()
          `);

          clearTimeout(timeout);
          if (win && !win.isDestroyed()) win.close();

          if (reviewData?.error) {
            _log(`[Crawler] Electron GraphQL error for ${bizItemId}: ${reviewData.error}${reviewData.body ? ' | Body: ' + reviewData.body.substring(0, 200) : ''}`);
            resolve([]);
            return;
          }

          const reviews = reviewData?.data?.review?.reviews || [];
          // Debug: log first review structure to understand fields
          if (reviews.length > 0) {
            _log('[Crawler] Sample review keys: ' + Object.keys(reviews[0]).join(', '));
            _log('[Crawler] Sample review dates: completedDateTime=' + reviews[0].completedDateTime + ' useDate=' + reviews[0].useDate + ' visit=' + JSON.stringify(reviews[0].visit)?.substring(0, 200));
          }
          const parsed = reviews.map(r => {
            // visit is JSON type, may be object or string
            let visit = null;
            try { visit = typeof r.visit === 'string' ? JSON.parse(r.visit) : r.visit; } catch {}
            const dateStr = visit?.visitDateTime || r.completedDateTime || r.useDate;
            let date = null;
            if (dateStr) {
              const d = new Date(dateStr);
              if (!isNaN(d.getTime())) date = d.toISOString().split('T')[0];
            }
            if (!date) _log('[Crawler] WARNING: no date for review: ' + (r.body || '').substring(0, 30));
            return {
              text: (r.body || '').trim(),
              date: date || new Date().toISOString().split('T')[0],
            };
          }).filter(r => r.text);

          resolve(parsed);
        } catch (err) {
          clearTimeout(timeout);
          if (win && !win.isDestroyed()) win.close();
          _log(`[Crawler] Electron JS exec error: ${err.message}`);
          resolve([]);
        }
      });

      win.webContents.on('did-fail-load', () => {
        clearTimeout(timeout);
        if (win && !win.isDestroyed()) win.close();
        resolve([]);
      });

      win.loadURL(placeUrl);
    } catch (err) {
      clearTimeout(timeout);
      if (win && !win.isDestroyed()) win.close();
      _log(`[Crawler] Electron window error: ${err.message}`);
      resolve([]);
    }
  });
}

// No browser to close, but keep the export for compatibility
async function closeBrowser() { /* noop */ }
async function getBrowser() { return null; }

module.exports = {
  crawlNaverPlaceReviews,
  crawlBookingReviews,
  crawlBlogPost,
  closeBrowser,
  getBrowser,
};
