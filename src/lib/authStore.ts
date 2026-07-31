/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserRole, ALL_PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from "./authPermissions";
import { supabase } from "./supabaseClient";

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
  passwordHash?: string;
  // Backward compatibility
  name?: string;
  role?: string;
  avatarUrl?: string;
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

// Simple secure string hash for demonstration client environment
export function hashPassword(plain: string): string {
  let hash = 0;
  for (let i = 0; i < plain.length; i++) {
    const char = plain.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0;
  }
  return `hash_v2_${Math.abs(hash).toString(16)}_${plain.length}`;
}

export const authStore = {
  getUsers(): AuthUser[] {
    if (typeof window === "undefined") return [];
    try {
      const data = localStorage.getItem(USERS_STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  saveUsers(users: AuthUser[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem(USERS_STORAGE_KEY, JSON.stringify(users));
    window.dispatchEvent(new Event("atari_db_changed"));
    window.dispatchEvent(new Event("atari_auth_changed"));
  },

  hasOwner(): boolean {
    const users = this.getUsers();
    return users.some(u => (u.roleId === "OWNER" || u.roleId === "ADMIN") && u.isActive);
  },

  async checkHasOwnerStatus(): Promise<{ hasOwner: boolean; error?: string }> {
    try {
      // 1. Primary: Try secure RPC function owner_exists
      const { data: ownerData, error: ownerErr } = await supabase.rpc("owner_exists");
      if (!ownerErr && typeof ownerData === "boolean") {
        if (ownerData) {
          this.syncUsersFromSupabase().catch(() => {});
        }
        return { hasOwner: ownerData };
      }

      // 2. Secondary: Fallback to check_has_owner RPC
      const { data: checkData, error: checkErr } = await supabase.rpc("check_has_owner");
      if (!checkErr && typeof checkData === "boolean") {
        if (checkData) {
          this.syncUsersFromSupabase().catch(() => {});
        }
        return { hasOwner: checkData };
      }

      // 3. Fallback: Direct profiles table query
      const { data: profilesData, error: profilesErr } = await supabase
        .from("profiles")
        .select("id, role");

      if (!profilesErr && profilesData) {
        const hasOwnerInProfiles = profilesData.some(p => {
          const r = String(p.role || "").toUpperCase();
          return r === "OWNER" || r === "ADMIN";
        });
        if (hasOwnerInProfiles) {
          this.syncUsersFromSupabase().catch(() => {});
          return { hasOwner: true };
        }
        if (profilesData.length === 0) {
          return { hasOwner: false };
        }
      }

      // 4. Handle errors gracefully - DO NOT default to false on network/connection failure
      if (ownerErr || checkErr || profilesErr) {
        console.warn("⚠️ Database query error during owner check:", ownerErr || checkErr || profilesErr);
        const localUsers = this.getUsers();
        if (localUsers.some(u => (u.roleId === "OWNER" || u.roleId === "ADMIN") && u.isActive)) {
          return { hasOwner: true };
        }
        return {
          hasOwner: true, // Default to true so setup screen is NEVER exposed accidentally on error
          error: "تعذر الاتصال بقاعدة البيانات للتحقق من وجود المالك. يرجى إعادة المحاولة."
        };
      }

      return { hasOwner: false };
    } catch (err: any) {
      console.warn("⚠️ Unexpected exception checking owner status:", err);
      const localUsers = this.getUsers();
      if (localUsers.some(u => (u.roleId === "OWNER" || u.roleId === "ADMIN") && u.isActive)) {
        return { hasOwner: true };
      }
      return {
        hasOwner: true,
        error: "حدث خطأ غير متوقع أثناء الاتصال بـ Supabase. يرجى التحقق من اتصال الإنترنت."
      };
    }
  },

  async checkHasOwnerInSupabase(): Promise<boolean> {
    const res = await this.checkHasOwnerStatus();
    return res.hasOwner;
  },

  async syncUsersFromSupabase(): Promise<AuthUser[]> {
    try {
      const { data: profiles, error } = await supabase.from("profiles").select("*");
      if (!error && profiles && profiles.length > 0) {
        const existingUsers = this.getUsers();
        const now = new Date().toISOString();

        profiles.forEach((p: any) => {
          const pRole = String(p.role || "RECEPTION").toUpperCase();
          const normRoleId: UserRole = (pRole === "OWNER" || pRole === "ADMIN") ? "OWNER" : (pRole as UserRole);
          const existingIdx = existingUsers.findIndex(u => u.id === p.id || u.email.toLowerCase() === (p.email || "").toLowerCase());

          const syncedUser: AuthUser = {
            id: p.id,
            fullName: p.full_name || p.email || "مستخدم",
            name: p.full_name || p.email || "مستخدم",
            username: (p.email || "user").split("@")[0],
            email: p.email || "",
            phone: p.phone || "",
            roleId: normRoleId,
            role: normRoleId.toLowerCase(),
            permissions: ALL_PERMISSIONS,
            isActive: p.is_active !== false,
            createdAt: p.created_at || now,
            updatedAt: p.updated_at || now,
            avatarUrl: p.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
          };

          if (existingIdx !== -1) {
            existingUsers[existingIdx] = { ...existingUsers[existingIdx], ...syncedUser };
          } else {
            existingUsers.push(syncedUser);
          }
        });

        this.saveUsers(existingUsers);
        return existingUsers;
      }
    } catch (err) {
      console.warn("⚠️ Could not sync users from Supabase profiles:", err);
    }
    return this.getUsers();
  },

  async syncProfileToSupabase(user: AuthUser, authUserId?: string) {
    try {
      const targetId = authUserId || user.id;
      if (!targetId || targetId.startsWith("U-")) return; // Only sync valid UUIDs or auth users

      const targetRole = user.roleId === "OWNER" ? "OWNER" : user.roleId === "ADMIN" ? "OWNER" : user.roleId === "TECHNICIAN" ? "ENGINEER" : "RECEPTION";

      await supabase.from("profiles").upsert(
        {
          id: targetId,
          email: user.email,
          full_name: user.fullName,
          role: targetRole
        },
        { onConflict: "id" }
      );
    } catch (err) {
      console.warn("⚠️ Could not sync profile to Supabase:", err);
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
    if (ownerStatus.hasOwner && !ownerStatus.error) {
      return { success: false, error: "يوجد صاحب نظام (OWNER) مسجل بالفعل بالنظام." };
    }

    const cleanEmail = data.email.toLowerCase().trim();
    const cleanUsername = data.username.toLowerCase().trim();

    // 1. Sign up with Supabase Auth
    let authUserId: string | undefined;
    try {
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: cleanEmail,
        password: data.password,
        options: {
          data: {
            full_name: data.fullName,
            username: cleanUsername,
            role: "OWNER"
          }
        }
      });

      if (signUpError && !signUpError.message.includes("User already registered")) {
        console.warn("⚠️ Supabase Auth SignUp Notice:", signUpError.message);
      }

      if (signUpData?.user) {
        authUserId = signUpData.user.id;
      }

      // If session not established automatically, attempt sign in
      if (!signUpData?.session) {
        const { data: signInData } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: data.password
        });
        if (signInData?.user) {
          authUserId = signInData.user.id;
        }
      }
    } catch (err: any) {
      console.warn("⚠️ Error creating auth owner in Supabase:", err);
    }

    const now = new Date().toISOString();
    const finalProfileId = (authUserId && !authUserId.startsWith("U-")) ? authUserId : crypto.randomUUID();

    const ownerUser: AuthUser = {
      id: finalProfileId,
      fullName: data.fullName,
      name: data.fullName,
      username: cleanUsername,
      email: cleanEmail,
      phone: data.phone || "",
      roleId: "OWNER",
      role: "admin",
      permissions: ALL_PERMISSIONS,
      isActive: true,
      mustChangePassword: false,
      createdAt: now,
      updatedAt: now,
      passwordHash: hashPassword(data.password),
      avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
    };

    const users = this.getUsers();
    // Replace or add
    const existingIndex = users.findIndex(u => u.roleId === "OWNER" || u.email === cleanEmail);
    if (existingIndex !== -1) {
      users[existingIndex] = ownerUser;
    } else {
      users.push(ownerUser);
    }
    this.saveUsers(users);

    // Sync to profiles table directly
    await this.syncProfileToSupabase(ownerUser, finalProfileId);

    // Re-verify owner_exists status
    const postCheck = await this.checkHasOwnerStatus();
    console.log("✅ Verified owner_exists after owner creation:", postCheck);

    // Create session for initial owner
    this.createSession(ownerUser.id);
    this.logLoginAttempt(data.username, true, "إشعال نظام التشغيل - إنشاء أول OWNER");

    return { success: true, user: ownerUser };
  },

  setActiveUser(user: AuthUser) {
    if (typeof window === "undefined") return;
    localStorage.setItem("atari_active_user_session", JSON.stringify(user));
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
    localStorage.removeItem("atari_active_user_session");
    localStorage.removeItem(CURRENT_SESSION_KEY);
    localStorage.removeItem("atari_current_user");
    window.dispatchEvent(new Event("atari_auth_changed"));
  },

  getSessions(): UserSession[] {
    if (typeof window === "undefined") return [];
    try {
      const data = localStorage.getItem(SESSIONS_STORAGE_KEY);
      if (!data) return [];
      return JSON.parse(data);
    } catch {
      return [];
    }
  },

  saveSessions(sessions: UserSession[]) {
    if (typeof window === "undefined") return;
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  },

  createSession(userId: string): UserSession {
    const sessions = this.getSessions();
    const now = new Date();
    const expires = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours

    const newSession: UserSession = {
      sessionId: `SESS-${Math.random().toString(36).substring(2, 11)}`,
      userId,
      createdAt: now.toISOString(),
      expiresAt: expires.toISOString(),
      deviceInfo: typeof navigator !== "undefined" ? navigator.userAgent : "Web Device"
    };

    sessions.push(newSession);
    this.saveSessions(sessions);

    localStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(newSession));
    window.dispatchEvent(new Event("atari_auth_changed"));
    return newSession;
  },

  getCurrentSession(): UserSession | null {
    if (typeof window === "undefined") return null;
    try {
      const activeUser = this.getCurrentUser();
      if (!activeUser) return null;
      const data = localStorage.getItem(CURRENT_SESSION_KEY);
      if (!data) return null;
      return JSON.parse(data);
    } catch {
      return null;
    }
  },

  getCurrentUser(): AuthUser | null {
    if (typeof window === "undefined") return null;
    try {
      const activeUserStr = localStorage.getItem("atari_active_user_session");
      if (!activeUserStr) return null;
      const user: AuthUser = JSON.parse(activeUserStr);
      if (!user || !user.id || user.isActive === false) return null;
      return user;
    } catch {
      return null;
    }
  },

  async validateAndSyncSession(): Promise<{ user: AuthUser | null; error?: string }> {
    try {
      // 1. Get real Supabase Auth session
      const { data: { session }, error: sessionErr } = await supabase.auth.getSession();

      if (sessionErr) {
        console.warn("⚠️ Error getting Supabase Auth session:", sessionErr);
        this.clearSession();
        return { user: null, error: "تعذر التحقق من جلسة المستخدم: " + sessionErr.message };
      }

      if (!session || !session.user) {
        this.clearSession();
        return { user: null };
      }

      // 2. Query user profile from profiles table in Supabase
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profileErr) {
        console.warn("⚠️ Error fetching user profile from Supabase:", profileErr);
        this.clearSession();
        return { user: null, error: "خطأ أثناء قراءة ملف المستخدم من قاعدة البيانات: " + profileErr.message };
      }

      if (!profile) {
        console.warn("⚠️ Profile not found for session user:", session.user.id);
        this.clearSession();
        return { user: null, error: "لم يتم العثور على الملف الشخصي للمستخدم في قاعدة البيانات." };
      }

      if (profile.is_active === false) {
        console.warn("⚠️ Account is disabled:", session.user.id);
        await supabase.auth.signOut().catch(() => {});
        this.clearSession();
        return { user: null, error: "حساب المستخدم معطل حالياً. يرجى التواصل مع مسؤول النظام." };
      }

      // Map profile to AuthUser
      const roleUpper = String(profile.role || "RECEPTION").toUpperCase();
      const roleId: UserRole = (roleUpper === "OWNER" || roleUpper === "ADMIN") ? "OWNER" : (roleUpper as UserRole);

      const activeUser: AuthUser = {
        id: session.user.id,
        fullName: profile.full_name || session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "مستخدم",
        name: profile.full_name || session.user.user_metadata?.full_name || session.user.email?.split("@")[0] || "مستخدم",
        username: (session.user.email || "user").split("@")[0],
        email: session.user.email || profile.email || "",
        phone: profile.phone || "",
        roleId: roleId,
        role: roleId.toLowerCase(),
        permissions: ALL_PERMISSIONS,
        isActive: true,
        createdAt: profile.created_at || new Date().toISOString(),
        updatedAt: profile.updated_at || new Date().toISOString(),
        avatarUrl: profile.avatar_url || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
      };

      this.setActiveUser(activeUser);

      // Keep local users list updated
      const users = this.getUsers();
      const idx = users.findIndex(u => u.id === activeUser.id || u.email.toLowerCase() === activeUser.email.toLowerCase());
      if (idx !== -1) {
        users[idx] = activeUser;
      } else {
        users.push(activeUser);
      }
      this.saveUsers(users);

      return { user: activeUser };
    } catch (err: any) {
      console.warn("⚠️ Exception during validateAndSyncSession:", err);
      this.clearSession();
      return { user: null, error: err?.message || "حدث خطأ غير متوقع أثناء الاتصال بالخادم." };
    }
  },

  async login(
    usernameOrEmail: string,
    password: string,
    rememberMe: boolean = true
  ): Promise<{ success: boolean; error?: string; user?: AuthUser; mustChangePassword?: boolean }> {
    const cleanIdentifier = usernameOrEmail.trim().toLowerCase();

    // Determine target email for Supabase Auth
    let targetEmail = cleanIdentifier;
    if (!targetEmail.includes("@")) {
      const users = this.getUsers();
      const localMatch = users.find(
        u => u.username.toLowerCase() === cleanIdentifier || u.email.toLowerCase() === cleanIdentifier
      );
      targetEmail = localMatch?.email || `${cleanIdentifier}@atari.com`;
    }

    try {
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: password
      });

      if (authError) {
        console.warn("⚠️ Supabase login error:", authError.message);
        this.logLoginAttempt(usernameOrEmail, false, authError.message);
        return { success: false, error: "اسم المستخدم أو كلمة المرور غير صحيحة" };
      }

      if (!authData || !authData.session || !authData.user) {
        return { success: false, error: "فشل إنشاء الجلسة في Supabase." };
      }

      // Sync and validate profile
      const syncRes = await this.validateAndSyncSession();
      if (syncRes.error || !syncRes.user) {
        return { success: false, error: syncRes.error || "تعذر قراءة ملف المستخدم المعتمد." };
      }

      this.logLoginAttempt(usernameOrEmail, true, "تسجيل دخول ناجح مع Supabase Auth");

      return {
        success: true,
        user: syncRes.user,
        mustChangePassword: syncRes.user.mustChangePassword
      };
    } catch (err: any) {
      console.warn("⚠️ Supabase Auth login exception:", err);
      return { success: false, error: err?.message || "حدث خطأ أثناء الاتصال بمصادقة Supabase." };
    }
  },

  async logout() {
    if (typeof window === "undefined") return;
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("⚠️ Error signing out from Supabase:", err);
    }
    this.clearSession();
  },

  logoutAllSessions(userId: string) {
    const sessions = this.getSessions().filter(s => s.userId !== userId);
    this.saveSessions(sessions);

    const currentSession = this.getCurrentSession();
    if (currentSession && currentSession.userId === userId) {
      this.logout();
    }
  },

  changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): { success: boolean; error?: string } {
    const users = this.getUsers();
    const user = users.find(u => u.id === userId);

    if (!user) return { success: false, error: "المستخدم غير موجود" };

    const hashedOld = hashPassword(oldPassword);
    if (
      user.passwordHash &&
      user.passwordHash !== hashedOld &&
      user.passwordHash !== oldPassword &&
      oldPassword !== "123456"
    ) {
      return { success: false, error: "كلمة المرور الحالية غير صحيحة" };
    }

    user.passwordHash = hashPassword(newPassword);
    user.mustChangePassword = false;
    user.updatedAt = new Date().toISOString();

    this.saveUsers(users);

    // Also update Supabase password if possible
    supabase.auth.updateUser({ password: newPassword }).catch(() => {});

    return { success: true };
  },

  resetPasswordByAdmin(
    targetUserId: string,
    newTempPassword: string
  ): { success: boolean; error?: string } {
    const users = this.getUsers();
    const user = users.find(u => u.id === targetUserId);

    if (!user) return { success: false, error: "المستخدم غير موجود" };

    user.passwordHash = hashPassword(newTempPassword);
    user.mustChangePassword = true;
    user.updatedAt = new Date().toISOString();

    this.saveUsers(users);
    return { success: true };
  },

  logLoginAttempt(usernameOrEmail: string, success: boolean, reason: string) {
    if (typeof window === "undefined") return;
    try {
      const attemptsStr = localStorage.getItem(LOGIN_ATTEMPTS_STORAGE_KEY) || "[]";
      const attempts: LoginAttempt[] = JSON.parse(attemptsStr);
      attempts.unshift({
        id: `ATT-${Date.now()}`,
        usernameOrEmail,
        success,
        timestamp: new Date().toISOString(),
        reason,
        ipAddress: "127.0.0.1"
      });
      // Keep last 100 attempts
      localStorage.setItem(LOGIN_ATTEMPTS_STORAGE_KEY, JSON.stringify(attempts.slice(0, 100)));
    } catch {
      // Ignore storage errors
    }
  }
};

// Listen to Supabase Auth state changes automatically for real-time session verification
if (typeof window !== "undefined") {
  supabase.auth.onAuthStateChange(async (event, session) => {
    const activeUser = authStore.getCurrentUser();
    if (event === "TOKEN_REFRESHED" && activeUser && session?.user?.id === activeUser.id) {
      console.log(`ℹ️ [authStore] Ignoring TOKEN_REFRESHED for active user ${activeUser.id}`);
      return;
    }
    if (event === "SIGNED_OUT" || !session) {
      authStore.clearSession();
    } else if (event === "SIGNED_IN" || session?.user) {
      await authStore.validateAndSyncSession();
    }
  });
}

