'use client';

export interface DayPoint {
  date: string; // YYYY-MM-DD
  members: number;
  coaches: number;
}

const W = 700;
const H = 220;
const PAD = { top: 14, right: 8, bottom: 30, left: 30 };

function shortLabel(date: string) {
  const d = new Date(date + 'T00:00:00Z');
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

/** Stacked bar chart: members (blue) + coach visits (amber) per day. */
export default function VisitsChart({ days }: { days: DayPoint[] }) {
  if (days.length === 0) return null;

  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const max = Math.max(...days.map((d) => d.members + d.coaches), 1);
  const slot = plotW / days.length;
  const barW = Math.max(2, Math.min(34, slot * 0.7));
  const labelEvery = Math.max(1, Math.ceil(days.length / 8));

  // y-axis ticks: 0, mid, max
  const ticks = max <= 2 ? [0, max] : [0, Math.round(max / 2), max];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto', display: 'block' }} role="img" aria-label="Daily visits chart">
      {ticks.map((t) => {
        const y = PAD.top + plotH - (t / max) * plotH;
        return (
          <g key={t}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="var(--border)" strokeDasharray="3 4" />
            <text x={PAD.left - 6} y={y + 3} textAnchor="end" fontSize="10" fill="var(--muted)">{t}</text>
          </g>
        );
      })}

      {days.map((d, i) => {
        const x = PAD.left + i * slot + (slot - barW) / 2;
        const mH = (d.members / max) * plotH;
        const cH = (d.coaches / max) * plotH;
        const yM = PAD.top + plotH - mH;
        const yC = yM - cH;
        const total = d.members + d.coaches;
        return (
          <g key={d.date}>
            <title>{`${d.date}: ${d.members} member${d.members === 1 ? '' : 's'}${d.coaches ? `, ${d.coaches} coach visit${d.coaches === 1 ? '' : 's'}` : ''}`}</title>
            {/* hover target for empty days */}
            <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={plotH} fill="transparent" />
            {d.members > 0 && <rect x={x} y={yM} width={barW} height={mH} rx="2" fill="var(--primary)" />}
            {d.coaches > 0 && <rect x={x} y={yC} width={barW} height={cH} rx="2" fill="var(--amber)" />}
            {total > 0 && days.length <= 21 && (
              <text x={x + barW / 2} y={yC - 4} textAnchor="middle" fontSize="10" fill="var(--muted)">{total}</text>
            )}
            {i % labelEvery === 0 && (
              <text x={PAD.left + i * slot + slot / 2} y={H - 10} textAnchor="middle" fontSize="10" fill="var(--muted)">
                {shortLabel(d.date)}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
