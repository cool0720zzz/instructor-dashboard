const { getSupabase } = require('../_supabase');
const { requireAdmin } = require('../_auth');
const { blogUrlToRss, cors } = require('../_utils');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!requireAdmin(req, res)) return;

  const { id } = req.query;
  const supabase = getSupabase();

  // PATCH — update instructor
  if (req.method === 'PATCH') {
    const { name, blog_url, keywords, display_color, is_active } = req.body || {};
    const updates = {};

    if (name !== undefined) updates.name = name;
    if (blog_url !== undefined) {
      updates.blog_url = blog_url;
      updates.blog_rss_url = blogUrlToRss(blog_url);
    }
    if (keywords !== undefined) {
      if (typeof keywords === 'string') {
        updates.keywords = keywords.split(',').map((k) => k.trim()).filter(Boolean);
      } else if (Array.isArray(keywords)) {
        updates.keywords = keywords;
      }
    }
    if (display_color !== undefined) updates.display_color = display_color;
    if (is_active !== undefined) updates.is_active = is_active;

    const { data, error } = await supabase
      .from('instructors')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json(data);
  }

  // DELETE — remove instructor
  if (req.method === 'DELETE') {
    const { error } = await supabase
      .from('instructors')
      .delete()
      .eq('id', id);

    if (error) return res.status(500).json({ error: error.message });
    return res.status(200).json({ success: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
