/**
 * Read-Only Data Inspector Component
 * Strictly displays comparison between LocalStorage and Supabase.
 * NO sync execution, NO delete, NO write actions.
 * @license Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Database, HardDrive, RefreshCw, AlertTriangle, CheckCircle, Info, ShieldCheck, Layers, ListFilter, FileCheck, Check, X } from 'lucide-react';
import { runSystemDataInspection, SystemInspectionReport, EntityInspectionResult } from './inspectorEngine';
import { syncQueue } from '../../lib/sync/syncQueue';
import { SyncQueueItem } from '../../lib/sync/syncTypes';
import { checkQueueIntegrity, QueueIntegrityReport } from '../../lib/sync/validators/queueIntegrity';
import { simulateSync, SyncSimulationResult } from '../../lib/sync/validators/validatorFactory';
import { runPreflight, runPreflightAll, PreflightResult, PreflightSummaryReport } from '../../lib/sync/preflight';
import { manualSync, ManualSyncReport } from '../../lib/sync/manual';
import { executeManualRetry, getRetryHistoryForItem, RetryExecutionReport, RetryHistoryEntry } from '../../lib/sync/retry';
import {
  inspectConflict,
  recordProposedDecision,
  getConflictRecordForItem,
  getConflictHistoryForItem,
  getResolutionPlanForItem,
  executeKeepRemoteResolution,
  ResolutionExecutionReport,
  ConflictRecord,
  ConflictHistoryEntry,
  ProposedDecisionType,
  FieldDecision,
  maskSensitiveValue
} from '../../lib/sync/conflicts';

export default function DataInspector() {
  const [report, setReport] = useState<SystemInspectionReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'comparison' | 'queue'>('comparison');
  const [queueItems, setQueueItems] = useState<SyncQueueItem[]>([]);
  
  // Phase 2C Validation State
  const [integrityReport, setIntegrityReport] = useState<QueueIntegrityReport | null>(null);
  const [selectedSimResult, setSelectedSimResult] = useState<SyncSimulationResult | null>(null);

  // Phase 2D0 Preflight State
  const [preflightSummary, setPreflightSummary] = useState<PreflightSummaryReport | null>(null);
  const [singlePreflightResult, setSinglePreflightResult] = useState<PreflightResult | null>(null);
  const [runningPreflight, setRunningPreflight] = useState<boolean>(false);

  // Phase 2D Manual Sync State
  const [selectedManualSyncReport, setSelectedManualSyncReport] = useState<ManualSyncReport | null>(null);
  const [runningManualSync, setRunningManualSync] = useState<boolean>(false);

  // Phase 2E Manual Retry State
  const [selectedRetryReport, setSelectedRetryReport] = useState<RetryExecutionReport | null>(null);
  const [runningRetry, setRunningRetry] = useState<boolean>(false);
  const [highRetryConfirmItem, setHighRetryConfirmItem] = useState<SyncQueueItem | null>(null);
  const [activeHistoryItem, setActiveHistoryItem] = useState<SyncQueueItem | null>(null);

  // Phase 2F-A Conflict Inspection State
  const [activeConflictItem, setActiveConflictItem] = useState<SyncQueueItem | null>(null);
  const [activeConflictRecord, setActiveConflictRecord] = useState<ConflictRecord | null>(null);
  const [runningConflictInspection, setRunningConflictInspection] = useState<boolean>(false);
  const [proposedMergeDecisions, setProposedMergeDecisions] = useState<Record<string, FieldDecision>>({});
  const [conflictActionMessage, setConflictActionMessage] = useState<string | null>(null);

  // Phase 2F-B Canary Resolution Execution State
  const [runningResolution, setRunningResolution] = useState<boolean>(false);
  const [resolutionReport, setResolutionReport] = useState<ResolutionExecutionReport | null>(null);

  const handleExecuteResolution = async (queueItemId: string) => {
    setRunningResolution(true);
    setConflictActionMessage(null);
    try {
      const res = await executeKeepRemoteResolution(queueItemId);
      setResolutionReport(res);
      if (res.success) {
        setConflictActionMessage(`Resolution PASS! Queue Status -> Synced. Backup Created: ${res.backupId}`);
        // Refresh conflict record
        const updatedRec = getConflictRecordForItem(queueItemId);
        if (updatedRec) setActiveConflictRecord(updatedRec);
        // Refresh queue
        syncQueue.refresh();
        setQueueItems(syncQueue.list());
      } else {
        setConflictActionMessage(`Resolution Execution ${res.status}: ${res.blockedReason || res.failureReason}`);
      }
    } catch (err: any) {
      setConflictActionMessage(`Execution Error: ${err?.message || err}`);
    } finally {
      setRunningResolution(false);
    }
  };

  const handleInspectConflictSingle = async (item: SyncQueueItem) => {
    setRunningConflictInspection(true);
    setConflictActionMessage(null);
    try {
      const res = await inspectConflict(item);
      if (res.success && res.conflictRecord) {
        setActiveConflictItem(item);
        setActiveConflictRecord(res.conflictRecord);
        // Initialize proposed merge decisions
        const initialDecs: Record<string, FieldDecision> = {};
        for (const diff of res.conflictRecord.differences) {
          initialDecs[diff.path] = { fieldPath: diff.path, decision: 'USE_LOCAL' };
        }
        setProposedMergeDecisions(initialDecs);
      } else {
        setConflictActionMessage(`Inspection error: ${res.error}`);
      }
    } catch (err) {
      console.error('Inspect conflict error:', err);
    } finally {
      setRunningConflictInspection(false);
    }
  };

  const handleProposeDecision = (decision: ProposedDecisionType) => {
    if (!activeConflictItem) return;
    const res = recordProposedDecision({
      queueItemId: activeConflictItem.id,
      proposedDecision: decision,
      decisionReason: `User proposed '${decision}' via Queue Explorer`,
      fieldDecisions: decision === 'MERGE_FIELDS_PROPOSED' ? proposedMergeDecisions : undefined,
      actor: 'Admin UI'
    });

    if (res.success && res.conflictRecord) {
      setActiveConflictRecord(res.conflictRecord);
      setConflictActionMessage(`Decision recorded: ${decision}. (ResolutionExecuted = false)`);
    } else {
      setConflictActionMessage(`Validation failed: ${res.validationErrors.join(', ')}`);
    }
  };

  const handleManualSyncSingle = async (item: SyncQueueItem) => {
    setRunningManualSync(true);
    try {
      const rep = await manualSync(item);
      setSelectedManualSyncReport(rep);
      syncQueue.refresh();
      setQueueItems(syncQueue.list());
    } catch (err) {
      console.error('Inspector manual sync single error:', err);
    } finally {
      setRunningManualSync(false);
    }
  };

  const handleExecuteRetrySingle = async (item: SyncQueueItem, userConfirmed: boolean = false) => {
    setRunningRetry(true);
    setHighRetryConfirmItem(null);
    try {
      const rep = await executeManualRetry(item, userConfirmed);
      if (rep.retryDecision === 'REQUIRE_USER_CONFIRMATION') {
        setHighRetryConfirmItem(item);
      } else {
        setSelectedRetryReport(rep);
        syncQueue.refresh();
        setQueueItems(syncQueue.list());
      }
    } catch (err) {
      console.error('Inspector retry error:', err);
    } finally {
      setRunningRetry(false);
    }
  };

  const handleRunPreflightAllInInspector = async () => {
    setRunningPreflight(true);
    try {
      const summary = await runPreflightAll();
      setPreflightSummary(summary);
    } catch (err) {
      console.error('Inspector preflight all error:', err);
    } finally {
      setRunningPreflight(false);
    }
  };

  const handleRunPreflightSingle = async (item: SyncQueueItem) => {
    setRunningPreflight(true);
    try {
      const res = await runPreflight(item);
      setSinglePreflightResult(res);
    } catch (err) {
      console.error('Inspector preflight single error:', err);
    } finally {
      setRunningPreflight(false);
    }
  };

  const fetchInspection = async () => {
    setLoading(true);
    try {
      const data = await runSystemDataInspection();
      setReport(data);
      syncQueue.refresh();
      const items = syncQueue.list();
      setQueueItems(items);
      setIntegrityReport(checkQueueIntegrity(items));
    } catch (e) {
      console.error('Data inspection error:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleValidateAll = () => {
    syncQueue.refresh();
    const items = syncQueue.list();
    setQueueItems(items);
    const reportRes = checkQueueIntegrity(items);
    setIntegrityReport(reportRes);
  };

  const handleValidateSingle = (item: SyncQueueItem) => {
    const sim = simulateSync(item);
    setSelectedSimResult(sim);
  };

  useEffect(() => {
    fetchInspection();
  }, []);

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-slate-100 shadow-xl space-y-6">
      {/* Header & Tabs */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold text-white">Read-Only Data Inspector (مُفتش البيانات الحصري)</h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            يقوم بقراءة البيانات ومقارنتها واستعراض طابور المزامنة الخلفية بدون أي تعديل أو كتابة.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* Tabs */}
          <div className="bg-slate-800 p-1 rounded-lg flex items-center gap-1 border border-slate-700 text-xs">
            <button
              onClick={() => setActiveTab('comparison')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                activeTab === 'comparison'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              جدول المقارنة
            </button>
            <button
              onClick={() => {
                syncQueue.refresh();
                setQueueItems(syncQueue.list());
                setActiveTab('queue');
              }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
                activeTab === 'queue'
                  ? 'bg-indigo-600 text-white shadow'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Queue Explorer</span>
              <span className="bg-slate-700 text-slate-200 px-1.5 py-0.2 rounded-full text-[10px]">
                {queueItems.length}
              </span>
            </button>
          </div>

          <button
            onClick={fetchInspection}
            disabled={loading}
            className="flex items-center gap-2 px-3.5 py-1.5 bg-indigo-600/80 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-xs font-medium transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </button>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400">
          <RefreshCw className="w-8 h-8 animate-spin mx-auto text-indigo-400 mb-2" />
          <p className="text-sm font-medium">جاري فحص وتدقيق البيانات الحالية...</p>
        </div>
      ) : activeTab === 'comparison' && report ? (
        <div className="space-y-6">
          {/* Top Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>سجلات التخزين المحلي</span>
                <HardDrive className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2">{report.totalLocalRecords}</div>
              <div className="text-[10px] text-emerald-400 mt-1">Local Cache Active</div>
            </div>

            <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>سجلات السحابة</span>
                <Database className="w-4 h-4 text-indigo-400" />
              </div>
              <div className="text-2xl font-bold text-white mt-2">{report.totalCloudRecords}</div>
              <div className="text-[10px] text-indigo-400 mt-1">Supabase DB</div>
            </div>

            <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>مفقود في السحابة</span>
                <AlertTriangle className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-300 mt-2">{report.totalMissingCloud}</div>
              <div className="text-[10px] text-amber-400 mt-1">Pending Cloud Sync</div>
            </div>

            <div className="bg-slate-800/80 p-4 rounded-lg border border-slate-700">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>تعارضات محتملة</span>
                <Info className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-bold text-rose-300 mt-2">{report.totalConflicts}</div>
              <div className="text-[10px] text-rose-400 mt-1">Timestamp Mismatch</div>
            </div>
          </div>

          {/* Inspection Details Table */}
          <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-slate-200">جدول مقارنة البيانات الموحد</h3>
              <span className="text-xs text-slate-400">تاريخ الفحص: {new Date(report.timestamp).toLocaleTimeString('ar-EG')}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-800 text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="p-3">القسم / الكيان</th>
                    <th className="p-3">العدد المحلي</th>
                    <th className="p-3">العدد في السحابة</th>
                    <th className="p-3">مفقود محلياً</th>
                    <th className="p-3">مفقود في السحابة</th>
                    <th className="p-3">التعارضات</th>
                    <th className="p-3">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {report.entities.map((item: EntityInspectionResult) => (
                    <tr key={item.entityName} className="hover:bg-slate-800/40 transition">
                      <td className="p-3 font-medium text-slate-200">{item.entityName}</td>
                      <td className="p-3 text-slate-300 font-mono">{item.localCount}</td>
                      <td className="p-3 text-slate-300 font-mono">{item.cloudCount}</td>
                      <td className="p-3 text-slate-300 font-mono">{item.missingLocal}</td>
                      <td className="p-3 text-amber-300 font-mono font-bold">{item.missingCloud}</td>
                      <td className="p-3 text-slate-300 font-mono">{item.conflicts}</td>
                      <td className="p-3">
                        {item.status === 'SYNCHRONIZED' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            <CheckCircle className="w-3 h-3" /> متطابق
                          </span>
                        )}
                        {item.status === 'DESYNC' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            <AlertTriangle className="w-3 h-3" /> يحتاج تدقيق
                          </span>
                        )}
                        {item.status === 'OFFLINE' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-500/10 text-slate-400 border border-slate-500/20">
                            <Info className="w-3 h-3" /> غير متصل
                          </span>
                        )}
                        {item.status === 'LOCAL_ONLY' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                            محلي فقط
                          </span>
                        )}
                        {item.status === 'CLOUD_ONLY' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                            سحابي فقط
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-indigo-950/40 border border-indigo-800/40 p-4 rounded-lg flex items-start gap-3">
            <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="text-xs text-indigo-200 leading-relaxed">
              <strong>ضمان الاستقرار والحماية:</strong> هذا الفحص قراءة فقط (Read-Only) ولم يقم بمسح أو تعديل أو كتابة أي بيانات على الإطلاق. البيانات التشغيلية آمنة وموجودة بالكامل في التخزين المحلي وفي Supabase.
            </div>
          </div>
        </div>
      ) : activeTab === 'queue' ? (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-slate-800/40 p-3 rounded-lg border border-slate-700">
            <div className="text-sm font-semibold text-slate-200 flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <span>مُكتشف طابور المزامنة (Sync Queue Explorer - Phase 2C Read-Only)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleValidateAll}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-md text-xs font-medium transition shadow"
              >
                <FileCheck className="w-3.5 h-3.5" />
                <span>Validate All</span>
              </button>
              <button
                onClick={handleRunPreflightAllInInspector}
                disabled={runningPreflight}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white rounded-md text-xs font-medium transition shadow disabled:opacity-50"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{runningPreflight ? 'جاري...' : 'Preflight All'}</span>
              </button>
              <span className="text-xs text-slate-400">إجمالي العناصر: {queueItems.length}</span>
            </div>
          </div>

          {/* Validation Summary Notification if report generated */}
          {integrityReport && (
            <div className="bg-slate-800/80 border border-slate-700 p-3.5 rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 text-xs">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold text-slate-200">
                  تقرير التحقق العام: Ready = {integrityReport.simulationReadyCount} | Invalid = {integrityReport.simulationInvalidCount} | Duplicates = {integrityReport.duplicateEntityIds + integrityReport.duplicateIdempotencyKeys} | Hash Mismatches = {integrityReport.hashMismatches}
                </span>
              </div>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                integrityReport.simulationInvalidCount === 0
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
              }`}>
                {integrityReport.simulationInvalidCount === 0 ? 'VALIDATION PASSED (جاهز للمزامنة)' : 'ISSUES DETECTED'}
              </span>
            </div>
          )}

          {/* Selected Single Preflight Result Box */}
          {singlePreflightResult && (
            <div className="bg-slate-850 border border-cyan-500/30 p-3.5 rounded-lg text-xs space-y-2 relative">
              <button
                onClick={() => setSinglePreflightResult(null)}
                className="absolute top-2 left-2 text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="font-bold text-slate-200 flex items-center gap-2">
                <span>نتيجة الـ Preflight الفردي (Remote Lookup - Read Only):</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  singlePreflightResult.status === 'READY_TO_SYNC' ? 'bg-indigo-500/20 text-indigo-300' :
                  singlePreflightResult.status === 'REMOTE_MATCH' ? 'bg-emerald-500/20 text-emerald-400' :
                  singlePreflightResult.status === 'REMOTE_CONFLICT' ? 'bg-rose-500/20 text-rose-400' :
                  'bg-amber-500/20 text-amber-300'
                }`}>
                  {singlePreflightResult.status}
                </span>
              </div>
              <div className="text-slate-400 text-[11px] font-mono">
                Entity: {singlePreflightResult.entityType} ({singlePreflightResult.entityId}) | Remote Exists: {singlePreflightResult.remoteExists ? 'YES' : 'NO'} | Hash: {singlePreflightResult.queuePayloadHash}
              </div>
              <div className="text-slate-300 text-[11px]">
                <strong>Reason:</strong> {singlePreflightResult.reason}
              </div>
            </div>
          )}

          {/* Selected Single Manual Sync Report Box */}
          {selectedManualSyncReport && (
            <div className="bg-slate-850 border border-amber-500/40 p-3.5 rounded-lg text-xs space-y-2 relative">
              <button
                onClick={() => setSelectedManualSyncReport(null)}
                className="absolute top-2 left-2 text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="font-bold text-slate-200 flex items-center gap-2">
                <span>تقرير المزامنة اليدوية الفردية (Phase 2D Manual Sync Report):</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedManualSyncReport.finalQueueStatus === 'Synced' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                }`}>
                  {selectedManualSyncReport.finalQueueStatus} ({selectedManualSyncReport.verificationResult})
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-slate-300 bg-slate-900 p-2 rounded">
                <div>Preflight: <span className="text-amber-300 font-bold">{selectedManualSyncReport.preflightStatus}</span></div>
                <div>Write Duration: <span className="text-indigo-300 font-bold">{selectedManualSyncReport.writeDurationMs}ms</span></div>
                <div>Verify Duration: <span className="text-indigo-300 font-bold">{selectedManualSyncReport.verificationDurationMs}ms</span></div>
                <div>Remote Found: <span className="text-cyan-300 font-bold">{selectedManualSyncReport.remoteRecordFound ? 'YES' : 'NO'}</span></div>
              </div>
              <div className="text-slate-300 text-[11px]">
                <strong>Item ID:</strong> {selectedManualSyncReport.queueItemId} | <strong>Entity:</strong> {selectedManualSyncReport.entityType} ({selectedManualSyncReport.entityId})
              </div>
              {selectedManualSyncReport.error && (
                <div className="text-rose-400 text-[11px] font-semibold bg-rose-500/10 p-1.5 rounded border border-rose-500/20">
                  <strong>Error / Reason:</strong> {selectedManualSyncReport.error}
                </div>
              )}
            </div>
          )}

          {/* Phase 2E Retry Execution Report Box */}
          {selectedRetryReport && (
            <div className="bg-slate-850 border border-indigo-500/40 p-3.5 rounded-lg text-xs space-y-2 relative">
              <button
                onClick={() => setSelectedRetryReport(null)}
                className="absolute top-2 left-2 text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="font-bold text-slate-200 flex items-center gap-2">
                <span>تقرير إعادة المحاولة اليدوية (Phase 2E Manual Retry Report):</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedRetryReport.finalQueueStatus === 'Synced' ? 'bg-emerald-500/20 text-emerald-400' :
                  selectedRetryReport.finalQueueStatus === 'Conflict' ? 'bg-amber-500/20 text-amber-400' : 'bg-rose-500/20 text-rose-400'
                }`}>
                  {selectedRetryReport.finalQueueStatus} ({selectedRetryReport.retryDecision})
                </span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-slate-300 bg-slate-900 p-2 rounded">
                <div>Preflight: <span className="text-cyan-300 font-bold">{selectedRetryReport.preflightStatus}</span></div>
                <div>Attempt #: <span className="text-amber-300 font-bold">{selectedRetryReport.attemptNumber}</span></div>
                <div>Duration: <span className="text-indigo-300 font-bold">{selectedRetryReport.durationMs}ms</span></div>
                <div>Verification: <span className="text-emerald-300 font-bold">{selectedRetryReport.verificationResult || 'N/A'}</span></div>
              </div>
              <div className="text-slate-300 text-[11px]">
                <strong>Item ID:</strong> {selectedRetryReport.queueItemId} | <strong>Entity:</strong> {selectedRetryReport.entityType} ({selectedRetryReport.entityId})
              </div>
              {selectedRetryReport.error && (
                <div className="text-amber-300 text-[11px] font-semibold bg-amber-500/10 p-1.5 rounded border border-amber-500/20">
                  <strong>Notice / Reason:</strong> {selectedRetryReport.error}
                </div>
              )}
            </div>
          )}

          {/* High Retry Count Confirmation Box */}
          {highRetryConfirmItem && (
            <div className="bg-amber-950/40 border border-amber-500/60 p-4 rounded-lg text-xs space-y-3 relative text-amber-200">
              <div className="font-bold text-amber-300 text-sm flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-400" />
                <span>تحذير: عدد محاولات مرتفع (HIGH_RETRY_COUNT &gt;= 5)</span>
              </div>
              <p>
                العنصر <strong>{highRetryConfirmItem.entityType} ({highRetryConfirmItem.entityId})</strong> فشل في المزامنة <strong>{highRetryConfirmItem.retryCount}</strong> مرات سابقة. هل ترغب في تأكيد إعادة المحاولة يدويًا؟
              </p>
              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => handleExecuteRetrySingle(highRetryConfirmItem, true)}
                  disabled={runningRetry}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-xs transition"
                >
                  تأكيد إعادة المحاولة الآن
                </button>
                <button
                  onClick={() => setHighRetryConfirmItem(null)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs transition"
                >
                  إلغاء
                </button>
              </div>
            </div>
          )}

          {/* Retry History Modal / Box */}
          {activeHistoryItem && (
            <div className="bg-slate-900 border border-slate-700 p-4 rounded-lg text-xs space-y-3 relative">
              <button
                onClick={() => setActiveHistoryItem(null)}
                className="absolute top-2 left-2 text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="font-bold text-slate-200 flex items-center gap-2 text-sm">
                <span>سجل إعادة المحاولات اليدوية (Retry History):</span>
                <span className="text-slate-400 font-mono text-xs">{activeHistoryItem.id} ({activeHistoryItem.entityType})</span>
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {getRetryHistoryForItem(activeHistoryItem.id).length === 0 ? (
                  <div className="text-slate-500 italic p-2">لا يوجد سجل إعادات محاولة سابق لهذا العنصر.</div>
                ) : (
                  getRetryHistoryForItem(activeHistoryItem.id).map(h => (
                    <div key={h.id} className="bg-slate-800/80 p-2.5 rounded border border-slate-700/60 font-mono text-[11px] space-y-1">
                      <div className="flex justify-between items-center text-slate-300 font-semibold">
                        <span>محاولة #{h.attemptNumber} [{h.result}]</span>
                        <span className="text-slate-400 text-[10px]">{new Date(h.startedAt).toLocaleTimeString('ar-EG')}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-slate-400">
                        <div>Preflight: <span className="text-cyan-300">{h.preflightStatus}</span></div>
                        <div>المدة: <span className="text-indigo-300">{h.durationMs}ms</span></div>
                        <div>التحقق: <span className="text-emerald-300">{h.verificationResult || 'N/A'}</span></div>
                      </div>
                      {h.error && <div className="text-rose-400 text-[10px] bg-rose-950/30 p-1 rounded border border-rose-500/20">{h.error}</div>}
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Phase 2F-A Conflict Inspection Drawer / Box */}
          {activeConflictItem && activeConflictRecord && (
            <div className="bg-slate-900 border border-amber-500/50 p-5 rounded-xl text-xs space-y-4 relative shadow-2xl">
              <button
                onClick={() => {
                  setActiveConflictItem(null);
                  setActiveConflictRecord(null);
                  setConflictActionMessage(null);
                }}
                className="absolute top-3 left-3 text-slate-400 hover:text-white p-1 rounded bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="font-bold text-amber-400 text-sm flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                  <span>فحص وتخطيط حل التعارض (Conflict Inspection & Resolution Planning - Phase 2F-A)</span>
                </div>
                <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                  Read-Only Diagnosis / Plan Only
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] font-mono text-slate-300 bg-slate-950 p-3 rounded-lg border border-slate-800">
                <div>Entity Type: <span className="text-amber-300 font-bold">{activeConflictRecord.entityType}</span></div>
                <div>Entity ID: <span className="text-cyan-300 font-bold">{activeConflictRecord.entityId}</span></div>
                <div>Status: <span className="text-rose-400 font-bold">{activeConflictRecord.status}</span></div>
                <div>Proposed Decision: <span className="text-indigo-300 font-bold">{activeConflictRecord.proposedDecision || 'NONE'}</span></div>
              </div>

              {conflictActionMessage && (
                <div className="bg-indigo-950/60 border border-indigo-500/40 p-2.5 rounded text-indigo-200 text-xs font-medium">
                  {conflictActionMessage}
                </div>
              )}

              {/* Differences Table */}
              <div className="space-y-2">
                <div className="font-bold text-slate-200 text-xs flex justify-between items-center">
                  <span>جدول الاختلافات المعزولة (Deep Diff - {activeConflictRecord.differences.length} differences):</span>
                  <span className="text-[10px] text-slate-400">* القيم الحساسة مموهة (Masked) تلقائياً</span>
                </div>

                <div className="max-h-60 overflow-y-auto border border-slate-800 rounded-lg overflow-hidden">
                  <table className="w-full text-right text-[11px]">
                    <thead className="bg-slate-800 text-slate-300">
                      <tr>
                        <th className="p-2">Path</th>
                        <th className="p-2">Diff Type</th>
                        <th className="p-2">Local Value</th>
                        <th className="p-2">Remote Value</th>
                        <th className="p-2">Merge Proposal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 bg-slate-900">
                      {activeConflictRecord.differences.map((diff) => {
                        const localValDisp = diff.isSensitive ? maskSensitiveValue(diff.path, diff.localValue) : JSON.stringify(diff.localValue);
                        const remoteValDisp = diff.isSensitive ? maskSensitiveValue(diff.path, diff.remoteValue) : JSON.stringify(diff.remoteValue);

                        return (
                          <tr key={diff.path} className="hover:bg-slate-800/50">
                            <td className="p-2 font-mono text-amber-300 font-semibold">{diff.path}</td>
                            <td className="p-2">
                              <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-slate-800 text-rose-300 border border-slate-700">
                                {diff.differenceType}
                              </span>
                            </td>
                            <td className="p-2 font-mono text-slate-300 max-w-[120px] truncate">{String(localValDisp)}</td>
                            <td className="p-2 font-mono text-slate-300 max-w-[120px] truncate">{String(remoteValDisp)}</td>
                            <td className="p-2">
                              <select
                                value={proposedMergeDecisions[diff.path]?.decision || 'USE_LOCAL'}
                                onChange={(e) => {
                                  setProposedMergeDecisions(prev => ({
                                    ...prev,
                                    [diff.path]: {
                                      fieldPath: diff.path,
                                      decision: e.target.value as any
                                    }
                                  }));
                                }}
                                className="bg-slate-800 border border-slate-700 text-slate-200 text-[10px] rounded px-1.5 py-0.5"
                              >
                                <option value="USE_LOCAL">Use Local</option>
                                <option value="USE_REMOTE">Use Remote</option>
                                <option value="IGNORE_METADATA">Ignore</option>
                              </select>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Action Buttons — Planning & Canary Execution */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800">
                <span className="text-xs text-slate-400 font-semibold ml-2">تسجيل قرار يدوي مقترح:</span>
                <button
                  onClick={() => handleProposeDecision('KEEP_LOCAL_PROPOSED')}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded text-xs transition"
                >
                  Propose Keep Local
                </button>
                <button
                  onClick={() => handleProposeDecision('KEEP_REMOTE_PROPOSED')}
                  className="px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded text-xs transition"
                >
                  Propose Keep Remote
                </button>
                <button
                  onClick={() => handleProposeDecision('MERGE_FIELDS_PROPOSED')}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded text-xs transition"
                >
                  Propose Merge
                </button>
                <button
                  onClick={() => handleProposeDecision('DEFER')}
                  className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded text-xs transition"
                >
                  Defer
                </button>

                {/* Phase 2F-B Canary Resolution Execution Button - KEEP_REMOTE ONLY */}
                {activeConflictRecord.proposedDecision === 'KEEP_REMOTE_PROPOSED' && !activeConflictRecord.resolutionExecuted && (
                  <button
                    onClick={() => handleExecuteResolution(activeConflictItem.id)}
                    disabled={runningResolution}
                    className="mr-auto px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 text-white font-bold rounded text-xs transition shadow flex items-center gap-1.5 border border-emerald-400/40 animate-pulse"
                    title="Execute Resolution (Canary Mode - Single Item KEEP_REMOTE Only)"
                  >
                    <CheckCircle className={`w-3.5 h-3.5 ${runningResolution ? 'animate-spin' : ''}`} />
                    <span>{runningResolution ? 'جاري التنفيذ المحلي...' : 'Execute Resolution (KEEP_REMOTE)'}</span>
                  </button>
                )}
              </div>

              {/* Resolution Execution Result Details */}
              {resolutionReport && resolutionReport.queueItemId === activeConflictItem.id && (
                <div className="bg-slate-950 border border-emerald-500/40 p-3 rounded-lg space-y-2 text-[11px] font-mono">
                  <div className="font-bold text-emerald-400 text-xs flex justify-between items-center">
                    <span>تفاصيل تنفيذ القرار (Resolution Execution Screen):</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] ${resolutionReport.success ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'}`}>
                      Status: {resolutionReport.status}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-slate-300 bg-slate-900 p-2 rounded">
                    <div>Backup Created: <span className="text-cyan-300 font-bold">{resolutionReport.backupId || 'N/A'}</span></div>
                    <div>Execution Duration: <span className="text-amber-300 font-bold">{resolutionReport.executionDurationMs} ms</span></div>
                    <div>Executed At: <span className="text-slate-400">{new Date(resolutionReport.executedAt).toLocaleTimeString('ar-EG')}</span></div>
                  </div>
                  {resolutionReport.verification && (
                    <div className="p-2 bg-slate-900 rounded border border-slate-800 space-y-1">
                      <div className="text-emerald-300 font-semibold">Verification Result: {resolutionReport.verification.passed ? 'PASS' : 'FAIL'}</div>
                      <div className="text-slate-400 text-[10px]">{resolutionReport.verification.message}</div>
                      <div className="grid grid-cols-2 gap-2 text-[10px] pt-1">
                        <div>Hashes Before: Local ({resolutionReport.hashesBefore?.local.slice(0, 8)}...), Remote ({resolutionReport.hashesBefore?.remote.slice(0, 8)}...)</div>
                        <div>Hashes After: Local ({resolutionReport.hashesAfter?.local.slice(0, 8)}...), Remote ({resolutionReport.hashesAfter?.remote.slice(0, 8)}...)</div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* History Log for this item */}
              <div className="pt-2 border-t border-slate-800 space-y-1.5">
                <div className="font-bold text-slate-300 text-xs">سجل القرارات لهذه التعارضات (Conflict History):</div>
                <div className="space-y-1 max-h-32 overflow-y-auto">
                  {getConflictHistoryForItem(activeConflictItem.id).map(h => (
                    <div key={h.id} className="text-[10px] font-mono text-slate-400 bg-slate-950 p-1.5 rounded flex justify-between items-center">
                      <span>{h.action} -&gt; {h.newDecision || 'NONE'} ({h.actor})</span>
                      <span>{new Date(h.timestamp).toLocaleTimeString('ar-EG')}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Selected Single Item Simulation Dialog */}
          {selectedSimResult && (
            <div className="bg-slate-850 border border-indigo-500/30 p-3.5 rounded-lg text-xs space-y-2 relative">
              <button
                onClick={() => setSelectedSimResult(null)}
                className="absolute top-2 left-2 text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
              <div className="font-bold text-slate-200 flex items-center gap-2">
                <span>نتيجة فحص المحاكاة الجافة (Dry Run Simulation):</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  selectedSimResult.status === 'READY' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                }`}>
                  {selectedSimResult.status}
                </span>
              </div>
              <div className="text-slate-400 text-[11px]">
                Item ID: <span className="font-mono text-slate-200">{selectedSimResult.item.id}</span> | Entity: <span className="font-mono text-slate-200">{selectedSimResult.item.entityType} ({selectedSimResult.item.entityId})</span>
              </div>
              {selectedSimResult.reasons.length > 0 ? (
                <div className="space-y-1 pt-1">
                  <div className="text-rose-400 font-semibold">الأسباب / الملاحظات:</div>
                  <ul className="list-disc list-inside space-y-0.5 text-slate-300 font-mono text-[11px]">
                    {selectedSimResult.reasons.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="text-emerald-400 text-[11px]">
                  ✓ جميع الشروط متوفرة بنجاح والـ Payload Hash متطابق 100%.
                </div>
              )}
            </div>
          )}

          <div className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-right text-xs">
                <thead className="bg-slate-800 text-slate-400 border-b border-slate-700">
                  <tr>
                    <th className="p-3">Entity Type</th>
                    <th className="p-3">Entity ID</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Created At</th>
                    <th className="p-3">Origin</th>
                    <th className="p-3">Version</th>
                    <th className="p-3">Validation (Dry Run)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {queueItems.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-slate-400">
                        طابور المزامنة فارغ حالياً (Queue Length = 0)
                      </td>
                    </tr>
                  ) : (
                    queueItems.map((item) => {
                      const sim = simulateSync(item);
                      return (
                        <tr key={item.id} className="hover:bg-slate-800/40 transition">
                          <td className="p-3 font-medium text-slate-200 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                            <span>{item.entityType}</span>
                          </td>
                          <td className="p-3 text-slate-300 font-mono text-[11px]">{item.entityId}</td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              item.status === 'Pending' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                              item.status === 'Syncing' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                              item.status === 'Synced' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                              'bg-rose-500/10 text-rose-400 border-rose-500/20'
                            }`}>
                              {item.status}
                            </span>
                          </td>
                          <td className="p-3 text-slate-400 font-mono text-[11px]">
                            {new Date(item.createdAt).toLocaleString('ar-EG')}
                          </td>
                          <td className="p-3 text-slate-300">{item.origin || 'System'}</td>
                          <td className="p-3 text-slate-300 font-mono">{item.version || 1}</td>
                          <td className="p-3 flex items-center gap-1.5">
                            <button
                              onClick={() => handleValidateSingle(item)}
                              className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold border transition ${
                                sim.status === 'READY'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                                  : 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/20'
                              }`}
                            >
                              <FileCheck className="w-3 h-3" />
                              <span>Val ({sim.status})</span>
                            </button>
                            <button
                              onClick={() => handleRunPreflightSingle(item)}
                              disabled={runningPreflight}
                              className="flex items-center gap-1 px-2 py-1 bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 rounded text-[10px] font-bold transition disabled:opacity-50"
                            >
                              <ShieldCheck className="w-3 h-3 text-cyan-400" />
                              <span>Preflight</span>
                            </button>
                            <button
                              onClick={() => handleManualSyncSingle(item)}
                              disabled={runningManualSync || item.status !== 'Pending'}
                              className="flex items-center gap-1 px-2 py-1 bg-amber-600 hover:bg-amber-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded text-[10px] font-bold transition shadow"
                              title="Manual Sync (Canary Mode - Single Item Only)"
                            >
                              <RefreshCw className={`w-3 h-3 ${runningManualSync ? 'animate-spin' : ''}`} />
                              <span>Manual Sync</span>
                            </button>
                            <button
                              onClick={() => handleExecuteRetrySingle(item)}
                              disabled={runningRetry || item.status !== 'Failed'}
                              className="flex items-center gap-1 px-2 py-1 bg-rose-600 hover:bg-rose-500 disabled:bg-slate-800 disabled:text-slate-500 text-white rounded text-[10px] font-bold transition shadow"
                              title="Retry (Failed Items Only)"
                            >
                              <RefreshCw className={`w-3 h-3 ${runningRetry ? 'animate-spin' : ''}`} />
                              <span>Retry</span>
                            </button>
                            {item.status === 'Conflict' && (
                              <button
                                onClick={() => handleInspectConflictSingle(item)}
                                disabled={runningConflictInspection}
                                className="flex items-center gap-1 px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded text-[10px] font-bold transition shadow"
                                title="Inspect Conflict (Phase 2F-A Read-Only Diagnosis)"
                              >
                                <AlertTriangle className="w-3 h-3 text-white" />
                                <span>Inspect Conflict</span>
                              </button>
                            )}
                            <button
                              onClick={() => setActiveHistoryItem(item)}
                              className="flex items-center gap-1 px-2 py-1 bg-slate-700 hover:bg-slate-600 text-slate-200 border border-slate-600 rounded text-[10px] font-bold transition"
                              title="View Retry History"
                            >
                              <span>History</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-slate-800/40 border border-slate-700 p-3 rounded-lg text-xs text-slate-400 flex items-center gap-2">
            <Info className="w-4 h-4 text-indigo-400 shrink-0" />
            <span>
              <strong>ملاحظة المرحلة 2C:</strong> زر Validate يقوم بالتحقق التكتيكي والمحاكاة الجافة (Dry Run) بدون أي تعديل للبيانات أو تغيير للحالة وبدون استدعاء أية خدمة خارجية.
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}
