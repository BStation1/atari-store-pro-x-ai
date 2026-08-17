/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserRole, ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from "./authPermissions";
import { authSupabase as supabase } from "./authSupabaseClient";

export interface AuthUser {
  id: string;
  fullName: string;
  username: string;
  email: string;
  phone?: string;
  roleId: UserRole;
  permissions: string[];
  isActive: boolean;
  mustChangePassword?: boolean;
  lastLoginAt?: string;
  failedLoginAttempts?: number;
  lockedUntil?: string;
  branch?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  // Kept only for backward-compatible persisted objects. Never written or trusted.
  passwordHash?: string;
  name?: string;
  role?: string;
  avatarUrl?: string;
}

function profileRoleToUserRole(role: unknown): UserRole {
  const value = String(role || "RECEPTION").toUpperCase();
  if (value === "ENGINEER" || value === "TECHNICIAN") return "TECHNICIAN";
  if (value === "RECEPTION" || value === "RECEPTIONIST") return "RECEPTIONIST";
  if (["OWNER", "ADMIN", "MANAGER", "CASHIER", "INVENTORY", "ACCOUNTANT", "VIEWER"].includes(value)) {
    return value as UserRole;
  }
  return "RECEPTIONIST";
}

function userRoleToProfileRole(role: UserRole): string {
  if (role === "TECHNICIAN") return "ENGINEER";
  if (role === "RECEPTIONIST") return "RECEPTION";
  return role;
}

function mapProfileToAuthUser(profile: any, authEmail?: string | null): AuthUser {
  const roleId = profileRoleToUserRole(profile?.role);
  const email = String(profile?.email || authEmail || "");
  const fullName = profile?.full_name || email.split("@")[0] || "مستخدم";
  return {
    id: profile.id,
    fullName,
    name: fullName,
    username: profile?.username || email.split("@")[0] || "user",
    email,
    phone: profile?.phone || "",
    branch: profile?.branch || "الفرع الرئيسي",
    roleId,
    role: roleId.toLowerCase(),
    permissions: Array.isArray(profile?.custom_permissions)
      ? profile.custom_permissions
      : (DEFAULT_ROLE_PERMISSIONS[roleId] || []),
    isActive: profile?.is_active !== false,
    mustChangePassword: profile?.must_change_password === true,
    createdAt: profile?.created_at || new Date().toISOString(),
    updatedAt: profile?.updated_at || new Date().toISOString(),
    avatarUrl: profile?.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
  };
}

export interface UserSession {
  sessionId: string;
  userId: string;
  createdAt: string;
  expiresAt: string;
  deviceInfo?: string;
  ipAddress?: string;
}

export interface LoginAttempt {
  id: string;
  usernameOrEmail: string;
  success: boolean;
  timestamp: string;
  ipAddress?: string;
  reason?: string;
}

const CURRENT_SESSION_KEY = "atari_current_session_v2";
const USERS_STORAGE_KEY = "atari_erp_users_v2";
const SESSIONS_STORAGE_KEY = "atari_erp_sessions_v2";
const LOGIN_ATTEMPTS_STORAGE_KEY = "atari_login_attempts_v2";
const ACTIVE_USER_KEY = "atari_active_user_session";

/** @deprecated Passwords are owned exclusively by Supabase Auth. */
export function hashPassword(_plain: string): string {
  throw new Error("Client-side password hashing is disabled. Use Supabase Auth.");
}

function sanitizedForCache(user: AuthUser): AuthUser {
  const { passwordHash: _ignored, ...safe } = user;
  return safe as AuthUser;
}

