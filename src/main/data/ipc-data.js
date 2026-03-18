'use strict';

const { ipcMain } = require('electron');
const channels = require('../../../shared/ipc-channels');
const db = require('./db');
const { refreshAllFeeds } = require('./rss');
const { analyzeSeoPost } = require('./seoAnalyzer');
const { crawlBlogPost } = require('./crawler');
const { getWeekRangeISO, getMonthRangeISO } = require('./dateRanges');

/**
 * Register all data-related IPC handlers.
 * Called once from main.js during app initialization.
 */
function registerDataIpcHandlers() {

  // ─── GET_DASHBOARD_DATA ─────────────────────────────────────────────────
  // Returns all instructors with their blog counts, review counts, and recent SEO results
  ipcMain.handle(channels.GET_DASHBOARD_DATA, async () => {
    try {
      const instructors = db.getAllInstructors();
      const { start: weekStart, end: weekEnd } = getWeekRangeISO();
      const { start: monthStart, end: monthEnd } = getMonthRangeISO();

      const plan = db.getSetting('plan') || 'free';
      const { PLANS } = require('../../../shared/constants');
      const planKey = plan.toUpperCase();
      const seoDepth = (PLANS[planKey] && PLANS[planKey].seoHistoryDepth) || 3;

      const dashboardData = instructors.map((instructor) => {
        const blogCountWeek = db.getBlogCount(instructor.id, weekStart, weekEnd);
        const blogCountMonth = db.getBlogCountMonth(instructor.id, monthStart, monthEnd);
        const reviewCountWeek = db.getReviewCount(instructor.id, weekStart, weekEnd);
        const reviewCountMonth = db.getReviewCountMonth(instructor.id, monthStart, monthEnd);
        const seoResults = db.getSeoResults(instructor.id, seoDepth);
        const lastWeekStatus = db.getLastWeekStatus(instructor.id);

        return {
          ...instructor,
          blogCountWeek,
          blogCountMonth,
          reviewCountWeek,
          reviewCountMonth,
          seoResults,
          status: lastWeekStatus ? lastWeekStatus.status : 'ok',
        };
      });

      return { success: true, data: dashboardData };
    } catch (err) {
      console.error('GET_DASHBOARD_DATA error:', err);
      return { success: false, error: err.message };
    }
  });

  // ─── TRIGGER_RSS_REFRESH ────────────────────────────────────────────────
  // Refresh all RSS feeds and return results
  ipcMain.handle(channels.TRIGGER_RSS_REFRESH, async () => {
    try {
      const results = await refreshAllFeeds();
      return { success: true, data: results };
    } catch (err) {
      console.error('TRIGGER_RSS_REFRESH error:', err);
      return { success: false, error: err.message };
    }
  });

  // ─── GET_SEO_RESULTS ───────────────────────────────────────────────────
  // Get SEO results for a specific instructor
  ipcMain.handle(channels.GET_SEO_RESULTS, async (_event, { instructorId, limit }) => {
    try {
      const results = db.getSeoResults(instructorId, limit || 10);
      return { success: true, data: results };
    } catch (err) {
      console.error('GET_SEO_RESULTS error:', err);
      return { success: false, error: err.message };
    }
  });

  // ─── TRIGGER_SEO_ANALYZE ──────────────────────────────────────────────
  // Analyze unanalyzed blog posts for a specific instructor (or all)
  ipcMain.handle(channels.TRIGGER_SEO_ANALYZE, async (_event, { instructorId } = {}) => {
    try {
      const instructors = instructorId
        ? [db.getInstructor(instructorId)].filter(Boolean)
        : db.getAllInstructors();

      const { start: weekStart, end: weekEnd } = getWeekRangeISO();
      const results = [];

      for (const instructor of instructors) {
        // Get unanalyzed posts from this week (or broader range)
        const broadStart = new Date();
        broadStart.setDate(broadStart.getDate() - 90); // Look back 90 days for unanalyzed posts
        const posts = db.getUnanalyzedPosts(instructor.id, broadStart.toISOString(), weekEnd);

        for (const post of posts) {
          try {
            // Crawl the post content
            const crawlResult = await crawlBlogPost(post.post_url);

            if (crawlResult.error) {
              console.error(`Crawl error for ${post.post_url}:`, crawlResult.error);
              continue;
            }

            // Find previous post date for cycle scoring
            const allPosts = db.getUnanalyzedPosts(instructor.id, '2000-01-01', post.published_at);
            const previousPostDate = allPosts.length > 0
              ? allPosts[allPosts.length - 1].published_at
              : null;

            // Analyze SEO
            const analysis = analyzeSeoPost(post, instructor, {
              content: crawlResult.content,
              html: crawlResult.html,
              previousPostDate,
            });

            // Save result to DB
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

            results.push({
              postId: post.id,
              postUrl: post.post_url,
              instructorId: instructor.id,
              totalScore: analysis.totalScore,
              grade: analysis.grade,
            });
          } catch (err) {
            console.error(`SEO analysis error for post ${post.id}:`, err.message);
          }
        }
      }

      return { success: true, data: results };
    } catch (err) {
      console.error('TRIGGER_SEO_ANALYZE error:', err);
      return { success: false, error: err.message };
    }
  });
}

module.exports = {
  registerDataIpcHandlers,
};
