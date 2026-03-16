const jwt = require('jsonwebtoken');
const { cors } = require('../_utils');

module.exports = async function handler(req, res) {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, password } = req.body || {};

  if (
    email === process.env.ADMIN_EMAIL &&
    password === process.env.ADMIN_PASSWORD
  ) {
    const token = jwt.sign(
      { email, role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    return res.status(200).json({
      token,
      user: { email, role: 'admin' },
    });
  }

  return res.status(401).json({ error: '이메일 또는 비밀번호가 올바르지 않습니다' });
};
