'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MemberLogin() {
  const router = useRouter();
  const [step, setStep] = useState<'mobile' | 'confirm'>('mobile');
  const [mobile, setMobile] = useState('');
  const [firstName, setFirstName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/member/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      setFirstName(data.firstName);
      setStep('confirm');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/member/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, confirmed: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Login failed');
      // Persist a backup session token in localStorage (cookie is set too).
      if (data.token) localStorage.setItem('gm_member_token', data.token);
      router.replace('/checkin');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="center-screen">
      <div className="card" style={{ width: '100%', maxWidth: 400 }}>
        <div className="logo" style={{ marginBottom: 16 }}>Fitness<span>Maniac</span></div>
        <h1>Member login</h1>
        <p className="muted small">One-time login. We&apos;ll remember you on this device.</p>

        {step === 'mobile' ? (
          <form onSubmit={lookup}>
            <label>Mobile number</label>
            <input
              value={mobile}
              onChange={(e) => setMobile(e.target.value)}
              inputMode="tel"
              placeholder="e.g. 9876543210"
              autoFocus
            />
            {error && <div className="alert error">{error}</div>}
            <div style={{ marginTop: 18 }}>
              <button className="block" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Continue'}
              </button>
            </div>
          </form>
        ) : (
          <div>
            <div className="alert ok" style={{ fontSize: '1rem' }}>
              You&apos;re logging in as <strong>{firstName}</strong> — that you?
            </div>
            {error && <div className="alert error">{error}</div>}
            <div style={{ marginTop: 18 }} className="stack">
              <button className="block" onClick={confirm} disabled={loading}>
                {loading ? <span className="spinner" /> : `Yes, I'm ${firstName}`}
              </button>
              <button
                type="button"
                className="ghost block"
                onClick={() => { setStep('mobile'); setError(''); setFirstName(''); }}
                disabled={loading}
              >
                No, change number
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
