# Supabase Migration Guide (Spark KV -> Supabase)

## 1) Create Supabase resources

1. Create a new Supabase project.
2. Open SQL Editor in Supabase.
3. Run scripts in this order:
   - `supabase/001_create_app_kv.sql`
   - `supabase/002_seed_defaults.sql` (optional)
   - `supabase/003_import_kv_json.sql` (optional, after replacing JSON payload)

## 2) Configure environment variables

Create a `.env.local` file in project root:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

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
