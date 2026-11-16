import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import { createClient } from '@supabase/supabase-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const CACHE_TTL_MS = 10 * 60 * 1000;

interface CacheEntry {
  expiresAt: number;
  data: unknown;
}

const tmdbCache = new Map<string, CacheEntry>();

const TMDB_GENRE_MAP: Record<number, string> = {
  28: 'Action',
  12: 'Abenteuer',
  16: 'Animation',
  35: 'Komödie',
  80: 'Krimi',
  99: 'Dokumentation',
  18: 'Drama',
  10751: 'Familie',
  14: 'Fantasy',
  36: 'Historie',
  27: 'Horror',
  10402: 'Musik',
  9648: 'Mystery',
  10749: 'Romantik',
  878: 'Science-Fiction',
  10770: 'TV-Film',
  53: 'Thriller',
  10752: 'Kriegsfilm',
  37: 'Western',
  10759: 'Action & Abenteuer',
  10762: 'Kinder',
  10763: 'Nachrichten',
  10764: 'Reality',
  10765: 'Science-Fiction & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'Politik & Krieg',
};

interface NormalizedPosterTheme {
  gradientFrom: string;
  gradientTo: string;
  accentLine: string;
  motif: 'orbit' | 'monolith' | 'grid' | 'horizon' | 'frame';
}

interface NormalizedMediaItem {
  id: string;
  tmdbId: number;
  mediaType: 'movie' | 'tv';
  title: string;
  originalTitle?: string;
  releaseDate: string;
  overview: string;
  genres: string[];
  keywords: string[];
  storyCharacteristics: string[];
  directorOrCreator: string;
  cast: string[];
  runtimeMinutes?: number;
  seasonsCount?: number;
  episodesCount?: number;
  voteAverage: number;
  popularity: number;
  posterUrl?: string;
  backdropUrl?: string;
  posterTheme: NormalizedPosterTheme;
}

function buildPosterTheme(genres: string[]): NormalizedPosterTheme {
  if (genres.includes('Science-Fiction') || genres.includes('Science-Fiction & Fantasy')) {
    return {
      gradientFrom: '#1C1B29',
      gradientTo: '#101016',
      accentLine: '#9275E8',
      motif: 'orbit',
    };
  }
  if (genres.includes('Mystery') || genres.includes('Thriller') || genres.includes('Krimi')) {
    return {
      gradientFrom: '#1A2026',
      gradientTo: '#0F1015',
      accentLine: '#B29AF5',
      motif: 'monolith',
    };
  }
  return {
    gradientFrom: '#21202D',
    gradientTo: '#111117',
    accentLine: '#9275E8',
    motif: 'frame',
  };
}

function normalizeGenres(raw: Record<string, unknown>): string[] {
  if (Array.isArray(raw.genres)) {
    return raw.genres
      .map((g) => (typeof g === 'object' && g && 'name' in g ? String((g as { name: string }).name) : ''))
      .filter(Boolean);
  }
  if (Array.isArray(raw.genre_ids)) {
    return raw.genre_ids
      .map((id) => TMDB_GENRE_MAP[Number(id)] || '')
      .filter(Boolean);
  }
  return [];
}

