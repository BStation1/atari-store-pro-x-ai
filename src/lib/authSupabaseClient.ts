// Keep authentication and database operations on the exact same Supabase client.
// Creating a second createClient() instance in the browser caused the GoTrue warning:
// "Multiple GoTrueClient instances detected in the same browser context".
// A single client also prevents competing session refresh/storage listeners.
export { supabase as authSupabase } from './supabaseClient';
