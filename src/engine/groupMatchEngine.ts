import type {
  FavoriteItem,
  GenreStat,
  GroupMatchContext,
  GroupRecommendationResult,
  MediaItem,
  MediaType,
  RecommendationResult,
  UserRating,
} from '../types/media';
import {
  computeFavoriteGenres,
  generateRecommendations,
} from './recommendationEngine';

export interface GroupParticipantInput {
  id: string;
  displayName: string;
  favorites: FavoriteItem[];
  ratings: UserRating[];
}

export interface GenerateGroupRecommendationsInput {
  catalog: MediaItem[];
  userA: GroupParticipantInput;
  userB: GroupParticipantInput;
  mediaTypeFilter?: MediaType | 'all';
  previouslyShownIds?: string[];
  limit?: number;
}

export interface GroupMatchSummary {
  context: GroupMatchContext;
  sharedGenres: GenreStat[];
  sharedFavorites: MediaItem[];
  excludedCount: number;
  recommendations: GroupRecommendationResult[];
}

function computeBalancedPairScore(scoreA: number, scoreB: number): {
  groupScore: number;
  balanceScore: number;
} {
  if (scoreA <= 0 || scoreB <= 0) {
    return { groupScore: 0, balanceScore: 0 };
  }
  const harmonic = (2 * scoreA * scoreB) / (scoreA + scoreB);
  const minScore = Math.min(scoreA, scoreB);
  const diff = Math.abs(scoreA - scoreB);
  const balanceScore = Math.max(0, Math.round(100 - diff * 1.1));
  const raw = harmonic * 0.65 + minScore * 0.35 - diff * 0.12;
  return {
    groupScore: Math.max(15, Math.min(99, Math.round(raw))),
    balanceScore,
  };
}

function buildGroupReason(
  recA: RecommendationResult,
  recB: RecommendationResult,
  userBName: string,
  sharedGenres: string[]
): string {
  const firstGenreOverlap = sharedGenres.filter((g) => recA.media.genres.includes(g));
  if (firstGenreOverlap.length >= 2) {
    return `Verbindet eure gemeinsamen Favoriten-Genres ${firstGenreOverlap.slice(0, 2).join(' & ')}.`;
  }
  if (
    recA.matchedFavoriteTitle &&
    recB.matchedFavoriteTitle &&
    recA.matchedFavoriteTitle !== recB.matchedFavoriteTitle
  ) {
    return `Brücke zwischen deinem Favoriten „${recA.matchedFavoriteTitle}“ und ${userBName}s Favorit „${recB.matchedFavoriteTitle}“.`;
  }
  if (firstGenreOverlap.length === 1 && recA.matchedFavoriteTitle) {
    return `Trifft euer gemeinsames Genre ${firstGenreOverlap[0]} – ähnlich zu „${recA.matchedFavoriteTitle}“.`;
  }
  if (recA.matchedFavoriteTitle && recB.matchedFavoriteTitle) {
    return `Passt gleichermaßen zu eurem gemeinsamen Geschmack rund um „${recA.matchedFavoriteTitle}“.`;
  }
  return recA.reason;
}

/**
 * Computes shared genres present in both participants' saved favorites.
 */
export function computeSharedGenres(
  userAFavorites: FavoriteItem[],
  userBFavorites: FavoriteItem[],
  catalog: MediaItem[]
): GenreStat[] {
  const genresA = computeFavoriteGenres(userAFavorites, catalog);
  const genresB = computeFavoriteGenres(userBFavorites, catalog);
  const mapB = new Map(genresB.map((g) => [g.genre, g]));

  const shared = genresA
    .filter((statA) => mapB.has(statA.genre))
    .map((statA) => {
      const statB = mapB.get(statA.genre)!;
      const combinedCount = statA.count + statB.count;
      // Harmonic percentage keeps genres liked by both ranked ahead of one-sided spikes
      const balancedPct = Math.round(
        (2 * statA.percentage * statB.percentage) /
          Math.max(1, statA.percentage + statB.percentage)
      );
      return {
        genre: statA.genre,
        count: combinedCount,
        percentage: balancedPct,
      };
    })
    .sort((a, b) => b.percentage - a.percentage || b.count - a.count);

  return shared;
}

/**
 * Pure balanced group recommendation engine (Phase 2 Social Matching).
 * Combines two users' favorites & feedback, filters out titles watched or disliked
 * by either participant, and ranks candidates by harmonic mutual relevance rather than
 * letting one person's preferences dominate.
 */
