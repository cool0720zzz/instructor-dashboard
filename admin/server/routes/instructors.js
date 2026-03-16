const express = require('express');
const { all, get, run } = require('../db/database');
const { authMiddleware } = require('../middleware/authMiddleware');
const { blogUrlToRss } = require('./license');

const router = express.Router();

router.use(authMiddleware);

// GET /admin/customers/:id/instructors
router.get('/customers/:id/instructors', (req, res) => {
  const customer = get('SELECT * FROM customers WHERE id = ?', [parseInt(req.params.id)]);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const instructors = all(
    'SELECT * FROM instructors WHERE customer_id = ? ORDER BY created_at ASC',
    [parseInt(req.params.id)]
  );

  const parsed = instructors.map((inst) => ({
    ...inst,
    keywords: inst.keywords ? JSON.parse(inst.keywords) : [],
  }));

  res.json(parsed);
});

// POST /admin/customers/:id/instructors
router.post('/customers/:id/instructors', (req, res) => {
  const { name, blog_url, keywords, display_color } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Instructor name is required' });
  }

  const customer = get('SELECT * FROM customers WHERE id = ?', [parseInt(req.params.id)]);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const countRow = get(
    'SELECT COUNT(*) as cnt FROM instructors WHERE customer_id = ? AND is_active = 1',
    [parseInt(req.params.id)]
  );
  const currentCount = countRow ? countRow.cnt : 0;

  if (currentCount >= customer.max_instructors) {
    return res.status(400).json({
      error: `Instructor limit reached (${customer.max_instructors} for ${customer.plan} plan)`,
    });
  }

  const blog_rss_url = blogUrlToRss(blog_url);

  let keywordsJson = null;
  if (keywords) {
    const keywordArr = Array.isArray(keywords)
      ? keywords
      : keywords.split(',').map((k) => k.trim()).filter(Boolean);
    keywordsJson = JSON.stringify(keywordArr);
  }

  const result = run(
    `INSERT INTO instructors (customer_id, name, blog_url, blog_rss_url, keywords, display_color, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`,
    [parseInt(req.params.id), name, blog_url || null, blog_rss_url, keywordsJson, display_color || null]
  );

  const instructor = get('SELECT * FROM instructors WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json({
    ...instructor,
    keywords: instructor.keywords ? JSON.parse(instructor.keywords) : [],
  });
});

// PATCH /admin/instructors/:id
router.patch('/instructors/:id', (req, res) => {
  const { name, blog_url, keywords, display_color, is_active } = req.body;

  const instructor = get('SELECT * FROM instructors WHERE id = ?', [parseInt(req.params.id)]);
  if (!instructor) {
    return res.status(404).json({ error: 'Instructor not found' });
  }

  const updates = [];
  const params = [];

  if (name !== undefined) {
    updates.push('name = ?');
    params.push(name);
  }

  if (blog_url !== undefined) {
    updates.push('blog_url = ?');
    params.push(blog_url || null);
    updates.push('blog_rss_url = ?');
    params.push(blogUrlToRss(blog_url));
  }

  if (keywords !== undefined) {
    let keywordArr;
    if (Array.isArray(keywords)) {
      keywordArr = keywords;
    } else if (typeof keywords === 'string') {
      keywordArr = keywords.split(',').map((k) => k.trim()).filter(Boolean);
    } else {
      keywordArr = [];
    }
    updates.push('keywords = ?');
    params.push(JSON.stringify(keywordArr));
  }

  if (display_color !== undefined) {
    updates.push('display_color = ?');
    params.push(display_color);
  }

  if (is_active !== undefined) {
    updates.push('is_active = ?');
    params.push(is_active ? 1 : 0);
  }

  if (updates.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  params.push(parseInt(req.params.id));
  run(`UPDATE instructors SET ${updates.join(', ')} WHERE id = ?`, params);

  const updated = get('SELECT * FROM instructors WHERE id = ?', [parseInt(req.params.id)]);
  res.json({
    ...updated,
    keywords: updated.keywords ? JSON.parse(updated.keywords) : [],
  });
});

// DELETE /admin/instructors/:id
router.delete('/instructors/:id', (req, res) => {
  const instructor = get('SELECT * FROM instructors WHERE id = ?', [parseInt(req.params.id)]);
  if (!instructor) {
    return res.status(404).json({ error: 'Instructor not found' });
  }

  run('DELETE FROM instructors WHERE id = ?', [parseInt(req.params.id)]);
  res.json({ message: 'Instructor deleted', id: parseInt(req.params.id) });
});

module.exports = router;
