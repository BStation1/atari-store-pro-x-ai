/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { ShieldCheck, User, Mail, Phone, Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from "lucide-react";
import { authStore } from "../lib/authStore";
import { useSettings } from "../hooks/useData";

interface InitialSetupProps {
  onSuccess: () => void;
  onCancel: () => void;
}

export default function InitialSetup({ onSuccess, onCancel }: InitialSetupProps) {
  const { settings } = useSettings();

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("owner");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!fullName.trim() || !username.trim() || !email.trim() || !password) {
      setErrorMsg("يرجى تعبئة كافة الحقول المطلوبة بشكل صحيح.");
      return;
    }

    if (password.length < 6) {
      setErrorMsg("كلمة المرور يجب أن لا تقل عن 6 خانات.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("كلمتا المرور غير متطابقتين.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await authStore.createInitialOwner({
        fullName,
        username,
        email,
        phone,
        password
      });

      setIsLoading(false);

      if (res.success) {
        onSuccess();
      } else {
        setErrorMsg(res.error || "تعذر إنشاء مالك النظام.");
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMsg(err?.message || "حدث خطأ أثناء الاتصال بـ Supabase.");
    }
  };

  return (
    <div className="min-h-screen bg-[#070913] text-gray-100 flex flex-col justify-center items-center p-4 dir-rtl font-sans selection:bg-indigo-600 selection:text-white relative overflow-hidden">
      <div className="w-full max-w-lg relative z-10 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-4 py-1.5 rounded-full text-emerald-400 text-xs font-bold">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>تهيئة النظام لأول مرة</span>
          </div>
          <h1 className="text-2xl font-black text-white">{settings.companyName || "Atari Store Pro X"}</h1>
          <p className="text-xs text-gray-400">أنشئ حساب مالك النظام الأولي (OWNER) لمنح الصلاحيات الكاملة وإدارة البرنامج</p>
        </div>

        <div className="bg-[#11131e] border border-[#2a2d42] p-6 sm:p-8 rounded-3xl shadow-2xl space-y-6">
          {errorMsg && (
            <div className="bg-red-950/40 border border-red-500/40 p-4 rounded-2xl flex items-start gap-3 text-red-300 text-xs">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>{errorMsg}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-gray-300 mb-1 block">الاسم الكامل لمالك النظام *</label>
              <input
                type="text"
                placeholder="مثال: المهندس أحمد محمد"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                className="w-full bg-gray-950 border border-[#2a2d42] focus:border-indigo-500 rounded-xl px-4 py-3 text-xs text-white placeholder-gray-600 focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-300 mb-1 block">اسم المستخدم *</label>
                <input
                  type="text"
                  placeholder="owner"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] focus:border-indigo-500 rounded-xl px-4 py-3 text-xs text-white font-mono text-left dir-ltr placeholder-gray-600 focus:outline-none"
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
                  className="w-full bg-gray-950 border border-[#2a2d42] focus:border-indigo-500 rounded-xl px-4 py-3 text-xs text-white font-mono text-left dir-ltr placeholder-gray-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-gray-300 mb-1 block">البريد الإلكتروني *</label>
              <input
                type="email"
                placeholder="owner@atari.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="w-full bg-gray-950 border border-[#2a2d42] focus:border-indigo-500 rounded-xl px-4 py-3 text-xs text-white font-mono text-left dir-ltr placeholder-gray-600 focus:outline-none"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-bold text-gray-300 mb-1 block">كلمة المرور *</label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full bg-gray-950 border border-[#2a2d42] focus:border-indigo-500 rounded-xl px-4 py-3 text-xs text-white font-mono text-left dir-ltr focus:outline-none pl-9"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="text-gray-500 hover:text-white absolute left-2.5 top-3 cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-300 mb-1 block">تأكيد كلمة المرور *</label>
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] focus:border-indigo-500 rounded-xl px-4 py-3 text-xs text-white font-mono text-left dir-ltr focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="flex gap-2 pt-3">
              <button
                type="submit"
                disabled={isLoading}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-4 rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>إنشاء المالك وبدء التشغيل</span>
              </button>

              <button
                type="button"
                onClick={onCancel}
                className="bg-gray-900 border border-[#2a2d42] hover:bg-gray-800 text-gray-300 font-bold py-3 px-4 rounded-xl text-xs cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
