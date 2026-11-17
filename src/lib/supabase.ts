import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, '') ?? '';

function isValidSupabaseConfig(
  url: string | null | undefined,
  key: string | null | undefined
): url is string {
  return Boolean(
    url &&
      key &&
      url.startsWith('http') &&
      !url.includes('YOUR_PROJECT_ID') &&
      !key.includes('YOUR_PUBLISHABLE_KEY') &&
      !key.startsWith('sb_secret_')
  );
}

function buildClient(url: string, key: string): SupabaseClient {
  return createClient(url, key, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  });
}

const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
// Prefer Supabase's new publishable key (sb_publishable_...); keep VITE_SUPABASE_ANON_KEY fallback during transition
const envPublishableKey = (
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
)?.trim();

export let isSupabaseConfigured = isValidSupabaseConfig(envUrl, envPublishableKey);
export let supabase: SupabaseClient | null = isSupabaseConfigured
  ? buildClient(envUrl!, envPublishableKey!)
  : null;

let pendingInit: Promise<SupabaseClient | null> | null = null;

/**
 * Ensures the Supabase client is available even when VITE_* env vars were not baked
 * into a static production bundle and are instead provided by the Express runtime.
 */
export async function ensureSupabaseClient(): Promise<SupabaseClient | null> {
  if (supabase && isSupabaseConfigured) {
    return supabase;
  }
  if (pendingInit) {
    return pendingInit;
  }

  pendingInit = (async () => {
    try {
      const res = await fetch(`${API_BASE}/api/public-config`);
      if (!res.ok) return null;
      const data = (await res.json()) as {
        supabaseUrl?: string | null;
        supabasePublishableKey?: string | null;
      };
      const url = data.supabaseUrl?.trim();
      const key = data.supabasePublishableKey?.trim();
      if (isValidSupabaseConfig(url, key) && key) {
        supabase = buildClient(url, key);
        isSupabaseConfigured = true;
        return supabase;
      }
      return null;
    } catch {
      return null;
    } finally {
      pendingInit = null;
    }
  })();

  return pendingInit;
}
