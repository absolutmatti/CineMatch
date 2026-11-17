# CineMatch — GitHub Pages & Backend Deployment

CineMatch besteht aus zwei Teilen:
1. **Statisches Frontend (`dist/`)** → wird über GitHub Actions automatisch auf **GitHub Pages** veröffentlicht.
2. **Express-Backend (`server.ts`)** → schützt `TMDB_API_KEY` und `SUPABASE_SECRET_KEY` serverseitig und liefert die Endpunkte `/api/tmdb/*`, `/api/account/delete`, `/api/public-config` und `/api/health`.

> Wichtig: Geheime Schlüssel (`TMDB_API_KEY`, `SUPABASE_SECRET_KEY`) dürfen **niemals** mit `VITE_`-Präfix oder in GitHub-Pages-Builds landen.

---

## Schritt 1: Backend (`server.ts`) deployen

Das Repository enthält bereits sowohl ein `Dockerfile` (für **Google Cloud Run**, **Fly.io**, **Railway**) als auch eine `render.yaml` (für **Render**).

### Option A: Render (kostenloser Einstieg über `render.yaml`)
1. Lade dieses Projekt in dein GitHub-Repository hoch.
2. Erstelle auf [render.com](https://render.com) einen neuen **Web Service** (oder **Blueprint**) mit deinem Repository.
3. Hinterlege im Bereich **Environment** folgende Variablen:
   - `NODE_ENV` = `production`
   - `TMDB_API_KEY` = dein TMDB API-Key
   - `SUPABASE_URL` = deine Supabase Project URL (`https://<projekt-id>.supabase.co`)
   - `SUPABASE_SECRET_KEY` = dein Supabase Secret Key (`sb_secret_...`)
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = dein Supabase Publishable Key (`sb_publishable_...`)
   - `CORS_ORIGIN` = deine GitHub-Pages-Origin, z. B. `https://<dein-github-name>.github.io`
4. Nach dem Deploy prüfe im Browser `<deine-backend-url>/api/health` – die Antwort sollte `{"ok":true,"tmdbConfigured":true,"supabaseConfigured":true}` liefern.

### Option B: Google Cloud Run / Docker
1. Baue das Container-Image mit dem beiliegenden `Dockerfile`:
   - Startbefehl ist `npm start` (`node server.ts` auf Node 22).
2. Setze dieselben Umgebungsvariablen wie oben (`TMDB_API_KEY`, `SUPABASE_URL`, `SUPABASE_SECRET_KEY`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `CORS_ORIGIN`).

---

## Schritt 2: GitHub Repository & GitHub Pages einrichten

1. Öffne dein GitHub-Repository → **Settings → Pages**:
   - Wähle unter **Build and deployment → Source**: **GitHub Actions**.
2. Öffne **Settings → Secrets and variables → Actions → Tab „Variables“** und lege diese drei **Repository Variables** an:
   - `VITE_API_BASE_URL` = URL deines gehosteten Backends aus Schritt 1 (ohne abschließenden Schrägstrich, z. B. `https://cinematch-api.onrender.com`)
   - `VITE_SUPABASE_URL` = deine Supabase Project URL (`https://<projekt-id>.supabase.co`)
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = dein Supabase Publishable Key (`sb_publishable_...`)
   - *(Optional, nur bei eigener Custom Domain direkt im Root):* `VITE_BASE_PATH` = `/`
3. Pushe auf den Branch `main` (oder starte den Workflow unter **Actions → Deploy CineMatch to GitHub Pages → Run workflow**).
4. Der Workflow baut automatisch `dist/` mit dem korrekten Unterpfad (`/<repo-name>/`), erzeugt `404.html` für SPA-Pfade und veröffentlicht das Frontend auf GitHub Pages.

---

## Schritt 3: Supabase Redirect URLs anpassen

Damit E-Mail-Bestätigungen und *„Passwort vergessen?“*-Links sauber zu deiner GitHub-Pages-Seite zurückführen:

1. Öffne im **Supabase Dashboard → Authentication → URL Configuration**.
2. Trage unter **Redirect URLs** (und bei Bedarf als **Site URL**) deine GitHub-Pages-URL ein:
   - `https://<dein-github-name>.github.io/<dein-repo-name>/**`
   - *(Optional zusätzlich für lokale/Preview-Tests: deine AI-Studio-App-URL bzw. `http://localhost:3000/**`)*
