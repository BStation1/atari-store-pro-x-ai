import { createClient } from '@supabase/supabase-js';
import { supabasePublishableKey, supabaseUrl } from './supabaseConfig';

export const authSupabase = createClient(
  supabaseUrl,
  supabasePublishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: 'atari_shared_auth_session_v1'
    }
  }
);
