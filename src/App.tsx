import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CATALOG_ITEMS } from './data/catalog';
import {
  createInitialDemoConnections,
  createInitialDemoWatchlist,
  DEMO_DIRECTORY_PROFILES,
} from './data/demoFriends';
import { computeFavoriteGenres, generateRecommendations } from './engine/recommendationEngine';
import { ensureSupabaseClient, isSupabaseConfigured } from './lib/supabase';
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
  updateFavoriteSnapshotSupabase,
  updatePasswordSupabase,
  updateProfileSupabase,
} from './services/databaseService';
import {
  acceptFriendRequestSupabase,
  addSharedWatchlistItemSupabase,
  loadSocialWorkspaceSupabase,
  removeFriendshipSupabase,
  removeSharedWatchlistItemSupabase,
  sendFriendRequestSupabase,
  toggleSharedWatchlistWatchedSupabase,
} from './services/socialService';
import {
  checkBackendHealth,
  fetchMediaDetails,
  searchRemoteMedia,
} from './services/tmdbService';
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
  FriendConnection,
  MediaItem,
  MediaType,
  SharedWatchlistItem,
  UserRating,
} from './types/media';
import { Navigation } from './components/Navigation';
import { Footer } from './components/Footer';
import { MediaDetailModal } from './components/MediaDetailModal';
import { PasswordRecoveryModal } from './components/PasswordRecoveryModal';
import { AuthPage } from './pages/AuthPage';
import { OnboardingPage } from './pages/OnboardingPage';
import { DashboardPage } from './pages/DashboardPage';
import { DiscoverPage } from './pages/DiscoverPage';
import { FavoritesPage } from './pages/FavoritesPage';
import { SocialMatchPage } from './pages/SocialMatchPage';
import { ProfilePage } from './pages/ProfilePage';

const DEFAULT_DEMO_FAVORITE_IDS = [
  'movie-157336', // Interstellar
  'movie-329865', // Arrival
  'movie-27205',  // Inception
  'tv-70523',     // Dark
  'tv-95396',     // Severance
];

function isKnownCreatorName(name: string | undefined): boolean {
  if (!name) return false;
  const lower = name.trim().toLowerCase();
  return (
    lower.length > 0 &&
    lower !== 'regie unbekannt' &&
    lower !== 'creator unbekannt' &&
    lower !== 'unbekannt'
  );
}

