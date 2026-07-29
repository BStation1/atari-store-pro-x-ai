import React, { useState } from 'react';
import {
  Calendar,
  Building2,
  User,
  Users,
  FileText,
  Printer,
  Download,
  Package,
  ChevronDown,
  ChevronUp,
  Box,
  Layers,
  ShoppingBag,
  X,
  Search,
  Filter,
  Eye,
  AlertCircle,
  Clock,
  DollarSign
} from 'lucide-react';
import { RepairOrder, WorkOwnershipType, Invoice } from '../../types';
import { formatDateISO, roundMoney } from '../../lib/finalReportsEngine';
import { useRepairPartUsages, useInvoices, useProducts } from '../../hooks/useData';
import { db } from '../../lib/db';

interface ProfitsSummaryProps {
  orders: RepairOrder[];
  currencySymbol?: string;
}

export interface WithdrawnItemDetail {
  id: string;
  partName: string;
  quantity: number;
  unitCost: number;
  totalCost: number;
  refNum: string;
  customerName: string;
  date: string;
  ownership: WorkOwnershipType;
  partyLabel: 'SHOP' | 'AHMED' | 'ABDO';
  partyNameArabic: string;
  sourceType: 'REPAIR_ORDER' | 'DIRECT_INVOICE';
}

export interface AggregatedItem {
  partName: string;
  totalQuantity: number;
  totalCost: number;
  minUnitCost: number;
  maxUnitCost: number;
  avgUnitCost: number;
  shopQty: number;
  ahmedQty: number;
  abdoQty: number;
  records: WithdrawnItemDetail[];
}

