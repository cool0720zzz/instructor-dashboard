'use strict';

const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');

// Determine DB file path: use Electron's app.getPath if available, else fallback
let dbPath;
try {
  const { app } = require('electron');
  dbPath = path.join(app.getPath('userData'), 'dashboard.db');
} catch {
  dbPath = path.join(__dirname, '..', '..', '..', 'data', 'dashboard.db');
}

// Ensure directory exists
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

let db = null;
let SQL = null;

// ─── Initialization ───────────────────────────────────────────────────────

async function initDb() {
  if (db) return db;
  SQL = await initSqlJs();

  // Load existing DB file if it exists
  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Create tables
  db.run(`
    CREATE TABLE IF NOT EXISTS instructors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      blog_url TEXT,
      blog_rss_url TEXT,
      keywords TEXT,
      display_color TEXT,
      is_active INTEGER DEFAULT 1,
      server_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS blog_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      instructor_id INTEGER REFERENCES instructors(id),
      post_url TEXT UNIQUE,
      post_title TEXT,
      published_at TEXT,
      collected_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS seo_results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER REFERENCES blog_posts(id),
      instructor_id INTEGER REFERENCES instructors(id),
      analyzed_at TEXT DEFAULT (datetime('now')),
      total_score INTEGER,
      grade TEXT,
      score_title INTEGER,
      score_body INTEGER,
      score_keyword INTEGER,
      score_image INTEGER,
      score_internal_link INTEGER,
      score_tag INTEGER,
      score_cycle INTEGER,
      score_quality INTEGER,
      detail_json TEXT,
      checklist_json TEXT
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      review_text TEXT,
      review_date TEXT,
      matched_instructor_id INTEGER REFERENCES instructors(id),
      collected_at TEXT DEFAULT (datetime('now')),
      UNIQUE(review_text, review_date)
    );

    CREATE TABLE IF NOT EXISTS weekly_checks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      check_date TEXT,
      instructor_id INTEGER REFERENCES instructors(id),
      blog_count INTEGER DEFAULT 0,
      review_count INTEGER DEFAULT 0,
      avg_seo_score INTEGER,
      status TEXT,
      week_start TEXT,
      week_end TEXT
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT
    );
  `);

  // Migration: add UNIQUE index on reviews if not exists
  try {
    db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_text_date ON reviews(review_text, review_date)`);
  } catch { /* index may already exist or table structure differs */ }

  // Version check: clear stale data on app upgrade or fresh install
  try {
    const { app } = require('electron');
    const currentVersion = app.getVersion();
    const savedVersion = _get('SELECT value FROM settings WHERE key = ?', ['app_version']);

    if (!savedVersion || savedVersion.value !== currentVersion) {
      console.log(`[DB] Version change (${savedVersion?.value || 'none'} → ${currentVersion}), clearing stale data`);
      // Clear all instructor/collection data — will be re-synced from server after license validation
      db.run('DELETE FROM instructors');
      db.run('DELETE FROM blog_posts');
      db.run('DELETE FROM seo_results');
      db.run('DELETE FROM reviews');
      db.run('DELETE FROM weekly_checks');
      // Keep license_key, opacity, snap_preset, auto_start — user preferences
      db.run("DELETE FROM settings WHERE key NOT IN ('license_key','opacity','snap_preset','auto_start')");
      db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('app_version', ?)", [currentVersion]);
    }
  } catch { /* electron not available in test env */ }

  _saveToFile();
  return db;
}

// Synchronous getter — throws if not yet initialized
function getDb() {
  if (!db) throw new Error('Database not initialized. Call initDb() first.');
  return db;
}

function _saveToFile() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// Helper: run a query and return all rows as plain objects
function _all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// Helper: run a query and return the first row
function _get(sql, params = []) {
  const rows = _all(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// Helper: run INSERT/UPDATE/DELETE
function _run(sql, params = []) {
  db.run(sql, params);
  _saveToFile();
  return { lastInsertRowid: _get('SELECT last_insert_rowid() AS id')?.id };
}

function _safeJsonParse(str, fallback) {
  try {
    return JSON.parse(str);
  } catch {
    return fallback;
  }
}

function _parseInstructorRow(row) {
  return {
    ...row,
    keywords: _safeJsonParse(row.keywords, []),
    is_active: Boolean(row.is_active),
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

function syncInstructors(serverInstructors) {
  // Mark all existing server-synced instructors inactive
  _run('UPDATE instructors SET is_active = 0');

  for (const inst of serverInstructors) {
    const keywords = Array.isArray(inst.keywords) ? JSON.stringify(inst.keywords) : (inst.keywords || '[]');
    const serverId = String(inst.id);

    const existing = _get('SELECT * FROM instructors WHERE server_id = ?', [serverId]);
    if (existing) {
      _run(`UPDATE instructors SET name = ?, blog_url = ?, blog_rss_url = ?,
            keywords = ?, display_color = ?, is_active = 1 WHERE server_id = ?`,
        [inst.name, inst.blog_url || null, inst.blog_rss_url || null,
         keywords, inst.display_color || null, serverId]);
    } else {
      _run(`INSERT INTO instructors (name, blog_url, blog_rss_url, keywords, display_color, is_active, server_id)
            VALUES (?, ?, ?, ?, ?, 1, ?)`,
        [inst.name, inst.blog_url || null, inst.blog_rss_url || null,
         keywords, inst.display_color || null, serverId]);
    }
  }

  // Remove instructors no longer on the server
  _run('DELETE FROM instructors WHERE is_active = 0 AND server_id IS NOT NULL');
}

function getAllInstructors() {
  return _all('SELECT * FROM instructors WHERE is_active = 1 ORDER BY name').map(_parseInstructorRow);
}

function getInstructor(id) {
  const row = _get('SELECT * FROM instructors WHERE id = ?', [id]);
  return row ? _parseInstructorRow(row) : null;
}

// ─── Blog posts ─────────────────────────────────────────────────────────────

function addBlogPost(data) {
  return _run(`INSERT OR IGNORE INTO blog_posts (instructor_id, post_url, post_title, published_at)
               VALUES (?, ?, ?, ?)`,
    [data.instructor_id, data.post_url, data.post_title || null, data.published_at || new Date().toISOString()]);
}

function getBlogCount(instructorId, weekStart, weekEnd) {
  const row = _get('SELECT COUNT(*) AS cnt FROM blog_posts WHERE instructor_id = ? AND published_at >= ? AND published_at <= ?',
    [instructorId, weekStart, weekEnd]);
  return row ? row.cnt : 0;
}

function getBlogCountMonth(instructorId, monthStart, monthEnd) {
  const row = _get('SELECT COUNT(*) AS cnt FROM blog_posts WHERE instructor_id = ? AND published_at >= ? AND published_at <= ?',
    [instructorId, monthStart, monthEnd]);
  return row ? row.cnt : 0;
}

function getUnanalyzedPosts(instructorId, weekStart, weekEnd) {
  return _all(`SELECT bp.* FROM blog_posts bp
    LEFT JOIN seo_results sr ON sr.post_id = bp.id
    WHERE bp.instructor_id = ? AND bp.published_at >= ? AND bp.published_at <= ? AND sr.id IS NULL
    ORDER BY bp.published_at DESC`, [instructorId, weekStart, weekEnd]);
}

// ─── SEO results ────────────────────────────────────────────────────────────

function saveSeoResult(data) {
  return _run(`INSERT INTO seo_results (
    post_id, instructor_id, total_score, grade,
    score_title, score_body, score_keyword, score_image,
    score_internal_link, score_tag, score_cycle, score_quality,
    detail_json, checklist_json
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.post_id, data.instructor_id, data.total_score, data.grade,
     data.score_title || 0, data.score_body || 0, data.score_keyword || 0, data.score_image || 0,
     data.score_internal_link || 0, data.score_tag || 0, data.score_cycle || 0, data.score_quality || 0,
     typeof data.detail_json === 'string' ? data.detail_json : JSON.stringify(data.detail_json || {}),
     typeof data.checklist_json === 'string' ? data.checklist_json : JSON.stringify(data.checklist_json || [])]);
}

