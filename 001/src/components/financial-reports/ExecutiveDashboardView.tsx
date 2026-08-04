import React from 'react';
import {
  TrendingUp,
  DollarSign,
  Briefcase,
  AlertCircle,
  CheckCircle2,
  Lock,
  Unlock,
  Building2,
  PieChart as PieIcon,
  BarChart3,
  ShieldAlert,
  Wallet
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from 'recharts';
import { Expense, Invoice, MonthlySettlementResult, ReplacementFundEntry } from '../../types';
import { calculateExecutiveDashboardData } from '../../lib/finalReportsEngine';

interface ExecutiveDashboardViewProps {
  invoices: Invoice[];
  expenses: Expense[];
  fundEntries: ReplacementFundEntry[];
  settlements: MonthlySettlementResult[];
  currencySymbol?: string;
}

export default function ExecutiveDashboardView({
  invoices,
  expenses,
  fundEntries,
  settlements,
  currencySymbol = 'ج.م.'
}: ExecutiveDashboardViewProps) {
  const data = calculateExecutiveDashboardData(invoices, expenses, fundEntries, settlements);

  // Prepare chart data safely
  const monthsArabic = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
  const currentYear = new Date().getFullYear();

  // Monthly sales & expenses chart data from actual invoices & expenses
  const monthlyData = monthsArabic.slice(0, 7).map((mName, idx) => {
    const monthStr = `${currentYear}-${String(idx + 1).padStart(2, '0')}`;
    const mSales = invoices
      .filter((inv) => !inv.isCancelled && (inv.date || '').startsWith(monthStr))
      .reduce((sum, inv) => sum + Number(inv.totalAmount || 0), 0);

    const mExp = expenses
      .filter((ex) => !ex.isCancelled && (ex.date || '').startsWith(monthStr))
      .reduce((sum, ex) => sum + Number(ex.amount || 0), 0);

    return {
      name: mName,
      المبيعات: mSales,
      المصروفات: mExp,
      الأرباح: Math.max(0, mSales - mExp)
    };
  });

  const hasChartData = monthlyData.some((m) => m.المبيعات > 0 || m.المصروفات > 0);

  // Expenses pie chart data
  const expenseByCategory: Record<string, number> = {};
  for (const exp of expenses) {
    if (exp.isCancelled) continue;
    const cat = exp.category || 'عام';
    expenseByCategory[cat] = (expenseByCategory[cat] || 0) + Number(exp.amount || 0);
  }

  const pieData = Object.entries(expenseByCategory).map(([name, value]) => ({ name, value }));
  const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6', '#06b6d4'];

  return (
    <div className="space-y-6">
      {/* Top 4 Primary Financial KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-bold">إجمالي مبيعات اليوم</span>
            <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-400">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-white">
              {data.dailySales.toLocaleString('ar-EG')} <span className="text-xs text-indigo-400">{currencySymbol}</span>
            </h3>
            <p className="text-[11px] text-gray-400 mt-1">إجمالي الفواتير المحصلة اليوم</p>
          </div>
        </div>

        <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-bold">مبيعات الشهر الحالي</span>
            <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-emerald-400">
              {data.monthlySales.toLocaleString('ar-EG')} <span className="text-xs">{currencySymbol}</span>
            </h3>
            <p className="text-[11px] text-gray-400 mt-1">تراكمي الشهر الجاري</p>
          </div>
        </div>

        <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-bold">إجمالي تكلفة المبيعات (COGS)</span>
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Briefcase className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className="text-2xl font-black text-amber-400">
              {data.totalCogs.toLocaleString('ar-EG')} <span className="text-xs">{currencySymbol}</span>
            </h3>
            <p className="text-[11px] text-gray-400 mt-1">تكلفة القطع والأصناف المبيعة</p>
          </div>
        </div>

        <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl relative overflow-hidden shadow-lg">
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-400 font-bold">صافي الأرباح التشغيلية</span>
            <div className="p-2 rounded-xl bg-cyan-500/10 text-cyan-400">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <h3 className={`text-2xl font-black ${data.netProfit >= 0 ? 'text-cyan-400' : 'text-rose-400'}`}>
              {data.netProfit.toLocaleString('ar-EG')} <span className="text-xs">{currencySymbol}</span>
            </h3>
            <p className="text-[11px] text-gray-400 mt-1">بعد خصم المصروفات التشغيلية</p>
          </div>
        </div>
      </div>

      {/* Secondary Status & Debt Breakdown Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-xs">إجمالي المصروفات الشهرية</p>
            <h4 className="text-xl font-bold text-rose-400 mt-1">
              {data.totalExpenses.toLocaleString('ar-EG')} {currencySymbol}
            </h4>
          </div>
          <span className="p-3 bg-rose-500/10 text-rose-400 rounded-xl">
            <ShieldAlert className="w-5 h-5" />
          </span>
        </div>

        <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-xs">ديون المتبقي لدى العملاء</p>
            <h4 className="text-xl font-bold text-amber-400 mt-1">
              {data.totalCustomerDebts.toLocaleString('ar-EG')} {currencySymbol}
            </h4>
            <span className="text-[10px] text-gray-500">من {data.partiallyPaidCount + data.unpaidCount} فاتورة مؤجلة</span>
          </div>
          <span className="p-3 bg-amber-500/10 text-amber-400 rounded-xl">
            <AlertCircle className="w-5 h-5" />
          </span>
        </div>

        <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl flex items-center justify-between">
          <div>
            <p className="text-gray-400 text-xs">رصيد صندوق تعويض البضاعة</p>
            <h4 className="text-xl font-bold text-purple-400 mt-1">
              {data.replacementFundBalance.toLocaleString('ar-EG')} {currencySymbol}
            </h4>
            <span className="text-[10px] text-purple-300">مخصص تعويض بضاعة العملاء</span>
          </div>
          <span className="p-3 bg-purple-500/10 text-purple-400 rounded-xl">
            <Building2 className="w-5 h-5" />
          </span>
        </div>
      </div>

      {/* Open / Locked Months Status Bar */}
      <div className="bg-gradient-to-r from-slate-900 via-[#11131e] to-slate-900 border border-[#2a2d42] p-4 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-xl">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">حالة التسويات والشهور المحاسبية</h4>
            <p className="text-xs text-gray-400">
              الأشهر المغلقة بالكامل: <span className="text-emerald-400 font-bold">{data.lockedMonthsCount}</span> | الأشهر المفتوحة: <span className="text-amber-400 font-bold">{data.openMonthsCount}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-xs font-bold flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5" />
            حسابات مستقرة
          </span>
        </div>
      </div>

      {/* Charts Section with Explicit Containers */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Monthly Sales vs Expenses Chart */}
        <div className="lg:col-span-2 bg-[#11131e] border border-[#2a2d42] p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-indigo-400" />
              المبيعات والمصروفات والأرباح الشهرية (عام {currentYear})
            </h3>
            <p className="text-xs text-gray-400 mt-1">مقارنة بيلوجية دقيقة بين التحصيلات والإنفاق المالي</p>
          </div>

          <div className="w-full h-[280px] min-h-[280px] mt-4">
            {hasChartData ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="name" stroke="#9ca3af" fontSize={11} />
                  <YAxis stroke="#9ca3af" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: '#161927', borderColor: '#2a2d42', color: '#f3f4f6' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="المبيعات" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="المصروفات" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="الأرباح" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center border border-dashed border-[#2a2d42] rounded-xl text-gray-500">
                <PieIcon className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-xs font-semibold">لا توجد بيانات مبيعات أو مصروفات مسجلة لهذه الفترة</p>
              </div>
            )}
          </div>
        </div>

        {/* Expenses Distribution Pie Chart */}
        <div className="bg-[#11131e] border border-[#2a2d42] p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <PieIcon className="w-4 h-4 text-purple-400" />
              توزيع المصروفات حسب الفئات
            </h3>
            <p className="text-xs text-gray-400 mt-1">نسبة التكاليف التشغيلية والإدارية</p>
          </div>

          <div className="w-full h-[280px] min-h-[280px] mt-4">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={85}
                    paddingAngle={4}
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: '#161927', borderColor: '#2a2d42', color: '#f3f4f6' }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center border border-dashed border-[#2a2d42] rounded-xl text-gray-500">
                <ShieldAlert className="w-8 h-8 mb-2 opacity-50" />
                <p className="text-xs font-semibold">لا توجد مصروفات مسجلة</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
