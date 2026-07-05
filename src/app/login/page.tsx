'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function MemberLogin() {
  const router = useRouter();
  const [step, setStep] = useState<'mobile' | 'code'>('mobile');
  const [mobile, setMobile] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setInfo(''); setLoading(true);
    try {
      const res = await fetch('/api/member/otp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send code');
      setStep('code');
      setInfo('We sent a 6-digit code to your phone.');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('/api/member/otp/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mobile, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');
      // Persist a backup session token in localStorage (cookie is set too).
      if (data.token) localStorage.setItem('gm_member_token', data.token);
      router.replace('/checkin');
    } catch (err: any) {
      setError(err.message);
    } finally {
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
          <form onSubmit={sendCode}>
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
                {loading ? <span className="spinner" /> : 'Send code'}
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={verify}>
            {info && <div className="alert ok">{info}</div>}
            <label>Enter code</label>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              inputMode="numeric"
              maxLength={6}
              placeholder="6-digit code"
              autoFocus
              style={{ letterSpacing: '0.4em', textAlign: 'center', fontSize: '1.4rem' }}
            />
            {error && <div className="alert error">{error}</div>}
            <div style={{ marginTop: 18 }}>
              <button className="block" disabled={loading}>
                {loading ? <span className="spinner" /> : 'Verify & continue'}
              </button>
            </div>
            <button
              type="button"
              className="ghost block"
              style={{ marginTop: 10 }}
              onClick={() => { setStep('mobile'); setCode(''); setError(''); }}
            >
              Change number
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