function getSeoResults(instructorId, limit = 10) {
  const rows = _all(`SELECT sr.*, bp.post_url, bp.post_title FROM seo_results sr
    LEFT JOIN blog_posts bp ON bp.id = sr.post_id
    WHERE sr.instructor_id = ? ORDER BY sr.analyzed_at DESC LIMIT ?`, [instructorId, limit]);
  return rows.map((r) => ({
    ...r,
    detail_json: _safeJsonParse(r.detail_json, {}),
    checklist_json: _safeJsonParse(r.checklist_json, []),
  }));
}

function getAvgSeoScore(instructorId, weekStart, weekEnd) {
  const row = _get(`SELECT AVG(total_score) AS avg_score FROM seo_results sr
    JOIN blog_posts bp ON bp.id = sr.post_id
    WHERE sr.instructor_id = ? AND bp.published_at >= ? AND bp.published_at <= ?`,
    [instructorId, weekStart, weekEnd]);
  return row && row.avg_score != null ? Math.round(row.avg_score) : null;
}

// ─── Reviews ────────────────────────────────────────────────────────────────

function addReview(data) {
  return _run(`INSERT OR IGNORE INTO reviews (review_text, review_date, matched_instructor_id)
               VALUES (?, ?, ?)`,
    [data.review_text, data.review_date || new Date().toISOString(), data.matched_instructor_id || null]);
}

