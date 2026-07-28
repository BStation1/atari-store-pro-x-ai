/**
 * Repair Status Mapping (Phase 3UI.1)
 * Centralized metadata mapping for all RepairStatus enum values.
 * Provides Arabic labels, status badge variants, accessibility text, and icon indicators.
 * @license Apache-2.0
 */

import { RepairStatus } from '../../types';

export interface RepairStatusConfig {
  status: RepairStatus | string;
  labelAr: string;
  labelEn: string;
  variant: 'neutral' | 'warning' | 'info' | 'accent' | 'success' | 'danger';
  descriptionAr: string;
}

export const REPAIR_STATUS_MAP: Record<string, RepairStatusConfig> = {
  [RepairStatus.Received]: {
    status: RepairStatus.Received,
    labelAr: 'مستلمة',
    labelEn: 'Received',
    variant: 'info',
    descriptionAr: 'تم استلام الجهاز بالمركز وفي انتظار الفحص الفني'
  },
  [RepairStatus.Diagnosing]: {
    status: RepairStatus.Diagnosing,
    labelAr: 'تحت الفحص',
    labelEn: 'Diagnosing',
    variant: 'warning',
    descriptionAr: 'يقوم المهندس الفني بفحص وتحديد العطل حالياً'
  },
  [RepairStatus.WaitingCustomerApproval]: {
    status: RepairStatus.WaitingCustomerApproval,
    labelAr: 'بانتظار الموافقة',
    labelEn: 'Waiting Approval',
    variant: 'warning',
    descriptionAr: 'تم الفحص وفي انتظار موافقة العميل على المقايسة واليعار'
  },
  [RepairStatus.WaitingParts]: {
    status: RepairStatus.WaitingParts,
    labelAr: 'بانتظار قطع الغيار',
    labelEn: 'Waiting Parts',
    variant: 'warning',
    descriptionAr: 'تم تحديد المشكلة وفي انتظار توفير قطع الغيار المطلوبة'
  },
  [RepairStatus.Repairing]: {
    status: RepairStatus.Repairing,
    labelAr: 'قيد الإصلاح',
    labelEn: 'Repairing',
    variant: 'accent',
    descriptionAr: 'عملية الصيانة الجسيمة قائمة حالياً داخل ورشة الصيانة'
  },
  [RepairStatus.Testing]: {
    status: RepairStatus.Testing,
    labelAr: 'تحت التجربة',
    labelEn: 'Testing',
    variant: 'info',
    descriptionAr: 'تم الإصلاح والجهاز يخضع للاختبار وضبط الجودة'
  },
  [RepairStatus.Ready]: {
    status: RepairStatus.Ready,
    labelAr: 'جاهزة للاستلام',
    labelEn: 'Ready for Pickup',
    variant: 'success',
    descriptionAr: 'اكتملت الصيانة والجهاز جاهز للتسليم للعميل'
  },
  [RepairStatus.Delivered]: {
    status: RepairStatus.Delivered,
    labelAr: 'تم التسليم',
    labelEn: 'Delivered',
    variant: 'neutral',
    descriptionAr: 'تم تسليم الجهاز للعميل وتحصيل المبلغ وإصدار الضمان'
  },
  [RepairStatus.Cancelled]: {
    status: RepairStatus.Cancelled,
    labelAr: 'ملغاة',
    labelEn: 'Cancelled',
    variant: 'danger',
    descriptionAr: 'تم إلغاء أمر الصيانة وإعادة الجهاز دون إصلاح'
  }
};

/**
 * Returns safe status configuration for any status string (including unknown/legacy status).
 */
export function getRepairStatusConfig(rawStatus?: string): RepairStatusConfig {
  if (!rawStatus || rawStatus === 'UNKNOWN' || rawStatus === 'UNAVAILABLE') {
    return {
      status: 'UNKNOWN',
      labelAr: 'حالة غير محددة',
      labelEn: 'Unknown Status',
      variant: 'neutral',
      descriptionAr: 'حالة الصيانة غير محددة'
    };
  }

  if (REPAIR_STATUS_MAP[rawStatus]) {
    return REPAIR_STATUS_MAP[rawStatus];
  }

  // Fallback for unknown status strings
  return {
    status: rawStatus,
    labelAr: rawStatus,
    labelEn: rawStatus,
    variant: 'neutral',
    descriptionAr: `حالة صيانة غير مألوفة (${rawStatus})`
  };
}
