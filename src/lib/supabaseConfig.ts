const metaEnv = ((typeof import.meta !== 'undefined' && (import.meta as any).env) || {}) as Record<string, string | undefined>;

export const DEFAULT_SUPABASE_URL = 'https://snwizwgmgwxiotrfmkzm.supabase.co';
export const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_XltOYCOplUoZI3RiHlWB9w_H9YF-S5q';

// Vite replaces these values at build time. Keep the public fallback so an
// accidental missing Vercel variable cannot reconnect the app to an old project.
export const supabaseUrl =
  metaEnv.VITE_SUPABASE_URL ||
  metaEnv.VITE_SUPABASE_PROJECT_URL ||
  metaEnv.NEXT_PUBLIC_SUPABASE_URL ||
  DEFAULT_SUPABASE_URL;

export const supabasePublishableKey =
  metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
  metaEnv.VITE_SUPABASE_ANON_KEY ||
  metaEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  metaEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabasePublishableKey &&
  /^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(supabaseUrl) &&
  !supabaseUrl.includes('placeholder')
);