function normalizeTmdbItem(
  raw: Record<string, unknown>,
  explicitType?: 'movie' | 'tv'
): NormalizedMediaItem | null {
  const mediaType =
    explicitType ??
    (raw.media_type === 'movie' || raw.media_type === 'tv' ? raw.media_type : null);
  if (!mediaType) return null;

  const tmdbId = Number(raw.id);
  if (!Number.isFinite(tmdbId)) return null;

  const title =
    mediaType === 'movie'
      ? String(raw.title || raw.original_title || 'Unbekannter Titel')
      : String(raw.name || raw.original_name || 'Unbekannte Serie');

  const originalTitle =
    mediaType === 'movie'
      ? raw.original_title
        ? String(raw.original_title)
        : undefined
      : raw.original_name
        ? String(raw.original_name)
        : undefined;

  const releaseDate =
    mediaType === 'movie'
      ? String(raw.release_date || '')
      : String(raw.first_air_date || '');

  const genres = normalizeGenres(raw);
  const posterPath = typeof raw.poster_path === 'string' ? raw.poster_path : null;
  const backdropPath = typeof raw.backdrop_path === 'string' ? raw.backdrop_path : null;

  // Extract crew & cast if detail payload is attached
  let directorOrCreator = mediaType === 'movie' ? 'Regie unbekannt' : 'Creator unbekannt';
  let cast: string[] = [];

  if (mediaType === 'tv' && Array.isArray(raw.created_by) && raw.created_by.length > 0) {
    directorOrCreator = raw.created_by
      .slice(0, 2)
      .map((c) => String((c as { name?: string }).name || ''))
      .filter(Boolean)
      .join(' & ');
  }

  const credits = raw.credits as
    | { crew?: Array<{ job?: string; name?: string }>; cast?: Array<{ name?: string }> }
    | undefined;
  if (credits) {
    if (mediaType === 'movie' && Array.isArray(credits.crew)) {
      const director = credits.crew.find((member) => member.job === 'Director');
      if (director?.name) {
        directorOrCreator = director.name;
      }
    }
    if (Array.isArray(credits.cast)) {
      cast = credits.cast
        .slice(0, 6)
        .map((actor) => String(actor.name || ''))
        .filter(Boolean);
    }
  }

  const keywordsContainer = raw.keywords as
    | { keywords?: Array<{ name?: string }>; results?: Array<{ name?: string }> }
    | undefined;
  const rawKeywords = keywordsContainer?.keywords || keywordsContainer?.results || [];
  const keywords = rawKeywords
    .slice(0, 10)
    .map((kw) => String(kw.name || '').toLowerCase())
    .filter(Boolean);

  const voteAverage = Number(raw.vote_average || 0);
  const rawPop = Number(raw.popularity || 0);
  const normalizedPop = Math.min(100, Math.max(10, Math.round(Math.log10(Math.max(1, rawPop) + 1) * 35)));

  return {
    id: `${mediaType}-${tmdbId}`,
    tmdbId,
    mediaType,
    title,
    originalTitle,
    releaseDate,
    overview: String(raw.overview || 'Für diesen Titel liegt aktuell keine deutsche Beschreibung vor.'),
    genres: genres.length > 0 ? genres : ['Drama'],
    keywords,
    storyCharacteristics: genres.slice(0, 2).map((g) => g.toLowerCase()),
    directorOrCreator,
    cast,
    runtimeMinutes: typeof raw.runtime === 'number' && raw.runtime > 0 ? raw.runtime : undefined,
    seasonsCount:
      typeof raw.number_of_seasons === 'number' && raw.number_of_seasons > 0
        ? raw.number_of_seasons
        : undefined,
    episodesCount:
      typeof raw.number_of_episodes === 'number' && raw.number_of_episodes > 0
        ? raw.number_of_episodes
        : undefined,
    voteAverage: Math.round(voteAverage * 10) / 10,
    popularity: normalizedPop,
    posterUrl: posterPath ? `https://image.tmdb.org/t/p/w500${posterPath}` : undefined,
    backdropUrl: backdropPath ? `https://image.tmdb.org/t/p/w1280${backdropPath}` : undefined,
    posterTheme: buildPosterTheme(genres),
  };
}

