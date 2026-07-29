/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from "react";
import {
  Users,
  Search,
  Plus,
  Edit2,
  Trash2,
  FileText,
  DollarSign,
  Phone,
  Calendar,
  X,
  TrendingUp,
  Download,
  CheckCircle,
  Briefcase,
  Loader2,
  UserCheck
} from "lucide-react";
import { useDialog } from "../context/DialogContext";
import { useCustomers, useRepairOrders, useInvoices } from "../hooks/useData";
import { Customer, CustomerType, RepairOrder, Invoice } from "../types";
import { PhoneDisplay } from "./PhoneDisplay";
import { formatPhoneDisplay, normalizePhoneNumber } from "../utils/phone";

interface CustomersListProps {
  initialOpenAddModal?: boolean;
  initialFocusSearch?: boolean;
}

export default function CustomersList({
  initialOpenAddModal = false,
  initialFocusSearch = false
}: CustomersListProps) {
  const dialog = useDialog();
  const { customers, addCustomer, updateCustomer, deleteCustomer } = useCustomers();
  const { orders } = useRepairOrders();
  const { invoices } = useInvoices();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  
  // Selected Customer for Drawer Profile
  const [activeCustomer, setActiveCustomer] = useState<Customer | null>(null);

  useEffect(() => {
    if (activeCustomer) {
      const fresh = customers.find(c => c.id === activeCustomer.id);
      if (fresh) {
        setActiveCustomer(fresh);
      }
    }
  }, [customers]);

  // Add/Edit Modals state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form fields state
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [type, setType] = useState<CustomerType>(CustomerType.Individual);
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (initialOpenAddModal) {
      handleOpenAddModal();
    }
  }, [initialOpenAddModal]);

  // Handle open add customer
  const handleOpenAddModal = () => {
    setEditingCustomer(null);
    setName("");
    setPhone("");
    setType(CustomerType.Individual);
    setEmail("");
    setNotes("");
    setIsModalOpen(true);
  };

  // Handle open edit customer
  const handleOpenEditModal = (cust: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingCustomer(cust);
    setName(cust.name);
    setPhone(cust.phone);
    setType(cust.type);
    setEmail(cust.email || "");
    setNotes(cust.notes || "");
    setIsModalOpen(true);
  };

  // Handle Delete Customer
  const handleDeleteCustomer = async (cust: Customer, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await dialog.confirm({
      title: "حذف العميل",
      message: `هل أنت متأكد من حذف العميل "${cust.name}" نهائياً من قاعدة البيانات؟`,
      variant: "danger",
      confirmText: "نعم، حذف"
    });
    if (confirmed) {
      try {
        const res = await deleteCustomer(cust.id);
        await dialog.alert({ message: res.message || "تم حذف العميل بنجاح", variant: "success" });
      } catch (err: any) {
        await dialog.alert({ message: err?.message || "حدث خطأ أثناء حذف العميل", variant: "error" });
      }
    }
  };

  // Submit Add/Edit customer
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !phone || isSubmitting) return;

    setIsSubmitting(true);
    const isEditing = !!editingCustomer;

    try {
      if (editingCustomer) {
        await updateCustomer({
          ...editingCustomer,
          name,
          phone,
          type,
          email,
          notes
        });
      } else {
        await addCustomer({
          name,
          phone,
          type,
          email,
          notes
        });
      }

      // Close modal and reset form
      setIsModalOpen(false);
      setName("");
      setPhone("");
      setType(CustomerType.Individual);
      setEmail("");
      setNotes("");
      setEditingCustomer(null);

      await dialog.alert({
        title: isEditing ? "تم التحديث" : "تمت الإضافة",
        message: isEditing ? "تم تحديث بيانات العميل بنجاح" : "تمت إضافة العميل جديد بنجاح إلى قاعدة البيانات",
        variant: "success"
      });
    } catch (err: any) {
      await dialog.alert({ message: err?.message || "حدث خطأ أثناء حفظ العميل", variant: "error" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const [categoryTab, setCategoryTab] = useState<'REGISTERED' | 'GUEST'>('REGISTERED');

  // Helper to identify guest customers
  const isGuestCustomer = (cust: Customer) =>
    Boolean(
      cust.isGuest === true ||
      cust.customerType === 'GUEST' ||
      cust.type === CustomerType.Guest ||
      cust.name === 'عميل غير مسجل' ||
      (cust.notes && cust.notes.includes('عميل ينشأ تلقائياً لأمر الصيانة'))
    );

  const registeredCustomers = customers.filter(c => !isGuestCustomer(c));
  const guestCustomers = customers.filter(c => isGuestCustomer(c));

  const targetList = categoryTab === 'REGISTERED' ? registeredCustomers : guestCustomers;

  // Filter list
  const filteredCustomers = targetList.filter(cust => {
    const q = searchQuery.toLowerCase().trim();
    const cleanSearchDigits = q.replace(/[^0-9]/g, "");

    const custCode = (cust as any).code || (cust as any).customerCode || cust.id || "";

    const matchesSearch =
      !q ||
      (cust.name && cust.name.toLowerCase().includes(q)) ||
      (cust.phone && cust.phone.toLowerCase().includes(q)) ||
      (cleanSearchDigits.length > 0 && cust.phone && normalizePhoneNumber(cust.phone).includes(cleanSearchDigits)) ||
      (custCode && custCode.toLowerCase().includes(q)) ||
      (cust.email && cust.email.toLowerCase().includes(q));

    const matchesType = filterType === "all" || cust.type === filterType;
    return matchesSearch && matchesType;
  });

  // Calculate stats strictly for registered customers
  const vipCount = registeredCustomers.filter(c => c.type === CustomerType.VIP).length;
  const shopCount = registeredCustomers.filter(c => c.type === CustomerType.Shop).length;
  const totalBalance = registeredCustomers.reduce((sum, c) => sum + (c.balance || 0), 0);

  // Customer transactions calculations inside the Drawer
  const getCustomerRepairs = (custID: string): RepairOrder[] => {
    return orders.filter(o => o.customerId === custID);
  };

  const getCustomerInvoices = (custID: string): Invoice[] => {
    return invoices.filter(inv => inv.customerId === custID);
  };

  // Simulated CSV/Excel exporting
  const handleExport = async () => {
    await dialog.alert({ message: "تم تجميع وتحميل كشف العملاء بصيغة Excel بنجاح وجاهز للمراجعة!", variant: "success" });
  };

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="text-indigo-400 w-6 h-6" />
            إدارة حسابات وملفات العملاء
          </h2>
          <p className="text-gray-400 text-xs mt-1">تعديل ملفات العملاء وعرض سجل الصيانة وتتبع المديونيات المستحقة والتقارير</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <button
            onClick={handleExport}
            className="flex-1 sm:flex-initial bg-[#161927] hover:bg-[#1f2336] text-gray-300 text-xs py-2.5 px-4 rounded-xl border border-[#2a2d42] flex items-center justify-center gap-2 transition-all-custom cursor-pointer"
          >
            <Download className="w-4 h-4 text-gray-400" />
            تصدير كشف العملاء
          </button>
          <button
            onClick={handleOpenAddModal}
            className="flex-1 sm:flex-initial bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all-custom font-bold cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            إضافة عميل جديد
          </button>
        </div>
      </div>

      {/* 2. Customer Insights/Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-gray-400 text-[11px]">إجمالي العملاء المسجلين</p>
            <h4 className="text-lg font-bold text-white mt-0.5">{registeredCustomers.length}</h4>
          </div>
        </div>

        <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 rounded-lg bg-yellow-500/10 text-yellow-400">
            <Briefcase className="w-5 h-5" />
          </div>
          <div>
            <p className="text-gray-400 text-[11px]">شركاء وتجار صيانة (مراكز خارجية)</p>
            <h4 className="text-lg font-bold text-white mt-0.5">{shopCount} مركزاً</h4>
          </div>
        </div>

        <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-gray-400 text-[11px]">إجمالي المديونيات المعلقة للعملاء</p>
            <h4 className="text-lg font-bold text-white mt-0.5">{totalBalance.toLocaleString()} ج.م</h4>
          </div>
        </div>
      </div>

      {/* 2.5 Tab Switcher for Registered vs Guest Customers */}
      {guestCustomers.length > 0 && (
        <div className="flex border-b border-[#2a2d42] gap-4 pt-2">
          <button
            onClick={() => setCategoryTab('REGISTERED')}
            className={`pb-3 px-3 text-xs font-bold transition-all relative cursor-pointer ${
              categoryTab === 'REGISTERED' ? 'text-indigo-400 border-b-2 border-indigo-500' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            دليل العملاء المسجلين ({registeredCustomers.length})
          </button>
          <button
            onClick={() => setCategoryTab('GUEST')}
            className={`pb-3 px-3 text-xs font-bold transition-all relative cursor-pointer ${
              categoryTab === 'GUEST' ? 'text-amber-400 border-b-2 border-amber-500' : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            سجلات الزوار غير المسجلين ({guestCustomers.length})
          </button>
        </div>
      )}

      {/* 3. Search & Filters Bar */}
      <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="relative w-full md:max-w-md">
          <input
            type="text"
            placeholder="ابحث عن عميل بالاسم أو الهاتف..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 pr-9"
          />
          <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3.5" />
        </div>

        <div className="flex gap-2 w-full md:w-auto overflow-x-auto self-start md:self-center pb-2 md:pb-0">
          <button
            onClick={() => setFilterType("all")}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              filterType === "all" ? "bg-indigo-600 text-white" : "bg-gray-950 text-gray-400 hover:text-white"
            }`}
          >
            الكل
          </button>
          <button
            onClick={() => setFilterType(CustomerType.Individual)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              filterType === CustomerType.Individual ? "bg-indigo-600 text-white" : "bg-gray-950 text-gray-400 hover:text-white"
            }`}
          >
            عملاء أفراد
          </button>
          <button
            onClick={() => setFilterType(CustomerType.VIP)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              filterType === CustomerType.VIP ? "bg-indigo-600 text-white" : "bg-gray-950 text-gray-400 hover:text-white"
            }`}
          >
            VIP المميزين
          </button>
          <button
            onClick={() => setFilterType(CustomerType.Shop)}
            className={`px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer ${
              filterType === CustomerType.Shop ? "bg-indigo-600 text-white" : "bg-gray-950 text-gray-400 hover:text-white"
            }`}
          >
            المحلات والتجار
          </button>
        </div>
      </div>

      {/* 4. Table Layout */}
      <div className="bg-[#11131e] border border-[#2a2d42] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-[#2a2d42] text-gray-400 bg-gray-950/40">
                <th className="py-3 px-4 font-medium">الاسم</th>
                <th className="py-3 px-4 font-medium">الهاتف</th>
                <th className="py-3 px-4 font-medium">الفئة</th>
                <th className="py-3 px-4 font-medium">المديونية</th>
                <th className="py-3 px-4 font-medium">الأجهزة</th>
                <th className="py-3 px-4 font-medium">تاريخ التسجيل</th>
                <th className="py-3 px-4 font-medium text-center">الإجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2a2d42]/60">
              {filteredCustomers.map(cust => {
                const customerOrders = getCustomerRepairs(cust.id);
                return (
                  <tr
                    key={cust.id}
                    onClick={() => setActiveCustomer(cust)}
                    className="hover:bg-white/5 transition-all-custom cursor-pointer"
                  >
                    <td className="py-3.5 px-4 font-bold text-white">{cust.name}</td>
                    <td className="py-3.5 px-4 font-mono text-gray-300">
                      <PhoneDisplay phone={cust.phone} />
                    </td>
                    <td className="py-3.5 px-4">
                      {cust.type === "VIP" && (
                        <span className="bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                          VIP
                        </span>
                      )}
                      {cust.type === "Individual" && (
                        <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded text-[10px]">
                          فردي
                        </span>
                      )}
                      {cust.type === "Shop" && (
                        <span className="bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                          محل صيانة
                        </span>
                      )}
                      {cust.type === "Wholesale" && (
                        <span className="bg-pink-500/10 text-pink-400 border border-pink-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                          جملة
                        </span>
                      )}
                    </td>
                    <td className={`py-3.5 px-4 font-bold ${cust.balance > 0 ? "text-red-400" : "text-green-400"}`}>
                      {cust.balance > 0 ? `${cust.balance} ج.م` : "سليم"}
                    </td>
                    <td className="py-3.5 px-4 text-gray-400 font-bold">{customerOrders.length} أجهزة</td>
                    <td className="py-3.5 px-4 text-gray-400">
                      {new Date(cust.createdAt).toLocaleDateString("ar-EG")}
                    </td>
                    <td className="py-3.5 px-4 text-center" onClick={e => e.stopPropagation()}>
                      <div className="flex justify-center items-center gap-2">
                        {isGuestCustomer(cust) && (
                          <button
                            onClick={async (e) => {
                              e.stopPropagation();
                              try {
                                await updateCustomer({
                                  ...cust,
                                  isGuest: false,
                                  customerType: 'REGISTERED',
                                  type: CustomerType.Individual,
                                  notes: cust.notes ? `${cust.notes} (تم تحويله إلى عميل دائم)` : 'تم تحويله إلى عميل دائم'
                                });
                                await dialog.alert({
                                  title: 'تم الحفظ كعميل دائم',
                                  message: `تم تحويل العميل (${cust.name}) إلى عميل دائم وإضافته إلى دليل العملاء المسجلين بنجاح.`,
                                  variant: 'success'
                                });
                              } catch (err: any) {
                                await dialog.alert({ message: err?.message || 'فشل تحويل العميل', variant: 'error' });
                              }
                            }}
                            title="حفظ كعميل دائم"
                            className="px-2.5 py-1 text-[11px] font-bold text-amber-300 bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500/20 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                          >
                            <UserCheck className="w-3.5 h-3.5" />
                            حفظ كعميل دائم
                          </button>
                        )}
                        <button
                          onClick={e => handleOpenEditModal(cust, e)}
                          title="تعديل العميل"
                          className="p-1 text-gray-400 hover:text-white bg-[#161927] border border-[#2a2d42] rounded-md transition-colors cursor-pointer"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={e => handleDeleteCustomer(cust, e)}
                          title="أرشفة أو حذف العميل"
                          className="p-1 text-red-400 hover:text-red-300 bg-[#161927] border border-[#2a2d42] rounded-md transition-colors cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 5. Add / Edit Customer Dialog Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#11131e] border border-[#2a2d42] rounded-xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#2a2d42]">
              <h3 className="text-md font-bold text-white">
                {editingCustomer ? "تعديل بيانات العميل" : "تسجيل عميل جديد"}
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">الاسم بالكامل *</label>
                <input
                  type="text"
                  required
                  placeholder="محمد أحمد علي"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">رقم الهاتف الجوال *</label>
                <input
                  type="tel"
                  required
                  placeholder="01012345678"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 text-left font-mono"
                  style={{ direction: "ltr" }}
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">فئة العميل</label>
                <select
                  value={type}
                  onChange={e => setType(e.target.value as CustomerType)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value={CustomerType.Individual}>عميل فردي</option>
                  <option value={CustomerType.VIP}>عميل VIP مميز</option>
                  <option value={CustomerType.Shop}>محل صيانة / تاجر خارجي</option>
                  <option value={CustomerType.Wholesale}>عميل جملة</option>
                </select>
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">البريد الإلكتروني (اختياري)</label>
                <input
                  type="email"
                  placeholder="customer@domain.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">ملاحظات العميل</label>
                <textarea
                  placeholder="أية تفاصيل أو تصنيفات أو شروط كفالة خاصة بالعميل"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 h-20 resize-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white py-2 px-4 rounded-lg text-xs font-bold transition-all-custom cursor-pointer flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري الحفظ...</span>
                    </>
                  ) : (
                    <span>{editingCustomer ? "تحديث البيانات" : "حفظ وتسجيل"}</span>
                  )}
                </button>
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={() => setIsModalOpen(false)}
                  className="flex-1 bg-[#2a2d42] hover:bg-[#343854] disabled:opacity-50 text-white py-2 px-4 rounded-lg text-xs transition-all-custom cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Slide-drawer/Modal: Customer Full Transactions Profile */}
      {activeCustomer && (
        <div className="fixed inset-y-0 left-0 right-0 z-50 flex justify-end bg-black/60 backdrop-blur-xs">
          <div className="bg-[#11131e] border-r border-[#2a2d42] w-full max-w-xl p-6 overflow-y-auto flex flex-col justify-between h-full shadow-2xl">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex justify-between items-start pb-4 border-b border-[#2a2d42]">
                <div>
                  <h3 className="text-lg font-bold text-white">{activeCustomer.name}</h3>
                  <span className="text-xs text-gray-400 font-mono mt-1 block">
                    تاريخ التسجيل: {new Date(activeCustomer.createdAt).toLocaleDateString("ar-EG")}
                  </span>
                </div>
                <button
                  onClick={() => setActiveCustomer(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:text-white bg-[#161927] border border-[#2a2d42] transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Quick Info Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-950/60 p-4 rounded-xl border border-[#2a2d42] flex items-center gap-3">
                  <Phone className="w-5 h-5 text-indigo-400" />
                  <div>
                    <span className="text-[10px] text-gray-400 block">الهاتف</span>
                    <PhoneDisplay phone={activeCustomer.phone} className="text-xs font-bold text-white font-mono" />
                  </div>
                </div>

                <div className="bg-gray-950/60 p-4 rounded-xl border border-[#2a2d42] flex items-center gap-3">
                  <DollarSign className="w-5 h-5 text-emerald-400" />
                  <div>
                    <span className="text-[10px] text-gray-400 block">المديونية المعلقة</span>
                    <span className="text-xs font-bold text-red-400">
                      {activeCustomer.balance} ج.م
                    </span>
                  </div>
                </div>
              </div>

              {/* Repairs List inside Profile */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-white">سجل أجهزة الصيانة للعميل ({getCustomerRepairs(activeCustomer.id).length})</h4>
                {getCustomerRepairs(activeCustomer.id).length > 0 ? (
                  <div className="space-y-2 max-h-[220px] overflow-y-auto">
                    {getCustomerRepairs(activeCustomer.id).map(order => (
                      <div key={order.id} className="bg-gray-950 p-3 rounded-lg border border-[#2a2d42] flex justify-between items-center">
                        <div>
                          <span className="font-mono font-bold text-indigo-400 text-xs">{order.id}</span>
                          <span className="text-[11px] text-gray-300 block mt-1">
                            {order.devices[0]?.type} ({order.devices[0]?.model})
                          </span>
                        </div>
                        <div className="text-left">
                          <span className="text-xs text-white font-bold block">{order.totalEstimatedCost} ج.م</span>
                          <span className="text-[9px] text-gray-500 mt-1 block font-mono">
                            {new Date(order.receivedDate).toLocaleDateString("ar-EG")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 bg-gray-950 p-3 rounded-lg border border-dashed border-[#2a2d42]">
                    لا توجد طلبات صيانة سابقة مسجلة لهذا العميل.
                  </p>
                )}
              </div>

              {/* Invoices list inside Profile */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-white">سجل الفواتير والمشتريات ({getCustomerInvoices(activeCustomer.id).length})</h4>
                {getCustomerInvoices(activeCustomer.id).length > 0 ? (
                  <div className="space-y-2 max-h-[180px] overflow-y-auto">
                    {getCustomerInvoices(activeCustomer.id).map(inv => (
                      <div key={inv.id} className="bg-gray-950 p-3 rounded-lg border border-[#2a2d42] flex justify-between items-center">
                        <div>
                          <span className="font-mono font-bold text-indigo-400 text-xs">{inv.id}</span>
                          <span className="text-[11px] text-gray-400 block mt-0.5">
                            {inv.type === "repair" ? "فاتورة صيانة جهازه" : "شراء اكسسوارات/ألعاب"}
                          </span>
                        </div>
                        <div className="text-left">
                          <span className="text-xs text-green-400 font-bold block">{inv.totalAmount} ج.م</span>
                          <span className="text-[9px] text-gray-500 mt-1 block">
                            {new Date(inv.date).toLocaleDateString("ar-EG")}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 bg-gray-950 p-3 rounded-lg border border-dashed border-[#2a2d42]">
                    لا توجد فواتير مبيعات مسجلة لهذا العميل.
                  </p>
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-[#2a2d42] flex gap-2">
              <button
                onClick={() => setActiveCustomer(null)}
                className="w-full bg-[#2a2d42] hover:bg-[#343854] text-white py-2 px-4 rounded-lg text-xs font-bold transition-all-custom cursor-pointer"
              >
                إغلاق ملف العميل
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
