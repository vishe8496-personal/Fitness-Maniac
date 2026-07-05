'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function RegisterMember() {
  const [name, setName] = useState('');
  const [mobile, setMobile] = useState('');
  const [months, setMonths] = useState(1);
  const [role, setRole] = useState<'member' | 'coach'>('member');
  const [error, setError] = useState('');
  const [ok, setOk] = useState<null | { name: string; start_date: string; end_date: string }>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setOk(null);
    setLoading(true);
    try {
      const res = await fetch('/api/admin/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, mobile, subscription_months: months, role }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register');
      setOk({ name: data.member.name, start_date: data.member.start_date, end_date: data.member.end_date });
      setName('');
      setMobile('');
      setMonths(1);
      setRole('member');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container narrow">
      <div className="topbar">
        <div className="logo">Fitness<span>Maniac</span></div>
        <Link href="/admin/dashboard"><button className="ghost">Dashboard</button></Link>
      </div>

      <div className="card">
        <h1>Register member</h1>
        <p className="muted small">Membership starts today. End date is auto-calculated.</p>
        <form onSubmit={submit}>
          <label>Full name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />

          <label>Mobile number</label>
          <input value={mobile} onChange={(e) => setMobile(e.target.value)} inputMode="tel" placeholder="e.g. 9876543210" />

          <label>Role</label>
          <select value={role} onChange={(e) => setRole(e.target.value as 'member' | 'coach')}>
            <option value="member">Member</option>
            <option value="coach">Coach</option>
          </select>

          <label>{role === 'coach' ? 'Engagement period (months)' : 'Subscription (months)'}</label>
          <select value={months} onChange={(e) => setMonths(Number(e.target.value))}>
            {[1, 2, 3, 6, 12].map((m) => (
              <option key={m} value={m}>{m} month{m > 1 ? 's' : ''}</option>
            ))}
          </select>

          {error && <div className="alert error">{error}</div>}
          {ok && (
            <div className="alert ok">
              ✓ {ok.name} registered. Valid {ok.start_date} → <strong>{ok.end_date}</strong>.
            </div>
          )}

          <div style={{ marginTop: 18 }}>
            <button className="block" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Register member'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
