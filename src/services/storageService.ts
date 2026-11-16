import type { FavoriteItem, UserProfile, UserRating } from '../types/media';

const STORAGE_KEY = 'cinematch_mvp_state_v1';

export interface PersistedAppState {
  profile: UserProfile | null;
  favorites: FavoriteItem[];
  ratings: UserRating[];
  shownRecommendationIds: string[];
}

const DEFAULT_STATE: PersistedAppState = {
  profile: null,
  favorites: [],
  ratings: [],
  shownRecommendationIds: [],
};

export function loadPersistedState(): PersistedAppState {
  if (typeof window === 'undefined') return DEFAULT_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<PersistedAppState>;
    return {
      profile: parsed.profile ?? null,
      favorites: Array.isArray(parsed.favorites) ? parsed.favorites : [],
      ratings: Array.isArray(parsed.ratings) ? parsed.ratings : [],
      shownRecommendationIds: Array.isArray(parsed.shownRecommendationIds)
        ? parsed.shownRecommendationIds
        : [],
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function savePersistedState(state: PersistedAppState): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage quota errors gracefully
  }
}

export function clearPersistedState(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore
  }
}

export function createDemoProfile(displayName = 'Jonas Weber', email = 'jonas.weber@example.de'): UserProfile {
  const now = new Date().toISOString();
  const baseUsername = displayName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '') || 'cinephile';

  return {
    id: 'demo-user-01',
    username: baseUsername,
    displayName,
    email,
    onboardingCompleted: true,
    preferredMediaType: 'all',
    createdAt: now,
    updatedAt: now,
  };
}
