-- Admin users table (for operator login)
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Customers table (each customer has a license)
CREATE TABLE IF NOT EXISTS customers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  business_name TEXT DEFAULT '',
  email TEXT UNIQUE NOT NULL,
  license_key TEXT UNIQUE NOT NULL,
  plan TEXT DEFAULT 'free' CHECK(plan IN ('free', 'basic', 'standard', 'premium')),
  max_instructors INTEGER DEFAULT 3,
  naver_place_url TEXT,
  is_active INTEGER DEFAULT 1,
  expires_at TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

-- Instructors table (belongs to a customer)
CREATE TABLE IF NOT EXISTS instructors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  blog_url TEXT,
  blog_rss_url TEXT,
  keywords TEXT,           -- JSON array: ["이름","별명"]
  display_color TEXT,
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT (datetime('now'))
);
