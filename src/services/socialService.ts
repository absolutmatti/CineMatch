import { ensureSupabaseClient, supabase } from '../lib/supabase';
import type {
  FavoriteItem,
  FeedbackType,
  FriendConnection,
  FriendProfileSummary,
  MediaItem,
  SharedWatchlistItem,
  UserRating,
} from '../types/media';

export interface SocialWorkspaceResult {
  connections: FriendConnection[];
  watchlist: SharedWatchlistItem[];
  migrationMissing: boolean;
}

function isMissingRelationError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  const code = error.code ?? '';
  const msg = (error.message ?? '').toLowerCase();
  return (
    code === '42P01' ||
    code === '42883' ||
    code === 'PGRST205' ||
    code === 'PGRST202' ||
    msg.includes('does not exist') ||
    msg.includes('could not find the table') ||
    msg.includes('could not find the function')
  );
}

function mapDbFavoriteRow(row: Record<string, unknown>): FavoriteItem {
  const mediaType = row.media_type === 'tv' ? 'tv' : 'movie';
  const tmdbId = Number(row.tmdb_id);
  const metadata = row.metadata as MediaItem | undefined;
  return {
    id: String(row.id),
    userId: String(row.user_id),
    tmdbId,
    mediaType,
    mediaId: `${mediaType}-${tmdbId}`,
    title: String(row.title),
    posterUrl: row.poster_path ? String(row.poster_path) : undefined,
    mediaSnapshot: metadata && metadata.id ? metadata : undefined,
    createdAt: String(row.created_at || new Date().toISOString()),
  };
}

