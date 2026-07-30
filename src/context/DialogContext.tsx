import React, { createContext, useContext, useState, useCallback } from "react";
import { AlertTriangle, CheckCircle2, Info, XCircle, Trash2, X, Loader2 } from "lucide-react";

interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "danger" | "warning" | "info" | "success";
}

interface AlertOptions {
  title?: string;
  message: string;
  buttonText?: string;
  variant?: "info" | "success" | "warning" | "error";
}

interface DialogContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  alert: (options: AlertOptions | string) => Promise<void>;
  loading: (message?: string) => void;
  closeLoading: () => void;
}

const DialogContext = createContext<DialogContextType | null>(null);

export const DialogProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Confirm state
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  // Alert state
  const [alertState, setAlertState] = useState<{
    isOpen: boolean;
    options: AlertOptions;
    resolve: () => void;
  } | null>(null);

  // Loading state
  const [loadingState, setLoadingState] = useState<{
    isOpen: boolean;
    message: string;
  } | null>(null);

  const confirm = useCallback((options: ConfirmOptions | string): Promise<boolean> => {
    return new Promise((resolve) => {
      const opts: ConfirmOptions = typeof options === "string" ? { message: options } : options;
      setConfirmState({
        isOpen: true,
        options: opts,
        resolve,
      });
    });
  }, []);

  const alert = useCallback((options: AlertOptions | string): Promise<void> => {
    return new Promise((resolve) => {
      const opts: AlertOptions = typeof options === "string" ? { message: options } : options;
      setAlertState({
        isOpen: true,
        options: opts,
        resolve,
      });
    });
  }, []);

  const loading = useCallback((message: string = "جاري التحميل..."): void => {
    setLoadingState({ isOpen: true, message });
  }, []);

  const closeLoading = useCallback((): void => {
    setLoadingState(null);
  }, []);

  const handleConfirmResponse = (value: boolean) => {
    if (confirmState) {
      confirmState.resolve(value);
      setConfirmState(null);
    }
  };

  const handleAlertClose = () => {
    if (alertState) {
      alertState.resolve();
      setAlertState(null);
    }
  };

  return (
    <DialogContext.Provider value={{ confirm, alert, loading, closeLoading }}>
      {children}

      {/* Loading Overlay */}
      {loadingState?.isOpen && (
        <div className="fixed inset-0 z-[999999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-sm w-full p-6 border border-slate-200 dark:border-slate-700 dir-rtl text-center flex flex-col items-center justify-center gap-4 transform transition-all scale-100">
            <div className="p-3 bg-blue-50 dark:bg-blue-950/50 rounded-2xl text-blue-600 dark:text-blue-400">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 leading-relaxed">
              {loadingState.message}
            </p>
          </div>
        </div>
      )}

      {/* Confirm Modal */}
      {confirmState?.isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 dir-rtl text-right transform transition-all scale-100">
            <div className="flex items-start gap-4">
              <div
                className={`p-3 rounded-xl flex-shrink-0 ${
                  confirmState.options.variant === "danger"
                    ? "bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
                    : confirmState.options.variant === "success"
                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
                    : "bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
                }`}
              >
                {confirmState.options.variant === "danger" ? (
                  <Trash2 className="w-6 h-6" />
                ) : (
                  <AlertTriangle className="w-6 h-6" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {confirmState.options.title || "تأكيد الإجراء"}
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                  {confirmState.options.message}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700/50">
              <button
                type="button"
                onClick={() => handleConfirmResponse(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
              >
                {confirmState.options.cancelText || "إلغاء"}
              </button>
              <button
                type="button"
                onClick={() => handleConfirmResponse(true)}
                className={`px-5 py-2 text-sm font-semibold text-white rounded-xl shadow-sm transition-all ${
                  confirmState.options.variant === "danger"
                    ? "bg-rose-600 hover:bg-rose-700 shadow-rose-600/20"
                    : "bg-blue-600 hover:bg-blue-700 shadow-blue-600/20"
                }`}
              >
                {confirmState.options.confirmText || "موافق"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Alert Modal */}
      {alertState?.isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 dir-rtl text-right">
            <div className="flex items-start gap-4">
              <div
                className={`p-3 rounded-xl flex-shrink-0 ${
                  alertState.options.variant === "error"
                    ? "bg-rose-100 text-rose-600 dark:bg-rose-950/50 dark:text-rose-400"
                    : alertState.options.variant === "success"
                    ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400"
                    : alertState.options.variant === "warning"
                    ? "bg-amber-100 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400"
                    : "bg-blue-100 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400"
                }`}
              >
                {alertState.options.variant === "error" ? (
                  <XCircle className="w-6 h-6" />
                ) : alertState.options.variant === "success" ? (
                  <CheckCircle2 className="w-6 h-6" />
                ) : alertState.options.variant === "warning" ? (
                  <AlertTriangle className="w-6 h-6" />
                ) : (
                  <Info className="w-6 h-6" />
                )}
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                  {alertState.options.title || (alertState.options.variant === "error" ? "تنبيه خطأ" : alertState.options.variant === "success" ? "تم بنجاح" : "تنبيه")}
                </h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                  {alertState.options.message}
                </p>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-end pt-4 border-t border-slate-100 dark:border-slate-700/50">
              <button
                type="button"
                onClick={handleAlertClose}
                className="px-6 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all"
              >
                {alertState.options.buttonText || "حسناً"}
              </button>
            </div>
          </div>
        </div>
      )}
    </DialogContext.Provider>
  );
};

export const useDialog = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return context;
};
