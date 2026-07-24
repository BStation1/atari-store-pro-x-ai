import React, { useState } from "react";
import { X, PlusCircle, DollarSign, Wallet, FileText } from "lucide-react";
import { useDialog } from "../../context/DialogContext";
import { usePartners, usePartnerTransactions } from "../../hooks/useData";

interface PartnerTransactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultPartnerId?: string;
  currentUserId: string;
}

export default function PartnerTransactionsModal({
  isOpen,
  onClose,
  defaultPartnerId = "P-002",
  currentUserId
}: PartnerTransactionsModalProps) {
  const dialog = useDialog();
  const { partners } = usePartners();
  const { addTransaction } = usePartnerTransactions();

  const [partnerId, setPartnerId] = useState(defaultPartnerId);
  const [type, setType] = useState<"CASH_ADVANCE" | "CASH_WITHDRAWAL" | "INVENTORY_WITHDRAWAL" | "EXPENSE_CHARGE" | "MANUAL_ADJUSTMENT">("CASH_WITHDRAWAL");
  const [amount, setAmount] = useState<number>(0);
  const [reason, setReason] = useState("");
  const [treasury, setTreasury] = useState("الخزينة الرئيسية");
  const [notes, setNotes] = useState("");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0 || !reason.trim()) {
      await dialog.alert({ message: "يرجى إدخال مبلغ أكبر من صفر وكتابة بيان أو سبب الحركة بشكل صحيح", variant: "warning" });
      return;
    }

    addTransaction({
      partnerId,
      type,
      amount: Number(amount),
      date: new Date().toISOString(),
      reason: reason.trim(),
      approvedBy: currentUserId,
      notes: notes.trim() ? `الخزينة: ${treasury} - ${notes.trim()}` : `الخزينة: ${treasury}`,
      createdBy: currentUserId
    });

    onClose();
    setAmount(0);
    setReason("");
    setNotes("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl text-slate-100">
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-cyan-500/10 border border-cyan-500/30 rounded-xl text-cyan-400">
              <PlusCircle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg text-slate-100">تسجيل حركة سحب / مسحوبات شريك</h3>
              <p className="text-xs text-slate-400 mt-0.5">سلفة، مسحوبات نقدية أو مخزنية، تسوية حسابات الشركاء</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">الشريك المعني</label>
              <select
                value={partnerId}
                onChange={e => setPartnerId(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                {partners.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.nameAr || p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">نوع الحركة المالية</label>
              <select
                value={type}
                onChange={e => setType(e.target.value as any)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="CASH_WITHDRAWAL">مسحوبات نقدية (Cash Withdrawal)</option>
                <option value="CASH_ADVANCE">سلفة شخصية (Cash Advance)</option>
                <option value="INVENTORY_WITHDRAWAL">مسحوبات قطع غيار / بضاعة</option>
                <option value="EXPENSE_CHARGE">مصروفات شخصية محمّلة على الشريك</option>
                <option value="MANUAL_ADJUSTMENT">تسوية / تسوية دفترية يدوية</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">المبلغ (ج.م.) *</label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount || ""}
                  onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0.00"
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-3 pr-8 py-2.5 text-sm font-semibold text-cyan-400 focus:outline-none focus:border-cyan-500"
                />
                <DollarSign className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">الخزينة / الحساب المالي</label>
              <select
                value={treasury}
                onChange={e => setTreasury(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs text-slate-100 focus:outline-none focus:border-cyan-500"
              >
                <option value="الخزينة الرئيسية">الخزينة الرئيسية للمحل</option>
                <option value="فودافون كاش">فودافون كاش (Vodafone Cash)</option>
                <option value="إنستا باي">إنستا باي (InstaPay)</option>
                <option value="حساب البنك">حساب البنك الأهلي</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">البيان / السبب التفصيلي *</label>
            <input
              type="text"
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="مثال: سحب نقدي تحت حساب الأرباح / سلفة شخصية..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">ملاحظات إضافية</label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
              placeholder="أي تفاصيل أو أرقام إيصالات متعلقة بالحركة..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            />
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-medium text-slate-300 hover:bg-slate-800 border border-slate-700 transition"
            >
              إلغاء
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl text-xs font-semibold bg-cyan-500 hover:bg-cyan-600 text-slate-950 flex items-center gap-2 transition shadow-lg shadow-cyan-500/20"
            >
              <Wallet className="w-4 h-4" />
              حفظ وتأكيد الحركة
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
