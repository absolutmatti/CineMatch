import { CATALOG_ITEMS } from '../data/catalog';
import type { MediaItem, MediaType } from '../types/media';

export interface SearchMediaParams {
  query?: string;
  mediaType?: 'all' | MediaType;
  genre?: string;
}

/**
 * Frontend media query service backed by the curated realistic catalog for Phase 1.
 * Phase 2 will route these queries through the secure server-side TMDB proxy (/api/tmdb/*).
 */
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
 * Helper for Phase 2 TMDB integration to resolve poster/backdrop image URLs cleanly.
 */
export function buildTmdbImageUrl(
  path: string | null | undefined,
  size: 'w342' | 'w500' | 'w780' | 'w1280' = 'w500'
): string | undefined {
  if (!path) return undefined;
  if (path.startsWith('/') && path.startsWith('/src/')) return path;
  if (path.startsWith('http://') || path.startsWith('https://')) return path;
  return `https://image.tmdb.org/t/p/${size}${path}`;
}
