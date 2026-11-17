import { isSupabaseConfigured, supabase } from '../lib/supabase';
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
  if (!supabase || !isSupabaseConfigured) return null;

  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.user) return null;

  const user = session.user;
  const email = user.email ?? '';

  const [profileRes, favRes, ratingRes] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('favorites').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('ratings').select('*').eq('user_id', user.id),
  ]);

  if (profileRes.error || !profileRes.data) {
    return null;
  }

  return {
    profile: mapDbProfile(profileRes.data, email),
    favorites: Array.isArray(favRes.data) ? favRes.data.map(mapDbFavorite) : [],
    ratings: Array.isArray(ratingRes.data) ? ratingRes.data.map(mapDbRating) : [],
  };
}

export async function signInSupabase(email: string, password: string): Promise<AuthResult> {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');

  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    throw new Error(translateSupabaseError(error.message));
  }

  const workspace = await loadSupabaseWorkspace();
  if (!workspace) {
    throw new Error('Profil konnte nicht geladen werden.');
  }
  return workspace;
}

export async function signUpSupabase(
  displayName: string,
  email: string,
  password: string
): Promise<{ workspace: AuthResult | null; requiresEmailConfirmation: boolean }> {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
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
  if (!supabase) return;
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin,
  });
  if (error) {
    throw new Error(translateSupabaseError(error.message));
  }
}

export async function signOutSupabase(): Promise<void> {
  if (!supabase) return;
  await supabase.auth.signOut();
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
  if (!supabase) return;
  const payload: Record<string, unknown> = {};
  if (updates.displayName !== undefined) payload.display_name = updates.displayName;
  if (updates.username !== undefined) payload.username = updates.username;
  if (updates.preferredMediaType !== undefined) {
    payload.preferred_media_type = updates.preferredMediaType;
  }
  if (updates.onboardingCompleted !== undefined) {
    payload.onboarding_completed = updates.onboardingCompleted;
  }

  const { error } = await supabase.from('profiles').update(payload).eq('id', userId);
  if (error) {
    throw new Error('Profiländerungen konnten nicht gespeichert werden.');
  }
}

export async function toggleFavoriteSupabase(
  userId: string,
  media: MediaItem,
  currentlyFavorite: boolean
): Promise<void> {
  if (!supabase) return;

  if (currentlyFavorite) {
    const { error } = await supabase
      .from('favorites')
      .delete()
      .eq('user_id', userId)
      .eq('tmdb_id', media.tmdbId)
      .eq('media_type', media.mediaType);
    if (error) throw new Error('Favorit konnte nicht entfernt werden.');
    return;
  }

  const { error } = await supabase.from('favorites').upsert(
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
  if (!supabase) return;

  await supabase
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
  if (!supabase) return;

  if (!feedback) {
    const { error } = await supabase
      .from('ratings')
      .delete()
      .eq('user_id', userId)
      .eq('tmdb_id', media.tmdbId)
      .eq('media_type', media.mediaType);
    if (error) throw new Error('Bewertung konnte nicht zurückgesetzt werden.');
    return;
  }

  const numericRating = feedback === 'like' ? 1 : feedback === 'dislike' ? -1 : 0;
  const { error } = await supabase.from('ratings').upsert(
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
  if (!supabase || recs.length === 0) return;

  const rows = recs.slice(0, 12).map((rec) => ({
    user_id: userId,
    tmdb_id: rec.media.tmdbId,
    media_type: rec.media.mediaType,
    recommendation_score: rec.score,
    reason: rec.reason,
    last_shown_at: new Date().toISOString(),
  }));

  await supabase
    .from('recommendations')
    .upsert(rows, { onConflict: 'user_id,tmdb_id,media_type' });
}

export async function deleteAccountSupabase(): Promise<void> {
  if (!supabase) return;
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) return;

  const res = await fetch(`${API_BASE}/api/account/delete`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${session.access_token}`,
    },
  });

  if (!res.ok) {
    throw new Error('Kontolöschung konnte serverseitig nicht abgeschlossen werden.');
  }

  await supabase.auth.signOut();
}
