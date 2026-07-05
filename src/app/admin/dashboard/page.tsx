'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MemberDetail from './MemberDetail';

interface Member {
  id: string;
  name: string;
  mobile: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'expiring' | 'expired';
  role?: 'member' | 'coach';
}

interface Stats {
  counts: { total: number; active: number; expiring: number; expired: number };
  today: { present: number; eligible: number; pct: number };
  expiringSoon: { id: string; name: string; mobile: string; end_date: string; days_until_end: number }[];
}

const STATUS_FILTERS = ['all', 'active', 'expiring', 'expired'] as const;

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('all');
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    const res = await fetch('/api/admin/stats');
    if (res.status === 401) return router.replace('/admin/login');
    if (res.ok) setStats(await res.json());
  }, [router]);

  const loadMembers = useCallback(async () => {
    const url = new URL('/api/admin/members', window.location.origin);
    if (q) url.searchParams.set('q', q);
    if (status !== 'all') url.searchParams.set('status', status);
    const res = await fetch(url.toString());
    if (res.status === 401) return router.replace('/admin/login');
    if (res.ok) {
      const data = await res.json();
      setMembers(data.members);
    }
    setLoading(false);
  }, [q, status, router]);

  useEffect(() => { loadStats(); }, [loadStats]);

  useEffect(() => {
    const t = setTimeout(loadMembers, 250); // debounce search
    return () => clearTimeout(t);
  }, [loadMembers]);

  async function logout() {
    await fetch('/api/admin/logout', { method: 'POST' });
    router.replace('/admin/login');
  }

  function refreshAll() {
    loadStats();
    loadMembers();
  }

  return (
    <div className="container">
      <div className="topbar">
        <div className="logo">Fitness<span>Maniac</span></div>
        <div className="row">
          <Link href="/admin/register"><button>+ Register</button></Link>
          <button className="ghost" onClick={logout}>Logout</button>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="stat-grid" style={{ marginBottom: 16 }}>
          <div className="stat">
            <div className="num">{stats.today.pct}%</div>
            <div className="lbl">Today&apos;s attendance ({stats.today.present}/{stats.today.eligible})</div>
          </div>
          <div className="stat">
            <div className="num">{stats.counts.active}</div>
            <div className="lbl">Active</div>
          </div>
          <div className="stat">
            <div className="num" style={{ color: 'var(--amber)' }}>{stats.counts.expiring}</div>
            <div className="lbl">Expiring ≤ 7 days</div>
          </div>
          <div className="stat">
            <div className="num" style={{ color: 'var(--red)' }}>{stats.counts.expired}</div>
            <div className="lbl">Expired</div>
          </div>
        </div>
      )}

      {/* Expiring soon highlight */}
      {stats && stats.expiringSoon.length > 0 && (
        <div className="card" style={{ borderColor: 'rgba(245,166,35,0.4)' }}>
          <h2 style={{ color: 'var(--amber)' }}>⚠ Expiring in the next 7 days</h2>
          <table>
            <tbody>
              {stats.expiringSoon.map((m) => (
                <tr key={m.id} className="clickable" onClick={() => setSelected(m.id)}>
                  <td><strong>{m.name}</strong></td>
                  <td className="muted">{m.mobile}</td>
                  <td>{m.end_date}</td>
                  <td>
                    <span className="badge expiring">
                      {m.days_until_end === 0 ? 'today' : `${m.days_until_end}d left`}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Member list */}
      <div className="card">
        <div className="row between wrap" style={{ marginBottom: 12 }}>
          <h2 style={{ margin: 0 }}>Members</h2>
          <div className="row wrap">
            {STATUS_FILTERS.map((s) => (
              <button
                key={s}
                className={s === status ? '' : 'ghost'}
                style={{ padding: '6px 12px', fontSize: '0.85rem', textTransform: 'capitalize' }}
                onClick={() => setStatus(s)}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <input
          placeholder="Search by name or mobile…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ marginBottom: 14 }}
        />

        {loading ? (
          <p className="muted">Loading…</p>
        ) : members.length === 0 ? (
          <p className="muted">No members found.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Mobile</th>
                <th>Ends</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.id} className="clickable" onClick={() => setSelected(m.id)}>
                  <td>
                    <strong>{m.name}</strong>
                    {m.role === 'coach' && <span className="badge coach" style={{ marginLeft: 8 }}>coach</span>}
                  </td>
                  <td className="muted">{m.mobile}</td>
                  <td>{m.end_date}</td>
                  <td><span className={`badge ${m.status}`}>{m.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {selected && (
        <MemberDetail
          memberId={selected}
          onClose={() => setSelected(null)}
          onChanged={refreshAll}
        />
      )}
    </div>
  );
}
