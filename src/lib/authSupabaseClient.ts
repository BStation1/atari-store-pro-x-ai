import { createClient } from '@supabase/supabase-js';

const AUTH_SUPABASE_URL = 'https://voxwlxzubuibuomkoofs.supabase.co';
const AUTH_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_5L3Rw21W0BCO7zWtWkWYNg_PlIh2045';

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
