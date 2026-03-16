const cron = require('node-cron');
const db = require('../data/db');
const { determineStatus } = require('./alertEngine');
const { getWeekRange } = require('./weeklyReport');
const IPC = require('../../../shared/ipc-channels');

let mainWindow = null;
let _collecting = false;

function getThisWednesday() {
  const now = new Date();
  const day = now.getDay();
  const diff = day <= 3 ? 3 - day : 3 - day;
  const wed = new Date(now);
  wed.setDate(now.getDate() + diff);
  wed.setHours(0, 0, 0, 0);
  return wed;
}

/**
 * Run full data collection: RSS feeds + Naver Place reviews.
 * Returns summary of what was collected.
 */
async function runFullCollection() {
  if (_collecting) {
    console.log('[Scheduler] Collection already in progress, skipping');
    return null;
  }
  _collecting = true;

  // Notify renderer that collection started
  _sendToRenderer('collection-status', { collecting: true });

  const summary = { rss: [], reviews: 0, errors: [] };

  try {
    const instructors = db.getAllInstructors();
    if (instructors.length === 0) {
      console.log('[Scheduler] No instructors — skipping collection');
      return summary;
    }

    // 1. RSS collection
    console.log('[Scheduler] Collecting RSS feeds...');
    try {
      const { refreshAllFeeds } = require('../data/rss');
      const rssResults = await refreshAllFeeds();
      for (const r of rssResults) {
        console.log(`[RSS] ${r.name}: +${r.added} new (${r.total} in feed)${r.error ? ' ERROR: ' + r.error : ''}`);
        summary.rss.push(r);
      }
    } catch (err) {
      console.error('[Scheduler] RSS failed:', err.message);
      summary.errors.push('RSS: ' + err.message);
    }

    // 2. Naver Place review crawl
    const placeUrl = db.getSetting('naver_place_url');
    if (placeUrl) {
      console.log('[Scheduler] Crawling Naver Place reviews...');
      try {
        const { crawlNaverPlaceReviews } = require('../data/crawler');
        const result = await crawlNaverPlaceReviews(placeUrl);
        summary.reviews = result.reviews.length;
        if (result.error) summary.errors.push('Crawler: ' + result.error);
      } catch (err) {
        console.error('[Scheduler] Crawler failed:', err.message, err.stack);
        summary.errors.push('Crawler: ' + err.message);
      }
    }

    // 3. Auto-analyze any unanalyzed blog posts
    console.log('[Scheduler] Running SEO analysis on unanalyzed posts...');
    try {
      const seoResults = await analyzeUnanalyzedPosts();
      if (seoResults.length > 0) {
        console.log(`[Scheduler] Analyzed ${seoResults.length} posts`);
      } else {
        console.log('[Scheduler] No unanalyzed posts found');
      }
    } catch (err) {
      console.error('[Scheduler] SEO analysis failed:', err.message);
      summary.errors.push('SEO: ' + err.message);
    }

    // Record collection time
    db.setSetting('last_collection', new Date().toISOString());
    console.log('[Scheduler] Collection complete');
  } finally {
    _collecting = false;
    _sendToRenderer('collection-status', { collecting: false, completedAt: new Date().toISOString() });
  }

  return summary;
}

/**
 * Run the weekly check for all active instructors.
 * First collects data, then evaluates status.
 */
async function runWeeklyCheck() {
  try {
    // Collect fresh data first
    await runFullCollection();

    const instructors = db.getAllInstructors().filter((i) => i.is_active);
    const { start, end } = getWeekRange();
    const results = [];

    for (const inst of instructors) {
      const blogCount = db.getBlogCount(inst.id, start, end);
      const reviewCount = db.getReviewCount(inst.id, start, end);
      const avgSeo = db.getAvgSeoScore(inst.id, start, end);
      const status = determineStatus(inst.id, blogCount, reviewCount);

      db.saveWeeklyCheck({
        check_date: new Date().toISOString().slice(0, 10),
        instructor_id: inst.id,
        blog_count: blogCount,
        review_count: reviewCount,
        avg_seo_score: avgSeo ?? null,
        status,
        week_start: start,
        week_end: end,
      });

      results.push({
        instructorId: inst.id,
        name: inst.name,
        blogCount,
        reviewCount,
        avgSeo,
        status,
      });
    }

    db.setSetting('last_weekly_check', new Date().toISOString());

    // Notify renderer
    _sendToRenderer(IPC.WEEKLY_CHECK_DONE, results);

    console.log(`[Scheduler] Weekly check: ${results.length} instructors evaluated`);
    for (const r of results) {
      console.log(`[Scheduler]   ${r.name}: blog=${r.blogCount} review=${r.reviewCount} → ${r.status}`);
    }
    return results;
  } catch (err) {
    console.error('[Scheduler] Weekly check failed:', err);
    throw err;
  }
}

/**
 * On startup, run collection immediately.
 * If weekly check hasn't run this week, also run weekly check.
 */
