/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from "react";
import { ShieldAlert, ArrowRight, Lock } from "lucide-react";

interface UnauthorizedProps {
  onReturnHome?: () => void;
  requiredPermission?: string | null;
}

export default function Unauthorized({ onReturnHome, requiredPermission }: UnauthorizedProps) {
  return (
    <div className="max-w-xl mx-auto my-12 p-8 bg-[#11131e] border border-red-500/30 rounded-3xl text-center space-y-6 shadow-2xl dir-rtl font-sans">
      <div className="w-16 h-16 bg-red-600/20 border border-red-500/30 text-red-400 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
        <ShieldAlert className="w-8 h-8" />
      </div>

      <div className="space-y-2">
        <span className="inline-block bg-red-950/60 text-red-400 border border-red-800 px-3 py-1 rounded-full text-[11px] font-bold">
          403 - وصول غير مصرح به
        </span>
        <h2 className="text-xl sm:text-2xl font-black text-white">غير مسموح بالوصول لهذه الصفحة</h2>
        <p className="text-xs text-gray-400 leading-relaxed max-w-md mx-auto">
          عفواً، حسابك الحالي لا يمتلك الصلاحية المطلوبة لعرض أو استخدام هذا القسم بالبرنامج.
        </p>
        {requiredPermission && (
          <p className="text-[11px] font-mono text-gray-500 bg-gray-950 p-2 rounded-xl inline-block mt-2 border border-[#2a2d42]">
            الصلاحية المطلوبة: <span className="text-indigo-400 font-bold">{requiredPermission}</span>
          </p>
        )}
      </div>

      <div className="bg-gray-950/60 border border-[#2a2d42] p-4 rounded-2xl text-xs text-gray-400 text-right space-y-2">
        <div className="flex items-center gap-2 text-white font-bold">
          <Lock className="w-4 h-4 text-amber-400" />
          <span>ماذا يمكنك أن تفعل؟</span>
        </div>
        <ul className="list-disc list-inside space-y-1 text-gray-400 pr-2">
          <li>التواصل مع مالك النظام (OWNER) لمنحك التكليف أو الصلاحية المناسبة.</li>
          <li>التأكد من تسجيل الدخول بالحساب الصحيح المخصص لقسم عملك.</li>
          <li>العودة إلى الصفحة الرئيسية للوحة التحكم المتاحة لك.</li>
        </ul>
      </div>

      {onReturnHome && (
        <button
          onClick={onReturnHome}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-6 rounded-xl text-xs transition-all shadow-lg shadow-indigo-950/50 cursor-pointer inline-flex items-center gap-2"
        >
          <ArrowRight className="w-4 h-4 rotate-180" />
          <span>العودة للوحة التحكم المتاحة</span>
        </button>
      )}
    </div>
  );
}
