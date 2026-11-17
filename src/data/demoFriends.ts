import { CATALOG_ITEMS } from './catalog';
import type {
  FavoriteItem,
  FriendConnection,
  MediaItem,
  SharedWatchlistItem,
  UserRating,
} from '../types/media';

function makeDemoFavorite(userId: string, mediaId: string): FavoriteItem | null {
  const item = CATALOG_ITEMS.find((m) => m.id === mediaId);
  if (!item) return null;
  return {
    id: `demo-fav-${userId}-${item.id}`,
    userId,
    tmdbId: item.tmdbId,
    mediaType: item.mediaType,
    mediaId: item.id,
    title: item.title,
    posterUrl: item.posterUrl,
    mediaSnapshot: item,
    createdAt: '2026-10-15T18:00:00.000Z',
  };
}

function makeDemoRating(
  userId: string,
  mediaId: string,
  feedback: 'like' | 'dislike' | 'watched'
): UserRating | null {
  const item = CATALOG_ITEMS.find((m) => m.id === mediaId);
  if (!item) return null;
  return {
    id: `demo-rat-${userId}-${item.id}`,
    userId,
    tmdbId: item.tmdbId,
    mediaType: item.mediaType,
    mediaId: item.id,
    feedback,
    createdAt: '2026-10-16T18:00:00.000Z',
    updatedAt: '2026-10-16T18:00:00.000Z',
  };
}

function collectFavorites(userId: string, mediaIds: string[]): FavoriteItem[] {
  return mediaIds
    .map((id) => makeDemoFavorite(userId, id))
    .filter((f): f is FavoriteItem => Boolean(f));
}

export function createInitialDemoConnections(): FriendConnection[] {
  const lenaWatched = makeDemoRating('demo-friend-lena', 'movie-155', 'watched');
  return [
    {
      id: 'demo-conn-lena',
      status: 'accepted',
      direction: 'demo',
      friend: {
        id: 'demo-friend-lena',
        username: 'lena.bergmann',
        displayName: 'Lena Bergmann',
      },
      favorites: collectFavorites('demo-friend-lena', [
        'movie-146233', // Prisoners
        'movie-496243', // Parasite
        'tv-46648',     // True Detective
        'tv-87108',     // Chernobyl
        'movie-329865', // Arrival (shared with default demo profile)
      ]),
      ratings: lenaWatched ? [lenaWatched] : [],
      createdAt: '2026-10-20T12:00:00.000Z',
    },
    {
      id: 'demo-conn-maya',
      status: 'pending',
      direction: 'incoming',
      friend: {
        id: 'demo-friend-maya',
        username: 'maya.lindner',
        displayName: 'Maya Lindner',
      },
      favorites: collectFavorites('demo-friend-maya', [
        'movie-666277', // Past Lives
        'movie-545611', // Everything Everywhere All at Once
        'movie-264660', // Ex Machina
        'tv-95396',     // Severance
      ]),
      ratings: [],
      createdAt: '2026-11-10T15:30:00.000Z',
    },
  ];
}

export function createInitialDemoWatchlist(): SharedWatchlistItem[] {
  const exMachina: MediaItem | undefined = CATALOG_ITEMS.find((m) => m.id === 'movie-264660');
  if (!exMachina) return [];
  return [
    {
      id: 'demo-wl-lena-exmachina',
      friendshipId: 'demo-conn-lena',
      tmdbId: exMachina.tmdbId,
      mediaType: exMachina.mediaType,
      mediaId: exMachina.id,
      title: exMachina.title,
      posterUrl: exMachina.posterUrl,
      mediaSnapshot: exMachina,
      addedByUserId: 'demo-friend-lena',
      addedByName: 'Lena Bergmann',
      watched: false,
      createdAt: '2026-11-12T19:00:00.000Z',
    },
  ];
}

export const DEMO_DIRECTORY_PROFILES: FriendConnection[] = [
  {
    id: 'demo-conn-tom',
    status: 'accepted',
    direction: 'outgoing',
    friend: {
      id: 'demo-friend-tom',
      username: 'tom.richter',
      displayName: 'Tom Richter',
    },
    favorites: collectFavorites('demo-friend-tom', [
      'movie-335984', // Blade Runner 2049
      'movie-693134', // Dune: Part Two
      'tv-83867',     // Andor
      'tv-100088',    // The Last of Us
    ]),
    ratings: [],
    createdAt: new Date().toISOString(),
  },
];
