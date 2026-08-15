import { authStore } from './authStore';
import { supabase } from './supabaseClient';

// Resolve a username against the shared Supabase profile before delegating to
// the existing, well-tested email/password login flow. This avoids relying on
// browser-local user caches and makes username login work on every device.
const store = authStore as any;
if (!store.__usernameLoginInstalled) {
  store.__usernameLoginInstalled = true;
  const originalLogin = store.login.bind(store);

  store.login = async (identifier: string, password: string, rememberMe = true) => {
    const clean = String(identifier || '').trim().toLowerCase();
    if (!clean || clean.includes('@')) {
      return originalLogin(clean, password, rememberMe);
    }

    try {
      const { data: resolvedEmail, error } = await supabase.rpc('resolve_staff_login', {
        login_identifier: clean,
      });
      if (!error && typeof resolvedEmail === 'string' && resolvedEmail.includes('@')) {
        return originalLogin(resolvedEmail, password, rememberMe);
      }
    } catch (error) {
      console.warn('Username resolution failed:', error);
    }

    return { success: false, error: 'اسم المستخدم أو كلمة المرور غير صحيحة' };
  };
}
