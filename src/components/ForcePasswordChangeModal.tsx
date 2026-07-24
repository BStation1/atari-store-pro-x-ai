/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { KeyRound, Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react";
import { authStore } from "../lib/authStore";

interface ForcePasswordChangeModalProps {
  userId: string;
  onSuccess: () => void;
}

export default function ForcePasswordChangeModal({ userId, onSuccess }: ForcePasswordChangeModalProps) {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!oldPassword || !newPassword) {
      setErrorMsg("يرجى إدخال كلمة المرور المؤقتة وكلمة المرور الجديدة.");
      return;
    }

    if (newPassword.length < 6) {
      setErrorMsg("كلمة المرور الجديدة يجب أن تتكون من 6 خانات على الأقل.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg("كلمتا المرور غير متطابقتين.");
      return;
    }

    setIsLoading(true);

    setTimeout(() => {
      const res = authStore.changePassword(userId, oldPassword, newPassword);
      setIsLoading(false);

      if (res.success) {
        onSuccess();
      } else {
        setErrorMsg(res.error || "فشل تغيير كلمة المرور. يرجى التأكد من كلمة المرور مؤقتة.");
      }
    }, 400);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 dir-rtl">
      <div className="bg-[#11131e] border border-amber-500/40 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-amber-500/10 border border-amber-500/30 text-amber-400 rounded-2xl flex items-center justify-center mx-auto">
            <KeyRound className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-black text-white">تغيير كلمة المرور المؤقتة مطلوب</h3>
          <p className="text-xs text-gray-400 leading-relaxed">
            تم تسجيل دخولك باستخدام كلمة مرور مؤقتة أو بناءً على إعادة تعيين من الإدارة. يرجى تعيين كلمة مرور جديدة آمنة لمتابعة استخدام البرنامج.
          </p>
        </div>

        {errorMsg && (
          <div className="bg-red-950/40 border border-red-500/40 p-3 rounded-xl flex items-start gap-2 text-red-300 text-xs">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <div>{errorMsg}</div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs font-bold text-gray-300 mb-1 block">كلمة المرور المؤقتة (الحالية) *</label>
            <input
              type="password"
              value={oldPassword}
              onChange={e => setOldPassword(e.target.value)}
              className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-3 text-xs text-white font-mono dir-ltr text-left focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-gray-300 mb-1 block">كلمة المرور الجديدة *</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="6 خانات أو أكثر"
                className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-3 text-xs text-white font-mono dir-ltr text-left focus:outline-none focus:border-indigo-500 pl-9"
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
            <label className="text-xs font-bold text-gray-300 mb-1 block">تأكيد كلمة المرور الجديدة *</label>
            <input
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-3 text-xs text-white font-mono dir-ltr text-left focus:outline-none focus:border-indigo-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3.5 px-4 rounded-xl text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-indigo-950/50"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>حفظ كلمة المرور الجديدة ومتابعة</span>
          </button>
        </form>
      </div>
    </div>
  );
}
