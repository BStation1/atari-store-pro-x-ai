export interface ErrorLogEntry {
  id: string;
  timestamp: string;
  errorType: "RUNTIME" | "RPC" | "DATABASE" | "NETWORK" | "UNEXPECTED";
  message: string;
  stackTrace?: string;
  page?: string;
  action?: string;
  userId?: string;
  userName?: string;
  userRole?: string;
  metadata?: Record<string, any>;
}

const ERROR_LOGS_STORAGE_KEY = "atari_error_logs_v1";

export function getErrorLogs(): ErrorLogEntry[] {
  try {
    const raw = localStorage.getItem(ERROR_LOGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Failed to read error logs:", err);
    return [];
  }
}

export function logSystemError(entry: Omit<ErrorLogEntry, "id" | "timestamp">): ErrorLogEntry {
  const newEntry: ErrorLogEntry = {
    ...entry,
    id: "ERR-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
    timestamp: new Date().toISOString()
  };

  const current = getErrorLogs();
  // Keep last 500 error logs
  const updated = [newEntry, ...current].slice(0, 500);

  try {
    localStorage.setItem(ERROR_LOGS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to persist error log:", err);
  }

  return newEntry;
}

export function clearErrorLogs(): void {
  localStorage.removeItem(ERROR_LOGS_STORAGE_KEY);
}
