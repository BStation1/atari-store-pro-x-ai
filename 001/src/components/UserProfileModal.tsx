/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { PhoneDisplay } from "./PhoneDisplay";
import { User as UserIcon, X, KeyRound, LogOut, ShieldCheck, Mail, Phone, Calendar, Clock, CheckCircle2, AlertCircle } from "lucide-react";
import { authStore, AuthUser } from "../lib/authStore";
import { ROLE_LABELS_AR } from "../lib/authPermissions";

interface UserProfileModalProps {
  user: AuthUser;
  isOpen: boolean;
  onClose: () => void;
  onLogout: () => void;
  onLogoutAllDevices: () => void;
}

export default function UserProfileModal({
  user,
  isOpen,
  onClose,
  onLogout,
  onLogoutAllDevices
}: UserProfileModalProps) {
  const [activeTab, setActiveTab] = useState<"info" | "password">("info");

  // Change password fields
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: "success" | "error"; text: string } | null>(null);

  if (!isOpen) return null;

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);

    if (!oldPassword || !newPassword) {
      setStatusMsg({ type: "error", text: "يرجى إدخال كلمة المرور الحالية والجديدة." });
      return;
    }

    if (newPassword.length < 6) {
      setStatusMsg({ type: "error", text: "كلمة المرور الجديدة يجب أن تتكون من 6 خانات على الأقل." });
      return;
    }

    if (newPassword !== confirmPassword) {
      setStatusMsg({ type: "error", text: "كلمتا المرور غير متطابقتين." });
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const res = authStore.changePassword(user.id, oldPassword, newPassword);
      setIsLoading(false);

      if (res.success) {
        setStatusMsg({ type: "success", text: "تم تغيير كلمة المرور بنجاح!" });
        setOldPassword("");
        setNewPassword("");
        setConfirmPassword("");
      } else {
        setStatusMsg({ type: "error", text: res.error || "فشل تغيير كلمة المرور." });
      }
    }, 300);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4 dir-rtl">
      <div className="bg-[#11131e] border border-[#2a2d42] rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b border-[#2a2d42] flex justify-between items-center bg-[#070913]/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <UserIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">{user.fullName || user.name}</h3>
              <p className="text-[11px] text-gray-400 font-mono">@{user.username}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-xl hover:bg-[#1a1d2e] cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-[#2a2d42] bg-gray-950/40">
          <button
            onClick={() => setActiveTab("info")}
            className={`flex-1 py-3 text-xs font-bold transition-colors cursor-pointer border-b-2 ${
              activeTab === "info"
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            الملف الشخصي والحساب
          </button>
          <button
            onClick={() => setActiveTab("password")}
            className={`flex-1 py-3 text-xs font-bold transition-colors cursor-pointer border-b-2 ${
              activeTab === "password"
                ? "border-indigo-500 text-indigo-400 bg-indigo-500/5"
                : "border-transparent text-gray-400 hover:text-white"
            }`}
          >
            تغيير كلمة المرور
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {activeTab === "info" && (
            <div className="space-y-4">
              <div className="bg-gray-950/60 border border-[#2a2d42] p-4 rounded-2xl space-y-3">
                <div className="flex items-center justify-between text-xs pb-2 border-b border-[#2a2d42]/60">
                  <span className="text-gray-400">الدور الوظيفي:</span>
                  <span className="font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-1 rounded-lg border border-indigo-500/20">
                    {ROLE_LABELS_AR[user.roleId] || user.roleId}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <Mail className="w-3.5 h-3.5 text-gray-500" />
                    البريد الإلكتروني:
                  </span>
                  <span className="text-white font-mono">{user.email || "غير مسجل"}</span>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <Phone className="w-3.5 h-3.5 text-gray-500" />
                    رقم الهاتف:
                  </span>
                  <PhoneDisplay phone={user.phone} className="text-white font-mono" />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-gray-500" />
                    آخر تسجيل دخول:
                  </span>
                  <span className="text-gray-300 font-mono">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString("ar-EG") : "الآن"}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-2 pt-2">
                <button
                  onClick={onLogout}
                  className="w-full bg-red-600/10 border border-red-500/30 hover:bg-red-600/20 text-red-400 font-bold py-3 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>تسجيل الخروج</span>
                </button>

                <button
                  onClick={onLogoutAllDevices}
                  className="w-full bg-gray-900 border border-[#2a2d42] hover:bg-gray-800 text-gray-300 font-bold py-2.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  <ShieldCheck className="w-4 h-4 text-amber-400" />
                  <span>تسجيل الخروج من كافة الأجهزة والجلسات</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === "password" && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              {statusMsg && (
                <div
                  className={`p-3 rounded-xl flex items-start gap-2 text-xs border ${
                    statusMsg.type === "success"
                      ? "bg-emerald-950/40 border-emerald-500/40 text-emerald-300"
                      : "bg-red-950/40 border-red-500/40 text-red-300"
                  }`}
                >
                  {statusMsg.type === "success" ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  )}
                  <div>{statusMsg.text}</div>
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-gray-300 mb-1 block">كلمة المرور الحالية *</label>
                <input
                  type="password"
                  value={oldPassword}
                  onChange={e => setOldPassword(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white font-mono dir-ltr text-left focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 mb-1 block">كلمة المرور الجديدة *</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white font-mono dir-ltr text-left focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 mb-1 block">تأكيد كلمة المرور الجديدة *</label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white font-mono dir-ltr text-left focus:outline-none focus:border-indigo-500"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
              >
                <KeyRound className="w-4 h-4" />
                <span>حفظ كلمة المرور الجديدة</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