async function checkOnStartup() {
  const hasInstructors = db.getAllInstructors().length > 0;
  if (!hasInstructors) {
    console.log('[Scheduler] No instructors yet — waiting for license activation');
    return;
  }

  // Always collect on startup
  console.log('[Scheduler] Running startup collection...');
  await runFullCollection();

  // Check if weekly check needs to run
  const lastCheck = db.getSetting('last_weekly_check');
  const thisWed = getThisWednesday();

  if (!lastCheck || new Date(lastCheck) < thisWed) {
    console.log('[Scheduler] Weekly check not yet run this week — running now');
    // Weekly check already collected data via runFullCollection above,
    // so we just evaluate status
    const instructors = db.getAllInstructors().filter((i) => i.is_active);
    const { start, end } = getWeekRange();
    const results = [];

    for (const inst of instructors) {
      const blogCount = db.getBlogCount(inst.id, start, end);
      const reviewCount = db.getReviewCount(inst.id, start, end);
      const avgSeo = db.getAvgSeoScore(inst.id, start, end);
      const status = determineStatus(inst.id, blogCount, reviewCount);

      db.saveWeeklyCheck({
        check_date: new Date().toISOString().slice(0, 10),
        instructor_id: inst.id,
        blog_count: blogCount,
        review_count: reviewCount,
        avg_seo_score: avgSeo ?? null,
        status,
        week_start: start,
        week_end: end,
      });

      results.push({ instructorId: inst.id, name: inst.name, blogCount, reviewCount, avgSeo, status });
    }

    db.setSetting('last_weekly_check', new Date().toISOString());
    _sendToRenderer(IPC.WEEKLY_CHECK_DONE, results);

    console.log(`[Scheduler] Startup weekly check: ${results.length} instructors`);
    for (const r of results) {
      console.log(`[Scheduler]   ${r.name}: blog=${r.blogCount} review=${r.reviewCount} → ${r.status}`);
    }
  } else {
    console.log('[Scheduler] Weekly check already done this week');
  }
}

/**
 * Initialize the scheduler.
 * @param {Electron.BrowserWindow} win
 */
function startScheduler(win) {
  mainWindow = win;

  // Wednesday 9AM cron
  cron.schedule('0 9 * * 3', () => {
    console.log('[Scheduler] Cron triggered — Wednesday 9AM weekly check');
    runWeeklyCheck();
  });

  // Run startup collection (non-blocking — don't await)
  checkOnStartup().catch(err => {
    console.error('[Scheduler] Startup check failed:', err.message);
  });

  console.log('[Scheduler] Initialized (cron: Wed 09:00, startup collection running)');
}

function _sendToRenderer(channel, data) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    try { mainWindow.webContents.send(channel, data); } catch { /* window closing */ }
  }
}

function isCollecting() {
  return _collecting;
}

/**
 * Analyze unanalyzed blog posts for one or all instructors.
 * Crawls each post via Puppeteer and runs seoAnalyzer.
 * @param {number} [instructorId] - if provided, only analyze for this instructor
 * @returns {Promise<Array>} analysis results
 */
async function analyzeUnanalyzedPosts(instructorId) {
  const { analyzeSeoPost } = require('../data/seoAnalyzer');
  const { crawlBlogPost } = require('../data/crawler');

  const instructors = instructorId
    ? [db.getInstructor(instructorId)].filter(Boolean)
    : db.getAllInstructors();

  const now = new Date();
  const weekEnd = new Date(now);
  weekEnd.setDate(weekEnd.getDate() + 1);

  // Look back 90 days for unanalyzed posts
  const lookback = new Date(now);
  lookback.setDate(lookback.getDate() - 90);

  const results = [];

  for (const instructor of instructors) {
    const posts = db.getUnanalyzedPosts(instructor.id, lookback.toISOString(), weekEnd.toISOString());

    if (posts.length === 0) continue;
    console.log(`[SEO] ${instructor.name}: ${posts.length} unanalyzed posts`);

    for (const post of posts) {
      try {
        console.log(`[SEO] Analyzing: ${post.post_title || post.post_url}`);
        const crawlResult = await crawlBlogPost(post.post_url);

        if (crawlResult.error) {
          console.error(`[SEO] Crawl error for ${post.post_url}:`, crawlResult.error);
          continue;
        }

        // Find previous post date for cycle scoring
        const prevPosts = db.getUnanalyzedPosts(instructor.id, '2000-01-01', post.published_at);
        const previousPostDate = prevPosts.length > 0
          ? prevPosts[prevPosts.length - 1].published_at
          : null;

        const analysis = analyzeSeoPost(post, instructor, {
          content: crawlResult.content,
          html: crawlResult.html,
          previousPostDate,
        });

        db.saveSeoResult({
          post_id: post.id,
          instructor_id: instructor.id,
          total_score: analysis.totalScore,
          grade: analysis.grade,
          score_title: analysis.scores.score_title,
          score_body: analysis.scores.score_body,
          score_keyword: analysis.scores.score_keyword,
          score_image: analysis.scores.score_image,
          score_internal_link: analysis.scores.score_internal_link,
          score_tag: analysis.scores.score_tag,
          score_cycle: analysis.scores.score_cycle,
          score_quality: analysis.scores.score_quality,
          detail_json: analysis.detail,
          checklist_json: analysis.checklist,
        });

        console.log(`[SEO] ${post.post_title}: ${analysis.totalScore}점 (${analysis.grade})`);
        results.push({
          postId: post.id,
          instructorId: instructor.id,
          totalScore: analysis.totalScore,
          grade: analysis.grade,
        });
      } catch (err) {
        console.error(`[SEO] Error analyzing post ${post.id}:`, err.message);
      }
    }
  }

  return results;
}

module.exports = {
  startScheduler,
  runWeeklyCheck,
  runFullCollection,
  checkOnStartup,
  getThisWednesday,
  isCollecting,
  analyzeUnanalyzedPosts,
};
