const db = require('../data/db');
const { determineStatus } = require('./alertEngine');

/**
 * Return the Monday-Sunday date range for the current week.
 * Monday is considered the start of the week.
 *
 * @returns {{ start: string, end: string }} ISO date strings (YYYY-MM-DD)
 */
function getWeekRange() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const diffToMonday = day === 0 ? -6 : 1 - day;

  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  const fmt = (d) => d.toISOString().slice(0, 10);
  return { start: fmt(monday), end: fmt(sunday) };
}

/**
 * Generate a weekly summary report for the given list of instructors.
 *
 * @param {Array<{ id: number, name: string }>} instructors
 * @returns {{
 *   weekRange: { start: string, end: string },
 *   instructors: Array<{
 *     id: number, name: string,
 *     blogCount: number, reviewCount: number,
 *     avgSeo: number|null, status: string
 *   }>,
 *   totalPosts: number,
 *   totalReviews: number,
 *   dangerCount: number,
 *   generatedAt: string
 * }}
 */
function generateWeeklyReport(instructors) {
  const { start, end } = getWeekRange();

  let totalPosts = 0;
  let totalReviews = 0;
  let dangerCount = 0;

  const instructorReports = instructors.map((inst) => {
    const blogCount = db.getBlogCount(inst.id, start, end);
    const reviewCount = db.getReviewCount(inst.id, start, end);
    const avgSeo = db.getAvgSeoScore(inst.id, start, end);
    const status = determineStatus(inst.id, blogCount, reviewCount);

    totalPosts += blogCount;
    totalReviews += reviewCount;
    if (status === 'danger') dangerCount += 1;

    return {
      id: inst.id,
      name: inst.name,
      blogCount,
      reviewCount,
      avgSeo: avgSeo ?? null,
      status,
    };
  });

  return {
    weekRange: { start, end },
    instructors: instructorReports,
    totalPosts,
    totalReviews,
    dangerCount,
    generatedAt: new Date().toISOString(),
  };
}

module.exports = { generateWeeklyReport, getWeekRange };
