import fs from 'node:fs';

const file = 'src/context/DialogContext.tsx';
let source = fs.readFileSync(file, 'utf8');

if (!source.includes('interface PromptOptions')) {
  source = source.replace(
`interface AlertOptions {
  title?: string;
  message: string;
  buttonText?: string;
  variant?: "info" | "success" | "warning" | "error";
}
`,
`interface AlertOptions {
  title?: string;
  message: string;
  buttonText?: string;
  variant?: "info" | "success" | "warning" | "error";
}

interface PromptOptions {
  title?: string;
  message: string;
  placeholder?: string;
  defaultValue?: string;
  confirmText?: string;
  cancelText?: string;
  inputType?: "text" | "number";
}
`
  );

  source = source.replace(
`interface DialogContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  alert: (options: AlertOptions | string) => Promise<void>;
  loading: (message?: string) => void;
  closeLoading: () => void;
}
`,
`interface DialogContextType {
  confirm: (options: ConfirmOptions | string) => Promise<boolean>;
  alert: (options: AlertOptions | string) => Promise<void>;
  prompt: (options: PromptOptions | string) => Promise<string | null>;
  loading: (message?: string) => void;
  closeLoading: () => void;
}
`
  );

  source = source.replace(
`  // Loading state
  const [loadingState, setLoadingState] = useState<{
    isOpen: boolean;
    message: string;
  } | null>(null);
`,
`  // Prompt state
  const [promptState, setPromptState] = useState<{
    isOpen: boolean;
    options: PromptOptions;
    value: string;
    resolve: (value: string | null) => void;
  } | null>(null);

  // Loading state
  const [loadingState, setLoadingState] = useState<{
    isOpen: boolean;
    message: string;
  } | null>(null);
`
  );

  source = source.replace(
`  const loading = useCallback((message: string = "جاري التحميل..."): void => {
`,
`  const prompt = useCallback((options: PromptOptions | string): Promise<string | null> => {
    return new Promise((resolve) => {
      const opts: PromptOptions = typeof options === "string" ? { message: options } : options;
      setPromptState({
        isOpen: true,
        options: opts,
        value: opts.defaultValue || "",
        resolve,
      });
    });
  }, []);

  const loading = useCallback((message: string = "جاري التحميل..."): void => {
`
  );

  source = source.replace(
`  const handleAlertClose = () => {
    if (alertState) {
      alertState.resolve();
      setAlertState(null);
    }
  };
`,
`  const handleAlertClose = () => {
    if (alertState) {
      alertState.resolve();
      setAlertState(null);
    }
  };

  const handlePromptResponse = (confirmed: boolean) => {
    if (!promptState) return;
    promptState.resolve(confirmed ? promptState.value : null);
    setPromptState(null);
  };
`
  );

  source = source.replace(
`    <DialogContext.Provider value={{ confirm, alert, loading, closeLoading }}>
`,
`    <DialogContext.Provider value={{ confirm, alert, prompt, loading, closeLoading }}>
`
  );

  const modalNeedle = `      {/* Alert Modal */}`;
  const promptModal = `      {/* Prompt Modal */}
      {promptState?.isOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700 dir-rtl text-right">
            <div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {promptState.options.title || "إدخال البيانات"}
              </h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {promptState.options.message}
              </p>
              <input
                autoFocus
                type={promptState.options.inputType || "text"}
                value={promptState.value}
                onChange={(e) => setPromptState(prev => prev ? { ...prev, value: e.target.value } : prev)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handlePromptResponse(true);
                  if (e.key === "Escape") handlePromptResponse(false);
                }}
                placeholder={promptState.options.placeholder || ""}
                className="mt-4 w-full rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-blue-500"
                dir="auto"
              />
            </div>
            <div className="mt-6 flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-700/50">
              <button
                type="button"
                onClick={() => handlePromptResponse(false)}
                className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 rounded-xl transition-colors"
              >
                {promptState.options.cancelText || "إلغاء"}
              </button>
              <button
                type="button"
                onClick={() => handlePromptResponse(true)}
                className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-all"
              >
                {promptState.options.confirmText || "موافق"}
              </button>
            </div>
          </div>
        </div>
      )}

`;
  if (!source.includes(modalNeedle)) throw new Error('Alert modal marker not found in DialogContext');
  source = source.replace(modalNeedle, promptModal + modalNeedle);

  fs.writeFileSync(file, source, 'utf8');
}

console.log('DialogContext prompt() support installed.');