function mergeMediaRecords(base: MediaItem, incoming: MediaItem): MediaItem {
  const preferIncomingPoster =
    incoming.posterUrl && (!base.posterUrl || incoming.posterUrl.includes('image.tmdb.org'))
      ? incoming.posterUrl
      : (base.posterUrl ?? incoming.posterUrl);
  const preferIncomingBackdrop =
    incoming.backdropUrl && (!base.backdropUrl || incoming.backdropUrl.includes('image.tmdb.org'))
      ? incoming.backdropUrl
      : (base.backdropUrl ?? incoming.backdropUrl);

  return {
    ...base,
    ...incoming,
    posterUrl: preferIncomingPoster,
    backdropUrl: preferIncomingBackdrop,
    directorOrCreator: isKnownCreatorName(incoming.directorOrCreator)
      ? incoming.directorOrCreator
      : base.directorOrCreator,
    cast: incoming.cast.length > 0 ? incoming.cast : base.cast,
    keywords: incoming.keywords.length > 0 ? incoming.keywords : base.keywords,
    storyCharacteristics:
      incoming.storyCharacteristics.length > 0
        ? incoming.storyCharacteristics
        : base.storyCharacteristics,
    runtimeMinutes: incoming.runtimeMinutes ?? base.runtimeMinutes,
    seasonsCount: incoming.seasonsCount ?? base.seasonsCount,
    episodesCount: incoming.episodesCount ?? base.episodesCount,
  };
}

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
        demoConnections: createInitialDemoConnections(),
        demoWatchlist: createInitialDemoWatchlist(),
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
  const [syncError, setSyncError] = useState<string | null>(null);
  const [showPasswordRecovery, setShowPasswordRecovery] = useState(false);
  const [supabaseConfiguredState, setSupabaseConfiguredState] = useState(isSupabaseConfigured);
  const [backendStatus, setBackendStatus] = useState({
    tmdbConfigured: false,
    supabaseConfigured: isSupabaseConfigured,
  });

  // Social Matching state (live Supabase when authenticated, local persisted fallback in Demo Mode)
  const [supabaseConnections, setSupabaseConnections] = useState<FriendConnection[]>([]);
  const [supabaseWatchlist, setSupabaseWatchlist] = useState<SharedWatchlistItem[]>([]);
  const [socialMigrationMissing, setSocialMigrationMissing] = useState(false);
  const [isLoadingSocial, setIsLoadingSocial] = useState(false);
  const [selectedFriendId, setSelectedFriendId] = useState<string | null>(null);

  const enrichedFavoriteIdsRef = useRef<Set<string>>(new Set());
  const discoveredGenresRef = useRef<Set<string>>(new Set());
  const trendingLoadedRef = useRef(false);
  const isMountedRef = useRef(true);
  const initialRecoveryUrlRef = useRef(
    typeof window !== 'undefined' &&
      (window.location.hash.includes('type=recovery') ||
        new URLSearchParams(window.location.search).get('type') === 'recovery')
  );

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const isUsingSupabaseSession = Boolean(
    supabaseConfiguredState && appState.profile && appState.profile.id !== 'demo-user-01'
  );

  // Sync local storage for demo / offline resilience
  useEffect(() => {
    savePersistedState(appState);
  }, [appState]);

  const refreshSupabaseSocial = useCallback(async (userId: string) => {
    setIsLoadingSocial(true);
    try {
      const social = await loadSocialWorkspaceSupabase(userId);
      if (!isMountedRef.current) return;
      setSupabaseConnections(social.connections);
      setSupabaseWatchlist(social.watchlist);
      setSocialMigrationMissing(social.migrationMissing);
    } catch {
      // Keep non-blocking; empty state remains clean
    } finally {
      if (isMountedRef.current) {
        setIsLoadingSocial(false);
      }
    }
  }, []);

  // Check backend health, hydrate runtime Supabase client if needed, & restore/subscribe to session
  useEffect(() => {
    let active = true;
    let unsubscribeAuth: (() => void) | undefined;

    Promise.all([checkBackendHealth(), ensureSupabaseClient()]).then(
      async ([health, client]) => {
        if (!active) return;

        const hasClient = Boolean(client);
        setSupabaseConfiguredState(hasClient);
        setBackendStatus({
          tmdbConfigured: health.tmdbConfigured,
          supabaseConfigured: hasClient || health.supabaseConfigured,
        });

        if (!client) return;

        const workspace = await loadSupabaseWorkspace();
        if (!active) return;
        if (workspace) {
          setAppState((prev) => ({
            ...prev,
            profile: workspace.profile,
            favorites: workspace.favorites,
            ratings: workspace.ratings,
          }));
          refreshSupabaseSocial(workspace.profile.id);
          if (initialRecoveryUrlRef.current) {
            setShowPasswordRecovery(true);
            initialRecoveryUrlRef.current = false;
          }
        }

        const {
          data: { subscription },
        } = client.auth.onAuthStateChange((event) => {
          if (event === 'PASSWORD_RECOVERY') {
            setShowPasswordRecovery(true);
            loadSupabaseWorkspace().then((ws) => {
              if (active && ws) {
                setAppState((prev) => ({
                  ...prev,
                  profile: ws.profile,
                  favorites: ws.favorites,
                  ratings: ws.ratings,
                }));
                refreshSupabaseSocial(ws.profile.id);
              }
            });
          } else if (event === 'SIGNED_OUT') {
            setShowPasswordRecovery(false);
            setSupabaseConnections([]);
            setSupabaseWatchlist([]);
            setSocialMigrationMissing(false);
            setSelectedFriendId(null);
            setAppState({
              profile: null,
              favorites: [],
              ratings: [],
              shownRecommendationIds: [],
            });
          } else if (event === 'SIGNED_IN') {
            loadSupabaseWorkspace().then((ws) => {
              if (active && ws) {
                setAppState((prev) => ({
                  ...prev,
                  profile: ws.profile,
                  favorites: ws.favorites,
                  ratings: ws.ratings,
                }));
                refreshSupabaseSocial(ws.profile.id);
              }
            });
          }
        });
        unsubscribeAuth = () => subscription.unsubscribe();
      }
    );

    return () => {
      active = false;
      unsubscribeAuth?.();
    };
  }, [refreshSupabaseSocial]);

  const expandCatalogPool = useCallback((items: MediaItem[]) => {
    if (items.length === 0) return;
    setRemoteMediaPool((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const item of items) {
        const existing = next[item.id];
        if (!existing) {
          next[item.id] = item;
          changed = true;
        } else {
          const merged = mergeMediaRecords(existing, item);
          if (
            merged.posterUrl !== existing.posterUrl ||
            merged.backdropUrl !== existing.backdropUrl ||
            merged.cast.length !== existing.cast.length ||
            merged.keywords.length !== existing.keywords.length
          ) {
            next[item.id] = merged;
            changed = true;
          }
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

  // Automatically expand recommendation candidate pool with live TMDB trending titles,
  // favorite metadata/recommendations, and artwork for visible catalog recommendations
  useEffect(() => {
    if (!backendStatus.tmdbConfigured || !appState.profile) return;

    if (!trendingLoadedRef.current) {
      trendingLoadedRef.current = true;
      searchRemoteMedia({ query: '', mediaType: 'all' })
        .then((res) => {
          if (isMountedRef.current && res.items.length > 0) {
            expandCatalogPool(res.items);
          }
        })
        .catch(() => {});
    }

    // Also pull live TMDB discover candidates for the user's top favorite genres
    const genreCounts = new Map<string, number>();
    for (const fav of appState.favorites) {
      const genres =
        fav.mediaSnapshot?.genres ?? CATALOG_ITEMS.find((c) => c.id === fav.mediaId)?.genres ?? [];
      for (const genre of genres) {
        genreCounts.set(genre, (genreCounts.get(genre) ?? 0) + 1);
      }
    }
    const topGenres = Array.from(genreCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([genre]) => genre);

    for (const genre of topGenres) {
      if (discoveredGenresRef.current.has(genre)) continue;
      discoveredGenresRef.current.add(genre);
      searchRemoteMedia({ query: '', mediaType: 'all', genre, page: 1 })
        .then((res) => {
          if (isMountedRef.current && res.items.length > 0) {
            expandCatalogPool(res.items);
          }
        })
        .catch(() => {});
    }

    const favoritesToEnrich = appState.favorites
      .filter((fav) => !enrichedFavoriteIdsRef.current.has(fav.mediaId))
      .slice(0, 5);

    const catalogWithoutPosters = CATALOG_ITEMS.filter(
      (item) => !item.posterUrl && !enrichedFavoriteIdsRef.current.has(item.id)
    ).slice(0, 14);

    const targets = [
      ...favoritesToEnrich.map((f) => ({
        id: f.mediaId,
        mediaType: f.mediaType,
        tmdbId: f.tmdbId,
        isFavorite: true,
      })),
      ...catalogWithoutPosters
        .filter((c) => !favoritesToEnrich.some((f) => f.mediaId === c.id))
        .map((c) => ({
          id: c.id,
          mediaType: c.mediaType,
          tmdbId: c.tmdbId,
          isFavorite: false,
        })),
    ];

    for (const target of targets) {
      enrichedFavoriteIdsRef.current.add(target.id);
      fetchMediaDetails(target.mediaType, target.tmdbId)
        .then((res) => {
          if (!isMountedRef.current || !res.item) return;
          const enriched = res.item;
          expandCatalogPool([enriched, ...res.recommendations]);

          if (target.isFavorite) {
            setAppState((prev) => ({
              ...prev,
              favorites: prev.favorites.map((existing) => {
                if (existing.mediaId !== enriched.id) return existing;
                const mergedSnapshot = existing.mediaSnapshot
                  ? mergeMediaRecords(existing.mediaSnapshot, enriched)
                  : enriched;
                return {
                  ...existing,
                  posterUrl: mergedSnapshot.posterUrl ?? existing.posterUrl,
                  mediaSnapshot: mergedSnapshot,
                };
              }),
            }));

            if (isUsingSupabaseSession && appState.profile) {
              updateFavoriteSnapshotSupabase(appState.profile.id, enriched).catch(() => {});
            }
          }
        })
        .catch(() => {});
    }
  }, [
    backendStatus.tmdbConfigured,
    appState.profile,
    appState.favorites,
    expandCatalogPool,
    isUsingSupabaseSession,
  ]);

  const activeConnections = useMemo(() => {
    if (isUsingSupabaseSession) return supabaseConnections;
    return appState.demoConnections ?? createInitialDemoConnections();
  }, [isUsingSupabaseSession, supabaseConnections, appState.demoConnections]);

  const activeWatchlist = useMemo(() => {
    if (isUsingSupabaseSession) return supabaseWatchlist;
    return appState.demoWatchlist ?? createInitialDemoWatchlist();
  }, [isUsingSupabaseSession, supabaseWatchlist, appState.demoWatchlist]);

  const pendingRequestsCount = useMemo(
    () =>
      activeConnections.filter((c) => c.status === 'pending' && c.direction === 'incoming')
        .length,
    [activeConnections]
  );

  // Merged catalog: local curated items + live TMDB snapshots from favorites, friends, watchlist & search
  const mergedCatalog = useMemo(() => {
    const map = new Map<string, MediaItem>(CATALOG_ITEMS.map((item) => [item.id, item]));
    const mergeIn = (item: MediaItem | undefined) => {
      if (!item) return;
      const existing = map.get(item.id);
      map.set(item.id, existing ? mergeMediaRecords(existing, item) : item);
    };
    for (const fav of appState.favorites) {
      mergeIn(fav.mediaSnapshot);
    }
    for (const conn of activeConnections) {
      for (const fav of conn.favorites) {
        mergeIn(fav.mediaSnapshot);
      }
    }
    for (const entry of activeWatchlist) {
      mergeIn(entry.mediaSnapshot);
    }
    for (const item of Object.values(remoteMediaPool)) {
      mergeIn(item);
    }
    return Array.from(map.values());
  }, [appState.favorites, activeConnections, activeWatchlist, remoteMediaPool]);

  const catalogMap = useMemo(
    () => new Map(mergedCatalog.map((item) => [item.id, item])),
    [mergedCatalog]
  );

  const favoriteMediaItems = useMemo(
    () =>
      appState.favorites
        .map((fav) => {
          const fromCatalog = catalogMap.get(fav.mediaId);
          if (fromCatalog && fav.mediaSnapshot) {
            return mergeMediaRecords(fav.mediaSnapshot, fromCatalog);
          }
          return fromCatalog ?? fav.mediaSnapshot;
        })
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
    const client = await ensureSupabaseClient();
    if (client) {
      setSupabaseConfiguredState(true);
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
    const client = await ensureSupabaseClient();
    if (client) {
      setSupabaseConfiguredState(true);
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
    const client = await ensureSupabaseClient();
    if (client) {
      setSupabaseConfiguredState(true);
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
      demoConnections: createInitialDemoConnections(),
      demoWatchlist: createInitialDemoWatchlist(),
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
      toggleFavoriteSupabase(userId, media, currentlyFavorite).catch((err: unknown) => {
        setSyncError((err as Error).message || 'Favorit konnte nicht synchronisiert werden.');
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
      saveFeedbackSupabase(userId, media, clearing ? null : feedback).catch((err: unknown) => {
        setSyncError((err as Error).message || 'Bewertung konnte nicht gespeichert werden.');
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
      updateProfileSupabase(userId, { onboardingCompleted: true }).catch((err: unknown) => {
        setSyncError((err as Error).message || 'Onboarding-Status konnte nicht gespeichert werden.');
      });
    }
    setActiveRoute('dashboard');
  };

  const handleUpdateProfile = async (updates: {
    displayName: string;
    username: string;
    preferredMediaType: 'all' | MediaType;
  }) => {
    if (!appState.profile) return;
    const userId = appState.profile.id;
    if (isUsingSupabaseSession) {
      await updateProfileSupabase(userId, updates);
    }
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
  };

  const handleRestartOnboarding = () => {
    if (!appState.profile) return;
    const userId = appState.profile.id;
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
    if (isUsingSupabaseSession) {
      updateProfileSupabase(userId, { onboardingCompleted: false }).catch(() => {});
    }
  };

  const handleSendFriendRequest = async (username: string) => {
    if (!appState.profile) return;
    if (isUsingSupabaseSession) {
      await sendFriendRequestSupabase(username);
      await refreshSupabaseSocial(appState.profile.id);
      return;
    }

    const cleaned = username.trim().toLowerCase().replace(/^@+/, '');
    if (cleaned === appState.profile.username.toLowerCase()) {
      throw new Error('Du kannst dich nicht selbst als Freund hinzufügen.');
    }
    const existingList = appState.demoConnections ?? createInitialDemoConnections();
    if (existingList.some((c) => c.friend.username.toLowerCase() === cleaned)) {
      throw new Error('Zwischen euch besteht bereits eine Verbindung oder Anfrage.');
    }
    const template = DEMO_DIRECTORY_PROFILES.find(
      (c) => c.friend.username.toLowerCase() === cleaned
    );
    const nextConn: FriendConnection = template ?? {
      id: `demo-conn-${cleaned}`,
      status: 'accepted',
      direction: 'outgoing',
      friend: {
        id: `demo-friend-${cleaned}`,
        username: cleaned,
        displayName: cleaned
          .split(/[._-]+/)
          .filter(Boolean)
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join(' '),
      },
      favorites: [
        {
          id: `demo-fav-${cleaned}-movie-496243`,
          userId: `demo-friend-${cleaned}`,
          tmdbId: 496243,
          mediaType: 'movie',
          mediaId: 'movie-496243',
          title: 'Parasite',
          mediaSnapshot: CATALOG_ITEMS.find((m) => m.id === 'movie-496243'),
          createdAt: new Date().toISOString(),
        },
        {
          id: `demo-fav-${cleaned}-tv-87108`,
          userId: `demo-friend-${cleaned}`,
          tmdbId: 87108,
          mediaType: 'tv',
          mediaId: 'tv-87108',
          title: 'Chernobyl',
          mediaSnapshot: CATALOG_ITEMS.find((m) => m.id === 'tv-87108'),
          createdAt: new Date().toISOString(),
        },
      ],
      ratings: [],
      createdAt: new Date().toISOString(),
    };

    setAppState((prev) => ({
      ...prev,
      demoConnections: [nextConn, ...(prev.demoConnections ?? createInitialDemoConnections())],
    }));
    setSelectedFriendId(nextConn.id);
  };

  const handleAcceptFriendRequest = async (connectionId: string) => {
    if (!appState.profile) return;
    if (isUsingSupabaseSession) {
      await acceptFriendRequestSupabase(connectionId);
      await refreshSupabaseSocial(appState.profile.id);
      setSelectedFriendId(connectionId);
      return;
    }

    setAppState((prev) => ({
      ...prev,
      demoConnections: (prev.demoConnections ?? createInitialDemoConnections()).map((c) =>
        c.id === connectionId ? { ...c, status: 'accepted' } : c
      ),
    }));
    setSelectedFriendId(connectionId);
  };

  const handleRemoveConnection = async (connectionId: string) => {
    if (!appState.profile) return;
    if (isUsingSupabaseSession) {
      await removeFriendshipSupabase(connectionId);
      await refreshSupabaseSocial(appState.profile.id);
      if (selectedFriendId === connectionId) setSelectedFriendId(null);
      return;
    }

    setAppState((prev) => ({
      ...prev,
      demoConnections: (prev.demoConnections ?? createInitialDemoConnections()).filter(
        (c) => c.id !== connectionId
      ),
      demoWatchlist: (prev.demoWatchlist ?? createInitialDemoWatchlist()).filter(
        (w) => w.friendshipId !== connectionId
      ),
    }));
    if (selectedFriendId === connectionId) setSelectedFriendId(null);
  };

  const handleAddToSharedWatchlist = async (connectionId: string, media: MediaItem) => {
    if (!appState.profile) return;
    const userId = appState.profile.id;
    const userName = appState.profile.displayName;
    if (isUsingSupabaseSession) {
      await addSharedWatchlistItemSupabase(connectionId, userId, media);
      await refreshSupabaseSocial(userId);
      return;
    }

    setAppState((prev) => {
      const current = prev.demoWatchlist ?? createInitialDemoWatchlist();
      if (current.some((w) => w.friendshipId === connectionId && w.mediaId === media.id)) {
        return prev;
      }
      const nextItem: SharedWatchlistItem = {
        id: `demo-wl-${connectionId}-${media.id}`,
        friendshipId: connectionId,
        tmdbId: media.tmdbId,
        mediaType: media.mediaType,
        mediaId: media.id,
        title: media.title,
        posterUrl: media.posterUrl,
        mediaSnapshot: media,
        addedByUserId: userId,
        addedByName: userName,
        watched: false,
        createdAt: new Date().toISOString(),
      };
      return {
        ...prev,
        demoWatchlist: [nextItem, ...current],
      };
    });
  };

  const handleToggleWatchlistWatched = async (itemId: string, watched: boolean) => {
    if (!appState.profile) return;
    if (isUsingSupabaseSession) {
      await toggleSharedWatchlistWatchedSupabase(itemId, watched);
      await refreshSupabaseSocial(appState.profile.id);
      return;
    }

    setAppState((prev) => ({
      ...prev,
      demoWatchlist: (prev.demoWatchlist ?? createInitialDemoWatchlist()).map((w) =>
        w.id === itemId ? { ...w, watched } : w
      ),
    }));
  };

  const handleRemoveWatchlistItem = async (itemId: string) => {
    if (!appState.profile) return;
    if (isUsingSupabaseSession) {
      await removeSharedWatchlistItemSupabase(itemId);
      await refreshSupabaseSocial(appState.profile.id);
      return;
    }

    setAppState((prev) => ({
      ...prev,
      demoWatchlist: (prev.demoWatchlist ?? createInitialDemoWatchlist()).filter(
        (w) => w.id !== itemId
      ),
    }));
  };

  const handleSignOut = () => {
    setSelectedMedia(null);
    setSyncError(null);
    setSupabaseConnections([]);
    setSupabaseWatchlist([]);
    setSocialMigrationMissing(false);
    setSelectedFriendId(null);
    if (isUsingSupabaseSession) {
      signOutSupabase().catch(() => {});
    }
    clearPersistedState();
    setAppState({
      profile: null,
      favorites: [],
      ratings: [],
      shownRecommendationIds: [],
    });
  };

  const handleDeleteAccount = async () => {
    if (isUsingSupabaseSession) {
      await deleteAccountSupabase();
    }
    setSelectedMedia(null);
    setSyncError(null);
    setSupabaseConnections([]);
    setSupabaseWatchlist([]);
    setSocialMigrationMissing(false);
    setSelectedFriendId(null);
    clearPersistedState();
    setAppState({
      profile: null,
      favorites: [],
      ratings: [],
      shownRecommendationIds: [],
    });
  };

  const passwordRecoveryModal = (
    <PasswordRecoveryModal
      isOpen={showPasswordRecovery}
      onSavePassword={updatePasswordSupabase}
      onClose={() => {
        setShowPasswordRecovery(false);
        if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }}
    />
  );

  // Route Guard 1: Unauthenticated -> Auth Page
  if (!appState.profile) {
    return (
      <>
        <AuthPage
          onLogin={handleLogin}
          onRegister={handleRegister}
          onResetPassword={handleResetPassword}
          onDemoLogin={handleDemoLogin}
        />
        {passwordRecoveryModal}
      </>
    );
  }

  // Route Guard 2: Authenticated, Onboarding incomplete -> Onboarding Page
  if (!appState.profile.onboardingCompleted) {
    return (
      <>
        <OnboardingPage
          displayName={appState.profile.displayName}
          favorites={appState.favorites}
          knownCatalog={mergedCatalog}
          onToggleFavorite={handleToggleFavorite}
          onComplete={handleCompleteOnboarding}
          onCatalogExpand={expandCatalogPool}
        />
        {passwordRecoveryModal}
      </>
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
        pendingRequestsCount={pendingRequestsCount}
        onNavigate={handleNavigate}
      />

      <main className="mx-auto w-full max-w-7xl flex-1 px-4 pt-6 pb-8 sm:px-6 sm:pt-8 lg:px-8">
        {syncError && (
          <div
            role="alert"
            className="mb-6 flex items-center justify-between gap-4 rounded-xl border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-200"
          >
            <span>{syncError}</span>
            <button
              type="button"
              onClick={() => setSyncError(null)}
              className="shrink-0 rounded-md px-2.5 py-1 text-xs font-medium text-rose-100 hover:bg-rose-500/20"
            >
              Schließen
            </button>
          </div>
        )}
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

        {activeRoute === 'matches' && (
          <SocialMatchPage
            profile={appState.profile}
            isDemoMode={!isUsingSupabaseSession}
            catalog={mergedCatalog}
            userFavorites={appState.favorites}
            userRatings={appState.ratings}
            connections={activeConnections}
            watchlist={activeWatchlist}
            selectedFriendId={selectedFriendId}
            migrationMissing={socialMigrationMissing}
            isLoadingSocial={isLoadingSocial}
            onSelectFriend={setSelectedFriendId}
            onSendFriendRequest={handleSendFriendRequest}
            onAcceptFriendRequest={handleAcceptFriendRequest}
            onRemoveConnection={handleRemoveConnection}
            onAddToSharedWatchlist={handleAddToSharedWatchlist}
            onToggleWatchlistWatched={handleToggleWatchlistWatched}
            onRemoveWatchlistItem={handleRemoveWatchlistItem}
            onOpenDetail={setSelectedMedia}
            onFeedback={handleFeedback}
            onGoToDiscover={() => handleNavigate('discover')}
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

      {passwordRecoveryModal}
    </div>
  );
}
