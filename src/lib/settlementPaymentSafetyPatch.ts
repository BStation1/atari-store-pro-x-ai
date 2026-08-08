function paymentAmountForPartner(payments: any[], settlementId: string, partnerId: string): number {
  return payments
    .filter((payment: any) => payment?.settlementId === settlementId && payment?.partnerId === partnerId && !payment?.isReversed)
    .reduce((sum: number, payment: any) => sum + Math.max(0, Number(payment?.amount || 0)), 0);
}

function payableBalance(value: unknown): number {
  return Math.max(0, Number(value || 0));
}

function ledgerTimestamp(entry: any): number {
  const raw = entry?.transactionDate || entry?.date || entry?.createdAt || entry?.created_at;
  const timestamp = raw ? new Date(raw).getTime() : 0;
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export function applySettlementPaymentSafetyPatch(db: any): void {
  if (!db || db.__settlementPaymentSafetyPatchApplied) return;
  db.__settlementPaymentSafetyPatchApplied = true;

  const originalRecordSettlementPayment = db.recordSettlementPayment?.bind(db);
  if (!originalRecordSettlementPayment) return;

  db.recordSettlementPayment = (
    settlementId: string,
    partnerId: string,
    amount: number,
    paymentMethod: string,
    treasury: string,
    notes: string,
    userId: string
  ) => {
    const numericAmount = Number(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return { success: false, error: 'مبلغ الدفعة يجب أن يكون أكبر من صفر' };
    }

    if (partnerId !== 'P-001' && partnerId !== 'P-002') {
      return { success: false, error: 'الشريك المحدد غير صالح' };
    }

    const settlements = db.getPartnerSettlements();
    const settlement = settlements.find((item: any) => item?.id === settlementId);
    if (!settlement) return { success: false, error: 'التسوية غير موجودة' };
    if (settlement.status === 'REVERSED') return { success: false, error: 'لا يمكن تسجيل دفعة على تسوية معكوسة' };

    const paymentsBefore = db.getPartnerSettlementPayments();
    const partnerExpected = partnerId === 'P-001'
      ? payableBalance(settlement.partner1FinalBalance)
      : payableBalance(settlement.partner2FinalBalance);
    const alreadyPaid = paymentAmountForPartner(paymentsBefore, settlementId, partnerId);
    const remaining = Math.max(0, partnerExpected - alreadyPaid);

    if (remaining <= 0) {
      return { success: false, error: 'لا يوجد مبلغ متبقي لهذا الشريك في هذه التسوية' };
    }
    if (numericAmount > remaining + 0.001) {
      return { success: false, error: `الدفعة أكبر من المبلغ المتبقي للشريك (${remaining.toFixed(2)})` };
    }

    // The legacy implementation assumes ledger[0] is the newest entry. Supply a
    // deterministic newest-first view during this call so restored/synced data cannot
    // make the payment start from a stale balance.
    const originalGetPartnerLedger = db.getPartnerLedger?.bind(db);
    if (originalGetPartnerLedger) {
      db.getPartnerLedger = () => [...originalGetPartnerLedger()].sort((a: any, b: any) => ledgerTimestamp(b) - ledgerTimestamp(a));
    }

    let result: any;
    try {
      result = originalRecordSettlementPayment(
        settlementId,
        partnerId,
        numericAmount,
        paymentMethod,
        treasury,
        notes,
        userId
      );
    } finally {
      if (originalGetPartnerLedger) db.getPartnerLedger = originalGetPartnerLedger;
    }

    if (!result?.success) return result;

    // Recompute settlement status independently for Ahmed and Abdo. Negative final
    // balances are not payable and therefore do not let one partner's payment offset
    // the other partner's outstanding amount.
    const refreshedSettlements = db.getPartnerSettlements();
    const refreshed = refreshedSettlements.find((item: any) => item?.id === settlementId);
    if (refreshed) {
      const paymentsAfter = db.getPartnerSettlementPayments();
      const p1Expected = payableBalance(refreshed.partner1FinalBalance);
      const p2Expected = payableBalance(refreshed.partner2FinalBalance);
      const p1Paid = paymentAmountForPartner(paymentsAfter, settlementId, 'P-001');
      const p2Paid = paymentAmountForPartner(paymentsAfter, settlementId, 'P-002');
      const p1Settled = p1Paid + 0.001 >= p1Expected;
      const p2Settled = p2Paid + 0.001 >= p2Expected;

      refreshed.status = p1Settled && p2Settled ? 'PAID' : 'PARTIALLY_PAID';
      refreshed.updatedAt = new Date().toISOString();
      db.savePartnerSettlements(refreshedSettlements);
    }

    return result;
  };
}