function getReviewCount(instructorId, weekStart, weekEnd) {
  const row = _get('SELECT COUNT(*) AS cnt FROM reviews WHERE matched_instructor_id = ? AND review_date >= ? AND review_date <= ?',
    [instructorId, weekStart, weekEnd]);
  return row ? row.cnt : 0;
}

function getReviewCountMonth(instructorId, monthStart, monthEnd) {
  const row = _get('SELECT COUNT(*) AS cnt FROM reviews WHERE matched_instructor_id = ? AND review_date >= ? AND review_date <= ?',
    [instructorId, monthStart, monthEnd]);
  return row ? row.cnt : 0;
}

// ─── Weekly checks ──────────────────────────────────────────────────────────

function saveWeeklyCheck(data) {
  return _run(`INSERT INTO weekly_checks (check_date, instructor_id, blog_count, review_count, avg_seo_score, status, week_start, week_end)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [data.check_date || new Date().toISOString().slice(0, 10), data.instructor_id,
     data.blog_count || 0, data.review_count || 0, data.avg_seo_score || null,
     data.status, data.week_start, data.week_end]);
}

function getLastWeekStatus(instructorId) {
  return _get('SELECT * FROM weekly_checks WHERE instructor_id = ? ORDER BY check_date DESC LIMIT 1', [instructorId]) || null;
}

function getWeeklyHistory(instructorId, limit = 12) {
  return _all('SELECT * FROM weekly_checks WHERE instructor_id = ? ORDER BY check_date DESC LIMIT ?', [instructorId, limit]);
}

// ─── Settings ───────────────────────────────────────────────────────────────

function getSetting(key) {
  const row = _get('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : null;
}

function setSetting(key, value) {
  _run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

function close() {
  if (db) {
    _saveToFile();
    db.close();
    db = null;
  }
}

process.on('exit', () => {
  try { close(); } catch { /* already closed */ }
});

module.exports = {
  initDb,
  getDb,
  syncInstructors,
  getAllInstructors,
  getInstructor,
  addBlogPost,
  getBlogCount,
  getBlogCountMonth,
  getUnanalyzedPosts,
  saveSeoResult,
  getSeoResults,
  getAvgSeoScore,
  addReview,
  getReviewCount,
  getReviewCountMonth,
  saveWeeklyCheck,
  getLastWeekStatus,
  getWeeklyHistory,
  getSetting,
  setSetting,
  close,
};
