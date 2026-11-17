import test from 'node:test';
import assert from 'node:assert/strict';
import { CATALOG_ITEMS } from '../data/catalog';
import {
  computeFavoriteGenres,
  DEFAULT_RECOMMENDATION_WEIGHTS,
  generateRecommendations,
} from './recommendationEngine';
import type { FavoriteItem, UserRating } from '../types/media';

function makeFavorite(mediaId: string): FavoriteItem {
  const media = CATALOG_ITEMS.find((item) => item.id === mediaId);
  if (!media) throw new Error(`Missing catalog item ${mediaId}`);
  return {
    id: `fav-${mediaId}`,
    userId: 'user-test',
    tmdbId: media.tmdbId,
    mediaType: media.mediaType,
    mediaId: media.id,
    title: media.title,
    posterUrl: media.posterUrl,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeRating(mediaId: string, feedback: UserRating['feedback']): UserRating {
  const media = CATALOG_ITEMS.find((item) => item.id === mediaId);
  if (!media) throw new Error(`Missing catalog item ${mediaId}`);
  return {
    id: `rate-${mediaId}`,
    userId: 'user-test',
    tmdbId: media.tmdbId,
    mediaType: media.mediaType,
    mediaId: media.id,
    feedback,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

test('default weights sum strictly to 1.0', () => {
  const sum =
    DEFAULT_RECOMMENDATION_WEIGHTS.genre +
    DEFAULT_RECOMMENDATION_WEIGHTS.keywords +
    DEFAULT_RECOMMENDATION_WEIGHTS.crewCast +
    DEFAULT_RECOMMENDATION_WEIGHTS.story +
    DEFAULT_RECOMMENDATION_WEIGHTS.popularity;
  assert.ok(Math.abs(sum - 1.0) < 1e-9);
});

test('recommendations exclude saved favorites, watched titles, and disliked titles', () => {
  const favorites = [makeFavorite('movie-157336')]; // Interstellar
  const ratings = [
    makeRating('movie-329865', 'watched'), // Arrival
    makeRating('movie-335984', 'dislike'), // Blade Runner 2049
  ];

  const results = generateRecommendations({
    catalog: CATALOG_ITEMS,
    favorites,
    ratings,
    limit: 10,
  });

  const resultIds = new Set(results.map((r) => r.media.id));
  assert.equal(resultIds.has('movie-157336'), false);
  assert.equal(resultIds.has('movie-329865'), false);
  assert.equal(resultIds.has('movie-335984'), false);
  assert.ok(results.length > 0);
});

test('sci-fi favorites prioritize related sci-fi/Nolan/Villeneuve titles with grounded reasons', () => {
  const favorites = [makeFavorite('movie-157336'), makeFavorite('movie-329865')];
  const results = generateRecommendations({
    catalog: CATALOG_ITEMS,
    favorites,
    limit: 6,
  });

  assert.ok(results.length >= 4);
  const topThreeIds = results.slice(0, 3).map((r) => r.media.id);
  const hasRelevantMatch =
    topThreeIds.includes('movie-693134') ||
    topThreeIds.includes('movie-27205') ||
    topThreeIds.includes('movie-335984');
  assert.equal(hasRelevantMatch, true);
  for (const rec of results) {
    assert.ok(rec.reason.length > 10);
    assert.ok(rec.score >= 12 && rec.score <= 99);
  }
});

test('mediaTypeFilter restricts output strictly to movies or tv series', () => {
  const favorites = [makeFavorite('movie-157336'), makeFavorite('tv-70523')];
  const tvOnly = generateRecommendations({
    catalog: CATALOG_ITEMS,
    favorites,
    mediaTypeFilter: 'tv',
    limit: 6,
  });
  const moviesOnly = generateRecommendations({
    catalog: CATALOG_ITEMS,
    favorites,
    mediaTypeFilter: 'movie',
    limit: 6,
  });

  assert.ok(tvOnly.length > 0);
  assert.ok(moviesOnly.length > 0);
  assert.equal(
    tvOnly.every((r) => r.media.mediaType === 'tv'),
    true
  );
  assert.equal(
    moviesOnly.every((r) => r.media.mediaType === 'movie'),
    true
  );
});

test('computeFavoriteGenres aggregates genres accurately', () => {
  const favorites = [makeFavorite('movie-157336'), makeFavorite('tv-70523')];
  const stats = computeFavoriteGenres(favorites, CATALOG_ITEMS);
  const sciFi = stats.find((s) => s.genre === 'Science-Fiction');
  const drama = stats.find((s) => s.genre === 'Drama');

  assert.equal(sciFi?.count, 2);
  assert.equal(drama?.count, 2);
});

test('unknown creator placeholders do not produce fake director matches', () => {
  const seedItem = {
    ...CATALOG_ITEMS[0],
    id: 'movie-999001',
    tmdbId: 999001,
    title: 'Seed Unbekannt',
    directorOrCreator: 'Regie unbekannt',
    cast: [],
    keywords: ['zeitreise'],
  };
  const candidateItem = {
    ...CATALOG_ITEMS[1],
    id: 'movie-999002',
    tmdbId: 999002,
    title: 'Kandidat Unbekannt',
    directorOrCreator: 'Regie unbekannt',
    cast: [],
    keywords: ['ermittlung'],
  };

  const results = generateRecommendations({
    catalog: [seedItem, candidateItem],
    favorites: [
      {
        id: 'fav-999001',
        userId: 'user-test',
        tmdbId: 999001,
        mediaType: 'movie',
        mediaId: 'movie-999001',
        title: seedItem.title,
        createdAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    limit: 5,
  });

  assert.equal(results.length, 1);
  assert.equal(results[0].breakdown.crewCastScore, 0);
  assert.equal(results[0].reason.includes('Regie unbekannt'), false);
});
