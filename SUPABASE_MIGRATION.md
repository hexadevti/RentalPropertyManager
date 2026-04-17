# Supabase Migration Guide (Spark KV -> Supabase)

## 1) Create Supabase resources

1. Create a new Supabase project.
2. Open SQL Editor in Supabase.
3. Run scripts in this order:
   - `supabase/001_create_app_kv.sql`
   - `supabase/002_seed_defaults.sql` (optional)
   - `supabase/003_import_kv_json.sql` (optional, after replacing JSON payload)
4. In Supabase Dashboard, enable GitHub provider:
  - Authentication -> Providers -> GitHub -> Enable
  - Configure GitHub OAuth App with callback URL:
    - `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
5. In Supabase Dashboard, set allowed redirect URLs:
  - Authentication -> URL Configuration -> Redirect URLs
  - Add at least:
    - `http://localhost:5000`
    - `http://localhost:5000/`
    - `http://localhost:5001`
    - `http://localhost:5001/`
6. In Supabase Dashboard, set Site URL:
   - Authentication -> URL Configuration -> Site URL
   - Example (dev): `http://localhost:5001`

## 2) Configure environment variables

Create a `.env.local` file in project root:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
VITE_AUTH_REDIRECT_URL=http://localhost:5001/
```

If GitHub returns 404 after login, this is almost always a provider/callback mismatch:
- GitHub OAuth App callback must be exactly:
  - `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`
- Supabase Redirect URLs must include the exact frontend origin used by Vite (`5000` or `5001`).

## 3) Export old Spark KV data (optional)

If you still have access to Spark KV, run this in browser console once and copy the output JSON:

```javascript
const keys = await spark.kv.keys()
const payload = {}
for (const key of keys) {
  payload[key] = await spark.kv.get(key)
}
console.log(JSON.stringify(payload, null, 2))
```

Paste the JSON into `supabase/003_import_kv_json.sql` and run that script in Supabase.

## 4) Run app

Install dependencies and start the app:

```bash
npm install
npm run dev
```

The app now persists all `useKV` keys in Supabase table `public.app_kv`.

## Notes

- This migration keeps the existing KV-shaped data contract used by the app.
- Existing component logic using `useKV` does not need to be rewritten.
- Current policies allow `anon` and `authenticated` roles to read/write all keys; tighten RLS policies before production if needed.
- The app now uses Supabase Auth with explicit login via GitHub OAuth instead of `spark.user()`.
