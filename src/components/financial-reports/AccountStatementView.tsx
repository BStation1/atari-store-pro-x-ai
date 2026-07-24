import React, { useState } from 'react';
import {
  FileText,
  Printer,
  Download,
  User,
  Users,
  Building2,
  Briefcase,
  Search
} from 'lucide-react';
import { Customer, Expense, ReplacementFundEntry, Supplier, UserRole } from '../../types';
import { PartnerLedgerEntry } from '../../lib/partnerLedgerEngine';
import {
  generateAccountStatementRows,
  exportToCSV,
  openPrintableReportHTML
} from '../../lib/finalReportsEngine';

interface AccountStatementViewProps {
  partnerLedger: PartnerLedgerEntry[];
  fundEntries: ReplacementFundEntry[];
  expenses: Expense[];
  customers: Customer[];
  suppliers: Supplier[];
  userRole?: UserRole;
  currencySymbol?: string;
  shopName?: string;
}

export default function AccountStatementView({
  partnerLedger,
  fundEntries,
  expenses,
  customers,
  suppliers,
  userRole = 'OWNER',
  currencySymbol = 'ج.م.',
  shopName = 'Atari Store Pro X'
}: AccountStatementViewProps) {
  const [targetAccount, setTargetAccount] = useState<
    'AHMED' | 'ABDO' | 'REPLACEMENT_FUND' | 'CUSTOMER' | 'SUPPLIER'
  >('AHMED');

  const [selectedEntityId, setSelectedEntityId] = useState<string>('');

  const statementRows = generateAccountStatementRows(
    targetAccount,
    partnerLedger,
    fundEntries,
    expenses,
    selectedEntityId
  );

  const getAccountTitle = () => {
    switch (targetAccount) {
      case 'AHMED':
        return 'كشف حساب الشريك الأول — أحمد البنا';
      case 'ABDO':
        return 'كشف حساب الشريك الثاني — عبده';
      case 'REPLACEMENT_FUND':
        return 'كشف حساب صندوق تعويض البضاعة المخصصة';
      case 'CUSTOMER':
        return 'كشف حساب عميل تفصيلي';
      case 'SUPPLIER':
        return 'كشف حساب مورد تفصيلي';
      default:
        return 'كشف حساب تفصيلي';
    }
  };

  const handlePrint = () => {
    const headers = ['التاريخ', 'نوع الحركة', 'المرجع', 'البيان والوصف', 'مدين (-)', 'دائن (+)', 'الرصيد التراكمي'];

    const exportRows = statementRows.map((r) => [
      r.date,
      r.type,
      r.reference,
      r.description,
      r.debit ? `${r.debit} ${currencySymbol}` : '-',
      r.credit ? `${r.credit} ${currencySymbol}` : '-',
      `${r.cumulativeBalance} ${currencySymbol}`
    ]);

    openPrintableReportHTML(getAccountTitle(), headers, exportRows, shopName);
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Type', 'Reference', 'Description', 'Debit', 'Credit', 'Cumulative Balance'];

    const exportRows = statementRows.map((r) => [
      r.date,
      r.type,
      r.reference,
      r.description,
      r.debit,
      r.credit,
      r.cumulativeBalance
    ]);

    exportToCSV(`statement_${targetAccount.toLowerCase()}`, headers, exportRows, shopName);
  };

  return (
    <div className="space-y-6">
      {/* Account Picker Header */}
      <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-white font-bold text-sm">
            <FileText className="w-5 h-5 text-cyan-400" />
            <span>اختر كشف الحساب المطلوب استخراجه وترصيده</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="px-3.5 py-2 bg-[#181b2a] hover:bg-[#202538] text-gray-200 border border-[#2a2d42] rounded-xl text-xs font-semibold flex items-center gap-2 transition"
            >
              <Printer className="w-4 h-4 text-cyan-400" />
              طباعة رسمية / PDF
            </button>

            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 bg-cyan-500 hover:bg-cyan-600 text-slate-950 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-lg shadow-cyan-500/20"
            >
              <Download className="w-4 h-4" />
              تصدير CSV
            </button>
          </div>
        </div>

        {/* Account Selector Tabs */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 pt-2">
          {[
            { id: 'AHMED', label: 'أحمد البنا', icon: User, color: 'border-indigo-500/50 text-indigo-400' },
            { id: 'ABDO', label: 'عبده (الشريك الثاني)', icon: Users, color: 'border-cyan-500/50 text-cyan-400' },
            { id: 'REPLACEMENT_FUND', label: 'صندوق التعويض', icon: Building2, color: 'border-purple-500/50 text-purple-400' },
            { id: 'CUSTOMER', label: 'حساب عميل', icon: Briefcase, color: 'border-emerald-500/50 text-emerald-400' },
            { id: 'SUPPLIER', label: 'حساب مورد', icon: Briefcase, color: 'border-amber-500/50 text-amber-400' }
          ].map((tab) => {
            const Icon = tab.icon;
            const active = targetAccount === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => {
                  setTargetAccount(tab.id as any);
                  setSelectedEntityId('');
                }}
                className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-2 transition ${
                  active
                    ? `bg-[#181b2a] ${tab.color} shadow-lg`
                    : 'bg-[#11131e] border-[#2a2d42] text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Entity Selector for Customer or Supplier */}
        {targetAccount === 'CUSTOMER' && (
          <div className="pt-2 border-t border-[#1f2937] flex items-center gap-3">
            <span className="text-xs text-gray-400">اختر العميل:</span>
            <select
              value={selectedEntityId}
              onChange={(e) => setSelectedEntityId(e.target.value)}
              className="bg-[#181b2a] text-white border border-[#2a2d42] rounded-xl p-2 text-xs outline-none max-w-xs"
            >
              <option value="">جميع العملاء</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.phone || c.id})
                </option>
              ))}
            </select>
          </div>
        )}

        {targetAccount === 'SUPPLIER' && (
          <div className="pt-2 border-t border-[#1f2937] flex items-center gap-3">
            <span className="text-xs text-gray-400">اختر المورد:</span>
            <select
              value={selectedEntityId}
              onChange={(e) => setSelectedEntityId(e.target.value)}
              className="bg-[#181b2a] text-white border border-[#2a2d42] rounded-xl p-2 text-xs outline-none max-w-xs"
            >
              <option value="">جميع الموردين</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.company || s.id})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Account Statement Table */}
      <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#2a2d42] flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            {getAccountTitle()} ({statementRows.length} حركة)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right text-gray-300">
            <thead className="bg-[#181b2a] text-gray-400 font-semibold border-b border-[#2a2d42]">
              <tr>
                <th className="p-3">التاريخ</th>
                <th className="p-3">نوع الحركة</th>
                <th className="p-3">المرجع</th>
                <th className="p-3">البيان والوصف</th>
                <th className="p-3">مدين (-)</th>
                <th className="p-3">دائن (+)</th>
                <th className="p-3">الرصيد التراكمي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2937]">
              {statementRows.length > 0 ? (
                statementRows.map((r) => (
                  <tr key={r.id} className="hover:bg-[#161927] transition">
                    <td className="p-3 whitespace-nowrap text-gray-400">{r.date}</td>
                    <td className="p-3 font-semibold text-white">
                      <span className="px-2 py-0.5 rounded-md bg-[#181b2a] border border-[#2a2d42] text-[10px]">
                        {r.type}
                      </span>
                    </td>
                    <td className="p-3 text-cyan-400 font-mono">{r.reference}</td>
                    <td className="p-3 text-gray-300">{r.description}</td>
                    <td className="p-3 text-rose-400 font-medium">
                      {r.debit ? `${r.debit} ${currencySymbol}` : '-'}
                    </td>
                    <td className="p-3 text-emerald-400 font-medium">
                      {r.credit ? `${r.credit} ${currencySymbol}` : '-'}
                    </td>
                    <td
                      className={`p-3 font-bold ${
                        r.cumulativeBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {r.cumulativeBalance.toLocaleString('ar-EG')} {currencySymbol}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    لا توجد حركات مسجلة بهذا الحساب حتى الآن
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
