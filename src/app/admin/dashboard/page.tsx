'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import MemberDetail from './MemberDetail';
import VisitsChart, { DayPoint } from './VisitsChart';

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

interface Visits {
  from: string;
  to: string;
  days: DayPoint[];
  totals: { uniqueMembers: number; memberVisits: number };
}

const STATUS_FILTERS = ['all', 'active', 'expiring', 'expired'] as const;

function isoDaysAgo(n: number): string {
  const d = new Date(Date.now() - n * 86_400_000);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function Dashboard() {
  const router = useRouter();
  const [stats, setStats] = useState<Stats | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<(typeof STATUS_FILTERS)[number]>('all');
  const [roleTab, setRoleTab] = useState<'members' | 'coaches'>('members');
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Visits chart state (collapsed by default; loads on first open)
  const [showVisits, setShowVisits] = useState(false);
  const [fromDate, setFromDate] = useState(() => isoDaysAgo(13));
  const [toDate, setToDate] = useState(() => isoDaysAgo(0));
  const [visits, setVisits] = useState<Visits | null>(null);
  const [visitsError, setVisitsError] = useState('');

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

  const loadVisits = useCallback(async () => {
    setVisitsError('');
    const url = new URL('/api/admin/visits', window.location.origin);
    url.searchParams.set('from', fromDate);
    url.searchParams.set('to', toDate);
    const res = await fetch(url.toString());
    if (res.status === 401) return router.replace('/admin/login');
    const data = await res.json();
    if (res.ok) setVisits(data);
    else setVisitsError(data.error || 'Failed to load visits');
  }, [fromDate, toDate, router]);

  useEffect(() => { loadStats(); }, [loadStats]);
  useEffect(() => { if (showVisits) loadVisits(); }, [showVisits, loadVisits]);

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
    loadVisits();
  }

  const shownMembers = members.filter((m) =>
    roleTab === 'coaches' ? m.role === 'coach' : m.role !== 'coach'
  );

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

      {/* Visits chart (collapsed by default) */}
      <div className="card">
        <div className="row between wrap">
          <h2 style={{ margin: 0 }}>Visits</h2>
          <button className="ghost" style={{ padding: '8px 16px', fontSize: '0.88rem' }} onClick={() => setShowVisits(!showVisits)}>
            {showVisits ? 'Hide graph' : '📊 View graph'}
          </button>
        </div>

        {showVisits && (
          <div style={{ marginTop: 16 }}>
            <div className="row wrap" style={{ gap: 8, marginBottom: 12 }}>
              <input
                type="date"
                value={fromDate}
                max={toDate}
                onChange={(e) => setFromDate(e.target.value)}
                style={{ width: 150, padding: '8px 10px' }}
              />
              <span className="muted small">to</span>
              <input
                type="date"
                value={toDate}
                min={fromDate}
                onChange={(e) => setToDate(e.target.value)}
                style={{ width: 150, padding: '8px 10px' }}
              />
            </div>

            {visitsError && <div className="alert error">{visitsError}</div>}
            {visits && (
              <>
                <p className="muted small" style={{ margin: '0 0 10px' }}>
                  <strong style={{ color: 'var(--text)' }}>{visits.totals.uniqueMembers}</strong> unique member{visits.totals.uniqueMembers === 1 ? '' : 's'} visited ·{' '}
                  <strong style={{ color: 'var(--text)' }}>{visits.totals.memberVisits}</strong> total visit{visits.totals.memberVisits === 1 ? '' : 's'}
                </p>
                <VisitsChart days={visits.days} />
                <div className="row" style={{ gap: 14, marginTop: 6 }}>
                  <span className="muted small"><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--primary)', borderRadius: 2, marginRight: 5 }} />Members</span>
                  <span className="muted small"><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--amber)', borderRadius: 2, marginRight: 5 }} />Coach visits</span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

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

      {/* Member / Coach list with tabs */}
      <div className="card">
        <div className="tabs">
          <button
            className={`tab ${roleTab === 'members' ? 'active' : ''}`}
            onClick={() => setRoleTab('members')}
          >
            Members
          </button>
          <button
            className={`tab ${roleTab === 'coaches' ? 'active' : ''}`}
            onClick={() => setRoleTab('coaches')}
          >
            Coaches
          </button>
        </div>

        <div className="row between wrap" style={{ margin: '14px 0 12px' }}>
          <input
            placeholder={`Search ${roleTab} by name or mobile…`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ flex: 1, minWidth: 200 }}
          />
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

        {loading ? (
          <p className="muted">Loading…</p>
        ) : shownMembers.length === 0 ? (
          <p className="muted">No {roleTab} found.</p>
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
              {shownMembers.map((m) => (
                <tr key={m.id} className="clickable" onClick={() => setSelected(m.id)}>
                  <td><strong>{m.name}</strong></td>
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
