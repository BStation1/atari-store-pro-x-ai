/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Lock, User as UserIcon, Eye, EyeOff, ShieldCheck, ArrowRight, Sparkles, AlertCircle } from "lucide-react";
import { authStore } from "../lib/authStore";
import { useSettings } from "../hooks/useData";

interface LoginProps {
  onSuccess: () => void;
  onNavigateToSetup?: () => void;
}

export default function Login({ onSuccess, onNavigateToSetup }: LoginProps) {
  const { settings } = useSettings();

  const [usernameOrEmail, setUsernameOrEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const hasOwner = authStore.hasOwner();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!usernameOrEmail.trim() || !password) {
      setErrorMessage("يرجى إدخال اسم المستخدم وكلمة المرور.");
      return;
    }

    setIsLoading(true);

    try {
      const res = await authStore.login(usernameOrEmail, password, rememberMe);
      setIsLoading(false);

      if (res.success) {
        onSuccess();
      } else {
        setErrorMessage(res.error || "فشل تسجيل الدخول. يرجى التأكد من البيانات.");
      }
    } catch (err: any) {
      setIsLoading(false);
      setErrorMessage(err?.message || "حدث خطأ أثناء اتصال المصادقة.");
    }
  };

  return (
    <div className="min-h-screen bg-[#070913] text-gray-100 flex flex-col justify-center items-center p-4 dir-rtl font-sans selection:bg-indigo-600 selection:text-white relative overflow-hidden">
      {/* Subtle Background Glow Elements */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-600/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-purple-600/10 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md relative z-10 space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 bg-indigo-500/10 border border-indigo-500/20 px-4 py-1.5 rounded-full text-indigo-400 text-xs font-bold shadow-inner">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span>نظام الحماية والوصول المعتمد</span>
          </div>

          <div className="space-y-1">
            <h1 className="text-3xl font-black text-white tracking-tight font-sans">
              {settings.companyName || "Atari Store Pro X"}
            </h1>
            <p className="text-xs text-gray-400">
              بوابة تسجيل دخول الموظفين والإدارة والورشة
            </p>
          </div>
        </div>

        {/* Setup Flow Prompt if system has no owner */}
        {!hasOwner && onNavigateToSetup && (
          <div className="bg-amber-950/40 border border-amber-500/30 p-4 rounded-2xl text-amber-200 text-xs space-y-2">
            <div className="flex items-center gap-2 font-bold text-amber-400">
              <Sparkles className="w-4 h-4" />
              <span>تهيئة النظام لأول مرة (Initial Setup)</span>
            </div>
            <p className="leading-relaxed text-gray-300">
              لم يتم إنشاء حساب مالك النظام (OWNER) بعد. اضغط هنا لإعداد الحساب الأولي الآمن.
            </p>
            <button
              type="button"
              onClick={onNavigateToSetup}
              className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-md"
            >
              <span>إنشاء حساب مالك النظام (OWNER)</span>
              <ArrowRight className="w-4 h-4 rotate-180" />
            </button>
          </div>
        )}

        {/* Login Card */}
        <div className="bg-[#11131e] border border-[#2a2d42] p-6 sm:p-8 rounded-3xl shadow-2xl space-y-6 backdrop-blur-xl">
          <div className="border-b border-[#2a2d42] pb-4">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <Lock className="w-4 h-4 text-indigo-400" />
              تسجيل الدخول للنظام
            </h2>
            <p className="text-[11px] text-gray-400 mt-1">
              أدخل اسم المستخدم أو البريد الإلكتروني وكلمة المرور الخاصة بحسابك
            </p>
          </div>

          {/* Error Message Display */}
          {errorMessage && (
            <div className="bg-red-950/40 border border-red-500/40 p-4 rounded-2xl flex items-start gap-3 text-red-300 text-xs animate-shake">
              <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMessage}</div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Username / Email */}
            <div>
              <label className="text-xs font-bold text-gray-300 mb-1.5 block">
                اسم المستخدم أو البريد الإلكتروني *
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={usernameOrEmail}
                  onChange={e => setUsernameOrEmail(e.target.value)}
                  placeholder="مثال: admin أو owner@atari.com"
                  className="w-full bg-gray-950 border border-[#2a2d42] focus:border-indigo-500 rounded-xl px-4 py-3.5 text-xs text-white placeholder-gray-600 focus:outline-none font-mono text-left dir-ltr pl-10"
                  required
                  autoFocus
                />
                <UserIcon className="w-4 h-4 text-gray-500 absolute left-3 top-4" />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="text-xs font-bold text-gray-300 mb-1.5 block">
                كلمة المرور *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-gray-950 border border-[#2a2d42] focus:border-indigo-500 rounded-xl px-4 py-3.5 text-xs text-white placeholder-gray-600 focus:outline-none font-mono text-left dir-ltr pl-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-gray-500 hover:text-white absolute left-3 top-3.5 p-1 cursor-pointer"
                  title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Remember me */}
            <div className="flex items-center justify-between text-xs text-gray-400 pt-1">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={e => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded bg-gray-950 border-[#2a2d42] text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>تذكرني على هذا الجهاز</span>
              </label>

              <span className="text-[11px] text-gray-500 font-mono">حماية مشفرة</span>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-6 rounded-xl text-xs transition-all shadow-lg shadow-indigo-950/50 cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 mt-4"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  <span>جاري التحقق وتسجيل الدخول...</span>
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  <span>تسجيل الدخول</span>
                </>
              )}
            </button>
          </form>
        </div>

        {/* Public Customer Tracking Link Option */}
        <div className="text-center pt-2">
          <a
            href="/?view=tracking"
            className="text-xs text-indigo-400 hover:text-indigo-300 font-medium inline-flex items-center gap-1.5 transition-colors"
          >
            <span>هل أنت عميل وتبحث عن متابعة صيانة جهازك؟ اضغط هنا للذهاب إلى بوابة التتبع العامة</span>
            <ArrowRight className="w-3.5 h-3.5 rotate-180" />
          </a>
        </div>
      </div>
    </div>
  );
}
