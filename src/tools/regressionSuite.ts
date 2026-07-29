/**
 * GO_LIVE_CORE_REGRESSION_SUITE
 * Automated regression suite verifying core operational flows.
 */

import { db } from '../lib/db';
import { fetchOrMigrateRepairOrders, addRepairOrderToSupabase } from '../lib/supabaseRepairOrders';
import { RepairStatus, WorkOwnershipType, DeviceType, CustomerType } from '../types';

export interface TestResult {
  suite: string;
  testName: string;
  passed: boolean;
  message: string;
}

export async function runGoLiveCoreRegressionSuite(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  const addResult = (suite: string, testName: string, passed: boolean, message: string) => {
    results.push({ suite, testName, passed, message });
  };

  // --- Suite A: Registered Customer Flow ---
  try {
    const custId = `CUST_TEST_${Date.now()}`;
    const testCust = {
      id: custId,
      name: "عميل تجريبي معتمد",
      phone: "0500000001",
      city: "الرياض",
      type: CustomerType.Individual,
      balance: 0,
      createdAt: new Date().toISOString()
    };
    db.saveCustomers([testCust, ...db.getCustomers()]);
    const foundCust = db.getCustomers().find(c => c.id === custId);
    addResult("Suite A: Registered Customer", "Create Customer & Immediate Persistence", !!foundCust, foundCust ? "Customer saved and retrieved immediately" : "Failed to persist customer");

    const newOrder = await addRepairOrderToSupabase({
      customerId: custId,
      customerNameSnapshot: testCust.name,
      customerPhoneSnapshot: testCust.phone,
      devices: [{ id: "DEV-1", type: DeviceType.PS5, model: "Slim", serialNumber: "PS5-123", issue: "عطل بالباور", color: "أسود", accessories: "لا يوجد", needsInspection: true, estimatedCost: 150, partsCost: 0, laborCost: 0, status: RepairStatus.Received }],
      totalEstimatedCost: 150,
      advancePayment: 0,
      isPaid: false,
      status: RepairStatus.Received,
      workOwnershipType: WorkOwnershipType.CUSTOMER_SHARED
    });

    addResult("Suite A: Registered Customer", "Create Repair Order & ID Generation", !!newOrder.id, `Order created with ID ${newOrder.id}`);

    const fetched = await fetchOrMigrateRepairOrders();
    const foundOrder = fetched.orders.find(o => o.id === newOrder.id);
    addResult("Suite A: Registered Customer", "Immediate Active Workshop Visibility", !!foundOrder, foundOrder ? `Order ${newOrder.id} visible immediately` : "Order missing from active workshop");
    addResult("Suite A: Registered Customer", "Tracking Link Token Generation", !!newOrder.trackingToken, `Tracking token: ${newOrder.trackingToken}`);
  } catch (err: any) {
    addResult("Suite A: Registered Customer", "Exception during test", false, err?.message || String(err));
  }

  // --- Suite B: Quick Guest Flow ---
  try {
    const guestPhone = "0599999999";
    const guestName = "زائر تجريبي سريع";
    const guestOrder = await addRepairOrderToSupabase({
      guestCustomerName: guestName,
      guestCustomerPhone: guestPhone,
      customerNameSnapshot: guestName,
      customerPhoneSnapshot: guestPhone,
      devices: [{ id: "DEV-2", type: DeviceType.Xbox_Series_X, model: "Series X", serialNumber: "XB-999", issue: "ارتفاع الحرارة", color: "أسود", accessories: "لا يوجد", needsInspection: true, estimatedCost: 200, partsCost: 0, laborCost: 0, status: RepairStatus.Received }],
      totalEstimatedCost: 200,
      advancePayment: 0,
      isPaid: false,
      status: RepairStatus.Received
    });

    addResult("Suite B: Quick Guest", "Create Guest Order", !!guestOrder.id, `Guest order created ${guestOrder.id}`);

    const isGuestInPermanentCust = db.getCustomers().some(c => c.phone === guestPhone && c.id !== "GUEST");
    addResult("Suite B: Quick Guest", "Guest Not Persisted as Permanent Customer", !isGuestInPermanentCust, isGuestInPermanentCust ? "ERROR: Guest converted to permanent customer without request" : "Guest remained isolated from permanent customer directory");
  } catch (err: any) {
    addResult("Suite B: Quick Guest", "Exception during test", false, err?.message || String(err));
  }

  // --- Suite C: Workshop Search & Status ---
  try {
    const fetched = await fetchOrMigrateRepairOrders();
    const orders = fetched.orders;
    addResult("Suite C: Workshop", "Orders Array Available", orders.length > 0, `Total workshop orders: ${orders.length}`);
  } catch (err: any) {
    addResult("Suite C: Workshop", "Exception during test", false, err?.message || String(err));
  }

  // --- Suite F: Regression & Formatting Checks ---
  try {
    const fetched = await fetchOrMigrateRepairOrders();
    const sampleText = JSON.stringify(fetched.orders);
    const hasReplacementChar = sampleText.includes('');
    addResult("Suite F: Formatting", "No Replacement Character ()", !hasReplacementChar, hasReplacementChar ? "Found invalid encoding characters" : "Text encoding clean");

    const hasInternalIDsInSnapshots = fetched.orders.some(o => (o.customerNameSnapshot || '').includes('DT-') || (o.customerNameSnapshot || '').includes('DM-'));
    addResult("Suite F: Formatting", "No Internal DT-/DM- IDs in Customer Snapshots", !hasInternalIDsInSnapshots, hasInternalIDsInSnapshots ? "Found raw DT-/DM- internal codes in snapshots" : "Names and models correctly formatted");
  } catch (err: any) {
    addResult("Suite F: Formatting", "Exception during test", false, err?.message || String(err));
  }

  return results;
}
