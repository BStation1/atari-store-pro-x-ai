import {
  calculateMonthlySettlement,
  canWithdrawFromReplacementFund,
  closeMonthEngine,
  reopenMonthEngine
} from './monthlySettlementEngine';
import { PartnerLedgerEntry } from './partnerLedgerEngine';
import { Expense, MonthlySettlementResult, ReplacementFundEntry, UserRole } from '../types';

export interface TestCaseResult {
  id: number;
  title: string;
  passed: boolean;
  expected: string;
  actual: string;
  details?: string;
}

export async function runMonthlySettlementTestSuite(): Promise<{
  passed: number;
  failed: number;
  total: number;
  results: TestCaseResult[];
}> {
  const results: TestCaseResult[] = [];
  const testMonth = '2026-07';

  // --------------------------------------------------------------------------
  // Test 1: Normal Month (شهر عادي)
  // CUSTOMER_WORK (Revenue 1000, COGS 600) -> Ahmed profit 200, Abdo profit 200, Fund 600
  // Expenses: Shared 100
  // Net: Ahmed = 200 - 50 = 150, Abdo = 200 - 50 = 150
  // --------------------------------------------------------------------------
  try {
    const ledgerEntries: PartnerLedgerEntry[] = [
      {
        accountOwner: 'AHMED',
        transactionType: 'PROFIT_SHARE',
        amount: 200,
        signedAmount: 200,
        invoiceId: 'inv-1',
        invoiceNumber: 'INV-1',
        workType: 'CUSTOMER_WORK',
        description: 'ربح أحمـد',
        createdAt: `${testMonth}-05T10:00:00Z`
      },
      {
        accountOwner: 'ABDO',
        transactionType: 'PROFIT_SHARE',
        amount: 200,
        signedAmount: 200,
        invoiceId: 'inv-1',
        invoiceNumber: 'INV-1',
        workType: 'CUSTOMER_WORK',
        description: 'ربح عبده',
        createdAt: `${testMonth}-05T10:00:00Z`
      },
      {
        accountOwner: 'REPLACEMENT_FUND',
        transactionType: 'REPLACEMENT_FUND_ALLOCATION',
        amount: 600,
        signedAmount: 600,
        invoiceId: 'inv-1',
        invoiceNumber: 'INV-1',
        workType: 'CUSTOMER_WORK',
        description: 'صندوق بضاعة',
        createdAt: `${testMonth}-05T10:00:00Z`
      }
    ];

    const expenses: Expense[] = [
      {
        id: 'exp-1',
        category: 'كهرباء',
        description: 'فاتورة الكهرباء',
        amount: 100,
        date: `${testMonth}-10`,
        createdBy: 'u1',
        expenseOwner: 'SHARED'
      }
    ];

    const settlement = calculateMonthlySettlement(testMonth, ledgerEntries, expenses);

    const pass =
      settlement.ahmedProfitShare === 200 &&
      settlement.abdouProfitShare === 200 &&
      settlement.replacementFundDeposits === 600 &&
      settlement.sharedExpenses === 100 &&
      settlement.ahmedNetPayout === 150 &&
      settlement.abdouNetPayout === 150;

    results.push({
      id: 1,
      title: '1) شهر عادي (Normal Month): احتساب الأرباح والمصروفات وصافي المستحقات',
      passed: pass,
      expected: 'أحمد صافي=150 (200-50)، عبده صافي=150 (200-50)، صندوق التعويض=600',
      actual: `أحمد صافي=${settlement.ahmedNetPayout}، عبده صافي=${settlement.abdouNetPayout}، الصندوق=${settlement.replacementFundDeposits}`
    });
  } catch (err: any) {
    results.push({
      id: 1,
      title: '1) شهر عادي (Normal Month)',
      passed: false,
      expected: 'نجاح الحساب',
      actual: err?.message || String(err)
    });
  }

  // --------------------------------------------------------------------------
  // Test 2: Month with No Sales (شهر بدون مبيعات)
  // Ledger: Empty
  // Expenses: Shared 200, Ahmed 50
  // Net: Ahmed = -150 (-50 - 100), Abdo = -100 (-100)
  // --------------------------------------------------------------------------
  try {
    const expenses: Expense[] = [
      {
        id: 'exp-201',
        category: 'إيجار',
        description: 'إيجار المحل',
        amount: 200,
        date: `${testMonth}-01`,
        createdBy: 'u1',
        expenseOwner: 'SHARED'
      },
      {
        id: 'exp-202',
        category: 'شخصي',
        description: 'مستلزمات أحمد',
        amount: 50,
        date: `${testMonth}-02`,
        createdBy: 'u1',
        expenseOwner: 'AHMED'
      }
    ];

    const settlement = calculateMonthlySettlement(testMonth, [], expenses);

    const pass =
      settlement.ahmedProfitShare === 0 &&
      settlement.abdouProfitShare === 0 &&
      settlement.totalExpenses === 250 &&
      settlement.ahmedNetPayout === -150 &&
      settlement.abdouNetPayout === -100;

    results.push({
      id: 2,
      title: '2) شهر بدون مبيعات (No Sales): توزيع المصروفات بنجاح بصافي بالسالب',
      passed: pass,
      expected: 'أحمد صافي=-150، عبده صافي=-100، إجمالي المصروفات=250',
      actual: `أحمد صافي=${settlement.ahmedNetPayout}، عبده صافي=${settlement.abdouNetPayout}، المصروفات=${settlement.totalExpenses}`
    });
  } catch (err: any) {
    results.push({
      id: 2,
      title: '2) شهر بدون مبيعات',
      passed: false,
      expected: 'خصم المصروفات',
      actual: err?.message || String(err)
    });
  }

  // --------------------------------------------------------------------------
  // Test 3: Month with Losses (شهر بخسائر)
  // CUSTOMER_WORK (Revenue 500, COGS 600) -> Ahmed profit -50, Abdo profit -50, Fund 600
  // --------------------------------------------------------------------------
  try {
    const ledgerEntries: PartnerLedgerEntry[] = [
      {
        accountOwner: 'AHMED',
        transactionType: 'PROFIT_SHARE',
        amount: 50,
        signedAmount: -50,
        invoiceId: 'inv-loss',
        invoiceNumber: 'INV-LOSS',
        workType: 'CUSTOMER_WORK',
        description: 'خسارة أحمد',
        createdAt: `${testMonth}-05T10:00:00Z`
      },
      {
        accountOwner: 'ABDO',
        transactionType: 'PROFIT_SHARE',
        amount: 50,
        signedAmount: -50,
        invoiceId: 'inv-loss',
        invoiceNumber: 'INV-LOSS',
        workType: 'CUSTOMER_WORK',
        description: 'خسارة عبده',
        createdAt: `${testMonth}-05T10:00:00Z`
      },
      {
        accountOwner: 'REPLACEMENT_FUND',
        transactionType: 'REPLACEMENT_FUND_ALLOCATION',
        amount: 600,
        signedAmount: 600,
        invoiceId: 'inv-loss',
        invoiceNumber: 'INV-LOSS',
        workType: 'CUSTOMER_WORK',
        description: 'صندوق بضاعة',
        createdAt: `${testMonth}-05T10:00:00Z`
      }
    ];

    const settlement = calculateMonthlySettlement(testMonth, ledgerEntries, []);

    const pass =
      settlement.ahmedProfitShare === -50 &&
      settlement.abdouProfitShare === -50 &&
      settlement.replacementFundDeposits === 600 &&
      settlement.ahmedNetPayout === -50 &&
      settlement.abdouNetPayout === -50;

    results.push({
      id: 3,
      title: '3) شهر بخسائر (Month with Losses): خصم الخسارة بدقة من نصيب الشريكين',
      passed: pass,
      expected: 'أحمد صافي=-50، عبده صافي=-50، صندوق البضاعة=600',
      actual: `أحمد صافي=${settlement.ahmedNetPayout}، عبده صافي=${settlement.abdouNetPayout}، الصندوق=${settlement.replacementFundDeposits}`
    });
  } catch (err: any) {
    results.push({
      id: 3,
      title: '3) شهر بخسائر',
      passed: false,
      expected: 'تسجيل الخسائر بالسالب',
      actual: err?.message || String(err)
    });
  }

  // --------------------------------------------------------------------------
  // Test 4: Shared & Private Expenses (مصروفات مشتركة وخاصة)
  // Shared: 200 (100 on each)
  // Ahmed Private: 80
  // Abdo Private: 50
  // Profits: Ahmed 500, Abdo 500
  // Expected Net: Ahmed = 500 - 80 - 100 = 320, Abdo = 500 - 50 - 100 = 350
  // --------------------------------------------------------------------------
  try {
    const ledgerEntries: PartnerLedgerEntry[] = [
      {
        accountOwner: 'AHMED',
        transactionType: 'PROFIT_SHARE',
        amount: 500,
        signedAmount: 500,
        invoiceId: 'inv-401',
        invoiceNumber: 'INV-401',
        workType: 'CUSTOMER_WORK',
        description: 'أرباح أحمد',
        createdAt: `${testMonth}-12T10:00:00Z`
      },
      {
        accountOwner: 'ABDO',
        transactionType: 'PROFIT_SHARE',
        amount: 500,
        signedAmount: 500,
        invoiceId: 'inv-401',
        invoiceNumber: 'INV-401',
        workType: 'CUSTOMER_WORK',
        description: 'أرباح عبده',
        createdAt: `${testMonth}-12T10:00:00Z`
      }
    ];

    const expenses: Expense[] = [
      {
        id: 'e1',
        category: 'صيانة',
        description: 'مصروف مشترك',
        amount: 200,
        date: `${testMonth}-15`,
        createdBy: 'u1',
        expenseOwner: 'SHARED'
      },
      {
        id: 'e2',
        category: 'شخصي',
        description: 'أحمد فقط',
        amount: 80,
        date: `${testMonth}-15`,
        createdBy: 'u1',
        expenseOwner: 'AHMED'
      },
      {
        id: 'e3',
        category: 'شخصي',
        description: 'عبده فقط',
        amount: 50,
        date: `${testMonth}-15`,
        createdBy: 'u1',
        expenseOwner: 'ABDO'
      }
    ];

    const settlement = calculateMonthlySettlement(testMonth, ledgerEntries, expenses);

    const pass =
      settlement.sharedExpenses === 200 &&
      settlement.ahmedExpenses === 80 &&
      settlement.abdouExpenses === 50 &&
      settlement.totalExpenses === 330 &&
      settlement.ahmedNetPayout === 320 &&
      settlement.abdouNetPayout === 350;

    results.push({
      id: 4,
      title: '4) المصروفات المشتركة والخاصة (Shared & Private Expenses)',
      passed: pass,
      expected: 'أحمد صافي=320 (500-80-100)، عبده صافي=350 (500-50-100)، إجمالي=330',
      actual: `أحمد صافي=${settlement.ahmedNetPayout}، عبده صافي=${settlement.abdouNetPayout}، إجمالي المصروفات=${settlement.totalExpenses}`
    });
  } catch (err: any) {
    results.push({
      id: 4,
      title: '4) المصروفات المشتركة والخاصة',
      passed: false,
      expected: 'تطبيق ملكية المصروفات',
      actual: err?.message || String(err)
    });
  }

  // --------------------------------------------------------------------------
  // Test 5: Reopening a Month (إعادة فتح شهر)
  // OWNER can reopen, RECEPTION/CASHIER cannot
  // --------------------------------------------------------------------------
  try {
    let settlement: MonthlySettlementResult = {
      settlementMonth: testMonth,
      status: 'LOCKED',
      ahmedProfitShare: 100,
      abdouProfitShare: 100,
      ahmedCogsRecovery: 0,
      abdouSettlementObligation: 0,
      replacementFundDeposits: 0,
      sharedExpenses: 0,
      ahmedExpenses: 0,
      abdouExpenses: 0,
      totalExpenses: 0,
      ahmedNetPayout: 100,
      abdouNetPayout: 100,
      replacementFundBalance: 0,
      lockedAt: new Date().toISOString(),
      lockedByUserId: 'owner-id',
      lockedByUserName: 'أحمد المالك'
    };

    // Attempt 1: CASHIER attempts reopen -> must throw
    let nonOwnerFailed = false;
    try {
      reopenMonthEngine(settlement, { id: 'c1', name: 'كاشير', role: 'CASHIER' as UserRole }, 'تعديل فاتورة');
    } catch {
      nonOwnerFailed = true;
    }

    // Attempt 2: OWNER attempts reopen -> succeeds
    const { updatedSettlement, auditRecord } = reopenMonthEngine(
      settlement,
      { id: 'owner-id', name: 'أحمد المالك', role: 'OWNER' as UserRole },
      'سبب تصحيح القيد'
    );

    const pass =
      nonOwnerFailed &&
      updatedSettlement.status === 'OPEN' &&
      auditRecord.action === 'REOPEN_MONTH' &&
      auditRecord.performedByUserId === 'owner-id' &&
      auditRecord.reason === 'سبب تصحيح القيد';

    results.push({
      id: 5,
      title: '5) إعادة فتح الشهر (Reopening Month): السماح للمالك فقط مع التوثيق بالسجل',
      passed: pass,
      expected: 'رفض الكاشير، قبول المالك، الحالة تتحول إلى OPEN مع إنشاء سجل تدقيق',
      actual: `رفض غير المالك=${nonOwnerFailed}، حالة الشهر الجديدة=${updatedSettlement.status}، إجراء السجل=${auditRecord.action}`
    });
  } catch (err: any) {
    results.push({
      id: 5,
      title: '5) إعادة فتح الشهر',
      passed: false,
      expected: 'صلاحيات المالك',
      actual: err?.message || String(err)
    });
  }

  // --------------------------------------------------------------------------
  // Test 6: Prevent Double Closing (منع الإغلاق مرتين)
  // --------------------------------------------------------------------------
  try {
    const lockedSettlement: MonthlySettlementResult = {
      settlementMonth: testMonth,
      status: 'LOCKED',
      ahmedProfitShare: 100,
      abdouProfitShare: 100,
      ahmedCogsRecovery: 0,
      abdouSettlementObligation: 0,
      replacementFundDeposits: 0,
      sharedExpenses: 0,
      ahmedExpenses: 0,
      abdouExpenses: 0,
      totalExpenses: 0,
      ahmedNetPayout: 100,
      abdouNetPayout: 100,
      replacementFundBalance: 0,
      lockedAt: new Date().toISOString(),
      lockedByUserId: 'owner-id',
      lockedByUserName: 'أحمد المالك'
    };

    let prevented = false;
    try {
      closeMonthEngine(lockedSettlement, { id: 'owner-id', name: 'أحمد المالك', role: 'OWNER' as UserRole });
    } catch (e: any) {
      if (e?.message?.includes('مغلق بالفعل')) {
        prevented = true;
      }
    }

    results.push({
      id: 6,
      title: '6) منع الإغلاق مرتين (Prevent Double Closing)',
      passed: prevented,
      expected: 'إلقاء استثناء يمنع إعادة إغلاق شهر مغلق بالفعل',
      actual: prevented ? 'تم المكون ومنع الإغلاق المزدوج بنجاح' : 'لم يتم المنع'
    });
  } catch (err: any) {
    results.push({
      id: 6,
      title: '6) منع الإغلاق مرتين',
      passed: false,
      expected: 'منع الإغلاق المزدوج',
      actual: err?.message || String(err)
    });
  }

  // --------------------------------------------------------------------------
  // Test 7: Replacement Fund Ledger & Overdraft Rules (صندوق التعويض)
  // Deposit: 500 from CUSTOMER_WORK
  // Withdrawal 300: Allowed for everyone
  // Withdrawal 600 (Current balance 200, withdraw 600 -> negative): Forbidden for RECEPTION, Allowed for OWNER
  // --------------------------------------------------------------------------
  try {
    const check1 = canWithdrawFromReplacementFund(500, 300, 'RECEPTION' as UserRole);
    const check2 = canWithdrawFromReplacementFund(200, 600, 'RECEPTION' as UserRole);
    const check3 = canWithdrawFromReplacementFund(200, 600, 'OWNER' as UserRole);

    const pass = check1.allowed && !check2.allowed && check3.allowed;

    results.push({
      id: 7,
      title: '7) صندوق تعويض البضاعة (Replacement Fund Rules): منع السحب بالسالب إلا بـ OWNER',
      passed: pass,
      expected: 'سحب 300 مسموح للجميع، سحب 600 من رصيد 200 مرفوض للاستقبال ومسموح للمالك',
      actual: `سحب إيجابي=${check1.allowed}، سحب سالب استقبال=${check2.allowed}، سحب سالب مالك=${check3.allowed}`
    });
  } catch (err: any) {
    results.push({
      id: 7,
      title: '7) صندوق تعويض البضاعة',
      passed: false,
      expected: 'قواعد السحب من صندوق التعويض',
      actual: err?.message || String(err)
    });
  }

  // --------------------------------------------------------------------------
  // Test 8: Settlement Net Calculations Integrity (التسويات)
  // AHMED_WORK (Rev 1000, COGS 600) -> Ahmed COGS 600, Ahmed profit 400
  // ABDO_WORK (Rev 1000, COGS 600) -> Ahmed profit 100, Abdo profit 300, Abdo obligation 700
  // Total: Ahmed Profits 500 + COGS Rec 600 = 1100
  //        Abdo Profits 300 - Obligation 700 = -400
  // --------------------------------------------------------------------------
  try {
    const ledgerEntries: PartnerLedgerEntry[] = [
      // AHMED_WORK
      {
        accountOwner: 'AHMED',
        transactionType: 'COGS_RECOVERY',
        amount: 600,
        signedAmount: 600,
        invoiceId: 'i1',
        invoiceNumber: 'INV-A',
        workType: 'AHMED_WORK',
        description: 'استرداد أحمد',
        createdAt: `${testMonth}-01`
      },
      {
        accountOwner: 'AHMED',
        transactionType: 'PROFIT_SHARE',
        amount: 400,
        signedAmount: 400,
        invoiceId: 'i1',
        invoiceNumber: 'INV-A',
        workType: 'AHMED_WORK',
        description: 'ربح أحمد',
        createdAt: `${testMonth}-01`
      },
      // ABDO_WORK
      {
        accountOwner: 'AHMED',
        transactionType: 'PROFIT_SHARE',
        amount: 100,
        signedAmount: 100,
        invoiceId: 'i2',
        invoiceNumber: 'INV-B',
        workType: 'ABDO_WORK',
        description: 'ربح أحمد من عبده',
        createdAt: `${testMonth}-02`
      },
      {
        accountOwner: 'ABDO',
        transactionType: 'PROFIT_SHARE',
        amount: 300,
        signedAmount: 300,
        invoiceId: 'i2',
        invoiceNumber: 'INV-B',
        workType: 'ABDO_WORK',
        description: 'ربح عبده الخارجي',
        createdAt: `${testMonth}-02`
      },
      {
        accountOwner: 'ABDO',
        transactionType: 'SETTLEMENT_OBLIGATION',
        amount: 100,
        signedAmount: -100,
        invoiceId: 'i2',
        invoiceNumber: 'INV-B',
        workType: 'ABDO_WORK',
        description: 'التزام تسوية عبده',
        createdAt: `${testMonth}-02`
      }
    ];

    const settlement = calculateMonthlySettlement(testMonth, ledgerEntries, []);

    const pass =
      settlement.ahmedProfitShare === 500 &&
      settlement.ahmedCogsRecovery === 600 &&
      settlement.ahmedNetPayout === 1100 &&
      settlement.abdouProfitShare === 300 &&
      settlement.abdouSettlementObligation === 100 &&
      settlement.abdouNetPayout === 200;

    results.push({
      id: 8,
      title: '8) مطابقة حسابات التسوية (Settlement Calculations): أحمد=1100، عبده=200',
      passed: pass,
      expected: 'أحمد استحقاق صافي=1100 (500+600)، عبده صافي=200 (300-100)',
      actual: `أحمد صافي=${settlement.ahmedNetPayout}، عبده صافي=${settlement.abdouNetPayout}`
    });
  } catch (err: any) {
    results.push({
      id: 8,
      title: '8) مطابقة حسابات التسوية',
      passed: false,
      expected: 'حسابات صافي مستحقات الشريكين',
      actual: err?.message || String(err)
    });
  }

  // --------------------------------------------------------------------------
  // Test 9: Permissions & Audit Consistency (الصلاحيات)
  // --------------------------------------------------------------------------
  try {
    const openSettlement = calculateMonthlySettlement(testMonth, [], []);

    const closed = closeMonthEngine(openSettlement, {
      id: 'owner-id',
      name: 'أحمد المالك',
      role: 'OWNER' as UserRole
    });

    const pass =
      closed.status === 'LOCKED' &&
      closed.lockedByUserId === 'owner-id' &&
      closed.lockedByUserName === 'أحمد المالك' &&
      closed.lockedAt !== undefined;

    results.push({
      id: 9,
      title: '9) التحقق من الصلاحيات واتساق عملية الإغلاق (Closing Security & Audit)',
      passed: pass,
      expected: 'الحالة تتحول إلى LOCKED ويتم تسجيل معرف واسم القافل ووقت الإغلاق',
      actual: `الحالة=${closed.status}، القافل=${closed.lockedByUserName}، وقت الإغلاق=${closed.lockedAt != null}`
    });
  } catch (err: any) {
    results.push({
      id: 9,
      title: '9) التحقق من الصلاحيات',
      passed: false,
      expected: 'حفظ بيانات القافل',
      actual: err?.message || String(err)
    });
  }

  // --------------------------------------------------------------------------
  // Test 10: Direct Matching with partner_ledger (المطابقة مع partner_ledger)
  // --------------------------------------------------------------------------
  try {
    const entries: PartnerLedgerEntry[] = [
      {
        accountOwner: 'AHMED',
        transactionType: 'PROFIT_SHARE',
        amount: 300,
        signedAmount: 300,
        invoiceId: 'm1',
        invoiceNumber: 'M-1',
        workType: 'CUSTOMER_WORK',
        description: 'ربح',
        createdAt: `${testMonth}-01`
      },
      {
        accountOwner: 'ABDO',
        transactionType: 'PROFIT_SHARE',
        amount: 300,
        signedAmount: 300,
        invoiceId: 'm1',
        invoiceNumber: 'M-1',
        workType: 'CUSTOMER_WORK',
        description: 'ربح',
        createdAt: `${testMonth}-01`
      },
      {
        accountOwner: 'REPLACEMENT_FUND',
        transactionType: 'REPLACEMENT_FUND_ALLOCATION',
        amount: 400,
        signedAmount: 400,
        invoiceId: 'm1',
        invoiceNumber: 'M-1',
        workType: 'CUSTOMER_WORK',
        description: 'صندوق',
        createdAt: `${testMonth}-01`
      }
    ];

    const settlement = calculateMonthlySettlement(testMonth, entries, []);

    // Sum directly from entries array for matching test
    const ahmedSumFromLedger = entries
      .filter((e) => e.accountOwner === 'AHMED' && e.transactionType === 'PROFIT_SHARE')
      .reduce((s, e) => s + e.signedAmount, 0);

    const abdoSumFromLedger = entries
      .filter((e) => e.accountOwner === 'ABDO' && e.transactionType === 'PROFIT_SHARE')
      .reduce((s, e) => s + e.signedAmount, 0);

    const fundSumFromLedger = entries
      .filter((e) => e.accountOwner === 'REPLACEMENT_FUND')
      .reduce((s, e) => s + e.signedAmount, 0);

    const pass =
      settlement.ahmedProfitShare === ahmedSumFromLedger &&
      settlement.abdouProfitShare === abdoSumFromLedger &&
      settlement.replacementFundDeposits === fundSumFromLedger;

    results.push({
      id: 10,
      title: '10) المطابقة التامة مع partner_ledger (100% Match)',
      passed: pass,
      expected: 'تطابق 100% بين محرك التسويات الشهرية ومجموع أسطر partner_ledger',
      actual: `أحمد (${settlement.ahmedProfitShare} == ${ahmedSumFromLedger})، عبده (${settlement.abdouProfitShare} == ${abdoSumFromLedger})، الصندوق (${settlement.replacementFundDeposits} == ${fundSumFromLedger})`
    });
  } catch (err: any) {
    results.push({
      id: 10,
      title: '10) المطابقة التامة مع partner_ledger',
      passed: false,
      expected: 'تطابق كامل',
      actual: err?.message || String(err)
    });
  }

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  return {
    passed,
    failed,
    total: results.length,
    results
  };
}
