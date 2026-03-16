const { getSupabase } = require('./_supabase');
const { cors } = require('./_utils');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { licenseKey, machineId, appVersion } = req.body || {};
  if (!licenseKey) return res.status(400).json({ valid: false, error: 'License key required' });

  const supabase = getSupabase();

  // Look up customer
  const { data: customer, error: custErr } = await supabase
    .from('customers')
    .select('*')
    .eq('license_key', licenseKey)
    .single();

  if (custErr || !customer) {
    return res.status(200).json({ valid: false, error: '유효하지 않은 라이선스 키입니다' });
  }

  if (!customer.is_active) {
    return res.status(200).json({ valid: false, error: '비활성화된 라이선스입니다' });
  }

  if (customer.expires_at && new Date(customer.expires_at) < new Date()) {
    return res.status(200).json({ valid: false, error: '만료된 라이선스입니다' });
  }

  // Get instructors
  const { data: instructors } = await supabase
    .from('instructors')
    .select('*')
    .eq('customer_id', customer.id)
    .eq('is_active', true)
    .order('created_at', { ascending: true });

  return res.status(200).json({
    valid: true,
    plan: customer.plan,
    maxInstructors: customer.max_instructors,
    expiresAt: customer.expires_at,
    naverPlaceUrl: customer.naver_place_url || '',
    instructors: (instructors || []).map((i) => ({
      id: i.id,
      name: i.name,
      blog_url: i.blog_url,
      blog_rss_url: i.blog_rss_url,
      keywords: i.keywords || [],
      display_color: i.display_color,
    })),
  });
};
