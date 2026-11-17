import { ensureSupabaseClient, supabase } from '../lib/supabase';
import type {
  FavoriteItem,
  FeedbackType,
  MediaItem,
  MediaType,
  RecommendationResult,
  UserProfile,
  UserRating,
} from '../types/media';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

export interface AuthResult {
  profile: UserProfile;
  favorites: FavoriteItem[];
  ratings: UserRating[];
  requiresEmailConfirmation?: boolean;
}

function translateSupabaseError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes('invalid login credentials')) {
    return 'E-Mail-Adresse oder Passwort ist nicht korrekt.';
  }
  if (lower.includes('email not confirmed')) {
    return 'Bitte bestätige zuerst deine E-Mail-Adresse über den zugesandten Link.';
  }
  if (lower.includes('user already registered')) {
    return 'Für diese E-Mail-Adresse existiert bereits ein Konto.';
  }
  if (lower.includes('password should be at least')) {
    return 'Das Passwort erfüllt nicht die Mindestanforderungen.';
  }
  return 'Die Aktion konnte nicht abgeschlossen werden. Bitte versuche es erneut.';
}

function mapDbProfile(row: Record<string, unknown>, email: string): UserProfile {
  return {
    id: String(row.id),
    username: String(row.username || 'cinephile'),
    displayName: String(row.display_name || 'Film-Fan'),
    email,
    avatarUrl: row.avatar_url ? String(row.avatar_url) : undefined,
    onboardingCompleted: Boolean(row.onboarding_completed),
    preferredMediaType:
      row.preferred_media_type === 'movie' || row.preferred_media_type === 'tv'
        ? row.preferred_media_type
        : 'all',
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
  };
}

function mapDbFavorite(row: Record<string, unknown>): FavoriteItem {
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

function mapDbRating(row: Record<string, unknown>): UserRating {
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

export async function loadSupabaseWorkspace(): Promise<AuthResult | null> {
  const client = supabase ?? (await ensureSupabaseClient());
  if (!client) return null;

  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session?.user) return null;

  const user = session.user;
  const email = user.email ?? '';

  const [profileRes, favRes, ratingRes] = await Promise.all([
    client.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    client.from('favorites').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    client.from('ratings').select('*').eq('user_id', user.id),
  ]);

  let profileRow = profileRes.data;

  // Self-heal missing profile row (e.g. account created before initial SQL migration)
  if (!profileRow) {
    const rawName =
      (user.user_metadata?.display_name as string | undefined) ||
      email.split('@')[0] ||
      'Cinephile';
    const cleanUsername =
      rawName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '.')
        .replace(/^\.+|\.+$/g, '') || 'user';
    const generatedUsername = `${cleanUsername}.${user.id.slice(0, 6)}`;

    const { data: createdProfile, error: upsertError } = await client
      .from('profiles')
      .upsert(
        {
          id: user.id,
          username: generatedUsername,
          display_name: rawName,
          onboarding_completed: false,
        },
        { onConflict: 'id' }
      )
      .select('*')
      .single();

    if (upsertError || !createdProfile) {
      return null;
    }
    profileRow = createdProfile;
  }

  return {
    profile: mapDbProfile(profileRow, email),
    favorites: Array.isArray(favRes.data) ? favRes.data.map(mapDbFavorite) : [],
    ratings: Array.isArray(ratingRes.data) ? ratingRes.data.map(mapDbRating) : [],
  };
}

export async function signInSupabase(email: string, password: string): Promise<AuthResult> {
  const client = supabase ?? (await ensureSupabaseClient());
  if (!client) throw new Error('SUPABASE_NOT_CONFIGURED');

  const { error } = await client.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(translateSupabaseError(error.message));
  }

  const workspace = await loadSupabaseWorkspace();
  if (!workspace) {
    throw new Error('Profil konnte nicht geladen werden.');
  }
  return workspace;
}

function getAuthRedirectUrl(): string {
  const basePath = import.meta.env.BASE_URL || '/';
  return new URL(basePath, window.location.origin).toString();
}

export async function signUpSupabase(
  displayName: string,
  email: string,
  password: string
): Promise<{ workspace: AuthResult | null; requiresEmailConfirmation: boolean }> {
  const client = supabase ?? (await ensureSupabaseClient());
  if (!client) throw new Error('SUPABASE_NOT_CONFIGURED');

  const { data, error } = await client.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
      emailRedirectTo: getAuthRedirectUrl(),
    },
  });

  if (error) {
    throw new Error(translateSupabaseError(error.message));
  }

  if (!data.session) {
    return { workspace: null, requiresEmailConfirmation: true };
  }

  const workspace = await loadSupabaseWorkspace();
  return { workspace, requiresEmailConfirmation: false };
}

export async function resetPasswordSupabase(email: string): Promise<void> {
  const client = supabase ?? (await ensureSupabaseClient());
  if (!client) return;
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: getAuthRedirectUrl(),
  });
  if (error) {
    throw new Error(translateSupabaseError(error.message));
  }
}

