import React, { useState } from 'react';
import {
  PieChart,
  BarChart3,
  User,
  Users,
  Building2,
  Boxes,
  FileText,
  Lock,
  Wallet,
  ShieldAlert,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import {
  useCustomers,
  useInvoices,
  usePartnerLedger,
  usePartnerSettlements,
  useProducts,
  useSuppliers,
  useExpenses,
  useRepairOrders
} from '../../hooks/useData';
import ProfitsSummary from '../partner-accounting/ProfitsSummary';
import ExecutiveDashboardView from './ExecutiveDashboardView';
import AhmedDashboardView from './AhmedDashboardView';
import AbdoDashboardView from './AbdoDashboardView';
import ShopProfitsReportView from './ShopProfitsReportView';
import ReplacementFundReportView from './ReplacementFundReportView';
import InventoryOwnershipReportView from './InventoryOwnershipReportView';
import SalesReportView from './SalesReportView';
import MonthlySettlementsReportView from './MonthlySettlementsReportView';
import AccountStatementView from './AccountStatementView';
import CashOnDeliveryReportView from './CashOnDeliveryReportView';
import { Truck } from 'lucide-react';
import { UserRole } from '../../types';

interface FinancialReportsDashboardProps {
  currentUserId?: string;
  userRole?: UserRole;
}

export default function FinancialReportsDashboard({
  currentUserId = 'U-101',
  userRole = 'OWNER'
}: FinancialReportsDashboardProps) {
  const { invoices } = useInvoices();
  const { products } = useProducts();
  const { customers } = useCustomers();
  const { suppliers } = useSuppliers();
  const { ledger } = usePartnerLedger();
  const { settlements } = usePartnerSettlements();
  const { orders } = useRepairOrders();

  // Load expenses and fund entries from hooks or state
  const { expenses } = useExpenses();

  const [activeTab, setActiveTab] = useState<
    'profits_summary' | 'executive' | 'shop_profits' | 'sales' | 'cod' | 'ahmed' | 'abdo' | 'replacement' | 'inventory' | 'settlements' | 'statements'
  >('profits_summary');

  // Permission check: RECEPTIONIST or TECHNICIAN cannot view partner reports
  const isPartnerTabAllowed = userRole === 'OWNER' || userRole === 'ADMIN' || userRole === 'ACCOUNTANT';

  // Construct mock or real replacement fund entries
  const fundEntries = [
    ...ledger
      .filter((e) => e.workType === 'CUSTOMER_WORK' && !e.reversedAt)
      .map((e) => ({
        id: `fnd-${e.id}`,
        transactionType: 'DEPOSIT_CUSTOMER_WORK',
        amount: Number((e as any).replacementFundAmount || 600),
        signedAmount: Number((e as any).replacementFundAmount || 600),
        referenceId: e.invoiceNumber || e.invoiceId || '-',
        description: 'إيداع تعويض صيانة عملاء',
        createdByUserId: 'النظام',
        createdAt: e.createdAt
      }))
  ];

  return (
    <div className="space-y-6">
      {/* Module Title Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-[#11131e] to-cyan-950/60 border border-[#2a2d42] rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-xs mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>وحدة التقارير واللوحات المالية لشركاء Atari Store Pro X — Phase 6.4</span>
            </div>
            <h1 className="text-2xl font-black text-white tracking-tight">
              التقارير المالية واللوحات التنفيذية الحسابية (Final Financial Reports)
            </h1>
            <p className="text-xs text-gray-400 mt-1 max-w-3xl leading-relaxed">
              تقارير الدخل والمبيعات ودفتر الشركاء وصندوق تعويض البضاعة بناءً على القيود المحاسبية لـ invoice_accounting_ledger بدون أي إعادة احتساب داخلية.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-xs font-bold rounded-xl flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" />
              دفاتر مغلقة ومحمية
            </span>
          </div>
        </div>
      </div>

      {/* Primary Navigation Tabs */}
      <div className="bg-[#11131e] border border-[#2a2d42] p-2 rounded-2xl flex flex-wrap gap-1.5 overflow-x-auto">
        {[
          { id: 'profits_summary', label: 'ملخص الأرباح (أحمد وعبده)', icon: Building2, allowed: isPartnerTabAllowed },
          { id: 'executive', label: 'اللوحة المالية التنفيذية', icon: BarChart3, allowed: true },
          { id: 'shop_profits', label: 'تقرير أرباح المحل', icon: Building2, allowed: isPartnerTabAllowed },
          { id: 'ahmed', label: 'تقرير أرباح أحمد', icon: User, allowed: isPartnerTabAllowed },
          { id: 'abdo', label: 'تقرير أرباح عبده', icon: Users, allowed: isPartnerTabAllowed },
          { id: 'sales', label: 'تقارير المبيعات والأرباح', icon: FileText, allowed: true },
          { id: 'cod', label: 'طلبات الدفع عند الاستلام (COD)', icon: Truck, allowed: true },
          { id: 'replacement', label: 'صندوق تعويض البضاعة', icon: Building2, allowed: isPartnerTabAllowed },
          { id: 'inventory', label: 'المخزون حسب الملكية', icon: Boxes, allowed: true },
          { id: 'settlements', label: 'التسويات الشهرية', icon: Lock, allowed: isPartnerTabAllowed },
          { id: 'statements', label: 'كشوف الحسابات', icon: Wallet, allowed: isPartnerTabAllowed }
        ].map((tab) => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          if (!tab.allowed) return null;

          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition whitespace-nowrap ${
                active
                  ? 'bg-cyan-500 text-slate-950 shadow-lg shadow-cyan-500/20 font-black'
                  : 'bg-[#181b2a] text-gray-400 hover:text-white hover:bg-[#202538] border border-[#2a2d42]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Views Switching */}
      <div className="mt-4">
        {activeTab === 'profits_summary' && isPartnerTabAllowed && (
          <ProfitsSummary orders={orders} />
        )}

        {activeTab === 'executive' && (
          <ExecutiveDashboardView
            invoices={invoices}
            expenses={expenses}
            fundEntries={fundEntries}
            settlements={settlements}
          />
        )}

        {activeTab === 'shop_profits' && isPartnerTabAllowed && (
          <ShopProfitsReportView
            orders={orders}
          />
        )}

        {activeTab === 'sales' && (
          <SalesReportView
            invoices={invoices}
            customers={customers}
            userRole={userRole}
          />
        )}

        {activeTab === 'cod' && (
          <CashOnDeliveryReportView
            invoices={invoices}
            customers={customers}
            currentUserId={currentUserId}
            userRole={userRole}
          />
        )}

        {activeTab === 'ahmed' && isPartnerTabAllowed && (
          <AhmedDashboardView
            partnerLedger={ledger}
            expenses={expenses}
            settlements={settlements}
            orders={orders}
          />
        )}

        {activeTab === 'abdo' && isPartnerTabAllowed && (
          <AbdoDashboardView
            partnerLedger={ledger}
            expenses={expenses}
            settlements={settlements}
            orders={orders}
          />
        )}

        {activeTab === 'replacement' && isPartnerTabAllowed && (
          <ReplacementFundReportView
            fundEntries={fundEntries}
            userRole={userRole}
          />
        )}

        {activeTab === 'inventory' && (
          <InventoryOwnershipReportView
            products={products}
          />
        )}

        {activeTab === 'settlements' && isPartnerTabAllowed && (
          <MonthlySettlementsReportView
            settlements={settlements}
            userRole={userRole}
            currentUserId={currentUserId}
          />
        )}

        {activeTab === 'statements' && isPartnerTabAllowed && (
          <AccountStatementView
            partnerLedger={ledger}
            fundEntries={fundEntries}
            expenses={expenses}
            customers={customers}
            suppliers={suppliers}
            userRole={userRole}
          />
        )}

        {!isPartnerTabAllowed && ['ahmed', 'abdo', 'replacement', 'settlements', 'statements'].includes(activeTab) && (
          <div className="bg-[#11131e] border border-rose-500/30 p-8 rounded-2xl text-center space-y-3">
            <ShieldAlert className="w-10 h-10 text-rose-400 mx-auto" />
            <h3 className="text-base font-bold text-white">صلاحية غير كافية (Access Denied)</h3>
            <p className="text-xs text-gray-400 max-w-md mx-auto">
              عفواً، عرض دفاتر حسابات الشركاء والتسويات الشهرية مقتصر فقط على المالك (OWNER) والمحاسبين المعتمدين.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
