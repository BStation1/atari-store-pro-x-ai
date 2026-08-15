import { isSupabaseConfigured, supabase } from './supabaseClient';
import { mapRowToRepairOrder, saveLocalRepairOrdersBackup } from './supabaseRepairOrders';
import { authStore, AuthUser } from './authStore';
import { ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS, UserRole } from './authPermissions';

const BOOTSTRAP_SYNC_KEY = 'atari_repair_orders_authoritative_sync_at';

function mapProfileToAuthUser(p: any): AuthUser {
  const rawRole = String(p.role || 'RECEPTION').toUpperCase();
  const roleId: UserRole = rawRole === 'OWNER' ? 'OWNER' : rawRole === 'ADMIN' ? 'ADMIN' : rawRole === 'ENGINEER' || rawRole === 'TECHNICIAN' ? 'TECHNICIAN' : 'RECEPTION';
  const now = new Date().toISOString();
  return {
    id: p.id,
    fullName: p.full_name || p.email || 'مستخدم',
    name: p.full_name || p.email || 'مستخدم',
    username: p.username || String(p.email || 'user').split('@')[0],
    email: p.email || '',
    phone: p.phone || '',
    branch: p.branch || 'الفرع الرئيسي',
    roleId,
    role: roleId === 'OWNER' || roleId === 'ADMIN' ? 'admin' : roleId === 'TECHNICIAN' ? 'technician' : 'receptionist',
    permissions: roleId === 'OWNER' ? ALL_PERMISSIONS : (Array.isArray(p.permissions) && p.permissions.length ? p.permissions : [...(DEFAULT_ROLE_PERMISSIONS[roleId] || [])]),
    isActive: p.is_active !== false,
    mustChangePassword: p.must_change_password === true,
    lastLoginAt: p.last_login_at || undefined,
    createdAt: p.created_at || now,
    updatedAt: p.updated_at || now,
    avatarUrl: p.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80'
  };
}

/**
 * Refresh browser caches from Supabase before React mounts.
 * Supabase is the source of truth; localStorage is only an offline cache.
 * Remote snapshots REPLACE local snapshots so ghost data cannot survive per browser.
 */
export async function bootstrapAuthoritativeSync(): Promise<void> {
  if (typeof window === 'undefined' || !isSupabaseConfigured) return;

  try {
    const [ordersResult, profilesResult] = await Promise.all([
      supabase.from('repair_orders').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('*').order('created_at', { ascending: true })
    ]);

    if (!ordersResult.error) {
      const remoteOrders = (ordersResult.data || []).map(mapRowToRepairOrder);
      saveLocalRepairOrdersBackup(remoteOrders, false);
      console.log(`[AuthoritativeSync] Repair orders synchronized from Supabase: ${remoteOrders.length}`);
    } else {
      console.warn('[AuthoritativeSync] Supabase repair orders unavailable; keeping offline cache:', ordersResult.error.message);
    }

    if (!profilesResult.error) {
      const remoteUsers = (profilesResult.data || []).map(mapProfileToAuthUser);
      // IMPORTANT: replace, never merge. This removes browser-only/ghost users.
      authStore.saveUsers(remoteUsers);
      console.log(`[AuthoritativeSync] Users synchronized from Supabase: ${remoteUsers.length}`);
    } else {
      console.warn('[AuthoritativeSync] Supabase profiles unavailable; keeping offline user cache:', profilesResult.error.message);
    }

    sessionStorage.setItem(BOOTSTRAP_SYNC_KEY, String(Date.now()));
  } catch (error) {
    console.warn('[AuthoritativeSync] Failed; keeping offline caches:', error);
  }
}

export function wasRepairOrdersBootstrappedRecently(maxAgeMs = 60_000): boolean {
  if (typeof sessionStorage === 'undefined') return false;
  const value = Number(sessionStorage.getItem(BOOTSTRAP_SYNC_KEY) || 0);
  return value > 0 && Date.now() - value < maxAgeMs;
}
