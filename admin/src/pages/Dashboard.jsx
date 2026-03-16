import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authFetch, getApiBase } from '../App.jsx';

export default function Dashboard() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPlan, setNewPlan] = useState('free');
  const [newPlaceUrl, setNewPlaceUrl] = useState('');
  const [newExpiry, setNewExpiry] = useState('');
  const [addError, setAddError] = useState('');
  const navigate = useNavigate();

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    try {
      const res = await authFetch(`${getApiBase()}/api/customers`);
      if (res.ok) setCustomers(await res.json());
    } catch (err) {
      console.error('Failed to load data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setAddError('');
    try {
      const res = await authFetch(`${getApiBase()}/api/customers`, {
        method: 'POST',
        body: JSON.stringify({
          email: newEmail,
          plan: newPlan,
          naver_place_url: newPlaceUrl || undefined,
          expires_at: newExpiry || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setAddError(data.error); return; }
      setShowAddForm(false);
      setNewEmail(''); setNewPlan('free'); setNewPlaceUrl(''); setNewExpiry('');
      loadData();
    } catch { setAddError('Failed to create customer'); }
  };

  const handleDeactivate = async (id) => {
    if (!confirm('이 고객의 라이선스를 비활성화하시겠습니까?')) return;
    try {
      await authFetch(`${getApiBase()}/api/customers/${id}`, { method: 'DELETE' });
      loadData();
    } catch (err) { console.error('Failed to deactivate:', err); }
  };

  const totalCustomers = customers.length;
  const activeLicenses = customers.filter((c) => c.is_active).length;
  const inactiveLicenses = totalCustomers - activeLicenses;
  const totalInstructors = customers.reduce((acc, c) => acc + (c.instructor_count || 0), 0);

  const planCounts = customers.reduce((acc, c) => {
    acc[c.plan] = (acc[c.plan] || 0) + 1;
    return acc;
  }, {});

  const planColors = { free: '#94a3b8', basic: '#60a5fa', standard: '#4ade80', premium: '#fbbf24' };
  const planLabels = { free: 'Free', basic: 'Basic', standard: 'Standard', premium: 'Premium' };

  const cardStyle = {
    background: '#1e293b', borderRadius: '12px', padding: '24px', flex: '1', minWidth: '200px',
  };
  const numStyle = { fontSize: '32px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' };
  const labelStyle = { color: '#94a3b8', fontSize: '14px' };
  const inputStyle = {
    width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155',
    borderRadius: '6px', color: '#e2e8f0', fontSize: '14px', outline: 'none',
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '28px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f1f5f9' }}>대시보드</h1>
        <button onClick={() => setShowAddForm(!showAddForm)} style={{
          background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px',
          padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
        }}>
          + 신규 고객
        </button>
      </div>

      {/* Add customer form */}
      {showAddForm && (
        <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px', marginBottom: '24px', border: '1px solid #334155' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: '#f1f5f9' }}>신규 고객 등록</h3>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>이메일 *</label>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required style={inputStyle} placeholder="customer@example.com" />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>플랜</label>
                <select value={newPlan} onChange={(e) => setNewPlan(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="free">Free (3명)</option>
                  <option value="basic">Basic (6명)</option>
                  <option value="standard">Standard (10명)</option>
                  <option value="premium">Premium (무제한)</option>
                </select>
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>플레이스 URL</label>
                <input type="url" value={newPlaceUrl} onChange={(e) => setNewPlaceUrl(e.target.value)} style={inputStyle} placeholder="https://map.naver.com/..." />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>만료일</label>
                <input type="date" value={newExpiry} onChange={(e) => setNewExpiry(e.target.value)} style={inputStyle} />
              </div>
            </div>
            {addError && <div style={{ background: '#450a0a', color: '#fca5a5', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '12px' }}>{addError}</div>}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 20px', fontSize: '14px', cursor: 'pointer' }}>등록</button>
              <button type="button" onClick={() => setShowAddForm(false)} style={{ background: '#374151', color: '#e2e8f0', border: 'none', borderRadius: '6px', padding: '8px 20px', fontSize: '14px', cursor: 'pointer' }}>취소</button>
            </div>
          </form>
        </div>
      )}

      {/* Stats cards */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '32px' }}>
        <div style={cardStyle}>
          <div style={numStyle}>{totalCustomers}</div>
          <div style={labelStyle}>전체 고객</div>
        </div>
        <div style={cardStyle}>
          <div style={{ ...numStyle, color: '#4ade80' }}>{activeLicenses}</div>
          <div style={labelStyle}>활성 라이선스</div>
        </div>
        <div style={cardStyle}>
          <div style={{ ...numStyle, color: '#f87171' }}>{inactiveLicenses}</div>
          <div style={labelStyle}>비활성 라이선스</div>
        </div>
        <div style={cardStyle}>
          <div style={{ ...numStyle, color: '#60a5fa' }}>{totalInstructors}</div>
          <div style={labelStyle}>전체 강사</div>
        </div>
      </div>

      {/* Plan distribution */}
      <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, marginBottom: '20px', color: '#f1f5f9' }}>플랜 분포</h2>
        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          {Object.entries(planLabels).map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: planColors[key] }} />
              <span style={{ color: '#e2e8f0', fontSize: '14px' }}>
                {label}: <strong>{planCounts[key] || 0}</strong>
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Customer table */}
      <div style={{ background: '#1e293b', borderRadius: '12px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 24px', borderBottom: '1px solid #334155', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9' }}>고객 목록</h2>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #334155' }}>
              {['이메일', '라이선스 키', '플랜', '강사', '상태', '만료일', '액션'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 14px', color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #263548' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#263548'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '12px 14px', fontSize: '14px' }}>
                  <Link to={`/customers/${c.id}`} style={{ color: '#60a5fa', textDecoration: 'none' }}>{c.email}</Link>
                </td>
                <td style={{ padding: '12px 14px', fontSize: '13px', fontFamily: 'monospace', color: '#cbd5e1' }}>
                  {c.license_key}
                  <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(c.license_key); }}
                    style={{ marginLeft: '6px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '12px' }} title="Copy">
                    [복사]
                  </button>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ background: (planColors[c.plan] || '#94a3b8') + '22', color: planColors[c.plan] || '#94a3b8', padding: '2px 10px', borderRadius: '12px', fontSize: '12px', fontWeight: 600 }}>
                    {planLabels[c.plan] || c.plan}
                  </span>
                </td>
                <td style={{ padding: '12px 14px', color: '#e2e8f0', fontSize: '14px' }}>
                  {c.instructor_count || 0}/{c.max_instructors}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ color: c.is_active ? '#4ade80' : '#f87171', fontSize: '13px' }}>
                    {c.is_active ? '활성' : '비활성'}
                  </span>
                </td>
                <td style={{ padding: '12px 14px', color: '#94a3b8', fontSize: '13px' }}>
                  {c.expires_at ? new Date(c.expires_at).toLocaleDateString('ko-KR') : '-'}
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => navigate(`/customers/${c.id}`)}
                      style={{ background: '#374151', color: '#e2e8f0', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}>
                      상세
                    </button>
                    {c.is_active && (
                      <button onClick={(e) => { e.stopPropagation(); handleDeactivate(c.id); }}
                        style={{ background: '#450a0a', color: '#fca5a5', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}>
                        비활성화
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>등록된 고객이 없습니다</div>
        )}
      </div>
    </div>
  );
}
