const { initDatabase, run, get } = require('./database');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

function generateLicenseKey(plan) {
  const prefix = plan.toUpperCase().substring(0, 3);
  const seg1 = uuidv4().substring(0, 4).toUpperCase();
  const seg2 = uuidv4().substring(0, 4).toUpperCase();
  return `${prefix}-${seg1}-${seg2}`;
}

async function seed() {
  await initDatabase();

  // Clear existing data
  run('DELETE FROM instructors');
  run('DELETE FROM customers');
  run('DELETE FROM admin_users');

  // 1. Create admin user
  const passwordHash = bcrypt.hashSync('admin123', 10);
  run('INSERT INTO admin_users (email, password_hash) VALUES (?, ?)',
    ['admin@admin.com', passwordHash]);
  console.log('Admin user created: admin@admin.com / admin123');

  // 2. Create sample customers
  const customer1Key = generateLicenseKey('standard');
  const customer2Key = generateLicenseKey('basic');

  const c1 = run(
    `INSERT INTO customers (email, license_key, plan, max_instructors, naver_place_url, is_active, expires_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    ['happy@academy.com', customer1Key, 'standard', 10,
     'https://map.naver.com/v5/entry/place/1234567890', '2026-12-31T23:59:59']
  );

  const c2 = run(
    `INSERT INTO customers (email, license_key, plan, max_instructors, naver_place_url, is_active, expires_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    ['best@fitness.com', customer2Key, 'basic', 6,
     'https://map.naver.com/v5/entry/place/9876543210', '2026-06-30T23:59:59']
  );

  console.log(`Customer 1 created: happy@academy.com (license: ${customer1Key})`);
  console.log(`Customer 2 created: best@fitness.com (license: ${customer2Key})`);

  // 3. Create sample instructors
  run(
    `INSERT INTO instructors (customer_id, name, blog_url, blog_rss_url, keywords, display_color, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [c1.lastInsertRowid, '김지수', 'https://blog.naver.com/jisukim',
     'https://rss.blog.naver.com/jisukim', JSON.stringify(['김지수', '지수쌤']), '#3b82f6']
  );

  run(
    `INSERT INTO instructors (customer_id, name, blog_url, blog_rss_url, keywords, display_color, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [c1.lastInsertRowid, '박민준', 'https://minjun.tistory.com',
     'https://minjun.tistory.com/rss', JSON.stringify(['박민준', '민준쌤']), '#10b981']
  );

  run(
    `INSERT INTO instructors (customer_id, name, blog_url, blog_rss_url, keywords, display_color, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [c2.lastInsertRowid, '이서연', 'https://blog.naver.com/seoyeon_lee',
     'https://rss.blog.naver.com/seoyeon_lee', JSON.stringify(['이서연', '서연쌤']), '#f59e0b']
  );

  console.log('3 sample instructors created');
  console.log('Seed completed successfully!');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
