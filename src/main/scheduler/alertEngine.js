const db = require('../data/db');

/**
 * Determine the alert status for an instructor based on weekly activity.
 *
 * Rules:
 *   - blogCount >= 1 AND reviewCount >= 1  -> 'ok'
 *   - blogCount === 0 AND reviewCount === 0 ->
 *       if last week was 'warning' -> 'danger'
 *       else                       -> 'warning'
 *   - otherwise (one is 0 but not both)    -> 'caution'
 *
 * @param {number} instructorId
 * @param {number} blogCount   - blog posts published this week
 * @param {number} reviewCount - reviews mentioning instructor this week
 * @returns {'ok'|'caution'|'warning'|'danger'}
 */
function determineStatus(instructorId, blogCount, reviewCount) {
  if (blogCount >= 1 && reviewCount >= 1) {
    return 'ok';
  }

  if (blogCount === 0 && reviewCount === 0) {
    const last = db.getLastWeekStatus(instructorId);
    if (last && last.status === 'warning') {
      return 'danger';
    }
    return 'warning';
  }

  return 'caution';
}

module.exports = { determineStatus };
