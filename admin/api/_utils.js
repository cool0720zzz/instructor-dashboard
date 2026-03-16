function blogUrlToRss(url) {
  if (!url) return '';
  if (url.includes('blog.naver.com')) {
    const match = url.split('blog.naver.com/')[1];
    const id = match ? match.split('/')[0].split('?')[0] : null;
    if (id) return `https://rss.blog.naver.com/${id}`;
  }
  if (url.includes('.tistory.com')) {
    return url.replace(/\/$/, '') + '/rss';
  }
  if (url.includes('wordpress.com') || /\/wp-content\//.test(url)) {
    return url.replace(/\/$/, '') + '/feed';
  }
  return url.replace(/\/$/, '') + '/rss';
}

function generateLicenseKey(plan) {
  const prefixes = { free: 'FRE', basic: 'BAS', standard: 'STD', premium: 'PRE' };
  const prefix = prefixes[plan] || 'FRE';
  const seg = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let s = '';
    for (let i = 0; i < 4; i++) s += chars[Math.floor(Math.random() * chars.length)];
    return s;
  };
  return `${prefix}-${seg()}-${seg()}-${seg()}`;
}

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

module.exports = { blogUrlToRss, generateLicenseKey, cors };
