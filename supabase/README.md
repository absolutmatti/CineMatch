# CineMatch — Supabase & Deployment Setup

## 1. Supabase Datenbank einrichten

1. Öffnen Sie Ihr Supabase-Projekt und navigieren Sie zum **SQL Editor**.
2. Führen Sie das Migrationsskript `supabase/migrations/001_initial_schema.sql` vollständig aus.
3. Prüfen Sie unter **Authentication → Providers**, dass **Email** aktiviert ist.
4. Tragen Sie folgende Umgebungsvariablen in Ihrer lokalen `.env` bzw. den Hosting-Secrets ein:
   - `VITE_SUPABASE_URL` (Project URL aus Supabase Settings → API)
   - `VITE_SUPABASE_ANON_KEY` (Publishable / Anon Key)
   - `SUPABASE_SERVICE_ROLE_KEY` (nur serverseitig, für `/api/account/delete`)
   - `TMDB_API_KEY` (nur serverseitig, für `/api/tmdb/*`)

## 2. GitHub Pages Deployment

Da GitHub Pages ausschließlich statische Frontend-Dateien ausliefert, darf der geheime `TMDB_API_KEY` niemals in das Frontend-Bundle gelangen:

1. Deployen Sie `server.ts` auf einem Node.js-Host (z. B. Cloud Run, Render, Fly.io) mit gesetzter `TMDB_API_KEY`-Variable.
2. Setzen Sie in den GitHub Repository Variables / Secrets:
   - `VITE_API_BASE_URL` = URL Ihres Backend-Servers
   - `VITE_SUPABASE_URL` = Ihre Supabase Project URL
   - `VITE_SUPABASE_ANON_KEY` = Ihr Supabase Publishable Key
3. Der Workflow `.github/workflows/deploy-pages.yml` baut die Anwendung automatisch mit dem korrekten Repository-`VITE_BASE_PATH` und veröffentlicht `dist/` auf GitHub Pages.
