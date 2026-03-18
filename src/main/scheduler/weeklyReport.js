const db = require('../data/db');
const { determineStatus } = require('./alertEngine');
const { getWeekRangeISO } = require('../data/dateRanges');

/**
 * Return the Monday-Sunday date range for the current week.
 * Monday 00:00:00 ~ Sunday 23:59:59.999 as ISO strings.
 *
 * @returns {{ start: string, end: string }} ISO date strings
 */
function getWeekRange() {
  return getWeekRangeISO();
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
