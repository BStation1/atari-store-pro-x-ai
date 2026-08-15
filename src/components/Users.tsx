/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { PhoneDisplay } from "./PhoneDisplay";
import { supabase } from "../lib/supabaseClient";
import { isUserOwnerSync } from "../lib/authPermissions";
import {
  Users,
  UserPlus,
  ShieldAlert,
  Search,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  X,
  Clock,
  Briefcase,
  Sliders,
  ChevronDown,
  ChevronUp,
  UserCheck,
  UserX,
  RefreshCw,
  LogOut,
  ShieldCheck,
  AlertCircle
} from "lucide-react";
import { authStore, AuthUser, hashPassword } from "../lib/authStore";
import {
  UserRole,
  PERMISSION_CATEGORIES,
  DEFAULT_ROLE_PERMISSIONS,
  ROLE_LABELS_AR,
  ALL_PERMISSIONS
} from "../lib/authPermissions";
import { useCurrentUser, useActivityLogs } from "../hooks/useData";

export default function UsersList() {
  const { user: currentLoggedUser } = useCurrentUser();
  const { logs } = useActivityLogs();

  const [activeTab, setActiveTab] = useState<"users" | "logs">("users");

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  // Users data from auth store
  const [usersList, setUsersList] = useState<AuthUser[]>(() => authStore.getUsers());

  const refreshUsersList = () => {
    setUsersList(authStore.getUsers());
  };

  // Add / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AuthUser | null>(null);

  // Form Fields
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [branch, setBranch] = useState("الفرع الرئيسي");
  const [roleId, setRoleId] = useState<UserRole>("TECHNICIAN");
  const [tempPassword, setTempPassword] = useState("");
  const [mustChangePassword, setMustChangePassword] = useState(true);
  const [customPermissions, setCustomPermissions] = useState<string[]>([]);
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({
    dashboard: true,
    repairs: true
  });

  // Reset Password Modal
  const [resetPassUser, setResetPassUser] = useState<AuthUser | null>(null);
  const [newTempPass, setNewTempPass] = useState("");

  // Alert/Status Message
  const [actionAlert, setActionAlert] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Handle opening modal for creation
  const handleOpenCreateModal = () => {
    setEditingUser(null);
    setFullName("");
    setUsername("");
    setEmail("");
    setPhone("");
    setBranch("الفرع الرئيسي");
    setRoleId("TECHNICIAN");
    setTempPassword("123456");
    setMustChangePassword(true);
    setCustomPermissions([...(DEFAULT_ROLE_PERMISSIONS["TECHNICIAN"] || [])]);
    setIsModalOpen(true);
  };

  // Handle opening modal for editing
  const handleOpenEditModal = (targetUser: AuthUser) => {
    if (targetUser.roleId === "OWNER" && !isUserOwnerSync(currentLoggedUser)) {
      setActionAlert({ type: "error", msg: "عفواً، لا يمكن تعديل بيانات صاحب النظام (OWNER) إلا بواسطة المالك نفسه." });
      return;
    }

    setEditingUser(targetUser);
    setFullName(targetUser.fullName || targetUser.name || "");
    setUsername(targetUser.username);
    setEmail(targetUser.email || "");
    setPhone(targetUser.phone || "");
    setBranch(targetUser.branch || "الفرع الرئيسي");
    setRoleId(targetUser.roleId || "TECHNICIAN");
    setTempPassword("");
    setMustChangePassword(targetUser.mustChangePassword || false);
    setCustomPermissions(targetUser.permissions || [...(DEFAULT_ROLE_PERMISSIONS[targetUser.roleId] || [])]);
    setIsModalOpen(true);
  };

  // When role changes in modal, set default permissions
  const handleRoleChange = (newRole: UserRole) => {
    setRoleId(newRole);
    setCustomPermissions([...(DEFAULT_ROLE_PERMISSIONS[newRole] || [])]);
  };

  // Toggle individual permission checkbox
  const togglePermission = (permId: string) => {
    if (customPermissions.includes(permId)) {
      setCustomPermissions(customPermissions.filter(p => p !== permId));
    } else {
      setCustomPermissions([...customPermissions, permId]);
    }
  };

  // Toggle all permissions in a category
  const toggleCategoryPermissions = (catPerms: string[], selectAll: boolean) => {
    if (selectAll) {
      const merged = Array.from(new Set([...customPermissions, ...catPerms]));
      setCustomPermissions(merged);
    } else {
      setCustomPermissions(customPermissions.filter(p => !catPerms.includes(p)));
    }
  };

  // Submit create or edit user
  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setActionAlert(null);

    if (!fullName.trim() || !username.trim() || !email.trim()) {
      setActionAlert({ type: "error", msg: "يرجى ملء البيانات الأساسية (الاسم، اسم المستخدم، البريد)." });
      return;
    }

    const allUsers = authStore.getUsers();

    if (editingUser) {
      // Edit mode
      const index = allUsers.findIndex(u => u.id === editingUser.id);
      if (index !== -1) {
        allUsers[index] = {
          ...allUsers[index],
          fullName,
          name: fullName,
          username: username.toLowerCase().trim(),
          email: email.toLowerCase().trim(),
          phone,
          branch,
          roleId,
          role: roleId === "OWNER" || roleId === "ADMIN" ? "admin" : roleId === "TECHNICIAN" ? "technician" : "receptionist",
          permissions: roleId === "OWNER" ? ALL_PERMISSIONS : customPermissions,
          mustChangePassword,
          updatedAt: new Date().toISOString(),
          updatedBy: currentLoggedUser?.fullName || currentLoggedUser?.name
        };

        if (tempPassword.trim()) {
          allUsers[index].passwordHash = hashPassword(tempPassword.trim());
          allUsers[index].mustChangePassword = true;
        }

        authStore.saveUsers(allUsers);
        await authStore.syncProfileToSupabase(allUsers[index]);
        setActionAlert({ type: "success", msg: `تم تحديث بيانات المستخدم ${fullName} بنجاح!` });
      }
    } else {
      // Create mode
      const exists = allUsers.some(
        u => u.username.toLowerCase() === username.toLowerCase().trim() || u.email.toLowerCase() === email.toLowerCase().trim()
      );

      if (exists) {
        setActionAlert({ type: "error", msg: "اسم المستخدم أو البريد الإلكتروني مسجل مسبقاً بالنظام." });
        return;
      }

      const cleanEmail = email.toLowerCase().trim();
      const passToUse = tempPassword || "123456";

      // Create staff account through the privileged Edge Function. This keeps the OWNER's
      // browser session intact and creates an already-confirmed Auth user (no email activation).
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;
      if (sessionError || !accessToken) {
        setActionAlert({ type: "error", msg: "انتهت جلسة المالك. سجل الدخول مرة أخرى ثم أعد المحاولة." });
        return;
      }

      const { data: createResult, error: createError } = await supabase.functions.invoke("admin-create-user", {
        headers: { Authorization: `Bearer ${accessToken}` },
        body: {
          fullName: fullName.trim(),
          username: username.toLowerCase().trim(),
          email: cleanEmail,
          password: passToUse,
          phone: phone.trim() || null,
          branch,
          roleId,
          permissions: roleId === "OWNER" ? ALL_PERMISSIONS : customPermissions,
          mustChangePassword
        }
      });

      if (createError || !createResult?.success) {
        const message = createResult?.error || createError?.message || "تعذر إنشاء المستخدم في Supabase.";
        setActionAlert({ type: "error", msg: message });
        return;
      }

      const newUser: AuthUser = {
        id: createResult.user.id,
        fullName,
        name: fullName,
        username: username.toLowerCase().trim(),
        email: cleanEmail,
        phone,
        branch,
        roleId,
        role: roleId === "OWNER" || roleId === "ADMIN" ? "admin" : roleId === "TECHNICIAN" ? "technician" : "receptionist",
        permissions: roleId === "OWNER" ? ALL_PERMISSIONS : customPermissions,
        isActive: true,
        mustChangePassword,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        createdBy: currentLoggedUser?.fullName || currentLoggedUser?.name,
        passwordHash: hashPassword(passToUse),
        avatarUrl: `https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80`
      };

      // Local store is only a UI cache; Supabase is authoritative.
      allUsers.push(newUser);
      authStore.saveUsers(allUsers);
      setActionAlert({ type: "success", msg: `تم إضافة الموظف الجديد ${fullName} بنجاح بدون رسالة تفعيل بريد.` });
    }

    refreshUsersList();
    setIsModalOpen(false);
  };

  // Toggle user active / disabled state
  const handleToggleActive = (targetUser: AuthUser) => {
    setActionAlert(null);

    // Prevent disabling last OWNER
    if (targetUser.roleId === "OWNER") {
      const activeOwners = usersList.filter(u => u.roleId === "OWNER" && u.isActive);
      if (targetUser.isActive && activeOwners.length <= 1) {
        setActionAlert({ type: "error", msg: "لا يمكن تعطيل مالك النظام الوحيد (OWNER). يجب توفر مالك واحد نشط على الأقل." });
        return;
      }

      if (!isUserOwnerSync(currentLoggedUser)) {
        setActionAlert({ type: "error", msg: "عفواً، لا يمكن تعطيل حساب مالك النظام إلا من قِبل OWNER آخر." });
        return;
      }
    }

    const allUsers = authStore.getUsers();
    const userObj = allUsers.find(u => u.id === targetUser.id);
    if (userObj) {
      userObj.isActive = !userObj.isActive;
      userObj.updatedAt = new Date().toISOString();
      userObj.updatedBy = currentLoggedUser?.fullName || currentLoggedUser?.name;

      if (!userObj.isActive) {
        // Terminate sessions if disabled
        authStore.logoutAllSessions(userObj.id);
      }

      authStore.saveUsers(allUsers);
      refreshUsersList();
      setActionAlert({
        type: "success",
        msg: `تم ${userObj.isActive ? "تفعيل" : "تعطيل"} حساب المستخدم ${userObj.fullName || userObj.name} بنجاح.`
      });
    }
  };

  // Reset user password by Admin
  const handleResetPasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPassUser || !newTempPass.trim()) return;

    const res = authStore.resetPasswordByAdmin(resetPassUser.id, newTempPass.trim());
    if (res.success) {
      setActionAlert({
        type: "success",
        msg: `تم إعادة تعيين كلمة مرور ${resetPassUser.fullName || resetPassUser.name} بنجاح لكلمة المرور المؤقتة الجديدة.`
      });
      setResetPassUser(null);
      setNewTempPass("");
      refreshUsersList();
    } else {
      setActionAlert({ type: "error", msg: res.error || "تعذر إعادة تعيين كلمة المرور." });
    }
  };

  // Terminate Sessions
  const handleTerminateSessions = (targetUser: AuthUser) => {
    authStore.logoutAllSessions(targetUser.id);
    setActionAlert({
      type: "success",
      msg: `تم إنهاء جميع الجلسات المفتوحة للمستخدم ${targetUser.fullName || targetUser.name}.`
    });
  };

  // Filter users list
  const filteredUsers = usersList.filter(u => {
    const nameStr = (u.fullName || u.name || "").toLowerCase();
    const userStr = (u.username || "").toLowerCase();
    const emailStr = (u.email || "").toLowerCase();
    const phoneStr = (u.phone || "").toLowerCase();
    const query = searchQuery.toLowerCase().trim();

    const matchesSearch = !query || nameStr.includes(query) || userStr.includes(query) || emailStr.includes(query) || phoneStr.includes(query);
    const matchesRole = roleFilter === "ALL" || u.roleId === roleFilter;
    const matchesStatus =
      statusFilter === "ALL" ||
      (statusFilter === "ACTIVE" && u.isActive) ||
      (statusFilter === "DISABLED" && !u.isActive) ||
      (statusFilter === "MUST_CHANGE" && u.mustChangePassword);

    return matchesSearch && matchesRole && matchesStatus;
  });

  return (
    <div className="space-y-6 dir-rtl font-sans">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="text-indigo-400 w-6 h-6" />
            إدارة طاقم العمل والصلاحيات والأمان (RBAC)
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            تعيين الأدوار الوظيفية، تخصيص الصلاحيات الدقيقة، متابعة الجلسات وسجل الرقابة والأحداث
          </p>
        </div>

        {activeTab === "users" && (
          <button
            onClick={handleOpenCreateModal}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-indigo-950/50 font-bold cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            إضافة موظف / مستخدم جديد
          </button>
        )}
      </div>

      {/* Action Notification Alert */}
      {actionAlert && (
        <div
          className={`p-4 rounded-2xl flex items-start justify-between gap-3 text-xs border ${
            actionAlert.type === "success"
              ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
              : "bg-red-950/40 border-red-500/40 text-red-300"
          }`}
        >
          <div className="flex items-center gap-2">
            {actionAlert.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            )}
            <span>{actionAlert.msg}</span>
          </div>
          <button onClick={() => setActionAlert(null)} className="text-gray-400 hover:text-white cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-[#2a2d42] flex gap-6">
        <button
          onClick={() => setActiveTab("users")}
          className={`pb-3 text-sm font-bold transition-colors cursor-pointer relative ${
            activeTab === "users" ? "text-indigo-400" : "text-gray-400 hover:text-white"
          }`}
        >
          طاقم العمل والمستخدمين ({filteredUsers.length})
          {activeTab === "users" && <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-500"></span>}
        </button>
        <button
          onClick={() => setActiveTab("logs")}
          className={`pb-3 text-sm font-bold transition-colors cursor-pointer relative ${
            activeTab === "logs" ? "text-indigo-400" : "text-gray-400 hover:text-white"
          }`}
        >
          سجل الأحداث والعمليات والرقابة (Audit Logs)
          {activeTab === "logs" && <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-500"></span>}
        </button>
      </div>

      {/* --- USERS TAB --- */}
      {activeTab === "users" && (
        <div className="space-y-6">
          {/* Filters Bar */}
          <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-2xl grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="ابحث بالاسم، اسم المستخدم، البريد أو الهاتف..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500 pl-9"
              />
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3" />
            </div>

            <div>
              <select
                value={roleFilter}
                onChange={e => setRoleFilter(e.target.value)}
                className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">جميع الأدوار الوظيفية</option>
                {Object.entries(ROLE_LABELS_AR).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <select
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="ALL">جميع الحالات</option>
                <option value="ACTIVE">نشط فقط</option>
                <option value="DISABLED">معطل فقط</option>
                <option value="MUST_CHANGE">يلزمه تغيير كلمة المرور</option>
              </select>
            </div>
          </div>

          {/* Users Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredUsers.map(emp => {
              const isOwner = emp.roleId === "OWNER";
              const isMe = currentLoggedUser?.id === emp.id;

              return (
                <div
                  key={emp.id}
                  className={`bg-[#11131e] border rounded-2xl p-5 space-y-4 relative overflow-hidden transition-all ${
                    !emp.isActive
                      ? "border-red-500/20 opacity-75 bg-red-950/10"
                      : isMe
                      ? "border-indigo-500 shadow-lg shadow-indigo-950/30"
                      : "border-[#2a2d42] hover:border-[#333752]"
                  }`}
                >
                  {/* Top user header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <img
                          src={emp.avatarUrl || "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=150&q=80"}
                          alt={emp.fullName || emp.name}
                          className="w-12 h-12 rounded-full object-cover border-2 border-indigo-500/20"
                        />
                        <span
                          className={`w-3.5 h-3.5 rounded-full border-2 border-[#11131e] absolute bottom-0 right-0 ${
                            emp.isActive ? "bg-emerald-500" : "bg-red-500"
                          }`}
                        ></span>
                      </div>
                      <div>
                        <h4 className="text-white font-bold text-sm flex items-center gap-1.5">
                          {emp.fullName || emp.name}
                          {isMe && <span className="text-[10px] text-indigo-400 bg-indigo-500/10 px-1.5 py-0.5 rounded font-normal">(أنت)</span>}
                        </h4>
                        <span className="text-[10px] text-gray-400 font-mono block mt-0.5">@{emp.username}</span>
                      </div>
                    </div>

                    {/* Role badge */}
                    <span
                      className={`text-[10px] font-bold px-2.5 py-1 rounded-full border ${
                        isOwner
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                          : emp.roleId === "ADMIN"
                          ? "bg-purple-500/10 border-purple-500/30 text-purple-400"
                          : "bg-indigo-500/10 border-indigo-500/30 text-indigo-400"
                      }`}
                    >
                      {ROLE_LABELS_AR[emp.roleId] || emp.roleId}
                    </span>
                  </div>

                  {/* Status Pills */}
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    {!emp.isActive ? (
                      <span className="bg-red-500/10 text-red-400 border border-red-500/20 px-2 py-0.5 rounded font-bold">
                        حساب معطل
                      </span>
                    ) : (
                      <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-2 py-0.5 rounded font-bold">
                        نشط
                      </span>
                    )}

                    {emp.mustChangePassword && (
                      <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-2 py-0.5 rounded">
                        تغيير كلمة المرور مطلوب
                      </span>
                    )}

                    {emp.branch && (
                      <span className="bg-gray-800 text-gray-300 border border-[#2a2d42] px-2 py-0.5 rounded">
                        {emp.branch}
                      </span>
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-1 text-xs text-gray-400 border-t border-[#2a2d42]/60 pt-3 font-mono">
                    <p className="truncate">البريد: {emp.email || "غير مسجل"}</p>
                    <div className="flex items-center gap-1">
                      <span>الهاتف:</span>
                      <PhoneDisplay phone={emp.phone} />
                    </div>
                    <p className="text-[10px] text-gray-500 pt-1">
                      آخر دخول: {emp.lastLoginAt ? new Date(emp.lastLoginAt).toLocaleString("ar-EG") : "لم يسجل بعد"}
                    </p>
                  </div>

                  {/* Actions Bar */}
                  <div className="border-t border-[#2a2d42] pt-3 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleOpenEditModal(emp)}
                        className="bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 text-[11px] font-bold py-1.5 px-3 rounded-lg border border-indigo-500/20 transition-colors cursor-pointer"
                        title="تعديل البيانات والتصاريح"
                      >
                        تعديل الصلاحيات
                      </button>

                      <button
                        onClick={() => setResetPassUser(emp)}
                        className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-[11px] p-1.5 rounded-lg border border-[#2a2d42] cursor-pointer"
                        title="إعادة تعيين كلمة المرور"
                      >
                        <KeyRound className="w-3.5 h-3.5" />
                      </button>

                      <button
                        onClick={() => handleTerminateSessions(emp)}
                        className="bg-gray-800 hover:bg-gray-700 text-amber-400 text-[11px] p-1.5 rounded-lg border border-[#2a2d42] cursor-pointer"
                        title="إنهاء جميع الجلسات المفتوحة"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      onClick={() => handleToggleActive(emp)}
                      className={`text-[11px] font-bold py-1.5 px-2.5 rounded-lg border transition-colors cursor-pointer ${
                        emp.isActive
                          ? "bg-red-950/40 text-red-400 border-red-500/30 hover:bg-red-900/40"
                          : "bg-emerald-950/40 text-emerald-400 border-emerald-500/30 hover:bg-emerald-900/40"
                      }`}
                    >
                      {emp.isActive ? "تعطيل الحساب" : "تفعيل الحساب"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* --- AUDIT LOGS TAB --- */}
      {activeTab === "logs" && (
        <div className="bg-[#11131e] border border-[#2a2d42] rounded-3xl p-6 space-y-4">
          <div className="flex justify-between items-center border-b border-[#2a2d42] pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-indigo-400" />
                سجل الأنشطة والرقابة الأمنية (Audit Logs)
              </h3>
              <p className="text-xs text-gray-400 mt-1">تتبع كافة التغييرات والعمليات الحساسة المنفذة داخل النظام</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right">
              <thead>
                <tr className="bg-gray-950 text-gray-400 border-b border-[#2a2d42]">
                  <th className="p-3">التاريخ والوقت</th>
                  <th className="p-3">المستخدم</th>
                  <th className="p-3">نوع العملية</th>
                  <th className="p-3">التفاصيل</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2d42]/60">
                {logs.map(log => (
                  <tr key={log.id} className="hover:bg-gray-950/40">
                    <td className="p-3 text-gray-400 font-mono">
                      {new Date(log.timestamp).toLocaleString("ar-EG")}
                    </td>
                    <td className="p-3 font-bold text-white">{log.userName}</td>
                    <td className="p-3">
                      <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-bold">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-3 text-gray-300">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- CREATE / EDIT USER MODAL --- */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 dir-rtl">
          <div className="bg-[#11131e] border border-[#2a2d42] rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-[#2a2d42] flex justify-between items-center bg-[#070913]/50">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                {editingUser ? `تعديل بيانات وصلاحيات: ${editingUser.fullName || editingUser.name}` : "إضافة موظف جديد بالنظام"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form Content */}
            <form onSubmit={handleSaveUser} className="p-6 overflow-y-auto space-y-6 flex-1">
              {/* Basic Details */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-indigo-400 border-b border-[#2a2d42] pb-2">البيانات الشخصية والوظيفية</h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-300 mb-1 block">الاسم الكامل *</label>
                    <input
                      type="text"
                      placeholder="مثال: المهندس أحمد علي"
                      value={fullName}
                      onChange={e => setFullName(e.target.value)}
                      className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-300 mb-1 block">اسم المستخدم (Username) *</label>
                    <input
                      type="text"
                      placeholder="مثال: ahmed_tech"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white font-mono text-left dir-ltr focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-300 mb-1 block">البريد الإلكتروني *</label>
                    <input
                      type="email"
                      placeholder="ahmed@atari.com"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white font-mono text-left dir-ltr focus:outline-none focus:border-indigo-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-300 mb-1 block">رقم الهاتف</label>
                    <input
                      type="tel"
                      placeholder="01000000000"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white font-mono text-left dir-ltr focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-bold text-gray-300 mb-1 block">الدور الوظيفي الأساسي (Role) *</label>
                    <select
                      value={roleId}
                      onChange={e => handleRoleChange(e.target.value as UserRole)}
                      className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    >
                      {Object.entries(ROLE_LABELS_AR).map(([key, label]) => (
                        <option key={key} value={key} disabled={key === "OWNER" && currentLoggedUser?.roleId !== "OWNER"}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-bold text-gray-300 mb-1 block">الفرع / المقر</label>
                    <input
                      type="text"
                      value={branch}
                      onChange={e => setBranch(e.target.value)}
                      className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                {/* Password Fields */}
                <div className="bg-gray-950/60 border border-[#2a2d42] p-4 rounded-2xl space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">إعدادات كلمة المرور والأمان</span>
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-400">
                      <input
                        type="checkbox"
                        checked={mustChangePassword}
                        onChange={e => setMustChangePassword(e.target.checked)}
                        className="w-4 h-4 rounded bg-gray-950 border-[#2a2d42] text-amber-500 cursor-pointer"
                      />
                      <span>يلزم الموظف بتغيير كلمة المرور عند أول تسجيل دخول</span>
                    </label>
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">
                      {editingUser ? "كلمة مرور مؤقتة جديدة (اتركها فارغة لعدم التغيير)" : "كلمة المرور المؤقتة *"}
                    </label>
                    <input
                      type="text"
                      placeholder={editingUser ? "اتركه فارغاً للحفاظ على كلمة المرور" : "مثال: 123456"}
                      value={tempPassword}
                      onChange={e => setTempPassword(e.target.value)}
                      className="w-full bg-gray-900 border border-[#2a2d42] rounded-xl px-4 py-2 text-xs text-white font-mono text-left dir-ltr focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Granular Permissions Section */}
              <div className="space-y-4 pt-2">
                <div className="flex items-center justify-between border-b border-[#2a2d42] pb-2">
                  <h4 className="text-xs font-bold text-indigo-400 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4" />
                    الصلاحيات الدقيقة المخصصة (Custom Permissions)
                  </h4>
                  {roleId === "OWNER" && (
                    <span className="text-[10px] text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded border border-amber-500/20 font-bold">
                      صاحب النظام يملك كافة الصلاحيات تلقائياً
                    </span>
                  )}
                </div>

                {roleId !== "OWNER" && (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {PERMISSION_CATEGORIES.map(cat => {
                      const isExpanded = expandedCategories[cat.id] ?? false;
                      const catPermIds = cat.permissions.map(p => p.id);
                      const isAllCatSelected = catPermIds.every(id => customPermissions.includes(id));

                      return (
                        <div key={cat.id} className="bg-gray-950/70 border border-[#2a2d42] rounded-2xl overflow-hidden">
                          {/* Category Header */}
                          <div className="p-3 bg-gray-900/60 flex items-center justify-between">
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedCategories({
                                  ...expandedCategories,
                                  [cat.id]: !isExpanded
                                })
                              }
                              className="flex items-center gap-2 text-xs font-bold text-white hover:text-indigo-400 cursor-pointer"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-indigo-400" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
                              <span>{cat.nameAr}</span>
                              <span className="text-[10px] text-gray-500 font-mono">
                                ({cat.permissions.filter(p => customPermissions.includes(p.id)).length} / {cat.permissions.length})
                              </span>
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleCategoryPermissions(catPermIds, !isAllCatSelected)}
                              className="text-[10px] text-indigo-400 hover:underline cursor-pointer"
                            >
                              {isAllCatSelected ? "إلغاء تحديد الكل" : "تحديد الكل بالقسم"}
                            </button>
                          </div>

                          {/* Category Permissions List */}
                          {isExpanded && (
                            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2 border-t border-[#2a2d42]/60">
                              {cat.permissions.map(p => {
                                const checked = customPermissions.includes(p.id);
                                return (
                                  <label
                                    key={p.id}
                                    className={`p-2.5 rounded-xl border text-xs flex items-start gap-2.5 cursor-pointer transition-colors ${
                                      checked
                                        ? "bg-indigo-600/10 border-indigo-500/40 text-white"
                                        : "bg-gray-900/30 border-[#2a2d42]/60 text-gray-400 hover:text-gray-200"
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      onChange={() => togglePermission(p.id)}
                                      className="mt-0.5 w-4 h-4 rounded bg-gray-950 border-[#2a2d42] text-indigo-600 cursor-pointer"
                                    />
                                    <div>
                                      <div className="font-bold text-[11px]">{p.labelAr}</div>
                                      <p className="text-[10px] text-gray-500 mt-0.5 leading-tight">{p.descriptionAr}</p>
                                    </div>
                                  </label>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Submit Buttons */}
              <div className="flex gap-2 pt-4 border-t border-[#2a2d42]">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>{editingUser ? "حفظ التعديلات" : "إضافة المستخدم وتخصيص الصلاحيات"}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="bg-gray-900 border border-[#2a2d42] hover:bg-gray-800 text-gray-300 font-bold py-3 px-4 rounded-xl text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- RESET PASSWORD MODAL --- */}
      {resetPassUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 dir-rtl">
          <div className="bg-[#11131e] border border-amber-500/40 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-[#2a2d42] pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-amber-400" />
                إعادة تعيين كلمة مرور: {resetPassUser.fullName || resetPassUser.name}
              </h3>
              <button onClick={() => setResetPassUser(null)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-gray-300 mb-1 block">كلمة المرور المؤقتة الجديدة *</label>
                <input
                  type="text"
                  placeholder="مثال: 123456"
                  value={newTempPass}
                  onChange={e => setNewTempPass(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white font-mono text-left dir-ltr focus:outline-none focus:border-amber-500"
                  required
                  autoFocus
                />
                <p className="text-[10px] text-gray-400 mt-1">سيتم تعيين هذه كلمة المرور المؤقتة وإلزام الموظف بتغييرها فور تسجيل دخوله.</p>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 px-4 rounded-xl text-xs cursor-pointer"
                >
                  تأكيد تعيين كلمة المرور
                </button>
                <button
                  type="button"
                  onClick={() => setResetPassUser(null)}
                  className="bg-gray-900 border border-[#2a2d42] text-gray-300 font-bold py-2.5 px-4 rounded-xl text-xs cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
