import { createClient } from '@supabase/supabase-js';

// Access Supabase credentials from Vite environment variables safely
const metaEnv = ((import.meta as any).env || {}) as Record<string, string | undefined>;

const supabaseUrl =
  metaEnv.VITE_SUPABASE_URL ||
  metaEnv.VITE_SUPABASE_PROJECT_URL ||
  '';

const supabaseKey =
  metaEnv.VITE_SUPABASE_PUBLISHABLE_KEY ||
  metaEnv.VITE_SUPABASE_ANON_KEY ||
  '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseKey &&
  supabaseUrl !== 'https://placeholder.supabase.co' &&
  !supabaseUrl.includes('placeholder')
);

if (!isSupabaseConfigured) {
  console.warn(
    '⚠️ Supabase credentials missing! Please configure VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in Vercel Environment Variables.'
  );
}

// Create a singleton Supabase client
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseKey || 'placeholder_key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  }
);

/**
 * Utility function to test Supabase database connectivity.
 */
export async function testSupabaseConnection(): Promise<{ success: boolean; message: string; data?: any }> {
  try {
    if (!supabaseUrl || !supabaseKey) {
      return {
        success: false,
        message: 'Supabase credentials not configured in environment variables.',
      };
    }

    // Ping the store_settings table or categories table
    const { data, error } = await supabase.from('store_settings').select('company_name').limit(1);

    if (error) {
      console.warn('⚠️ Supabase connection issue:', error.message);
      return {
        success: false,
        message: `Connection failed: ${error.message}`,
      };
    }

    console.log('✅ Supabase Connected Successfully');
    return {
      success: true,
      message: 'Supabase Connected Successfully',
      data,
    };
  } catch (err: any) {
    console.warn('⚠️ Unexpected Supabase connection issue:', err);
    return {
      success: false,
      message: err?.message || 'Unknown connection error',
    };
  }
}

/**
 * Utility function to test RLS Auth RPC functions in Supabase.
 */
export async function testAuthRpcFunctions(): Promise<{
  role: any;
  roleError: any;
  isOwner: any;
  isOwnerError: any;
}> {
  try {
    const { data: role, error: roleError } = await supabase.rpc('get_auth_user_role');
    const { data: isOwner, error: isOwnerError } = await supabase.rpc('is_owner');

    console.log('------------------------------------------');
    console.log('🔐 [RPC Check] get_auth_user_role():', role, roleError ? roleError.message : '');
    console.log('🔐 [RPC Check] is_owner():', isOwner, isOwnerError ? isOwnerError.message : '');
    console.log('------------------------------------------');

    return { role, roleError, isOwner, isOwnerError };
  } catch (err) {
    console.warn('⚠️ Error calling RPC functions:', err);
    return { role: null, roleError: err, isOwner: null, isOwnerError: err };
  }
}
