import React, { useState } from 'react';
import {
  Lock,
  Unlock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  History,
  ShieldCheck,
  RefreshCw,
  FileText
} from 'lucide-react';
import { MonthlySettlementResult, UserRole } from '../../types';
import { useDialog } from '../../context/DialogContext';
import { reopenMonthEngine } from '../../lib/monthlySettlementEngine';

interface MonthlySettlementsReportViewProps {
  settlements: MonthlySettlementResult[];
  onReloadData?: () => void;
  userRole?: UserRole;
  currentUserId?: string;
  currencySymbol?: string;
}

export default function MonthlySettlementsReportView({
  settlements,
  onReloadData,
  userRole = 'OWNER',
  currentUserId = 'U-101',
  currencySymbol = 'ج.م.'
}: MonthlySettlementsReportViewProps) {
  const dialog = useDialog();
  const [selectedAuditLog, setSelectedAuditLog] = useState<MonthlySettlementResult | null>(null);

  const handleReopenMonth = async (settlementItem: MonthlySettlementResult) => {
    if (userRole !== 'OWNER') {
      await dialog.alert({
        message: 'عفواً، إعادة فتح شهر محاسبي مغلق مقتصر حصراً على المالك (OWNER)',
        variant: 'error'
      });
      return;
    }

    const reason = await dialog.prompt({
      title: `إعادة فتح الشهر المحاسبي (${settlementItem.settlementMonth})`,
      message: 'يرجى كتابة سبب طلب إعادة الفتح لأغراض الرقابة والسجل الإداري (Audit Log):',
      placeholder: 'سبب الفتح (مثلاً: تعديل فاتورة مرتجعة أو تسجيل مصروف متأخر)'
    });

    if (!reason || !reason.trim()) return;

    try {
      const { updatedSettlement } = reopenMonthEngine(
        settlementItem,
        { id: currentUserId, name: 'أحمد البنا', role: userRole },
        reason.trim()
      );
      await dialog.alert({
        message: `تمت إعادة فتح الشهر المحاسبي (${updatedSettlement.settlementMonth}) بنجاح. يمكن الآن تعديل القيود وإعادة إغلاقه عند الجاهزية.`,
        variant: 'success'
      });
      if (onReloadData) onReloadData();
    } catch (err: any) {
      await dialog.alert({ message: err?.message || 'تعذر إعادة فتح الشهر', variant: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-500/10 text-cyan-400 rounded-xl">
            <Lock className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">تقرير وسجل التسويات الشهرية المعتمدة</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              استعراض نتائج إغلاق الشهور المحاسبية السابقة والحالة المجمدة (Frozen Snapshots)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-xl text-xs font-bold flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4" />
            حماية الـ Ledger الثابتة
          </span>
        </div>
      </div>

      {/* Settlements Table */}
      <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-[#2a2d42] flex items-center justify-between">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-cyan-400" />
            جدول الشهور المحاسبية ({settlements.length} شهر)
          </h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right text-gray-300">
            <thead className="bg-[#181b2a] text-gray-400 font-semibold border-b border-[#2a2d42]">
              <tr>
                <th className="p-3">الشهر</th>
                <th className="p-3">الحالة</th>
                <th className="p-3">أرباح أحمد</th>
                <th className="p-3">أرباح عبده</th>
                <th className="p-3">التزامات عبده</th>
                <th className="p-3">إجمالي المصروفات</th>
                <th className="p-3">صافي صرف أحمد</th>
                <th className="p-3">صافي صرف عبده</th>
                <th className="p-3">تاريخ الإغلاق والاعتماد</th>
                <th className="p-3">الإجراءات والرقابة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2937]">
              {settlements.length > 0 ? (
                settlements.map((s) => (
                  <tr key={s.settlementMonth} className="hover:bg-[#161927] transition">
                    <td className="p-3 font-mono font-bold text-white text-sm">{s.settlementMonth}</td>
                    <td className="p-3 font-bold">
                      {s.status === 'LOCKED' ? (
                        <span className="px-2.5 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] flex items-center gap-1 w-fit">
                          <Lock className="w-3 h-3" />
                          مغلق ومعتمد
                        </span>
                      ) : (
                        <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-lg text-[10px] flex items-center gap-1 w-fit">
                          <Unlock className="w-3 h-3" />
                          مفتوح تحت التعديل
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-emerald-400 font-bold">{s.ahmedProfitShare} {currencySymbol}</td>
                    <td className="p-3 text-cyan-400 font-bold">{s.abdouProfitShare} {currencySymbol}</td>
                    <td className="p-3 text-amber-400">{s.abdouSettlementObligation} {currencySymbol}</td>
                    <td className="p-3 text-rose-400">{s.totalExpenses} {currencySymbol}</td>
                    <td className="p-3 font-black text-indigo-300">{s.ahmedNetPayout} {currencySymbol}</td>
                    <td className="p-3 font-black text-emerald-300">{s.abdouNetPayout} {currencySymbol}</td>
                    <td className="p-3 text-gray-400 text-[11px]">
                      {s.lockedAt ? (
                        <div>
                          <div>{s.lockedAt.slice(0, 10)}</div>
                          <div className="text-[9px] text-gray-500">{s.lockedByUserName || 'المالك'}</div>
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {s.status === 'LOCKED' && userRole === 'OWNER' && (
                          <button
                            onClick={() => handleReopenMonth(s)}
                            className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg text-[10px] font-bold transition flex items-center gap-1"
                          >
                            <Unlock className="w-3 h-3" />
                            إعادة فتح
                          </button>
                        )}

                        {s.reopenAuditLog && s.reopenAuditLog.length > 0 && (
                          <button
                            onClick={() => setSelectedAuditLog(s)}
                            className="px-2 py-1 bg-[#181b2a] hover:bg-[#202538] text-gray-300 border border-[#2a2d42] rounded-lg text-[10px] font-semibold flex items-center gap-1"
                          >
                            <History className="w-3 h-3 text-cyan-400" />
                            سجل الفتح ({s.reopenAuditLog.length})
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-500">
                    لا توجد شهور تم إغلاقها أو تسويتها حتى الآن
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Log Dialog / Modal */}
      {selectedAuditLog && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#2a2d42]">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <History className="w-4 h-4 text-cyan-400" />
                سجل التدقيق والرقابة لإعادة الفتح ({selectedAuditLog.settlementMonth})
              </h3>
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="text-gray-400 hover:text-white font-bold text-sm"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto text-xs text-gray-300">
              {selectedAuditLog.reopenAuditLog?.map((a, idx) => (
                <div key={idx} className="bg-[#181b2a] border border-[#2a2d42] p-3 rounded-xl space-y-1">
                  <div className="flex justify-between items-center text-gray-400 text-[10px]">
                    <span>تاريخ الإجراء: {a.reopenedAt?.slice(0, 19).replace('T', ' ')}</span>
                    <span className="text-cyan-400 font-bold">{a.reopenedByUserName || a.reopenedByUserId}</span>
                  </div>
                  <p className="text-white font-medium mt-1">السبب: {a.reason}</p>
                </div>
              ))}
            </div>

            <div className="pt-2 text-left">
              <button
                onClick={() => setSelectedAuditLog(null)}
                className="px-4 py-2 bg-[#181b2a] hover:bg-[#202538] text-white rounded-xl text-xs font-bold border border-[#2a2d42]"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
