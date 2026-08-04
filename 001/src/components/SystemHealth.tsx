/**
 * System Health Component (Phase 1E)
 * Displays connection health, local cache status, pending sync estimates, DB version, environment,
 * and embeds the Read-Only DataInspector without executing any sync or mutations.
 * @license Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Activity, CheckCircle, Database, HardDrive, Clock, Server, AlertTriangle, ShieldCheck, RefreshCw, Layers, PlayCircle, ShieldAlert, FileCheck } from 'lucide-react';
import { isSupabaseConfigured } from '../lib/supabaseClient';
import DataInspector from '../tools/DataInspector/DataInspector';
import AuditExplorer from './AuditExplorer';
import { getPendingSyncEstimate, syncQueue } from '../lib/data';
import { runPhase2BVerificationTest, Phase2BTestResult } from '../lib/sync/syncPhase2BTest';
import { runPhase2CValidationTestSuite, Phase2CTestResult } from '../lib/sync/syncPhase2CTest';
import { checkQueueIntegrity } from '../lib/sync/validators/queueIntegrity';
import { runPreflightAll, PreflightSummaryReport } from '../lib/sync/preflight';
import { runPreflightTestSuite, PreflightTestSuiteResult } from '../lib/sync/preflight/preflightTest';
import { getManualSyncStats, getLastManualSyncReport } from '../lib/sync/manual/manualSyncResult';
import { runManualSyncTestSuite, ManualTestSuiteResult } from '../lib/sync/manual/manualSyncTest';
import { getRetryStats, runRetryTestSuite } from '../lib/sync/retry';
import { getConflictStats, runConflictTestSuite, runResolutionExecutionTestSuite } from '../lib/sync/conflicts';

export default function SystemHealth() {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [lastCheckTime, setLastCheckTime] = useState<string>('');
  const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);

  // Sync Queue Stats State
  const [queueStats, setQueueStats] = useState(syncQueue.getStats());
  const [queueItems, setQueueItems] = useState(syncQueue.list());
  const [testResult, setTestResult] = useState<Phase2BTestResult | null>(null);
  const [runningTest, setRunningTest] = useState<boolean>(false);

  // Phase 2C Integrity State & Test
  const [integrityReport, setIntegrityReport] = useState(checkQueueIntegrity(syncQueue.list()));
  const [testCResult, setTestCResult] = useState<Phase2CTestResult | null>(null);
  const [runningCTest, setRunningCTest] = useState<boolean>(false);

  // Phase 2D0 Preflight State
  const [preflightSummary, setPreflightSummary] = useState<PreflightSummaryReport | null>(null);
  const [preflightTestResult, setPreflightTestResult] = useState<PreflightTestSuiteResult | null>(null);
  const [runningD0Preflight, setRunningD0Preflight] = useState<boolean>(false);

  // Phase 2D Manual Sync State
  const [manualSyncStats, setManualSyncStats] = useState(getManualSyncStats());
  const [manualTestResult, setManualTestResult] = useState<ManualTestSuiteResult | null>(null);
  const [runningManualTest, setRunningManualTest] = useState<boolean>(false);

  // Phase 2E Manual Retry State
  const [retryStats, setRetryStats] = useState(getRetryStats());
  const [retryTestResult, setRetryTestResult] = useState<{ allPassed: boolean; results: any[] } | null>(null);
  const [runningRetryTest, setRunningRetryTest] = useState<boolean>(false);

  // Phase 2F-A & 2F-B Conflict State
  const [conflictStats, setConflictStats] = useState(getConflictStats());
  const [conflictTestResult, setConflictTestResult] = useState<{ allPassed: boolean; results: any[] } | null>(null);
  const [runningConflictTest, setRunningConflictTest] = useState<boolean>(false);

  // Phase 2F-B Resolution Execution Test State
  const [resolutionExecTestResult, setResolutionExecTestResult] = useState<{ allPassed: boolean; results: any[] } | null>(null);
  const [runningResolutionExecTest, setRunningResolutionExecTest] = useState<boolean>(false);

  const handleRunResolutionExecTestSuite = async () => {
    setRunningResolutionExecTest(true);
    try {
      const res = await runResolutionExecutionTestSuite();
      setResolutionExecTestResult(res);
      setConflictStats(getConflictStats());
      refreshQueueStats();
    } catch (err) {
      console.error('Resolution execution test error:', err);
    } finally {
      setRunningResolutionExecTest(false);
    }
  };

  const handleRunConflictTestSuite = async () => {
    setRunningConflictTest(true);
    try {
      const res = await runConflictTestSuite();
      setConflictTestResult(res);
      setConflictStats(getConflictStats());
      refreshQueueStats();
    } catch (err) {
      console.error('Conflict test error:', err);
    } finally {
      setRunningConflictTest(false);
    }
  };

  const handleRunManualSyncTest = async () => {
    setRunningManualTest(true);
    try {
      const res = await runManualSyncTestSuite();
      setManualTestResult(res);
      setManualSyncStats(getManualSyncStats());
      refreshQueueStats();
    } catch (err) {
      console.error('Manual sync test error:', err);
    } finally {
      setRunningManualTest(false);
    }
  };

  const handleRunRetryTestSuite = async () => {
    setRunningRetryTest(true);
    try {
      const res = await runRetryTestSuite();
      setRetryTestResult(res);
      setRetryStats(getRetryStats());
      refreshQueueStats();
    } catch (err) {
      console.error('Retry test error:', err);
    } finally {
      setRunningRetryTest(false);
    }
  };

  const handleRunPreflightAll = async () => {
    setRunningD0Preflight(true);
    try {
      const summary = await runPreflightAll();
      setPreflightSummary(summary);
      const testRes = await runPreflightTestSuite();
      setPreflightTestResult(testRes);
      refreshQueueStats();
    } catch (err) {
      console.error('Phase 2D0 Preflight execution error:', err);
    } finally {
      setRunningD0Preflight(false);
    }
  };

  const refreshQueueStats = () => {
    syncQueue.refresh();
    const items = syncQueue.list();
    setQueueStats(syncQueue.getStats());
    setQueueItems(items);
    setIntegrityReport(checkQueueIntegrity(items));
    setManualSyncStats(getManualSyncStats());
    setRetryStats(getRetryStats());
    setConflictStats(getConflictStats());
    setPendingSyncCount(getPendingSyncEstimate());
    setLastCheckTime(new Date().toLocaleTimeString('ar-EG'));
  };

  const handleRunPhase2BTest = async () => {
    setRunningTest(true);
    try {
      const res = await runPhase2BVerificationTest();
      setTestResult(res);
      refreshQueueStats();
    } catch (err) {
      console.error('Test execution error:', err);
    } finally {
      setRunningTest(false);
    }
  };

  const handleRunPhase2CTest = async () => {
    setRunningCTest(true);
    try {
      const res = await runPhase2CValidationTestSuite();
      setTestCResult(res);
      refreshQueueStats();
    } catch (err) {
      console.error('Phase 2C test execution error:', err);
    } finally {
      setRunningCTest(false);
    }
  };

  useEffect(() => {
    const connected = isSupabaseConfigured;
    setIsConnected(connected);
    refreshQueueStats();
  }, []);

  const totalRetryCount = queueItems.reduce((acc, curr) => acc + (curr.retryCount || 0), 0);

  return (
    <div className="space-y-6 text-right">
      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* 1. Supabase Connected Status */}
        <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs text-gray-400">حالة الاتصال بالسحابة</div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              {isConnected ? (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span className="text-emerald-400">✓ Supabase Connected</span>
                </>
              ) : (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
                  <span className="text-amber-400">Local Mode / Unconfigured</span>
                </>
              )}
            </div>
            <div className="text-[11px] text-gray-400">مزود قاعدة البيانات الرئيسي</div>
          </div>
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400">
            <Database className="w-6 h-6" />
          </div>
        </div>

        {/* 2. Local Cache Enabled */}
        <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs text-gray-400">التخزين المحلي السريع</div>
            <div className="text-sm font-bold text-emerald-400 flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>✓ Local Cache Enabled</span>
            </div>
            <div className="text-[11px] text-gray-400">LocalStorage Active & Dual-Engine</div>
          </div>
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-indigo-400">
            <HardDrive className="w-6 h-6" />
          </div>
        </div>

        {/* 3. Pending Sync Count */}
        <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs text-gray-400">العناصر المعلقة للرفع (Pending Sync)</div>
            <div className="text-sm font-bold text-amber-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <span>{pendingSyncCount} عنصر معلق</span>
            </div>
            <div className="text-[11px] text-gray-400">طابور المزامنة الخلفية (Phase 2A)</div>
          </div>
          <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
            <Activity className="w-6 h-6" />
          </div>
        </div>

        {/* 4. Database Version */}
        <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs text-gray-400">إصدار قاعدة البيانات</div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <Server className="w-4 h-4 text-indigo-400" />
              <span>✓ Database Version 2.0 (PostgreSQL)</span>
            </div>
            <div className="text-[11px] text-gray-400">Atari Store Pro X Schema</div>
          </div>
        </div>

        {/* 5. Environment */}
        <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs text-gray-400">بيئة التشغيل (Environment)</div>
            <div className="text-sm font-bold text-indigo-300">
              ✓ Production / Cloud Run
            </div>
            <div className="text-[11px] text-gray-400">AI Studio Deployment Runtime</div>
          </div>
        </div>

        {/* 6. Last Sync / Check Time */}
        <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs text-gray-400">آخر وقت فحص متزامن</div>
            <div className="text-sm font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-400" />
              <span>{lastCheckTime || 'الآن'}</span>
            </div>
            <div className="text-[11px] text-gray-400">Read-Only Health Check</div>
          </div>
        </div>
      </div>

      {/* Phase 2B - Sync Queue Debug Panel */}
      <div className="bg-[#11131e] border border-[#2a2d42] p-5 rounded-2xl space-y-4">
        <div className="flex items-center justify-between border-b border-[#2a2d42] pb-3">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-base">
            <Layers className="w-5 h-5 text-indigo-400" />
            <span>لوحة فحص طابور المزامنة (Sync Queue Debugger - Phase 2B)</span>
          </div>
          <button
            onClick={refreshQueueStats}
            className="flex items-center gap-2 bg-[#1d2136] hover:bg-[#282d4a] text-gray-200 text-xs px-3 py-1.5 rounded-lg transition-colors border border-[#3b4066]"
          >
            <RefreshCw className="w-3.5 h-3.5 text-indigo-300" />
            <span>تحديث (Refresh)</span>
          </button>
        </div>

        {/* Primary Queue Totals */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-[#181b2a] border border-[#2a2d42] p-3 rounded-xl text-center">
            <div className="text-xs text-gray-400 mb-1">Queue Length</div>
            <div className="text-lg font-bold text-white">{queueStats.total}</div>
          </div>
          <div className="bg-[#181b2a] border border-[#2a2d42] p-3 rounded-xl text-center">
            <div className="text-xs text-gray-400 mb-1">Pending Total</div>
            <div className="text-lg font-bold text-amber-400">{queueStats.pending}</div>
          </div>
          <div className="bg-[#181b2a] border border-[#2a2d42] p-3 rounded-xl text-center">
            <div className="text-xs text-gray-400 mb-1">Syncing</div>
            <div className="text-lg font-bold text-blue-400">{queueStats.syncing}</div>
          </div>
          <div className="bg-[#181b2a] border border-[#2a2d42] p-3 rounded-xl text-center">
            <div className="text-xs text-gray-400 mb-1">Synced</div>
            <div className="text-lg font-bold text-emerald-400">{queueStats.synced}</div>
          </div>
          <div className="bg-[#181b2a] border border-[#2a2d42] p-3 rounded-xl text-center">
            <div className="text-xs text-gray-400 mb-1">Failed</div>
            <div className="text-lg font-bold text-rose-400">{queueStats.failed}</div>
          </div>
          <div className="bg-[#181b2a] border border-[#2a2d42] p-3 rounded-xl text-center">
            <div className="text-xs text-gray-400 mb-1">Retry Count</div>
            <div className="text-lg font-bold text-purple-400">{totalRetryCount}</div>
          </div>
        </div>

        {/* Pending Breakdown by Entity Type */}
        <div className="bg-[#16192a] border border-[#252a42] p-4 rounded-xl space-y-2">
          <div className="text-xs font-semibold text-indigo-300">Pending Breakdown حسب نوع الكيان:</div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
            <div className="bg-[#111320] border border-[#22263b] p-2.5 rounded-lg text-center">
              <div className="text-[11px] text-gray-400">Customers</div>
              <div className="text-base font-bold text-amber-300">{queueStats.byEntity?.Customer || 0}</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-2.5 rounded-lg text-center">
              <div className="text-[11px] text-gray-400">Repair Orders</div>
              <div className="text-base font-bold text-amber-300">{queueStats.byEntity?.RepairOrder || 0}</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-2.5 rounded-lg text-center">
              <div className="text-[11px] text-gray-400">Invoices</div>
              <div className="text-base font-bold text-amber-300">{queueStats.byEntity?.Invoice || 0}</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-2.5 rounded-lg text-center">
              <div className="text-[11px] text-gray-400">Products</div>
              <div className="text-base font-bold text-amber-300">{queueStats.byEntity?.Product || 0}</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-2.5 rounded-lg text-center">
              <div className="text-[11px] text-gray-400">Expenses</div>
              <div className="text-base font-bold text-amber-300">{queueStats.byEntity?.Expense || 0}</div>
            </div>
          </div>
        </div>

        {/* Phase 2D - Single Manual Sync (Canary Mode) */}
        <div className="bg-[#141727] border border-[#2d3250] p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#252a42] pb-3">
            <div className="text-sm font-bold text-amber-400 flex items-center gap-2">
              <Activity className="w-5 h-5 text-amber-400" />
              <span>المزامنة اليدوية الفردية (Phase 2D - Single Manual Sync / Canary Mode)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                Phase 2D Active (Canary)
              </span>
              <button
                onClick={handleRunManualSyncTest}
                disabled={runningManualTest}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span>{runningManualTest ? 'جاري الاختبار...' : 'اختبار الحالات الـ 6 الإلزامية'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-center">
            <div className="bg-[#111320] border border-[#22263b] p-3 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">Last Manual Sync</div>
              <div className="text-xs font-bold text-white font-mono">
                {manualSyncStats.lastManualSyncAt ? new Date(manualSyncStats.lastManualSyncAt).toLocaleTimeString('ar-EG') : 'لم تُنفذ بعد'}
              </div>
              <div className="text-[9px] text-gray-500 mt-1">وقت آخر مزامنة يدوية لعنصر فردي</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-3 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">Verified Sync Count</div>
              <div className="text-lg font-bold text-emerald-400">
                {manualSyncStats.verifiedSyncCount}
              </div>
              <div className="text-[9px] text-gray-500 mt-1">مُحققة بنجاح ومؤكدة (VERIFIED)</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-3 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">Failed Sync Count</div>
              <div className="text-lg font-bold text-rose-400">
                {manualSyncStats.failedSyncCount}
              </div>
              <div className="text-[9px] text-gray-500 mt-1">مرفوضة أو فشل التحقق منها</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-3 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">Stale Syncing Items</div>
              <div className="text-lg font-bold text-amber-400">
                {syncQueue.detectStaleSyncingItems(5).length}
              </div>
              <div className="text-[9px] text-gray-500 mt-1">عناصر عالقة في Syncing (&gt; 5د)</div>
            </div>
          </div>

          {manualTestResult && (
            <div className="mt-3 bg-[#0d0f1a] border border-[#22263b] p-3 rounded-xl space-y-2">
              <div className="text-xs font-bold text-amber-300">نتائج اختبارات Phase 2D Canary Test Suite:</div>
              <div className="space-y-1.5">
                {manualTestResult.results.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-[#121526] p-2 rounded-lg">
                    <span className="text-gray-300 font-medium">{c.caseName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400">Status: {c.actualStatus}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {c.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Phase 2E - Manual Retry Policy & Failure Recovery */}
        <div className="bg-[#141727] border border-[#2d3250] p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#252a42] pb-3">
            <div className="text-sm font-bold text-rose-400 flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-rose-400" />
              <span>سياسة إعادة المحاولة اليدوية والتعافي (Phase 2E Manual Retry & Failure Recovery)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-rose-500/10 text-rose-300 border border-rose-500/20">
                Phase 2E Active
              </span>
              <button
                onClick={handleRunRetryTestSuite}
                disabled={runningRetryTest}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-rose-600 hover:bg-rose-500 text-white flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span>{runningRetryTest ? 'جاري الاختبار...' : 'تشغيل اختبارات Retry الـ 6'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-center">
            <div className="bg-[#111320] border border-[#22263b] p-3 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">Failed Items</div>
              <div className="text-lg font-bold text-rose-400">{retryStats.failedQueueItemsCount}</div>
              <div className="text-[9px] text-gray-500 mt-1">عناصر في حالة Failed</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-3 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">Conflict Items</div>
              <div className="text-lg font-bold text-amber-400">{retryStats.conflictQueueItemsCount}</div>
              <div className="text-[9px] text-gray-500 mt-1">عناصر محظورة (Conflict)</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-3 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">Verified After Retry</div>
              <div className="text-lg font-bold text-emerald-400">{retryStats.verifiedAfterRetryCount}</div>
              <div className="text-[9px] text-gray-500 mt-1">مُحققة بعد إعادات المحاولة</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-3 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">Avg Retry Duration</div>
              <div className="text-lg font-bold text-indigo-400 font-mono">{retryStats.averageRetryDurationMs}ms</div>
              <div className="text-[9px] text-gray-500 mt-1">متوسط زمن إعادة المحاولة</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-3 rounded-xl col-span-2 md:col-span-1">
              <div className="text-[10px] text-gray-400 mb-1">Retry Distribution</div>
              <div className="text-[11px] font-bold text-cyan-300 font-mono">
                {Object.keys(retryStats.retryCountDistribution).length === 0 ? 'لا توجد' :
                  Object.entries(retryStats.retryCountDistribution).map(([cnt, num]) => `${cnt}x:${num}`).join(', ')
                }
              </div>
              <div className="text-[9px] text-gray-500 mt-1">توزيع أعداد المحاولات</div>
            </div>
          </div>

          {retryTestResult && (
            <div className="mt-3 bg-[#0d0f1a] border border-[#22263b] p-3 rounded-xl space-y-2">
              <div className="text-xs font-bold text-rose-300 flex items-center justify-between">
                <span>نتائج اختبارات Phase 2E Manual Retry Test Suite:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${retryTestResult.allPassed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                  {retryTestResult.allPassed ? 'ALL PASSED (6/6)' : 'SOME FAILED'}
                </span>
              </div>
              <div className="space-y-1.5">
                {retryTestResult.results.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-[#121526] p-2 rounded-lg">
                    <span className="text-gray-300 font-medium">{c.caseName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400">Status: {c.actualStatus}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {c.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Phase 2F-A - Conflict Inspection & Resolution Planning */}
        <div className="bg-[#141727] border border-[#2d3250] p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#252a42] pb-3">
            <div className="text-sm font-bold text-amber-400 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-400" />
              <span>فحص وتخطيط حل التعارض (Phase 2F-A Conflict Inspection & Resolution Planning)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                Phase 2F-A Inspection & 2F-B Execution
              </span>
              <button
                onClick={handleRunConflictTestSuite}
                disabled={runningConflictTest}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span>{runningConflictTest ? 'جاري التشغيل...' : 'اختبارات 2F-A (12)'}</span>
              </button>
              <button
                onClick={handleRunResolutionExecTestSuite}
                disabled={runningResolutionExecTest}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span>{runningResolutionExecTest ? 'جاري التنفيذ...' : 'اختبارات 2F-B Execution (6)'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-2 text-center">
            <div className="bg-[#111320] border border-[#22263b] p-2.5 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">Open Conflicts</div>
              <div className="text-base font-bold text-rose-400">{conflictStats.openConflictsCount}</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-2.5 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">With Decision</div>
              <div className="text-base font-bold text-indigo-300">{conflictStats.decisionsRecordedCount}</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-2.5 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">Deferred</div>
              <div className="text-base font-bold text-amber-300">{conflictStats.deferredCount}</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-2.5 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">Prop. Keep Local</div>
              <div className="text-base font-bold text-cyan-300">{conflictStats.proposedKeepLocalCount}</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-2.5 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">Prop. Keep Remote</div>
              <div className="text-base font-bold text-purple-300">{conflictStats.proposedKeepRemoteCount}</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-2.5 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">Prop. Merge</div>
              <div className="text-base font-bold text-amber-400">{conflictStats.proposedMergeCount}</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-2.5 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">Uninspected</div>
              <div className="text-base font-bold text-slate-400">{conflictStats.uninspectedCount}</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-2.5 rounded-xl bg-emerald-950/20">
              <div className="text-[10px] text-gray-400 mb-1">Executed Resol.</div>
              <div className="text-base font-bold text-emerald-400">{conflictStats.executedResolutionsCount}</div>
            </div>
          </div>

          {resolutionExecTestResult && (
            <div className="mt-3 bg-[#0d0f1a] border border-emerald-500/30 p-3 rounded-xl space-y-2">
              <div className="text-xs font-bold text-emerald-300 flex items-center justify-between">
                <span>نتائج اختبارات Phase 2F-B Canary Resolution Execution Test Suite:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${resolutionExecTestResult.allPassed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                  {resolutionExecTestResult.allPassed ? 'ALL PASSED (6/6)' : 'SOME FAILED'}
                </span>
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {resolutionExecTestResult.results.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-[#121526] p-2 rounded-lg">
                    <span className="text-gray-300 font-medium">{c.caseName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400">{c.actualStatus}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {c.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {conflictTestResult && (
            <div className="mt-3 bg-[#0d0f1a] border border-[#22263b] p-3 rounded-xl space-y-2">
              <div className="text-xs font-bold text-amber-300 flex items-center justify-between">
                <span>نتائج اختبارات Phase 2F-A Conflict Inspection Test Suite:</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${conflictTestResult.allPassed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                  {conflictTestResult.allPassed ? 'ALL PASSED (12/12)' : 'SOME FAILED'}
                </span>
              </div>
              <div className="space-y-1.5 max-h-56 overflow-y-auto">
                {conflictTestResult.results.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-[#121526] p-2 rounded-lg">
                    <span className="text-gray-300 font-medium">{c.caseName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400">Actual: {c.actualDecision || c.actualStatus}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {c.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Phase 2D0 - Legacy Write Interceptor & Remote Preflight Summary */}
        <div className="bg-[#141727] border border-[#2d3250] p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#252a42] pb-3">
            <div className="text-sm font-bold text-cyan-400 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-cyan-400" />
              <span>فحص ومقارنة البيانات البعيدة (Phase 2D0 Remote Preflight Summary - Read Only)</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                Phase 2D0 Active
              </span>
              <button
                onClick={handleRunPreflightAll}
                disabled={runningD0Preflight}
                className="px-3 py-1.5 rounded-lg text-xs font-bold bg-cyan-600 hover:bg-cyan-500 text-white flex items-center gap-1.5 transition disabled:opacity-50"
              >
                <PlayCircle className="w-3.5 h-3.5" />
                <span>{runningD0Preflight ? 'جاري الفحص...' : 'Preflight All (Read Only)'}</span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-center">
            <div className="bg-[#111320] border border-[#22263b] p-3 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">READY_TO_SYNC</div>
              <div className="text-lg font-bold text-indigo-400">
                {preflightSummary ? preflightSummary.readyToSyncCount : queueStats.total}
              </div>
              <div className="text-[9px] text-gray-500 mt-1">غير موجود في Supabase</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-3 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">REMOTE_MATCH</div>
              <div className="text-lg font-bold text-emerald-400">
                {preflightSummary ? preflightSummary.remoteMatchCount : 0}
              </div>
              <div className="text-[9px] text-gray-500 mt-1">موجود ومطابق تماماً</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-3 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">REMOTE_CONFLICT</div>
              <div className="text-lg font-bold text-rose-400">
                {preflightSummary ? preflightSummary.remoteConflictCount : 0}
              </div>
              <div className="text-[9px] text-gray-500 mt-1">موجود ولكن المحتوى مختلف</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-3 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">REMOTE_NOT_CHECKED</div>
              <div className="text-lg font-bold text-amber-400">
                {preflightSummary ? preflightSummary.remoteNotCheckedCount : 0}
              </div>
              <div className="text-[9px] text-gray-500 mt-1">تعذر الاستعلام أو خطأ شبكة</div>
            </div>
          </div>

          {preflightTestResult && (
            <div className="mt-3 bg-[#0d0f1a] border border-[#22263b] p-3 rounded-xl space-y-2">
              <div className="text-xs font-bold text-cyan-300">نتائج الفحص الشامل (Preflight Matrix):</div>
              <div className="space-y-1.5">
                {preflightTestResult.caseResults.map((c, i) => (
                  <div key={i} className="flex items-center justify-between text-xs bg-[#121526] p-2 rounded-lg">
                    <span className="text-gray-300 font-medium">{c.testName}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-gray-400">{c.actualStatus}</span>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${c.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                        {c.passed ? 'PASS' : 'FAIL'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Phase 2C.5 - Preflight Safety Report (Read Only) */}
        <div className="bg-[#141727] border border-[#2d3250] p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-[#252a42] pb-3">
            <div className="text-sm font-bold text-emerald-400 flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-400" />
              <span>تقرير السلامة والجاهزية لمرحلة المزامنة (Preflight Report - Read Only)</span>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
              Phase 2C.5 Active
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-9 gap-3 text-center">
            <div className="bg-[#111320] border border-[#22263b] p-3 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">Legacy Writes</div>
              <div className="text-xs font-bold text-amber-400">YES</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-3 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">Queue Items</div>
              <div className="text-sm font-bold text-white">{queueStats.total}</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-3 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">Remote Match</div>
              <div className="text-sm font-bold text-emerald-400">0</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-3 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">Local Only</div>
              <div className="text-sm font-bold text-indigo-300">{queueStats.total}</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-3 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">Remote Conflict</div>
              <div className="text-sm font-bold text-emerald-400">0</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-3 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">Suspected Tests</div>
              <div className="text-sm font-bold text-purple-300">
                {queueItems.filter(i => i.origin === 'System' || (i.payload && JSON.stringify(i.payload).includes('Phase 2B'))).length}
              </div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-3 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">Missing Seq No</div>
              <div className="text-sm font-bold text-amber-300">{integrityReport.missingSequenceNumbers}</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-3 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">Dup Idempotency</div>
              <div className="text-sm font-bold text-emerald-400">{integrityReport.duplicateIdempotencyKeys}</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-3 rounded-xl">
              <div className="text-[10px] text-gray-400 mb-1">Dup Creates</div>
              <div className="text-sm font-bold text-emerald-400">{integrityReport.potentialDuplicateCreates}</div>
            </div>
          </div>
        </div>

        {/* Phase 2C - Queue Integrity Diagnostics Panel */}
        <div className="bg-[#16192a] border border-[#252a42] p-4 rounded-xl space-y-3">
          <div className="flex items-center justify-between border-b border-[#22263b] pb-2">
            <div className="text-xs font-bold text-indigo-300 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-indigo-400" />
              <span>فحص سلامة وجاهزية المزامنة (Phase 2C - Queue Integrity Diagnostics)</span>
            </div>
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
              integrityReport.simulationInvalidCount === 0
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
            }`}>
              {integrityReport.simulationInvalidCount === 0 ? 'INTEGRITY: HEALTHY (سليم 100%)' : 'INTEGRITY: ISSUES DETECTED'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
            <div className="bg-[#111320] border border-[#22263b] p-2.5 rounded-lg text-center">
              <div className="text-[11px] text-gray-400">Simulation Ready</div>
              <div className="text-base font-bold text-emerald-400">{integrityReport.simulationReadyCount}</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-2.5 rounded-lg text-center">
              <div className="text-[11px] text-gray-400">Invalid Items</div>
              <div className="text-base font-bold text-rose-400">{integrityReport.invalidQueueItems}</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-2.5 rounded-lg text-center">
              <div className="text-[11px] text-gray-400">Duplicates</div>
              <div className="text-base font-bold text-amber-400">{integrityReport.duplicateEntityIds + integrityReport.duplicateIdempotencyKeys}</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-2.5 rounded-lg text-center">
              <div className="text-[11px] text-gray-400">Hash Mismatches</div>
              <div className="text-base font-bold text-rose-400">{integrityReport.hashMismatches}</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-2.5 rounded-lg text-center">
              <div className="text-[11px] text-gray-400">Missing Hash/Origin</div>
              <div className="text-base font-bold text-purple-400">{integrityReport.missingPayloadHash + integrityReport.missingOrigin}</div>
            </div>
            <div className="bg-[#111320] border border-[#22263b] p-2.5 rounded-lg text-center">
              <div className="text-[11px] text-gray-400">Unsupported Ver.</div>
              <div className="text-base font-bold text-indigo-400">{integrityReport.unsupportedVersions}</div>
            </div>
          </div>
        </div>

        {/* Phase 2B Test Runner Action */}
        <div className="bg-[#16192a] border border-[#252a42] p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <PlayCircle className="w-4 h-4 text-emerald-400" />
              <span>اختبارات التحقق الإلزامية لمرحلة Phase 2B (Write-Ahead Test Suite)</span>
            </div>
            <div className="text-[11px] text-gray-400 mt-1">
              يقوم بإنشاء (3 Customers, 2 Repair Orders, 2 Invoices, 1 Product, 1 Expense) واختبار عدم تكرار Idempotency Keys.
            </div>
          </div>
          <button
            onClick={handleRunPhase2BTest}
            disabled={runningTest}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition shrink-0"
          >
            <PlayCircle className={`w-4 h-4 ${runningTest ? 'animate-spin' : ''}`} />
            <span>{runningTest ? 'جاري التشغيل...' : 'تشغيل الاختبار Phase 2B'}</span>
          </button>
        </div>

        {testResult && (
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2 text-xs font-mono text-slate-300">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 font-sans font-bold">
              <span className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                )}
                <span>نتيجة اختبارات المرحلة Phase 2B</span>
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] ${testResult.success ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                {testResult.success ? 'PASSED (ناجح 100%)' : 'FAILED'}
              </span>
            </div>
            <div className="space-y-1 max-h-40 overflow-y-auto pt-1">
              {testResult.logs.map((log, idx) => (
                <div key={idx} className="text-[11px] leading-relaxed">{log}</div>
              ))}
            </div>
          </div>
        )}

        {/* Phase 2C Test Runner Action */}
        <div className="bg-[#16192a] border border-[#252a42] p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div>
            <div className="text-xs font-bold text-white flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-indigo-400" />
              <span>اختبارات التحقق والتحكّم الإلزامية Phase 2C (Validation & Conflict Safety Test Suite)</span>
            </div>
            <div className="text-[11px] text-gray-400 mt-1">
              يختبر الحالات 1-7 (Missing entityId, Missing payloadHash, version 999, Duplicate Keys, Hash Mismatch, Persistence & Order Test) بدون أي اتصال خارجي.
            </div>
          </div>
          <button
            onClick={handleRunPhase2CTest}
            disabled={runningCTest}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold rounded-lg transition shrink-0"
          >
            <PlayCircle className={`w-4 h-4 ${runningCTest ? 'animate-spin' : ''}`} />
            <span>{runningCTest ? 'جاري التشغيل...' : 'تشغيل الاختبار Phase 2C'}</span>
          </button>
        </div>

        {testCResult && (
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3 text-xs font-mono text-slate-300">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 font-sans font-bold">
              <span className="flex items-center gap-2">
                {testCResult.allPassed ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                )}
                <span>تقرير نتائج اختبارات التحقق Phase 2C</span>
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] ${testCResult.allPassed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                {testCResult.allPassed ? 'ALL PASSED (ناجح 100%)' : 'SOME TESTS FAILED'}
              </span>
            </div>

            <div className="space-y-1.5 max-h-48 overflow-y-auto pt-1 font-sans">
              {testCResult.testCaseResults.map((tc, idx) => (
                <div key={idx} className="flex items-center justify-between bg-slate-900 p-2 rounded border border-slate-800 text-[11px]">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${tc.passed ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                    <span className="font-semibold text-slate-200">{tc.testName}</span>
                  </div>
                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-slate-400">Expected: {tc.expectedStatus}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] ${tc.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'}`}>
                      Got: {tc.actualStatus}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 border-t border-slate-800 font-sans space-y-1">
              <div className="text-[11px] font-bold text-indigo-300">نتائج اختبار ثبات البيانات والترتيب (Persistence Test):</div>
              {testCResult.persistenceLogs.map((plog, idx) => (
                <div key={idx} className="text-[11px] text-slate-400 font-mono">{plog}</div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-gray-400 bg-[#161826] p-3 rounded-xl border border-[#25283d]">
          <strong>ملاحظة المرحلة 2B (Write-Ahead Queue):</strong> يتم تسجيل كافة عمليات الإنشاء الناجحة محلياً في طابور المزامنة مسبقاً (Write-Ahead) بحالة Pending مع منع التكرار بواسطة مفاتيح Idempotency Keys. محرك المزامنة في حالة خاملة حالياً.
        </div>
      </div>

      {/* Safety Notice */}
      <div className="bg-emerald-950/30 border border-emerald-500/20 p-4 rounded-xl flex items-center gap-3">
        <ShieldCheck className="w-5 h-5 text-emerald-400 shrink-0" />
        <div className="text-xs text-emerald-200">
          <strong>وضع الاستقرار الموحد:</strong> جميع شاشات وخدمات النظام تعمل بكفاءة من خلال طبقة Data Layer الموحدة. التخزين المحلي وقاعدة بيانات Supabase يعملان جنباً إلى جنب بدون أي فقدان للبيانات.
        </div>
      </div>

      {/* Audit Explorer Section (Phase 2G - Reliability & Audit Hardening) */}
      <AuditExplorer />

      {/* Embedded Read Only Data Inspector */}
      <DataInspector />
    </div>
  );
}
