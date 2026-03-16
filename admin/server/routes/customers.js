const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { all, get, run } = require('../db/database');
const { authMiddleware } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(authMiddleware);

const PLAN_LIMITS = {
  free: 3,
  basic: 6,
  standard: 10,
  premium: 999,
};

function generateLicenseKey(plan) {
  const prefixMap = { free: 'FRE', basic: 'BAS', standard: 'STD', premium: 'PRO' };
  const prefix = prefixMap[plan] || 'FRE';
  const seg1 = uuidv4().substring(0, 4).toUpperCase();
  const seg2 = uuidv4().substring(0, 4).toUpperCase();
  return `${prefix}-${seg1}-${seg2}`;
}

// GET /admin/customers
router.get('/', (req, res) => {
  const customers = all(
    `SELECT c.*,
       (SELECT COUNT(*) FROM instructors WHERE customer_id = c.id AND is_active = 1) as instructor_count
     FROM customers c ORDER BY c.created_at DESC`
  );
  res.json(customers);
});

// POST /admin/customers
router.post('/', (req, res) => {
  const { email, plan, naver_place_url, expires_at } = req.body;

  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  const existing = get('SELECT id FROM customers WHERE email = ?', [email]);
  if (existing) {
    return res.status(409).json({ error: 'Customer with this email already exists' });
  }

  const selectedPlan = plan || 'free';
  const licenseKey = generateLicenseKey(selectedPlan);
  const maxInstructors = PLAN_LIMITS[selectedPlan] || 3;

  const result = run(
    `INSERT INTO customers (email, license_key, plan, max_instructors, naver_place_url, is_active, expires_at)
     VALUES (?, ?, ?, ?, ?, 1, ?)`,
    [email, licenseKey, selectedPlan, maxInstructors, naver_place_url || null, expires_at || null]
  );

  const customer = get('SELECT * FROM customers WHERE id = ?', [result.lastInsertRowid]);
  res.status(201).json(customer);
});

// GET /admin/customers/:id
router.get('/:id', (req, res) => {
  const customer = get('SELECT * FROM customers WHERE id = ?', [parseInt(req.params.id)]);

  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const instructors = all(
    'SELECT * FROM instructors WHERE customer_id = ? ORDER BY created_at ASC',
    [parseInt(req.params.id)]
  );

  const parsedInstructors = instructors.map((inst) => ({
    ...inst,
    keywords: inst.keywords ? JSON.parse(inst.keywords) : [],
  }));

  res.json({ ...customer, instructors: parsedInstructors });
});

// PATCH /admin/customers/:id/plan
router.patch('/:id/plan', (req, res) => {
  const { plan } = req.body;

  if (!plan || !PLAN_LIMITS[plan]) {
    return res.status(400).json({ error: 'Invalid plan. Must be: free, basic, standard, or premium' });
  }

  const customer = get('SELECT * FROM customers WHERE id = ?', [parseInt(req.params.id)]);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  const maxInstructors = PLAN_LIMITS[plan];
  run('UPDATE customers SET plan = ?, max_instructors = ? WHERE id = ?',
    [plan, maxInstructors, parseInt(req.params.id)]);

  const updated = get('SELECT * FROM customers WHERE id = ?', [parseInt(req.params.id)]);
  res.json(updated);
});

// DELETE /admin/customers/:id/license
router.delete('/:id/license', (req, res) => {
  const customer = get('SELECT * FROM customers WHERE id = ?', [parseInt(req.params.id)]);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  run('UPDATE customers SET is_active = 0 WHERE id = ?', [parseInt(req.params.id)]);
  res.json({ message: 'License deactivated', id: parseInt(req.params.id) });
});

// PATCH /admin/customers/:id/place
router.patch('/:id/place', (req, res) => {
  const { naver_place_url } = req.body;

  const customer = get('SELECT * FROM customers WHERE id = ?', [parseInt(req.params.id)]);
  if (!customer) {
    return res.status(404).json({ error: 'Customer not found' });
  }

  run('UPDATE customers SET naver_place_url = ? WHERE id = ?',
    [naver_place_url || null, parseInt(req.params.id)]);

  const updated = get('SELECT * FROM customers WHERE id = ?', [parseInt(req.params.id)]);
  res.json(updated);
});

module.exports = router;
