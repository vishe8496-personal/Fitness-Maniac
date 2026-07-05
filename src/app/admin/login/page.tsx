'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function AdminLoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      router.replace(params.get('next') || '/admin/dashboard');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="center-screen">
      <div className="card narrow" style={{ width: '100%', maxWidth: 400 }}>
        <div className="logo" style={{ marginBottom: 16 }}>Fitness<span>Maniac</span></div>
        <h1>Admin login</h1>
        <p className="muted small">Sign in to manage members and attendance.</p>
        <form onSubmit={submit}>
          <label>Username</label>
          <input value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" autoFocus />
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
          {error && <div className="alert error">{error}</div>}
          <div style={{ marginTop: 18 }}>
            <button className="block" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function AdminLogin() {
  return (
    <Suspense fallback={<div className="center-screen"><span className="spinner" /></div>}>
      <AdminLoginForm />
    </Suspense>
  );
}
