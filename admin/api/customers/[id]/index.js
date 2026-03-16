const { getSupabase } = require('../../_supabase');
const { requireAdmin } = require('../../_auth');
const { cors } = require('../../_utils');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAdmin(req, res)) return;

  const { id } = req.query;
  const supabase = getSupabase();

  // GET — single customer with instructors
  if (req.method === 'GET') {
    const { data: customer, error } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !customer) return res.status(404).json({ error: 'Customer not found' });

    const { data: instructors } = await supabase
      .from('instructors')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: true });

    return res.status(200).json({
      ...customer,
      instructors: instructors || [],
    });
  }

  // PATCH — update customer
  if (req.method === 'PATCH') {
    const updates = req.body || {};
    const allowed = ['email', 'business_name', 'plan', 'max_instructors', 'naver_place_url', 'is_active', 'expires_at'];
    const filtered = {};
    for (const key of allowed) {
      if (updates[key] !== undefined) filtered[key] = updates[key];
    }

    // Auto-update max_instructors when plan changes
    if (filtered.plan && !filtered.max_instructors) {
      const planLimits = { free: 3, basic: 6, standard: 10, premium: 999 };
      filtered.max_instructors = planLimits[filtered.plan] || 3;
    }

    const { data, error } = await supabase
      .from('customers')
      .update(filtered)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // DELETE — deactivate customer license
  if (req.method === 'DELETE') {
    const { data, error } = await supabase
      .from('customers')
      .update({ is_active: false })
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
