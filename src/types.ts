/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { UserRole } from "./lib/authPermissions";
export type { UserRole };

export enum DeviceType {
  PS5 = "PS5",
  PS5_Slim = "PS5 Slim",
  PS5_Pro = "PS5 Pro",
  PS4 = "PS4",
  PS4_Slim = "PS4 Slim",
  PS4_Pro = "PS4 Pro",
  Xbox_One = "Xbox One",
  Xbox_Series_S = "Xbox Series S",
  Xbox_Series_X = "Xbox Series X",
  Nintendo_Switch = "Nintendo Switch",
  Steam_Deck = "Steam Deck",
  Controller_PS5 = "Controller PS5",
  Controller_PS4 = "Controller PS4",
  Xbox_Controller = "Xbox Controller",
  Nintendo_Controller = "Nintendo Controller",
  Accessory = "Accessory",
  Other = "Other"
}

export enum RepairStatus {
  Received = "Received",                     // مستلمة
  Diagnosing = "Diagnosing",                 // تحت الفحص
  WaitingCustomerApproval = "Waiting Approval", // بانتظار موافقة العميل
  WaitingParts = "Waiting Parts",             // بانتظار قطع الغيار
  Repairing = "Repairing",                   // قيد الإصلاح
  Testing = "Testing",                       // تحت التجربة
  Ready = "Ready",                           // جاهزة للاستلام
  Delivered = "Delivered",                   // تم التسليم
  Cancelled = "Cancelled"                    // ملغاة
}

export enum CustomerType {
  Individual = "Individual", // فردي
  Shop = "Shop",             // محل
  VIP = "VIP",               // عميل مميز
  Wholesale = "Wholesale",   // جملة
  Guest = "Guest"            // زائر
}

export enum WorkOwnershipType {
  CUSTOMER_SHARED = "CUSTOMER_SHARED",     // شغل العملاء
  PARTNER_1_PRIVATE = "PARTNER_1_PRIVATE", // شغلي الخاص
  PARTNER_2_PRIVATE = "PARTNER_2_PRIVATE"  // شغل عبده الخاص
}

export enum PaymentMethod {
  Cash = "Cash",       // نقدي
  InstaPay = "InstaPay", // انستا باي
  Visa = "Visa",       // فيزا
  VodafoneCash = "Vodafone Cash", // فودافون كاش
  CashOnDelivery = "CASH_ON_DELIVERY" // دفع عند الاستلام
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  type: CustomerType;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
  balance: number; // outstanding balance
  isActive?: boolean;
  isArchived?: boolean;
}

export type WarrantyDurationOption =
  | "NO_WARRANTY"   // بدون ضمان
  | "DAYS_7"        // 7 أيام
  | "DAYS_15"       // 15 يومًا
  | "DAYS_30"       // 30 يومًا
  | "DAYS_60"       // 60 يومًا
  | "DAYS_90"       // 90 يومًا
  | "DAYS_180"      // 180 يومًا
  | "YEAR_1"        // سنة
  | "CUSTOM";       // مدة مخصصة

export interface SelectedRepairItem {
  id: string;
  name: string;
  quantity: number;
  costPrice: number;
  repairPrice: number;
  productId?: string;
  isCustom?: boolean;
}

