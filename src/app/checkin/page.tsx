'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { haversineMeters } from '@/lib/geo';

interface Member {
  id: string; name: string; mobile: string; end_date: string;
  status: 'active' | 'expiring' | 'expired'; days_until_end: number;
}
interface Gym { name: string; lat: number; lng: number; radius_m: number; }

// Attach the localStorage backup token (cookie is sent automatically).
function authHeaders(): HeadersInit {
  const t = typeof window !== 'undefined' ? localStorage.getItem('gm_member_token') : null;
  return t ? { Authorization: `Bearer ${t}` } : {};
}

type GeoState =
  | { kind: 'idle' }
  | { kind: 'locating' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; lat: number; lng: number; accuracy: number; distanceM: number; within: boolean };

export default function CheckIn() {
  const router = useRouter();
  const [member, setMember] = useState<Member | null>(null);
  const [gym, setGym] = useState<Gym | null>(null);
  const [loading, setLoading] = useState(true);
  const [geo, setGeo] = useState<GeoState>({ kind: 'idle' });
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Bootstrap: verify session + load gym.
  useEffect(() => {
    (async () => {
      const meRes = await fetch('/api/member/me', { headers: authHeaders() });
      if (meRes.status === 401) { router.replace('/login'); return; }
      const meData = await meRes.json();
      setMember(meData.member);

      const gymRes = await fetch('/api/member/gym', { headers: authHeaders() });
      if (gymRes.ok) setGym((await gymRes.json()).gym);
      setLoading(false);
    })();
  }, [router]);

  const locate = useCallback(() => {
    if (!gym) return;
    if (!('geolocation' in navigator)) {
      setGeo({ kind: 'error', message: 'Geolocation is not supported on this device.' });
      return;
    }
    setGeo({ kind: 'locating' });
    setResult(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        const distanceM = haversineMeters(latitude, longitude, gym.lat, gym.lng);
        setGeo({
          kind: 'ready',
          lat: latitude,
          lng: longitude,
          accuracy,
          distanceM,
          within: distanceM <= gym.radius_m,
        });
      },
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Enable it in your browser settings to check in.'
            : 'Could not get your location. Try again.';
        setGeo({ kind: 'error', message: msg });
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }, [gym]);

  // Auto-locate once gym config is loaded.
  useEffect(() => { if (gym) locate(); }, [gym, locate]);

  async function markAttendance() {
    if (geo.kind !== 'ready') return;
    setSubmitting(true);
    setResult(null);
    try {
      const res = await fetch('/api/member/checkin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify({ lat: geo.lat, lng: geo.lng }),
      });
      const data = await res.json();
      if (!res.ok) {
        setResult({ ok: false, message: data.error || 'Check-in failed' });
      } else if (data.alreadyCheckedIn) {
        setResult({ ok: true, message: "You're already checked in today. See you tomorrow! 💪" });
      } else {
        setResult({ ok: true, message: 'Attendance marked. Have a great workout! 💪' });
      }
    } catch {
      setResult({ ok: false, message: 'Network error. Try again.' });
    } finally {
      setSubmitting(false);
    }
  }

  async function logout() {
    await fetch('/api/member/logout', { method: 'POST' });
    localStorage.removeItem('gm_member_token');
    router.replace('/login');
  }

  if (loading) {
    return <div className="center-screen"><span className="spinner" /></div>;
  }

  const within = geo.kind === 'ready' && geo.within;

  return (
    <div className="center-screen">
      <div className="card" style={{ width: '100%', maxWidth: 420 }}>
        <div className="row between">
          <div className="logo">Fitness<span>Maniac</span></div>
          <button className="ghost" style={{ padding: '6px 12px' }} onClick={logout}>Logout</button>
        </div>

        <h1 style={{ marginTop: 14 }}>Hi {member?.name?.split(' ')[0]} 👋</h1>
        {member && (
          <p className="muted small">
            Membership <span className={`badge ${member.status}`}>{member.status}</span>
            {member.status !== 'expired'
              ? ` · ${member.days_until_end} day${member.days_until_end === 1 ? '' : 's'} left`
              : ' · please renew'}
          </p>
        )}

        {member?.status === 'expired' && (
          <div className="alert error" style={{ marginTop: 16 }}>
            Your membership has expired. Please renew at the front desk.
          </div>
        )}

        {member?.status !== 'expired' && (
          <div style={{ marginTop: 20 }}>
            {geo.kind === 'locating' && (
              <div className="alert warn"><span className="spinner" /> Getting your location…</div>
            )}
            {geo.kind === 'error' && <div className="alert error">{geo.message}</div>}

            {geo.kind === 'ready' && (
              <>
                <div className={`alert ${within ? 'ok' : 'error'}`}>
                  {within
                    ? `✓ You're at ${gym?.name}. Distance ~${Math.round(geo.distanceM)}m.`
                    : `You're not at the gym. You're ~${Math.round(geo.distanceM)}m away (must be within ${gym?.radius_m}m).`}
                </div>
                <p className="muted small">Location accuracy ~{Math.round(geo.accuracy)}m.</p>
              </>
            )}

            {result && (
              <div className={`alert ${result.ok ? 'ok' : 'error'}`}>{result.message}</div>
            )}

            <div style={{ marginTop: 16 }} className="stack">
              <button
                className="big-btn"
                disabled={!within || submitting || (result?.ok ?? false)}
                onClick={markAttendance}
              >
                {submitting ? <span className="spinner" /> : 'Mark Attendance'}
              </button>
              <button className="ghost block" onClick={locate} disabled={geo.kind === 'locating'}>
                Refresh location
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
