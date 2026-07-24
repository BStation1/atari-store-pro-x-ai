/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import {
  Layers,
  Search,
  Plus,
  AlertTriangle,
  Edit,
  Pencil,
  Trash2,
  FolderOpen,
  Briefcase,
  TrendingDown,
  Warehouse,
  Check,
  ChevronLeft,
  X,
  RefreshCw,
  FileText,
  Download,
  Copy,
  Eye,
  Archive,
  CheckSquare,
  Square
} from "lucide-react";
import { useDialog } from "../context/DialogContext";
import { 
  useProducts, 
  useSuppliers, 
  useCategories, 
  useDeviceTypes, 
  useDeviceModels 
} from "../hooks/useData";
import { Product, Supplier } from "../types";

export default function Inventory() {
  const dialog = useDialog();
  const { products, addProduct, updateProduct, deleteProduct } = useProducts();
  const { suppliers, addSupplier, updateSupplier, deleteSupplier } = useSuppliers();
  const { categories } = useCategories();
  const { deviceTypes } = useDeviceTypes();
  const { deviceModels } = useDeviceModels();

  // Tabs: Products vs Suppliers
  const [activeTab, setActiveTab] = useState<"products" | "suppliers">("products");

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<"active" | "archived" | "all">("active");

  // Selection state for bulk actions
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);

  // Modals state
  const [isProductModalOpen, setIsProductModalOpen] = useState(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState(false);
  const [viewingProduct, setViewingProduct] = useState<Product | null>(null);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form Fields State
  const [pName, setPName] = useState("");
  const [pNameAr, setPNameAr] = useState("");
  const [pCategory, setPCategory] = useState("");
  const [pBarcode, setPBarcode] = useState("");
  const [pSku, setPSku] = useState("");
  const [pBrand, setPBrand] = useState("");
  const [pPurchase, setPPurchase] = useState<number>(0);
  const [pSell, setPSell] = useState<number>(0);
  const [pTechCost, setPTechCost] = useState<number>(0);
  const [pWholesale, setPWholesale] = useState<number>(0);
  const [pMinSell, setPMinSell] = useState<number>(0);
  const [pQty, setPQty] = useState<number>(0);
  const [pMin, setPMin] = useState<number>(3);
  const [pLoc, setPLoc] = useState("");
  const [pUnit, setPUnit] = useState("قطعة");
  const [pNotes, setPNotes] = useState("");
  const [pIsActive, setPIsActive] = useState(true);
  const [pSupplier, setPSupplier] = useState("");
  const [pCompTypes, setPCompTypes] = useState<string[]>([]);
  const [pCompModels, setPCompModels] = useState<string[]>([]);

  // Validation Error state
  const [validationError, setValidationError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Add/Edit Supplier Modal state
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [sName, setSName] = useState("");
  const [sPhone, setSPhone] = useState("");
  const [sCompany, setSCompany] = useState("");
  const [sBalance, setSBalance] = useState<number>(0);

  // Filter products based on active filters
  const filteredProducts = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.nameAr && p.nameAr.includes(searchQuery)) ||
      p.barcode.includes(searchQuery) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCat = selectedCategory === "all" || p.category === selectedCategory;
    
    let matchesStatus = true;
    if (statusFilter === "active") {
      matchesStatus = !p.isArchived && p.isActive !== false;
    } else if (statusFilter === "archived") {
      matchesStatus = !!p.isArchived;
    }
    
    return matchesSearch && matchesCat && matchesStatus;
  });

  const handleOpenAddProduct = () => {
    setEditingProduct(null);
    setValidationError(null);
    setPName("");
    setPNameAr("");
    setPCategory(categories[0]?.name || "قطع غيار صيانة");
    setPBarcode("");
    setPSku("");
    setPBrand("");
    setPPurchase(0);
    setPSell(0);
    setPTechCost(0);
    setPWholesale(0);
    setPMinSell(0);
    setPQty(0);
    setPMin(3);
    setPLoc("");
    setPUnit("قطعة");
    setPNotes("");
    setPIsActive(true);
    setPSupplier(suppliers[0]?.name || "");
    setPCompTypes([]);
    setPCompModels([]);
    setIsProductModalOpen(true);
  };

  const handleOpenEditProduct = (prod: Product, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingProduct(prod);
    setValidationError(null);
    setPName(prod.name);
    setPNameAr(prod.nameAr || "");
    setPCategory(prod.category);
    setPBarcode(prod.barcode);
    setPSku(prod.sku);
    setPBrand(prod.brand || "");
    setPPurchase(prod.purchasePrice);
    setPSell(prod.sellPrice);
    setPTechCost(prod.technicianCost || 0);
    setPWholesale(prod.wholesalePrice || 0);
    setPMinSell(prod.minSellPrice || 0);
    setPQty(prod.quantity);
    setPMin(prod.minStock);
    setPLoc(prod.location || "");
    setPUnit(prod.unit || "قطعة");
    setPNotes(prod.notes || "");
    setPIsActive(prod.isActive !== false);
    setPSupplier(prod.supplier || "");
    setPCompTypes(prod.compatibleDeviceTypes || []);
    setPCompModels(prod.compatibleModels || []);
    setIsProductModalOpen(true);
  };

  const handleOpenViewProduct = (prod: Product) => {
    setViewingProduct(prod);
    setIsViewModalOpen(true);
  };

  const handleDuplicateProduct = (prod: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingProduct(null);
    setValidationError(null);
    setPName(`${prod.name} (نسخة)`);
    setPNameAr(prod.nameAr ? `${prod.nameAr} (نسخة)` : "");
    setPCategory(prod.category);
    setPBarcode(""); // Barcode must be unique
    setPSku(""); // SKU must be unique
    setPBrand(prod.brand || "");
    setPPurchase(prod.purchasePrice);
    setPSell(prod.sellPrice);
    setPTechCost(prod.technicianCost || 0);
    setPWholesale(prod.wholesalePrice || 0);
    setPMinSell(prod.minSellPrice || 0);
    setPQty(prod.quantity);
    setPMin(prod.minStock);
    setPLoc(prod.location || "");
    setPUnit(prod.unit || "قطعة");
    setPNotes(prod.notes || "");
    setPIsActive(prod.isActive !== false);
    setPSupplier(prod.supplier || "");
    setPCompTypes(prod.compatibleDeviceTypes || []);
    setPCompModels(prod.compatibleModels || []);
    setIsProductModalOpen(true);
    showNotification("تم نسخ بيانات الصنف. يرجى كتابة كود SKU وباركود جديدين للحفظ.");
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError(null);

    if (!pName || !pSku || !pBarcode) {
      setValidationError("يرجى ملء الحقول الإجبارية: اسم الصنف، كود SKU، والباركود.");
      return;
    }

    // Check unique Barcode & SKU
    const isBarcodeDup = products.some(p => p.barcode === pBarcode && (!editingProduct || p.id !== editingProduct.id));
    const isSkuDup = products.some(p => p.sku.toLowerCase() === pSku.toLowerCase() && (!editingProduct || p.id !== editingProduct.id));

    if (isBarcodeDup) {
      setValidationError("خطأ: هذا الباركود مسجل بالفعل لصنف آخر. يرجى إدخال باركود فريد.");
      return;
    }
    if (isSkuDup) {
      setValidationError("خطأ: كود SKU مسجل بالفعل لصنف آخر. يرجى استخدام كود فريد.");
      return;
    }

    const productPayload: Omit<Product, "id"> = {
      name: pName,
      nameAr: pNameAr,
      category: pCategory,
      barcode: pBarcode,
      sku: pSku,
      brand: pBrand,
      purchasePrice: Number(pPurchase),
      sellPrice: Number(pSell),
      technicianCost: Number(pTechCost),
      wholesalePrice: Number(pWholesale),
      minSellPrice: Number(pMinSell),
      quantity: Number(pQty),
      minStock: Number(pMin),
      location: pLoc,
      unit: pUnit,
      notes: pNotes,
      isActive: pIsActive,
      supplier: pSupplier,
      compatibleDeviceTypes: pCompTypes,
      compatibleModels: pCompModels,
      stockOwnership: "SHARED"
    };

    try {
      if (editingProduct) {
        await updateProduct({
          ...editingProduct,
          ...productPayload
        });
        showNotification("تم تحديث بيانات الصنف بنجاح في Supabase!");
      } else {
        await addProduct(productPayload);
        showNotification("تم إضافة الصنف الجديد بنجاح في Supabase!");
      }
      setIsProductModalOpen(false);
    } catch (err: any) {
      setValidationError(err?.message || "حدث خطأ أثناء حفظ المنتج في Supabase");
    }
  };

  const handleDeleteProductAction = async (prod: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await dialog.confirm({
      title: "حذف المنتج",
      message: `هل أنت متأكد من رغبتك في حذف المنتج: ${prod.name}؟`,
      variant: "danger",
      confirmText: "نعم، حذف"
    });
    if (confirmed) {
      try {
        const currentUser = { id: 'U-101', name: 'أحمد البنا', role: 'OWNER' };
        const res = await deleteProduct(prod.id, currentUser);
        if (res.success) {
          showNotification(res.message || "تم الحذف/الأرشفة بنجاح.");
        } else {
          setValidationError(res.error || "حدث خطأ أثناء الحذف");
        }
      } catch (err: any) {
        setValidationError(err?.message || "تعذر الاتصال بـ Supabase لإتمام الحذف");
      }
    }
  };

  const handleToggleArchiveProduct = async (prod: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    const willArchive = !prod.isArchived;
    try {
      await updateProduct({
        ...prod,
        isArchived: willArchive,
        isActive: !willArchive
      });
      showNotification(willArchive ? `تم نقل الصنف ${prod.name} للأرشيف بنجاح` : `تم استعادة الصنف ${prod.name} من الأرشيف`);
    } catch (err: any) {
      showNotification(err?.message || "حدث خطأ أثناء تعديل حالة الأرشفة");
    }
  };

  // Bulk Actions
  const handleToggleSelectProduct = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedProductIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleToggleSelectAll = () => {
    if (selectedProductIds.length === filteredProducts.length) {
      setSelectedProductIds([]);
    } else {
      setSelectedProductIds(filteredProducts.map(p => p.id));
    }
  };

  const handleBulkArchive = async () => {
    if (selectedProductIds.length === 0) return;
    const confirmed = await dialog.confirm({
      title: "أرشفة المنتجات المحددة",
      message: `هل أنت متأكد من نقل عدد (${selectedProductIds.length}) أصناف مخرجات للأرشيف؟`,
      variant: "warning",
      confirmText: "أرشفة المجموعات"
    });
    if (confirmed) {
      selectedProductIds.forEach(id => {
        const prod = products.find(p => p.id === id);
        if (prod) {
          updateProduct({
            ...prod,
            isArchived: true,
            isActive: false
          });
        }
      });
      showNotification(`تم أرشفة عدد (${selectedProductIds.length}) أصناف بنجاح`);
      setSelectedProductIds([]);
    }
  };

  const handleBulkExport = async () => {
    const listToExport = selectedProductIds.length > 0 
      ? products.filter(p => selectedProductIds.includes(p.id)) 
      : filteredProducts;

    if (listToExport.length === 0) {
      await dialog.alert({ message: "لا توجد أصناف لتصديرها.", variant: "warning" });
      return;
    }

    // Generate CSV Content
    const headers = [
      "ID", "الاسم الإنجليزي", "الاسم العربي", "التصنيف", "SKU", "الباركود", 
      "الماركة", "سعر الشراء", "سعر البيع", "سعر الفني", "سعر الجملة", 
      "الكمية الحالية", "الحد الأدنى", "الموقع", "المورد", "مؤرشف"
    ];

    const rows = listToExport.map(p => [
      p.id,
      p.name,
      p.nameAr || "",
      p.category,
      p.sku,
      p.barcode,
      p.brand || "",
      p.purchasePrice,
      p.sellPrice,
      p.technicianCost || 0,
      p.wholesalePrice || 0,
      p.quantity,
      p.minStock,
      p.location || "",
      p.supplier || "",
      p.isArchived ? "نعم" : "لا"
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map(row => row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    // Add UTF-8 BOM to display Arabic correctly in Excel
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Atari_Store_Products_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOpenAddSupplier = () => {
    setEditingSupplier(null);
    setSName("");
    setSPhone("");
    setSCompany("");
    setSBalance(0);
    setIsSupplierModalOpen(true);
  };

  const handleOpenEditSupplier = (sup: Supplier, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSupplier(sup);
    setSName(sup.name);
    setSPhone(sup.phone || "");
    setSCompany(sup.company || "");
    setSBalance(sup.balance || 0);
    setIsSupplierModalOpen(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sName || !sCompany) return;

    try {
      if (editingSupplier) {
        await updateSupplier({
          ...editingSupplier,
          name: sName,
          phone: sPhone,
          company: sCompany,
          balance: Number(sBalance) || 0
        });
        showNotification("تم تحديث بيانات المورد في Supabase بنجاح!");
      } else {
        await addSupplier({
          name: sName,
          phone: sPhone,
          company: sCompany,
          balance: Number(sBalance) || 0
        });
        showNotification("تم إضافة المورد الجديد بـ Supabase بنجاح!");
      }

      setIsSupplierModalOpen(false);
      setEditingSupplier(null);
      setSName("");
      setSPhone("");
      setSCompany("");
      setSBalance(0);
    } catch (err: any) {
      await dialog.alert({ message: err?.message || "حدث خطأ أثناء حفظ بيانات المورد", variant: "error" });
    }
  };

  const handleDeleteSupplier = async (sup: Supplier, e: React.MouseEvent) => {
    e.stopPropagation();
    const confirmed = await dialog.confirm({
      title: "حذف/أرشفة المورد",
      message: `هل أنت متأكد من حذف أو أرشفة المورد "${sup.name}"؟`,
      variant: "danger",
      confirmText: "نعم، حذف"
    });
    if (confirmed) {
      try {
        const res = await deleteSupplier(sup.id);
        await dialog.alert({ message: res.message, variant: "success" });
      } catch (err: any) {
        await dialog.alert({ message: err?.message || "حدث خطأ أثناء حذف المورد", variant: "error" });
      }
    }
  };

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Quick adjust stock
  const handleQuickAddStock = (prod: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    const addAmt = prompt("أدخل الكمية التي تريد إضافتها للمخزون لهذا المنتج:");
    if (addAmt) {
      const amtNum = Number(addAmt);
      if (!isNaN(amtNum) && amtNum > 0) {
        updateProduct({
          ...prod,
          quantity: prod.quantity + amtNum
        });
        showNotification(`تم زيادة مخزون المنتج (${prod.name}) بمقدار ${amtNum} قطع.`);
      }
    }
  };

  return (
    <div className="space-y-6 text-right">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-[#2a2d42] pb-4">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Warehouse className="text-indigo-400 w-6 h-6" />
            إدارة المخازن والمستودع والموردين
          </h2>
          <p className="text-gray-400 text-xs mt-1">تتبع كفاءة المخزون، الباركودات، وتنبيهات النقص، وتعديل تسعير المشتريات والمبيعات</p>
        </div>
        
        <div className="flex gap-2 w-full sm:w-auto">
          {activeTab === "products" ? (
            <button
              onClick={handleOpenAddProduct}
              className="flex-1 sm:flex-initial bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all-custom font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              إضافة صنف / قطعة غيار
            </button>
          ) : (
            <button
              onClick={handleOpenAddSupplier}
              className="flex-1 sm:flex-initial bg-indigo-600 hover:bg-indigo-700 text-white text-xs py-2.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all-custom font-bold cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              تسجيل مورد جديد
            </button>
          )}
        </div>
      </div>

      {/* Alert Banners */}
      {successMessage && (
        <div className="bg-green-500/10 border border-green-500/20 text-green-400 text-xs py-3 px-4 rounded-xl flex items-center gap-2">
          <Check className="w-4 h-4" />
          <span>{successMessage}</span>
        </div>
      )}
      {validationError && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs py-3 px-4 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          <span>{validationError}</span>
        </div>
      )}

      {/* Navigation Sub-tab row */}
      <div className="border-b border-[#2a2d42] flex gap-6">
        <button
          onClick={() => setActiveTab("products")}
          className={`pb-3 text-sm font-bold transition-colors cursor-pointer relative ${
            activeTab === "products" ? "text-indigo-400" : "text-gray-400 hover:text-white"
          }`}
        >
          أصناف المنتجات وقطع الغيار
          {activeTab === "products" && <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-500"></span>}
        </button>
        <button
          onClick={() => setActiveTab("suppliers")}
          className={`pb-3 text-sm font-bold transition-colors cursor-pointer relative ${
            activeTab === "suppliers" ? "text-indigo-400" : "text-gray-400 hover:text-white"
          }`}
        >
          سجل شركات التوريد المعتمدة
          {activeTab === "suppliers" && <span className="absolute bottom-0 right-0 left-0 h-0.5 bg-indigo-500"></span>}
        </button>
      </div>

      {/* --- Tab 1: Products List --- */}
      {activeTab === "products" && (
        <div className="space-y-6">
          {/* Stats indicators */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl flex items-center gap-4">
              <div className="p-3 rounded-lg bg-indigo-500/10 text-indigo-400">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <p className="text-gray-400 text-[11px]">إجمالي الأصناف المسجلة</p>
                <h4 className="text-lg font-bold text-white mt-0.5">{products.length} أصناف</h4>
              </div>
            </div>

            <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl flex items-center gap-4">
              <div className="p-3 rounded-lg bg-yellow-500/10 text-yellow-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-gray-400 text-[11px]">أصناف قاربت النقص (حد الحذر)</p>
                <h4 className="text-lg font-bold text-yellow-400 mt-0.5">
                  {products.filter(p => p.quantity <= p.minStock && p.quantity > 0).length} صنفاً
                </h4>
              </div>
            </div>

            <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl flex items-center gap-4">
              <div className="p-3 rounded-lg bg-red-500/10 text-red-400">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <p className="text-gray-400 text-[11px]">أصناف منتهية تماماً (صفر)</p>
                <h4 className="text-lg font-bold text-red-400 mt-0.5">
                  {products.filter(p => p.quantity === 0).length} صنفاً
                </h4>
              </div>
            </div>

            <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl flex items-center gap-4">
              <div className="p-3 rounded-lg bg-emerald-500/10 text-emerald-400">
                <TrendingDown className="w-5 h-5" />
              </div>
              <div>
                <p className="text-gray-400 text-[11px]">إجمالي القيمة التقديرية للمخزون</p>
                <h4 className="text-lg font-bold text-emerald-400 mt-0.5">
                  {products.reduce((acc, p) => acc + (p.purchasePrice * p.quantity), 0).toLocaleString()} ج.م
                </h4>
              </div>
            </div>
          </div>

          {/* Search, Status & Category Filters */}
          <div className="bg-[#11131e] border border-[#2a2d42] p-4 rounded-xl flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="relative w-full md:w-72">
              <input
                type="text"
                placeholder="ابحث بالاسم، SKU أو الباركود..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 pr-9"
              />
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-3.5" />
            </div>

            <div className="flex flex-wrap gap-2 w-full md:w-auto">
              {/* Category Filter */}
              <select
                value={selectedCategory}
                onChange={e => setSelectedCategory(e.target.value)}
                className="bg-gray-950 border border-[#2a2d42] rounded-xl px-3 py-2 text-xs text-gray-300 focus:outline-none focus:border-indigo-500"
              >
                <option value="all">كل التصنيفات</option>
                {categories.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>

              {/* Status Filter */}
              <div className="flex bg-gray-950 border border-[#2a2d42] rounded-xl p-0.5">
                <button
                  onClick={() => setStatusFilter("active")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    statusFilter === "active" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  النشط
                </button>
                <button
                  onClick={() => setStatusFilter("archived")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    statusFilter === "archived" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  المؤرشف
                </button>
                <button
                  onClick={() => setStatusFilter("all")}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                    statusFilter === "all" ? "bg-indigo-600 text-white" : "text-gray-400 hover:text-white"
                  }`}
                >
                  الكل
                </button>
              </div>

              {/* Bulk operations panel */}
              {selectedProductIds.length > 0 && (
                <button
                  onClick={handleBulkArchive}
                  className="bg-amber-600/20 border border-amber-500/30 text-amber-300 hover:bg-amber-600 hover:text-white px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <Archive className="w-3.5 h-3.5" />
                  أرشفة جماعية ({selectedProductIds.length})
                </button>
              )}

              <button
                onClick={handleBulkExport}
                className="bg-[#2a2d42] hover:bg-[#343854] text-gray-200 px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-indigo-400" />
                تصدير البيانات كـ CSV
              </button>
            </div>
          </div>

          {/* Table list of products */}
          <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl overflow-hidden shadow-xl">
            <table className="w-full text-right border-collapse">
              <thead>
                <tr className="bg-gray-950/60 text-gray-400 text-[11px] font-bold border-b border-[#2a2d42]">
                  <th className="p-4 w-12 text-center">
                    <button onClick={handleToggleSelectAll} className="text-gray-400 hover:text-white cursor-pointer">
                      {selectedProductIds.length === filteredProducts.length && filteredProducts.length > 0 ? (
                        <CheckSquare className="w-4 h-4 text-indigo-400" />
                      ) : (
                        <Square className="w-4 h-4" />
                      )}
                    </button>
                  </th>
                  <th className="p-4">اسم المنتج / الصنف</th>
                  <th className="p-4">SKU / الباركود</th>
                  <th className="p-4">التصنيف</th>
                  <th className="p-4">سعر الشراء</th>
                  <th className="p-4">سعر البيع</th>
                  <th className="p-4">الكمية الحالية</th>
                  <th className="p-4">موقع التخزين</th>
                  <th className="p-4 text-center">خيارات التحكم</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2a2d42]/40">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-gray-400 text-xs">
                      لا يوجد أي منتجات تطابق شروط البحث والفرز الحالية
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map(p => {
                    const isLowStock = p.quantity <= p.minStock;
                    const isOut = p.quantity === 0;
                    return (
                      <tr 
                        key={p.id} 
                        onClick={() => handleOpenViewProduct(p)}
                        className="hover:bg-gray-950/20 transition-colors text-xs cursor-pointer"
                      >
                        <td className="p-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <button onClick={(e) => handleToggleSelectProduct(p.id, e)} className="text-gray-400 hover:text-white cursor-pointer">
                            {selectedProductIds.includes(p.id) ? (
                              <CheckSquare className="w-4 h-4 text-indigo-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="p-4">
                          <div className="font-bold text-white flex items-center gap-2">
                            <span>{p.nameAr || p.name}</span>
                            {p.nameAr && p.name !== p.nameAr && (
                              <span className="text-gray-400 font-normal text-[10px] font-mono">({p.name})</span>
                            )}
                            {p.isArchived && (
                              <span className="bg-amber-500/10 text-amber-400 border border-amber-500/20 px-1.5 py-0.5 rounded text-[9px] font-bold">مؤرشف</span>
                            )}
                          </div>
                          {p.brand && (
                            <span className="text-indigo-400 text-[10px] block mt-0.5">{p.brand}</span>
                          )}
                        </td>
                        <td className="p-4">
                          <div className="font-mono text-gray-300 font-bold">{p.sku}</div>
                          <div className="text-[10px] text-gray-500 font-mono mt-0.5">{p.barcode}</div>
                        </td>
                        <td className="p-4">
                          <span className="bg-[#2a2d42]/50 text-gray-300 px-2.5 py-1 rounded-lg text-[10px] font-bold">
                            {p.category}
                          </span>
                        </td>
                        <td className="p-4 font-mono font-bold text-gray-300">{p.purchasePrice} ج.م</td>
                        <td className="p-4 font-mono font-bold text-indigo-300">
                          {p.sellPrice} ج.م
                          {p.wholesalePrice ? (
                            <span className="block text-[10px] text-gray-500 font-normal mt-0.5">جملة: {p.wholesalePrice}</span>
                          ) : null}
                        </td>
                        <td className="p-4 font-mono">
                          <div className="flex items-center gap-1.5">
                            <span className={`font-bold ${isOut ? "text-red-500" : isLowStock ? "text-yellow-400" : "text-white"}`}>
                              {p.quantity} {p.unit || "قطعة"}
                            </span>
                            {isOut ? (
                              <span className="bg-red-500/10 text-red-500 border border-red-500/20 px-1 py-0.5 rounded text-[9px] font-bold">منتهٍ</span>
                            ) : isLowStock ? (
                              <span className="bg-yellow-500/10 text-yellow-500 border border-yellow-500/20 px-1 py-0.5 rounded text-[9px] font-bold">منخفض</span>
                            ) : null}
                          </div>
                        </td>
                        <td className="p-4 text-gray-400 font-bold">{p.location || "غير محدد"}</td>
                        <td className="p-4" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-center gap-2">
                            {/* Stock increment shortcut */}
                            <button
                              onClick={(e) => handleQuickAddStock(p, e)}
                              title="زيادة سريعة للمخزون"
                              className="p-1.5 bg-[#2a2d42]/40 hover:bg-emerald-600/20 hover:text-emerald-400 text-gray-400 rounded-lg transition-colors cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={() => handleOpenViewProduct(p)}
                              title="عرض التفاصيل الكاملة"
                              className="p-1.5 bg-[#2a2d42]/40 hover:bg-indigo-600/20 hover:text-indigo-400 text-gray-400 rounded-lg transition-colors cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={(e) => handleDuplicateProduct(p, e)}
                              title="نسخ الصنف وتكراره"
                              className="p-1.5 bg-[#2a2d42]/40 hover:bg-teal-600/20 hover:text-teal-400 text-gray-400 rounded-lg transition-colors cursor-pointer"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={(e) => handleOpenEditProduct(p, e)}
                              title="تعديل الصنف"
                              className="p-1.5 bg-[#2a2d42]/40 hover:bg-indigo-600/20 hover:text-indigo-400 text-gray-400 rounded-lg transition-colors cursor-pointer"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={(e) => handleToggleArchiveProduct(p, e)}
                              title={p.isArchived ? "استعادة من الأرشيف" : "نقل للأرشيف"}
                              className={`p-1.5 bg-[#2a2d42]/40 text-gray-400 rounded-lg transition-colors cursor-pointer ${
                                p.isArchived ? "hover:bg-green-600/20 hover:text-green-400" : "hover:bg-amber-600/20 hover:text-amber-400"
                              }`}
                            >
                              <Archive className="w-3.5 h-3.5" />
                            </button>

                            <button
                              onClick={(e) => handleDeleteProductAction(p, e)}
                              title="حذف نهائي"
                              className="p-1.5 bg-[#2a2d42]/40 hover:bg-red-600/20 hover:text-red-400 text-gray-400 rounded-lg transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
      )}

      {/* --- Tab 2: Suppliers List --- */}
      {activeTab === "suppliers" && (
        <div className="space-y-6">
          <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-xl">
            <p className="text-xs text-gray-400 leading-relaxed">
              إدارة شركات ومصادر توريد قطع غيار أجهزة البلايستيشن والإكسسوارات. يمكنك تتبع الديون المستحقة أو المبالغ المودعة مسبقاً وتعديل أرقام الهواتف للتواصل السريع.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {suppliers.map(s => (
              <div key={s.id} className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-bold text-white">{s.name}</h4>
                    <span className="text-[10px] text-indigo-400 font-bold block mt-1">{s.company}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded text-[10px] font-mono">
                      {s.id}
                    </span>
                    <button
                      onClick={(e) => handleOpenEditSupplier(s, e)}
                      title="تعديل بيانات المورد"
                      className="p-1 text-gray-400 hover:text-indigo-400 hover:bg-indigo-500/10 rounded transition-all-custom cursor-pointer"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDeleteSupplier(s, e)}
                      title="حذف/أرشفة المورد"
                      className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-all-custom cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-gray-400">رقم الهاتف:</span>
                    <span className="text-gray-200 font-mono" style={{ direction: "ltr" }}>{s.phone || "غير مسجل"}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[#2a2d42]/40">
                    <span className="text-gray-400 font-bold">الحساب المستحق:</span>
                    <span className={`font-bold ${s.balance > 0 ? "text-red-400" : "text-green-400"}`}>
                      {s.balance.toLocaleString()} ج.م
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* --- View Product Modal --- */}
      {isViewModalOpen && viewingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden text-right">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#2a2d42] bg-gray-950/40">
              <div>
                <h3 className="text-md font-bold text-white">بطاقة تعريف تفصيلية للمنتج</h3>
                <span className="text-indigo-400 text-[10px] font-mono block mt-1">كود النظام: {viewingProduct.id}</span>
              </div>
              <button onClick={() => setIsViewModalOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-950/40 p-3.5 rounded-xl border border-[#2a2d42]/60">
                  <span className="text-[10px] text-gray-500 block">الاسم بالإنجليزية</span>
                  <p className="text-xs text-white font-bold mt-1">{viewingProduct.name}</p>
                </div>
                <div className="bg-gray-950/40 p-3.5 rounded-xl border border-[#2a2d42]/60">
                  <span className="text-[10px] text-gray-500 block">الاسم بالعربية</span>
                  <p className="text-xs text-white font-bold mt-1">{viewingProduct.nameAr || "غير مسجل"}</p>
                </div>
                <div className="bg-gray-950/40 p-3.5 rounded-xl border border-[#2a2d42]/60">
                  <span className="text-[10px] text-gray-500 block">كود الحفظ والتعريف SKU</span>
                  <p className="text-xs text-indigo-400 font-mono font-bold mt-1">{viewingProduct.sku}</p>
                </div>
                <div className="bg-gray-950/40 p-3.5 rounded-xl border border-[#2a2d42]/60">
                  <span className="text-[10px] text-gray-500 block">الباركود</span>
                  <p className="text-xs text-indigo-400 font-mono font-bold mt-1">{viewingProduct.barcode}</p>
                </div>
                <div className="bg-gray-950/40 p-3.5 rounded-xl border border-[#2a2d42]/60">
                  <span className="text-[10px] text-gray-500 block">التصنيف الرئيسي</span>
                  <p className="text-xs text-white font-bold mt-1">{viewingProduct.category}</p>
                </div>
                <div className="bg-gray-950/40 p-3.5 rounded-xl border border-[#2a2d42]/60">
                  <span className="text-[10px] text-gray-500 block">الشركة / الماركة</span>
                  <p className="text-xs text-white font-bold mt-1">{viewingProduct.brand || "غير محدد"}</p>
                </div>
                <div className="bg-gray-950/40 p-3.5 rounded-xl border border-[#2a2d42]/60">
                  <span className="text-[10px] text-gray-500 block">المورد الرئيسي</span>
                  <p className="text-xs text-white font-bold mt-1">{viewingProduct.supplier || "غير محدد"}</p>
                </div>
                <div className="bg-gray-950/40 p-3.5 rounded-xl border border-[#2a2d42]/60">
                  <span className="text-[10px] text-gray-500 block">مكان التخزين (الرف/القطاع)</span>
                  <p className="text-xs text-white font-bold mt-1">{viewingProduct.location || "غير محدد"}</p>
                </div>
              </div>

              {/* Pricing Section */}
              <div className="bg-indigo-950/10 border border-indigo-500/20 p-4 rounded-xl space-y-3">
                <h4 className="text-xs font-bold text-indigo-400">تفاصيل وهيكل التسعير (ج.م)</h4>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <span className="text-[10px] text-gray-400">سعر الشراء</span>
                    <p className="text-xs text-white font-mono font-bold mt-0.5">{viewingProduct.purchasePrice} ج.م</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400">سعر البيع الافتراضي</span>
                    <p className="text-xs text-green-400 font-mono font-bold mt-0.5">{viewingProduct.sellPrice} ج.م</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400">سعر تكلفة استخدام الفني</span>
                    <p className="text-xs text-yellow-400 font-mono font-bold mt-0.5">{viewingProduct.technicianCost || 0} ج.م</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400">سعر الجملة</span>
                    <p className="text-xs text-white font-mono font-bold mt-0.5">{viewingProduct.wholesalePrice || 0} ج.م</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400">الحد الأدنى للبيع</span>
                    <p className="text-xs text-red-400 font-mono font-bold mt-0.5">{viewingProduct.minSellPrice || 0} ج.م</p>
                  </div>
                  <div>
                    <span className="text-[10px] text-gray-400">الربح التقديري (للوحدة)</span>
                    <p className="text-xs text-emerald-400 font-mono font-bold mt-0.5">
                      {viewingProduct.sellPrice - viewingProduct.purchasePrice} ج.م
                    </p>
                  </div>
                </div>
              </div>

              {/* Stock and Unit */}
              <div className="bg-gray-950/30 border border-[#2a2d42] p-4 rounded-xl">
                <div className="flex justify-between items-center">
                  <div>
                    <span className="text-[10px] text-gray-400 block">الرصيد المتوفر حالياً</span>
                    <p className="text-sm text-white font-bold mt-0.5">
                      {viewingProduct.quantity} {viewingProduct.unit || "قطعة"}
                    </p>
                  </div>
                  <div className="text-left">
                    <span className="text-[10px] text-gray-400 block">حد الطلب الحرج</span>
                    <p className="text-xs text-yellow-400 font-bold mt-0.5">{viewingProduct.minStock} {viewingProduct.unit || "قطعة"}</p>
                  </div>
                </div>
              </div>

              {/* Compatibility section */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-white">الأجهزة والموديلات المتوافقة</h4>
                <div className="space-y-1.5">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-[10px] text-gray-400 block w-full">الأنواع المتوافقة:</span>
                    {viewingProduct.compatibleDeviceTypes && viewingProduct.compatibleDeviceTypes.length > 0 ? (
                      viewingProduct.compatibleDeviceTypes.map(t => (
                        <span key={t} className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                          {t}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 text-[10px]">متوافق مع كل الأجهزة</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <span className="text-[10px] text-gray-400 block w-full">الموديلات الدقيقة المتوافقة:</span>
                    {viewingProduct.compatibleModels && viewingProduct.compatibleModels.length > 0 ? (
                      viewingProduct.compatibleModels.map(m => (
                        <span key={m} className="bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded text-[10px] font-bold">
                          {m}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-500 text-[10px]">متوافق مع جميع موديلات الفئة</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Notes */}
              {viewingProduct.notes && (
                <div className="bg-gray-950/40 p-4 rounded-xl border border-[#2a2d42]/50">
                  <span className="text-[10px] text-gray-500 block">ملاحظات داخلية وتفاصيل إضافية</span>
                  <p className="text-xs text-gray-300 leading-relaxed mt-1">{viewingProduct.notes}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-[#2a2d42] bg-gray-950/40 flex justify-end gap-2">
              <button
                onClick={() => {
                  setIsViewModalOpen(false);
                  handleOpenEditProduct(viewingProduct);
                }}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-xs font-bold cursor-pointer"
              >
                تعديل الصنف
              </button>
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="bg-[#2a2d42] hover:bg-[#343854] text-white px-4 py-2 rounded-xl text-xs cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- Add/Edit Product Modal --- */}
      {isProductModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-xs p-4">
          <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden text-right">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#2a2d42] bg-gray-950/40">
              <h3 className="text-md font-bold text-white">
                {editingProduct ? `تعديل الصنف: ${editingProduct.name}` : "إضافة صنف / قطعة غيار صيانة جديدة"}
              </h3>
              <button onClick={() => setIsProductModalOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-5 max-h-[80vh] overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Product Name (EN) */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">اسم المنتج بالإنجليزية *</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. PS5 HDMI IC Chip MN864739"
                    value={pName}
                    onChange={e => setPName(e.target.value)}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                  />
                </div>

                {/* Product Name (AR) */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">اسم المنتج بالعربية *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: آيسيه باور بلايستيشن 5 أصلي"
                    value={pNameAr}
                    onChange={e => setPNameAr(e.target.value)}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                  />
                </div>

                {/* SKU Code */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">كود الحفظ الموحد SKU *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: PS5-IC-PWR-01"
                    value={pSku}
                    onChange={e => setPSku(e.target.value)}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono font-bold"
                  />
                </div>

                {/* Barcode */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">الباركود البصري للقطعة / الصنف *</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      required
                      placeholder="امسح الباركود بالمسدس الضوئي أو اكتب يدوياً..."
                      value={pBarcode}
                      onChange={e => setPBarcode(e.target.value)}
                      className="flex-1 bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono font-bold"
                    />
                    <button
                      type="button"
                      onClick={() => setPBarcode(`ATARI-${Math.floor(10000000 + Math.random() * 90000000)}`)}
                      className="bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 text-indigo-300 hover:text-white text-[11px] font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer"
                    >
                      توليد تلقائي
                    </button>
                  </div>
                </div>

                {/* Category Selection */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">تصنيف المخزن التابع له *</label>
                  <select
                    value={pCategory}
                    onChange={e => setPCategory(e.target.value)}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                  >
                    {categories.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                {/* Brand */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">الماركة / الشركة المصنعة</label>
                  <input
                    type="text"
                    placeholder="مثال: Sony, Microsoft, OEM..."
                    value={pBrand}
                    onChange={e => setPBrand(e.target.value)}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                {/* Supplier selection */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">المورد الافتراضي</label>
                  <select
                    value={pSupplier}
                    onChange={e => setPSupplier(e.target.value)}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">اختر مورد...</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.name}>{s.name} ({s.company})</option>
                    ))}
                  </select>
                </div>

                {/* Storage location */}
                <div>
                  <label className="text-xs text-gray-400 block mb-1">موقع التخزين المادي بالرف</label>
                  <input
                    type="text"
                    placeholder="مثال: قطاع A - الرف رقم 4"
                    value={pLoc}
                    onChange={e => setPLoc(e.target.value)}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                  />
                </div>
              </div>

              {/* Pricing Form Section */}
              <div className="bg-gray-950/40 p-5 rounded-2xl border border-[#2a2d42] space-y-4">
                <h4 className="text-xs font-bold text-indigo-400">هيكل تسعير ومبيعات ومشتريات الصنف (ج.م)</h4>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 block mb-1">سعر الشراء الفعلي *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={pPurchase || ""}
                      onChange={e => setPPurchase(Number(e.target.value))}
                      className="w-full bg-gray-950 border border-[#2a2d42]/60 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">سعر البيع المقترح لقطاع الغيار *</label>
                    <input
                      type="number"
                      required
                      min="0"
                      value={pSell || ""}
                      onChange={e => setPSell(Number(e.target.value))}
                      className="w-full bg-gray-950 border border-[#2a2d42]/60 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold font-mono text-green-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">تكلفة استخدام الفني الفعلي</label>
                    <input
                      type="number"
                      min="0"
                      value={pTechCost || ""}
                      onChange={e => setPTechCost(Number(e.target.value))}
                      className="w-full bg-gray-950 border border-[#2a2d42]/60 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold font-mono text-yellow-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">سعر مبيعات الجملة للشركاء</label>
                    <input
                      type="number"
                      min="0"
                      value={pWholesale || ""}
                      onChange={e => setPWholesale(Number(e.target.value))}
                      className="w-full bg-gray-950 border border-[#2a2d42]/60 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">الحد الأدنى المسموح به للبيع</label>
                    <input
                      type="number"
                      min="0"
                      value={pMinSell || ""}
                      onChange={e => setPMinSell(Number(e.target.value))}
                      className="w-full bg-gray-950 border border-[#2a2d42]/60 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold font-mono text-red-400"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-gray-400 block mb-1">وحدة القياس</label>
                    <input
                      type="text"
                      placeholder="قطعة، كابل، كرتونة..."
                      value={pUnit}
                      onChange={e => setPUnit(e.target.value)}
                      className="w-full bg-gray-950 border border-[#2a2d42]/60 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* Dynamic compatibility selectors using the real database */}
              <div className="bg-gray-950/20 p-4 rounded-xl border border-[#2a2d42]/80 space-y-3">
                <h4 className="text-xs font-bold text-white">توافق الصنف مع الأجهزة والموديلات الدقيقة (تحديد خيارات)</h4>
                
                {/* Device Type multiselect */}
                <div className="space-y-1">
                  <span className="text-[11px] text-gray-400 block">توافق نوع الكونسول:</span>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {deviceTypes.map(t => {
                      const isSelected = pCompTypes.includes(t.nameAr) || pCompTypes.includes(t.nameEn);
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setPCompTypes(prev => prev.filter(x => x !== t.nameAr && x !== t.nameEn));
                            } else {
                              setPCompTypes(prev => [...prev, t.nameAr]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                            isSelected 
                              ? "bg-indigo-600 text-white border-indigo-500 shadow-md" 
                              : "bg-gray-950 text-gray-400 border-[#2a2d42] hover:text-white"
                          }`}
                        >
                          {t.nameAr}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Model compatibility select */}
                <div className="space-y-1 pt-2 border-t border-[#2a2d42]/50">
                  <span className="text-[11px] text-gray-400 block">الموديل الدقيق (اختياري لقطع معينة):</span>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {deviceModels.map(m => {
                      const isSelected = pCompModels.includes(m.nameAr) || pCompModels.includes(m.nameEn);
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => {
                            if (isSelected) {
                              setPCompModels(prev => prev.filter(x => x !== m.nameAr && x !== m.nameEn));
                            } else {
                              setPCompModels(prev => [...prev, m.nameAr]);
                            }
                          }}
                          className={`px-3 py-1.5 rounded-xl text-[10px] font-bold border transition-all cursor-pointer ${
                            isSelected 
                              ? "bg-teal-600 text-white border-teal-500 shadow-md" 
                              : "bg-gray-950 text-gray-400 border-[#2a2d42] hover:text-white"
                          }`}
                        >
                          {m.nameAr}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Quantities */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-gray-400 block mb-1">الكمية الحالية المتوفرة بالمخازن *</label>
                  <input
                    type="number"
                    required
                    min="0"
                    value={pQty}
                    onChange={e => setPQty(Number(e.target.value))}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold font-mono"
                  />
                </div>

                <div>
                  <label className="text-xs text-gray-400 block mb-1">الحد الأدنى للأمان (لتنبيه النقص)</label>
                  <input
                    type="number"
                    min="0"
                    value={pMin}
                    onChange={e => setPMin(Number(e.target.value))}
                    className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold font-mono"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-xs text-gray-400 block mb-1">ملاحظات فنية أو تفاصيل تخزين إضافية</label>
                <textarea
                  placeholder="مواصفات القطعة التوافقية أو قيود الضمان..."
                  value={pNotes}
                  onChange={e => setPNotes(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 h-20"
                />
              </div>

              {/* Active check */}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pIsActive"
                  checked={pIsActive}
                  onChange={e => setPIsActive(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 focus:ring-indigo-500 bg-gray-950 border-[#2a2d42] rounded cursor-pointer"
                />
                <label htmlFor="pIsActive" className="text-xs text-gray-300 select-none cursor-pointer">هذا الصنف نشط حالياً للبيع والاستخدام الفوري بالفواتير</label>
              </div>

              <div className="flex gap-2 pt-2 border-t border-[#2a2d42]">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-3 px-4 rounded-xl text-xs font-bold transition-all-custom cursor-pointer"
                >
                  حفظ الصنف بالكامل
                </button>
                <button
                  type="button"
                  onClick={() => setIsProductModalOpen(false)}
                  className="flex-1 bg-[#2a2d42] hover:bg-[#343854] text-white py-3 px-4 rounded-xl text-xs transition-all-custom cursor-pointer"
                >
                  إلغاء التراجع
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Add/Edit Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="bg-[#11131e] border border-[#2a2d42] rounded-xl w-full max-w-md shadow-2xl overflow-hidden text-right">
            <div className="flex justify-between items-center px-6 py-4 border-b border-[#2a2d42]">
              <h3 className="text-md font-bold text-white">
                {editingSupplier ? `تعديل بيانات المورد (${editingSupplier.id})` : "تسجيل مورد جديد لقطع الغيار"}
              </h3>
              <button onClick={() => setIsSupplierModalOpen(false)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-6 space-y-4">
              <div>
                <label className="text-xs text-gray-400 block mb-1">اسم جهة التوريد / المندوب *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: شركة تكنو جيم"
                  value={sName}
                  onChange={e => setSName(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">الشركة / العلامة التجارية الموردة *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: وكيل استيراد كونسول"
                  value={sCompany}
                  onChange={e => setSCompany(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">رقم الهاتف للتواصل</label>
                <input
                  type="tel"
                  placeholder="011xxxxxxx"
                  value={sPhone}
                  onChange={e => setSPhone(e.target.value)}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 text-left font-mono"
                  style={{ direction: "ltr" }}
                />
              </div>

              <div>
                <label className="text-xs text-gray-400 block mb-1">الحساب المستحق لهم حالياً (ج.م)</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={sBalance || ""}
                  onChange={e => setSBalance(Number(e.target.value))}
                  className="w-full bg-gray-950 border border-[#2a2d42] rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-bold"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg text-xs font-bold transition-all-custom cursor-pointer"
                >
                  حفظ المورد
                </button>
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="flex-1 bg-[#2a2d42] hover:bg-[#343854] text-white py-2 px-4 rounded-lg text-xs transition-all-custom cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
