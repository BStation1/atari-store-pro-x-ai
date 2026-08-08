import { WorkOwnershipType } from '../types';

function repairUsageMatchesOrder(usage: any, order: any): boolean {
  const usageOrderId = String(usage?.repairOrderId || usage?.repair_order_id || '').trim();
  if (!usageOrderId) return false;

  const orderIds = [
    order?.id,
    order?.uuid,
    order?.databaseId,
    order?.order_number,
    order?.orderNumber,
  ]
    .filter(Boolean)
    .map((value) => String(value).trim());

  return orderIds.includes(usageOrderId);
}

function orderPartsCost(order: any, partUsages: any[]): number {
  const matching = partUsages.filter((usage) => repairUsageMatchesOrder(usage, order));
  if (matching.length > 0) {
    return matching.reduce((sum, usage) => sum + Number(usage?.totalCost || 0), 0);
  }

  return Array.isArray(order?.devices)
    ? order.devices.reduce((sum: number, device: any) => sum + Number(device?.partsCost || 0), 0)
    : 0;
}

export function applySettlementSafetyPatch(db: any): void {
  if (!db || db.__settlementSafetyPatchApplied) return;
  db.__settlementSafetyPatchApplied = true;

  db.calculateSettlement = (year: number, month: number) => {
    const orders = db.getRepairOrders().filter((order: any) => {
      if (!order?.receivedDate) return false;
      const date = new Date(order.receivedDate);
      return date.getFullYear() === year && (date.getMonth() + 1) === month;
    });

    const partUsages = db.getRepairPartUsages().filter(
      (usage: any) => usage?.accountingStatus !== 'RETURNED' && usage?.accountingStatus !== 'REVERSED'
    );
    const partnerTransactions = db.getPartnerTransactions().filter((tx: any) => {
      const date = new Date(tx?.date);
      return !tx?.isReversed && tx?.status !== 'REVERSED' && date.getFullYear() === year && (date.getMonth() + 1) === month;
    });

    const sharedOrders = orders.filter(
      (order: any) => !order?.workOwnershipType || order.workOwnershipType === WorkOwnershipType.CUSTOMER_SHARED
    );

    let sharedRevenue = 0;
    let sharedPartsCost = 0;
    let sharedOtherCosts = 0;
    sharedOrders.forEach((order: any) => {
      sharedRevenue += Number(order?.totalEstimatedCost || 0);
      sharedOtherCosts += Number(order?.otherDirectCosts || 0);
      sharedPartsCost += orderPartsCost(order, partUsages);
    });

    const sharedNetProfit = Math.max(0, sharedRevenue - sharedPartsCost - sharedOtherCosts);
    const partner1SharedShare = Math.round(sharedNetProfit * 0.5);
    const partner2SharedShare = Math.round(sharedNetProfit * 0.5);

    const partner2Orders = orders.filter(
      (order: any) => order?.workOwnershipType === WorkOwnershipType.PARTNER_2_PRIVATE
    );
    let partner2PrivateRevenue = 0;
    let partner2PrivatePartsCost = 0;
    let partner2PrivateOtherCosts = 0;
    let partner1ShareFromPartner2Private = 0;
    let partner2ShareFromPrivateWork = 0;

    partner2Orders.forEach((order: any) => {
      const revenue = Number(order?.totalEstimatedCost || 0);
      const otherCosts = Number(order?.otherDirectCosts || 0);
      const partsCost = orderPartsCost(order, partUsages);

      partner2PrivateRevenue += revenue;
      partner2PrivateOtherCosts += otherCosts;
      partner2PrivatePartsCost += partsCost;

      const netProfit = Math.max(0, revenue - partsCost - otherCosts);
      const partner1Rate = typeof order?.partnerDeductionRate === 'number' ? order.partnerDeductionRate : 25;
      const partner1Share = Math.round(netProfit * (partner1Rate / 100));
      const partner2ProfitShare = netProfit - partner1Share;

      partner1ShareFromPartner2Private += partner1Share;
      partner2ShareFromPrivateWork += partner2ProfitShare;
    });

    const partner2PrivateNetProfit = Math.max(
      0,
      partner2PrivateRevenue - partner2PrivatePartsCost - partner2PrivateOtherCosts
    );

    const partner1Orders = orders.filter(
      (order: any) => order?.workOwnershipType === WorkOwnershipType.PARTNER_1_PRIVATE
    );
    let partner1PrivateRevenue = 0;
    let partner1PrivatePartsCost = 0;
    let partner1PrivateOtherCosts = 0;

    partner1Orders.forEach((order: any) => {
      partner1PrivateRevenue += Number(order?.totalEstimatedCost || 0);
      partner1PrivateOtherCosts += Number(order?.otherDirectCosts || 0);
      partner1PrivatePartsCost += orderPartsCost(order, partUsages);
    });

    const partner1PrivateDeduction = partner1PrivatePartsCost + partner1PrivateOtherCosts;

    const p1Transactions = partnerTransactions.filter((tx: any) => tx?.partnerId === 'P-001');
    const p2Transactions = partnerTransactions.filter((tx: any) => tx?.partnerId === 'P-002');

    const sumByType = (items: any[], types: string[]) =>
      items
        .filter((tx: any) => types.includes(String(tx?.type || '')))
        .reduce((sum: number, tx: any) => sum + Number(tx?.amount || 0), 0);

    const partner1Advances = sumByType(p1Transactions, ['CASH_ADVANCE']);
    const partner2Advances = sumByType(p2Transactions, ['CASH_ADVANCE']);
    const partner1Withdrawals = sumByType(p1Transactions, ['CASH_WITHDRAWAL', 'INVENTORY_WITHDRAWAL']);
    const partner2Withdrawals = sumByType(p2Transactions, ['CASH_WITHDRAWAL', 'INVENTORY_WITHDRAWAL']);
    const partner1Adjustments = sumByType(p1Transactions, ['MANUAL_ADJUSTMENT']);
    const partner2Adjustments = sumByType(p2Transactions, ['MANUAL_ADJUSTMENT']);

    const partner1FinalBalance =
      partner1SharedShare +
      partner1ShareFromPartner2Private +
      partner1Adjustments -
      (partner1PrivateDeduction + partner1Advances + partner1Withdrawals);

    // Business rule: Abdo recovers the cost of goods used in his private jobs first,
    // then keeps his share of net profit. Ahmed's percentage applies to net profit only.
    const partner2FinalBalance =
      partner2SharedShare +
      partner2PrivatePartsCost +
      partner2ShareFromPrivateWork +
      partner2Adjustments -
      (partner2Advances + partner2Withdrawals);

    const periodStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const periodEnd = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;

    return {
      id: `SETTL-${year}-${String(month).padStart(2, '0')}`,
      settlementNumber: `SET-${year}${String(month).padStart(2, '0')}`,
      periodStart,
      periodEnd,
      status: 'DRAFT',
      currency: 'ج.م.',
      sharedRevenue,
      sharedPartsCost,
      sharedOtherCosts,
      sharedNetProfit,
      partner1SharedShare,
      partner2SharedShare,
      partner1PrivateRevenue,
      partner1PrivatePartsCost,
      partner1PrivateOtherCosts,
      partner1PrivateDeduction,
      partner2PrivateRevenue,
      partner2PrivatePartsCost,
      partner2PrivateOtherCosts,
      partner2PrivateNetProfit,
      partner1ShareFromPartner2Private,
      partner2ShareFromPrivateWork,
      partner1Advances,
      partner2Advances,
      partner1Withdrawals,
      partner2Withdrawals,
      partner1Adjustments,
      partner2Adjustments,
      partner1FinalBalance,
      partner2FinalBalance,
      preparedBy: 'أحمد محمد',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  };

  const originalLockSettlement = db.lockSettlement?.bind(db);
  if (originalLockSettlement) {
    db.lockSettlement = (settlementId: string, userId: string) => {
      const result = originalLockSettlement(settlementId, userId);
      if (!result?.success) return result;

      const orders = db.getRepairOrders().filter((order: any) => order?.settlementId === settlementId);
      const usages = db.getRepairPartUsages();
      let changed = false;

      usages.forEach((usage: any) => {
        if (orders.some((order: any) => repairUsageMatchesOrder(usage, order)) && usage.accountingStatus !== 'SETTLED') {
          usage.accountingStatus = 'SETTLED';
          changed = true;
        }
      });

      if (changed) db.saveRepairPartUsages(usages);
      return result;
    };
  }

  const originalReverseSettlement = db.reverseSettlement?.bind(db);
  if (originalReverseSettlement) {
    db.reverseSettlement = (settlementId: string, userId: string, reason: string) => {
      const affectedOrders = db.getRepairOrders().filter((order: any) => order?.settlementId === settlementId);
      const result = originalReverseSettlement(settlementId, userId, reason);
      if (!result?.success) return result;

      const usages = db.getRepairPartUsages();
      let changed = false;
      usages.forEach((usage: any) => {
        if (
          usage.accountingStatus === 'SETTLED' &&
          affectedOrders.some((order: any) => repairUsageMatchesOrder(usage, order))
        ) {
          usage.accountingStatus = 'CONSUMED';
          changed = true;
        }
      });

      if (changed) db.saveRepairPartUsages(usages);
      return result;
    };
  }
}
