import Link from 'next/link';

export default function Home() {
  return (
    <div className="container narrow">
      <div className="topbar">
        <div className="logo">Fitness<span>Maniac</span></div>
      </div>

      <div className="card">
        <h1>Welcome 💪</h1>
        <p className="muted">Gym attendance & check-in.</p>
        <div className="stack" style={{ marginTop: 20 }}>
          <Link href="/checkin"><button className="block">Member check-in</button></Link>
          <Link href="/login"><button className="ghost block">Member login</button></Link>
          <Link href="/admin/login"><button className="ghost block">Admin</button></Link>
        </div>
      </div>
    </div>
  );
}
