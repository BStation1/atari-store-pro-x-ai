export interface AuditLogEntry {
  id: string;
  timestamp: string;
  action:
    | "CREATE_INVOICE"
    | "UPDATE_INVOICE"
    | "DELETE_INVOICE"
    | "CANCEL_INVOICE"
    | "CREATE_REPAIR_ORDER"
    | "UPDATE_REPAIR_ORDER"
    | "RECEIVE_DEVICE"
    | "DELIVER_DEVICE"
    | "REOPEN_DELIVERY"
    | "PAYMENT_COLLECTED"
    | "CONVERT_GUEST_CUSTOMER"
    | "ADJUST_INVENTORY"
    | "UPDATE_PRICE"
    | "UPDATE_SETTINGS"
    | "MONTHLY_CLOSING"
    | "MONTHLY_REOPEN";
  userId: string;
  userName: string;
  userRole: string;
  targetId?: string;
  targetType?: string;
  details: string;
  metadata?: Record<string, any>;
}

const AUDIT_LOGS_STORAGE_KEY = "atari_audit_logs_v1";

export function getAuditLogs(): AuditLogEntry[] {
  try {
    const raw = localStorage.getItem(AUDIT_LOGS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.error("Failed to read audit logs:", err);
    return [];
  }
}

export function logAudit(entry: Omit<AuditLogEntry, "id" | "timestamp">): AuditLogEntry {
  const newEntry: AuditLogEntry = {
    ...entry,
    id: "AUD-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
    timestamp: new Date().toISOString()
  };

  const current = getAuditLogs();
  // Keep last 1000 audit logs
  const updated = [newEntry, ...current].slice(0, 1000);

  try {
    localStorage.setItem(AUDIT_LOGS_STORAGE_KEY, JSON.stringify(updated));
  } catch (err) {
    console.error("Failed to persist audit log:", err);
  }

  return newEntry;
}

export function clearAuditLogs(): void {
  localStorage.removeItem(AUDIT_LOGS_STORAGE_KEY);
}
