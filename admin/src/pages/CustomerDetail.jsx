import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { authFetch, getApiBase } from '../App.jsx';

export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState(false);
  const [editingPlace, setEditingPlace] = useState(false);
  const [newPlan, setNewPlan] = useState('');
  const [newPlaceUrl, setNewPlaceUrl] = useState('');

  useEffect(() => { loadCustomer(); }, [id]);

  const loadCustomer = async () => {
    try {
      const res = await authFetch(`${getApiBase()}/admin/customers/${id}`);
      if (res.ok) {
        const data = await res.json();
        setCustomer(data);
        setNewPlan(data.plan);
        setNewPlaceUrl(data.naver_place_url || '');
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      console.error('Failed to load customer:', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePlanChange = async () => {
    try {
      const res = await authFetch(`${getApiBase()}/admin/customers/${id}/plan`, {
        method: 'PATCH',
        body: JSON.stringify({ plan: newPlan }),
      });
      if (res.ok) { setEditingPlan(false); loadCustomer(); }
    } catch (err) { console.error('Failed to update plan:', err); }
  };

  const handlePlaceUpdate = async () => {
    try {
      const res = await authFetch(`${getApiBase()}/admin/customers/${id}/place`, {
        method: 'PATCH',
        body: JSON.stringify({ naver_place_url: newPlaceUrl }),
      });
      if (res.ok) { setEditingPlace(false); loadCustomer(); }
    } catch (err) { console.error('Failed to update place URL:', err); }
  };

  const handleDeactivate = async () => {
    if (!confirm('이 고객의 라이선스를 비활성화하시겠습니까?')) return;
    try {
      await authFetch(`${getApiBase()}/admin/customers/${id}/license`, { method: 'DELETE' });
      loadCustomer();
    } catch (err) { console.error('Failed to deactivate:', err); }
  };

  const handleDeleteInstructor = async (instructorId) => {
    if (!confirm('이 강사를 삭제하시겠습니까?')) return;
    try {
      await authFetch(`${getApiBase()}/admin/instructors/${instructorId}`, { method: 'DELETE' });
      loadCustomer();
    } catch (err) { console.error('Failed to delete instructor:', err); }
  };

  const planLabels = { free: 'Free', basic: 'Basic', standard: 'Standard', premium: 'Premium' };
  const planColors = { free: '#94a3b8', basic: '#60a5fa', standard: '#4ade80', premium: '#fbbf24' };
  const inputStyle = {
    padding: '6px 10px', background: '#0f172a', border: '1px solid #334155',
    borderRadius: '6px', color: '#e2e8f0', fontSize: '14px', outline: 'none',
  };
  const smallBtnStyle = {
    background: '#374151', color: '#e2e8f0', border: 'none', borderRadius: '4px',
    padding: '4px 12px', fontSize: '12px', cursor: 'pointer', marginLeft: '6px',
  };

  if (loading) return <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Loading...</div>;
  if (!customer) return <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>Customer not found</div>;

  const instructors = customer.instructors || [];
  const activeInstructors = instructors.filter((i) => i.is_active);

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Breadcrumb */}
      <div style={{ marginBottom: '16px', fontSize: '14px' }}>
        <Link to="/dashboard" style={{ color: '#60a5fa', textDecoration: 'none' }}>대시보드</Link>
        <span style={{ color: '#64748b', margin: '0 8px' }}>/</span>
        <span style={{ color: '#94a3b8' }}>{customer.email}</span>
      </div>

      {/* Customer info card */}
      <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' }}>
              고객 상세: {customer.email}
            </h1>
            <span style={{
              background: (planColors[customer.plan] || '#94a3b8') + '22',
              color: planColors[customer.plan] || '#94a3b8',
              padding: '2px 12px', borderRadius: '12px', fontSize: '13px', fontWeight: 600,
            }}>
              {planLabels[customer.plan] || customer.plan} 플랜
            </span>
          </div>
          {customer.is_active && (
            <button onClick={handleDeactivate} style={{
              background: '#450a0a', color: '#fca5a5', border: 'none', borderRadius: '6px',
              padding: '8px 16px', fontSize: '13px', cursor: 'pointer',
            }}>
              비활성화
            </button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px' }}>
          {/* License key */}
          <div>
            <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>라이선스 키</div>
            <div style={{ fontFamily: 'monospace', fontSize: '15px', color: '#e2e8f0' }}>
              {customer.license_key}
              <button onClick={() => navigator.clipboard.writeText(customer.license_key)} style={smallBtnStyle}>복사</button>
            </div>
          </div>

          {/* Status */}
          <div>
            <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>상태</div>
            <div style={{ color: customer.is_active ? '#4ade80' : '#f87171', fontSize: '15px', fontWeight: 600 }}>
              {customer.is_active ? '활성' : '비활성'}
            </div>
          </div>

          {/* Expiry */}
          <div>
            <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>만료일</div>
            <div style={{ color: '#e2e8f0', fontSize: '15px' }}>
              {customer.expires_at ? new Date(customer.expires_at).toLocaleDateString('ko-KR') : '무기한'}
            </div>
          </div>

          {/* Plan edit */}
          <div>
            <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>플랜 변경</div>
            {editingPlan ? (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <select value={newPlan} onChange={(e) => setNewPlan(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option value="free">Free (3명)</option>
                  <option value="basic">Basic (6명)</option>
                  <option value="standard">Standard (10명)</option>
                  <option value="premium">Premium (무제한)</option>
                </select>
                <button onClick={handlePlanChange} style={{ ...smallBtnStyle, background: '#3b82f6' }}>저장</button>
                <button onClick={() => setEditingPlan(false)} style={smallBtnStyle}>취소</button>
              </div>
            ) : (
              <button onClick={() => setEditingPlan(true)} style={{ ...smallBtnStyle, marginLeft: 0 }}>
                {planLabels[customer.plan]} - 변경
              </button>
            )}
          </div>

          {/* Place URL */}
          <div style={{ gridColumn: 'span 2' }}>
            <div style={{ color: '#94a3b8', fontSize: '12px', marginBottom: '4px' }}>플레이스 URL</div>
            {editingPlace ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="url" value={newPlaceUrl} onChange={(e) => setNewPlaceUrl(e.target.value)}
                  style={{ ...inputStyle, flex: 1 }} placeholder="https://map.naver.com/..." />
                <button onClick={handlePlaceUpdate} style={{ ...smallBtnStyle, background: '#3b82f6' }}>저장</button>
                <button onClick={() => setEditingPlace(false)} style={smallBtnStyle}>취소</button>
              </div>
            ) : (
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <span style={{ color: '#e2e8f0', fontSize: '14px', marginRight: '8px' }}>
                  {customer.naver_place_url || '미설정'}
                </span>
                <button onClick={() => setEditingPlace(true)} style={smallBtnStyle}>편집</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Instructor list */}
      <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9' }}>
            강사 목록 ({activeInstructors.length}/{customer.max_instructors}명)
          </h2>
          <Link to={`/customers/${id}/instructors/new`} style={{
            background: '#3b82f6', color: '#fff', textDecoration: 'none', borderRadius: '6px',
            padding: '8px 16px', fontSize: '13px', fontWeight: 600,
          }}>
            + 강사 추가
          </Link>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #334155' }}>
              {['이름', '블로그 URL', 'RSS URL', '키워드', '색상', '액션'].map((h) => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 12px', color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {instructors.map((inst) => (
              <tr key={inst.id} style={{ borderBottom: '1px solid #263548' }}>
                <td style={{ padding: '10px 12px', color: '#e2e8f0', fontSize: '14px', fontWeight: 500 }}>
                  {inst.name}
                  {!inst.is_active && <span style={{ color: '#f87171', fontSize: '11px', marginLeft: '6px' }}>(비활성)</span>}
                </td>
                <td style={{ padding: '10px 12px', color: '#94a3b8', fontSize: '13px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {inst.blog_url || '-'}
                </td>
                <td style={{ padding: '10px 12px', color: '#64748b', fontSize: '12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {inst.blog_rss_url || '-'}
                </td>
                <td style={{ padding: '10px 12px', fontSize: '13px' }}>
                  {(inst.keywords || []).map((kw, i) => (
                    <span key={i} style={{ background: '#334155', color: '#cbd5e1', padding: '1px 8px', borderRadius: '10px', fontSize: '11px', marginRight: '4px' }}>
                      {kw}
                    </span>
                  ))}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {inst.display_color && (
                    <div style={{ width: '20px', height: '20px', borderRadius: '50%', background: inst.display_color, border: '2px solid #334155' }} />
                  )}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <Link to={`/instructors/${inst.id}/edit`} style={{
                      background: '#374151', color: '#e2e8f0', textDecoration: 'none',
                      borderRadius: '4px', padding: '4px 10px', fontSize: '12px',
                    }}>
                      편집
                    </Link>
                    <button onClick={() => handleDeleteInstructor(inst.id)} style={{
                      background: '#450a0a', color: '#fca5a5', border: 'none',
                      borderRadius: '4px', padding: '4px 10px', fontSize: '12px', cursor: 'pointer',
                    }}>
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {instructors.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>등록된 강사가 없습니다</div>
        )}
      </div>
    </div>
  );
}
