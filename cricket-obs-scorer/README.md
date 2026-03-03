# Cricket OBS Scorer (React app)

This app is configured to connect directly to Supabase using `@supabase/supabase-js`.

## 1) Install dependencies

```bash
npm install
```

## 2) Configure Supabase environment

Copy `.env.example` to `.env` and set your project values:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

You can find these in Supabase under **Project Settings > API**.

## 3) Ensure DB schema is applied

Run `supabase/db-scripts/full-script.sql` in the SQL editor for your Supabase project.

## 4) Run the app

```bash
npm run dev
```

The current UI reads/writes the `teams` table to verify your Supabase connection.

## Notes on permissions

If Row Level Security is enabled, make sure your anon role has policies that allow the operations you need (currently `select` and `insert` on `teams`).