export const authStore = {
  getUsers(): AuthUser[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = JSON.parse(localStorage.getItem(USERS_STORAGE_KEY) || "[]") as AuthUser[];
      return Array.isArray(raw) ? raw.map(sanitizedForCache) : [];
    } catch {
      return [];
    }
  },

  saveUsers(users: AuthUser[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users.map(sanitizedForCache)));
    window.dispatchEvent(new Event("atari_db_changed"));
    window.dispatchEvent(new Event("atari_auth_changed"));
  },

  hasOwner(): boolean {
    // Local cache is display-only. This method is retained for old UI code only.
    return this.getUsers().some(u => (u.roleId === "OWNER" || u.roleId === "ADMIN") && u.isActive);
  },

  async checkHasOwnerStatus(): Promise<{ hasOwner: boolean; error?: string }> {
    try {
      const { data, error } = await supabase.rpc("owner_exists");
      if (error) {
        return {
          hasOwner: true,
          error: "تعذر التحقق من حالة المالك. تم إغلاق شاشة الإعداد احترازياً."
        };
      }
      return { hasOwner: data === true };
    } catch {
      return {
        hasOwner: true,
        error: "تعذر الاتصال بقاعدة البيانات. تم إغلاق شاشة الإعداد احترازياً."
      };
    }
  },

  async checkHasOwnerInSupabase(): Promise<boolean> {
    return (await this.checkHasOwnerStatus()).hasOwner;
  },

  async syncUsersFromSupabase(): Promise<AuthUser[]> {
    try {
      const { data: profiles, error } = await supabase.from("profiles").select("*");
      if (error || !profiles) return this.getUsers();
      const users = profiles.map((p: any) => mapProfileToAuthUser(p, p.email));
      this.saveUsers(users);
      return users;
    } catch {
      return this.getUsers();
    }
  },

  async syncProfileToSupabase(user: AuthUser, authUserId?: string) {
    try {
      const targetId = authUserId || user.id;
      if (!targetId || targetId.startsWith("U-")) {
        return { success: false as const, error: "معرّف المستخدم غير صالح." };
      }

      const { error } = await supabase.from("profiles").upsert({
        id: targetId,
        email: user.email,
        username: user.username,
        full_name: user.fullName,
        phone: user.phone || "",
        branch: user.branch || "الفرع الرئيسي",
        custom_permissions: user.permissions || [],
        must_change_password: user.mustChangePassword === true,
        is_active: user.isActive !== false,
        role: userRoleToProfileRole(user.roleId),
        updated_at: new Date().toISOString()
      }, { onConflict: "id" });

      if (error) throw error;
      return { success: true as const };
    } catch (err) {
      return {
        success: false as const,
        error: err instanceof Error ? err.message : "تعذر حفظ ملف المستخدم"
      };
    }
  },

  async createInitialOwner(data: {
    fullName: string;
    username: string;
    email: string;
    phone?: string;
    password: string;
  }): Promise<{ success: boolean; error?: string; user?: AuthUser }> {
    const ownerStatus = await this.checkHasOwnerStatus();
    if (ownerStatus.error) return { success: false, error: ownerStatus.error };
    if (ownerStatus.hasOwner) return { success: false, error: "يوجد صاحب نظام (OWNER) مسجل بالفعل بالنظام." };

    const cleanEmail = data.email.toLowerCase().trim();
    const cleanUsername = data.username.toLowerCase().trim();

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: cleanEmail,
      password: data.password,
      options: { data: { full_name: data.fullName, username: cleanUsername } }
    });
    if (signUpError) return { success: false, error: signUpError.message };

    if (!signUpData.session) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password: data.password
      });
      if (signInError) {
        return { success: false, error: "تم إنشاء الحساب، لكن يلزم تأكيد البريد أو تسجيل الدخول قبل تفعيل المالك." };
      }
    }

    const { data: ownerProfile, error: bootstrapError } = await supabase.rpc("bootstrap_first_owner");
    if (bootstrapError || !ownerProfile) {
      return { success: false, error: bootstrapError?.message || "تعذر تفعيل أول مالك بأمان." };
    }

    const ownerUser = mapProfileToAuthUser(ownerProfile, cleanEmail);
    ownerUser.username = cleanUsername;
    ownerUser.fullName = data.fullName;
    ownerUser.name = data.fullName;
    ownerUser.phone = data.phone || "";
    ownerUser.permissions = ALL_PERMISSIONS;

    await this.syncProfileToSupabase(ownerUser, ownerUser.id);
    this.setActiveUser(ownerUser);
    this.logLoginAttempt(cleanUsername, true, "إنشاء أول OWNER عبر Supabase Auth");
    return { success: true, user: ownerUser };
  },

  setActiveUser(user: AuthUser) {
    if (typeof window === "undefined") return;
    const safeUser = sanitizedForCache(user);
    localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(safeUser));
    localStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify({
      sessionId: `SESS-${user.id}`,
      userId: user.id,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    }));
    window.dispatchEvent(new Event("atari_auth_changed"));
  },

  clearSession() {
    if (typeof window === "undefined") return;
    localStorage.removeItem(ACTIVE_USER_KEY);
    localStorage.removeItem("atari_current_session_v1");
    localStorage.removeItem(CURRENT_SESSION_KEY);
    localStorage.removeItem("atari_current_user");
    window.dispatchEvent(new Event("atari_auth_changed"));
  },

  getSessions(): UserSession[] {
    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(SESSIONS_STORAGE_KEY) || "[]");
    } catch {
      return [];
    }
  },

  saveSessions(sessions: UserSession[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  },

  createSession(userId: string): UserSession {
    const now = new Date();
    const randomId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${userId}`;
    const newSession: UserSession = {
      sessionId: `SESS-${randomId}`,
      userId,
      createdAt: now.toISOString(),
      expiresAt: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
      deviceInfo: typeof navigator !== "undefined" ? navigator.userAgent : "Web Device"
    };
    this.saveSessions([...this.getSessions(), newSession]);
    if (typeof window !== "undefined") localStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(newSession));
    return newSession;
  },

  getCurrentSession(): UserSession | null {
    if (typeof window === "undefined") return null;
    try {
      const data = localStorage.getItem(CURRENT_SESSION_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  },

  getCurrentUser(): AuthUser | null {
    // This is a UI cache only. Authorization is enforced in Supabase RLS/RPCs.
    if (typeof window === "undefined") return null;
    try {
      const raw = localStorage.getItem(ACTIVE_USER_KEY);
      if (!raw) return null;
      const user = sanitizedForCache(JSON.parse(raw));
      return user?.id && user.isActive !== false ? user : null;
    } catch {
      return null;
    }
  },

  async validateAndSyncSession(): Promise<{ user: AuthUser | null; error?: string }> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session?.user) {
        this.clearSession();
        return { user: null, error: sessionError?.message };
      }

      let { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profileError) {
        this.clearSession();
        return { user: null, error: "تعذر قراءة ملف المستخدم المعتمد." };
      }

      if (!profile) {
        // Missing profiles are created with the minimum role only. Never infer roles
        // from user_metadata or localStorage.
        const { data: inserted, error: insertError } = await supabase
          .from("profiles")
          .insert({
            id: session.user.id,
            email: session.user.email || "",
            username: session.user.user_metadata?.username || (session.user.email || "user").split("@")[0],
            full_name: session.user.user_metadata?.full_name || (session.user.email || "user").split("@")[0],
            role: "RECEPTION",
            is_active: true
          })
          .select("*")
          .single();
        if (insertError || !inserted) {
          this.clearSession();
          return { user: null, error: "لا يوجد ملف صلاحيات صالح لهذا الحساب." };
        }
        profile = inserted;
      }

      if (profile.is_active === false) {
        await supabase.auth.signOut();
        this.clearSession();
        return { user: null, error: "حساب المستخدم معطل حالياً." };
      }

      const activeUser = mapProfileToAuthUser(profile, session.user.email);
      this.setActiveUser(activeUser);

      const users = this.getUsers();
      const idx = users.findIndex(u => u.id === activeUser.id);
      if (idx >= 0) users[idx] = activeUser;
      else users.push(activeUser);
      this.saveUsers(users);
      return { user: activeUser };
    } catch (err: any) {
      this.clearSession();
      return { user: null, error: err?.message || "حدث خطأ أثناء التحقق من الجلسة." };
    }
  },

  async login(
    usernameOrEmail: string,
    password: string,
    _rememberMe: boolean = true
  ): Promise<{ success: boolean; error?: string; user?: AuthUser; mustChangePassword?: boolean }> {
    const cleanIdentifier = usernameOrEmail.trim().toLowerCase();
    let targetEmail = cleanIdentifier;

    if (!targetEmail.includes("@")) {
      const { data, error } = await supabase.rpc("lookup_login_email", { p_username: cleanIdentifier });
      if (error || typeof data !== "string" || !data) {
        this.logLoginAttempt(usernameOrEmail, false, "username lookup failed");
        return { success: false, error: "اسم المستخدم أو كلمة المرور غير صحيحة" };
      }
      targetEmail = data;
    }

    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: targetEmail,
      password
    });
    if (authError || !authData.session) {
      this.logLoginAttempt(usernameOrEmail, false, authError?.message || "login failed");
      return { success: false, error: "اسم المستخدم أو كلمة المرور غير صحيحة" };
    }

    const sync = await this.validateAndSyncSession();
    if (!sync.user) {
      await supabase.auth.signOut();
      return { success: false, error: sync.error || "تعذر قراءة ملف المستخدم المعتمد." };
    }

    this.logLoginAttempt(usernameOrEmail, true, "تسجيل دخول ناجح مع Supabase Auth");
    return { success: true, user: sync.user, mustChangePassword: sync.user.mustChangePassword };
  },

  async logout() {
    try {
      await supabase.auth.signOut();
    } finally {
      this.clearSession();
    }
  },

  logoutAllSessions(userId: string) {
    this.saveSessions(this.getSessions().filter(s => s.userId !== userId));
    if (this.getCurrentSession()?.userId === userId) void this.logout();
  },

  // Legacy synchronous password methods now fail closed. They intentionally do not
  // read/write password hashes or accept any master password.
  changePassword(
    _userId: string,
    _oldPassword: string,
    _newPassword: string
  ): { success: boolean; error?: string } {
    return {
      success: false,
      error: "تغيير كلمة المرور المحلي تم إيقافه لأسباب أمنية. استخدم changePasswordSecure."
    };
  },

  async changePasswordSecure(oldPassword: string, newPassword: string): Promise<{ success: boolean; error?: string }> {
    const { data: { session } } = await supabase.auth.getSession();
    const email = session?.user?.email;
    if (!email) return { success: false, error: "لا توجد جلسة مصادقة صالحة." };

    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: oldPassword });
    if (verifyError) return { success: false, error: "كلمة المرور الحالية غير صحيحة" };

    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    if (updateError) return { success: false, error: updateError.message };

    await supabase.from("profiles").update({ must_change_password: false }).eq("id", session.user.id);
    return { success: true };
  },

  resetPasswordByAdmin(
    _targetUserId: string,
    _newTempPassword: string
  ): { success: boolean; error?: string } {
    return {
      success: false,
      error: "إعادة تعيين كلمة مرور مستخدم آخر من المتصفح غير مسموحة. يلزم مسار خادم إداري آمن."
    };
  },

  logLoginAttempt(usernameOrEmail: string, success: boolean, reason: string) {
    if (typeof window === "undefined") return;
    try {
      const attempts: LoginAttempt[] = JSON.parse(localStorage.getItem(LOGIN_ATTEMPTS_STORAGE_KEY) || "[]");
      attempts.unshift({
        id: `ATT-${Date.now()}`,
        usernameOrEmail,
        success,
        timestamp: new Date().toISOString(),
        reason
      });
      localStorage.setItem(LOGIN_ATTEMPTS_STORAGE_KEY, JSON.stringify(attempts.slice(0, 100)));
    } catch {
      // Non-critical local audit cache only.
    }
  }
};

if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_OUT" || !session) {
      authStore.clearSession();
      return;
    }
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
      await authStore.validateAndSyncSession();
    }
  });
}
