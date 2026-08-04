/**
 * Analytics Date Utilities (Phase 3UI.2C - Analytics Engine)
 * Pure date calculations, boundaries, formatting, and date range filters for analytics metrics.
 * @license Apache-2.0
 */

import { DateRangeOption, DateRangeFilter } from './analyticsTypes';

export const DATE_RANGE_OPTIONS: DateRangeFilter[] = [
  { option: 'today', labelAr: 'اليوم' },
  { option: 'last7days', labelAr: 'آخر 7 أيام' },
  { option: 'last30days', labelAr: 'آخر 30 يوماً' },
  { option: 'thisMonth', labelAr: 'هذا الشهر' },
  { option: 'thisYear', labelAr: 'هذه السنة' },
  { option: 'allTime', labelAr: 'كل الأوقات' }
];

export function getDateRangeBounds(option: DateRangeOption): {
  start: Date | null;
  end: Date | null;
  labelAr: string;
} {
  const now = new Date();
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (option) {
    case 'today': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      return { start, end, labelAr: 'اليوم' };
    }
    case 'last7days': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      return { start, end, labelAr: 'آخر 7 أيام' };
    }
    case 'last30days': {
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
      return { start, end, labelAr: 'آخر 30 يوماً' };
    }
    case 'thisMonth': {
      const start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      return { start, end, labelAr: 'هذا الشهر' };
    }
    case 'thisYear': {
      const start = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
      return { start, end, labelAr: 'هذه السنة' };
    }
    case 'allTime':
    default: {
      return { start: null, end: null, labelAr: 'كل الأوقات' };
    }
  }
}

export function isDateInRange(
  dateInput: string | Date | undefined | null,
  start: Date | null,
  end: Date | null
): boolean {
  if (!dateInput) return false;
  if (!start && !end) return true; // allTime

  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  if (isNaN(d.getTime())) return false;

  if (start && d < start) return false;
  if (end && d > end) return false;

  return true;
}

export function formatDateKey(date: Date): string {
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

export function formatArabicDisplayDate(date: Date): string {
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      day: 'numeric',
      month: 'short'
    }).format(date);
  } catch {
    return formatDateKey(date);
  }
}

export function formatArabicTime(date: Date): string {
  try {
    return new Intl.DateTimeFormat('ar-EG', {
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch {
    return date.toLocaleTimeString();
  }
}

export function formatCurrencyArabic(amount: number): string {
  const safeVal = isNaN(amount) || !isFinite(amount) ? 0 : amount;
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP',
    maximumFractionDigits: 0
  }).format(safeVal);
}