export function generateGroupRecommendations({
  catalog,
  userA,
  userB,
  mediaTypeFilter = 'all',
  previouslyShownIds = [],
  limit = 12,
}: GenerateGroupRecommendationsInput): GroupMatchSummary {
  const catalogMap = new Map(catalog.map((item) => [item.id, item]));

  const favIdsA = new Set(userA.favorites.map((f) => f.mediaId));
  const favIdsB = new Set(userB.favorites.map((f) => f.mediaId));

  const sharedFavorites = userA.favorites
    .filter((f) => favIdsB.has(f.mediaId))
    .map((f) => catalogMap.get(f.mediaId) ?? f.mediaSnapshot)
    .filter((item): item is MediaItem => Boolean(item));

  // Exclude titles watched or disliked by EITHER participant
  const excludedWatchedOrDisliked = new Set<string>();
  for (const r of [...userA.ratings, ...userB.ratings]) {
    if (r.feedback === 'watched' || r.feedback === 'dislike') {
      excludedWatchedOrDisliked.add(r.mediaId);
    }
  }

  // Exclude any title already saved by either participant so suggestions are fresh for both
  const allCombinedExcluded = new Set<string>([
    ...excludedWatchedOrDisliked,
    ...favIdsA,
    ...favIdsB,
  ]);

  const sharedGenreStats = computeSharedGenres(userA.favorites, userB.favorites, catalog);
  const sharedGenreNames = sharedGenreStats.map((g) => g.genre);

  const context: GroupMatchContext = {
    participantIds: [userA.id, userB.id],
    sharedGenres: sharedGenreNames,
    excludedWatchedIds: Array.from(excludedWatchedOrDisliked),
  };

  if (userA.favorites.length === 0 || userB.favorites.length === 0) {
    return {
      context,
      sharedGenres: sharedGenreStats,
      sharedFavorites,
      excludedCount: excludedWatchedOrDisliked.size,
      recommendations: [],
    };
  }

  // Score full candidate set independently for each participant while preserving their own seeds
  // Wait: generateRecommendations excludes only the passed favorites + ratings, so we filter out
  // combined exclusions afterwards while keeping each participant's full seed metadata intact.
  const candidateLimit = Math.max(catalog.length, 60);

  const recsA = generateRecommendations({
    catalog,
    favorites: userA.favorites,
    ratings: userA.ratings,
    previouslyShownIds,
    mediaTypeFilter,
    limit: candidateLimit,
  });

  const recsB = generateRecommendations({
    catalog,
    favorites: userB.favorites,
    ratings: userB.ratings,
    previouslyShownIds,
    mediaTypeFilter,
    limit: candidateLimit,
  });

  const mapA = new Map(recsA.map((r) => [r.media.id, r]));
  const mapB = new Map(recsB.map((r) => [r.media.id, r]));
  const shownSet = new Set(previouslyShownIds);

  const combinedCandidates: GroupRecommendationResult[] = [];

  for (const [mediaId, recA] of mapA.entries()) {
    if (allCombinedExcluded.has(mediaId)) continue;
    const recB = mapB.get(mediaId);
    if (!recB) continue;

    const { groupScore, balanceScore } = computeBalancedPairScore(recA.score, recB.score);
    const sharedGenreMatches = sharedGenreNames.filter((g) => recA.media.genres.includes(g));
    const genreBoost = sharedGenreMatches.length > 0 ? Math.min(4, sharedGenreMatches.length * 2) : 0;
    let finalScore = Math.min(99, groupScore + genreBoost);

    if (shownSet.has(mediaId)) {
      finalScore = Math.max(15, Math.round(finalScore * 0.88));
    }

    combinedCandidates.push({
      id: `group-${userB.id}-${mediaId}`,
      media: recA.media,
      score: finalScore,
      userAScore: recA.score,
      userBScore: recB.score,
      balanceScore,
      sharedGenres: sharedGenreMatches,
      matchedGenres: Array.from(new Set([...recA.matchedGenres, ...recB.matchedGenres])),
      matchedFavoriteTitle: recA.matchedFavoriteTitle,
      reason: buildGroupReason(recA, recB, userB.displayName, sharedGenreNames),
      breakdown: {
        genreScore: Math.round((recA.breakdown.genreScore + recB.breakdown.genreScore) / 2),
        keywordsScore: Math.round((recA.breakdown.keywordsScore + recB.breakdown.keywordsScore) / 2),
        crewCastScore: Math.round((recA.breakdown.crewCastScore + recB.breakdown.crewCastScore) / 2),
        storyScore: Math.round((recA.breakdown.storyScore + recB.breakdown.storyScore) / 2),
        popularityScore: recA.breakdown.popularityScore,
      },
    });
  }

  combinedCandidates.sort(
    (a, b) =>
      b.score - a.score ||
      b.balanceScore - a.balanceScore ||
      b.media.voteAverage - a.media.voteAverage
  );

  // Greedy diversity re-ranking across primary genres
  const selected: GroupRecommendationResult[] = [];
  const pool = [...combinedCandidates];
  const genreCounts = new Map<string, number>();

  while (selected.length < limit && pool.length > 0) {
    let bestIdx = 0;
    let bestAdjusted = -Infinity;

    for (let i = 0; i < pool.length; i += 1) {
      const candidate = pool[i];
      const primaryGenre = candidate.media.genres[0] ?? 'Sonstiges';
      const seenCount = genreCounts.get(primaryGenre) ?? 0;
      const adjusted = candidate.score - seenCount * 4.5;
      if (adjusted > bestAdjusted) {
        bestAdjusted = adjusted;
        bestIdx = i;
      }
    }

    const [chosen] = pool.splice(bestIdx, 1);
    const chosenGenre = chosen.media.genres[0] ?? 'Sonstiges';
    genreCounts.set(chosenGenre, (genreCounts.get(chosenGenre) ?? 0) + 1);
    selected.push(chosen);
  }

  return {
    context,
    sharedGenres: sharedGenreStats,
    sharedFavorites,
    excludedCount: excludedWatchedOrDisliked.size,
    recommendations: selected,
  };
}
