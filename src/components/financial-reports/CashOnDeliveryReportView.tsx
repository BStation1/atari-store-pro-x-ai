import React, { useState } from 'react';
import {
  Truck,
  CheckCircle2,
  XCircle,
  Clock,
  Phone,
  User,
  UserPlus,
  DollarSign,
  Search,
  Filter,
  AlertTriangle,
  FileText
} from 'lucide-react';
import { Customer, Invoice, UserRole } from '../../types';
import { useDialog } from '../../context/DialogContext';
import {
  confirmGuestDeliveryAndCollectionEngine,
  cancelCodOrderEngine,
  convertGuestToRegisteredCustomerEngine
} from '../../lib/guestCustomerEngine';
import {
  getInvoiceCustomerName,
  getInvoiceCustomerPhone,
  getInvoiceCustomerBadge,
  getInvoiceOrderStatusLabel
} from '../../lib/customerDisplayHelper';

interface CashOnDeliveryReportViewProps {
  invoices: Invoice[];
  customers: Customer[];
  onUpdateInvoice?: (inv: Invoice) => void;
  onAddCustomer?: (cust: Customer) => void;
  currentUserId?: string;
  userRole?: UserRole;
}

export default function CashOnDeliveryReportView({
  invoices,
  customers,
  onUpdateInvoice,
  onAddCustomer,
  currentUserId = 'U-101',
  userRole = 'OWNER'
}: CashOnDeliveryReportViewProps) {
  const dialog = useDialog();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Filter COD invoices
  const codInvoices = invoices.filter(
    (inv) =>
      inv.paymentMethod === 'CASH_ON_DELIVERY' ||
      inv.paymentMethod === 'COD' ||
      inv.orderStatus !== undefined ||
      inv.customerType === 'GUEST'
  );

  const filteredInvoices = codInvoices.filter((inv) => {
    const custName = getInvoiceCustomerName(inv, customers).toLowerCase();
    const custPhone = getInvoiceCustomerPhone(inv, customers);
    const invId = inv.id.toLowerCase();
    const query = searchQuery.toLowerCase();

    const matchesSearch =
      !query || custName.includes(query) || custPhone.includes(query) || invId.includes(query);

    const matchesStatus =
      statusFilter === 'ALL' ||
      (statusFilter === 'PENDING' && (inv.orderStatus === 'PENDING' || !inv.orderStatus)) ||
      inv.orderStatus === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalCodCount = codInvoices.length;
  const pendingCount = codInvoices.filter((inv) => (!inv.orderStatus || inv.orderStatus === 'PENDING') && !inv.isCancelled).length;
  const deliveredCount = codInvoices.filter((inv) => inv.orderStatus === 'DELIVERED').length;
  const totalPendingAmount = codInvoices
    .filter((inv) => (!inv.orderStatus || inv.orderStatus === 'PENDING') && !inv.isCancelled)
    .reduce((sum, inv) => sum + Math.max(0, inv.totalAmount - inv.paidAmount), 0);

  const handleConfirmDelivery = async (inv: Invoice) => {
    const remaining = Math.max(0, inv.totalAmount - inv.paidAmount);
    const isGuest = inv.customerType === 'GUEST' || !inv.customerId;

    if (remaining > 0 && isGuest) {
      const choice = await dialog.confirm({
        title: 'تأكيد تسليم طلب عميل زائر',
        message: `لا يمكن إتمام تسليم طلب العميل الزائر مع وجود مبلغ متبقٍ قدره (${remaining.toLocaleString()} ج.م).\n\nاختر آلية المعالجة المطلوبة:`,
        confirmText: 'تحصيل المبلغ كاملاً الآن',
        cancelText: 'حفظ كعميل دائم ونقل الرصيد لحسابه'
      });

      if (choice) {
        // Collect Now
        try {
          const res = confirmGuestDeliveryAndCollectionEngine(
            inv,
            { id: currentUserId, name: 'أحمد البنا', role: userRole },
            { actionIfRemainingBalance: 'COLLECT_NOW' }
          );
          if (onUpdateInvoice) onUpdateInvoice(res.updatedInvoice);
          await dialog.alert({
            message: `تم تسليم الطلب وتحصيل مبلغ (${res.paymentCollected.toLocaleString()} ج.م) بنجاح.`,
            variant: 'success'
          });
        } catch (err: any) {
          await dialog.alert({ message: err.message || 'تعذر تأكيد التسليم', variant: 'error' });
        }
      } else {
        // Convert to Registered Customer
        const name = getInvoiceCustomerName(inv, customers);
        const phone = getInvoiceCustomerPhone(inv, customers);

        const convertRes = convertGuestToRegisteredCustomerEngine(inv, customers, undefined, {
          name,
          phone
        });

        if (!convertRes.success && convertRes.code === 'PHONE_COLLISION') {
          const useExisting = await dialog.confirm({
            title: 'عميل مسجل موجود بنفس الهاتف',
            message: `يوجد عميل مسجل بالفعل باسم (${convertRes.existingCustomer?.name}) ورقم هاتف (${convertRes.existingCustomer?.phone}).\n\nهل ترغب في ربط الفاتورة بالعميل المسجل الحالي؟`,
            confirmText: 'ربط بالعميل الحالي',
            cancelText: 'إلغاء'
          });

          if (useExisting && convertRes.existingCustomer) {
            const finalConvert = convertGuestToRegisteredCustomerEngine(
              inv,
              customers,
              convertRes.existingCustomer.id
            );
            if (finalConvert.updatedInvoice) {
              const deliveryRes = confirmGuestDeliveryAndCollectionEngine(
                finalConvert.updatedInvoice,
                { id: currentUserId, name: 'أحمد البنا', role: userRole },
                {
                  actionIfRemainingBalance: 'CONVERT_TO_REGISTERED',
                  targetRegisteredCustomerId: convertRes.existingCustomer.id
                }
              );
              if (onUpdateInvoice) onUpdateInvoice(deliveryRes.updatedInvoice);
              await dialog.alert({
                message: 'تم ربط الفاتورة بالعميل المسجل وتأكيد التسليم بنجاح.',
                variant: 'success'
              });
            }
          }
        } else if (convertRes.success && convertRes.newCustomerCreated) {
          if (onAddCustomer) onAddCustomer(convertRes.newCustomerCreated);
          const deliveryRes = confirmGuestDeliveryAndCollectionEngine(
            convertRes.updatedInvoice!,
            { id: currentUserId, name: 'أحمد البنا', role: userRole },
            {
              actionIfRemainingBalance: 'CONVERT_TO_REGISTERED',
              targetRegisteredCustomerId: convertRes.newCustomerCreated.id
            }
          );
          if (onUpdateInvoice) onUpdateInvoice(deliveryRes.updatedInvoice);
          await dialog.alert({
            message: 'تم حفظ العميل كعميل دائم ونقل المبلغ المتبقي لحسابه وتأكيد التسليم بنجاح.',
            variant: 'success'
          });
        }
      }
    } else {
      // Immediate confirmation
      try {
        const res = confirmGuestDeliveryAndCollectionEngine(
          inv,
          { id: currentUserId, name: 'أحمد البنا', role: userRole },
          { actionIfRemainingBalance: 'COLLECT_NOW' }
        );
        if (onUpdateInvoice) onUpdateInvoice(res.updatedInvoice);
        await dialog.alert({ message: 'تم تأكيد تسليم وسداد الطلب بنجاح.', variant: 'success' });
      } catch (err: any) {
        await dialog.alert({ message: err.message || 'تعذر تأكيد التسليم', variant: 'error' });
      }
    }
  };

  const handleCancelOrder = async (inv: Invoice) => {
    const reason = await dialog.prompt({
      title: `إلغاء طلب الدفع عند الاستلام (${inv.id})`,
      message: 'يرجى إدخال سبب الإلغاء لتوثيقه في السجل الإداري (Audit Trail):',
      placeholder: 'سبب الإلغاء (مثلاً: تعذر التواصل مع العميل)'
    });

    if (!reason || !reason.trim()) return;

    const res = cancelCodOrderEngine(
      inv,
      { id: currentUserId, name: 'أحمد البنا' },
      reason.trim()
    );
    if (onUpdateInvoice) onUpdateInvoice(res.updatedInvoice);
    await dialog.alert({ message: 'تم إلغاء طلب الدفع عند الاستلام بنجاح.', variant: 'success' });
  };

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl">
          <span className="text-[11px] text-gray-400 block">إجمالي طلبات الدفع عند الاستلام</span>
          <h3 className="text-2xl font-bold text-white mt-1">{totalCodCount} طلب</h3>
        </div>
        <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl">
          <span className="text-[11px] text-amber-400 block">طلبات قيد التجهيز / التسليم</span>
          <h3 className="text-2xl font-bold text-amber-400 mt-1">{pendingCount} طلب</h3>
        </div>
        <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl">
          <span className="text-[11px] text-emerald-400 block">طلبات مسلّمة ومحصلة</span>
          <h3 className="text-2xl font-bold text-emerald-400 mt-1">{deliveredCount} طلب</h3>
        </div>
        <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl">
          <span className="text-[11px] text-cyan-400 block">مبالغ منتظرة التحصيل عند التسليم</span>
          <h3 className="text-2xl font-bold text-cyan-400 mt-1">{totalPendingAmount.toLocaleString()} ج.م</h3>
        </div>
      </div>

      {/* Filter and Search controls */}
      <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 absolute right-3 top-3 text-gray-400" />
          <input
            type="text"
            placeholder="ابحث بالاسم، رقم الهاتف، أو رقم الفاتورة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg pr-9 pl-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
          >
            <option value="ALL">جميع الحالات</option>
            <option value="PENDING">قيد التجهيز / التسليم</option>
            <option value="DELIVERED">تم التسليم</option>
            <option value="CANCELLED">ملغي</option>
          </select>
        </div>
      </div>

      {/* Orders Table */}
      <div className="bg-[#11131e] border border-[#2a2d42] rounded-xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-[#2a2d42] flex justify-between items-center">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <Truck className="w-4 h-4 text-indigo-400" />
            سجل طلبات الدفع عند الاستلام للعملاء الزائرين والمسجلين
          </h3>
          <span className="text-xs text-gray-400 font-mono">عرض {filteredInvoices.length} طلب</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead className="bg-[#181b2a] text-gray-400 border-b border-[#2a2d42]">
              <tr>
                <th className="py-3 px-4">رقم الفاتورة</th>
                <th className="py-3 px-4">اسم العميل</th>
                <th className="py-3 px-4">رقم الهاتف</th>
                <th className="py-3 px-4">نوع العميل</th>
                <th className="py-3 px-4">إجمالي الطلب</th>
                <th className="py-3 px-4">المبلغ المتبقي</th>
                <th className="py-3 px-4">حالة الطلب</th>
                <th className="py-3 px-4">الإجراءات والتحصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2d42]/60 text-gray-300">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-gray-500 font-medium">
                    لا توجد طلبات دفع عند الاستلام مطابقة لخيارات البحث
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const name = getInvoiceCustomerName(inv, customers);
                  const phone = getInvoiceCustomerPhone(inv, customers);
                  const badge = getInvoiceCustomerBadge(inv);
                  const statusLabel = getInvoiceOrderStatusLabel(inv.orderStatus);
                  const remaining = Math.max(0, inv.totalAmount - inv.paidAmount);

                  return (
                    <tr key={inv.id} className="hover:bg-white/5 transition">
                      <td className="py-3 px-4 font-mono text-indigo-300 font-bold">{inv.id}</td>
                      <td className="py-3 px-4 font-bold text-white">{name}</td>
                      <td className="py-3 px-4 font-mono text-gray-300">{phone || '-'}</td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            badge.type === 'GUEST'
                              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                              : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                          }`}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-white">{inv.totalAmount.toLocaleString()} ج.م</td>
                      <td className="py-3 px-4 font-bold text-rose-400">
                        {remaining > 0 ? `${remaining.toLocaleString()} ج.م` : 'مُسدد بالكامل'}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`px-2.5 py-1 rounded-lg text-[10px] font-bold ${
                            inv.orderStatus === 'DELIVERED'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : inv.orderStatus === 'CANCELLED' || inv.isCancelled
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {inv.isCancelled ? 'ملغي' : statusLabel}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          {inv.orderStatus !== 'DELIVERED' && !inv.isCancelled && (
                            <>
                              <button
                                onClick={() => handleConfirmDelivery(inv)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[10px] flex items-center gap-1 transition"
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                تأكيد التسليم والتحصيل
                              </button>
                              <button
                                onClick={() => handleCancelOrder(inv)}
                                className="px-2.5 py-1 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-lg font-bold text-[10px] flex items-center gap-1 transition"
                              >
                                <XCircle className="w-3 h-3" />
                                إلغاء
                              </button>
                            </>
                          )}
                          {inv.orderStatus === 'DELIVERED' && (
                            <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              تم التسليم والتحصيل
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
