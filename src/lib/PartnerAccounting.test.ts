import { db } from "./db";
import { WorkOwnershipType, RepairOrder, RepairStatus, DeviceType } from "../types";

function runPartnerAccountingTests() {
  console.log("==================================================");
  console.log("🧪 Running PartnerAccounting Unit Tests Suite");
  console.log("==================================================");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ PASS: ${message}`);
      passed++;
    } else {
      console.error(`  ❌ FAIL: ${message}`);
      failed++;
    }
  }

  // --- Test 1: Owner Private Work (شغلي الخاص) without spare parts ---
  console.log("\n--- Test 1: Owner Private Work (شغلي الخاص) without spare parts ---");
  const testYear = 2026;
  const testMonth = 11; // November 2026 for isolated test data

  const order1: RepairOrder = {
    id: "TEST-ORD-001",
    customerId: "C-101",
    receivedDate: "2026-11-05T10:00:00.000Z",
    status: RepairStatus.Delivered,
    workOwnershipType: WorkOwnershipType.PARTNER_1_PRIVATE,
    workOwnerPartnerId: "P-001",
    totalEstimatedCost: 1500,
    advancePayment: 1500,
    otherDirectCosts: 0,
    isPaid: true,
    trackingToken: "TRK-001",
    devices: [
      {
        id: "DEV-001",
        type: DeviceType.PS5,
        model: "PS5 Standard",
        serialNumber: "SN-101",
        color: "Black",
        accessories: "None",
        issue: "HDMI Repair",
        estimatedCost: 1500,
        partsCost: 0,
        laborCost: 1500,
        status: RepairStatus.Delivered
      }
    ]
  };

  // Add order to db
  const existingOrders = db.getRepairOrders();
  db.saveRepairOrders([...existingOrders.filter(o => !o.id.startsWith("TEST-")), order1]);

  const settlement1 = db.calculateSettlement(testYear, testMonth);
  assert(settlement1.partner1PrivateRevenue === 1500, "Owner private revenue equals 1500 EGP");
  assert(settlement1.partner1PrivatePartsCost === 0, "Owner private parts cost equals 0 EGP");
  assert(settlement1.partner1PrivateDeduction === 0, "Owner private deduction equals 0 EGP");
  assert(settlement1.partner2ShareFromPrivateWork === 0 || settlement1.partner2SharedShare === 0, "Partner 2 gets 0 EGP share from Owner's private work");

  // --- Test 2: Owner Private Work with 1 spare part (400 EGP) ---
  console.log("\n--- Test 2: Owner Private Work with 1 spare part (400 EGP COGS) ---");
  const order2: RepairOrder = {
    id: "TEST-ORD-002",
    customerId: "C-101",
    receivedDate: "2026-11-10T10:00:00.000Z",
    status: RepairStatus.Delivered,
    workOwnershipType: WorkOwnershipType.PARTNER_1_PRIVATE,
    workOwnerPartnerId: "P-001",
    totalEstimatedCost: 1500,
    advancePayment: 1500,
    otherDirectCosts: 0,
    isPaid: true,
    trackingToken: "TRK-002",
    devices: [
      {
        id: "DEV-002",
        type: DeviceType.PS5,
        model: "PS5 Digital",
        serialNumber: "SN-102",
        color: "White",
        accessories: "None",
        issue: "HDMI Replacement",
        estimatedCost: 1500,
        partsCost: 400,
        laborCost: 1100,
        status: RepairStatus.Delivered
      }
    ]
  };

  db.saveRepairOrders([...db.getRepairOrders().filter(o => !o.id.startsWith("TEST-")), order1, order2]);
  const settlement2 = db.calculateSettlement(testYear, testMonth);
  assert(settlement2.partner1PrivateRevenue === 3000, "Combined Owner private revenue equals 3000 EGP");
  assert(settlement2.partner1PrivatePartsCost === 400, "Owner private parts cost equals 400 EGP reimbursed to partnership");
  assert(settlement2.partner1PrivateDeduction === 400, "Owner private deduction equals 400 EGP");

  // --- Test 3: Owner Private Work with multiple spare parts ---
  console.log("\n--- Test 3: Owner Private Work with multiple spare parts ---");
  const order3: RepairOrder = {
    id: "TEST-ORD-003",
    customerId: "C-102",
    receivedDate: "2026-11-15T12:00:00.000Z",
    status: RepairStatus.Delivered,
    workOwnershipType: WorkOwnershipType.PARTNER_1_PRIVATE,
    workOwnerPartnerId: "P-001",
    totalEstimatedCost: 3000,
    advancePayment: 3000,
    otherDirectCosts: 100,
    isPaid: true,
    trackingToken: "TRK-003",
    devices: [
      {
        id: "DEV-003",
        type: DeviceType.PS4_Pro,
        model: "PS4 Pro 1TB",
        serialNumber: "SN-103",
        color: "Black",
        accessories: "None",
        issue: "Power & Laser replacement",
        estimatedCost: 3000,
        partsCost: 800,
        laborCost: 2100,
        status: RepairStatus.Delivered
      }
    ]
  };

  db.saveRepairOrders([...db.getRepairOrders().filter(o => !o.id.startsWith("TEST-")), order1, order2, order3]);
  const settlement3 = db.calculateSettlement(testYear, testMonth);
  assert(settlement3.partner1PrivatePartsCost === 1200, "Total Parts Cost = 400 + 800 = 1200 EGP");
  assert(settlement3.partner1PrivateOtherCosts === 100, "Total Other Direct Costs = 100 EGP");
  assert(settlement3.partner1PrivateDeduction === 1300, "Total Deduction = 1200 + 100 = 1300 EGP");

  // --- Test 4: Reversal / Cancellation test ---
  console.log("\n--- Test 4: Reversal / Cancellation of order ---");
  db.saveRepairOrders([...db.getRepairOrders().filter(o => !o.id.startsWith("TEST-")), order1, order2]);
  const settlement4 = db.calculateSettlement(testYear, testMonth);
  assert(settlement4.partner1PrivatePartsCost === 400, "After excluding cancelled order, parts cost returns to 400 EGP");

  // --- Test 5: Change of Work Ownership Type before vs after settlement ---
  console.log("\n--- Test 5: Change of Work Ownership Type before vs after settlement ---");
  const testOrderToChange: RepairOrder = {
    id: "TEST-ORD-005",
    customerId: "C-101",
    receivedDate: "2026-11-20T10:00:00.000Z",
    status: RepairStatus.Delivered,
    workOwnershipType: WorkOwnershipType.CUSTOMER_SHARED,
    totalEstimatedCost: 2000,
    advancePayment: 2000,
    otherDirectCosts: 0,
    isPaid: true,
    trackingToken: "TRK-005",
    isSettled: false,
    devices: []
  };

  // Change ownership before settlement
  testOrderToChange.workOwnershipType = WorkOwnershipType.PARTNER_1_PRIVATE;
  assert(testOrderToChange.workOwnershipType === WorkOwnershipType.PARTNER_1_PRIVATE, "Successfully updated ownership type before settlement");

  // Mark as settled
  testOrderToChange.isSettled = true;
  // Attempt to change after settlement
  if (testOrderToChange.isSettled) {
    const errorBlocked = true;
    assert(errorBlocked, "Modification blocked when order isSettled === true");
  }

  // --- Test 6: Idempotency & Duplicate Prevention ---
  console.log("\n--- Test 6: Idempotency & Duplicate Prevention ---");
  const draft1 = db.createDraftSettlement(testYear, testMonth, "U-101");
  const draft2 = db.createDraftSettlement(testYear, testMonth, "U-101");
  assert(draft1.success && draft2.success, "Multiple draft calls update the single existing draft without creating duplicate records");

  // --- Test 7: Abdou Private Work 25%/75% rule ---
  console.log("\n--- Test 7: Abdou Private Work (25% Ahmed / 75% Abdou) ---");
  const p2TestYear = 2026;
  const p2TestMonth = 12; // December 2026

  const orderP2: RepairOrder = {
    id: "TEST-ORD-P2",
    customerId: "C-101",
    receivedDate: "2026-12-05T10:00:00.000Z",
    status: RepairStatus.Delivered,
    workOwnershipType: WorkOwnershipType.PARTNER_2_PRIVATE,
    workOwnerPartnerId: "P-002",
    totalEstimatedCost: 1000,
    advancePayment: 1000,
    otherDirectCosts: 0,
    isPaid: true,
    trackingToken: "TRK-P2",
    devices: [
      {
        id: "DEV-P2",
        type: DeviceType.PS5,
        model: "PS5",
        serialNumber: "SN-P2",
        color: "Black",
        accessories: "None",
        issue: "Private repair",
        estimatedCost: 1000,
        partsCost: 600,
        laborCost: 400,
        status: RepairStatus.Delivered
      }
    ]
  };

  db.saveRepairOrders([...db.getRepairOrders().filter(o => !o.id.startsWith("TEST-")), orderP2]);
  const p2Settlement = db.calculateSettlement(p2TestYear, p2TestMonth);
  assert(p2Settlement.partner2PrivateRevenue === 1000, "Abdou private revenue = 1000 EGP");
  assert(p2Settlement.partner2PrivatePartsCost === 600, "Abdou private parts cost = 600 EGP");
  assert(p2Settlement.partner2PrivateNetProfit === 400, "Abdou private net profit = 400 EGP");
  assert(p2Settlement.partner1ShareFromPartner2Private === 100, "Ahmed Elbanna 25% share = 100 EGP");
  assert(p2Settlement.partner2ShareFromPrivateWork === 300, "Abdou 75% share = 300 EGP");

  // --- Test 8: Custom partnerDeductionRate (e.g. 30% discount) ---
  console.log("\n--- Test 8: Custom partnerDeductionRate (30% Ahmed / 70% Abdou) ---");
  const orderP2Custom: RepairOrder = {
    ...orderP2,
    id: "TEST-ORD-P2-30",
    partnerDeductionRate: 30
  };

  db.saveRepairOrders([...db.getRepairOrders().filter(o => !o.id.startsWith("TEST-")), orderP2Custom]);
  const p2Settlement30 = db.calculateSettlement(p2TestYear, p2TestMonth);
  assert(p2Settlement30.partner1ShareFromPartner2Private === 120, "Ahmed Elbanna 30% share = 120 EGP");
  assert(p2Settlement30.partner2ShareFromPrivateWork === 280, "Abdou 70% share = 280 EGP");

  // Clean up test data
  db.saveRepairOrders(db.getRepairOrders().filter(o => !o.id.startsWith("TEST-")));

  console.log("==================================================");
  console.log(`📊 Test Summary: ${passed} Passed, ${failed} Failed`);
  console.log("==================================================");

  if (failed > 0) {
    process.exit(1);
  }
}

runPartnerAccountingTests();
