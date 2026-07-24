import React, { useState } from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";

interface ReversalModalProps {
  isOpen: boolean;
  title: string;
  subtitle: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isLoading?: boolean;
}

export default function ReversalModal({
  isOpen,
  title,
  subtitle,
  onClose,
  onConfirm,
  isLoading = false
}: ReversalModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim() || reason.trim().length < 3) {
      setError("يرجى ذكر سبب تفصيلي وملائم لعكس الحركة المالية (3 أحرف على الأقل)");
      return;
    }
    setError("");
    onConfirm(reason.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-amber-500/30 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400">
              <RefreshCw className="w-5 h-5 animate-spin-slow" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-100">{title}</h3>
              <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="p-3.5 bg-slate-800/80 rounded-xl border border-slate-700 text-xs text-amber-300 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-amber-200">تنبيه حماية القوائم المالية:</p>
              <p className="mt-1 leading-relaxed text-slate-300">
                لن يتم حذف السجل المالي نهائياً. سيتم قيد حركة قيود عكسية (Reversal Transaction) في دفتر الأستاذ للحفاظ على سلامة شجرة الحسابات والتدقيق المحاسبي.
              </p>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">
              سبب عكس / إلغاء الحركة <span className="text-rose-400">*</span>
            </label>
            <textarea
              value={reason}
              onChange={e => {
                setReason(e.target.value);
                if (error) setError("");
              }}
              rows={3}
              placeholder="اكتب سبب عكس أو إلغاء هذه الحركة المالية بالتفصيل..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
            />
            {error && <p className="text-xs text-rose-400 mt-1">{error}</p>}
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 border border-slate-700 transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-slate-950 flex items-center gap-2 transition shadow-lg shadow-amber-500/20 disabled:opacity-50"
            >
              {isLoading ? (
                <>جاري تنفيذ العكس...</>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  تأكيد عكس الحركة المالية
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
