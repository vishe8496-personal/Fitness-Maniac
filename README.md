# Fitness Maniac — Gym Attendance

A PWA-installable gym attendance app: admin member management, one-time OTP member login, and GPS-geofenced check-in.

**Stack:** Next.js 14 (App Router) · Supabase (Postgres) · bcrypt + JWT sessions · Twilio/MSG91 OTP · Vercel.

---

## 1. Setup

### Prerequisites
- Node 18+ and a Supabase project.

### Install
```bash
npm install
cp .env.local.example .env.local   # then fill in the values
```

### Database
1. Open the Supabase **SQL editor** and run [`supabase/schema.sql`](supabase/schema.sql).
2. Edit the seeded `gym_config` row with your gym's real coordinates:
   ```sql
   update gym_config set lat = 19.0760, lng = 72.8777, radius_m = 150 where id = 1;
   ```
3. Create your first admin:
   ```bash
   node scripts/hash-password.mjs "your-strong-password"   # prints a bcrypt hash
   ```
   ```sql
   insert into admins (username, password_hash) values ('admin', '<paste-hash>');
   ```

### Environment variables (`.env.local`)
| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-only; bypasses RLS) |
| `ADMIN_JWT_SECRET` / `MEMBER_JWT_SECRET` / `OTP_HASH_SECRET` | Long random strings (`node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`) |
| `OTP_PROVIDER` | `mock` (dev — logs OTP to console), `msg91`, or `twilio` |
| `MSG91_*` / `TWILIO_*` | Credentials for the chosen provider |
| `DEFAULT_COUNTRY_CODE` | e.g. `91` — prepended to bare local mobile numbers |

### Run
```bash
npm run dev      # http://localhost:3000
```
In `mock` OTP mode the code is printed to the **server terminal** — no SMS needed for local testing.

---

## 2. Flows

| Route | Who | What |
|---|---|---|
| `/admin/login` | Admin | Password login (bcrypt, 12h session cookie) |
| `/admin/register` | Admin | Register member — end date auto-calculated (same day-of-month + N months, clamped to the last valid day of shorter months) |
| `/admin/dashboard` | Admin | Member list + search/filter, today's attendance %, expiring-in-7-days highlight, per-member attendance history, manual add/remove attendance |
| `/login` | Member | One-time OTP login → 180-day session (httpOnly cookie + localStorage backup) |
| `/checkin` | Member | Auto-logged-in; GPS + Haversine geofence. "Mark Attendance" enabled only within radius; server re-validates on submit |

---

## 3. Geofencing

The check-in page computes distance client-side for instant UX, but **the server independently recomputes the Haversine distance against `gym_config` on every check-in** — a spoofed client cannot mark attendance from outside the radius. Duplicate check-ins on the same day are collapsed into one.

---

## 4. PWA / install

`public/manifest.json` + `public/sw.js` (registered in `layout.tsx`) make the app installable to the home screen on Android and iOS. Icons live in `public/icons/` (regenerate with `node scripts/generate-icons.mjs`). The service worker caches the app shell; API calls are never cached.

---

## 5. Deploy to Vercel

1. Push to GitHub, import the repo in Vercel.
2. Add every `.env.local` variable in **Project → Settings → Environment Variables**.
3. Deploy. Set `OTP_PROVIDER=msg91` (or `twilio`) in production.

---

## Notes
- **Security:** all data access goes through server API routes using the service-role key; RLS is enabled so the public anon key can't touch the tables directly. Admin pages are gated by middleware; member/admin API routes verify their own JWTs.
- **Dependency audit:** pinned to Next `14.2.35` (patched). Two transitive advisories (postcss / a Next internal) remain and only clear by upgrading to Next 16 — deferred as a separate migration.
- **Testing OTP end-to-end** requires a registered member (register them via the admin flow first).
```
Build order implemented: DB schema → admin auth + register → OTP login + session → check-in geofencing → admin dashboard.
```
