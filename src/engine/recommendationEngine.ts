import type {
  FavoriteItem,
  GenreStat,
  MediaItem,
  MediaType,
  RecommendationResult,
  RecommendationWeights,
  UserRating,
} from '../types/media';

export const DEFAULT_RECOMMENDATION_WEIGHTS: RecommendationWeights = {
  genre: 0.35,
  keywords: 0.25,
  crewCast: 0.15,
  story: 0.15,
  popularity: 0.1,
};

export interface GenerateRecommendationsInput {
  catalog: MediaItem[];
  favorites: FavoriteItem[];
  ratings?: UserRating[];
  previouslyShownIds?: string[];
  mediaTypeFilter?: MediaType | 'all';
  weights?: RecommendationWeights;
  limit?: number;
}

function jaccardSimilarity(a: string[], b: string[]): number {
  if (a.length === 0 || b.length === 0) return 0;
  const setA = new Set(a.map((v) => v.toLowerCase()));
  const setB = new Set(b.map((v) => v.toLowerCase()));
  let intersection = 0;
  for (const item of setA) {
    if (setB.has(item)) intersection += 1;
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function overlapList(a: string[], b: string[]): string[] {
  const setB = new Set(b.map((v) => v.toLowerCase()));
  return a.filter((item) => setB.has(item.toLowerCase()));
}

function isKnownCreator(name: string | undefined): boolean {
  if (!name) return false;
  const trimmed = name.trim().toLowerCase();
  return (
    trimmed.length > 0 &&
    trimmed !== 'regie unbekannt' &&
    trimmed !== 'creator unbekannt' &&
    trimmed !== 'unbekannt'
  );
}

function computePairSimilarity(
  candidate: MediaItem,
  seed: MediaItem,
  weights: RecommendationWeights
): {
  total: number;
  genreScore: number;
  keywordsScore: number;
  crewCastScore: number;
  storyScore: number;
  popularityScore: number;
  matchedGenres: string[];
  matchedCrewOrCast: string[];
  matchedKeywords: string[];
} {
  const genreScore = jaccardSimilarity(candidate.genres, seed.genres);
  const keywordsScore = jaccardSimilarity(candidate.keywords, seed.keywords);

  const candidatePeople = [
    ...(isKnownCreator(candidate.directorOrCreator) ? [candidate.directorOrCreator] : []),
    ...candidate.cast,
  ];
  const seedPeople = [
    ...(isKnownCreator(seed.directorOrCreator) ? [seed.directorOrCreator] : []),
    ...seed.cast,
  ];
  const sameDirector =
    isKnownCreator(candidate.directorOrCreator) &&
    isKnownCreator(seed.directorOrCreator) &&
    candidate.directorOrCreator.toLowerCase() === seed.directorOrCreator.toLowerCase();
  const rawCrewCast = jaccardSimilarity(candidatePeople, seedPeople);
  const crewCastScore = Math.min(1, rawCrewCast + (sameDirector ? 0.55 : 0));

  const storyScore = jaccardSimilarity(
    candidate.storyCharacteristics,
    seed.storyCharacteristics
  );
  const popularityScore = Math.min(1, Math.max(0, candidate.popularity / 100));

  const total =
    genreScore * weights.genre +
    keywordsScore * weights.keywords +
    crewCastScore * weights.crewCast +
    storyScore * weights.story +
    popularityScore * weights.popularity;

  return {
    total,
    genreScore,
    keywordsScore,
    crewCastScore,
    storyScore,
    popularityScore,
    matchedGenres: overlapList(candidate.genres, seed.genres),
    matchedCrewOrCast: overlapList(candidatePeople, seedPeople),
    matchedKeywords: overlapList(candidate.keywords, seed.keywords),
  };
}

function buildMetadataReason(
  candidate: MediaItem,
  bestSeed: MediaItem,
  matchedGenres: string[],
  matchedCrewOrCast: string[],
  matchedKeywords: string[],
  topGenreNames: string[]
): string {
  if (
    isKnownCreator(candidate.directorOrCreator) &&
    isKnownCreator(bestSeed.directorOrCreator) &&
    candidate.directorOrCreator.toLowerCase() === bestSeed.directorOrCreator.toLowerCase()
  ) {
    return `Von ${candidate.directorOrCreator} – ähnlich wie dein Favorit „${bestSeed.title}“.`;
  }
  if (matchedCrewOrCast.length > 0) {
    return `Mit ${matchedCrewOrCast[0]} und ähnlicher Atmosphäre wie „${bestSeed.title}“.`;
  }
  if (matchedKeywords.length >= 2) {
    return `Ähnliche Themen und Erzählweise wie „${bestSeed.title}“.`;
  }
  if (matchedGenres.length >= 2) {
    return `Passt zu deinen Lieblingsgenres: ${matchedGenres.slice(0, 2).join(' & ')}.`;
  }
  if (topGenreNames.length >= 2 && candidate.genres.some((g) => topGenreNames.includes(g))) {
    const shared = candidate.genres.filter((g) => topGenreNames.includes(g));
    if (shared.length > 0) {
      return `Trifft deine Vorliebe für ${shared.slice(0, 2).join(' & ')} — inspiriert von „${bestSeed.title}“.`;
    }
  }
  return `Weil dir „${bestSeed.title}“ gefallen hat.`;
}

/**
 * Pure content-based recommendation engine.
 * Ranks catalog candidates using the 35/25/15/15/10 factor weights, applies rule-based
 * feedback modifiers (like/dislike/watched), avoids repetitive recommendations via
 * previouslyShownIds, and enforces genre diversity across top picks.
 */
export function generateRecommendations({
  catalog,
  favorites,
  ratings = [],
  previouslyShownIds = [],
  mediaTypeFilter = 'all',
  weights = DEFAULT_RECOMMENDATION_WEIGHTS,
  limit = 12,
}: GenerateRecommendationsInput): RecommendationResult[] {
  const catalogMap = new Map<string, MediaItem>(catalog.map((item) => [item.id, item]));

  const favoriteIds = new Set(favorites.map((fav) => fav.mediaId));
  const excludedIds = new Set<string>(favoriteIds);

  const likedItems: MediaItem[] = [];
  const dislikedItems: MediaItem[] = [];

  for (const rating of ratings) {
    const item = catalogMap.get(rating.mediaId);
    if (rating.feedback === 'watched' || rating.feedback === 'dislike') {
      excludedIds.add(rating.mediaId);
    }
    if (item) {
      if (rating.feedback === 'like') likedItems.push(item);
      if (rating.feedback === 'dislike') dislikedItems.push(item);
    }
  }

  const favoriteMediaItems = favorites
    .map((fav) => catalogMap.get(fav.mediaId))
    .filter((item): item is MediaItem => Boolean(item));

  // Combine favorites and positively rated titles as preference seeds
  const positiveSeedsMap = new Map<string, { item: MediaItem; weight: number }>();
  for (const fav of favoriteMediaItems) {
    positiveSeedsMap.set(fav.id, { item: fav, weight: 1.0 });
  }
  for (const liked of likedItems) {
    const existing = positiveSeedsMap.get(liked.id);
    if (existing) {
      existing.weight = 1.25;
    } else {
      positiveSeedsMap.set(liked.id, { item: liked, weight: 0.9 });
    }
  }

  const positiveSeeds = Array.from(positiveSeedsMap.values());
  if (positiveSeeds.length === 0) {
    return [];
  }

  const topGenres = computeFavoriteGenres(favorites, catalog).map((g) => g.genre);
  const shownSet = new Set(previouslyShownIds);

  const scoredCandidates = catalog
    .filter((candidate) => {
      if (excludedIds.has(candidate.id)) return false;
      if (mediaTypeFilter !== 'all' && candidate.mediaType !== mediaTypeFilter) return false;
      return true;
    })
    .map((candidate) => {
      let weightedSum = 0;
      let totalSeedWeight = 0;
      let bestPair: ReturnType<typeof computePairSimilarity> | null = null;
      let bestSeed: MediaItem = positiveSeeds[0].item;
      let bestWeightedScore = -1;

      for (const { item: seed, weight } of positiveSeeds) {
        const pair = computePairSimilarity(candidate, seed, weights);
        weightedSum += pair.total * weight;
        totalSeedWeight += weight;

        const weightedPairScore = pair.total * weight;
        if (weightedPairScore > bestWeightedScore) {
          bestWeightedScore = weightedPairScore;
          bestPair = pair;
          bestSeed = seed;
        }
      }

      // Blend average affinity with peak similarity to a favorite seed
      const avgAffinity = totalSeedWeight > 0 ? weightedSum / totalSeedWeight : 0;
      const peakAffinity = bestPair ? bestPair.total : 0;
      let combinedScore = avgAffinity * 0.45 + peakAffinity * 0.55;

      // Apply rule-based penalty for similarity to disliked items
      if (dislikedItems.length > 0) {
        let maxDislikeSimilarity = 0;
        for (const disliked of dislikedItems) {
          const dislikeSim = computePairSimilarity(candidate, disliked, weights).total;
          if (dislikeSim > maxDislikeSimilarity) {
            maxDislikeSimilarity = dislikeSim;
          }
        }
        combinedScore = Math.max(0, combinedScore - maxDislikeSimilarity * 0.42);
      }

      // Slight novelty penalty if shown in previous batch so refresh surfaces variety
      if (shownSet.has(candidate.id)) {
        combinedScore *= 0.86;
      }

      // Convert to 0-100 internal relevance score
      const normalizedScore = Math.max(12, Math.min(99, Math.round(combinedScore * 118)));

      const reason = buildMetadataReason(
        candidate,
        bestSeed,
        bestPair?.matchedGenres ?? [],
        bestPair?.matchedCrewOrCast ?? [],
        bestPair?.matchedKeywords ?? [],
        topGenres
      );

      return {
        id: `rec-${candidate.id}`,
        media: candidate,
        score: normalizedScore,
        reason,
        matchedFavoriteTitle: bestSeed.title,
        matchedGenres: bestPair?.matchedGenres ?? [],
        breakdown: {
          genreScore: Math.round((bestPair?.genreScore ?? 0) * 100),
          keywordsScore: Math.round((bestPair?.keywordsScore ?? 0) * 100),
          crewCastScore: Math.round((bestPair?.crewCastScore ?? 0) * 100),
          storyScore: Math.round((bestPair?.storyScore ?? 0) * 100),
          popularityScore: Math.round((bestPair?.popularityScore ?? 0) * 100),
        },
      } satisfies RecommendationResult;
    });

  // Sort initially by score descending
  scoredCandidates.sort((a, b) => b.score - a.score || b.media.voteAverage - a.media.voteAverage);

  // Greedy diversity re-ranking so one primary genre doesn't monopolize all top picks
  const selected: RecommendationResult[] = [];
  const pool = [...scoredCandidates];
  const primaryGenreCounts = new Map<string, number>();

  while (selected.length < limit && pool.length > 0) {
    let bestIdx = 0;
    let bestAdjusted = -Infinity;

    for (let i = 0; i < pool.length; i += 1) {
      const candidate = pool[i];
      const primaryGenre = candidate.media.genres[0] ?? 'Sonstiges';
      const seenCount = primaryGenreCounts.get(primaryGenre) ?? 0;
      const diversityAdjusted = candidate.score - seenCount * 4.5;
      if (diversityAdjusted > bestAdjusted) {
        bestAdjusted = diversityAdjusted;
        bestIdx = i;
      }
    }

    const [chosen] = pool.splice(bestIdx, 1);
    const chosenGenre = chosen.media.genres[0] ?? 'Sonstiges';
    primaryGenreCounts.set(chosenGenre, (primaryGenreCounts.get(chosenGenre) ?? 0) + 1);
    selected.push(chosen);
  }

  return selected;
}

export function computeFavoriteGenres(
  favorites: FavoriteItem[],
  catalog: MediaItem[]
): GenreStat[] {
  const catalogMap = new Map(catalog.map((item) => [item.id, item]));
  const counts = new Map<string, number>();
  let totalTags = 0;

  for (const fav of favorites) {
    const media = catalogMap.get(fav.mediaId);
    if (!media) continue;
    for (const genre of media.genres) {
      counts.set(genre, (counts.get(genre) ?? 0) + 1);
      totalTags += 1;
    }
  }

  return Array.from(counts.entries())
    .map(([genre, count]) => ({
      genre,
      count,
      percentage: totalTags > 0 ? Math.round((count / totalTags) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count || a.genre.localeCompare(b.genre, 'de'));
}
