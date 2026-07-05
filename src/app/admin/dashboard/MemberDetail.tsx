'use client';

import { useCallback, useEffect, useState } from 'react';

interface Member {
  id: string;
  name: string;
  mobile: string;
  start_date: string;
  end_date: string;
  status: 'active' | 'expiring' | 'expired';
  days_until_end: number;
  subscription_months?: number;
  role?: 'member' | 'coach';
}
interface Entry { id: string; ts: string; source: string; }

function fmt(ts: string) {
  return new Date(ts).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

// datetime-local value for "now"
function nowLocalInput() {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

export default function MemberDetail({
  memberId,
  onClose,
  onChanged,
}: {
  memberId: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [member, setMember] = useState<Member | null>(null);
  const [attendance, setAttendance] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addTs, setAddTs] = useState(nowLocalInput());
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/admin/members/${memberId}`);
    const data = await res.json();
    if (res.ok) {
      setMember(data.member);
      setAttendance(data.attendance);
    } else {
      setError(data.error || 'Failed to load');
    }
    setLoading(false);
  }, [memberId]);

  useEffect(() => { load(); }, [load]);

  async function addEntry() {
    setBusy(true);
    setError('');
    const res = await fetch('/api/admin/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ member_id: memberId, ts: new Date(addTs).toISOString() }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) return setError(data.error || 'Failed to add');
    await load();
    onChanged();
  }

  async function removeEntry(id: string) {
    if (!confirm('Remove this attendance entry?')) return;
    setBusy(true);
    const res = await fetch(`/api/admin/attendance?id=${id}`, { method: 'DELETE' });
    setBusy(false);
    if (res.ok) { await load(); onChanged(); }
  }

  async function deleteMember() {
    if (!member) return;
    if (!confirm(`Delete ${member.name} and all their attendance? This cannot be undone.`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/members/${memberId}`, { method: 'DELETE' });
    setBusy(false);
    if (res.ok) { onChanged(); onClose(); }
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '5vh 16px', zIndex: 50, overflowY: 'auto',
      }}
    >
      <div
        className="card"
        onClick={(e) => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 560 }}
      >
        <div className="row between">
          <h2 style={{ margin: 0 }}>
            {member?.name || 'Member'}
            {member?.role === 'coach' && <span className="badge coach" style={{ marginLeft: 8 }}>coach</span>}
          </h2>
          <button className="ghost" style={{ padding: '6px 12px' }} onClick={onClose}>Close</button>
        </div>

        {loading ? (
          <p className="muted">Loading…</p>
        ) : member ? (
          <>
            <div className="row wrap" style={{ gap: 16, marginTop: 8 }}>
              <div><div className="muted small">Mobile</div>{member.mobile}</div>
              <div><div className="muted small">Ends</div>{member.end_date}</div>
              <div>
                <div className="muted small">Status</div>
                <span className={`badge ${member.status}`}>{member.status}</span>
              </div>
            </div>

            <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '18px 0' }} />

            <h2>Add attendance manually</h2>
            <div className="row wrap" style={{ gap: 10 }}>
              <input
                type="datetime-local"
                value={addTs}
                onChange={(e) => setAddTs(e.target.value)}
                style={{ flex: 1, minWidth: 200 }}
              />
              <button onClick={addEntry} disabled={busy}>Add</button>
            </div>

            {error && <div className="alert error">{error}</div>}

            <h2 style={{ marginTop: 22 }}>Attendance history ({attendance.length})</h2>
            {attendance.length === 0 ? (
              <p className="muted">No attendance recorded yet.</p>
            ) : (
              <table>
                <tbody>
                  {attendance.map((e) => (
                    <tr key={e.id}>
                      <td>{fmt(e.ts)}</td>
                      <td className="muted small">{e.source}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="danger"
                          style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                          onClick={() => removeEntry(e.id)}
                          disabled={busy}
                        >
                          Remove
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            <hr style={{ border: 0, borderTop: '1px solid var(--border)', margin: '18px 0' }} />
            <button className="danger" onClick={deleteMember} disabled={busy}>
              Delete member
            </button>
          </>
        ) : (
          <div className="alert error">{error}</div>
        )}
      </div>
    </div>
  );
}
