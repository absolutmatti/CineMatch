import { CATALOG_ITEMS } from '../data/catalog';
import type { MediaItem, MediaType } from '../types/media';

export interface SearchMediaParams {
  query?: string;
  mediaType?: 'all' | MediaType;
  genre?: string;
  page?: number;
}

export interface TmdbSearchResponse {
  items: MediaItem[];
  source: 'tmdb' | 'catalog';
  page: number;
  hasMore: boolean;
}

export interface TmdbDetailsResponse {
  item: MediaItem | null;
  recommendations: MediaItem[];
  source: 'tmdb' | 'catalog';
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

const searchCache = new Map<string, TmdbSearchResponse>();
const detailsCache = new Map<string, TmdbDetailsResponse>();

export function searchCatalogMedia({
  query = '',
  mediaType = 'all',
  genre = 'Alle',
}: SearchMediaParams): MediaItem[] {
  const normalizedQuery = query.trim().toLowerCase();

  return CATALOG_ITEMS.filter((item) => {
    if (mediaType !== 'all' && item.mediaType !== mediaType) return false;
    if (genre !== 'Alle' && !item.genres.includes(genre)) return false;

    if (!normalizedQuery) return true;

    const haystack = [
      item.title,
      item.originalTitle ?? '',
      item.directorOrCreator,
      ...item.genres,
      ...item.keywords,
      ...item.cast,
    ]
      .join(' ')
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}

export function getMediaById(id: string): MediaItem | undefined {
  return CATALOG_ITEMS.find((item) => item.id === id);
}

/**
 * Fetches live TMDB search, genre discovery, or trending results via the secure server-side proxy (/api/tmdb/*).
 * Automatically falls back to the local curated catalog if TMDB is unavailable or unconfigured.
 */
export async function searchRemoteMedia(
  { query = '', mediaType = 'all', genre = 'Alle', page = 1 }: SearchMediaParams,
  signal?: AbortSignal
): Promise<TmdbSearchResponse> {
  const trimmed = query.trim();
  const safePage = Math.max(1, page);
  const cacheKey = `${mediaType}:${genre}:${safePage}:${trimmed.toLowerCase()}`;

  const cached = searchCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    let endpoint: string;
    if (trimmed) {
      endpoint = `${API_BASE}/api/tmdb/search?query=${encodeURIComponent(trimmed)}&type=${mediaType}&page=${safePage}`;
    } else if (genre && genre !== 'Alle') {
      endpoint = `${API_BASE}/api/tmdb/discover?type=${mediaType}&genre=${encodeURIComponent(genre)}&page=${safePage}`;
    } else {
      endpoint = `${API_BASE}/api/tmdb/trending?type=${mediaType}&page=${safePage}`;
    }

    const response = await fetch(endpoint, { signal });
    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }

    const data = (await response.json()) as {
      items?: MediaItem[];
      page?: number;
      hasMore?: boolean;
      fallback?: boolean;
    };
    if (data.fallback || !Array.isArray(data.items) || (safePage === 1 && data.items.length === 0)) {
      return {
        items: safePage === 1 ? searchCatalogMedia({ query: trimmed, mediaType, genre }) : [],
        source: 'catalog',
        page: safePage,
        hasMore: false,
      };
    }

    const filtered =
      trimmed && genre !== 'Alle'
        ? data.items.filter((item) => item.genres.includes(genre))
        : data.items;

    const result: TmdbSearchResponse = {
      items: filtered,
      source: 'tmdb',
      page: Number(data.page || safePage),
      hasMore: Boolean(data.hasMore),
    };
    searchCache.set(cacheKey, result);
    return result;
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      throw err;
    }
    return {
      items: safePage === 1 ? searchCatalogMedia({ query: trimmed, mediaType, genre }) : [],
      source: 'catalog',
      page: safePage,
      hasMore: false,
    };
  }
}

/**
 * Fetches full TMDB movie/TV details, credits, keywords, and candidate recommendations.
 */
export async function fetchMediaDetails(
  mediaType: MediaType,
  tmdbId: number,
  signal?: AbortSignal
): Promise<TmdbDetailsResponse> {
  const key = `${mediaType}-${tmdbId}`;
  const cached = detailsCache.get(key);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(`${API_BASE}/api/tmdb/details/${mediaType}/${tmdbId}`, {
      signal,
    });
    if (!response.ok) {
      throw new Error(`HTTP_${response.status}`);
    }

    const data = (await response.json()) as {
      item?: MediaItem | null;
      recommendations?: MediaItem[];
      fallback?: boolean;
    };

    if (data.fallback || !data.item) {
      return {
        item: getMediaById(key) ?? null,
        recommendations: [],
        source: 'catalog',
      };
    }

    const result: TmdbDetailsResponse = {
      item: data.item,
      recommendations: Array.isArray(data.recommendations) ? data.recommendations : [],
      source: 'tmdb',
    };
    detailsCache.set(key, result);
    return result;
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') {
      throw err;
    }
    return {
      item: getMediaById(key) ?? null,
      recommendations: [],
      source: 'catalog',
    };
  }
}

export async function checkBackendHealth(): Promise<{
  tmdbConfigured: boolean;
  supabaseConfigured: boolean;
}> {
  try {
    const res = await fetch(`${API_BASE}/api/health`);
    if (!res.ok) return { tmdbConfigured: false, supabaseConfigured: false };
    const data = (await res.json()) as {
      tmdbConfigured?: boolean;
      supabaseConfigured?: boolean;
    };
    return {
      tmdbConfigured: Boolean(data.tmdbConfigured),
      supabaseConfigured: Boolean(data.supabaseConfigured),
    };
  } catch {
    return { tmdbConfigured: false, supabaseConfigured: false };
  }
}

export function buildTmdbImageUrl(
  path: string | null | undefined,
  size: 'w342' | 'w500' | 'w780' | 'w1280' = 'w500'
): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('/src/') || path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
