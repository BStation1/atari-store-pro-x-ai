import { authStore } from './authStore';

const OWNER_TRUE_CACHE_TTL_MS = 5 * 60_000;
const PROFILE_SYNC_CACHE_TTL_MS = 5 * 60_000;

let cachedOwnerTrueUntil = 0;
let ownerCheckInFlight: Promise<any> | null = null;
let profileSyncFreshUntil = 0;
let profileSyncInFlight: Promise<any> | null = null;

/**
 * Stops the auth/profile event feedback loop that can repeatedly trigger:
 * owner_exists -> profiles -> saveUsers -> atari_auth_changed -> owner_exists ...
 *
 * The guard keeps true owner checks briefly cached, deduplicates profile syncs,
 * and makes background profile sync emit only a scoped users DB event instead
 * of a global auth event. Real login/logout/session events are left intact.
 */
export function installAuthRequestLoopGuard(): void {
  if (typeof window === 'undefined') return;

  const marker = '__atariAuthRequestLoopGuardInstalled';
  if ((window as any)[marker]) return;
  (window as any)[marker] = true;

  // Normalize plain auth events so scoped data hooks (categories/products/etc.)
  // do not interpret every authentication notification as a reason to refetch.
  const nativeDispatchEvent = window.dispatchEvent.bind(window);
  window.dispatchEvent = ((event: Event): boolean => {
    if (event?.type === 'atari_auth_changed' && !(event instanceof CustomEvent)) {
      return nativeDispatchEvent(new CustomEvent('atari_auth_changed', {
        detail: { key: 'atari_auth' }
      }));
    }
    return nativeDispatchEvent(event);
  }) as typeof window.dispatchEvent;

  const originalSaveUsers = authStore.saveUsers.bind(authStore);
  authStore.saveUsers = ((users: any[]) => {
    // saveUsers is commonly called by background profile synchronization. Its
    // legacy implementation emits broad db+auth events, which feeds back into
    // owner/profile checks. Suppress those two synchronous broad emissions,
    // then emit one scoped user-data event instead.
    const currentDispatch = window.dispatchEvent.bind(window);
    let suppress = true;
    const suppressingDispatch = ((event: Event): boolean => {
      if (suppress && (event?.type === 'atari_db_changed' || event?.type === 'atari_auth_changed')) {
        return true;
      }
      return currentDispatch(event);
    }) as typeof window.dispatchEvent;

    window.dispatchEvent = suppressingDispatch;
    try {
      originalSaveUsers(users as any);
    } finally {
      suppress = false;
      window.dispatchEvent = currentDispatch as typeof window.dispatchEvent;
    }

    currentDispatch(new CustomEvent('atari_db_changed', {
      detail: { key: 'atari_users' }
    }));
  }) as typeof authStore.saveUsers;

  const originalSyncUsers = authStore.syncUsersFromSupabase.bind(authStore);
  authStore.syncUsersFromSupabase = (async () => {
    const now = Date.now();
    if (profileSyncFreshUntil > now) {
      return authStore.getUsers();
    }
    if (profileSyncInFlight) return profileSyncInFlight;

    profileSyncInFlight = originalSyncUsers()
      .then((users: any) => {
        profileSyncFreshUntil = Date.now() + PROFILE_SYNC_CACHE_TTL_MS;
        return users;
      })
      .finally(() => {
        profileSyncInFlight = null;
      });

    return profileSyncInFlight;
  }) as typeof authStore.syncUsersFromSupabase;

  const originalOwnerStatus = authStore.checkHasOwnerStatus.bind(authStore);
  authStore.checkHasOwnerStatus = (async () => {
    const now = Date.now();
    if (cachedOwnerTrueUntil > now) {
      return { hasOwner: true };
    }
    if (ownerCheckInFlight) return ownerCheckInFlight;

    ownerCheckInFlight = originalOwnerStatus()
      .then((result: any) => {
        // Cache only a confirmed TRUE result. A false result must remain fresh so
        // initial setup/owner creation cannot be hidden by stale negative state.
        if (result?.hasOwner === true && !result?.error) {
          cachedOwnerTrueUntil = Date.now() + OWNER_TRUE_CACHE_TTL_MS;
        }
        return result;
      })
      .finally(() => {
        ownerCheckInFlight = null;
      });

    return ownerCheckInFlight;
  }) as typeof authStore.checkHasOwnerStatus;

  console.info('🛡️ Auth request-loop guard enabled (owner/profile checks deduped and scoped)');
}

installAuthRequestLoopGuard();
