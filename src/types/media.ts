export type MediaType = 'movie' | 'tv';

export type FeedbackType = 'like' | 'dislike' | 'watched';

export type AppRoute = 'dashboard' | 'discover' | 'favorites' | 'profile';

export type AuthView = 'login' | 'register' | 'reset';

export interface PosterTheme {
  gradientFrom: string;
  gradientTo: string;
  accentLine: string;
  motif: 'orbit' | 'monolith' | 'grid' | 'horizon' | 'frame';
}

export interface MediaItem {
  id: string; // Composite key e.g. "movie-157336"
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  originalTitle?: string;
  releaseDate: string; // ISO YYYY-MM-DD
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
  popularity: number; // Normalized 0-100 scale
  posterUrl?: string;
  backdropUrl?: string;
  posterTheme: PosterTheme;
}

export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  email: string;
  avatarUrl?: string;
  onboardingCompleted: boolean;
  preferredMediaType: 'all' | MediaType;
  createdAt: string;
  updatedAt: string;
}

export interface FavoriteItem {
  id: string;
  userId: string;
  tmdbId: number;
  mediaType: MediaType;
  mediaId: string;
  title: string;
  posterUrl?: string;
  mediaSnapshot?: MediaItem;
  createdAt: string;
}

export interface UserRating {
  id: string;
  userId: string;
  tmdbId: number;
  mediaType: MediaType;
  mediaId: string;
  feedback: FeedbackType;
  createdAt: string;
  updatedAt: string;
}

export interface RecommendationWeights {
  genre: number;       // Default: 0.35
  keywords: number;    // Default: 0.25
  crewCast: number;    // Default: 0.15
  story: number;       // Default: 0.15
  popularity: number;  // Default: 0.10
}

export interface FactorBreakdown {
  genreScore: number;
  keywordsScore: number;
  crewCastScore: number;
  storyScore: number;
  popularityScore: number;
}

export interface RecommendationResult {
  id: string;
  media: MediaItem;
  score: number; // 0-100 internal relevance score
  reason: string;
  matchedFavoriteTitle?: string;
  matchedGenres: string[];
  breakdown: FactorBreakdown;
}

export interface GenreStat {
  genre: string;
  count: number;
  percentage: number;
}

/**
 * Architectural placeholder interface for Phase 2+ Social Matching.
 * Kept decoupled so group recommendations can later combine two UserProfiles.
 */
export interface GroupMatchContext {
  participantIds: string[];
  sharedGenres: string[];
  excludedWatchedIds: string[];
}
