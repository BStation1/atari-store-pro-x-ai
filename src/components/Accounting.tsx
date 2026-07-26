/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { formatPhoneDisplay } from "../utils/phone";
import {
  FileText,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Plus,
  Trash2,
  Calendar,
  Layers,
  ChevronLeft,
  X,
  CreditCard,
  Printer,
  Sparkles,
  ShoppingBag,
  RotateCcw,
  ShieldAlert
} from "lucide-react";
import { useDialog } from "../context/DialogContext";
import { useInvoices, useExpenses, useCustomers, useProducts, useSettings, useCurrentUser, useRepairOrders } from "../hooks/useData";
import { Invoice, Expense, PaymentMethod, User } from "../types";
import PrintReceiptModal from "./PrintReceiptModal";
import DeleteSaleModal from "./DeleteSaleModal";
import ProfitsSummary from "./partner-accounting/ProfitsSummary";
import { canDeleteSale, canDeleteAccountingTransaction } from "../lib/authPermissions";
import { getInvoiceCustomerName, getInvoiceCustomerBadge } from "../lib/customerDisplayHelper";
import { db } from "../lib/db";

interface AccountingProps {
  openInvoiceModal?: boolean;
}

export default function Accounting({ openInvoiceModal = false }: AccountingProps) {
  const dialog = useDialog();
  const { user: currentLoggedUser } = useCurrentUser();
  const { invoices, addInvoice } = useInvoices();
  const { expenses, addExpense } = useExpenses();
  const { customers } = useCustomers();
  const { products, updateProduct } = useProducts();
  const { settings } = useSettings();
  const { orders } = useRepairOrders();

  // Selected Invoice for Delete Modal
  const [selectedInvoiceToDelete, setSelectedInvoiceToDelete] = useState<Invoice | null>(null);

  const currentUserForAction: User = currentLoggedUser || {
    id: "U-101",
    username: "elbanna",
    name: "أحمد البنا",
    fullName: "أحمد البنا (الشريك الأول)",
    role: "OWNER",
    roleId: "OWNER",
    email: "elbannafc@gmail.com",
    isActive: true,
    createdAt: new Date().toISOString()
  };

  // Tabs: Invoices vs Expenses
  const [activeTab, setActiveTab] = useState<"invoices" | "expenses">("invoices");

  // Receipt Modal State
  const [receiptInvoice, setReceiptInvoice] = useState<Invoice | undefined>(undefined);
  const [isReceiptOpen, setIsReceiptOpen] = useState(false);

  // New Expense Modal State
  const [isExpenseOpen, setIsExpenseOpen] = useState(false);
  const [eCategory, setECategory] = useState("رواتب وأجور");
  const [eDesc, setEDesc] = useState("");
  const [eAmount, setEAmount] = useState(0);

  // Direct Sales Invoice Creator Modal State
  const [isSalesModalOpen, setIsSalesModalOpen] = useState(openInvoiceModal);
  const [customerType, setCustomerType] = useState<'GUEST' | 'REGISTERED'>('GUEST');
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [guestNote, setGuestNote] = useState('');
  const [selectedCustId, setSelectedCustId] = useState('');
  const [saleItems, setSaleItems] = useState<{ productId: string; qty: number; name: string; price: number }[]>([
    { productId: '', qty: 1, name: '', price: 0 }
  ]);
  const [salePaymentMethod, setSalePaymentMethod] = useState<PaymentMethod | string>(PaymentMethod.Cash);
  const [saleDiscount, setSaleDiscount] = useState(0);

  const { addCustomer } = useCustomers();

  // Calculate General Accounting totals
  const totalInvoicesAmount = invoices.reduce((sum, inv) => sum + (inv.paidAmount || 0), 0);
  const totalExpensesAmount = expenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);
  
  // COGS calculation from repair orders and invoice items
  const totalCogs = orders.reduce((sum, o) => {
    const devicePartsCost = o.devices?.reduce((pSum, d) => pSum + (Number(d.partsCost) || 0), 0) || 0;
    return sum + devicePartsCost;
  }, 0);

  // Debts / Receivables from customers
  const totalCustomerDebts = customers.reduce((sum, c) => sum + (c.balance > 0 ? c.balance : 0), 0);

  // Total in Vault Cashbox & Overall Net Profit
  const totalCashbox = totalInvoicesAmount - totalExpensesAmount;
  const netProfit = totalInvoicesAmount - totalExpensesAmount - totalCogs;

  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eDesc || eAmount <= 0) return;

    addExpense({
      category: eCategory,
      description: eDesc,
      amount: Number(eAmount),
      createdBy: "أحمد محمد"
    });

    setIsExpenseOpen(false);
    setEDesc("");
    setEAmount(0);
    setECategory("رواتب وأجور");
  };

  const handleAddSaleItemRow = () => {
    setSaleItems([...saleItems, { productId: "", qty: 1, name: "", price: 0 }]);
  };

  const handleRemoveSaleItemRow = (idx: number) => {
    if (saleItems.length === 1) return;
    setSaleItems(saleItems.filter((_, i) => i !== idx));
  };

  const handleSaleItemChange = (idx: number, productId: string) => {
    const prod = products.find(p => p.id === productId);
    if (!prod) return;

    const updated = [...saleItems];
    updated[idx] = {
      productId,
      qty: 1,
      name: prod.name,
      price: prod.sellPrice
    };
    setSaleItems(updated);
  };

  const handleSaleItemQtyChange = (idx: number, qty: number) => {
    const updated = [...saleItems];
    updated[idx] = { ...updated[idx], qty: Number(qty) };
    setSaleItems(updated);
  };

  const handleCreateDirectSaleInvoice = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate Customer choice
    const isGuest = customerType === 'GUEST';
    const isCod = salePaymentMethod === 'CASH_ON_DELIVERY' || salePaymentMethod === PaymentMethod.CashOnDelivery;

    if (isGuest) {
      if (!guestName || !guestName.trim()) {
        await dialog.alert({ message: "يرجى كتابة اسم العميل الزائر إجبارياً", variant: "warning" });
        return;
      }
      if (isCod && (!guestPhone || !guestPhone.trim())) {
        await dialog.alert({ message: "يرجى إدخال رقم الهاتف إجبارياً لطلبات العميل الزائر بنظام الدفع عند الاستلام", variant: "warning" });
        return;
      }
    } else {
      if (!selectedCustId) {
        await dialog.alert({ message: "يرجى اختيار عميل مسجل من القائمة", variant: "warning" });
        return;
      }
    }

    // Check item selection validity
    const invalidItem = saleItems.find(item => !item.productId);
    if (invalidItem) {
      await dialog.alert({ message: "الرجاء اختيار صنف صالح من قائمة المنتجات أولاً", variant: "warning" });
      return;
    }

    // Check stock quantities
    for (const item of saleItems) {
      const prod = products.find(p => p.id === item.productId);
      if (prod && prod.quantity < item.qty) {
        await dialog.alert({
          message: `عذراً، الكمية المطلوبة من الصنف "${item.name}" غير متوفرة بالكامل في المخزن حالياً (المتبقي: ${prod.quantity})`,
          variant: "error"
        });
        return;
      }
    }

    // Deduct quantities from products database
    for (const item of saleItems) {
      const prod = products.find(p => p.id === item.productId);
      if (prod) {
        updateProduct({
          ...prod,
          quantity: prod.quantity - item.qty
        });
      }
    }

    const subtotal = saleItems.reduce((sum, item) => sum + item.price * item.qty, 0);
    const finalAmount = subtotal - Number(saleDiscount);
    const initialPaid = isCod ? 0 : finalAmount;

    let custNameSnap = '';
    let custPhoneSnap = '';

    if (isGuest) {
      custNameSnap = guestName.trim();
      custPhoneSnap = guestPhone.trim();
    } else {
      const foundReg = customers.find(c => c.id === selectedCustId);
      custNameSnap = foundReg?.name || '';
      custPhoneSnap = foundReg?.phone || '';
    }

    const invoiceSaved = await addInvoice({
      customerId: isGuest ? undefined : selectedCustId,
      customerType: isGuest ? 'GUEST' : 'REGISTERED',
      guestCustomerName: isGuest ? guestName.trim() : undefined,
      guestCustomerPhone: isGuest ? guestPhone.trim() : undefined,
      guestCustomerNote: isGuest ? guestNote.trim() : undefined,
      customerNameSnapshot: custNameSnap,
      customerPhoneSnapshot: custPhoneSnap,
      orderStatus: isCod ? 'PENDING' : 'DELIVERED',
      items: saleItems.map(item => {
        const prod = products.find(p => p.id === item.productId);
        return {
          productId: item.productId,
          name: item.name,
          quantity: item.qty,
          price: item.price,
          costPrice: prod?.purchasePrice || 0,
          stockOwnership: prod?.stockOwnership || "SHARED"
        };
      }),
      totalAmount: subtotal,
      discount: Number(saleDiscount) || 0,
      paidAmount: initialPaid,
      paymentMethod: salePaymentMethod,
      type: "parts_sale",
      isPaid: !isCod && initialPaid >= subtotal
    }, currentLoggedUser);

    setIsSalesModalOpen(false);
    // Reset Form
    setSaleItems([{ productId: "", qty: 1, name: "", price: 0 }]);
    setSelectedCustId("");
    setGuestName("");
    setGuestPhone("");
    setGuestNote("");
    setCustomerType("GUEST");
    setSaleDiscount(0);

    // Show preview receipt instantly
    setReceiptInvoice(invoiceSaved);
    setIsReceiptOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Receipts Drawer Modal */}
      {isReceiptOpen && receiptInvoice && (
        <PrintReceiptModal
          isOpen={isReceiptOpen}
          onClose={() => setIsReceiptOpen(false)}
          invoice={receiptInvoice}
          customer={customers.find(c => c.id === receiptInvoice.customerId)}
          settings={settings}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <DollarSign className="text-indigo-400 w-6 h-6" />
            الحسابات والمبيعات والمصاريف
          </h2>
          <p className="text-gray-400 text-xs mt-1">تتبع التدفق المالي، الخزينة، إيرادات صيانة الأجهزة والمنتجات، وتسجيل القيود اليومية</p>
        </div>

        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={() => setIsSalesModalOpen(true)}
            className="flex-1 sm:flex-initial bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all-custom font-bold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            فاتورة بيع مباشر
          </button>
          <button
            onClick={() => setIsExpenseOpen(true)}
            className="flex-1 sm:flex-initial bg-red-600/10 hover:bg-red-600/20 text-red-400 text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 border border-red-500/20 transition-all-custom font-bold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            تسجيل قيد مصروف يدوياً
          </button>
        </div>
      </div>

      {/* Financial KPIs row (المحاسبة العامة: الخزنة، الإيرادات، تكلفة البضاعة، المصروفات، صافي الربح، المديونيات) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl">
          <span className="text-[11px] text-gray-400 block font-bold">1. الخزنة (رصيد الصندوق)</span>
          <h3 className="text-xl font-bold text-emerald-400 mt-1">{totalCashbox.toLocaleString()} ج.م</h3>
          <span className="text-[9px] text-gray-500 block mt-1 font-mono">الفواتير المحصلة - المصروفات</span>
        </div>

        <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl">
          <span className="text-[11px] text-gray-400 block font-bold">2. إجمالي الإيرادات</span>
          <h3 className="text-xl font-bold text-white mt-1">{totalInvoicesAmount.toLocaleString()} ج.م</h3>
          <span className="text-[9px] text-green-400 block mt-1 font-medium">{invoices.length} فاتورة مسجلة</span>
        </div>

        <div className="bg-[#11131e] border border-rose-500/30 p-4 rounded-xl">
          <span className="text-[11px] text-rose-300 block font-bold">3. تكلفة البضاعة (COGS)</span>
          <h3 className="text-xl font-bold text-rose-400 mt-1">{totalCogs.toLocaleString()} ج.م</h3>
          <span className="text-[9px] text-rose-300/80 block mt-1">قطع غيار ومستلزمات</span>
        </div>

        <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl">
          <span className="text-[11px] text-gray-400 block font-bold">4. المصروفات التشغيلية</span>
          <h3 className="text-xl font-bold text-red-400 mt-1">{totalExpensesAmount.toLocaleString()} ج.م</h3>
          <span className="text-[9px] text-gray-500 block mt-1 font-mono">رواتب، إيجار، كهرباء</span>
        </div>

        <div className="bg-[#11131e] border border-cyan-500/40 p-4 rounded-xl bg-cyan-950/10">
          <span className="text-[11px] text-cyan-300 block font-bold">5. صافي الربح العام</span>
          <h3 className="text-xl font-bold text-cyan-300 mt-1">{netProfit.toLocaleString()} ج.م</h3>
          <span className="text-[9px] text-cyan-200/80 block mt-1 font-bold">الإيراد - التكلفة - المصروفات</span>
        </div>

        <div className="bg-[#11131e] border border-amber-500/30 p-4 rounded-xl">
          <span className="text-[11px] text-amber-300 block font-bold">6. المديونيات والذمم</span>
          <h3 className="text-xl font-bold text-amber-400 mt-1">{totalCustomerDebts.toLocaleString()} ج.م</h3>
          <span className="text-[9px] text-amber-300/80 block mt-1">مستحقات لدى العملاء</span>
        </div>
      </div>

      {/* Navigation Sub-tab row */}
      <div className="border-b border-[#2a2d42] flex gap-6">
        <button
          onClick={() => setActiveTab("invoices")}
          className={`pb-3 text-sm font-bold transition-colors cursor-pointer relative ${
            activeTab === "invoices" ? "text-indigo-400" : "text-gray-400 hover:text-white"
          }`}
        >
          فواتير المبيعات والصيانة العامة
          {activeTab === "invoices" && <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-500"></span>}
        </button>
        <button
          onClick={() => setActiveTab("expenses")}
          className={`pb-3 text-sm font-bold transition-colors cursor-pointer relative ${
            activeTab === "expenses" ? "text-indigo-400" : "text-gray-400 hover:text-white"
          }`}
        >
          كشف المصروفات التشغيلية والخزنة
          {activeTab === "expenses" && <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-500"></span>}
        </button>
      </div>

      {/* --- Invoices Tab Content --- */}
      {activeTab === "invoices" && (
        <div className="bg-[#11131e] border border-[#2a2d42] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-[#2a2d42] text-gray-400 bg-gray-950/40">
                  <th className="py-3 px-4 font-medium">رقم الفاتورة</th>
                  <th className="py-3 px-4 font-medium">تاريخ الإصدار</th>
                  <th className="py-3 px-4 font-medium">العميل</th>
                  <th className="py-3 px-4 font-medium">نوع المعاملة</th>
                  <th className="py-3 px-4 font-medium">طريقة الدفع</th>
                  <th className="py-3 px-4 font-medium">الإجمالي الكلي</th>
                  <th className="py-3 px-4 font-medium text-center">الإجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2d42]/60">
                {invoices.map(inv => {
                  const customer = customers.find(c => c.id === inv.customerId);
                  return (
                    <tr
                      key={inv.id}
                      onClick={() => {
                        setReceiptInvoice(inv);
                        setIsReceiptOpen(true);
                      }}
                      className={`transition-all-custom cursor-pointer ${
                        inv.isCancelled
                          ? "bg-rose-950/20 opacity-60 hover:bg-rose-950/30 line-through"
                          : "hover:bg-white/5"
                      }`}
                    >
                      <td className="py-3.5 px-4 font-mono font-bold text-indigo-400">
                        {inv.id}
                        {inv.isCancelled && (
                          <span className="no-underline block text-[9px] text-rose-400 font-bold">
                            ملغاة: {inv.cancelReason}
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-gray-400">
                        {new Date(inv.date).toLocaleString("ar-EG")}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span>{getInvoiceCustomerName(inv, customers)}</span>
                          <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold border ${
                            getInvoiceCustomerBadge(inv).type === 'REGISTERED' 
                              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' 
                              : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                          }`}>
                            {getInvoiceCustomerBadge(inv).label}
                          </span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-300">
                        {inv.type === "repair" ? (
                          <span className="bg-blue-500/10 text-blue-400 px-2.5 py-0.5 rounded text-[10px]">
                            صيانة أجهزة
                          </span>
                        ) : (
                          <span className="bg-purple-500/10 text-purple-400 px-2.5 py-0.5 rounded text-[10px]">
                            بيع اكسسوارات ومستلزمات
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-gray-400 font-medium">
                        {inv.paymentMethod === "Cash" && "نقدي"}
                        {inv.paymentMethod === "InstaPay" && "انستا باي"}
                        {inv.paymentMethod === "Visa" && "فيزا كارد"}
                        {inv.paymentMethod === "Vodafone Cash" && "فودافون كاش"}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-green-400">
                        {inv.paidAmount} ج.م
                      </td>
                      <td className="py-3.5 px-4 text-center" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            onClick={() => {
                              setReceiptInvoice(inv);
                              setIsReceiptOpen(true);
                            }}
                            title="طباعة المعاينة"
                            className="p-1 text-indigo-400 hover:text-white bg-[#161927] border border-[#2a2d42] rounded-md transition-colors cursor-pointer"
                          >
                            <Printer className="w-3.5 h-3.5" />
                          </button>

                          {!inv.isCancelled && canDeleteSale(currentUserForAction) && (
                            <button
                              onClick={() => setSelectedInvoiceToDelete(inv)}
                              title="إلغاء وتصفية عملية البيع (أحمد البنا OWNER)"
                              className="p-1 text-rose-400 hover:text-white hover:bg-rose-600/30 bg-[#161927] border border-rose-500/30 rounded-md transition-colors cursor-pointer"
                            >
                              <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- Expenses Tab Content --- */}
      {activeTab === "expenses" && (
        <div className="bg-[#11131e] border border-[#2a2d42] rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-[#2a2d42] text-gray-400 bg-gray-950/40">
                  <th className="py-3 px-4 font-medium">كود القيد</th>
                  <th className="py-3 px-4 font-medium">التاريخ</th>
                  <th className="py-3 px-4 font-medium">بند المصروف</th>
                  <th className="py-3 px-4 font-medium">الوصف التفصيلي</th>
                  <th className="py-3 px-4 font-medium">المحاسب المسؤول</th>
                  <th className="py-3 px-4 font-medium">المبلغ الإجمالي</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2d42]/60">
                {expenses.map(exp => (
                  <tr key={exp.id} className="hover:bg-white/5 transition-all-custom">
                    <td className="py-3.5 px-4 font-mono text-gray-400">{exp.id}</td>
                    <td className="py-3.5 px-4 text-gray-500">
                      {new Date(exp.date).toLocaleString("ar-EG")}
                    </td>
                    <td className="py-3.5 px-4 font-bold text-white">{exp.category}</td>
                    <td className="py-3.5 px-4 text-gray-300">{exp.description}</td>
                    <td className="py-3.5 px-4 text-gray-400">{exp.createdBy}</td>
                    <td className="py-3.5 px-4 font-bold text-red-400">{exp.amount} ج.م</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Manual Expense Register Dialog */}
      {isExpenseOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#11131e] border border-[#2a2d42] rounded-xl w-full max-w-md shadow-2xl overflow-hidden text-right">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#2a2d42]">
              <h3 className="text-md font-bold text-white">تسجيل مصروفات تشغيلية جديدة</h3>
              <button onClick={() => setIsExpenseOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="p-6 space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">بند الصرف الأساسي *</label>
                <select
                  value={eCategory}
                  onChange={e => setECategory(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                >
                  <option value="إيجار وفواتير">إيجار المحل وفواتير</option>
                  <option value="رواتب وأجور">رواتب وأجور المهندسين</option>
                  <option value="كهرباء ومياه">فواتير طاقة (كهرباء ومياه)</option>
                  <option value="مستلزمات عامة">مستلزمات عامة وضيافة</option>
                  <option value="بضاعة وقطع غيار">بضاعة وقطع غيار مستوردة</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">المبلغ المدفوع (ج.م) *</label>
                <input
                  type="number"
                  required
                  placeholder="0.00"
                  value={eAmount || ""}
                  onChange={e => setEAmount(Number(e.target.value))}
                  className="w-full bg-gray-950 border border-red-500/20 rounded-lg px-3 py-2 text-xs text-red-400 focus:outline-none focus:border-red-500 font-bold"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">الوصف والبيان التفصيلي للمصروف *</label>
                <textarea
                  required
                  placeholder="اكتب أية تفاصيل توضح الغرض من الصرف..."
                  value={eDesc}
                  onChange={e => setEDesc(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 h-24 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2 px-4 rounded-lg text-xs font-bold transition-all-custom cursor-pointer"
                >
                  حفظ قيد الصرف
                </button>
                <button
                  type="button"
                  onClick={() => setIsExpenseOpen(false)}
                  className="flex-1 bg-[#2a2d42] hover:bg-[#343854] text-white py-2 px-4 rounded-lg text-xs transition-all-custom cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Direct Sales Invoice Creator Dialog */}
      {isSalesModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#11131e] border border-[#2a2d42] rounded-xl w-full max-w-xl shadow-2xl overflow-hidden text-right flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#2a2d42]">
              <h3 className="text-md font-bold text-white flex items-center gap-2">
                <ShoppingBag className="w-5 h-5 text-indigo-400" />
                إنشاء فاتورة بيع مباشر (اكسسوارات / قطع غيار)
              </h3>
              <button onClick={() => setIsSalesModalOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDirectSaleInvoice} className="p-6 space-y-4 overflow-y-auto flex-1">
              {/* Customer Selection Block */}
              <div className="bg-gray-950/80 p-4 rounded-xl border border-[#2a2d42] space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-300">نوع العميل:</label>
                  <div className="flex items-center gap-4 text-xs font-bold">
                    <label className="flex items-center gap-1.5 cursor-pointer text-indigo-300">
                      <input
                        type="radio"
                        name="custType"
                        value="GUEST"
                        checked={customerType === 'GUEST'}
                        onChange={() => setCustomerType('GUEST')}
                        className="accent-indigo-500"
                      />
                      عميل زائر (افتراضي)
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer text-gray-300">
                      <input
                        type="radio"
                        name="custType"
                        value="REGISTERED"
                        checked={customerType === 'REGISTERED'}
                        onChange={() => setCustomerType('REGISTERED')}
                        className="accent-indigo-500"
                      />
                      اختيار عميل مسجل
                    </label>
                  </div>
                </div>

                {customerType === 'GUEST' ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="text-[11px] text-gray-400 block mb-1">اسم العميل الزائر *</label>
                      <input
                        type="text"
                        required
                        placeholder="اسم العميل الزائر..."
                        value={guestName}
                        onChange={e => setGuestName(e.target.value)}
                        className="w-full bg-gray-900 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] text-gray-400 block mb-1">
                        رقم الهاتف {salePaymentMethod === 'CASH_ON_DELIVERY' || salePaymentMethod === PaymentMethod.CashOnDelivery ? '*' : '(اختياري)'}
                      </label>
                      <input
                        type="text"
                        placeholder="01xxxxxxxxx"
                        value={guestPhone}
                        onChange={e => setGuestPhone(e.target.value)}
                        className="w-full bg-gray-900 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                      />
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-[11px] text-gray-400 block mb-1">اختر عميلاً من القائمة *</label>
                    <select
                      value={selectedCustId}
                      onChange={e => setSelectedCustId(e.target.value)}
                      className="w-full bg-gray-900 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                    >
                      <option value="">-- اختر عميلاً مسجلاً --</option>
                      {customers.map(cust => (
                        <option key={cust.id} value={cust.id}>
                          {cust.name} ({formatPhoneDisplay(cust.phone)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Items grid loop */}
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-indigo-400">المنتجات المطلوبة في الفاتورة</span>
                  <button
                    type="button"
                    onClick={handleAddSaleItemRow}
                    className="text-[10px] text-indigo-300 hover:underline cursor-pointer"
                  >
                    + إضافة صنف إضافي
                  </button>
                </div>

                {saleItems.map((item, idx) => (
                  <div key={idx} className="bg-gray-950/60 p-3 rounded-lg border border-[#2a2d42] flex gap-3 items-center relative">
                    <div className="flex-1">
                      <select
                        value={item.productId}
                        onChange={e => handleSaleItemChange(idx, e.target.value)}
                        className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                      >
                        <option value="">-- اختر صنفاً من المخزون --</option>
                        {products.filter(p => !p.isArchived).map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} ({p.sellPrice} ج.م - متبقي {p.quantity})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="w-16">
                      <input
                        type="number"
                        min="1"
                        value={item.qty || ""}
                        onChange={e => handleSaleItemQtyChange(idx, Number(e.target.value))}
                        className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold text-center"
                        title="الكمية"
                      />
                    </div>

                    {saleItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveSaleItemRow(idx)}
                        className="text-red-400 hover:text-red-300 transition-colors p-1"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {/* Payment details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">طريقة الدفع المعتمدة</label>
                  <select
                    value={salePaymentMethod}
                    onChange={e => setSalePaymentMethod(e.target.value as PaymentMethod)}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                  >
                    <option value={PaymentMethod.Cash}>نقدي (كاش)</option>
                    <option value={PaymentMethod.CashOnDelivery}>الدفع عند الاستلام (COD)</option>
                    <option value={PaymentMethod.InstaPay}>انستا باي (InstaPay)</option>
                    <option value={PaymentMethod.Visa}>فيزا / كارت ائتمان</option>
                    <option value={PaymentMethod.VodafoneCash}>فودافون كاش</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">قيمة الخصم المالي المباشر (ج.م)</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    value={saleDiscount || ""}
                    onChange={e => setSaleDiscount(Number(e.target.value))}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-4 border-t border-[#2a2d42]">
                <button
                  type="submit"
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 px-4 rounded-lg text-xs font-bold transition-all-custom cursor-pointer"
                >
                  إصدار الفاتورة فورياً وعرض الطباعة
                </button>
                <button
                  type="button"
                  onClick={() => setIsSalesModalOpen(false)}
                  className="flex-1 bg-[#2a2d42] hover:bg-[#343854] text-white py-2.5 px-4 rounded-lg text-xs transition-all-custom cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete / Cancel Sale Modal (OWNER ONLY) */}
      {selectedInvoiceToDelete && (
        <DeleteSaleModal
          isOpen={!!selectedInvoiceToDelete}
          onClose={() => setSelectedInvoiceToDelete(null)}
          invoice={selectedInvoiceToDelete}
          currentUser={currentUserForAction}
          onConfirmCancelSale={(reason) => {
            const res = db.cancelInvoice({
              invoiceId: selectedInvoiceToDelete.id,
              reason,
              currentUser: currentUserForAction
            });
            if (res.success) {
              setSelectedInvoiceToDelete(null);
            }
            return res;
          }}
        />
      )}
    </div>
  );
}
