import { useCallback, useEffect, useMemo, useState } from 'react';
import { CATALOG_ITEMS } from './data/catalog';
import { computeFavoriteGenres, generateRecommendations } from './engine/recommendationEngine';
import { isSupabaseConfigured } from './lib/supabase';
import {
  deleteAccountSupabase,
  loadSupabaseWorkspace,
  resetPasswordSupabase,
  saveFeedbackSupabase,
  signInSupabase,
  signOutSupabase,
  signUpSupabase,
  syncRecommendationsSupabase,
  toggleFavoriteSupabase,
  updateProfileSupabase,
} from './services/databaseService';
import { checkBackendHealth } from './services/tmdbService';
import {
  clearPersistedState,
  createDemoProfile,
  loadPersistedState,
  savePersistedState,
  type PersistedAppState,
} from './services/storageService';
import type {
  AppRoute,
  FavoriteItem,
  FeedbackType,
  MediaItem,
  MediaType,
  UserRating,
} from './types/media';
import { Navigation } from './components/Navigation';
import { Footer } from './components/Footer';
import { MediaDetailModal } from './components/MediaDetailModal';
import { AuthPage } from './pages/AuthPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardPage } from './pages/DashboardPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { ProfilePage } from './pages/ProfilePage';

const DEFAULT_DEMO_FAVORITE_IDS = [
  'movie-157336', // Interstellar
  'movie-329865', // Arrival
  'movie-27205',  // Inception
  'tv-70523',     // Dark
  'tv-95396',     // Severance
];

function buildFavoriteItems(mediaIds: string[], userId: string): FavoriteItem[] {
  const now = new Date().toISOString();
  return mediaIds
    .map((id) => CATALOG_ITEMS.find((item) => item.id === id))
    .filter((item): item is MediaItem => Boolean(item))
    .map((item, idx) => ({
      id: `fav-${item.id}`,
      userId,
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      mediaId: item.id,
      title: item.title,
      posterUrl: item.posterUrl,
      mediaSnapshot: item,
      createdAt: new Date(Date.now() - idx * 60000).toISOString() || now,
    }));
}