export interface RepairTemplateItem {
  id: string;
  deviceTypeId?: string;  // e.g. "DT-001"
  categoryId?: string;    // Alias for deviceTypeId
  deviceModelId?: string; // e.g. "DM-001" or category-wide
  modelId?: string;       // Alias for deviceModelId
  nameAr: string;
  nameEn?: string;
  productId?: string;     // Linked product ID from inventory
  defaultCostPrice: number;
  defaultRepairPrice: number;
  sortOrder: number;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface QuickFaultItem {
  id: string;
  label: string;
  defaultSellingPrice: number;
}

export const QUICK_FAULTS_LIST: QuickFaultItem[] = [
  { id: "hdmi", label: "تغيير سوكت HDMI", defaultSellingPrice: 400 },
  { id: "cleaning", label: "تنظيف صيانة دورية + معجون حراري", defaultSellingPrice: 300 },
  { id: "power", label: "إصلاح باور", defaultSellingPrice: 500 },
  { id: "fan", label: "تغيير مروحة التبريد", defaultSellingPrice: 350 },
  { id: "analog", label: "تغيير أنالوج / عصا التحكم", defaultSellingPrice: 150 },
  { id: "charging_port", label: "تغيير سوكت شحن اليد", defaultSellingPrice: 100 },
  { id: "battery", label: "تغيير بطارية اليد", defaultSellingPrice: 200 }
];

export interface RepairTimelineEvent {
  id: string;
  orderId: string;
  deviceId?: string;
  eventType: 
    | "ORDER_RECEIVED"
    | "TRANSFERRED_INSPECTION"
    | "INSPECTION_STARTED"
    | "DIAGNOSIS_SET"
    | "PROCEDURE_ADDED"
    | "PROCEDURE_REMOVED"
    | "PART_ADDED"
    | "PART_QTY_CHANGED"
    | "PART_REMOVED"
    | "PRICE_CHANGED"
    | "REPAIR_APPROVED"
    | "REPAIR_COMPLETED"
    | "READY_FOR_DELIVERY"
    | "DELIVERED_TO_CUSTOMER"
    | "STATUS_CHANGED"
    | "TECHNICIAN_CHANGED"
    | "NOTE_ADDED";
  timestamp: string;
  userId?: string;
  userName?: string;
  note?: string;
  details?: Record<string, any>;
}

export interface RepairAuditLogRecord {
  id: string;
  orderId: string;
  deviceId?: string;
  userId: string;
  userName: string;
  userRole?: string;
  timestamp: string;
  actionType:
    | "ADD_PART"
    | "DELETE_PART"
    | "CHANGE_PART_QTY"
    | "CHANGE_SELL_PRICE"
    | "CHANGE_COST_PRICE"
    | "ADD_PROCEDURE"
    | "DELETE_PROCEDURE"
    | "CHANGE_DIAGNOSIS"
    | "CHANGE_STATUS"
    | "CHANGE_TECHNICIAN"
    | "CHANGE_FAULTS"
    | "CHANGE_OWNERSHIP"
    | "CHANGE_DEDUCTION_RATE"
    | "OTHER_EDIT";
  fieldName?: string;
  oldValue?: string | number | null;
  newValue?: string | number | null;
  notes?: string;
}

export interface RepairDevice {
  id: string;
  type: DeviceType;
  model: string;
  serialNumber: string;
  color: string;
  imageUrl?: string;
  accessories: string; // e.g., "كابل، ذراع، بدون علبة"
  issue: string; // Summary of customer complaint
  reportedFaults?: string[]; // Explicit array of customer reported faults/complaints
  diagnosisText?: string; // Technical diagnosis recorded by technician
  technicalProcedures?: SelectedRepairItem[]; // Technical repair actions performed by technician
  needsInspection?: boolean;
  selectedRepairItems?: SelectedRepairItem[];
  selectedQuickFaults?: string[];
  suggestedRepairPrice?: number;
  finalRepairPrice?: number;
  isPriceManuallyEdited?: boolean;
  priceOverrideAcknowledged?: boolean;
  technicianNotes?: string;
  internalNotes?: string;
  estimatedCost: number;
  partsCost: number;
  laborCost: number;
  status: RepairStatus;
  technicianId?: string;
  warrantyOption?: WarrantyDurationOption;
  warrantyDays?: number;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  warrantyStatus?: "IN_WARRANTY" | "EXPIRED" | "NO_WARRANTY" | "CANCELLED";
  warrantyCancelledAt?: string;
  warrantyCancelledByUserId?: string;
  warrantyCancelledByUserName?: string;
  warrantyCancelReason?: string;
  devicePassword?: string;
}

export interface DeliverySnapshot {
  version: number;
  deliveredAt: string;
  deliveredByUserId: string;
  deliveredByUserName: string;
  totalEstimatedCost: number;
  discount: number;
  totalPaid: number;
  remainingBalance: number;
  paymentMethod: PaymentMethod | string;
  deliveryNotes?: string;
  partsUsed?: RepairPartUsage[];
  devices?: RepairDevice[];
  invoiceId?: string;
}

export interface DeliveryReopenLog {
  reopenedAt: string;
  reopenedByUserId: string;
  reopenedByUserName: string;
  reopenReason: string;
  previousSnapshot?: DeliverySnapshot;
}

export interface RepairOrder {
  id: string; // e.g., ATR-10000
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  customerAltPhone?: string;
  customerType?: "GUEST" | "REGISTERED";
  guestCustomerName?: string;
  guestCustomerPhone?: string;
  guestCustomerAltPhone?: string;
  guestCustomerNote?: string;
  customerNameSnapshot?: string;
  customerPhoneSnapshot?: string;
  devices: RepairDevice[];
  totalEstimatedCost: number;
  selectedQuickFaults?: string[];
  suggestedRepairPrice?: number;
  finalRepairPrice?: number;
  advancePayment: number;
  status: RepairStatus; // overall order status
  receivedDate: string;
  completionDate?: string;
  notes?: string;
  isPaid: boolean;
  trackingToken: string;
  workOwnershipType?: WorkOwnershipType;
  jobType?: WorkOwnershipType;
  workOwnerPartnerId?: string;
  partnerDeductionRate?: number;
  otherDirectCosts?: number;
  discount?: number;
  refundAmount?: number;
  isSettled?: boolean;
  settlementId?: string;
  // Warranty System Fields
  warrantyOption?: WarrantyDurationOption;
  warrantyDays?: number;
  warrantyStartDate?: string;
  warrantyEndDate?: string;
  warrantyStatus?: "IN_WARRANTY" | "EXPIRED" | "NO_WARRANTY" | "CANCELLED";
  warrantyCancelledAt?: string;
  warrantyCancelledByUserId?: string;
  warrantyCancelledByUserName?: string;
  warrantyCancelReason?: string;
  isWarrantyClaim?: boolean;
  parentOrderId?: string;
  warrantyClaimType?: "IN_WARRANTY_REPAIR" | "NEW_OUT_OF_WARRANTY_REPAIR";
  // Device Delivery & Locking System fields
  deliveredAt?: string;
  deliveredByUserId?: string;
  deliveredByUserName?: string;
  deliveryStatus?: "DELIVERED" | "NOT_DELIVERED";
  deliveryNotes?: string;
  deliverySnapshot?: DeliverySnapshot;
  deliveryHistory?: DeliverySnapshot[];
  deliveryVersion?: number;
  reopenedAt?: string;
  reopenedByUserId?: string;
  reopenedByUserName?: string;
  reopenReason?: string;
  reopenLogs?: DeliveryReopenLog[];
  // Repair Timeline & Technical Audit Log Fields
  timelineEvents?: RepairTimelineEvent[];
  auditLogs?: RepairAuditLogRecord[];
}

export interface Product {
  id: string;
  name: string;
  nameAr?: string;
  category: string;
  barcode: string;
  sku: string;
  purchasePrice: number;
  sellPrice: number;
  quantity: number;
  minStock: number;
  location?: string; // block location in store
  brand?: string;
  compatibleDeviceTypes?: string[];
  compatibleModels?: string[];
  supplier?: string;
  technicianCost?: number;
  wholesalePrice?: number;
  minSellPrice?: number;
  unit?: string;
  notes?: string;
  isActive?: boolean;
  isArchived?: boolean;
  stockOwnership?: 'AHMED' | 'ABDO' | 'SHARED';
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface InventoryMovement {
  id: string;
  productId: string;
  movementType: 'SALE' | 'PURCHASE' | 'RETURN' | 'REPAIR_USAGE' | 'ADJUSTMENT' | 'DELETION_RESTORE';
  quantityChange: number;
  previousQuantity: number;
  newQuantity: number;
  costPriceSnapshot: number;
  sellingPriceSnapshot: number;
  referenceId?: string;
  notes?: string;
  createdByUserId?: string;
  createdAt: string;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string;
  company: string;
  email?: string;
  address?: string;
  notes?: string;
  balance: number;
  isActive?: boolean;
  isArchived?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface InvoiceItem {
  productId?: string;
  name: string;
  quantity: number;
  price: number;
  costPrice?: number;
  stockOwnership?: 'AHMED' | 'ABDO' | 'SHARED';
}

export type InvoiceCustomerType = 'REGISTERED' | 'GUEST';
export type DeliveryStatus = 'PENDING' | 'READY' | 'OUT_FOR_DELIVERY' | 'DELIVERED' | 'CANCELLED';

export interface Invoice {
  id: string; // e.g., INV-2026-001
  customerId?: string;
  orderId?: string; // if linked to a repair order
  items: InvoiceItem[];
  totalAmount: number;
  discount: number;
  paidAmount: number;
  paymentMethod: PaymentMethod | string;
  date: string;
  type: "repair" | "sales" | "parts_sale";
  isPaid: boolean;

  // Guest Customer & Snapshot fields
  customerType?: InvoiceCustomerType;
  guestCustomerName?: string;
  guestCustomerPhone?: string;
  guestCustomerNote?: string;
  customerNameSnapshot?: string;
  customerPhoneSnapshot?: string;

  // Delivery & Cash on Delivery (COD) fields
  orderStatus?: DeliveryStatus;
  deliveredAt?: string;
  deliveredByUserId?: string;
  deliveredByUserName?: string;
  collectedAt?: string;
  collectedByUserId?: string;
  collectedByUserName?: string;

  // Cancellation fields
  isCancelled?: boolean;
  cancelledAt?: string;
  cancelledByUserId?: string;
  cancelledByUserName?: string;
  cancelReason?: string;
}

export interface SystemErrorLog {
  id: string;
  createdAt: string;
  userId?: string;
  userRole?: string;
  page?: string;
  rpcName?: string;
  errorMessage: string;
  stackTrace?: string;
  browser?: string;
  device?: string;
  url?: string;
  metadata?: any;
  severity?: 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface BackupMetadata {
  id: string;
  createdAt: string;
  type: 'AUTOMATIC' | 'MANUAL';
  sizeBytes: number;
  durationMs: number;
  status: 'SUCCESS' | 'FAILED' | 'IN_PROGRESS';
  createdByUserId?: string;
  createdByUserName?: string;
  restoreTestedAt?: string;
  restoreTestStatus?: 'PASSED' | 'FAILED' | 'PENDING';
  notes?: string;
}

export interface SystemHealthMetrics {
  databaseStatus: 'HEALTHY' | 'DEGRADED' | 'DOWN';
  authStatus: 'HEALTHY' | 'DOWN';
  rpcStatus: 'HEALTHY' | 'DEGRADED';
  avgResponseTimeMs: number;
  errorCount24h: number;
  storageUsageBytes: number;
  invoiceCount: number;
  guestInvoiceCount: number;
  customerCount: number;
  productCount: number;
  inventoryMovementCount: number;
  partnerLedgerCount: number;
  accountingLedgerCount: number;
  pendingCodCount: number;
  deliveredCodCount: number;
  lastBackupDate?: string;
  lastBackupStatus?: string;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  createdBy: string;
  expenseOwner?: 'AHMED' | 'ABDO' | 'SHARED';
  // Cancellation fields
  isCancelled?: boolean;
  cancelledAt?: string;
  cancelledByUserId?: string;
  cancelledByUserName?: string;
  cancelReason?: string;
}

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  type: "info" | "warning" | "alert" | "success";
  category: "repair" | "warranty" | "inventory" | "accounting" | "customer";
  linkView?: string;
  linkParams?: any;
  isRead: boolean;
  createdAt: string;
  entityId?: string;
  entityType?: string;
}

export interface AuditLogRecord {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  oldValues?: any;
  newValues?: any;
  reason?: string;
  userId: string;
  userName: string;
  timestamp: string;
}

export interface User {
  id: string;
  fullName: string;
  username: string;
  email: string;
  phone?: string;
  roleId: UserRole;
  permissions: string[];
  isActive: boolean;
  mustChangePassword?: boolean;
  lastLoginAt?: string;
  failedLoginAttempts?: number;
  lockedUntil?: string;
  branch?: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: string;
  updatedBy?: string;
  passwordHash?: string;
  // Backward compatibility fields
  name?: string;
  role?: string;
  isOnline?: boolean;
  avatarUrl?: string;
}

export interface ActivityLog {
  id: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
  timestamp: string;
}

export interface SystemSettings {
  companyName: string;
  phone: string;
  address: string;
  logoUrl?: string;
  receiptHeader: string;
  receiptFooter: string;
  whatsAppTemplateReceived: string;
  whatsAppTemplateReady: string;
  whatsAppTemplateInvoice: string;
  taxRate: number;
  currency: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  parentId?: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  isArchived?: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DBDeviceType {
  id: string;
  nameAr: string;
  nameEn: string;
  brand: string;
  icon?: string;
  sortOrder: number;
  isActive: boolean;
  isArchived?: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DBDeviceModel {
  id: string;
  deviceTypeId: string; // Links to DBDeviceType.id
  brand: string;
  nameAr: string;
  nameEn: string;
  modelCode: string;
  storageOptions?: string; // Comma-separated (e.g. "500GB, 1TB")
  defaultWarrantyDays?: number;
  defaultInspectionPrice?: number;
  defaultRepairPrice?: number;
  notes?: string;
  isActive: boolean;
  isArchived?: boolean;
  sortOrder: number;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface CommonFault {
  id: string;
  nameAr: string;
  nameEn: string;
  deviceTypeId: string; // Links to DBDeviceType.id
  deviceModelId?: string; // Links to DBDeviceModel.id
  faultCategory?: string;
  customerDescriptionAr?: string;
  techDiagnosisTemplateAr?: string;
  defaultRepairNotesAr?: string;
  defaultInspectionPrice?: number;
  defaultRepairPrice?: number;
  estimatedHours?: number;
  suggestedParts?: string; // Comma-separated or product details
  warrantyDays?: number;
  priority?: "low" | "medium" | "high";
  isActive: boolean;
  isArchived?: boolean;
  sortOrder: number;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface RepairService {
  id: string;
  nameAr: string;
  deviceTypeId: string; // Links to DBDeviceType.id
  deviceModelId?: string; // Links to DBDeviceModel.id
  commonFaultId?: string; // Links to CommonFault.id
  defaultLaborPrice: number;
  minPrice: number;
  estimatedHours?: number;
  warrantyDays?: number;
  suggestedParts?: string;
  technicianInstructions?: string;
  customerDescription?: string;
  isActive: boolean;
  isArchived?: boolean;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DefaultPrice {
  id: string;
  deviceTypeId?: string;
  deviceModelId?: string;
  commonFaultId?: string;
  serviceId?: string;
  customerType?: CustomerType;
  defaultInspectionPrice?: number;
  defaultRepairPrice?: number;
  minRepairPrice?: number;
  maxEstimatedPrice?: number;
  laborCost?: number;
  partCostEstimate?: number;
  wholesalePrice?: number;
  shopPrice?: number;
  vipPrice?: number;
  warrantyPeriodDays?: number;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReceivedAccessory {
  id: string;
  nameAr: string;
  isArchived?: boolean;
  sortOrder: number;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface DeviceCondition {
  id: string;
  nameAr: string;
  isArchived?: boolean;
  sortOrder: number;
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
}

// ==========================================
// PARTNER ACCOUNTING MODULE INTERFACES
// ==========================================

export interface Partner {
  id: string; // e.g., P-001 (أحمد البنا), P-002 (عبده)
  name: string;
  nameAr: string;
  sharePercentage: number; // 50
  isSystemOwner: boolean;
  balance: number;
  phone?: string;
  notes?: string;
  createdAt?: string;
}

export type PartnerLedgerType =
  | "OPENING_BALANCE"
  | "SHARED_PROFIT_SHARE"
  | "PRIVATE_JOB_PROFIT_SHARE"
  | "PRIVATE_JOB_PARTS_CHARGE"
  | "INVENTORY_WITHDRAWAL"
  | "CASH_ADVANCE"
  | "CASH_WITHDRAWAL"
  | "PARTNER_PAYMENT"
  | "SETTLEMENT_PAYMENT"
  | "MANUAL_ADJUSTMENT"
  | "EXPENSE_CHARGE"
  | "REFUND_ADJUSTMENT"
  | "REVERSAL";

export interface PartnerLedgerEntry {
  id: string;
  partnerId: string;
  transactionDate: string;
  transactionType: PartnerLedgerType;
  sourceType: string;
  sourceId: string;
  repairOrderId?: string;
  settlementId?: string;
  debit: number;
  credit: number;
  amount: number;
  balanceAfter: number;
  currency: string;
  descriptionArabic: string;
  descriptionEnglish?: string;
  notes?: string;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
  reversedAt?: string;
  reversalTransactionId?: string;
  isReversed?: boolean;
}

export type SettlementStatus = "DRAFT" | "UNDER_REVIEW" | "LOCKED" | "PAID" | "PARTIALLY_PAID" | "REVERSED";

export interface PartnerSettlement {
  id: string;
  settlementNumber: string;
  periodStart: string;
  periodEnd: string;
  status: SettlementStatus;
  currency: string;
  sharedRevenue: number;
  sharedPartsCost: number;
  sharedOtherCosts: number;
  sharedNetProfit: number;
  partner1SharedShare: number;
  partner2SharedShare: number;
  partner1PrivateRevenue: number;
  partner1PrivatePartsCost: number;
  partner1PrivateOtherCosts: number;
  partner1PrivateDeduction: number;
  partner2PrivateRevenue: number;
  partner2PrivatePartsCost: number;
  partner2PrivateOtherCosts: number;
  partner2PrivateNetProfit: number;
  partner1ShareFromPartner2Private: number;
  partner2ShareFromPrivateWork: number;
  partner1Advances: number;
  partner2Advances: number;
  partner1Withdrawals: number;
  partner2Withdrawals: number;
  partner1Adjustments: number;
  partner2Adjustments: number;
  partner1FinalBalance: number;
  partner2FinalBalance: number;
  preparedBy: string;
  reviewedBy?: string;
  lockedBy?: string;
  lockedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PartnerSettlementPayment {
  id: string;
  settlementId: string;
  partnerId: string;
  amount: number;
  paymentMethod: string;
  referenceNumber?: string;
  treasury: string;
  paymentDate: string;
  notes?: string;
  receivedOrPaidBy: string;
  createdAt: string;
}

export type PartnerTransactionType =
  | "CASH_ADVANCE"
  | "CASH_WITHDRAWAL"
  | "INVENTORY_WITHDRAWAL"
  | "EXPENSE_CHARGE"
  | "PAYMENT_TO_PARTNER"
  | "PAYMENT_FROM_PARTNER"
  | "MANUAL_ADJUSTMENT";

export interface PartnerTransaction {
  id: string;
  partnerId: string;
  date: string;
  type: PartnerTransactionType;
  amount: number;
  inventoryItemId?: string;
  quantity?: number;
  unitCost?: number;
  reason: string;
  notes?: string;
  attachment?: string;
  approvedBy: string;
  createdBy: string;
  status: "DRAFT" | "APPROVED" | "REVERSED";
  isReversed?: boolean;
  reversalReason?: string;
  createdAt: string;
}

export interface MonthlySettlementResult {
  id?: string;
  settlementMonth: string; // "YYYY-MM"
  status: "OPEN" | "LOCKED";
  
  // Entitlements strictly from partner_ledger
  ahmedProfitShare: number;
  abdouProfitShare: number;
  ahmedCogsRecovery: number;
  abdouSettlementObligation: number;
  replacementFundDeposits: number;

  // Expenses from expenses table
  sharedExpenses: number;
  ahmedExpenses: number;
  abdouExpenses: number;
  totalExpenses: number;

  // Final Net Calculations
  ahmedNetPayout: number;
  abdouNetPayout: number;
  replacementFundBalance: number;

  lockedAt?: string;
  lockedByUserId?: string;
  lockedByUserName?: string;
  notes?: string;
  reopenAuditLog?: SettlementAuditRecord[];
  createdAt?: string;
  updatedAt?: string;
}

export interface ReplacementFundEntry {
  id?: string;
  transactionType: "DEPOSIT_CUSTOMER_WORK" | "NEW_GOODS_PURCHASE" | "MANUAL_WITHDRAWAL" | "MANUAL_DEPOSIT";
  amount: number;
  signedAmount: number;
  referenceId?: string;
  referenceType?: string;
  description: string;
  createdByUserId?: string;
  createdAt?: string;
}

export interface SettlementAuditRecord {
  id?: string;
  settlementMonth: string;
  action: "CLOSE_MONTH" | "REOPEN_MONTH";
  performedByUserId: string;
  performedByUserName: string;
  reason?: string;
  timestamp: string;
  details?: Record<string, any>;
}

export interface RepairPartUsage {
  id: string;
  repairOrderId: string;
  inventoryItemId: string;
  partName: string;
  sku: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  ownershipType: WorkOwnershipType;
  responsiblePartnerId: string;
  accountingStatus: "RESERVED" | "CONSUMED" | "RETURNED" | "SETTLED" | "REVERSED";
  createdAt: string;
  employeeName?: string;
  warehouse?: string;
}

export interface SettlementAuditLog {
  id: string;
  userId: string;
  action: string;
  entityType: string;
  entityId: string;
  previousValues?: any;
  newValues?: any;
  reason?: string;
  timestamp: string;
}

export interface OperationalResetOptions {
  salesAndReturns: boolean;       // 1- مسح المبيعات والمرتجعات
  accounting: boolean;             // 2- مسح العمليات المحاسبية والمصروفات والمدفوعات
  repairOrders: boolean;           // 3- مسح طلبات الصيانة ودفعاتها
  monthlyClosings: boolean;        // 4- مسح تقفيلات الشهور والتسويات
  notificationsAndLogs: boolean;   // 5- مسح الإشعارات وسجل الأنشطة التجريبية
  customers: boolean;              // 6- مسح العملاء
  inventoryMode: "NONE" | "RESTORE" | "ZERO_ALL"; // 7- تصفير وإعادة ضبط المخزون
}

export interface SystemResetSecurityLog {
  id: string;
  executedByUserId: string;
  executedByUserName: string;
  executedByUserEmail: string;
  timestamp: string;
  wipedSections: string[];
  recordCountsWiped: Record<string, number>;
  inventoryMode: string;
  backupFileName: string;
  status: "SUCCESS" | "FAILED";
  details?: string;
}


