# CineMatch — Supabase & Deployment Setup

## 1. Supabase Datenbank einrichten

1. Öffnen Sie Ihr Supabase-Projekt und navigieren Sie zum **SQL Editor**.
2. Führen Sie das Migrationsskript `supabase/migrations/001_initial_schema.sql` vollständig aus.
3. Prüfen Sie unter **Authentication → Providers**, dass **Email** aktiviert ist.
4. Erstellen/kopieren Sie unter **Settings → API Keys → Publishable and secret API keys** die modernen Schlüssel (Supabase stellt die alten `anon`- und `service_role`-JWTs Ende 2026 ein):
   - `VITE_SUPABASE_URL` (Project URL aus Supabase Settings → API)
   - `VITE_SUPABASE_PUBLISHABLE_KEY` (öffentlicher `sb_publishable_...`-Schlüssel für den Browser, durch RLS geschützt)
   - `SUPABASE_SECRET_KEY` (geheimer `sb_secret_...`-Schlüssel **nur serverseitig**, für `/api/account/delete` – niemals mit `VITE_` im Frontend verwenden)
   - `TMDB_API_KEY` (nur serverseitig, für `/api/tmdb/*`)

## 2. GitHub Pages Deployment

Da GitHub Pages ausschließlich statische Frontend-Dateien ausliefert, dürfen geheime Schlüssel (`TMDB_API_KEY`, `SUPABASE_SECRET_KEY`) niemals in das Frontend-Bundle gelangen:

1. Deployen Sie `server.ts` auf einem Node.js-Host (z. B. Cloud Run, Render, Fly.io) mit gesetzten Variablen `TMDB_API_KEY`, `SUPABASE_URL` und `SUPABASE_SECRET_KEY`.
2. Setzen Sie in den GitHub Repository Variables:
   - `VITE_API_BASE_URL` = URL Ihres Backend-Servers
   - `VITE_SUPABASE_URL` = Ihre Supabase Project URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = Ihr Supabase Publishable Key (`sb_publishable_...`)
3. Der Workflow `.github/workflows/deploy-pages.yml` baut die Anwendung automatisch mit dem korrekten Repository-`VITE_BASE_PATH` und veröffentlicht `dist/` auf GitHub Pages.