export default function App() {
  const [appState, setAppState] = useState<PersistedAppState>(() => {
    const persisted = loadPersistedState();
    // Support ?autostart=1 for instant demo dashboard preview
    if (
      typeof window !== 'undefined' &&
      new URLSearchParams(window.location.search).get('autostart') === '1' &&
      !persisted.profile
    ) {
      const demoProfile = createDemoProfile();
      return {
        profile: demoProfile,
        favorites: buildFavoriteItems(DEFAULT_DEMO_FAVORITE_IDS, demoProfile.id),
        ratings: [],
        shownRecommendationIds: [],
      };
    }
    return persisted;
  });

  // Dynamic candidate pool combining curated catalog + live TMDB discovered/enriched titles
  const [remoteMediaPool, setRemoteMediaPool] = useState<Record<string, MediaItem>>({});
  const [activeRoute, setActiveRoute] = useState<AppRoute>('dashboard');
  const [discoverInitialQuery, setDiscoverInitialQuery] = useState('');
  const [autoFocusDiscover, setAutoFocusDiscover] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<MediaItem | null>(null);
  const [backendStatus, setBackendStatus] = useState({
    tmdbConfigured: false,
    supabaseConfigured: isSupabaseConfigured,
  });

  const isUsingSupabaseSession = Boolean(
    isSupabaseConfigured && appState.profile && appState.profile.id !== 'demo-user-01'
  );

  // Sync local storage for demo / offline resilience
  useEffect(() => {
    savePersistedState(appState);
  }, [appState]);

  // Check backend health & restore active Supabase session on mount
  useEffect(() => {
    checkBackendHealth().then((health) => {
      setBackendStatus({
        tmdbConfigured: health.tmdbConfigured,
        supabaseConfigured: isSupabaseConfigured || health.supabaseConfigured,
      });
    });

    if (isSupabaseConfigured) {
      loadSupabaseWorkspace().then((workspace) => {
        if (workspace) {
          setAppState((prev) => ({
            ...prev,
            profile: workspace.profile,
            favorites: workspace.favorites,
            ratings: workspace.ratings,
          }));
        }
      });
    }
  }, []);

  const expandCatalogPool = useCallback((items: MediaItem[]) => {
    if (items.length === 0) return;
    setRemoteMediaPool((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const item of items) {
        if (!next[item.id] || (item.cast.length > 0 && next[item.id].cast.length === 0)) {
          next[item.id] = item;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const handleMediaEnriched = useCallback(
    (enriched: MediaItem, candidates: MediaItem[]) => {
      expandCatalogPool([enriched, ...candidates]);
    },
    [expandCatalogPool]
  );

  // Merged catalog: local curated items + live TMDB snapshots from favorites & search
  const mergedCatalog = useMemo(() => {
    const map = new Map<string, MediaItem>(CATALOG_ITEMS.map((item) => [item.id, item]));
    for (const fav of appState.favorites) {
      if (fav.mediaSnapshot && !map.has(fav.mediaId)) {
        map.set(fav.mediaId, fav.mediaSnapshot);
      }
    }
    for (const [id, item] of Object.entries(remoteMediaPool)) {
      const existing = map.get(id);
      if (!existing || (item.cast.length > 0 && existing.cast.length === 0)) {
        map.set(id, item);
      }
    }
    return Array.from(map.values());
  }, [appState.favorites, remoteMediaPool]);

  const catalogMap = useMemo(
    () => new Map(mergedCatalog.map((item) => [item.id, item])),
    [mergedCatalog]
  );

  const favoriteMediaItems = useMemo(
    () =>
      appState.favorites
        .map((fav) => fav.mediaSnapshot ?? catalogMap.get(fav.mediaId))
        .filter((item): item is MediaItem => Boolean(item)),
    [appState.favorites, catalogMap]
  );

  const ratingsByMediaId = useMemo(
    () => new Map(appState.ratings.map((r) => [r.mediaId, r])),
    [appState.ratings]
  );

  const allRecommendations = useMemo(
    () =>
      generateRecommendations({
        catalog: mergedCatalog,
        favorites: appState.favorites,
        ratings: appState.ratings,
        previouslyShownIds: appState.shownRecommendationIds,
        mediaTypeFilter: 'all',
        limit: 12,
      }),
    [mergedCatalog, appState.favorites, appState.ratings, appState.shownRecommendationIds]
  );

  const movieRecommendations = useMemo(
    () =>
      generateRecommendations({
        catalog: mergedCatalog,
        favorites: appState.favorites,
        ratings: appState.ratings,
        previouslyShownIds: appState.shownRecommendationIds,
        mediaTypeFilter: 'movie',
        limit: 8,
      }),
    [mergedCatalog, appState.favorites, appState.ratings, appState.shownRecommendationIds]
  );

  const seriesRecommendations = useMemo(
    () =>
      generateRecommendations({
        catalog: mergedCatalog,
        favorites: appState.favorites,
        ratings: appState.ratings,
        previouslyShownIds: appState.shownRecommendationIds,
        mediaTypeFilter: 'tv',
        limit: 8,
      }),
    [mergedCatalog, appState.favorites, appState.ratings, appState.shownRecommendationIds]
  );

  // Persist recommendations snapshot to Supabase when running authenticated
  useEffect(() => {
    if (isUsingSupabaseSession && appState.profile && allRecommendations.length > 0) {
      syncRecommendationsSupabase(appState.profile.id, allRecommendations).catch(() => {
        // Non-blocking sync
      });
    }
  }, [isUsingSupabaseSession, appState.profile, allRecommendations]);

  const spotlightRecommendation = useMemo(() => {
    if (allRecommendations.length === 0) return undefined;
    const preferred = appState.profile?.preferredMediaType ?? 'all';
    if (preferred === 'movie' && movieRecommendations.length > 0) {
      return movieRecommendations[0];
    }
    if (preferred === 'tv' && seriesRecommendations.length > 0) {
      return seriesRecommendations[0];
    }
    return allRecommendations[0];
  }, [
    allRecommendations,
    movieRecommendations,
    seriesRecommendations,
    appState.profile?.preferredMediaType,
  ]);

  const recommendationMap = useMemo(
    () => new Map(allRecommendations.map((rec) => [rec.media.id, rec])),
    [allRecommendations]
  );

  const favoriteGenres = useMemo(
    () => computeFavoriteGenres(appState.favorites, mergedCatalog),
    [appState.favorites, mergedCatalog]
  );

  const handleLogin = async (email: string, password: string) => {
    if (isSupabaseConfigured) {
      const workspace = await signInSupabase(email, password);
      setAppState({
        profile: workspace.profile,
        favorites: workspace.favorites,
        ratings: workspace.ratings,
        shownRecommendationIds: [],
      });
      setActiveRoute('dashboard');
      return;
    }

    const nameFromEmail = email.split('@')[0]?.replace(/[._-]+/g, ' ') || 'Film-Fan';
    const formattedName = nameFromEmail
      .split(' ')
      .filter(Boolean)
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(' ');
    const profile = createDemoProfile(formattedName, email);

    setAppState((prev) => ({
      ...prev,
      profile,
      favorites:
        prev.favorites.length > 0
          ? prev.favorites
          : buildFavoriteItems(DEFAULT_DEMO_FAVORITE_IDS, profile.id),
    }));
    setActiveRoute('dashboard');
  };

  const handleRegister = async (
    displayName: string,
    email: string,
    password: string
  ): Promise<{ requiresEmailConfirmation?: boolean }> => {
    if (isSupabaseConfigured) {
      const result = await signUpSupabase(displayName, email, password);
      if (result.requiresEmailConfirmation || !result.workspace) {
        return { requiresEmailConfirmation: true };
      }
      setAppState({
        profile: result.workspace.profile,
        favorites: result.workspace.favorites,
        ratings: result.workspace.ratings,
        shownRecommendationIds: [],
      });
      setActiveRoute('dashboard');
      return { requiresEmailConfirmation: false };
    }

    const profile = createDemoProfile(displayName, email);
    profile.onboardingCompleted = false;
    setAppState({
      profile,
      favorites: [],
      ratings: [],
      shownRecommendationIds: [],
    });
    setActiveRoute('dashboard');
    return { requiresEmailConfirmation: false };
  };

  const handleResetPassword = async (email: string) => {
    if (isSupabaseConfigured) {
      await resetPasswordSupabase(email);
    }
  };

  const handleDemoLogin = () => {
    const profile = createDemoProfile();
    setAppState({
      profile,
      favorites: buildFavoriteItems(DEFAULT_DEMO_FAVORITE_IDS, profile.id),
      ratings: [],
      shownRecommendationIds: [],
    });
    setActiveRoute('dashboard');
  };

  const handleToggleFavorite = (media: MediaItem) => {
    if (!appState.profile) return;
    const userId = appState.profile.id;
    const currentlyFavorite = appState.favorites.some((fav) => fav.mediaId === media.id);

    setAppState((prev) => {
      if (currentlyFavorite) {
        return {
          ...prev,
          favorites: prev.favorites.filter((fav) => fav.mediaId !== media.id),
        };
      }
      const newFav: FavoriteItem = {
        id: `fav-${media.id}`,
        userId,
        tmdbId: media.tmdbId,
        mediaType: media.mediaType,
        mediaId: media.id,
        title: media.title,
        posterUrl: media.posterUrl,
        mediaSnapshot: media,
        createdAt: new Date().toISOString(),
      };
      return {
        ...prev,
        favorites: [newFav, ...prev.favorites],
      };
    });

    if (isUsingSupabaseSession) {
      toggleFavoriteSupabase(userId, media, currentlyFavorite).catch(() => {
        // Keep UI responsive; production error toast can be added if needed
      });
    }
  };

  const handleFeedback = (media: MediaItem, feedback: FeedbackType) => {
    if (!appState.profile) return;
    const userId = appState.profile.id;
    const now = new Date().toISOString();
    const existing = appState.ratings.find((r) => r.mediaId === media.id);
    const clearing = Boolean(existing && existing.feedback === feedback);

    setAppState((prev) => {
      if (clearing) {
        return {
          ...prev,
          ratings: prev.ratings.filter((r) => r.mediaId !== media.id),
        };
      }

      const nextRating: UserRating = {
        id: existing?.id ?? `rate-${media.id}`,
        userId,
        tmdbId: media.tmdbId,
        mediaType: media.mediaType,
        mediaId: media.id,
        feedback,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      };

      const filtered = prev.ratings.filter((r) => r.mediaId !== media.id);
      return {
        ...prev,
        ratings: [nextRating, ...filtered],
      };
    });

    if (isUsingSupabaseSession) {
      saveFeedbackSupabase(userId, media, clearing ? null : feedback).catch(() => {
        // Non-blocking
      });
    }

    if (selectedMedia?.id === media.id && (feedback === 'dislike' || feedback === 'watched')) {
      setSelectedMedia(null);
    }
  };

  const handleRefreshRecommendations = () => {
    const currentTopIds = allRecommendations.slice(0, 4).map((rec) => rec.media.id);
    setAppState((prev) => ({
      ...prev,
      shownRecommendationIds: Array.from(
        new Set([...prev.shownRecommendationIds, ...currentTopIds])
      ).slice(-10),
    }));
  };

  const handleNavigate = (
    route: AppRoute,
    options?: { focusSearch?: boolean; initialQuery?: string }
  ) => {
    if (options?.initialQuery !== undefined) {
      setDiscoverInitialQuery(options.initialQuery);
    }
    setAutoFocusDiscover(Boolean(options?.focusSearch));
    setActiveRoute(route);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCompleteOnboarding = () => {
    if (!appState.profile) return;
    const userId = appState.profile.id;
    setAppState((prev) =>
      prev.profile
        ? {
            ...prev,
            profile: {
              ...prev.profile,
              onboardingCompleted: true,
              updatedAt: new Date().toISOString(),
            },
          }
        : prev
    );
    if (isUsingSupabaseSession) {
      updateProfileSupabase(userId, { onboardingCompleted: true }).catch(() => {});
    }
    setActiveRoute('dashboard');
  };

  const handleUpdateProfile = (updates: {
    displayName: string;
    username: string;
    preferredMediaType: 'all' | MediaType;
  }) => {
    if (!appState.profile) return;
    const userId = appState.profile.id;
    setAppState((prev) =>
      prev.profile
        ? {
            ...prev,
            profile: {
              ...prev.profile,
              ...updates,
              updatedAt: new Date().toISOString(),
            },
          }
        : prev
    );
    if (isUsingSupabaseSession) {
      updateProfileSupabase(userId, updates).catch(() => {});
    }
  };

  const handleRestartOnboarding = () => {
    setAppState((prev) =>
      prev.profile
        ? {
            ...prev,
            profile: {
              ...prev.profile,
              onboardingCompleted: false,
            },
          }
        : prev
    );
  };

  const handleSignOut = () => {
    setSelectedMedia(null);
    if (isUsingSupabaseSession) {
      signOutSupabase().catch(() => {});
    }
    setAppState((prev) => ({
      ...prev,
      profile: null,
    }));
  };

  const handleDeleteAccount = () => {
    setSelectedMedia(null);
    if (isUsingSupabaseSession) {
      deleteAccountSupabase().catch(() => {});
    }
    clearPersistedState();
    setAppState({
      profile: null,
      favorites: [],
      ratings: [],
      shownRecommendationIds: [],
    });
  };

  // Route Guard 1: Unauthenticated -> Auth Page
  if (!appState.profile) {
    return (
      <AuthPage
        onLogin={handleLogin}
        onRegister={handleRegister}
        onResetPassword={handleResetPassword}
        onDemoLogin={handleDemoLogin}
      />
    );
  }

  // Route Guard 2: Authenticated, Onboarding incomplete -> Onboarding Page
  if (!appState.profile.onboardingCompleted) {
    return (
      <OnboardingPage
        displayName={appState.profile.displayName}
        favorites={appState.favorites}
        knownCatalog={mergedCatalog}
        onToggleFavorite={handleToggleFavorite}
        onComplete={handleCompleteOnboarding}
        onCatalogExpand={expandCatalogPool}
      />
    );
  }

  // Route Guard 3: Authenticated App Shell
  const isSelectedFavorite = selectedMedia
    ? appState.favorites.some((fav) => fav.mediaId === selectedMedia.id)
    : false;

  return (
    <div className="flex min-h-screen flex-col bg-[#101014] text-[#F5F5F7]">
      <Navigation
        activeRoute={activeRoute}
        favoritesCount={appState.favorites.length}
        onNavigate={handleNavigate}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-8 sm:px-6 sm:pt-8 lg:px-8">
        {activeRoute === 'dashboard' && (
          <DashboardPage
            displayName={appState.profile.displayName}
            favorites={appState.favorites}
            favoriteMediaItems={favoriteMediaItems}
            movieRecommendations={movieRecommendations}
            seriesRecommendations={seriesRecommendations}
            spotlightRecommendation={spotlightRecommendation}
            ratingsByMediaId={ratingsByMediaId}
            onNavigate={handleNavigate}
            onOpenDetail={setSelectedMedia}
            onToggleFavorite={handleToggleFavorite}
            onFeedback={handleFeedback}
            onRefreshRecommendations={handleRefreshRecommendations}
          />
        )}

        {activeRoute === 'discover' && (
          <DiscoverPage
            initialQuery={discoverInitialQuery}
            autoFocusSearch={autoFocusDiscover}
            favorites={appState.favorites}
            onOpenDetail={setSelectedMedia}
            onToggleFavorite={handleToggleFavorite}
            onCatalogExpand={expandCatalogPool}
          />
        )}

        {activeRoute === 'favorites' && (
          <FavoritesPage
            favorites={appState.favorites}
            favoriteMediaItems={favoriteMediaItems}
            onOpenDetail={setSelectedMedia}
            onToggleFavorite={handleToggleFavorite}
            onGoToDiscover={() => handleNavigate('discover')}
          />
        )}

        {activeRoute === 'profile' && (
          <ProfilePage
            profile={appState.profile}
            favorites={appState.favorites}
            ratings={appState.ratings}
            favoriteGenres={favoriteGenres}
            onUpdateProfile={handleUpdateProfile}
            onRestartOnboarding={handleRestartOnboarding}
            onSignOut={handleSignOut}
            onDeleteAccount={handleDeleteAccount}
          />
        )}
      </main>

      <Footer
        tmdbLive={backendStatus.tmdbConfigured}
        supabaseLive={backendStatus.supabaseConfigured}
      />

      <MediaDetailModal
        media={selectedMedia}
        isFavorite={isSelectedFavorite}
        userFeedback={
          selectedMedia ? ratingsByMediaId.get(selectedMedia.id)?.feedback : undefined
        }
        recommendation={selectedMedia ? recommendationMap.get(selectedMedia.id) : undefined}
        onClose={() => setSelectedMedia(null)}
        onToggleFavorite={handleToggleFavorite}
        onFeedback={handleFeedback}
        onMediaEnriched={handleMediaEnriched}
      />
    </div>
  );
}
