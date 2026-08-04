import React from 'react';
import {
  Boxes,
  UserCheck,
  Users,
  Share2,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  PackageCheck
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import { Product } from '../../types';
import { calculateInventoryByOwnershipData } from '../../lib/finalReportsEngine';

interface InventoryOwnershipReportViewProps {
  products: Product[];
  currencySymbol?: string;
}

export default function InventoryOwnershipReportView({
  products,
  currencySymbol = 'ج.م.'
}: InventoryOwnershipReportViewProps) {
  const stockData = calculateInventoryByOwnershipData(products);

  const pieData = [
    { name: 'مخزون أحمد البنا', value: stockData.AHMED.valuationAtCost, fill: '#6366f1' },
    { name: 'مخزون عبده', value: stockData.ABDO.valuationAtCost, fill: '#06b6d4' },
    { name: 'المخزون المشترك', value: stockData.SHARED.valuationAtCost, fill: '#10b981' }
  ];

  const totalValuation =
    stockData.AHMED.valuationAtCost + stockData.ABDO.valuationAtCost + stockData.SHARED.valuationAtCost;

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-xl">
            <Boxes className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">تقرير تقييم المخزون حسب الملكية المستقلة</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              فصل تقييم البضائع وقطع الغيار المملوكة لأحمد أو عبده أو رأس المال المشترك
            </p>
          </div>
        </div>

        <div className="bg-[#181b2a] border border-[#2a2d42] px-4 py-2 rounded-xl text-xs">
          <span className="text-gray-400">إجمالي تقييم كافة المخزن بالتكلفة: </span>
          <span className="text-indigo-400 font-black text-sm mr-1">
            {totalValuation.toLocaleString('ar-EG')} {currencySymbol}
          </span>
        </div>
      </div>

      {/* 3 Dedicated Ownership Panels */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Panel 1: Ahmed Stock */}
        <div className="bg-[#11131e] border border-indigo-500/30 p-5 rounded-2xl relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-[#2a2d42]">
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
              <UserCheck className="w-4 h-4" />
              <span>مخزون أحمد البنا (AHMED)</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 text-[10px] font-bold">
              {stockData.AHMED.itemsCount} صنف
            </span>
          </div>

          <div className="mt-4 space-y-3 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-[#1f2937]">
              <span className="text-gray-400">إجمالي الكميات بالمخزن:</span>
              <span className="text-white font-bold">{stockData.AHMED.totalQuantity} قطعة</span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-[#1f2937]">
              <span className="text-gray-400">التقييم بسعر التكلفة:</span>
              <span className="text-indigo-400 font-bold">
                {stockData.AHMED.valuationAtCost.toLocaleString('ar-EG')} {currencySymbol}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-[#1f2937]">
              <span className="text-gray-400">القيمة التقديرية بأسعار البيع:</span>
              <span className="text-emerald-400 font-bold">
                {stockData.AHMED.retailSalesValue.toLocaleString('ar-EG')} {currencySymbol}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-[#1f2937]">
              <span className="text-gray-400">أصناف على وشك النفاذ:</span>
              <span className="text-amber-400 font-bold">{stockData.AHMED.lowStockItemsCount} صنف</span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-gray-400">أصناف نافدة بالكامل:</span>
              <span className="text-rose-400 font-bold">{stockData.AHMED.stagnantItemsCount} صنف</span>
            </div>
          </div>
        </div>

        {/* Panel 2: Abdo Stock */}
        <div className="bg-[#11131e] border border-cyan-500/30 p-5 rounded-2xl relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-[#2a2d42]">
            <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
              <Users className="w-4 h-4" />
              <span>مخزون عبده (ABDO)</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-400 text-[10px] font-bold">
              {stockData.ABDO.itemsCount} صنف
            </span>
          </div>

          <div className="mt-4 space-y-3 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-[#1f2937]">
              <span className="text-gray-400">إجمالي الكميات بالمخزن:</span>
              <span className="text-white font-bold">{stockData.ABDO.totalQuantity} قطعة</span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-[#1f2937]">
              <span className="text-gray-400">التقييم بسعر التكلفة:</span>
              <span className="text-cyan-400 font-bold">
                {stockData.ABDO.valuationAtCost.toLocaleString('ar-EG')} {currencySymbol}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-[#1f2937]">
              <span className="text-gray-400">القيمة التقديرية بأسعار البيع:</span>
              <span className="text-emerald-400 font-bold">
                {stockData.ABDO.retailSalesValue.toLocaleString('ar-EG')} {currencySymbol}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-[#1f2937]">
              <span className="text-gray-400">أصناف على وشك النفاذ:</span>
              <span className="text-amber-400 font-bold">{stockData.ABDO.lowStockItemsCount} صنف</span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-gray-400">أصناف نافدة بالكامل:</span>
              <span className="text-rose-400 font-bold">{stockData.ABDO.stagnantItemsCount} صنف</span>
            </div>
          </div>
        </div>

        {/* Panel 3: Shared Stock */}
        <div className="bg-[#11131e] border border-emerald-500/30 p-5 rounded-2xl relative overflow-hidden shadow-xl">
          <div className="flex items-center justify-between pb-3 border-b border-[#2a2d42]">
            <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
              <Share2 className="w-4 h-4" />
              <span>المخزون المشترك (SHARED)</span>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 text-[10px] font-bold">
              {stockData.SHARED.itemsCount} صنف
            </span>
          </div>

          <div className="mt-4 space-y-3 text-xs">
            <div className="flex justify-between items-center py-1 border-b border-[#1f2937]">
              <span className="text-gray-400">إجمالي الكميات بالمخزن:</span>
              <span className="text-white font-bold">{stockData.SHARED.totalQuantity} قطعة</span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-[#1f2937]">
              <span className="text-gray-400">التقييم بسعر التكلفة:</span>
              <span className="text-emerald-400 font-bold">
                {stockData.SHARED.valuationAtCost.toLocaleString('ar-EG')} {currencySymbol}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-[#1f2937]">
              <span className="text-gray-400">القيمة التقديرية بأسعار البيع:</span>
              <span className="text-emerald-300 font-bold">
                {stockData.SHARED.retailSalesValue.toLocaleString('ar-EG')} {currencySymbol}
              </span>
            </div>

            <div className="flex justify-between items-center py-1 border-b border-[#1f2937]">
              <span className="text-gray-400">أصناف على وشك النفاذ:</span>
              <span className="text-amber-400 font-bold">{stockData.SHARED.lowStockItemsCount} صنف</span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-gray-400">أصناف نافدة بالكامل:</span>
              <span className="text-rose-400 font-bold">{stockData.SHARED.stagnantItemsCount} صنف</span>
            </div>
          </div>
        </div>
      </div>

      {/* Distribution Chart */}
      <div className="bg-[#11131e] border border-[#2a2d42] p-6 rounded-2xl">
        <h3 className="text-sm font-bold text-white mb-1">توزيع رأس المال في المخزون حسب الملكية</h3>
        <p className="text-xs text-gray-400 mb-4">تمثيل بياني لنسب الاستثمار بالمخزن</p>

        <div className="w-full h-[280px] min-h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={85}
                paddingAngle={5}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ backgroundColor: '#161927', borderColor: '#2a2d42', color: '#f3f4f6' }} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
