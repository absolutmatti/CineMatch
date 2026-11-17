import test from 'node:test';
import assert from 'node:assert/strict';
import type { FavoriteItem, MediaItem, UserRating } from '../types/media';
import { computeSharedGenres, generateGroupRecommendations } from './groupMatchEngine';

function makeMedia(
  id: string,
  tmdbId: number,
  mediaType: 'movie' | 'tv',
  title: string,
  genres: string[],
  keywords: string[],
  directorOrCreator: string,
  popularity = 80
): MediaItem {
  return {
    id,
    tmdbId,
    mediaType,
    title,
    releaseDate: '2020-01-01',
    overview: `${title} Beschreibung`,
    genres,
    keywords,
    storyCharacteristics: ['atmosphärisch', 'vielschichtig'],
    directorOrCreator,
    cast: ['Schauspieler A'],
    voteAverage: 8.1,
    popularity,
    posterTheme: {
      gradientFrom: '#1C1B29',
      gradientTo: '#101016',
      accentLine: '#9275E8',
      motif: 'orbit',
    },
  };
}

function makeFavorite(userId: string, item: MediaItem): FavoriteItem {
  return {
    id: `fav-${userId}-${item.id}`,
    userId,
    tmdbId: item.tmdbId,
    mediaType: item.mediaType,
    mediaId: item.id,
    title: item.title,
    mediaSnapshot: item,
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

function makeRating(userId: string, item: MediaItem, feedback: 'like' | 'dislike' | 'watched'): UserRating {
  return {
    id: `rat-${userId}-${item.id}`,
    userId,
    tmdbId: item.tmdbId,
    mediaType: item.mediaType,
    mediaId: item.id,
    feedback,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

test('balanced group recommendations prefer mutual matches over one-sided titles', () => {
  const seedA = makeMedia(
    'movie-1',
    1,
    'movie',
    'Seed Sci-Fi',
    ['Science-Fiction', 'Drama'],
    ['weltraum', 'zeit'],
    'Denis Villeneuve'
  );
  const seedB = makeMedia(
    'movie-2',
    2,
    'movie',
    'Seed Crime',
    ['Krimi', 'Drama'],
    ['ermittlung', 'spannung'],
    'David Fincher'
  );
  const mutualBridge = makeMedia(
    'movie-3',
    3,
    'movie',
    'Sci-Fi Crime Bridge',
    ['Science-Fiction', 'Krimi', 'Drama'],
    ['zeit', 'ermittlung'],
    'Regisseur X',
    85
  );
  const oneSided = makeMedia(
    'movie-4',
    4,
    'movie',
    'Pure Space Opera',
    ['Science-Fiction'],
    ['weltraum', 'zeit'],
    'Denis Villeneuve',
    90
  );

  const catalog = [seedA, seedB, mutualBridge, oneSided];
  const result = generateGroupRecommendations({
    catalog,
    userA: {
      id: 'user-a',
      displayName: 'Jonas',
      favorites: [makeFavorite('user-a', seedA)],
      ratings: [],
    },
    userB: {
      id: 'user-b',
      displayName: 'Lena',
      favorites: [makeFavorite('user-b', seedB)],
      ratings: [],
    },
  });

  assert.equal(result.recommendations[0]?.media.id, 'movie-3');
  assert.ok(result.recommendations[0].balanceScore > result.recommendations[1].balanceScore);
});

test('excludes titles watched or disliked by either participant and reports shared favorites', () => {
  const sharedFav = makeMedia('movie-10', 10, 'movie', 'Shared Favorite', ['Mystery', 'Thriller'], ['rätsel'], 'Fincher');
  const favA = makeMedia('movie-11', 11, 'movie', 'Fav A', ['Mystery', 'Drama'], ['geheimnis'], 'Nolan');
  const favB = makeMedia('movie-12', 12, 'movie', 'Fav B', ['Thriller', 'Drama'], ['jagd'], 'Villeneuve');
  const watchedByB = makeMedia('movie-13', 13, 'movie', 'Watched By B', ['Mystery', 'Thriller'], ['rätsel', 'jagd'], 'Fincher');
  const dislikedByA = makeMedia('movie-14', 14, 'movie', 'Disliked By A', ['Mystery', 'Thriller'], ['rätsel'], 'Fincher');
  const validCandidate = makeMedia('tv-15', 15, 'tv', 'Fresh Duo Pick', ['Mystery', 'Thriller', 'Drama'], ['rätsel', 'jagd'], 'Other');

  const catalog = [sharedFav, favA, favB, watchedByB, dislikedByA, validCandidate];

  const result = generateGroupRecommendations({
    catalog,
    userA: {
      id: 'user-a',
      displayName: 'Jonas',
      favorites: [makeFavorite('user-a', sharedFav), makeFavorite('user-a', favA)],
      ratings: [makeRating('user-a', dislikedByA, 'dislike')],
    },
    userB: {
      id: 'user-b',
      displayName: 'Lena',
      favorites: [makeFavorite('user-b', sharedFav), makeFavorite('user-b', favB)],
      ratings: [makeRating('user-b', watchedByB, 'watched')],
    },
  });

  assert.equal(result.sharedFavorites.length, 1);
  assert.equal(result.sharedFavorites[0].id, 'movie-10');
  assert.equal(result.excludedCount, 2);

  const recIds = result.recommendations.map((r) => r.media.id);
  assert.ok(!recIds.includes('movie-13'));
  assert.ok(!recIds.includes('movie-14'));
  assert.ok(!recIds.includes('movie-10'));
  assert.ok(recIds.includes('tv-15'));
});

test('computeSharedGenres identifies overlapping genres ranked by mutual affinity', () => {
  const m1 = makeMedia('m1', 1, 'movie', 'M1', ['Drama', 'Thriller'], [], 'D1');
  const m2 = makeMedia('m2', 2, 'movie', 'M2', ['Science-Fiction', 'Thriller'], [], 'D2');
  const m3 = makeMedia('m3', 3, 'movie', 'M3', ['Komödie', 'Thriller'], [], 'D3');

  const shared = computeSharedGenres(
    [makeFavorite('a', m1), makeFavorite('a', m2)],
    [makeFavorite('b', m2), makeFavorite('b', m3)],
    [m1, m2, m3]
  );

  assert.equal(shared[0]?.genre, 'Thriller');
  assert.equal(shared[0]?.count, 4);
  assert.equal(shared.some((g) => g.genre === 'Komödie'), false);
});
