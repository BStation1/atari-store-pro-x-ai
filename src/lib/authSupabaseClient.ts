import { createClient } from '@supabase/supabase-js';

const AUTH_SUPABASE_URL = 'https://snwizwgmgwxiotrfmkzm.supabase.co';
const AUTH_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_XltOYCOplUoZI3RiHlWB9w_H9YF-S5q';

export const authSupabase = createClient(
  AUTH_SUPABASE_URL,
  AUTH_SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'atari_shared_auth_session_v1'
    }
  }
);
