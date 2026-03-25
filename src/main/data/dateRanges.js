'use strict';

/**
 * Calendar week range: Monday 00:00:00.000 ~ Sunday 23:59:59.999
 * Week starts on Monday (ISO standard).
 *
 * @returns {{ start: Date, end: Date }}
 */
function getThisWeekRange() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun, 1=Mon, ...
  const monday = new Date(now);
  monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1));
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return { start: monday, end: sunday };
}

/**
 * Calendar month range: 1st 00:00:00.000 ~ last day 23:59:59.999
 *
 * @returns {{ start: Date, end: Date }}
 */
function getThisMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  // Day 0 of next month = last day of current month
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

/**
 * Format Date ranges as ISO strings for DB queries.
 * Uses <= for end boundary (Sunday 23:59:59.999 / month last day 23:59:59.999).
 */
function getWeekRangeISO() {
  const { start, end } = getThisWeekRange();
  const result = { start: start.toISOString(), end: end.toISOString() };
  console.log(`[DateRange] This week: ${_fmtLocal(start)} ~ ${_fmtLocal(end)} (ISO: ${result.start} ~ ${result.end})`);
  return result;
}

function getMonthRangeISO() {
  const { start, end } = getThisMonthRange();
  const result = { start: start.toISOString(), end: end.toISOString() };
  console.log(`[DateRange] This month: ${_fmtLocal(start)} ~ ${_fmtLocal(end)} (ISO: ${result.start} ~ ${result.end})`);
  return result;
}

function _fmtLocal(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  const s = String(d.getSeconds()).padStart(2, '0');
  return `${y}-${m}-${day} ${h}:${min}:${s}`;
}

/**
 * Last week range: previous Monday 00:00:00.000 ~ previous Sunday 23:59:59.999
 */
function getLastWeekRange() {
  const { start: thisMonday } = getThisWeekRange();
  const lastMonday = new Date(thisMonday);
  lastMonday.setDate(thisMonday.getDate() - 7);
  lastMonday.setHours(0, 0, 0, 0);

  const lastSunday = new Date(lastMonday);
  lastSunday.setDate(lastMonday.getDate() + 6);
  lastSunday.setHours(23, 59, 59, 999);

  return { start: lastMonday, end: lastSunday };
}

function getLastWeekRangeISO() {
  const { start, end } = getLastWeekRange();
  const result = { start: start.toISOString(), end: end.toISOString() };
  console.log(`[DateRange] Last week: ${_fmtLocal(start)} ~ ${_fmtLocal(end)} (ISO: ${result.start} ~ ${result.end})`);
  return result;
}

module.exports = {
  getThisWeekRange,
  getThisMonthRange,
  getWeekRangeISO,
  getMonthRangeISO,
  getLastWeekRange,
  getLastWeekRangeISO,
};
