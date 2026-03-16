const express = require('express');
const { get, all } = require('../db/database');

const router = express.Router();

function blogUrlToRss(url) {
  if (!url) return null;

  if (url.includes('blog.naver.com')) {
    const match = url.split('blog.naver.com/')[1];
    const id = match ? match.split('/')[0].split('?')[0] : null;
    if (id) return `https://rss.blog.naver.com/${id}`;
  }

  if (url.includes('.tistory.com')) {
    return url.replace(/\/$/, '') + '/rss';
  }

  if (url.includes('wordpress.com') || url.match(/\/wp-content\//)) {
    return url.replace(/\/$/, '') + '/feed';
  }

  return url.replace(/\/$/, '') + '/rss';
}

// POST /api/validate-license (PUBLIC - no auth required)
router.post('/validate-license', (req, res) => {
  const { licenseKey, machineId, appVersion } = req.body;

  if (!licenseKey) {
    return res.status(400).json({ valid: false, error: 'License key is required' });
  }

  const customer = get('SELECT * FROM customers WHERE license_key = ?', [licenseKey]);

  if (!customer) {
    return res.json({ valid: false, error: 'License key not found' });
  }

  if (!customer.is_active) {
    return res.json({ valid: false, error: 'License has been deactivated' });
  }

  if (customer.expires_at && new Date(customer.expires_at) < new Date()) {
    return res.json({ valid: false, error: 'License has expired' });
  }

  const instructors = all(
    'SELECT * FROM instructors WHERE customer_id = ? AND is_active = 1',
    [customer.id]
  );

  const instructorList = instructors.map((inst) => ({
    id: inst.id,
    name: inst.name,
    blog_url: inst.blog_url,
    blog_rss_url: inst.blog_rss_url || blogUrlToRss(inst.blog_url),
    keywords: inst.keywords ? JSON.parse(inst.keywords) : [],
    display_color: inst.display_color,
  }));

  res.json({
    valid: true,
    plan: customer.plan,
    maxInstructors: customer.max_instructors,
    expiresAt: customer.expires_at,
    instructors: instructorList,
    naverPlaceUrl: customer.naver_place_url,
  });
});

module.exports = router;
module.exports.blogUrlToRss = blogUrlToRss;
