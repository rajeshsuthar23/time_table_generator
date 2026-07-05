import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import Dashboard from './Dashboard';
import './index.css';

const App = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(() => {
    return localStorage.getItem('app-password') === 'WISDOM@4321';
  });
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (input === 'WISDOM@4321') {
      localStorage.setItem('app-password', 'WISDOM@4321');
      setIsAuthenticated(true);
      setError('');
    } else {
      setError('Incorrect password');
      setInput('');
    }
  };

  if (isAuthenticated) {
    return <Dashboard />;
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      height: '100vh', width: '100vw', backgroundColor: '#111827', color: 'white', fontFamily: 'sans-serif'
    }}>
      <div style={{
        backgroundColor: '#1f2937', padding: '2.5rem', borderRadius: '0.5rem',
        boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.5)', textAlign: 'center', width: '350px'
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1.5rem' }}>Timetable Generator</h1>
        <p style={{ marginBottom: '1.5rem', color: '#9ca3af', fontSize: '0.875rem' }}>Please enter the password to access the app.</p>
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input
            type="password"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter Password"
            autoFocus
            style={{
              padding: '0.75rem', borderRadius: '0.375rem', border: '1px solid #374151',
              backgroundColor: '#111827', color: 'white', outline: 'none'
            }}
          />
          {error && <span style={{ color: '#ef4444', fontSize: '0.875rem' }}>{error}</span>}
          <button type="submit" style={{
            padding: '0.75rem', borderRadius: '0.375rem', border: 'none',
            backgroundColor: '#3b82f6', color: 'white', fontWeight: 'bold', cursor: 'pointer',
            transition: 'background-color 0.2s'
          }} onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'} onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}>
            Enter
          </button>
        </form>
      </div>
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
