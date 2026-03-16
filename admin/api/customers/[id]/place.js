const { getSupabase } = require('../../_supabase');
const { requireAdmin } = require('../../_auth');
const { cors } = require('../../_utils');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'PATCH') return res.status(405).json({ error: 'Method not allowed' });
  if (!requireAdmin(req, res)) return;

  const { id } = req.query;
  const { naver_place_url } = req.body || {};
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('customers')
    .update({ naver_place_url: naver_place_url || null })
    .eq('id', id)
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });
  return res.status(200).json(data);
};