export default function ProfitsSummary({
  orders,
  currencySymbol = 'ج.م.'
}: ProfitsSummaryProps) {
  const { partUsages } = useRepairPartUsages();
  const { invoices } = useInvoices();
  const { products } = useProducts();

  // Current Date Helper Values
  const now = new Date();
  const todayISO = now.toISOString().split('T')[0];
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // State
  const [selectedMonthYear, setSelectedMonthYear] = useState<string>(currentMonthStr);
  const [partyFilter, setPartyFilter] = useState<'ALL' | 'SHOP' | 'AHMED' | 'ABDO'>('ALL');
  const [dateFilterType, setDateFilterType] = useState<'MONTH' | 'TODAY' | 'WEEK' | 'CUSTOM'>('MONTH');
  const [customFromDate, setCustomFromDate] = useState<string>(`${currentMonthStr}-01`);
  const [customToDate, setCustomToDate] = useState<string>(todayISO);

  // UI Modals & Expanders
  const [isWithdrawnModalOpen, setIsWithdrawnModalOpen] = useState(false);
  const [modalSearchQuery, setModalSearchQuery] = useState('');
  const [selectedItemForDetail, setSelectedItemForDetail] = useState<AggregatedItem | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  // Parse Month/Year for display
  const [yearStr, monthNumStr] = selectedMonthYear.split('-');
  const selectedYear = Number(yearStr) || now.getFullYear();
  const selectedMonth = Number(monthNumStr) || now.getMonth() + 1;

  const monthNamesArabic = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  const selectedMonthLabel = `${monthNamesArabic[selectedMonth - 1] || ''} ${selectedYear}`;

  // Helper Date Check Function
  const isDateInFilterRange = (dateStr?: string): boolean => {
    if (!dateStr) return false;
    const isoDate = formatDateISO(dateStr);

    if (dateFilterType === 'TODAY') {
      return isoDate === todayISO;
    }
    if (dateFilterType === 'WEEK') {
      const d = new Date(isoDate);
      const diffMs = now.getTime() - d.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      return diffDays >= 0 && diffDays <= 7;
    }
    if (dateFilterType === 'MONTH') {
      return isoDate.startsWith(selectedMonthYear);
    }
    if (dateFilterType === 'CUSTOM') {
      return isoDate >= customFromDate && isoDate <= customToDate;
    }
    return true;
  };

  // Helper Party Ownership Match
  const matchesPartyFilter = (ownership: WorkOwnershipType): boolean => {
    if (partyFilter === 'ALL') return true;
    if (partyFilter === 'SHOP') return ownership === WorkOwnershipType.CUSTOMER_SHARED;
    if (partyFilter === 'AHMED') return ownership === WorkOwnershipType.PARTNER_1_PRIVATE;
    if (partyFilter === 'ABDO') return ownership === WorkOwnershipType.PARTNER_2_PRIVATE;
    return true;
  };

  // 1. Filter Orders by Date & Party
  const filteredOrders = orders.filter((o) => {
    if (!isDateInFilterRange(o.receivedDate)) return false;
    const ownership = o.jobType || o.workOwnershipType || WorkOwnershipType.CUSTOMER_SHARED;
    return matchesPartyFilter(ownership);
  });

  // Build row details for each filtered order
  const rows = filteredOrders.map((o) => {
    const orderNum = (o as any).orderNumber || o.id;
    const customer = o.customerNameSnapshot || o.guestCustomerName || 'عميل نقدي';
    const date = formatDateISO(o.receivedDate);
    const totalInvoice = Math.max(0, (Number(o.finalRepairPrice ?? o.totalEstimatedCost) || 0) - (Number(o.discount) || 0));

    // Get parts for this order
    const orderParts = partUsages.filter(
      (pu) => pu.repairOrderId === o.id && pu.accountingStatus !== 'RETURNED' && pu.accountingStatus !== 'REVERSED'
    );

    let partsList: { partName: string; quantity: number; unitCost: number; totalCost: number }[] = [];
    let partsCost = 0;

    if (orderParts.length > 0) {
      partsList = orderParts.map((p) => {
        const qty = Number(p.quantity) || 1;
        const uCost = Number(p.unitCost) || 0;
        const tCost = Number(p.totalCost) || qty * uCost;
        return {
          partName: p.partName || 'قطع غيار صيانة',
          quantity: qty,
          unitCost: uCost,
          totalCost: tCost
        };
      });
      partsCost = partsList.reduce((sum, item) => sum + item.totalCost, 0);
    } else {
      const devicePartsCost = o.devices?.reduce((sum, d) => sum + (Number(d.partsCost) || 0), 0) || 0;
      partsCost = devicePartsCost;
      if (devicePartsCost > 0) {
        partsList = [
          {
            partName: 'قطع غيار صيانة مسجلة بالأوردر',
            quantity: 1,
            unitCost: devicePartsCost,
            totalCost: devicePartsCost
          }
        ];
      }
    }

    const netProfit = Math.max(0, totalInvoice - partsCost);
    const ownership = o.jobType || o.workOwnershipType || WorkOwnershipType.CUSTOMER_SHARED;

    let ahmedShare = 0;
    let abdoShare = 0;
    let workLabel = 'شغل المحل';

    if (ownership === WorkOwnershipType.PARTNER_1_PRIVATE) {
      // شغل أحمد: أحمد 100%، عبده 0%
      ahmedShare = roundMoney(netProfit * 1.0);
      abdoShare = 0;
      workLabel = 'شغل أحمد';
    } else if (ownership === WorkOwnershipType.PARTNER_2_PRIVATE) {
      // شغل عبده: عبده 75%، أحمد 25%
      abdoShare = roundMoney(netProfit * 0.75);
      ahmedShare = roundMoney(netProfit * 0.25);
      workLabel = 'شغل عبده';
    } else {
      // شغل المحل: أحمد 50%، عبده 50%
      ahmedShare = roundMoney(netProfit * 0.5);
      abdoShare = roundMoney(netProfit * 0.5);
      workLabel = 'شغل المحل';
    }

    return {
      id: o.id,
      orderNum,
      customer,
      date,
      ownership,
      workLabel,
      totalInvoice,
      partsCost,
      partsList,
      netProfit,
      ahmedShare,
      abdoShare
    };
  });

  // 2. Extract ALL Raw Withdrawn Inventory Items across repair orders and direct sales invoices
  const allWithdrawalTransactions: WithdrawnItemDetail[] = [];

  // A. From Repair Part Usages (linked to repair orders or partner inventory withdrawals)
  partUsages.forEach((pu, puIdx) => {
    if (pu.accountingStatus === 'RETURNED' || pu.accountingStatus === 'REVERSED') return;

    const parentOrder = orders.find((o) => o.id === pu.repairOrderId);
    const dateStr = pu.createdAt || parentOrder?.receivedDate || (pu as any).date || new Date().toISOString();
    if (!isDateInFilterRange(dateStr)) return;

    // Real Item Name from Supabase (partName, or product name lookup)
    const matchedProduct = products.find((prod) => prod.id === pu.inventoryItemId || prod.sku === pu.sku);
    const realPartName = (
      pu.partName ||
      matchedProduct?.name ||
      matchedProduct?.nameAr ||
      pu.sku ||
      ''
    ).trim();

    if (!realPartName) return; // Skip records with no real name

    // Determine responsible party
    let ownership = pu.ownershipType;
    if (!ownership && parentOrder) {
      ownership = parentOrder.jobType || parentOrder.workOwnershipType || WorkOwnershipType.CUSTOMER_SHARED;
    }
    if (!ownership) ownership = WorkOwnershipType.CUSTOMER_SHARED;

    let partyLabel: 'SHOP' | 'AHMED' | 'ABDO' = 'SHOP';
    if (
      pu.responsiblePartnerId === 'P-001' ||
      pu.responsiblePartnerId === 'AHMED' ||
      ownership === WorkOwnershipType.PARTNER_1_PRIVATE ||
      (ownership as string) === 'PARTNER_1_PRIVATE'
    ) {
      partyLabel = 'AHMED';
    } else if (
      pu.responsiblePartnerId === 'P-002' ||
      pu.responsiblePartnerId === 'ABDO' ||
      ownership === WorkOwnershipType.PARTNER_2_PRIVATE ||
      (ownership as string) === 'PARTNER_2_PRIVATE'
    ) {
      partyLabel = 'ABDO';
    }

    const qty = Number(pu.quantity) || 1;
    const uCost = Number(pu.unitCost) || 0;
    const tCost = Number(pu.totalCost) || qty * uCost;

    const isPartnerWithdrawal = pu.repairOrderId === 'PARTNER_WITHDRAWAL';
    const orderNum = isPartnerWithdrawal
      ? 'سحب شريك'
      : (parentOrder as any)?.orderNumber || pu.repairOrderId || 'صيانة';
    const customerName = isPartnerWithdrawal
      ? (partyLabel === 'ABDO' ? 'مسحوبات الشريك عبده' : 'مسحوبات الشريك أحمد')
      : parentOrder?.customerNameSnapshot || parentOrder?.guestCustomerName || 'عميل صيانة';

    allWithdrawalTransactions.push({
      id: pu.id || `pu-${pu.repairOrderId}-${realPartName}-${puIdx}`,
      partName: realPartName,
      quantity: qty,
      unitCost: uCost,
      totalCost: tCost,
      refNum: isPartnerWithdrawal ? 'مسحوبات بضاعة لشريك' : `أمر صيانة #${orderNum}`,
      customerName,
      date: formatDateISO(dateStr),
      ownership,
      partyLabel,
      partyNameArabic: partyLabel === 'AHMED' ? 'أحمد' : partyLabel === 'ABDO' ? 'عبده' : 'المحل',
      sourceType: 'REPAIR_ORDER'
    });
  });

  // A2. From Direct Inventory Movements (Partner Withdrawals)
  try {
    const rawMovements = db.getInventoryMovements() || [];
    rawMovements.forEach((m: any, mIdx: number) => {
      if (m.movementType === 'PARTNER_WITHDRAWAL' || m.movement_type === 'PARTNER_WITHDRAWAL') {
        const dateStr = m.createdAt || m.created_at || new Date().toISOString();
        if (!isDateInFilterRange(dateStr)) return;

        const prodId = m.productId || m.product_id;
        const matchedProd = products.find(p => p.id === prodId || p.sku === m.referenceId);
        const partName = matchedProd?.name || matchedProd?.nameAr || m.notes || 'صنف مسحوب';

        const isAbdo = m.partner === 'ABDO' || m.referenceId === 'ABDO' || m.reference_id === 'ABDO' || (m.notes || '').includes('عبده');
        const partyLabel: 'SHOP' | 'AHMED' | 'ABDO' = isAbdo ? 'ABDO' : 'AHMED';

        const qty = Math.abs(Number(m.quantityChange || m.quantity_change) || 1);
        const uCost = Number(m.costPriceSnapshot || m.cost_price_snapshot) || Number(matchedProd?.purchasePrice) || 0;
        const tCost = qty * uCost;

        const exists = allWithdrawalTransactions.some(
          tx => tx.partName === partName && tx.quantity === qty && tx.date === formatDateISO(dateStr)
        );
        if (!exists) {
          allWithdrawalTransactions.push({
            id: m.id || `mov-with-${mIdx}`,
            partName,
            quantity: qty,
            unitCost: uCost,
            totalCost: tCost,
            refNum: 'مسحوبات بضاعة لشريك',
            customerName: partyLabel === 'ABDO' ? 'مسحوبات الشريك عبده' : 'مسحوبات الشريك أحمد',
            date: formatDateISO(dateStr),
            ownership: isAbdo ? WorkOwnershipType.PARTNER_2_PRIVATE : WorkOwnershipType.PARTNER_1_PRIVATE,
            partyLabel,
            partyNameArabic: partyLabel === 'AHMED' ? 'أحمد' : partyLabel === 'ABDO' ? 'عبده' : 'المحل',
            sourceType: 'REPAIR_ORDER'
          });
        }
      }
    });
  } catch (err) {
    console.warn('Notice parsing inventory movements in ProfitsSummary:', err);
  }

  // B. From Direct Sales Invoices (Prevent duplication: exclude invoices linked to repair orders)
  invoices.forEach((inv) => {
    if (inv.isCancelled) return;
    if (inv.orderId || inv.type === 'repair') return; // Deduplication rule

    const dateStr = inv.date || inv.createdAt;
    if (!isDateInFilterRange(dateStr)) return;

    if (inv.items && inv.items.length > 0) {
      inv.items.forEach((item, idx) => {
        const realPartName = (
          item.name ||
          (item as any).productName ||
          (item as any).description ||
          ''
        ).trim();

        if (!realPartName) return;

        const stockOwnership = item.stockOwnership;
        let partyLabel: 'SHOP' | 'AHMED' | 'ABDO' = 'SHOP';
        let ownership = WorkOwnershipType.CUSTOMER_SHARED;

        if (stockOwnership === 'AHMED') {
          partyLabel = 'AHMED';
          ownership = WorkOwnershipType.PARTNER_1_PRIVATE;
        } else if (stockOwnership === 'ABDO') {
          partyLabel = 'ABDO';
          ownership = WorkOwnershipType.PARTNER_2_PRIVATE;
        }

        const qty = Number(item.quantity) || 1;
        const uCost = Number((item as any).costPrice) || (Number((item as any).price || item.unitPrice) * 0.7);
        const tCost = qty * uCost;

        const invNum = (inv as any).invoiceNumber || inv.id;
        const customerName = (inv as any).customerNameSnapshot || inv.guestCustomerName || (inv as any).customerName || 'عميل مبيعات';

        allWithdrawalTransactions.push({
          id: `inv-${inv.id}-${idx}`,
          partName: realPartName,
          quantity: qty,
          unitCost: uCost,
          totalCost: tCost,
          refNum: `فاتورة مبيعات #${invNum}`,
          customerName,
          date: formatDateISO(dateStr),
          ownership,
          partyLabel,
          partyNameArabic: partyLabel === 'AHMED' ? 'أحمد' : partyLabel === 'ABDO' ? 'عبده' : 'المحل',
          sourceType: 'DIRECT_INVOICE'
        });
      });
    }
  });

  // Filter raw withdrawal transactions by selected party
  const withdrawnItemsList = allWithdrawalTransactions.filter((tx) => {
    if (partyFilter === 'ALL') return true;
    return tx.partyLabel === partyFilter;
  });

  // Group by real Item Name (اسم الصنف)
  const aggregatedItemsMap = new Map<string, AggregatedItem>();

  withdrawnItemsList.forEach((tx) => {
    const key = tx.partName;
    let aggregated = aggregatedItemsMap.get(key);
    if (!aggregated) {
      aggregated = {
        partName: key,
        totalQuantity: 0,
        totalCost: 0,
        minUnitCost: tx.unitCost,
        maxUnitCost: tx.unitCost,
        avgUnitCost: 0,
        shopQty: 0,
        ahmedQty: 0,
        abdoQty: 0,
        records: []
      };
      aggregatedItemsMap.set(key, aggregated);
    }

    aggregated.totalQuantity += tx.quantity;
    aggregated.totalCost += tx.totalCost;
    aggregated.minUnitCost = Math.min(aggregated.minUnitCost, tx.unitCost);
    aggregated.maxUnitCost = Math.max(aggregated.maxUnitCost, tx.unitCost);

    if (tx.partyLabel === 'SHOP') aggregated.shopQty += tx.quantity;
    if (tx.partyLabel === 'AHMED') aggregated.ahmedQty += tx.quantity;
    if (tx.partyLabel === 'ABDO') aggregated.abdoQty += tx.quantity;

    aggregated.records.push(tx);
  });

  const aggregatedItemsList = Array.from(aggregatedItemsMap.values()).map((item) => {
    item.avgUnitCost = item.totalQuantity > 0 ? roundMoney(item.totalCost / item.totalQuantity) : 0;
    item.records.sort((a, b) => b.date.localeCompare(a.date));
    return item;
  });

  // Sort aggregated items by total quantity descending
  aggregatedItemsList.sort((a, b) => b.totalQuantity - a.totalQuantity);

  // Withdrawn Inventory Aggregations
  const totalWithdrawnQty = withdrawnItemsList.reduce((sum, i) => sum + i.quantity, 0);
  const totalWithdrawnCost = roundMoney(withdrawnItemsList.reduce((sum, i) => sum + i.totalCost, 0));

  // Overall KPI Summaries for displayed dataset
  const totalOrdersCount = rows.length;
  const totalInvoices = roundMoney(rows.reduce((sum, r) => sum + r.totalInvoice, 0));
  const totalPartsCost = roundMoney(rows.reduce((sum, r) => sum + r.partsCost, 0));
  const totalNetProfit = roundMoney(rows.reduce((sum, r) => sum + r.netProfit, 0));
  const totalAhmedShare = roundMoney(rows.reduce((sum, r) => sum + r.ahmedShare, 0));
  const totalAbdoShare = roundMoney(rows.reduce((sum, r) => sum + r.abdoShare, 0));

  // ABDO'S SETTLEMENT FORMULA CALCULATIONS (Requirement 2)
  // For Abdo's Work specifically (Job type = PARTNER_2_PRIVATE):
  const abdoWorkRows = orders.filter((o) => {
    if (!isDateInFilterRange(o.receivedDate)) return false;
    const ownership = o.jobType || o.workOwnershipType;
    return ownership === WorkOwnershipType.PARTNER_2_PRIVATE;
  }).map((o) => {
    const totalInvoice = Math.max(0, (Number(o.finalRepairPrice ?? o.totalEstimatedCost) || 0) - (Number(o.discount) || 0));
    const orderParts = partUsages.filter(
      (pu) => pu.repairOrderId === o.id && pu.accountingStatus !== 'RETURNED' && pu.accountingStatus !== 'REVERSED'
    );
    let partsCost = 0;
    if (orderParts.length > 0) {
      partsCost = orderParts.reduce((sum, p) => sum + (Number(p.totalCost) || (Number(p.quantity) * Number(p.unitCost))), 0);
    } else {
      partsCost = o.devices?.reduce((sum, d) => sum + (Number(d.partsCost) || 0), 0) || 0;
    }
    const netProfit = Math.max(0, totalInvoice - partsCost);
    return {
      totalInvoice,
      partsCost,
      netProfit,
      ahmed25Share: roundMoney(netProfit * 0.25),
      abdo75Share: roundMoney(netProfit * 0.75)
    };
  });

  const abdoTotalInvoices = roundMoney(abdoWorkRows.reduce((sum, r) => sum + r.totalInvoice, 0));
  const abdoTotalPartsCost = roundMoney(abdoWorkRows.reduce((sum, r) => sum + r.partsCost, 0));
  const abdoTotalNetProfit = roundMoney(abdoWorkRows.reduce((sum, r) => sum + r.netProfit, 0));
  const abdoAhmed25Share = roundMoney(abdoWorkRows.reduce((sum, r) => sum + r.ahmed25Share, 0));
  const abdoAbdo75Profit = roundMoney(abdoWorkRows.reduce((sum, r) => sum + r.abdo75Share, 0));

  // Exact Formula required:
  // إجمالي المستحق على عبده = تكلفة البضاعة المسحوبة + نسبة أحمد 25%
  const abdoTotalOwedByAbdo = roundMoney(abdoTotalPartsCost + abdoAhmed25Share);

  // Print & Export Handlers
  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = [
      'رقم الأوردر',
      'التاريخ',
      'اسم العميل',
      'نوع الشغل',
      'إجمالي الفاتورة',
      'تكلفة قطع الغيار',
      'صافي الربح',
      'نصيب أحمد',
      'نصيب عبده'
    ];

    const csvRows = rows.map((r) => [
      r.orderNum,
      r.date,
      `"${r.customer}"`,
      `"${r.workLabel}"`,
      r.totalInvoice,
      r.partsCost,
      r.netProfit,
      r.ahmedShare,
      r.abdoShare
    ]);

    csvRows.push([]);
    csvRows.push(['--- تفاصيل البضاعة المسحوبة ---']);
    csvRows.push(['اسم القطعة', 'الكمية المسحوبة', 'سعر التكلفة', 'إجمالي التكلفة', 'رقم الأوردر/الفاتورة', 'العميل', 'التاريخ']);
    withdrawnItemsList.forEach((item) => {
      csvRows.push([
        `"${item.partName}"`,
        item.quantity,
        item.unitCost,
        item.totalCost,
        `"${item.refNum}"`,
        `"${item.customerName}"`,
        item.date
      ]);
    });

    csvRows.push([]);
    csvRows.push(['--- تسوية حساب عبده (شغل عبده) ---']);
    csvRows.push(['إجمالي الفواتير الخاصة بعبده', abdoTotalInvoices]);
    csvRows.push(['إجمالي تكلفة البضاعة المسحوبة', abdoTotalPartsCost]);
    csvRows.push(['نسبة أحمد (25%)', abdoAhmed25Share]);
    csvRows.push(['صافي ربح عبده (75%)', abdoAbdo75Profit]);
    csvRows.push(['إجمالي المستحق على عبده (البضاعة + نسبة أحمد)', abdoTotalOwedByAbdo]);

    const csvContent =
      'data:text/csv;charset=utf-8,\uFEFF' +
      [headers.join(','), ...csvRows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `partner_accounting_report_${selectedMonthYear}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Modal Filtered Items
  const modalFilteredItems = withdrawnItemsList.filter((item) => {
    if (!modalSearchQuery.trim()) return true;
    const q = modalSearchQuery.toLowerCase();
    return (
      item.partName.toLowerCase().includes(q) ||
      item.refNum.toLowerCase().includes(q) ||
      item.customerName.toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-6 text-right dir-rtl">
      {/* HEADER BAR */}
      <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-xl text-cyan-400">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-black text-white flex items-center gap-2">
              محاسبة الشركاء وتقارير الأرباح
              <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                {dateFilterType === 'MONTH' ? selectedMonthLabel : dateFilterType === 'TODAY' ? 'تقرير اليوم' : dateFilterType === 'WEEK' ? 'تقرير الأسبوع' : 'فترة مخصصة'}
              </span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              توزيع الأرباح الدقيق حسب نوع الشغل، تتبع البضاعة المسحوبة، وتسوية حساب عبده
            </p>
          </div>
        </div>

        {/* Export & Print */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Download className="w-4 h-4" />
            تصدير CSV
          </button>
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            طباعة
          </button>
        </div>
      </div>

      {/* FILTER CONTROL PANEL */}
      <div className="bg-[#11131e] border border-[#2a2d42] p-4.5 rounded-2xl space-y-4 shadow-md">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* 1. Select Party / Work Owner */}
          <div className="space-y-1.5">
            <label className="text-xs text-cyan-400 font-bold block flex items-center gap-1.5">
              <Users className="w-4 h-4 text-cyan-400" />
              1. اختيار الطرف / نوع الشغل:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'ALL', label: 'الجميع (الكل)', icon: Users },
                { id: 'SHOP', label: 'المحل (50/50)', icon: Building2 },
                { id: 'AHMED', label: 'أحمد (100%)', icon: User },
                { id: 'ABDO', label: 'عبده (75/25)', icon: User }
              ].map((p) => {
                const Icon = p.icon;
                return (
                  <button
                    key={p.id}
                    onClick={() => setPartyFilter(p.id as any)}
                    className={`flex-1 min-w-[100px] py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer flex items-center justify-center gap-1.5 border ${
                      partyFilter === p.id
                        ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 shadow-lg font-black'
                        : 'bg-[#181b2a] text-gray-400 border-[#2a2d42] hover:bg-[#202538] hover:text-white'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{p.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Select Date Range */}
          <div className="space-y-1.5">
            <label className="text-xs text-cyan-400 font-bold block flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-cyan-400" />
              2. التصفية حسب التاريخ:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                { id: 'TODAY', label: 'اليوم' },
                { id: 'WEEK', label: 'الأسبوع' },
                { id: 'MONTH', label: 'الشهر' },
                { id: 'CUSTOM', label: 'فترة مخصصة' }
              ].map((d) => (
                <button
                  key={d.id}
                  onClick={() => setDateFilterType(d.id as any)}
                  className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold transition cursor-pointer border ${
                    dateFilterType === d.id
                      ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/60 font-black'
                      : 'bg-[#181b2a] text-gray-400 border-[#2a2d42] hover:bg-[#202538] hover:text-white'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sub-inputs for Month Selector or Custom Date Inputs */}
        {dateFilterType === 'MONTH' && (
          <div className="flex items-center gap-3 pt-2 border-t border-[#1f2336]">
            <span className="text-xs text-gray-400 font-semibold">الشهر والسنة:</span>
            <input
              type="month"
              value={selectedMonthYear}
              onChange={(e) => setSelectedMonthYear(e.target.value)}
              className="bg-[#181b2a] border border-cyan-500/40 text-white font-bold text-xs px-3 py-1.5 rounded-xl outline-none focus:border-cyan-400 cursor-pointer"
            />
            <span className="text-xs text-cyan-300 font-bold">({selectedMonthLabel})</span>
          </div>
        )}

        {dateFilterType === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-[#1f2336]">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-semibold">من:</span>
              <input
                type="date"
                value={customFromDate}
                onChange={(e) => setCustomFromDate(e.target.value)}
                className="bg-[#181b2a] border border-cyan-500/40 text-white font-bold text-xs px-3 py-1.5 rounded-xl outline-none focus:border-cyan-400 cursor-pointer"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-400 font-semibold">إلى:</span>
              <input
                type="date"
                value={customToDate}
                onChange={(e) => setCustomToDate(e.target.value)}
                className="bg-[#181b2a] border border-cyan-500/40 text-white font-bold text-xs px-3 py-1.5 rounded-xl outline-none focus:border-cyan-400 cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      {/* SPECIAL HIGHLIGHT: ABDO'S ACCOUNT SETTLEMENT BOX (Requirement 2) */}
      {(partyFilter === 'ALL' || partyFilter === 'ABDO') && (
        <div className="bg-gradient-to-br from-[#1a1710] via-[#11131e] to-[#141221] border-2 border-amber-500/40 p-5 rounded-2xl shadow-2xl relative overflow-hidden space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-500/20 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 bg-amber-500/20 border border-amber-500/40 rounded-xl text-amber-400">
                <DollarSign className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-black text-amber-300 flex items-center gap-2">
                  تسوية حساب عبده (شغل عبده الخاص)
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
                    قواعد: عبده 75% | أحمد 25% | البضاعة مسحوبة
                  </span>
                </h3>
                <p className="text-[11px] text-gray-400">
                  عبده يسحب البضاعة من المحل دون دفع قيمتها فوراً، وتُسوى أرباح أحمد والبضاعة بنهاية الشهر
                </p>
              </div>
            </div>

            <div className="bg-rose-950/40 border border-rose-500/50 px-4 py-2 rounded-xl text-left dir-ltr">
              <span className="text-[10px] text-rose-300 font-bold block text-right dir-rtl">
                إجمالي المستحق على عبده
              </span>
              <span className="text-xl font-black text-rose-400">
                {abdoTotalOwedByAbdo.toLocaleString('ar-EG')} <span className="text-xs">{currencySymbol}</span>
              </span>
            </div>
          </div>

          {/* Abdo Breakdown Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-[#181b2a]/80 border border-[#2a2d42] p-3 rounded-xl">
              <span className="text-[10px] text-gray-400 font-bold block">1. إجمالي فواتير عبده</span>
              <h4 className="text-base font-black text-white mt-1">
                {abdoTotalInvoices.toLocaleString('ar-EG')} <span className="text-[10px]">{currencySymbol}</span>
              </h4>
            </div>

            <div className="bg-[#181b2a]/80 border border-rose-500/30 p-3 rounded-xl">
              <span className="text-[10px] text-rose-300 font-bold block">2. تكلفة البضاعة المسحوبة</span>
              <h4 className="text-base font-black text-rose-400 mt-1">
                {abdoTotalPartsCost.toLocaleString('ar-EG')} <span className="text-[10px]">{currencySymbol}</span>
              </h4>
            </div>

            <div className="bg-[#181b2a]/80 border border-indigo-500/30 p-3 rounded-xl">
              <span className="text-[10px] text-indigo-300 font-bold block">3. نسبة أحمد (25%)</span>
              <h4 className="text-base font-black text-indigo-300 mt-1">
                {abdoAhmed25Share.toLocaleString('ar-EG')} <span className="text-[10px]">{currencySymbol}</span>
              </h4>
            </div>

            <div className="bg-[#181b2a]/80 border border-emerald-500/30 p-3 rounded-xl">
              <span className="text-[10px] text-emerald-300 font-bold block">4. صافي ربح عبده (75%)</span>
              <h4 className="text-base font-black text-emerald-300 mt-1">
                {abdoAbdo75Profit.toLocaleString('ar-EG')} <span className="text-[10px]">{currencySymbol}</span>
              </h4>
            </div>

            <div className="col-span-2 sm:col-span-1 bg-gradient-to-r from-rose-950/60 to-rose-900/40 border border-rose-500/60 p-3 rounded-xl">
              <span className="text-[10px] text-rose-200 font-bold block">5. المستحق على عبده</span>
              <h4 className="text-base font-black text-rose-300 mt-1">
                {abdoTotalOwedByAbdo.toLocaleString('ar-EG')} <span className="text-[10px]">{currencySymbol}</span>
              </h4>
            </div>
          </div>

          <div className="bg-[#131625] p-2.5 rounded-xl border border-amber-500/20 text-xs text-amber-200/90 flex items-center justify-between">
            <span>
              💡 <strong>معادلة التسوية:</strong> إجمالي المستحق على عبده = تكلفة البضاعة المسحوبة ({abdoTotalPartsCost.toLocaleString('ar-EG')} ج.م) + نسبة أحمد 25% ({abdoAhmed25Share.toLocaleString('ar-EG')} ج.م) = <strong>{abdoTotalOwedByAbdo.toLocaleString('ar-EG')} ج.م.</strong>
            </span>
          </div>
        </div>
      )}

      {/* SUMMARY KPI CARDS (INCLUDING CLICKABLE WITHDRAWN INVENTORY CARD - Requirement 3) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {/* 1. عدد الأوردرات */}
        <div className="bg-[#11131e] border border-[#2a2d42] p-3.5 rounded-2xl">
          <span className="text-[11px] text-gray-400 font-bold block">عدد الأوردرات</span>
          <h4 className="text-xl font-black text-white mt-1">{totalOrdersCount}</h4>
          <span className="text-[10px] text-gray-500 block mt-0.5">أمر صيانة</span>
        </div>

        {/* 2. إجمالي الفواتير */}
        <div className="bg-[#11131e] border border-[#2a2d42] p-3.5 rounded-2xl">
          <span className="text-[11px] text-gray-400 font-bold block">إجمالي الإيرادات</span>
          <h4 className="text-xl font-black text-white mt-1">
            {totalInvoices.toLocaleString('ar-EG')}{' '}
            <span className="text-[10px] text-gray-400">{currencySymbol}</span>
          </h4>
          <span className="text-[10px] text-gray-500 block mt-0.5">إجمالي الفواتير</span>
        </div>

        {/* 3. CLICKABLE CARD: البضاعة المسحوبة (تكلفة البضاعة) */}
        <div
          onClick={() => setIsWithdrawnModalOpen(true)}
          className="bg-gradient-to-br from-rose-950/40 via-[#11131e] to-[#161222] border-2 border-rose-500/50 hover:border-rose-400 p-3.5 rounded-2xl cursor-pointer transition-all hover:scale-[1.02] group shadow-lg relative"
        >
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-rose-300 font-extrabold flex items-center gap-1">
              <ShoppingBag className="w-3.5 h-3.5 text-rose-400" />
              البضاعة المسحوبة
            </span>
            <span className="text-[9px] bg-rose-500/20 text-rose-300 px-1.5 py-0.5 rounded-full font-bold group-hover:bg-rose-500 group-hover:text-white transition">
              عرض التفاصيل 👁️
            </span>
          </div>
          <h4 className="text-xl font-black text-rose-300 mt-1">
            {totalPartsCost.toLocaleString('ar-EG')}{' '}
            <span className="text-[10px] text-gray-400">{currencySymbol}</span>
          </h4>
          <span className="text-[10px] text-rose-400/80 block mt-0.5 font-bold">
            {totalWithdrawnQty} قطعة مسحوبة (اضغط)
          </span>
        </div>

        {/* 4. عدد قطع الغيار */}
        <div className="bg-[#11131e] border border-rose-500/20 p-3.5 rounded-2xl">
          <span className="text-[11px] text-rose-300/80 font-bold block">إجمالي قطع الغيار</span>
          <h4 className="text-xl font-black text-rose-400 mt-1">{totalWithdrawnQty}</h4>
          <span className="text-[10px] text-gray-500 block mt-0.5">قطعة مستخدمة</span>
        </div>

        {/* 5. إجمالي صافي الربح */}
        <div className="bg-[#11131e] border border-cyan-500/40 p-3.5 rounded-2xl bg-cyan-950/10">
          <span className="text-[11px] text-cyan-300 font-bold block">إجمالي صافي الربح</span>
          <h4 className="text-xl font-black text-cyan-200 mt-1">
            {totalNetProfit.toLocaleString('ar-EG')}{' '}
            <span className="text-[10px] text-gray-400">{currencySymbol}</span>
          </h4>
          <span className="text-[10px] text-gray-400 block mt-0.5">بعد خصم التكلفة</span>
        </div>

        {/* 6. إجمالي مستحق أحمد */}
        <div className="bg-gradient-to-br from-indigo-950/60 to-[#11131e] border border-indigo-500/40 p-3.5 rounded-2xl">
          <span className="text-[11px] text-indigo-300 font-bold block">إجمالي مستحق أحمد</span>
          <h4 className="text-xl font-black text-indigo-200 mt-1">
            {totalAhmedShare.toLocaleString('ar-EG')}{' '}
            <span className="text-[10px] text-gray-400">{currencySymbol}</span>
          </h4>
          <span className="text-[10px] text-indigo-300/80 block mt-0.5">نصيبه النهائي</span>
        </div>

        {/* 7. إجمالي مستحق عبده */}
        <div className="bg-gradient-to-br from-emerald-950/60 to-[#11131e] border border-emerald-500/40 p-3.5 rounded-2xl">
          <span className="text-[11px] text-emerald-300 font-bold block">إجمالي مستحق عبده</span>
          <h4 className="text-xl font-black text-emerald-200 mt-1">
            {totalAbdoShare.toLocaleString('ar-EG')}{' '}
            <span className="text-[10px] text-gray-400">{currencySymbol}</span>
          </h4>
          <span className="text-[10px] text-emerald-300/80 block mt-0.5">نصيبه النهائي</span>
        </div>
      </div>

      {/* MAIN ORDERS REPAIR TABLE */}
      <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-[#2a2d42] flex items-center justify-between bg-[#141724]">
          <h3 className="text-sm font-bold text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-cyan-400" />
            جدول أوردرات الصيانة والتوزيع ({rows.length} أمر)
          </h3>
          <span className="text-xs font-bold text-gray-400">
            الطرف المفلتر: <strong className="text-cyan-300">{partyFilter === 'ALL' ? 'الكل' : partyFilter === 'SHOP' ? 'المحل' : partyFilter === 'AHMED' ? 'أحمد' : 'عبده'}</strong>
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-right text-gray-300">
            <thead className="bg-[#181b2a] text-gray-400 font-semibold border-b border-[#2a2d42]">
              <tr>
                <th className="p-3">رقم الأوردر</th>
                <th className="p-3">التاريخ</th>
                <th className="p-3">العميل</th>
                <th className="p-3">نوع الشغل</th>
                <th className="p-3">إجمالي الفاتورة</th>
                <th className="p-3 text-rose-400">تكلفة قطع الغيار</th>
                <th className="p-3 text-cyan-300">صافي الربح</th>
                <th className="p-3 text-indigo-400 font-bold">نصيب أحمد</th>
                <th className="p-3 text-emerald-400 font-bold">نصيب عبده</th>
                <th className="p-3 text-center">عرض البضاعة</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1f2937]">
              {rows.length > 0 ? (
                rows.map((r) => {
                  const isExpanded = expandedOrderId === r.id;
                  return (
                    <React.Fragment key={r.id}>
                      <tr className="hover:bg-[#161927] transition">
                        <td className="p-3 font-mono font-bold text-cyan-400">{r.orderNum}</td>
                        <td className="p-3 text-gray-400 whitespace-nowrap">{r.date}</td>
                        <td className="p-3 font-semibold text-white">{r.customer}</td>
                        <td className="p-3">
                          <span
                            className={`px-2.5 py-1 rounded-md font-bold text-[11px] ${
                              r.ownership === WorkOwnershipType.PARTNER_1_PRIVATE
                                ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30'
                                : r.ownership === WorkOwnershipType.PARTNER_2_PRIVATE
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                                : 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                            }`}
                          >
                            {r.workLabel}
                          </span>
                        </td>
                        <td className="p-3 font-bold text-white">
                          {r.totalInvoice.toLocaleString('ar-EG')} {currencySymbol}
                        </td>
                        <td className="p-3 text-rose-400 font-semibold">
                          {r.partsCost.toLocaleString('ar-EG')} {currencySymbol}
                        </td>
                        <td className="p-3 font-extrabold text-cyan-300">
                          {r.netProfit.toLocaleString('ar-EG')} {currencySymbol}
                        </td>
                        <td className="p-3 font-black text-indigo-300 text-sm">
                          {r.ahmedShare.toLocaleString('ar-EG')} {currencySymbol}
                        </td>
                        <td className="p-3 font-black text-emerald-300 text-sm">
                          {r.abdoShare.toLocaleString('ar-EG')} {currencySymbol}
                        </td>
                        <td className="p-3 text-center">
                          <button
                            onClick={() => setExpandedOrderId(isExpanded ? null : r.id)}
                            className={`px-3 py-1 rounded-xl text-[11px] font-bold flex items-center justify-center gap-1 mx-auto transition cursor-pointer border ${
                              isExpanded
                                ? 'bg-cyan-500 text-slate-950 border-cyan-400 font-black'
                                : 'bg-[#181b2a] hover:bg-cyan-500/20 text-cyan-400 border-cyan-500/30'
                            }`}
                          >
                            <Box className="w-3.5 h-3.5" />
                            <span>عرض التفاصيل</span>
                            {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Sub-Row */}
                      {isExpanded && (
                        <tr className="bg-[#0e101a] border-y-2 border-cyan-500/30">
                          <td colSpan={10} className="p-4">
                            <div className="bg-[#151828] border border-[#2a2d42] rounded-xl p-3 space-y-2">
                              <div className="flex items-center justify-between border-b border-[#2a2d42] pb-2">
                                <span className="text-xs font-bold text-cyan-300 flex items-center gap-1.5">
                                  <Package className="w-4 h-4" />
                                  قطع الغيار المسحوبة للأوردر رقم #{r.orderNum}
                                </span>
                                <span className="text-[11px] text-gray-400 font-mono">
                                  إجمالي التكلفة: {r.partsCost.toLocaleString('ar-EG')} {currencySymbol}
                                </span>
                              </div>

                              {r.partsList.length > 0 ? (
                                <table className="w-full text-xs text-right text-gray-300">
                                  <thead className="bg-[#1c2035] text-gray-400 font-bold">
                                    <tr>
                                      <th className="p-2">اسم قطعة الغيار</th>
                                      <th className="p-2">الكمية المسحوبة</th>
                                      <th className="p-2">تكلفة الوحدة</th>
                                      <th className="p-2 text-rose-300">إجمالي التكلفة</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-[#2a2d42]">
                                    {r.partsList.map((p, pIdx) => (
                                      <tr key={pIdx} className="hover:bg-[#1a1e30]">
                                        <td className="p-2 font-semibold text-white">{p.partName}</td>
                                        <td className="p-2 font-bold text-cyan-300">{p.quantity}</td>
                                        <td className="p-2">{p.unitCost.toLocaleString('ar-EG')} {currencySymbol}</td>
                                        <td className="p-2 font-bold text-rose-400">
                                          {p.totalCost.toLocaleString('ar-EG')} {currencySymbol}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              ) : (
                                <p className="text-xs text-gray-500 py-2 text-center">
                                  لم يتم تسجيل قطع غيار مخصصة لهذا الأوردر (تكلفة البضاعة 0 ج.م)
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={10} className="p-8 text-center text-gray-500">
                    لا توجد أوردرات صيانة مطابقة للفلتر المحدد
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: AGGREGATED WITHDRAWN INVENTORY REPORT */}
      {isWithdrawnModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 dir-rtl text-right overflow-y-auto">
          <div className="bg-[#11131e] border border-[#2a2d42] rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-4 border-b border-[#2a2d42] flex items-center justify-between bg-[#141724]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-400">
                  <ShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    تقرير البضاعة المسحوبة التجميعي حسب نوع الصنف
                    <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                      {partyFilter === 'ALL' ? 'جميع الأطراف' : partyFilter === 'SHOP' ? 'شغل المحل' : partyFilter === 'AHMED' ? 'شغل أحمد' : 'شغل عبده'}
                    </span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    تقرير تجميعي يظهر كل صنف مسحوب مرة واحدة فقط مع مجموع الكميات المسحوبة والتكلفة الإجمالية
                  </p>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsWithdrawnModalOpen(false);
                  setSelectedItemForDetail(null);
                }}
                className="p-2 text-gray-400 hover:text-white bg-[#1a1d2d] hover:bg-[#25293e] rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Search Bar & Party Filter Indicator */}
            <div className="p-4 border-b border-[#2a2d42] bg-[#161928] flex flex-wrap items-center justify-between gap-3">
              <div className="relative flex-1 min-w-[240px]">
                <Search className="w-4 h-4 text-gray-400 absolute right-3 top-3" />
                <input
                  type="text"
                  placeholder="ابحث باسم الصنف، أو رقم الأوردر/الفاتورة..."
                  value={modalSearchQuery}
                  onChange={(e) => setModalSearchQuery(e.target.value)}
                  className="w-full bg-[#11131e] border border-[#2a2d42] text-white text-xs pr-9 pl-4 py-2.5 rounded-xl outline-none focus:border-rose-500/50"
                />
              </div>

              <div className="flex items-center gap-2 text-xs font-bold text-gray-300">
                <span>الطرف المختار:</span>
                <div className="flex bg-[#11131e] p-1 rounded-xl border border-[#2a2d42]">
                  <button
                    onClick={() => setPartyFilter('ALL')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      partyFilter === 'ALL' ? 'bg-rose-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    الكل
                  </button>
                  <button
                    onClick={() => setPartyFilter('SHOP')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      partyFilter === 'SHOP' ? 'bg-purple-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    المحل
                  </button>
                  <button
                    onClick={() => setPartyFilter('AHMED')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      partyFilter === 'AHMED' ? 'bg-cyan-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    أحمد
                  </button>
                  <button
                    onClick={() => setPartyFilter('ABDO')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                      partyFilter === 'ABDO' ? 'bg-amber-600 text-white' : 'text-gray-400 hover:text-white'
                    }`}
                  >
                    عبده
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Primary Aggregated Table Content */}
            <div className="overflow-y-auto flex-1 p-4">
              {(() => {
                const filteredAggregated = aggregatedItemsList.filter((item) => {
                  if (!modalSearchQuery.trim()) return true;
                  const query = modalSearchQuery.toLowerCase();
                  return (
                    item.partName.toLowerCase().includes(query) ||
                    item.records.some(
                      (r) =>
                        r.refNum.toLowerCase().includes(query) ||
                        r.customerName.toLowerCase().includes(query)
                    )
                  );
                });

                return (
                  <table className="w-full text-xs text-right text-gray-300 border-collapse">
                    <thead className="bg-[#181b2a] text-gray-400 font-semibold border-b border-[#2a2d42] sticky top-0">
                      <tr>
                        <th className="p-3">اسم الصنف</th>
                        <th className="p-3 text-center">إجمالي الكمية المسحوبة</th>
                        <th className="p-3">سعر التكلفة للوحدة</th>
                        <th className="p-3 text-rose-400 font-bold">إجمالي تكلفة الصنف</th>
                        <th className="p-3 text-center">التفاصيل والحركات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#1f2937]">
                      {filteredAggregated.length > 0 ? (
                        filteredAggregated.map((item, idx) => {
                          const hasMultipleCosts = item.minUnitCost !== item.maxUnitCost;
                          return (
                            <tr key={idx} className="hover:bg-[#161927] transition">
                              <td className="p-3 font-bold text-white flex items-center gap-2">
                                <Box className="w-4 h-4 text-rose-400 shrink-0" />
                                <span className="text-sm">{item.partName}</span>
                              </td>
                              <td className="p-3 font-extrabold text-cyan-300 text-center text-sm">
                                {item.totalQuantity} قطعة
                              </td>
                              <td className="p-3 text-gray-300">
                                {hasMultipleCosts ? (
                                  <span className="text-amber-300 font-medium">
                                    {item.minUnitCost.toLocaleString('ar-EG')} - {item.maxUnitCost.toLocaleString('ar-EG')} {currencySymbol} (متوسط: {item.avgUnitCost.toLocaleString('ar-EG')})
                                  </span>
                                ) : (
                                  <span>
                                    {item.minUnitCost.toLocaleString('ar-EG')} {currencySymbol}
                                  </span>
                                )}
                              </td>
                              <td className="p-3 font-black text-rose-300 text-sm">
                                {item.totalCost.toLocaleString('ar-EG')} {currencySymbol}
                              </td>
                              <td className="p-3 text-center">
                                <button
                                  onClick={() => setSelectedItemForDetail(item)}
                                  className="px-3 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-xl font-bold transition flex items-center gap-1.5 mx-auto cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>عرض الحركات ({item.records.length})</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      ) : (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-gray-500">
                            لا توجد أصناف بضاعة مسحوبة مطابقة للبحث أو الفلتر المختار
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                );
              })()}
            </div>

            {/* Modal Footer Summary */}
            <div className="p-4 border-t-2 border-[#2a2d42] bg-[#141724] flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="bg-[#1a1d2d] border border-[#2a2d42] px-3.5 py-2 rounded-xl">
                  <span className="text-[10px] text-gray-400 font-bold block">إجمالي عدد الأصناف:</span>
                  <span className="text-sm font-black text-white">
                    {aggregatedItemsList.length} صنف
                  </span>
                </div>

                <div className="bg-[#1a1d2d] border border-cyan-500/30 px-3.5 py-2 rounded-xl">
                  <span className="text-[10px] text-cyan-300 font-bold block">إجمالي عدد القطع:</span>
                  <span className="text-sm font-black text-cyan-300">
                    {totalWithdrawnQty} قطعة
                  </span>
                </div>

                <div className="bg-[#1a1d2d] border border-rose-500/30 px-3.5 py-2 rounded-xl">
                  <span className="text-[10px] text-rose-300 font-bold block">إجمالي تكلفة البضاعة:</span>
                  <span className="text-sm font-black text-rose-400">
                    {totalWithdrawnCost.toLocaleString('ar-EG')} {currencySymbol}
                  </span>
                </div>
              </div>

              <button
                onClick={() => {
                  setIsWithdrawnModalOpen(false);
                  setSelectedItemForDetail(null);
                }}
                className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                إغلاق التقرير
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SUB-MODAL: ITEM DRILL-DOWN TRANSACTIONS DETAIL */}
      {selectedItemForDetail && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-[60] flex items-center justify-center p-4 dir-rtl text-right overflow-y-auto">
          <div className="bg-[#11131e] border border-rose-500/40 rounded-2xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 border-b border-[#2a2d42] flex items-center justify-between bg-[#161828]">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-rose-500/20 border border-rose-500/40 rounded-xl text-rose-400">
                  <Box className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white flex items-center gap-2">
                    تفاصيل حركات الصنف: <span className="text-rose-400">{selectedItemForDetail.partName}</span>
                  </h3>
                  <p className="text-xs text-gray-400">
                    السجلات الفردية والفواتير التي تم سحب هذا الصنف لحسابها
                  </p>
                </div>
              </div>

              <button
                onClick={() => setSelectedItemForDetail(null)}
                className="p-2 text-gray-400 hover:text-white bg-[#1a1d2d] hover:bg-[#25293e] rounded-xl transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Summary badges */}
            <div className="p-3 bg-[#161928] border-b border-[#2a2d42] flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-3">
                <span className="bg-[#11131e] border border-[#2a2d42] px-3 py-1.5 rounded-xl text-gray-300 font-bold">
                  إجمالي الكمية: <strong className="text-cyan-300">{selectedItemForDetail.totalQuantity} قطعة</strong>
                </span>
                <span className="bg-[#11131e] border border-[#2a2d42] px-3 py-1.5 rounded-xl text-gray-300 font-bold">
                  إجمالي التكلفة: <strong className="text-rose-400">{selectedItemForDetail.totalCost.toLocaleString('ar-EG')} {currencySymbol}</strong>
                </span>
              </div>

              <div className="flex items-center gap-2 font-bold">
                <span className="text-gray-400">توزيع الأطراف:</span>
                <span className="px-2 py-0.5 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  المحل: {selectedItemForDetail.shopQty}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                  أحمد: {selectedItemForDetail.ahmedQty}
                </span>
                <span className="px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  عبده: {selectedItemForDetail.abdoQty}
                </span>
              </div>
            </div>

            {/* Transactions Table */}
            <div className="overflow-y-auto flex-1 p-4">
              <table className="w-full text-xs text-right text-gray-300 border-collapse">
                <thead className="bg-[#181b2a] text-gray-400 font-semibold border-b border-[#2a2d42] sticky top-0">
                  <tr>
                    <th className="p-3">رقم العملية / الفاتورة</th>
                    <th className="p-3">العميل</th>
                    <th className="p-3 text-center">الطرف المسؤول</th>
                    <th className="p-3 text-center">الكمية</th>
                    <th className="p-3">سعر التكلفة للوحدة</th>
                    <th className="p-3 text-rose-400 font-bold">إجمالي التكلفة</th>
                    <th className="p-3">التاريخ</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1f2937]">
                  {selectedItemForDetail.records.map((rec, rIdx) => (
                    <tr key={rec.id || rIdx} className="hover:bg-[#161927] transition">
                      <td className="p-3 font-mono font-bold text-indigo-300">
                        {rec.refNum}
                      </td>
                      <td className="p-3 font-semibold text-white">
                        {rec.customerName}
                      </td>
                      <td className="p-3 text-center">
                        <span
                          className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold border ${
                            rec.partyLabel === 'AHMED'
                              ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                              : rec.partyLabel === 'ABDO'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                          }`}
                        >
                          {rec.partyNameArabic}
                        </span>
                      </td>
                      <td className="p-3 font-extrabold text-cyan-300 text-center text-sm">
                        {rec.quantity}
                      </td>
                      <td className="p-3 text-gray-300">
                        {rec.unitCost.toLocaleString('ar-EG')} {currencySymbol}
                      </td>
                      <td className="p-3 font-black text-rose-300 text-sm">
                        {rec.totalCost.toLocaleString('ar-EG')} {currencySymbol}
                      </td>
                      <td className="p-3 text-gray-400 whitespace-nowrap">
                        {rec.date}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Sub-modal footer */}
            <div className="p-4 border-t border-[#2a2d42] bg-[#141724] flex items-center justify-end">
              <button
                onClick={() => setSelectedItemForDetail(null)}
                className="px-5 py-2 bg-[#25293e] hover:bg-[#323752] text-white font-bold text-xs rounded-xl transition cursor-pointer"
              >
                رجوع للقائمة التجميعية
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
