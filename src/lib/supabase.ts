import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
// Prefer Supabase's new publishable key (sb_publishable_...); keep VITE_SUPABASE_ANON_KEY fallback during transition
const supabasePublishableKey = (
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
)?.trim();

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
    supabasePublishableKey &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('YOUR_PROJECT_ID') &&
    !supabasePublishableKey.includes('YOUR_PUBLISHABLE_KEY') &&
    !supabasePublishableKey.startsWith('sb_secret_')
);

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabasePublishableKey!, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
      },
    })
  : null;