function mapDbRatingRow(row: Record<string, unknown>): UserRating {
  const mediaType = row.media_type === 'tv' ? 'tv' : 'movie';
  const tmdbId = Number(row.tmdb_id);
  const feedback: FeedbackType =
    row.feedback === 'dislike' || row.feedback === 'watched' ? row.feedback : 'like';
  return {
    id: String(row.id),
    userId: String(row.user_id),
    tmdbId,
    mediaType,
    mediaId: `${mediaType}-${tmdbId}`,
    feedback,
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

export async function loadSocialWorkspaceSupabase(
  currentUserId: string
): Promise<SocialWorkspaceResult> {
  const client = supabase ?? (await ensureSupabaseClient());
  if (!client) {
    return { connections: [], watchlist: [], migrationMissing: false };
  }

  const { data: friendshipRows, error: friendshipError } = await client
    .from('friendships')
    .select('*')
    .or(`requester_id.eq.${currentUserId},addressee_id.eq.${currentUserId}`)
    .order('created_at', { ascending: false });

  if (friendshipError) {
    if (isMissingRelationError(friendshipError)) {
      return { connections: [], watchlist: [], migrationMissing: true };
    }
    throw new Error('Freundesverbindungen konnten nicht geladen werden.');
  }

  const rows = Array.isArray(friendshipRows) ? friendshipRows : [];
  if (rows.length === 0) {
    return { connections: [], watchlist: [], migrationMissing: false };
  }

  const partnerIds = Array.from(
    new Set(
      rows.map((r) =>
        String(r.requester_id) === currentUserId ? String(r.addressee_id) : String(r.requester_id)
      )
    )
  );
  const acceptedPartnerIds = Array.from(
    new Set(
      rows
        .filter((r) => r.status === 'accepted')
        .map((r) =>
          String(r.requester_id) === currentUserId ? String(r.addressee_id) : String(r.requester_id)
        )
    )
  );
  const acceptedFriendshipIds = rows
    .filter((r) => r.status === 'accepted')
    .map((r) => String(r.id));

  const [profilesRes, favsRes, ratingsRes, watchlistRes] = await Promise.all([
    client.from('profiles').select('id, username, display_name, avatar_url').in('id', partnerIds),
    acceptedPartnerIds.length > 0
      ? client
          .from('favorites')
          .select('*')
          .in('user_id', acceptedPartnerIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
    acceptedPartnerIds.length > 0
      ? client.from('ratings').select('*').in('user_id', acceptedPartnerIds)
      : Promise.resolve({ data: [], error: null }),
    acceptedFriendshipIds.length > 0
      ? client
          .from('shared_watchlist_items')
          .select('*')
          .in('friendship_id', acceptedFriendshipIds)
          .order('created_at', { ascending: false })
      : Promise.resolve({ data: [], error: null }),
  ]);

  const profileMap = new Map<string, FriendProfileSummary>();
  for (const p of profilesRes.data ?? []) {
    profileMap.set(String(p.id), {
      id: String(p.id),
      username: String(p.username || 'cinephile'),
      displayName: String(p.display_name || 'Film-Fan'),
      avatarUrl: p.avatar_url ? String(p.avatar_url) : undefined,
    });
  }

  const favsByUser = new Map<string, FavoriteItem[]>();
  for (const row of favsRes.data ?? []) {
    const mapped = mapDbFavoriteRow(row as Record<string, unknown>);
    const list = favsByUser.get(mapped.userId) ?? [];
    list.push(mapped);
    favsByUser.set(mapped.userId, list);
  }

  const ratingsByUser = new Map<string, UserRating[]>();
  for (const row of ratingsRes.data ?? []) {
    const mapped = mapDbRatingRow(row as Record<string, unknown>);
    const list = ratingsByUser.get(mapped.userId) ?? [];
    list.push(mapped);
    ratingsByUser.set(mapped.userId, list);
  }

  const connections: FriendConnection[] = rows.map((row) => {
    const isRequester = String(row.requester_id) === currentUserId;
    const partnerId = isRequester ? String(row.addressee_id) : String(row.requester_id);
    const friend = profileMap.get(partnerId) ?? {
      id: partnerId,
      username: 'cinephile',
      displayName: 'CineMatch-Mitglied',
    };
    return {
      id: String(row.id),
      status: row.status === 'accepted' ? 'accepted' : 'pending',
      direction: isRequester ? 'outgoing' : 'incoming',
      friend,
      favorites: favsByUser.get(partnerId) ?? [],
      ratings: ratingsByUser.get(partnerId) ?? [],
      createdAt: String(row.created_at || new Date().toISOString()),
    };
  });

  const watchlist: SharedWatchlistItem[] = (watchlistRes.data ?? []).map((row) => {
    const mediaType = row.media_type === 'tv' ? 'tv' : 'movie';
    const tmdbId = Number(row.tmdb_id);
    const addedById = String(row.added_by);
    const metadata = row.metadata as MediaItem | undefined;
    const addedByName =
      addedById === currentUserId
        ? 'Dir'
        : profileMap.get(addedById)?.displayName ?? 'Freund:in';
    return {
      id: String(row.id),
      friendshipId: String(row.friendship_id),
      tmdbId,
      mediaType,
      mediaId: `${mediaType}-${tmdbId}`,
      title: String(row.title),
      posterUrl: row.poster_path ? String(row.poster_path) : undefined,
      mediaSnapshot: metadata && metadata.id ? metadata : undefined,
      addedByUserId: addedById,
      addedByName,
      watched: Boolean(row.watched),
      createdAt: String(row.created_at || new Date().toISOString()),
    };
  });

  return { connections, watchlist, migrationMissing: false };
}

export async function sendFriendRequestSupabase(targetUsername: string): Promise<void> {
  const client = supabase ?? (await ensureSupabaseClient());
  if (!client) throw new Error('SUPABASE_NOT_CONFIGURED');

  const { error } = await client.rpc('send_friend_request_by_username', {
    target_username: targetUsername,
  });

  if (error) {
    if (isMissingRelationError(error)) {
      throw new Error(
        'Die Datenbank-Erweiterung für Duo-Match (003_social_matching.sql) wurde in Supabase noch nicht ausgeführt.'
      );
    }
    const msg = error.message.toUpperCase();
    if (msg.includes('USER_NOT_FOUND')) {
      throw new Error('Kein Konto mit diesem Benutzernamen gefunden.');
    }
    if (msg.includes('CANNOT_ADD_SELF')) {
      throw new Error('Du kannst dich nicht selbst als Freund hinzufügen.');
    }
    if (msg.includes('FRIENDSHIP_ALREADY_EXISTS')) {
      throw new Error('Zwischen euch besteht bereits eine Verbindung oder Anfrage.');
    }
    if (msg.includes('INVALID_USERNAME')) {
      throw new Error('Bitte gib einen gültigen Benutzernamen (mindestens 2 Zeichen) ein.');
    }
    throw new Error('Freundschaftsanfrage konnte nicht gesendet werden.');
  }
}

export async function acceptFriendRequestSupabase(friendshipId: string): Promise<void> {
  const client = supabase ?? (await ensureSupabaseClient());
  if (!client) return;
  const { error } = await client
    .from('friendships')
    .update({ status: 'accepted' })
    .eq('id', friendshipId);
  if (error) throw new Error('Anfrage konnte nicht angenommen werden.');
}

export async function removeFriendshipSupabase(friendshipId: string): Promise<void> {
  const client = supabase ?? (await ensureSupabaseClient());
  if (!client) return;
  const { error } = await client.from('friendships').delete().eq('id', friendshipId);
  if (error) throw new Error('Verbindung konnte nicht entfernt werden.');
}

export async function addSharedWatchlistItemSupabase(
  friendshipId: string,
  userId: string,
  media: MediaItem
): Promise<void> {
  const client = supabase ?? (await ensureSupabaseClient());
  if (!client) return;
  const { error } = await client.from('shared_watchlist_items').upsert(
    {
      friendship_id: friendshipId,
      added_by: userId,
      tmdb_id: media.tmdbId,
      media_type: media.mediaType,
      title: media.title,
      poster_path: media.posterUrl ?? null,
      metadata: media,
    },
    { onConflict: 'friendship_id,tmdb_id,media_type' }
  );
  if (error) throw new Error('Titel konnte nicht auf die gemeinsame Watchlist gesetzt werden.');
}

export async function toggleSharedWatchlistWatchedSupabase(
  itemId: string,
  watched: boolean
): Promise<void> {
  const client = supabase ?? (await ensureSupabaseClient());
  if (!client) return;
  const { error } = await client
    .from('shared_watchlist_items')
    .update({ watched })
    .eq('id', itemId);
  if (error) throw new Error('Watchlist-Status konnte nicht aktualisiert werden.');
}

export async function removeSharedWatchlistItemSupabase(itemId: string): Promise<void> {
  const client = supabase ?? (await ensureSupabaseClient());
  if (!client) return;
  const { error } = await client.from('shared_watchlist_items').delete().eq('id', itemId);
  if (error) throw new Error('Titel konnte nicht von der Watchlist entfernt werden.');
}