async function fetchTmdbJson<T>(endpoint: string, params: Record<string, string> = {}): Promise<T> {
  const apiKey = process.env.TMDB_API_KEY;
  if (!apiKey) {
    throw new Error('TMDB_API_KEY_MISSING');
  }

  const url = new URL(`${TMDB_BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', apiKey);
  url.searchParams.set('language', 'de-DE');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  const cacheKey = `${endpoint}?${new URLSearchParams(params).toString()}`;
  const cached = tmdbCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data as T;
  }

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(7000),
  });

  if (!response.ok) {
    throw new Error(`TMDB_HTTP_${response.status}`);
  }

  const data = (await response.json()) as T;
  tmdbCache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    data,
  });

  return data;
}

async function startServer() {
  const app = express();
  app.use(express.json());

  // Basic CORS header for optional GitHub Pages frontend deployments
  app.use((req, res, next) => {
    const allowedOrigin = process.env.CORS_ORIGIN || '*';
    res.header('Access-Control-Allow-Origin', allowedOrigin);
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Health & capability status (never exposes raw secrets)
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      ok: true,
      tmdbConfigured: Boolean(process.env.TMDB_API_KEY),
      supabaseConfigured: Boolean(
        process.env.VITE_SUPABASE_URL && process.env.VITE_SUPABASE_ANON_KEY
      ),
    });
  });

  // Secure Server-Side TMDB Search
  app.get('/api/tmdb/search', async (req: Request, res: Response) => {
    const query = String(req.query.query || '').trim();
    const type = String(req.query.type || 'all');
    const page = String(req.query.page || '1');

    if (!process.env.TMDB_API_KEY) {
      res.json({ items: [], fallback: true, configured: false });
      return;
    }

    if (!query) {
      res.json({ items: [], source: 'tmdb' });
      return;
    }

    try {
      const endpoint =
        type === 'movie'
          ? '/search/movie'
          : type === 'tv'
            ? '/search/tv'
            : '/search/multi';

      const payload = await fetchTmdbJson<{ results?: Array<Record<string, unknown>> }>(endpoint, {
        query,
        page,
        include_adult: 'false',
      });

      const explicitType = type === 'movie' || type === 'tv' ? type : undefined;
      const items = (payload.results || [])
        .map((row) => normalizeTmdbItem(row, explicitType))
        .filter((item): item is NormalizedMediaItem => Boolean(item));

      res.json({ items, source: 'tmdb' });
    } catch {
      res.status(503).json({
        items: [],
        fallback: true,
        message: 'TMDB-Suche vorübergehend nicht verfügbar.',
      });
    }
  });

  // Secure Server-Side TMDB Trending
  app.get('/api/tmdb/trending', async (req: Request, res: Response) => {
    if (!process.env.TMDB_API_KEY) {
      res.json({ items: [], fallback: true, configured: false });
      return;
    }

    const type = String(req.query.type || 'all');
    const validType = type === 'movie' || type === 'tv' ? type : 'all';

    try {
      const payload = await fetchTmdbJson<{ results?: Array<Record<string, unknown>> }>(
        `/trending/${validType}/week`
      );
      const explicitType = validType === 'movie' || validType === 'tv' ? validType : undefined;
      const items = (payload.results || [])
        .map((row) => normalizeTmdbItem(row, explicitType))
        .filter((item): item is NormalizedMediaItem => Boolean(item));

      res.json({ items, source: 'tmdb' });
    } catch {
      res.status(503).json({
        items: [],
        fallback: true,
        message: 'TMDB-Trends vorübergehend nicht verfügbar.',
      });
    }
  });

  // Secure Server-Side TMDB Details (with credits, keywords, and candidate recommendations)
  app.get('/api/tmdb/details/:mediaType/:tmdbId', async (req: Request, res: Response) => {
    const mediaType = req.params.mediaType === 'tv' ? 'tv' : req.params.mediaType === 'movie' ? 'movie' : null;
    const tmdbId = Number(req.params.tmdbId);

    if (!mediaType || !Number.isFinite(tmdbId)) {
      res.status(400).json({ message: 'Ungültige Medienparameter.' });
      return;
    }

    if (!process.env.TMDB_API_KEY) {
      res.json({ item: null, recommendations: [], fallback: true, configured: false });
      return;
    }

    try {
      const payload = await fetchTmdbJson<Record<string, unknown>>(`/${mediaType}/${tmdbId}`, {
        append_to_response: 'credits,keywords,recommendations',
      });

      const item = normalizeTmdbItem(payload, mediaType);
      const rawRecommendations =
        (payload.recommendations as { results?: Array<Record<string, unknown>> } | undefined)
          ?.results || [];

      const recommendations = rawRecommendations
        .slice(0, 8)
        .map((row) => normalizeTmdbItem(row, mediaType))
        .filter((rec): rec is NormalizedMediaItem => Boolean(rec));

      res.json({ item, recommendations, source: 'tmdb' });
    } catch {
      res.status(503).json({
        item: null,
        recommendations: [],
        fallback: true,
        message: 'TMDB-Details vorübergehend nicht verfügbar.',
      });
    }
  });

  // Authenticated account deletion via Supabase Service Role (never trusts frontend user_id)
  app.post('/api/account/delete', async (req: Request, res: Response) => {
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!supabaseUrl || !serviceRoleKey) {
      res.status(501).json({
        message: 'Serverseitige Supabase-Kontolöschung ist noch nicht konfiguriert.',
      });
      return;
    }

    if (!token) {
      res.status(401).json({ message: 'Authentifizierung erforderlich.' });
      return;
    }

    try {
      const adminClient = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const {
        data: { user },
        error: userError,
      } = await adminClient.auth.getUser(token);

      if (userError || !user) {
        res.status(401).json({ message: 'Ungültige oder abgelaufene Sitzung.' });
        return;
      }

      const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id);
      if (deleteError) {
        res.status(500).json({ message: 'Konto konnte nicht gelöscht werden.' });
        return;
      }

      res.json({ ok: true });
    } catch {
      res.status(500).json({ message: 'Interner Fehler bei der Kontolöschung.' });
    }
  });

  // Dev Vite middleware vs Production static dist serving
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req: Request, res: Response) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CineMatch server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