export async function updatePasswordSupabase(newPassword: string): Promise<void> {
  const client = supabase ?? (await ensureSupabaseClient());
  if (!client) throw new Error('SUPABASE_NOT_CONFIGURED');
  const { error } = await client.auth.updateUser({ password: newPassword });
  if (error) {
    const lower = error.message.toLowerCase();
    if (lower.includes('different from the old password') || lower.includes('same password')) {
      throw new Error('Das neue Passwort muss sich vom bisherigen Passwort unterscheiden.');
    }
    throw new Error(translateSupabaseError(error.message));
  }
}

export async function signOutSupabase(): Promise<void> {
  const client = supabase ?? (await ensureSupabaseClient());
  if (!client) return;
  await client.auth.signOut();
}

export async function updateProfileSupabase(
  userId: string,
  updates: {
    displayName?: string;
    username?: string;
    preferredMediaType?: 'all' | MediaType;
    onboardingCompleted?: boolean;
  }
): Promise<void> {
  const client = supabase ?? (await ensureSupabaseClient());
  if (!client) return;
  const payload: Record<string, unknown> = {};
  if (updates.displayName !== undefined) payload.display_name = updates.displayName;
  if (updates.username !== undefined) payload.username = updates.username;
  if (updates.preferredMediaType !== undefined) {
    payload.preferred_media_type = updates.preferredMediaType;
  }
  if (updates.onboardingCompleted !== undefined) {
    payload.onboarding_completed = updates.onboardingCompleted;
  }

  const { error } = await client.from('profiles').update(payload).eq('id', userId);
  if (error) {
    throw new Error('Profiländerungen konnten nicht gespeichert werden.');
  }
}

export async function toggleFavoriteSupabase(
  userId: string,
  media: MediaItem,
  currentlyFavorite: boolean
): Promise<void> {
  const client = supabase ?? (await ensureSupabaseClient());
  if (!client) return;

  if (currentlyFavorite) {
    const { error } = await client
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('tmdb_id', media.tmdbId)
      .eq('media_type', media.mediaType);
    if (error) throw new Error('Favorit konnte nicht entfernt werden.');
    return;
  }

  const { error } = await client.from('favorites').upsert(
    {
      user_id: userId,
      tmdb_id: media.tmdbId,
      media_type: media.mediaType,
      title: media.title,
      poster_path: media.posterUrl ?? null,
      metadata: media,
    },
    { onConflict: 'user_id,tmdb_id,media_type' }
  );
  if (error) throw new Error('Favorit konnte nicht gespeichert werden.');
}

export async function updateFavoriteSnapshotSupabase(
  userId: string,
  media: MediaItem
): Promise<void> {
  const client = supabase ?? (await ensureSupabaseClient());
  if (!client) return;

  await client
    .from('favorites')
    .update({
      title: media.title,
      poster_path: media.posterUrl ?? null,
      metadata: media,
    })
    .eq('user_id', userId)
    .eq('tmdb_id', media.tmdbId)
    .eq('media_type', media.mediaType);
}

export async function saveFeedbackSupabase(
  userId: string,
  media: MediaItem,
  feedback: FeedbackType | null
): Promise<void> {
  const client = supabase ?? (await ensureSupabaseClient());
  if (!client) return;

  if (!feedback) {
    const { error } = await client
      .from('ratings')
      .delete()
      .eq('user_id', userId)
      .eq('tmdb_id', media.tmdbId)
      .eq('media_type', media.mediaType);
    if (error) throw new Error('Bewertung konnte nicht zurückgesetzt werden.');
    return;
  }

  const numericRating = feedback === 'like' ? 1 : feedback === 'dislike' ? -1 : 0;
  const { error } = await client.from('ratings').upsert(
    {
      user_id: userId,
      tmdb_id: media.tmdbId,
      media_type: media.mediaType,
      rating: numericRating,
      feedback,
    },
    { onConflict: 'user_id,tmdb_id,media_type' }
  );
  if (error) throw new Error('Bewertung konnte nicht gespeichert werden.');
}

export async function syncRecommendationsSupabase(
  userId: string,
  recs: RecommendationResult[]
): Promise<void> {
  const client = supabase ?? (await ensureSupabaseClient());
  if (!client || recs.length === 0) return;

  const rows = recs.slice(0, 12).map((rec) => ({
    user_id: userId,
    tmdb_id: rec.media.tmdbId,
    media_type: rec.media.mediaType,
    recommendation_score: rec.score,
    reason: rec.reason,
    last_shown_at: new Date().toISOString(),
  }));

  await client
    .from('recommendations')
    .upsert(rows, { onConflict: 'user_id,tmdb_id,media_type' });
}

export async function deleteAccountSupabase(): Promise<void> {
  const client = supabase ?? (await ensureSupabaseClient());
  if (!client) return;
  const {
    data: { session },
  } = await client.auth.getSession();
  if (!session?.access_token) return;

  const res = await fetch(`${API_BASE}/api/account/delete`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (!res.ok) {
    let serverMessage = 'Kontolöschung konnte serverseitig nicht abgeschlossen werden.';
    try {
      const payload = (await res.json()) as { message?: string };
      if (payload.message) serverMessage = payload.message;
    } catch {
      // Keep default German message
    }
    throw new Error(serverMessage);
  }

  await client.auth.signOut();
}
