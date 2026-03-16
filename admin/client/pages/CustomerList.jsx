import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authFetch, getApiBase } from '../App.jsx';

export default function CustomerList() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newBusinessName, setNewBusinessName] = useState('');
  const [newPlaceUrl, setNewPlaceUrl] = useState('');
  const [addError, setAddError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const res = await authFetch(`${getApiBase()}/admin/customers`);
      if (res.ok) {
        setCustomers(await res.json());
      }
    } catch (err) {
      console.error('Failed to load customers:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    setAddError('');
    try {
      const res = await authFetch(`${getApiBase()}/admin/customers`, {
        method: 'POST',
        body: JSON.stringify({
          email: newEmail,
          business_name: newBusinessName,
          naver_place_url: newPlaceUrl || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAddError(data.error);
        return;
      }
      setShowAddForm(false);
      setNewEmail('');
      setNewBusinessName('');
      setNewPlaceUrl('');
      loadCustomers();
    } catch (err) {
      setAddError('Failed to create customer');
    }
  };

  const handleDeactivate = async (id) => {
    if (!confirm('이 고객의 라이선스를 비활성화하시겠습니까?')) return;
    try {
      await authFetch(`${getApiBase()}/admin/customers/${id}/license`, { method: 'DELETE' });
      loadCustomers();
    } catch (err) {
      console.error('Failed to deactivate:', err);
    }
  };

  const inputStyle = {
    width: '100%', padding: '8px 12px', background: '#0f172a', border: '1px solid #334155',
    borderRadius: '6px', color: '#e2e8f0', fontSize: '14px', outline: 'none',
  };

  if (loading) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading...</div>;
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#f1f5f9' }}>고객 관리</h1>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          style={{
            background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px',
            padding: '10px 20px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
          }}
        >
          + 신규 고객
        </button>
      </div>

      {/* Add customer form */}
      {showAddForm && (
        <div style={{
          background: '#1e293b', borderRadius: '12px', padding: '24px', marginBottom: '24px',
          border: '1px solid #334155',
        }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px', color: '#f1f5f9' }}>
            신규 고객 등록
          </h3>
          <form onSubmit={handleAdd}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>상호명 *</label>
                <input type="text" value={newBusinessName} onChange={(e) => setNewBusinessName(e.target.value)} required style={inputStyle} placeholder="행복학원" />
              </div>
              <div>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>이메일 *</label>
                <input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required style={inputStyle} placeholder="customer@example.com" />
              </div>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ color: '#94a3b8', fontSize: '12px', display: 'block', marginBottom: '4px' }}>플레이스 URL</label>
                <input type="url" value={newPlaceUrl} onChange={(e) => setNewPlaceUrl(e.target.value)} style={inputStyle} placeholder="https://map.naver.com/..." />
              </div>
            </div>
            <div style={{ color: '#64748b', fontSize: '12px', marginBottom: '12px' }}>
              라이선스 키는 자동으로 생성됩니다 (XXXX-XXXX-XXXX-XXXX)
            </div>
            {addError && (
              <div style={{ background: '#450a0a', color: '#fca5a5', padding: '8px 12px', borderRadius: '6px', fontSize: '13px', marginBottom: '12px' }}>
                {addError}
              </div>
            )}
            <div style={{ display: 'flex', gap: '8px' }}>
              <button type="submit" style={{ background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '6px', padding: '8px 20px', fontSize: '14px', cursor: 'pointer' }}>
                등록
              </button>
              <button type="button" onClick={() => setShowAddForm(false)} style={{ background: '#374151', color: '#e2e8f0', border: 'none', borderRadius: '6px', padding: '8px 20px', fontSize: '14px', cursor: 'pointer' }}>
                취소
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Customer table */}
      <div style={{ background: '#1e293b', borderRadius: '12px', overflow: 'hidden' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #334155' }}>
              {['상호명', '이메일', '라이선스 키', '강사 수', '상태', '액션'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 14px', color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #1e293b', cursor: 'pointer' }}
                  onMouseEnter={(e) => e.currentTarget.style.background = '#263548'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <td style={{ padding: '12px 14px', fontSize: '14px', color: '#f1f5f9', fontWeight: 500 }}>
                  <Link to={`/customers/${c.id}`} style={{ color: '#f1f5f9', textDecoration: 'none' }}>
                    {c.business_name || '-'}
                  </Link>
                </td>
                <td style={{ padding: '12px 14px', fontSize: '13px', color: '#94a3b8' }}>
                  <Link to={`/customers/${c.id}`} style={{ color: '#60a5fa', textDecoration: 'none' }}>{c.email}</Link>
                </td>
                <td style={{ padding: '12px 14px', fontSize: '13px', fontFamily: 'monospace', color: '#cbd5e1' }}>
                  {c.license_key}
                  <button
                    onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(c.license_key); }}
                    style={{ marginLeft: '6px', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '12px' }}
                    title="Copy"
                  >
                    [복사]
                  </button>
                </td>
                <td style={{ padding: '12px 14px', color: '#e2e8f0', fontSize: '14px' }}>
                  {c.instructor_count || 0}명
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <span style={{ color: c.is_active ? '#4ade80' : '#f87171', fontSize: '13px' }}>
                    {c.is_active ? '활성' : '비활성'}
                  </span>
                </td>
                <td style={{ padding: '12px 14px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={(e) => { e.stopPropagation(); navigate(`/customers/${c.id}`); }}
                      style={{ background: '#374151', color: '#e2e8f0', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}
                    >
                      상세
                    </button>
                    {c.is_active && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeactivate(c.id); }}
                        style={{ background: '#450a0a', color: '#fca5a5', border: 'none', borderRadius: '4px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer' }}
                      >
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
          <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
            등록된 고객이 없습니다
          </div>
        )}
      </div>
    </div>
  );
}
