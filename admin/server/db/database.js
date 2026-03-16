const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, 'admin.db');
const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

let db = null;

function getDb() {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

async function initDatabase() {
  if (db) return db;

  const SQL = await initSqlJs();

  // Load existing DB file if it exists
  if (fs.existsSync(DB_PATH)) {
    const buffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  // Run schema
  const schema = fs.readFileSync(SCHEMA_PATH, 'utf-8');
  db.run(schema);

  saveDb();
  return db;
}

function saveDb() {
  if (!db) return;
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// sql.js helper: run SELECT and return array of plain objects
function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

// sql.js helper: run SELECT and return first row
function get(sql, params = []) {
  const rows = all(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// sql.js helper: run INSERT/UPDATE/DELETE and save
function run(sql, params = []) {
  db.run(sql, params);
  // Get last_insert_rowid before any other query
  const stmt = db.prepare('SELECT last_insert_rowid() AS id');
  let lastId = 0;
  if (stmt.step()) {
    const row = stmt.getAsObject();
    lastId = row.id;
  }
  stmt.free();
  saveDb();
  return { lastInsertRowid: lastId };
}

module.exports = { getDb, initDatabase, saveDb, all, get, run };
