/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { 
  useRepairTemplates, 
  useCommonFaults, 
  useDeviceTypes, 
  useDeviceModels, 
  useProducts 
} from "../hooks/useData";
import { useDialog } from "../context/DialogContext";
import { RepairTemplateItem, CommonFault } from "../types";
import { 
  Plus, Edit, Trash2, Wrench, Package, CheckCircle, Save, X, AlertTriangle, ListOrdered, ShieldAlert, Tag
} from "lucide-react";

export default function RepairTemplatesTab() {
  const dialog = useDialog();
  const { repairTemplates, addRepairTemplateItem, updateRepairTemplateItem, deleteRepairTemplateItem } = useRepairTemplates();
  const { commonFaults, addCommonFault, updateCommonFault, deleteCommonFault } = useCommonFaults();
  const { deviceTypes } = useDeviceTypes();
  const { deviceModels } = useDeviceModels();
  const { products } = useProducts();

  // Active Sub-Tab Mode: "faults" (قوالب الأعطال) vs "procedures" (قوالب الإجراءات الفنية)
  const [templateMode, setTemplateMode] = useState<"faults" | "procedures">("faults");

  // Filter state
  const [selectedDeviceType, setSelectedDeviceType] = useState<string>("");
  const [selectedDeviceModel, setSelectedDeviceModel] = useState<string>("");

  // Form state for Procedure Templates
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemNameAr, setItemNameAr] = useState("");
  const [formDeviceType, setFormDeviceType] = useState("");
  const [formDeviceModel, setFormDeviceModel] = useState("");
  const [linkedProductId, setLinkedProductId] = useState("");
  const [costPrice, setCostPrice] = useState<number>(0);
  const [repairPrice, setRepairPrice] = useState<number>(0);
  const [sortOrder, setSortOrder] = useState<number>(1);

  // Notification state
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const showNotification = (msg: string, isError = false) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Helper to match device type against selected filter
  const isTypeMatch = (typeId: string | undefined, filter: string) => {
    if (!filter) return true;
    if (!typeId) return false;
    if (typeId === filter) return true;
    
    const dtObj = deviceTypes.find(d => d.id === filter || d.nameAr === filter);
    if (dtObj) {
      if (typeId === dtObj.id || typeId === dtObj.nameAr || typeId === dtObj.nameEn) return true;
    }
    return typeId.toLowerCase().includes(filter.toLowerCase()) || filter.toLowerCase().includes(typeId.toLowerCase());
  };

  // Helper to match device model against selected filter
  const isModelMatch = (modelId: string | undefined, filter: string) => {
    if (!filter) return true;
    if (!modelId) return true; // Category-wide templates match any model filter in that category
    return modelId === filter;
  };

  // Filtered Fault Templates (قوالب الأعطال والشكاوى)
  const filteredFaults = commonFaults.filter(item => {
    return isTypeMatch(item.deviceTypeId, selectedDeviceType) &&
           isModelMatch(item.deviceModelId, selectedDeviceModel);
  }).sort((a, b) => (a.sortOrder || 1) - (b.sortOrder || 1));

  // Filtered Procedure Templates (قوالب الإجراءات الفنية)
  const filteredProcedures = repairTemplates.filter(item => {
    return isTypeMatch(item.deviceTypeId || item.categoryId, selectedDeviceType) &&
           isModelMatch(item.deviceModelId || item.modelId, selectedDeviceModel);
  }).sort((a, b) => a.sortOrder - b.sortOrder);

  // Auto-fill prices when linking a product
  const handleProductSelect = (productId: string) => {
    setLinkedProductId(productId);
    if (productId) {
      const prod = products.find(p => p.id === productId);
      if (prod) {
        setCostPrice(prod.purchasePrice || 0);
        setRepairPrice(prod.sellPrice || 0);
        if (!itemNameAr) {
          setItemNameAr(prod.name);
        }
      }
    }
  };

  const handleEditProcedure = (item: RepairTemplateItem) => {
    setEditingItemId(item.id);
    setItemNameAr(item.nameAr);
    setFormDeviceType(item.deviceTypeId || item.categoryId || selectedDeviceType || "");
    setFormDeviceModel(item.deviceModelId || item.modelId || "");
    setLinkedProductId(item.productId || "");
    setCostPrice(item.defaultCostPrice || 0);
    setRepairPrice(item.defaultRepairPrice || 0);
    setSortOrder(item.sortOrder || 1);
  };

  const handleEditFault = (fault: CommonFault) => {
    setEditingItemId(fault.id);
    setItemNameAr(fault.nameAr);
    setFormDeviceType(fault.deviceTypeId || selectedDeviceType || "");
    setFormDeviceModel(fault.deviceModelId || "");
    setRepairPrice(fault.defaultRepairPrice || 0);
    setSortOrder(fault.sortOrder || 1);
  };

  const handleCancelEdit = () => {
    setEditingItemId(null);
    setItemNameAr("");
    setFormDeviceType("");
    setFormDeviceModel("");
    setLinkedProductId("");
    setCostPrice(0);
    setRepairPrice(0);
    setSortOrder(1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemNameAr.trim()) {
      dialog.alert({ message: "يرجى كتابة اسم العنصر بشكل صحيح", variant: "warning" });
      return;
    }

    const effectiveDeviceType = formDeviceType || selectedDeviceType || (deviceTypes.filter(d => !d.isArchived)[0]?.id || "");
    const effectiveModelId = formDeviceModel || undefined;

    try {
      if (templateMode === "faults") {
        // Fault Template CRUD
        if (editingItemId) {
          const existing = commonFaults.find(f => f.id === editingItemId);
          if (existing) {
            await updateCommonFault({
              ...existing,
              nameAr: itemNameAr,
              deviceTypeId: effectiveDeviceType,
              deviceModelId: effectiveModelId,
              defaultRepairPrice: Number(repairPrice) || 0,
              sortOrder: Number(sortOrder) || 1
            });
            showNotification("تم تحديث قالب العطل بنجاح");
          }
        } else {
          await addCommonFault({
            nameAr: itemNameAr,
            nameEn: "",
            deviceTypeId: effectiveDeviceType,
            deviceModelId: effectiveModelId,
            defaultRepairPrice: Number(repairPrice) || 0,
            sortOrder: Number(sortOrder) || (filteredFaults.length + 1),
            isActive: true
          });
          showNotification("تم إضافة قالب عطل وشكوى جديد بنجاح");
        }
      } else {
        // Procedure Template CRUD
        if (editingItemId) {
          const existing = repairTemplates.find(i => i.id === editingItemId);
          if (existing) {
            await updateRepairTemplateItem({
              ...existing,
              nameAr: itemNameAr,
              deviceTypeId: effectiveDeviceType,
              categoryId: effectiveDeviceType,
              deviceModelId: effectiveModelId,
              modelId: effectiveModelId,
              productId: linkedProductId || undefined,
              defaultCostPrice: Number(costPrice) || 0,
              defaultRepairPrice: Number(repairPrice) || 0,
              sortOrder: Number(sortOrder) || 1
            });
            showNotification("تم تحديث قالب الإجراء الفني بنجاح");
          }
        } else {
          await addRepairTemplateItem({
            nameAr: itemNameAr,
            deviceTypeId: effectiveDeviceType,
            categoryId: effectiveDeviceType,
            deviceModelId: effectiveModelId,
            modelId: effectiveModelId,
            productId: linkedProductId || undefined,
            defaultCostPrice: Number(costPrice) || 0,
            defaultRepairPrice: Number(repairPrice) || 0,
            sortOrder: Number(sortOrder) || (filteredProcedures.length + 1),
            isActive: true
          });
          showNotification("تم إضافة قالب إجراء فني وإصلاح جديد بنجاح");
        }
      }

      handleCancelEdit();
    } catch (err: any) {
      showNotification(err?.message || "حدث خطأ أثناء الحفظ", true);
    }
  };

  const handleDeleteFault = async (id: string, name: string) => {
    const confirmed = await dialog.confirm({
      title: "حذف قالب عطل",
      message: `هل أنت متأكد من حذف قالب العطل "${name}"؟`,
      variant: "danger",
      confirmText: "نعم، حذف"
    });

    if (confirmed) {
      deleteCommonFault(id);
      showNotification("تم حذف قالب العطل بنجاح");
    }
  };

  const handleDeleteProcedure = async (id: string, name: string) => {
    const confirmed = await dialog.confirm({
      title: "حذف إجراء فني",
      message: `هل أنت متأكد من حذف الإجراء الفني "${name}" من القالب؟`,
      variant: "danger",
      confirmText: "نعم، حذف"
    });

    if (confirmed) {
      deleteRepairTemplateItem(id);
      showNotification("تم حذف الإجراء الفني بنجاح");
    }
  };

  return (
    <div className="space-y-6 text-right">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-indigo-950/60 to-[#16192b] border border-indigo-500/20 p-5 rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Wrench className="w-5 h-5 text-indigo-400" />
            إدارة قوالب الأعطال والإجراءات الفنية
          </h3>
          <p className="text-gray-400 text-xs mt-1">
            خصص الأعطال الظاهرية وشكاوى العملاء، والإجراءات الفنية المعتمدة بشكل منفصل لكل قسم وموديل جهاز
          </p>
        </div>

        {/* Sub-Tabs Selector */}
        <div className="bg-[#11131e] p-1 rounded-xl border border-[#2a2d42] flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setTemplateMode("faults");
              handleCancelEdit();
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              templateMode === "faults"
                ? "bg-amber-600 text-white shadow-md shadow-amber-950/50"
                : "text-gray-400 hover:text-white hover:bg-gray-800/40"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            <span>1. قوالب الأعطال والشكاوى ({commonFaults.length})</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setTemplateMode("procedures");
              handleCancelEdit();
            }}
            className={`px-3.5 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              templateMode === "procedures"
                ? "bg-indigo-600 text-white shadow-md shadow-indigo-950/50"
                : "text-gray-400 hover:text-white hover:bg-gray-800/40"
            }`}
          >
            <Wrench className="w-3.5 h-3.5" />
            <span>2. قوالب الإجراءات الفنية ({repairTemplates.length})</span>
          </button>
        </div>
      </div>

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs py-3 px-4 rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Filter Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#11131e] p-4 rounded-2xl border border-[#2a2d42]">
        <div>
          <label className="block text-xs font-bold text-gray-300 mb-1.5">اختر قسم/نوع الجهاز (Category):</label>
          <select
            value={selectedDeviceType}
            onChange={(e) => {
              setSelectedDeviceType(e.target.value);
              setFormDeviceType(e.target.value);
              setSelectedDeviceModel("");
            }}
            className="w-full bg-[#181a29] border border-[#2a2d42] text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500 transition"
          >
            <option value="">جميع الأقسام</option>
            {deviceTypes.filter(dt => !dt.isArchived).map((dt) => (
              <option key={dt.id} value={dt.id}>{dt.nameAr} {dt.brand ? `(${dt.brand})` : ''}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-bold text-gray-300 mb-1.5">تصفية حسب الموديل (اختياري):</label>
          <select
            value={selectedDeviceModel}
            onChange={(e) => setSelectedDeviceModel(e.target.value)}
            className="w-full bg-[#181a29] border border-[#2a2d42] text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500 transition"
          >
            <option value="">جميع الموديلات</option>
            {deviceModels
              .filter(m => !m.isArchived && (!selectedDeviceType || m.deviceTypeId === selectedDeviceType || m.categoryId === selectedDeviceType))
              .map(m => (
                <option key={m.id} value={m.id}>{m.nameAr} {m.modelCode ? `(${m.modelCode})` : ''}</option>
              ))}
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Column */}
        <div className="lg:col-span-1 bg-[#11131e] p-5 rounded-2xl border border-[#2a2d42] space-y-4">
          <h4 className="text-sm font-bold text-indigo-300 flex items-center gap-2 border-b border-[#2a2d42] pb-3">
            <Plus className="w-4 h-4" />
            {editingItemId 
              ? (templateMode === "faults" ? "تعديل قالب العطل" : "تعديل الإجراء الفني") 
              : (templateMode === "faults" ? "إضافة قالب عطل جديد" : "إضافة إجراء فني جديد")}
          </h4>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">
                {templateMode === "faults" ? "اسم العطل أو شكوى العميل:" : "اسم الإجراء الفني / عملية الإصلاح:"}
              </label>
              <input
                type="text"
                required
                placeholder={templateMode === "faults" ? "مثال: لا توجد صورة، حرارة عالية، لا يشحن..." : "مثال: تغيير HDMI IC، تغيير أنالوج، تنظيف ومعجون..."}
                value={itemNameAr}
                onChange={(e) => setItemNameAr(e.target.value)}
                className="w-full bg-[#181a29] border border-[#2a2d42] text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">قسم/نوع الجهاز المستهدف:</label>
              <select
                value={formDeviceType || selectedDeviceType}
                onChange={(e) => {
                  setFormDeviceType(e.target.value);
                  setFormDeviceModel("");
                }}
                className="w-full bg-[#181a29] border border-[#2a2d42] text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500 transition"
              >
                <option value="">اختر القسم</option>
                {deviceTypes.filter(dt => !dt.isArchived).map((dt) => (
                  <option key={dt.id} value={dt.id}>{dt.nameAr} {dt.brand ? `(${dt.brand})` : ''}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">تحديد موديل خاص (اختياري):</label>
              <select
                value={formDeviceModel}
                onChange={(e) => setFormDeviceModel(e.target.value)}
                className="w-full bg-[#181a29] border border-[#2a2d42] text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500 transition"
              >
                <option value="">عام (جميع موديلات هذا القسم)</option>
                {deviceModels
                  .filter(m => !m.isArchived && (!(formDeviceType || selectedDeviceType) || m.deviceTypeId === (formDeviceType || selectedDeviceType) || m.categoryId === (formDeviceType || selectedDeviceType)))
                  .map((m) => (
                    <option key={m.id} value={m.id}>{m.nameAr} {m.modelCode ? `(${m.modelCode})` : ''}</option>
                  ))}
              </select>
            </div>

            {templateMode === "procedures" && (
              <div>
                <label className="block text-xs font-bold text-gray-300 mb-1">ربط بقطعة من المخزون (اختياري):</label>
                <select
                  value={linkedProductId}
                  onChange={(e) => handleProductSelect(e.target.value)}
                  className="w-full bg-[#181a29] border border-[#2a2d42] text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500 transition"
                >
                  <option value="">بدون ربط بمخزون (إجراء خدمي فقط)</option>
                  {products.filter(p => !p.isArchived).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (المتاح: {p.quantity} | تكلفة: {p.purchasePrice} ج.م)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              {templateMode === "procedures" && (
                <div>
                  <label className="block text-xs font-bold text-gray-300 mb-1">التكلفة المتوقعة (ج.م):</label>
                  <input
                    type="number"
                    min="0"
                    value={costPrice}
                    onChange={(e) => setCostPrice(Number(e.target.value))}
                    className="w-full bg-[#181a29] border border-[#2a2d42] text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500 transition"
                  />
                </div>
              )}

              <div className={templateMode === "faults" ? "col-span-2" : ""}>
                <label className="block text-xs font-bold text-gray-300 mb-1">
                  {templateMode === "faults" ? "السعر الاسترشادي المباشر (ج.م):" : "السعر المقترح للعميل (ج.م):"}
                </label>
                <input
                  type="number"
                  min="0"
                  value={repairPrice}
                  onChange={(e) => setRepairPrice(Number(e.target.value))}
                  className="w-full bg-[#181a29] border border-[#2a2d42] text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-gray-300 mb-1">ترتيب العرض:</label>
              <input
                type="number"
                min="1"
                value={sortOrder}
                onChange={(e) => setSortOrder(Number(e.target.value))}
                className="w-full bg-[#181a29] border border-[#2a2d42] text-white rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="submit"
                className={`flex-1 text-white font-bold py-2.5 px-4 rounded-xl text-xs flex items-center justify-center gap-2 transition cursor-pointer ${
                  templateMode === "faults" ? "bg-amber-600 hover:bg-amber-500" : "bg-indigo-600 hover:bg-indigo-500"
                }`}
              >
                <Save className="w-4 h-4" />
                <span>{editingItemId ? "حفظ التعديلات" : (templateMode === "faults" ? "حفظ عطل جديد" : "حفظ إجراء جديد")}</span>
              </button>

              {editingItemId && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  className="bg-gray-700 hover:bg-gray-600 text-white font-bold py-2.5 px-3 rounded-xl text-xs flex items-center justify-center gap-1 transition cursor-pointer"
                >
                  <X className="w-4 h-4" />
                  <span>إلغاء</span>
                </button>
              )}
            </div>
          </form>
        </div>

        {/* List Column */}
        <div className="lg:col-span-2 bg-[#11131e] p-5 rounded-2xl border border-[#2a2d42] space-y-4">
          <div className="flex justify-between items-center border-b border-[#2a2d42] pb-3">
            <h4 className="text-sm font-bold text-white flex items-center gap-2">
              <ListOrdered className="w-4 h-4 text-indigo-400" />
              {templateMode === "faults" 
                ? `قوالب الأعطال المعتمدة لقسم (${selectedDeviceType}) - [${filteredFaults.length}]`
                : `قوالب الإجراءات الفنية لقسم (${selectedDeviceType}) - [${filteredProcedures.length}]`}
            </h4>
          </div>

          {templateMode === "faults" ? (
            /* Fault Templates List */
            filteredFaults.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-[#2a2d42] rounded-2xl bg-[#141624]">
                <AlertTriangle className="w-10 h-10 text-amber-500/50 mx-auto mb-2" />
                <p className="text-xs font-bold text-gray-400">لا توجد قوالب أعطال مسجلة لـ {selectedDeviceType}</p>
                <p className="text-[11px] text-gray-500 mt-1">أضف أعطال وشكاوى مثل: لا تعمل، لا توجد صورة، حرارة عالية، انجراف أنالوج...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredFaults.map((fault) => (
                  <div
                    key={fault.id}
                    className="p-3.5 bg-[#16192a] border border-[#2a2d42] hover:border-amber-500/50 rounded-xl flex justify-between items-start transition group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="w-5 h-5 bg-amber-500/20 text-amber-400 rounded-md text-[10px] font-bold flex items-center justify-center">
                          #{fault.sortOrder || 1}
                        </span>
                        <h5 className="text-sm font-bold text-white">{fault.nameAr}</h5>
                      </div>

                      <p className="text-[11px] text-amber-300/80 flex items-center gap-1">
                        <Tag className="w-3 h-3 text-amber-400" />
                        <span>عطل / شكوى عميل</span>
                      </p>

                      <div className="flex items-center gap-3 text-xs pt-1">
                        <span className="text-emerald-400 font-bold">
                          السعر الاسترشادي: {fault.defaultRepairPrice || 0} ج.م
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition">
                      <button
                        onClick={() => handleEditFault(fault)}
                        className="p-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 rounded-lg transition cursor-pointer"
                        title="تعديل"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteFault(fault.id, fault.nameAr)}
                        className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition cursor-pointer"
                        title="حذف"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            /* Procedure Templates List */
            filteredProcedures.length === 0 ? (
              <div className="text-center py-12 border border-dashed border-[#2a2d42] rounded-2xl bg-[#141624]">
                <Wrench className="w-10 h-10 text-indigo-500/50 mx-auto mb-2" />
                <p className="text-xs font-bold text-gray-400">لا توجد قوالب إجراءات فنية مسجلة لـ {selectedDeviceType}</p>
                <p className="text-[11px] text-gray-500 mt-1">أضف إجراءات وإصلاحات مثل: تغيير HDMI، تغيير أنالوج، تنظيف ومعجون...</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredProcedures.map((item) => {
                  const linkedProduct = item.productId ? products.find(p => p.id === item.productId) : null;
                  return (
                    <div
                      key={item.id}
                      className="p-3.5 bg-[#16192a] border border-[#2a2d42] hover:border-indigo-500/50 rounded-xl flex justify-between items-start transition group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 bg-indigo-500/20 text-indigo-400 rounded-md text-[10px] font-bold flex items-center justify-center">
                            #{item.sortOrder}
                          </span>
                          <h5 className="text-sm font-bold text-white">{item.nameAr}</h5>
                        </div>

                        {linkedProduct ? (
                          <p className="text-[11px] text-indigo-300 flex items-center gap-1">
                            <Package className="w-3 h-3 text-indigo-400" />
                            <span>مرتبط بمخزون: {linkedProduct.name} (متاح: {linkedProduct.quantity})</span>
                          </p>
                        ) : (
                          <p className="text-[11px] text-gray-500">إجراء إصلاح فني خدمي</p>
                        )}

                        <div className="flex items-center gap-3 text-xs pt-1">
                          <span className="text-emerald-400 font-bold">
                            السعر: {item.defaultRepairPrice} ج.م
                          </span>
                          <span className="text-gray-400 text-[11px]">
                            التكلفة: {item.defaultCostPrice} ج.م
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-90 group-hover:opacity-100 transition">
                        <button
                          onClick={() => handleEditProcedure(item)}
                          className="p-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 rounded-lg transition cursor-pointer"
                          title="تعديل"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteProcedure(item.id, item.nameAr)}
                          className="p-1.5 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-lg transition cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
