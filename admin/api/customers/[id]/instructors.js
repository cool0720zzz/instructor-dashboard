const { getSupabase } = require('../../_supabase');
const { requireAdmin } = require('../../_auth');
const { blogUrlToRss, cors } = require('../../_utils');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAdmin(req, res)) return;

  const { id } = req.query; // customer_id
  const supabase = getSupabase();

  // GET — list instructors for customer
  if (req.method === 'GET') {
    const { data, error } = await supabase
      .from('instructors')
      .select('*')
      .eq('customer_id', id)
      .order('created_at', { ascending: true });

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data || []);
  }

  // POST — add instructor
  if (req.method === 'POST') {
    const { name, blog_url, keywords, display_color } = req.body || {};
    if (!name) return res.status(400).json({ error: 'Name is required' });

    // Check max instructors
    const { data: customer } = await supabase
      .from('customers')
      .select('max_instructors')
      .eq('id', id)
      .single();

    const { count } = await supabase
      .from('instructors')
      .select('*', { count: 'exact', head: true })
      .eq('customer_id', id)
      .eq('is_active', true);

    if (customer && count >= customer.max_instructors) {
      return res.status(400).json({ error: `최대 강사 수(${customer.max_instructors}명)를 초과했습니다` });
    }

    // Parse keywords
    let parsedKeywords = [];
    if (typeof keywords === 'string') {
      parsedKeywords = keywords.split(',').map((k) => k.trim()).filter(Boolean);
    } else if (Array.isArray(keywords)) {
      parsedKeywords = keywords;
    }

    const rssUrl = blogUrlToRss(blog_url);

    const { data, error } = await supabase
      .from('instructors')
      .insert({
        customer_id: id,
        name,
        blog_url: blog_url || null,
        blog_rss_url: rssUrl || null,
        keywords: parsedKeywords,
        display_color: display_color || '#22c55e',
        is_active: true,
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(201).json(data);
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
