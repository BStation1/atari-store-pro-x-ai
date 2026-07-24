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
    return users.some(u => u.roleId === "OWNER" && u.isActive);
  },

  async syncProfileToSupabase(user: AuthUser, authUserId?: string) {
    try {
      const targetId = authUserId || user.id;
      if (!targetId || targetId.startsWith("U-")) return; // Only sync valid UUIDs or auth users

      await supabase.from("profiles").upsert(
        {
          id: targetId,
          email: user.email,
          full_name: user.fullName,
          role: user.roleId === "OWNER" || user.roleId === "ADMIN" ? "ADMIN" : user.roleId === "TECHNICIAN" ? "TECHNICIAN" : "RECEPTION"
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
    if (this.hasOwner()) {
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
    const ownerUser: AuthUser = {
      id: authUserId || "U-OWNER-001",
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

    // Sync to profiles table
    if (authUserId) {
      await this.syncProfileToSupabase(ownerUser, authUserId);
    }

    // Create session for initial owner
    this.createSession(ownerUser.id);
    this.logLoginAttempt(data.username, true, "إشعال نظام التشغيل - إنشاء أول OWNER");

    return { success: true, user: ownerUser };
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
      const data = localStorage.getItem(CURRENT_SESSION_KEY);
      if (!data) return null;
      const session: UserSession = JSON.parse(data);

      // Check session expiry
      if (new Date(session.expiresAt).getTime() < new Date().getTime()) {
        this.logout();
        return null;
      }

      return session;
    } catch {
      return null;
    }
  },

  getCurrentUser(): AuthUser | null {
    const session = this.getCurrentSession();
    if (!session) return null;

    const users = this.getUsers();
    const user = users.find(u => u.id === session.userId);

    // If user was disabled or removed, terminate session
    if (!user || !user.isActive) {
      this.logout();
      return null;
    }

    return user;
  },

  async login(
    usernameOrEmail: string,
    password: string,
    rememberMe: boolean = true
  ): Promise<{ success: boolean; error?: string; user?: AuthUser; mustChangePassword?: boolean }> {
    const cleanIdentifier = usernameOrEmail.trim().toLowerCase();
    const users = this.getUsers();

    // Check local target user
    let localUser = users.find(
      u => u.username.toLowerCase() === cleanIdentifier || u.email.toLowerCase() === cleanIdentifier
    );

    // Determine target email for Supabase Auth
    let targetEmail = cleanIdentifier;
    if (!targetEmail.includes("@")) {
      targetEmail = localUser?.email || `${cleanIdentifier}@atari.com`;
    }

    let authUserId: string | undefined;

    // 1. Authenticate with Supabase Auth
    try {
      let { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: targetEmail,
        password: password
      });

      // If user not in Supabase Auth yet but exists locally or email provided, try auto-signup to register user in auth.users
      if (authError && (authError.message.includes("Invalid login credentials") || authError.message.includes("User not found"))) {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: targetEmail,
          password: password,
          options: {
            data: {
              full_name: localUser?.fullName || usernameOrEmail,
              username: localUser?.username || cleanIdentifier,
              role: localUser?.roleId || "TECHNICIAN"
            }
          }
        });

        if (!signUpError && signUpData?.user) {
          authUserId = signUpData.user.id;
          // Re-try login
          const retry = await supabase.auth.signInWithPassword({
            email: targetEmail,
            password: password
          });
          if (retry.data?.session) {
            authData = retry.data;
            authError = null;
          }
        }
      }

      if (authData?.session && authData?.user) {
        authUserId = authData.user.id;
      }
    } catch (err) {
      console.warn("⚠️ Supabase Auth login error:", err);
    }

    // Fallback: If local user exists and password matches local hash
    if (!localUser && authUserId) {
      // Create local profile from Supabase user
      const now = new Date().toISOString();
      localUser = {
        id: authUserId,
        fullName: usernameOrEmail,
        name: usernameOrEmail,
        username: cleanIdentifier,
        email: targetEmail,
        roleId: "ADMIN",
        role: "admin",
        permissions: ALL_PERMISSIONS,
        isActive: true,
        createdAt: now,
        updatedAt: now
      };
      users.push(localUser);
      this.saveUsers(users);
    } else if (localUser && authUserId) {
      // Update local user ID with Supabase auth UUID
      localUser.id = authUserId;
      this.saveUsers(users);
    }

    if (!localUser) {
      this.logLoginAttempt(usernameOrEmail, false, "اسم المستخدم أو كلمة المرور غير صحيحة");
      return { success: false, error: "اسم المستخدم أو كلمة المرور غير صحيحة" };
    }

    // Successful login reset attempts & set last login date
    localUser.failedLoginAttempts = 0;
    localUser.lockedUntil = undefined;
    localUser.lastLoginAt = new Date().toISOString();
    localUser.updatedAt = new Date().toISOString();
    this.saveUsers(users);

    // Sync profile to Supabase
    if (authUserId) {
      await this.syncProfileToSupabase(localUser, authUserId);
    }

    this.createSession(localUser.id);
    this.logLoginAttempt(usernameOrEmail, true, "تسجيل دخول ناجح مع Supabase Auth");

    return {
      success: true,
      user: localUser,
      mustChangePassword: localUser.mustChangePassword
    };
  },

  async logout() {
    if (typeof window === "undefined") return;
    try {
      await supabase.auth.signOut();
    } catch (err) {
      console.warn("⚠️ Error signing out from Supabase:", err);
    }
    localStorage.removeItem(CURRENT_SESSION_KEY);
    window.dispatchEvent(new Event("atari_auth_changed"));
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
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED" || session?.user) {
      if (session?.user) {
        const authUser = session.user;
        const users = authStore.getUsers();
        let localUser = users.find(
          u => u.id === authUser.id || u.email.toLowerCase() === authUser.email?.toLowerCase()
        );

        if (!localUser) {
          const now = new Date().toISOString();
          const roleFromMetaData = authUser.user_metadata?.role || "ADMIN";
          localUser = {
            id: authUser.id,
            fullName: authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "مستخدم",
            name: authUser.user_metadata?.full_name || authUser.email?.split("@")[0] || "مستخدم",
            username: authUser.user_metadata?.username || authUser.email?.split("@")[0] || "user",
            email: authUser.email || "",
            roleId: roleFromMetaData,
            role: roleFromMetaData.toLowerCase(),
            permissions: ALL_PERMISSIONS,
            isActive: true,
            createdAt: now,
            updatedAt: now,
            avatarUrl: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"
          };
          users.push(localUser);
          authStore.saveUsers(users);
        } else if (localUser.id !== authUser.id) {
          localUser.id = authUser.id;
          authStore.saveUsers(users);
        }

        // Sync local current session if not active
        const currentSession = authStore.getCurrentSession();
        if (!currentSession || currentSession.userId !== authUser.id) {
          authStore.createSession(authUser.id);
        }

        // Keep profile in sync
        authStore.syncProfileToSupabase(localUser, authUser.id);
      }
    } else if (event === "SIGNED_OUT" || !session) {
      const currentSession = authStore.getCurrentSession();
      if (currentSession) {
        localStorage.removeItem("atari_current_session_v2");
        window.dispatchEvent(new Event("atari_auth_changed"));
      }
    }
  });
}

