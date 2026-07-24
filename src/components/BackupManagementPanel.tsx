import React, { useState, useRef } from "react";
import {
  Database,
  Download,
  Upload,
  CheckCircle2,
  FileJson,
  HardDrive,
  RefreshCw,
  Layers,
  FileText,
  Users,
  Wrench,
  Package,
  Receipt,
  DollarSign,
  ShieldCheck,
  Calendar,
  Clock,
  AlertTriangle,
  XCircle,
  ShieldAlert,
  ArrowRight,
  CheckCircle
} from "lucide-react";
import { db } from "../lib/db";
import { useCurrentUser } from "../hooks/useData";
import { canResetOperationalData } from "../lib/authPermissions";
import { validateBackupFileStructure } from "../lib/backupRestoreTest";

export default function BackupManagementPanel() {
  const { user: currentUser } = useCurrentUser();
  const isOwnerUser = canResetOperationalData(currentUser);

  const [isExporting, setIsExporting] = useState(false);
  const [lastExportInfo, setLastExportInfo] = useState<{
    timestamp: string;
    filename: string;
    sizeKb: string;
    totalRecords: number;
  } | null>(null);

  // Restore Modal States
  const [isRestoreModalOpen, setIsRestoreModalOpen] = useState(false);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [backupPayload, setBackupPayload] = useState<any>(null);
  const [backupValidation, setBackupValidation] = useState<any>(null);
  const [restoreMode, setRestoreMode] = useState<"OPERATIONAL" | "FULL">("OPERATIONAL");
  const [confirmText, setConfirmText] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);

  // Execution & Progress States
  const [isRestoring, setIsRestoring] = useState(false);
  const [restoreProgress, setRestoreProgress] = useState(0);
  const [restoreStage, setRestoreStage] = useState("");
  const [restoreReport, setRestoreReport] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Gather current database stats
  const products = db.getProducts ? db.getProducts() : [];
  const categories = db.getCategories ? db.getCategories() : [];
  const customers = db.getCustomers ? db.getCustomers() : [];
  const suppliers = db.getSuppliers ? db.getSuppliers() : [];
  const repairOrders = db.getRepairOrders ? db.getRepairOrders() : [];
  const invoices = db.getInvoices ? db.getInvoices() : [];
  const expenses = db.getExpenses ? db.getExpenses() : [];
  const users = db.getUsers ? db.getUsers() : [];
  const settings = db.getSettings ? db.getSettings() : {};

  const restoreLogs = db.getSystemRestoreLogs ? db.getSystemRestoreLogs() : [];

  const totalRecordCount =
    products.length +
    categories.length +
    customers.length +
    suppliers.length +
    repairOrders.length +
    invoices.length +
    expenses.length +
    users.length;

  const handleDownloadBackup = () => {
    setIsExporting(true);

    setTimeout(() => {
      try {
        const backupData = {
          metadata: {
            app: "Atari Store Pro X",
            version: "2.0.0",
            exportedAt: new Date().toISOString(),
            exportedAtFormatted: new Date().toLocaleString("ar-EG"),
            totalRecords: totalRecordCount
          },
          products,
          categories,
          customers,
          suppliers,
          repairOrders,
          invoices,
          expenses,
          users,
          settings,
          inventoryMovements: db.getInventoryMovements ? db.getInventoryMovements() : [],
          journalEntries: db.getJournalEntries ? db.getJournalEntries() : [],
          resetSecurityLogs: db.getSystemResetSecurityLogs ? db.getSystemResetSecurityLogs() : []
        };

        const jsonString = JSON.stringify(backupData, null, 2);
        const blob = new Blob([jsonString], { type: "application/json;charset=utf-8;" });
        const sizeKb = (blob.size / 1024).toFixed(1);

        const now = new Date();
        const dateStr = now.toISOString().slice(0, 10);
        const timeStr = `${now.getHours()}-${now.getMinutes()}`;
        const filename = `atari_backup_${dateStr}_${timeStr}.json`;

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        setLastExportInfo({
          timestamp: new Date().toLocaleString("ar-EG"),
          filename,
          sizeKb: `${sizeKb} KB`,
          totalRecords: totalRecordCount
        });
      } catch (err) {
        console.error("Backup export failed:", err);
      } finally {
        setIsExporting(false);
      }
    }, 400);
  };

  const handleTriggerFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".json")) {
      alert("عذراً، يسمح فقط برفع ملفات النسخ الاحتياطية بصيغة JSON (.json)");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const valResult = validateBackupFileStructure(content);

      if (!valResult.valid) {
        alert(valResult.error || "الملف المحدد غير صالح كنسخة احتياطية لنظام Atari Store Pro X.");
        return;
      }

      setSelectedFileName(file.name);
      setBackupPayload(valResult.backupData);
      setBackupValidation(valResult);
      setValidationError(null);
      setConfirmText("");
      setRestoreReport(null);
      setIsRestoreModalOpen(true);
    };

    reader.readAsText(file);
  };

  const handleExecuteRestore = async () => {
    if (confirmText.trim() !== "RESTORE") {
      setValidationError("كلمة التأكيد غير صحيحة. يجب كتابة كلمة RESTORE بالإنجليزية تماماً.");
      return;
    }

    if (!isOwnerUser) {
      setValidationError("عذراً، عملية الاستعادة حساسة ومخصصة فقط لصاحب النظام (OWNER).");
      return;
    }

    setIsRestoring(true);
    setValidationError(null);
    setRestoreProgress(10);
    setRestoreStage("قراءة بنية الملف وتجهيز الخادم...");

    try {
      setTimeout(() => {
        setRestoreProgress(45);
        setRestoreStage("مسح البيانات القديمة وإعادة بناء الجداول المحاسبية...");
      }, 400);

      setTimeout(() => {
        setRestoreProgress(80);
        setRestoreStage("استيراد السجلات وتحديث الشاشات واللوحات...");
      }, 900);

      const res = await db.executeBackupRestoreAsync(
        backupPayload,
        restoreMode,
        selectedFileName,
        currentUser
      );

      setRestoreProgress(100);
      setRestoreStage("اكتملت الاستعادة بنجاح!");

      setTimeout(() => {
        setIsRestoring(false);
        if (res.success) {
          setRestoreReport(res);
        } else {
          setValidationError(res.error || "حدث خطأ غير متوقع أثناء استعادة البيانات.");
        }
      }, 400);
    } catch (err: any) {
      setIsRestoring(false);
      setValidationError(`فشلت العملية: ${err.message || String(err)}`);
    }
  };

  const handleFinalReloadSystem = () => {
    setIsRestoreModalOpen(false);
    window.location.reload();
  };

  return (
    <div className="space-y-6">
      <input
        type="file"
        ref={fileInputRef}
        accept=".json"
        onChange={handleFileChange}
        className="hidden"
      />

      {/* Header Banner */}
      <div className="bg-gradient-to-br from-indigo-950/60 via-purple-950/40 to-gray-950 border border-indigo-500/40 p-6 rounded-3xl space-y-4 shadow-xl relative overflow-hidden">
        <div className="flex flex-wrap justify-between items-center gap-4 border-b border-indigo-500/30 pb-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-500/20 text-indigo-400 rounded-2xl border border-indigo-500/40">
              <HardDrive className="w-8 h-8 text-indigo-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-white">النسخ الاحتياطي والاستعادة (Backup & Restore)</h2>
                <span className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] px-2.5 py-0.5 rounded-full font-bold">
                  حماية واستعادة شاملة
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-1">
                حفظ وإصدار نسخة احتياطية كاملة أو استعادة كافة سجلات البيانات والمعاملات من ملف JSON بحساب خادم PostgreSQL ذري.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={handleDownloadBackup}
              disabled={isExporting}
              className="bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white text-xs px-5 py-3 rounded-xl font-bold transition flex items-center gap-2 cursor-pointer shadow-lg shadow-indigo-950/50"
            >
              {isExporting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  جاري التصدير...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  تنزيل نسخة احتياطية (JSON)
                </>
              )}
            </button>

            <button
              onClick={handleTriggerFileSelect}
              className="bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs px-5 py-3 rounded-xl font-bold transition flex items-center gap-2 cursor-pointer shadow-lg shadow-amber-950/50"
            >
              <Upload className="w-4 h-4" />
              استعادة نسخة احتياطية
            </button>
          </div>
        </div>

        {/* Database Overview Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5 pt-2">
          <div className="bg-gray-950/80 p-3 rounded-xl border border-gray-800 text-center">
            <Package className="w-4 h-4 text-indigo-400 mx-auto mb-1" />
            <span className="text-[10px] text-gray-400 block">المنتجات</span>
            <strong className="text-xs text-white font-mono">{products.length}</strong>
          </div>
          <div className="bg-gray-950/80 p-3 rounded-xl border border-gray-800 text-center">
            <Layers className="w-4 h-4 text-purple-400 mx-auto mb-1" />
            <span className="text-[10px] text-gray-400 block">الأقسام</span>
            <strong className="text-xs text-white font-mono">{categories.length}</strong>
          </div>
          <div className="bg-gray-950/80 p-3 rounded-xl border border-gray-800 text-center">
            <Users className="w-4 h-4 text-blue-400 mx-auto mb-1" />
            <span className="text-[10px] text-gray-400 block">العملاء</span>
            <strong className="text-xs text-white font-mono">{customers.length}</strong>
          </div>
          <div className="bg-gray-950/80 p-3 rounded-xl border border-gray-800 text-center">
            <Wrench className="w-4 h-4 text-amber-400 mx-auto mb-1" />
            <span className="text-[10px] text-gray-400 block">الصيانة</span>
            <strong className="text-xs text-white font-mono">{repairOrders.length}</strong>
          </div>
          <div className="bg-gray-950/80 p-3 rounded-xl border border-gray-800 text-center">
            <Receipt className="w-4 h-4 text-emerald-400 mx-auto mb-1" />
            <span className="text-[10px] text-gray-400 block">الفواتير</span>
            <strong className="text-xs text-white font-mono">{invoices.length}</strong>
          </div>
          <div className="bg-gray-950/80 p-3 rounded-xl border border-gray-800 text-center">
            <DollarSign className="w-4 h-4 text-rose-400 mx-auto mb-1" />
            <span className="text-[10px] text-gray-400 block">المصروفات</span>
            <strong className="text-xs text-white font-mono">{expenses.length}</strong>
          </div>
          <div className="bg-gray-950/80 p-3 rounded-xl border border-gray-800 text-center">
            <Users className="w-4 h-4 text-cyan-400 mx-auto mb-1" />
            <span className="text-[10px] text-gray-400 block">المستخدمين</span>
            <strong className="text-xs text-white font-mono">{users.length}</strong>
          </div>
          <div className="bg-gray-950/80 p-3 rounded-xl border border-indigo-500/40 text-center bg-indigo-950/30">
            <Database className="w-4 h-4 text-indigo-300 mx-auto mb-1" />
            <span className="text-[10px] text-indigo-300 block">إجمالي السجلات</span>
            <strong className="text-xs text-indigo-200 font-mono">{totalRecordCount}</strong>
          </div>
        </div>
      </div>

      {/* Success Banner if exported in this session */}
      {lastExportInfo && (
        <div className="p-5 bg-emerald-950/40 border-2 border-emerald-500/60 rounded-2xl space-y-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/40">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-300">تم تنزيل النسخة الاحتياطية بنجاح</h3>
              <p className="text-xs text-emerald-200/80 mt-0.5">
                تم حفظ كافة جداول ومكونات النظام في ملف JSON آمن وتنزيله على جهازك.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs bg-gray-950 p-3.5 rounded-xl border border-gray-800">
            <div className="flex items-center gap-2">
              <FileJson className="w-4 h-4 text-indigo-400 shrink-0" />
              <div>
                <span className="text-gray-500 text-[10px] block">اسم الملف:</span>
                <span className="text-white font-mono font-bold">{lastExportInfo.filename}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-purple-400 shrink-0" />
              <div>
                <span className="text-gray-500 text-[10px] block">حجم الملف:</span>
                <span className="text-white font-mono font-bold">{lastExportInfo.sizeKb}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-emerald-400 shrink-0" />
              <div>
                <span className="text-gray-500 text-[10px] block">تاريخ التصدير:</span>
                <span className="text-white font-mono font-bold">{lastExportInfo.timestamp}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Restore History Logs Table */}
      {restoreLogs.length > 0 && (
        <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl space-y-3">
          <h3 className="text-xs font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-2">
            <ShieldCheck className="w-4 h-4 text-amber-400" />
            سجل عمليات استعادة النسخ الاحتياطية (System Restore Logs)
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs text-gray-300">
              <thead className="bg-gray-950 text-gray-400 border-b border-gray-800">
                <tr>
                  <th className="p-2.5">الملف</th>
                  <th className="p-2.5">المستخدم</th>
                  <th className="p-2.5">النوع</th>
                  <th className="p-2.5">التاريخ</th>
                  <th className="p-2.5">المدة</th>
                  <th className="p-2.5">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/60">
                {restoreLogs.slice(0, 5).map((log: any, idx: number) => (
                  <tr key={idx} className="hover:bg-gray-900/50">
                    <td className="p-2.5 font-mono text-indigo-300">{log.fileName}</td>
                    <td className="p-2.5 text-white">{log.executedByUserName}</td>
                    <td className="p-2.5">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${log.mode === "FULL" ? "bg-purple-950 text-purple-300 border border-purple-800" : "bg-blue-950 text-blue-300 border border-blue-800"}`}>
                        {log.mode === "FULL" ? "استعادة كاملة" : "بيانات تشغيل"}
                      </span>
                    </td>
                    <td className="p-2.5 text-gray-400 dir-ltr">{new Date(log.timestamp).toLocaleString("ar-EG")}</td>
                    <td className="p-2.5 font-mono text-amber-300">{log.durationMs}ms</td>
                    <td className="p-2.5">
                      <span className="text-emerald-400 font-bold flex items-center gap-1 text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> ناجحة
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Backup Details & Guidelines */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl space-y-3">
          <h3 className="text-xs font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            محتويات ملف النسخة الاحتياطية (JSON):
          </h3>
          <ul className="space-y-2 text-xs text-gray-300">
            <li className="flex items-center justify-between bg-gray-950 p-2.5 rounded-xl border border-gray-800/80">
              <span className="flex items-center gap-2">
                <Package className="w-3.5 h-3.5 text-indigo-400" /> الأصناف والمنتجات والتصنيفات
              </span>
              <span className="text-emerald-400 font-bold text-[11px]">مكتمل</span>
            </li>
            <li className="flex items-center justify-between bg-gray-950 p-2.5 rounded-xl border border-gray-800/80">
              <span className="flex items-center gap-2">
                <Wrench className="w-3.5 h-3.5 text-amber-400" /> أمر الصيانة والأجهزة
              </span>
              <span className="text-emerald-400 font-bold text-[11px]">مكتمل</span>
            </li>
            <li className="flex items-center justify-between bg-gray-950 p-2.5 rounded-xl border border-gray-800/80">
              <span className="flex items-center gap-2">
                <Receipt className="w-3.5 h-3.5 text-emerald-400" /> الفواتير والمدفوعات والمصروفات
              </span>
              <span className="text-emerald-400 font-bold text-[11px]">مكتمل</span>
            </li>
            <li className="flex items-center justify-between bg-gray-950 p-2.5 rounded-xl border border-gray-800/80">
              <span className="flex items-center gap-2">
                <Users className="w-3.5 h-3.5 text-blue-400" /> سجلات العملاء والموردين والمستخدمين
              </span>
              <span className="text-emerald-400 font-bold text-[11px]">مكتمل</span>
            </li>
            <li className="flex items-center justify-between bg-gray-950 p-2.5 rounded-xl border border-gray-800/80">
              <span className="flex items-center gap-2">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" /> إعدادات الورشة والقيود المحاسبية
              </span>
              <span className="text-emerald-400 font-bold text-[11px]">مكتمل</span>
            </li>
          </ul>
        </div>

        <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl space-y-3">
          <h3 className="text-xs font-bold text-white flex items-center gap-2 border-b border-gray-800 pb-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            إرشادات حماية واستعادة النسخ الاحتياطية:
          </h3>
          <div className="space-y-2.5 text-xs text-gray-300 leading-relaxed">
            <div className="p-3 bg-gray-950 rounded-xl border border-gray-800/80 space-y-1">
              <strong className="text-indigo-300 block font-bold">1. الحفظ الأسبوعي والشهري:</strong>
              <p className="text-[11px] text-gray-400">
                ينصح بإجراء تنزيل دوري لملف النسخة الاحتياطية وحفظه في وحدة تخزين خارجية أو سحابية آمنة.
              </p>
            </div>
            <div className="p-3 bg-gray-950 rounded-xl border border-gray-800/80 space-y-1">
              <strong className="text-amber-300 block font-bold">2. عملية الاستعادة ذرية (Atomic Transaction):</strong>
              <p className="text-[11px] text-gray-400">
                يتم استيراد البيانات عبر PostgreSQL RPC في معاملة واحدة. أي خطأ يلغي الاستعادة بالكامل تلقائياً (Rollback).
              </p>
            </div>
            <div className="p-3 bg-gray-950 rounded-xl border border-gray-800/80 space-y-1">
              <strong className="text-emerald-300 block font-bold">3. صلاحية المالك (OWNER):</strong>
              <p className="text-[11px] text-gray-400">
                الاستعادة عملية رئيسية متاحة فقط للمستخدم ذو صلاحية صاحب النظام (OWNER) وتتطلب كتابة كلمة التأكيد RESTORE.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* RESTORE REVIEW MODAL */}
      {isRestoreModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border-2 border-amber-500/60 rounded-3xl p-6 max-w-2xl w-full space-y-5 shadow-2xl relative overflow-hidden text-right max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-gray-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-amber-500/20 text-amber-400 rounded-xl border border-amber-500/40">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">مراجعة واستعادة النسخة الاحتياطية (Restore Review)</h3>
                  <p className="text-xs text-gray-400 mt-0.5">فحص البنية واختيار نطاق الاستعادة قبل البدء</p>
                </div>
              </div>

              {!isRestoring && (
                <button
                  onClick={() => setIsRestoreModalOpen(false)}
                  className="p-1 text-gray-400 hover:text-white rounded-lg transition cursor-pointer"
                >
                  <XCircle className="w-6 h-6" />
                </button>
              )}
            </div>

            {/* If Restore Report Ready */}
            {restoreReport ? (
              <div className="space-y-5 py-2">
                <div className="p-4 bg-emerald-950/60 border-2 border-emerald-500/80 rounded-2xl space-y-2">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-8 h-8 text-emerald-400 shrink-0" />
                    <div>
                      <h4 className="text-sm font-bold text-emerald-300">تمت استعادة البيانات وتصحيح الجداول بنجاح!</h4>
                      <p className="text-xs text-emerald-200/80">
                        استغرقت العملية {restoreReport.executionTimeMs} ملي ثانية وتم تحديث كافة السجلات والشاشات الحية.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                  <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 text-center">
                    <span className="text-gray-400 block text-[10px]">المنتجات</span>
                    <strong className="text-white font-mono text-sm">{restoreReport.restoredCounts?.products || 0}</strong>
                  </div>
                  <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 text-center">
                    <span className="text-gray-400 block text-[10px]">العملاء</span>
                    <strong className="text-white font-mono text-sm">{restoreReport.restoredCounts?.customers || 0}</strong>
                  </div>
                  <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 text-center">
                    <span className="text-gray-400 block text-[10px]">الفواتير</span>
                    <strong className="text-white font-mono text-sm">{restoreReport.restoredCounts?.invoices || 0}</strong>
                  </div>
                  <div className="bg-gray-950 p-3 rounded-xl border border-gray-800 text-center">
                    <span className="text-gray-400 block text-[10px]">أوامر الصيانة</span>
                    <strong className="text-white font-mono text-sm">{restoreReport.restoredCounts?.repairOrders || 0}</strong>
                  </div>
                </div>

                <button
                  onClick={handleFinalReloadSystem}
                  className="w-full py-3.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-500 hover:to-emerald-600 text-white rounded-xl font-bold text-xs transition shadow-lg shadow-emerald-950/50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  إعادة تحميل وتحديث النظام الآن
                </button>
              </div>
            ) : (
              <>
                {/* Backup File Info Card */}
                <div className="bg-gray-950 p-4 rounded-2xl border border-gray-800 space-y-3">
                  <div className="flex justify-between items-center text-xs border-b border-gray-800/80 pb-2">
                    <span className="text-gray-400 flex items-center gap-1.5">
                      <FileJson className="w-4 h-4 text-indigo-400" /> اسم الملف:
                    </span>
                    <span className="text-white font-mono font-bold">{selectedFileName}</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500 text-[10px] block">تاريخ النسخة:</span>
                      <span className="text-gray-200 font-mono font-bold">{backupValidation?.summary?.exportDate}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[10px] block">الإصدار:</span>
                      <span className="text-gray-200 font-mono font-bold">{backupValidation?.summary?.version}</span>
                    </div>
                    <div>
                      <span className="text-gray-500 text-[10px] block">إجمالي العناصر:</span>
                      <span className="text-indigo-300 font-mono font-bold">
                        {(backupValidation?.summary?.productsCount || 0) +
                          (backupValidation?.summary?.customersCount || 0) +
                          (backupValidation?.summary?.invoicesCount || 0) +
                          (backupValidation?.summary?.repairOrdersCount || 0) +
                          (backupValidation?.summary?.expensesCount || 0)} سجل
                      </span>
                    </div>
                  </div>
                </div>

                {/* Summary Record Counts Grid */}
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 text-xs">
                  <div className="bg-gray-950/80 p-2.5 rounded-xl border border-gray-800/80 text-center">
                    <span className="text-[10px] text-gray-400 block">المنتجات</span>
                    <strong className="text-xs text-indigo-300 font-mono">{backupValidation?.summary?.productsCount}</strong>
                  </div>
                  <div className="bg-gray-950/80 p-2.5 rounded-xl border border-gray-800/80 text-center">
                    <span className="text-[10px] text-gray-400 block">الأقسام</span>
                    <strong className="text-xs text-purple-300 font-mono">{backupValidation?.summary?.categoriesCount}</strong>
                  </div>
                  <div className="bg-gray-950/80 p-2.5 rounded-xl border border-gray-800/80 text-center">
                    <span className="text-[10px] text-gray-400 block">العملاء</span>
                    <strong className="text-xs text-blue-300 font-mono">{backupValidation?.summary?.customersCount}</strong>
                  </div>
                  <div className="bg-gray-950/80 p-2.5 rounded-xl border border-gray-800/80 text-center">
                    <span className="text-[10px] text-gray-400 block">الفواتير</span>
                    <strong className="text-xs text-emerald-300 font-mono">{backupValidation?.summary?.invoicesCount}</strong>
                  </div>
                  <div className="bg-gray-950/80 p-2.5 rounded-xl border border-gray-800/80 text-center">
                    <span className="text-[10px] text-gray-400 block">الصيانة</span>
                    <strong className="text-xs text-amber-300 font-mono">{backupValidation?.summary?.repairOrdersCount}</strong>
                  </div>
                  <div className="bg-gray-950/80 p-2.5 rounded-xl border border-gray-800/80 text-center">
                    <span className="text-[10px] text-gray-400 block">المصروفات</span>
                    <strong className="text-xs text-rose-300 font-mono">{backupValidation?.summary?.expensesCount}</strong>
                  </div>
                </div>

                {/* Version Warning Banner */}
                {backupValidation?.versionWarning && (
                  <div className="p-3 bg-amber-950/40 border border-amber-500/50 rounded-xl text-amber-300 text-xs flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{backupValidation.versionWarning}</span>
                  </div>
                )}

                {/* Restore Mode Options */}
                <div className="space-y-2">
                  <label className="text-xs font-bold text-gray-300 block">اختر خيار الاستعادة المناسب:</label>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div
                      onClick={() => setRestoreMode("OPERATIONAL")}
                      className={`p-3.5 rounded-2xl border-2 cursor-pointer transition space-y-1.5 ${restoreMode === "OPERATIONAL" ? "bg-amber-950/30 border-amber-500" : "bg-gray-950 border-gray-800 hover:border-gray-700"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">1. استعادة بيانات التشغيل فقط</span>
                        <input
                          type="radio"
                          name="restoreMode"
                          checked={restoreMode === "OPERATIONAL"}
                          onChange={() => setRestoreMode("OPERATIONAL")}
                          className="accent-amber-500"
                        />
                      </div>
                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        يستعيد العملاء، الموردين، الفواتير، الصيانة، والمصروفات. ويحافظ بالكامل على المنتجات والأقسام والمستخدمين القائمة.
                      </p>
                    </div>

                    <div
                      onClick={() => setRestoreMode("FULL")}
                      className={`p-3.5 rounded-2xl border-2 cursor-pointer transition space-y-1.5 ${restoreMode === "FULL" ? "bg-rose-950/30 border-rose-500" : "bg-gray-950 border-gray-800 hover:border-gray-700"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">2. استعادة كاملة (Full Restore)</span>
                        <input
                          type="radio"
                          name="restoreMode"
                          checked={restoreMode === "FULL"}
                          onChange={() => setRestoreMode("FULL")}
                          className="accent-rose-500"
                        />
                      </div>
                      <p className="text-[11px] text-gray-400 leading-relaxed">
                        يستعيد كل شيء بالكامل بما فيها قائمة المنتجات والتصنيفات والإعدادات والمستخدمين من ملف النسخة الاحتياطية.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Security Confirmation Section */}
                <div className="p-4 bg-gray-950 border border-gray-800 rounded-2xl space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-400">
                    <ShieldAlert className="w-4 h-4" />
                    تأكيد الأمان والموافقة النهائية
                  </div>

                  {!isOwnerUser ? (
                    <div className="p-3 bg-rose-950/40 border border-rose-500/60 rounded-xl text-rose-300 text-xs">
                      عذراً، عملية الاستعادة غير متاحة لحسابك. يجب تسجيل الدخول بحساب مالك النظام (OWNER).
                    </div>
                  ) : (
                    <div className="space-y-2 text-xs">
                      <p className="text-gray-300">
                        للبدء في الاستعادة عبر PostgreSQL RPC، يرجى كتابة الكلمة:{" "}
                        <span className="text-amber-400 font-mono font-bold">RESTORE</span>
                      </p>
                      <input
                        type="text"
                        value={confirmText}
                        onChange={(e) => setConfirmText(e.target.value)}
                        placeholder="اكتب RESTORE هنا"
                        disabled={isRestoring}
                        className="w-full bg-gray-900 border border-gray-700 rounded-xl px-3.5 py-2.5 text-white font-mono text-xs focus:outline-none focus:border-amber-500"
                      />
                    </div>
                  )}

                  {validationError && (
                    <div className="p-2.5 bg-rose-950/60 border border-rose-500/60 rounded-xl text-rose-300 text-xs flex items-center gap-2">
                      <XCircle className="w-4 h-4 shrink-0 text-rose-400" />
                      <span>{validationError}</span>
                    </div>
                  )}
                </div>

                {/* Progress Bar Display when Restoring */}
                {isRestoring && (
                  <div className="space-y-2 p-3 bg-amber-950/30 border border-amber-500/40 rounded-2xl">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-amber-300 font-bold">{restoreStage}</span>
                      <span className="text-amber-400 font-mono font-bold">{restoreProgress}%</span>
                    </div>
                    <div className="w-full bg-gray-950 rounded-full h-2.5 overflow-hidden border border-gray-800">
                      <div
                        className="bg-gradient-to-r from-amber-500 to-amber-400 h-2.5 rounded-full transition-all duration-300"
                        style={{ width: `${restoreProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-gray-800">
                  <button
                    onClick={() => setIsRestoreModalOpen(false)}
                    disabled={isRestoring}
                    className="px-5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs rounded-xl font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    إلغاء
                  </button>

                  <button
                    onClick={handleExecuteRestore}
                    disabled={isRestoring || !isOwnerUser || confirmText.trim() !== "RESTORE"}
                    className="px-6 py-2.5 bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs rounded-xl font-bold transition shadow-lg shadow-amber-950/50 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {isRestoring ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        جاري التنفيذ...
                      </>
                    ) : (
                      <>
                        <Upload className="w-4 h-4" />
                        بدء استعادة النسخة الاحتياطية
                      </>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
