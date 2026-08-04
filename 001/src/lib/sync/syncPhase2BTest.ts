/**
 * Phase 2B Mandatory Verification Test Suite
 * @license Apache-2.0
 */

import { createCustomer } from '../data/customers';
import { createRepairOrder } from '../data/repairOrders';
import { createInvoice } from '../data/invoices';
import { createProduct } from '../data/products';
import { createExpense } from '../data/expenses';
import { syncQueue } from './syncQueue';
import { CustomerType, RepairStatus, PaymentMethod } from '../../types';

export interface Phase2BTestResult {
  success: boolean;
  logs: string[];
  queueStatsBefore: any;
  queueStatsAfter: any;
  idempotencyPassed: boolean;
  countsPassed: boolean;
}

export async function runPhase2BVerificationTest(): Promise<Phase2BTestResult> {
  const logs: string[] = [];
  logs.push('=== بدء تشغيل اختبارات المرحلة Phase 2B (Write-Ahead Queue) ===');

  const statsBefore = syncQueue.getStats();
  logs.push(`الحالة الابتدائية بالطابور: Queue Length=${statsBefore.total}, Pending=${statsBefore.pending}`);

  // Step A: Create 3 Customers
  logs.push('--- A. إنشاء 3 عملاء (Customers) ---');
  const c1 = await createCustomer({ name: 'عميل اختبار 1 (Phase 2B)', phone: '01000000001', type: CustomerType.Individual });
  const c2 = await createCustomer({ name: 'عميل اختبار 2 (Phase 2B)', phone: '01000000002', type: CustomerType.Individual });
  const c3 = await createCustomer({ name: 'عميل اختبار 3 (Phase 2B)', phone: '01000000003', type: CustomerType.Individual });
  logs.push(`تم إنشاء العملاء بالمعرفات: ${c1.id}, ${c2.id}, ${c3.id}`);

  // Step B: Create 2 Repair Orders
  logs.push('--- B. إنشاء أمرَي صيانة (Repair Orders) ---');
  const r1 = await createRepairOrder({
    customerId: c1.id,
    customerName: c1.name,
    customerPhone: c1.phone,
    devices: [],
    totalEstimatedCost: 500,
    advancePayment: 100,
    status: RepairStatus.Received,
    receivedDate: new Date().toISOString(),
    isPaid: false,
    trackingToken: `TRK-${Date.now()}-1`
  });
  const r2 = await createRepairOrder({
    customerId: c2.id,
    customerName: c2.name,
    customerPhone: c2.phone,
    devices: [],
    totalEstimatedCost: 300,
    advancePayment: 300,
    status: RepairStatus.Ready,
    receivedDate: new Date().toISOString(),
    isPaid: true,
    trackingToken: `TRK-${Date.now()}-2`
  });
  logs.push(`تم إنشاء أوامر الصيانة بالمعرفات: ${r1.id}, ${r2.id}`);

  // Step C: Create 2 Invoices
  logs.push('--- C. إنشاء فاتورتين (Invoices) ---');
  const i1 = await createInvoice({
    customerId: c1.id,
    items: [],
    totalAmount: 500,
    discount: 0,
    paidAmount: 500,
    paymentMethod: PaymentMethod.Cash,
    date: new Date().toISOString(),
    type: 'sales',
    isPaid: true
  });
  const i2 = await createInvoice({
    customerId: c2.id,
    items: [],
    totalAmount: 350,
    discount: 0,
    paidAmount: 100,
    paymentMethod: PaymentMethod.Cash,
    date: new Date().toISOString(),
    type: 'sales',
    isPaid: false
  });
  logs.push(`تم إنشاء الفواتير بالمعرفات: ${i1.id}, ${i2.id}`);

  // Step D: Create 1 Product
  logs.push('--- D. إنشاء منتج واحد (Product) ---');
  const p1 = await createProduct({
    name: 'شاشة iPhone 13 الأصلي',
    category: 'شاشات',
    barcode: `BAR-${Date.now()}`,
    sku: `SKU-${Date.now()}`,
    purchasePrice: 800,
    sellPrice: 1200,
    quantity: 10,
    minStock: 2
  });
  logs.push(`تم إنشاء المنتج بالمعرف: ${p1.id}`);

  // Step E: Create 1 Expense
  logs.push('--- E. إنشاء مصروف واحد (Expense) ---');
  const e1 = await createExpense({
    description: 'أدوات صيانة ولحام',
    amount: 150,
    category: 'أدوات',
    date: new Date().toISOString(),
    createdBy: 'System'
  });
  logs.push(`تم إنشاء المصروف بالمعرف: ${e1.id}`);

  // Step F: Test Idempotency (creating same customer twice / enqueueing with same idempotencyKey)
  logs.push('--- F. اختبار خاصية منع التكرار (Idempotency Key Check) ---');
  const itemsCountBeforeDup = syncQueue.getStats().total;
  
  // Directly attempt duplicate enqueue with c1's idempotency key
  syncQueue.enqueue({
    entityType: 'Customer',
    entityId: c1.id,
    operation: 'CREATE',
    payload: c1,
    origin: 'Reception',
    version: 1,
    idempotencyKey: `Customer:${c1.id}:CREATE`
  });

  const itemsCountAfterDup = syncQueue.getStats().total;
  const idempotencyPassed = (itemsCountBeforeDup === itemsCountAfterDup);
  
  if (idempotencyPassed) {
    logs.push('✅ نجاح اختبار Idempotency: تم رفض إضافة نفس العنصر مرتين بنفس المفتاح.');
  } else {
    logs.push('❌ فشل اختبار Idempotency: تم تكرار إضافة نفس العنصر.');
  }

  // Step G: Verify final stats
  const statsAfter = syncQueue.getStats();
  logs.push(`الحالة النهائية بالطابور: Total=${statsAfter.total}, Pending=${statsAfter.pending}, Syncing=${statsAfter.syncing}, Synced=${statsAfter.synced}, Failed=${statsAfter.failed}`);
  logs.push(`تفصيل Pending حسب الكيان: Customer=${statsAfter.byEntity.Customer}, RepairOrder=${statsAfter.byEntity.RepairOrder}, Invoice=${statsAfter.byEntity.Invoice}, Product=${statsAfter.byEntity.Product}, Expense=${statsAfter.byEntity.Expense}`);

  const countsPassed = (
    statsAfter.syncing === 0 &&
    statsAfter.synced === 0 &&
    statsAfter.failed === 0
  );

  const success = idempotencyPassed && countsPassed;

  return {
    success,
    logs,
    queueStatsBefore: statsBefore,
    queueStatsAfter: statsAfter,
    idempotencyPassed,
    countsPassed
  };
}
