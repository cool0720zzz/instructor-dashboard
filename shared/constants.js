module.exports = {
  API_BASE: process.env.API_BASE || 'https://admin-five-gray.vercel.app',
  PLANS: {
    FREE:     { maxInstructors: 3,  seoHistoryDepth: 1 },
    BASIC:    { maxInstructors: 6,  seoHistoryDepth: 3 },
    STANDARD: { maxInstructors: 10, seoHistoryDepth: 5 },
    PREMIUM:  { maxInstructors: Infinity, seoHistoryDepth: Infinity },
  },
  STATUS_COLORS: {
    ok:      '#22c55e',
    caution: '#eab308',
    warning: '#f97316',
    danger:  '#ef4444',
  },
  SEO_GRADES: {
    S: { min: 85, bg: '#1e3a5f', color: '#60a5fa' },
    A: { min: 70, bg: '#14532d', color: '#4ade80' },
    B: { min: 50, bg: '#422006', color: '#fb923c' },
    C: { min: 30, bg: '#450a0a', color: '#f87171' },
    D: { min: 0,  bg: '#3b0764', color: '#e879f9' },
  },
};
