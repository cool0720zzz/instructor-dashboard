import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, getApiBase } from '../App.jsx';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${getApiBase()}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading(false);
        return;
      }

      login(data.token, data.user);
      navigate('/dashboard');
    } catch (err) {
      setError('Server connection failed');
      setLoading(false);
    }
  };

  const containerStyle = {
    display: 'flex', justifyContent: 'center', alignItems: 'center',
    minHeight: '100vh', background: '#0f172a',
  };
  const cardStyle = {
    background: '#1e293b', borderRadius: '12px', padding: '40px',
    width: '100%', maxWidth: '400px', boxShadow: '0 4px 24px rgba(0,0,0,0.3)',
  };
  const inputStyle = {
    width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155',
    borderRadius: '8px', color: '#e2e8f0', fontSize: '14px', marginTop: '6px',
    outline: 'none',
  };
  const btnStyle = {
    width: '100%', padding: '12px', background: '#3b82f6', color: '#fff',
    border: 'none', borderRadius: '8px', fontSize: '15px', fontWeight: 600,
    cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
    marginTop: '8px',
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={{ textAlign: 'center', marginBottom: '8px', fontSize: '22px', color: '#f1f5f9' }}>
          강사 대시보드
        </h1>
        <p style={{ textAlign: 'center', marginBottom: '28px', color: '#94a3b8', fontSize: '14px' }}>
          관리자 로그인
        </p>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ color: '#94a3b8', fontSize: '13px' }}>이메일</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@admin.com"
              required
              style={inputStyle}
            />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ color: '#94a3b8', fontSize: '13px' }}>비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="********"
              required
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{
              background: '#450a0a', color: '#fca5a5', padding: '10px 14px',
              borderRadius: '6px', fontSize: '13px', marginBottom: '12px',
            }}>
              {error}
            </div>
          )}

          <button type="submit" style={btnStyle} disabled={loading}>
            {loading ? '로그인 중...' : '로그인'}
          </button>
        </form>
      </div>
    </div>
  );
}
