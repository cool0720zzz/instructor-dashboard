import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { authFetch, getApiBase } from '../App.jsx';

export default function Dashboard() {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const res = await authFetch(`${getApiBase()}/admin/customers`);
      if (res.ok) {
        const data = await res.json();
        setCustomers(data);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  const totalCustomers = customers.length;
  const activeLicenses = customers.filter((c) => c.is_active).length;
  const inactiveLicenses = totalCustomers - activeLicenses;
  const totalInstructors = customers.reduce((acc, c) => acc + (c.instructor_count || 0), 0);

  const cardStyle = {
    background: '#1e293b', borderRadius: '12px', padding: '24px',
    flex: '1', minWidth: '200px',
  };
  const numStyle = { fontSize: '32px', fontWeight: 700, color: '#f1f5f9', marginBottom: '4px' };
  const labelStyle = { color: '#94a3b8', fontSize: '14px' };

  if (loading) {
    return (
      <div style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
        Loading...
      </div>
    );
  }

  return (
    <div style={{ padding: '32px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '28px', color: '#f1f5f9' }}>
        대시보드
      </h1>

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

      {/* Recent customers */}
      <div style={{ background: '#1e293b', borderRadius: '12px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#f1f5f9' }}>최근 고객</h2>
          <Link to="/customers" style={{ color: '#60a5fa', textDecoration: 'none', fontSize: '14px' }}>
            전체 보기 &rarr;
          </Link>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #334155' }}>
              <th style={{ textAlign: 'left', padding: '10px 12px', color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>상호명</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>이메일</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>상태</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>강사 수</th>
            </tr>
          </thead>
          <tbody>
            {customers.slice(0, 5).map((c) => (
              <tr key={c.id} style={{ borderBottom: '1px solid #1e293b' }}>
                <td style={{ padding: '10px 12px', fontSize: '14px', color: '#f1f5f9', fontWeight: 500 }}>
                  <Link to={`/customers/${c.id}`} style={{ color: '#f1f5f9', textDecoration: 'none' }}>
                    {c.business_name || '-'}
                  </Link>
                </td>
                <td style={{ padding: '10px 12px', fontSize: '13px' }}>
                  <Link to={`/customers/${c.id}`} style={{ color: '#60a5fa', textDecoration: 'none' }}>
                    {c.email}
                  </Link>
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <span style={{
                    color: c.is_active ? '#4ade80' : '#f87171', fontSize: '13px',
                  }}>
                    {c.is_active ? '활성' : '비활성'}
                  </span>
                </td>
                <td style={{ padding: '10px 12px', color: '#e2e8f0', fontSize: '14px' }}>
                  {c.instructor_count || 0}명
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {customers.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
            등록된 고객이 없습니다
          </div>
        )}
      </div>
    </div>
  );
}
