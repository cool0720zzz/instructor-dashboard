const { getSupabase } = require('../_supabase');
const { requireAdmin } = require('../_auth');
const { generateLicenseKey, cors } = require('../_utils');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAdmin(req, res)) return;

  const supabase = getSupabase();

  // GET — list all customers with instructor count
  if (req.method === 'GET') {
    const { data: customers, error } = await supabase
      .from('customers')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return res.status(500).json({ error: error.message });

    // Get instructor counts
    const { data: counts } = await supabase
      .from('instructors')
      .select('customer_id')
      .eq('is_active', true);

    const countMap = {};
    for (const row of (counts || [])) {
      countMap[row.customer_id] = (countMap[row.customer_id] || 0) + 1;
    }

    const result = customers.map((c) => ({
      ...c,
      instructor_count: countMap[c.id] || 0,
    }));

    return res.status(200).json(result);
  }

  // POST — create new customer
  if (req.method === 'POST') {
    const { email, business_name, naver_place_url } = req.body || {};

    if (!email) return res.status(400).json({ error: 'Email is required' });

    const licenseKey = generateLicenseKey('free');

    const { data, error } = await supabase
      .from('customers')
      .insert({
        email,
        business_name: business_name || null,
        license_key: licenseKey,
        plan: 'free',
        max_instructors: 999,
        naver_place_url: naver_place_url || null,
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        return res.status(409).json({ error: '이미 등록된 이메일입니다' });
      }
      return res.status(500).json({ error: error.message });
    }

    return res.status(201).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
