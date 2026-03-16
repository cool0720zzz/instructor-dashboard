import React, { useState, useEffect, createContext, useContext } from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, Link, useLocation } from 'react-router-dom';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import CustomerList from './pages/CustomerList.jsx';
import CustomerDetail from './pages/CustomerDetail.jsx';
import InstructorForm from './pages/InstructorForm.jsx';

const API_BASE = 'http://localhost:3000';

// Auth context
const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function getApiBase() {
  return API_BASE;
}

export function authFetch(url, options = {}) {
  const token = localStorage.getItem('admin_token');
  return fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });
}

function AuthProvider({ children }) {
  const [token, setToken] = useState(localStorage.getItem('admin_token'));
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('admin_user');
    return saved ? JSON.parse(saved) : null;
  });

  const login = (newToken, userData) => {
    localStorage.setItem('admin_token', newToken);
    localStorage.setItem('admin_user', JSON.stringify(userData));
    setToken(newToken);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, login, logout, isAuthenticated: !!token }}>
      {children}
    </AuthContext.Provider>
  );
}

function ProtectedRoute({ children }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return children;
}

function NavBar() {
  const { user, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!isAuthenticated) return null;

  const navStyle = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '12px 24px', background: '#1e293b', borderBottom: '1px solid #334155',
  };
  const linkStyle = (path) => ({
    color: location.pathname === path ? '#60a5fa' : '#94a3b8',
    textDecoration: 'none', marginRight: '20px', fontSize: '14px', fontWeight: 500,
  });

  return (
    <nav style={navStyle}>
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <span style={{ color: '#f1f5f9', fontWeight: 700, fontSize: '16px', marginRight: '32px' }}>
          강사 대시보드 관리자
        </span>
        <Link to="/dashboard" style={linkStyle('/dashboard')}>대시보드</Link>
        <Link to="/customers" style={linkStyle('/customers')}>고객 관리</Link>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ color: '#94a3b8', fontSize: '13px' }}>{user?.email}</span>
        <button
          onClick={() => { logout(); navigate('/login'); }}
          style={{
            background: '#374151', color: '#e2e8f0', border: 'none', borderRadius: '6px',
            padding: '6px 14px', cursor: 'pointer', fontSize: '13px',
          }}
        >
          로그아웃
        </button>
      </div>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NavBar />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
          <Route path="/customers" element={<ProtectedRoute><CustomerList /></ProtectedRoute>} />
          <Route path="/customers/:id" element={<ProtectedRoute><CustomerDetail /></ProtectedRoute>} />
          <Route path="/customers/:id/instructors/new" element={<ProtectedRoute><InstructorForm /></ProtectedRoute>} />
          <Route path="/instructors/:id/edit" element={<ProtectedRoute><InstructorForm /></ProtectedRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
