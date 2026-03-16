import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { authFetch, getApiBase } from '../App.jsx';

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
  if (url.includes('wordpress.com') || url.match(/\/wp-content\//)) {
    return url.replace(/\/$/, '') + '/feed';
  }
  return url.replace(/\/$/, '') + '/rss';
}

const COLOR_OPTIONS = ['#22c55e', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export default function InstructorForm() {
  const { id } = useParams();
  const navigate = useNavigate();

  const isEdit = window.location.pathname.includes('/instructors/') && window.location.pathname.includes('/edit');
  const customerId = isEdit ? null : id;

  const [name, setName] = useState('');
  const [blogUrl, setBlogUrl] = useState('');
  const [keywords, setKeywords] = useState('');
  const [displayColor, setDisplayColor] = useState('#22c55e');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isEdit) loadInstructor();
  }, [id, isEdit]);

  const loadInstructor = async () => {
    // Fetch all customers and find the instructor
    try {
      const res = await authFetch(`${getApiBase()}/api/customers`);
      if (res.ok) {
        const customers = await res.json();
        for (const c of customers) {
          const detailRes = await authFetch(`${getApiBase()}/api/customers/${c.id}`);
          if (detailRes.ok) {
            const detail = await detailRes.json();
            const found = (detail.instructors || []).find((i) => i.id === id);
            if (found) {
              setName(found.name);
              setBlogUrl(found.blog_url || '');
              setKeywords(Array.isArray(found.keywords) ? found.keywords.join(', ') : '');
              setDisplayColor(found.display_color || '#22c55e');
              return;
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to load instructor:', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const body = {
      name,
      blog_url: blogUrl || undefined,
      keywords: keywords || undefined,
      display_color: displayColor,
    };

    try {
      let res;
      if (isEdit) {
        res = await authFetch(`${getApiBase()}/api/instructors/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(body),
        });
      } else {
        res = await authFetch(`${getApiBase()}/api/customers/${customerId}/instructors`, {
          method: 'POST',
          body: JSON.stringify(body),
        });
      }

      const data = await res.json();
      if (!res.ok) {
        setError(data.error);
        setLoading(false);
        return;
      }

      if (isEdit) {
        navigate(-1);
      } else {
        navigate(`/customers/${customerId}`);
      }
    } catch (err) {
      setError('Failed to save instructor');
      setLoading(false);
    }
  };

  const rssPreview = blogUrlToRss(blogUrl);

  const inputStyle = {
    width: '100%', padding: '10px 14px', background: '#0f172a', border: '1px solid #334155',
    borderRadius: '8px', color: '#e2e8f0', fontSize: '14px', outline: 'none',
  };

  return (
    <div style={{ padding: '32px', maxWidth: '700px', margin: '0 auto' }}>
      <div style={{ marginBottom: '16px', fontSize: '14px' }}>
        <Link to="/dashboard" style={{ color: '#60a5fa', textDecoration: 'none' }}>대시보드</Link>
        <span style={{ color: '#64748b', margin: '0 8px' }}>/</span>
        <span style={{ color: '#94a3b8' }}>{isEdit ? '강사 수정' : '강사 추가'}</span>
      </div>

      <div style={{ background: '#1e293b', borderRadius: '12px', padding: '32px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '24px', color: '#f1f5f9' }}>
          {isEdit ? '강사 수정' : '강사 추가'}
        </h1>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: '20px' }}>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>
              이름 <span style={{ color: '#f87171' }}>*</span>
            </label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              required placeholder="김지수" style={inputStyle} />
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>블로그 URL</label>
            <input type="url" value={blogUrl} onChange={(e) => setBlogUrl(e.target.value)}
              placeholder="https://blog.naver.com/instructor_id" style={inputStyle} />
            {blogUrl && rssPreview && (
              <div style={{
                marginTop: '8px', padding: '8px 12px', background: '#0f172a',
                borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center',
              }}>
                <span style={{ color: '#64748b', marginRight: '8px' }}>RSS:</span>
                <span style={{ color: '#4ade80' }}>{rssPreview}</span>
                <span style={{ color: '#4ade80', marginLeft: '6px' }}>&#10003;</span>
              </div>
            )}
          </div>

          <div style={{ marginBottom: '20px' }}>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '6px' }}>키워드 (쉼표 구분)</label>
            <input type="text" value={keywords} onChange={(e) => setKeywords(e.target.value)}
              placeholder="김지수, 지수쌤" style={inputStyle} />
            {keywords && (
              <div style={{ marginTop: '8px', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {keywords.split(',').map((kw) => kw.trim()).filter(Boolean).map((kw, i) => (
                  <span key={i} style={{ background: '#334155', color: '#cbd5e1', padding: '2px 10px', borderRadius: '12px', fontSize: '12px' }}>
                    {kw}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div style={{ marginBottom: '28px' }}>
            <label style={{ color: '#94a3b8', fontSize: '13px', display: 'block', marginBottom: '8px' }}>표시 색상</label>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {COLOR_OPTIONS.map((color) => (
                <button key={color} type="button" onClick={() => setDisplayColor(color)} style={{
                  width: '36px', height: '36px', borderRadius: '50%', background: color,
                  border: displayColor === color ? '3px solid #fff' : '3px solid transparent',
                  cursor: 'pointer', transition: 'border-color 0.15s',
                  boxShadow: displayColor === color ? `0 0 0 2px ${color}` : 'none',
                }} />
              ))}
            </div>
          </div>

          {error && (
            <div style={{ background: '#450a0a', color: '#fca5a5', padding: '10px 14px', borderRadius: '6px', fontSize: '13px', marginBottom: '16px' }}>
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" disabled={loading} style={{
              background: '#3b82f6', color: '#fff', border: 'none', borderRadius: '8px',
              padding: '10px 24px', fontSize: '14px', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
            }}>
              {loading ? '저장 중...' : (isEdit ? '수정' : '추가')}
            </button>
            <button type="button" onClick={() => navigate(-1)} style={{
              background: '#374151', color: '#e2e8f0', border: 'none', borderRadius: '8px',
              padding: '10px 24px', fontSize: '14px', cursor: 'pointer',
            }}>
              취소
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
