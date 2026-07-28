/**
 * Audit Explorer UI Component (Phase 2G.1 - Audit Integrity & State Policy Hardening)
 * Displays Correlation ID timelines, Tamper-Evident Hash Chain Status, State Transitions, Health Score, and Diagnostics.
 * @license Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ShieldCheck, Activity, Search, Clock, FileText, CheckCircle, AlertOctagon, AlertTriangle, ArrowRight, RefreshCw, BarChart2, Key, Link as LinkIcon } from 'lucide-react';
import {
  getAllCorrelationIds,
  getAuditTimelineByCorrelationId,
  calculateSyncHealthMetrics,
  runSyncDiagnostics,
  verifyAuditChain,
  runAuditTestSuite,
  AuditEvent,
  SyncHealthMetrics,
  SyncDiagnosticsReport,
  AuditVerificationResult
} from '../lib/sync/audit';

export default function AuditExplorer() {
  const [healthMetrics, setHealthMetrics] = useState<SyncHealthMetrics>(calculateSyncHealthMetrics());
  const [diagnostics, setDiagnostics] = useState<SyncDiagnosticsReport>(runSyncDiagnostics());
  const [chainStatus, setChainStatus] = useState<AuditVerificationResult>(verifyAuditChain());
  const [correlationIds, setCorrelationIds] = useState<string[]>(getAllCorrelationIds());
  const [selectedCorrelationId, setSelectedCorrelationId] = useState<string>(correlationIds[0] || '');
  const [timelineEvents, setTimelineEvents] = useState<AuditEvent[]>(
    selectedCorrelationId ? getAuditTimelineByCorrelationId(selectedCorrelationId) : []
  );

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [testResult, setTestResult] = useState<{ allPassed: boolean; results: any[] } | null>(null);
  const [runningTest, setRunningTest] = useState<boolean>(false);

  const refreshAuditData = () => {
    const ids = getAllCorrelationIds();
    setCorrelationIds(ids);
    setHealthMetrics(calculateSyncHealthMetrics());
    setDiagnostics(runSyncDiagnostics());
    setChainStatus(verifyAuditChain());

    if (selectedCorrelationId && ids.includes(selectedCorrelationId)) {
      setTimelineEvents(getAuditTimelineByCorrelationId(selectedCorrelationId));
    } else if (ids.length > 0) {
      setSelectedCorrelationId(ids[0]);
      setTimelineEvents(getAuditTimelineByCorrelationId(ids[0]));
    } else {
      setTimelineEvents([]);
    }
  };

  useEffect(() => {
    refreshAuditData();
  }, []);

  const handleSelectCorrelation = (corrId: string) => {
    setSelectedCorrelationId(corrId);
    setTimelineEvents(getAuditTimelineByCorrelationId(corrId));
  };

  const handleRunAuditTests = async () => {
    setRunningTest(true);
    try {
      const res = await runAuditTestSuite();
      setTestResult(res);
      refreshAuditData();
    } catch (err) {
      console.error('Audit test suite failed:', err);
    } finally {
      setRunningTest(false);
    }
  };

  const filteredCorrelationIds = correlationIds.filter(id =>
    id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 p-5 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-500/10 border border-indigo-500/30 rounded-xl text-indigo-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <span>Phase 2G.1 Audit Integrity &amp; Chain Explorer</span>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 font-mono border border-indigo-500/30">
                SHA-256 Hash Chain
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              سجل تدقيق غير قابل للتعديل مشفّر بسلسلة Hash للتأكد من نزاهة وسلسلة أحداث المزامنة
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={refreshAuditData}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl border border-slate-700 transition"
            title="تحديث البيانات"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleRunAuditTests}
            disabled={runningTest}
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition shadow-lg flex items-center gap-2 border border-indigo-400/30"
          >
            <Activity className={`w-4 h-4 ${runningTest ? 'animate-spin' : ''}`} />
            <span>{runningTest ? 'جاري الاختبار...' : 'تشغيل اختبارات Audit الـ 12'}</span>
          </button>
        </div>
      </div>

      {/* Audit Chain Status & Health Score Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Audit Chain Status Card */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Audit Chain Status</span>
            <LinkIcon className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`px-3 py-1 rounded-full text-xs font-bold font-mono border ${
                chainStatus.valid
                  ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                  : 'bg-rose-500/20 text-rose-400 border-rose-500/40'
              }`}
            >
              {chainStatus.valid ? 'VALID_CHAIN' : 'CORRUPTED'}
            </span>
          </div>
          <div className="text-xs font-mono space-y-1 text-slate-400 pt-1 border-t border-slate-800">
            <div className="flex justify-between">
              <span>Event Count:</span>
              <span className="text-slate-200 font-bold">{chainStatus.totalEvents}</span>
            </div>
            <div className="flex justify-between">
              <span>Last Sequence:</span>
              <span className="text-slate-200 font-bold">{chainStatus.verifiedEvents}</span>
            </div>
            <div className="flex justify-between">
              <span>Failure Type:</span>
              <span className={`font-bold ${chainStatus.failureType === 'NONE' ? 'text-emerald-400' : 'text-rose-400'}`}>
                {chainStatus.failureType}
              </span>
            </div>
          </div>
        </div>

        {/* Health Score Card */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col justify-between space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Sync Health Score</span>
            <BarChart2 className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="flex items-baseline gap-3">
            <span className="text-3xl font-extrabold text-white font-mono">
              {typeof healthMetrics.scorePercentage === 'number' ? `${healthMetrics.scorePercentage}%` : healthMetrics.scorePercentage}
            </span>
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-bold font-mono border ${
                healthMetrics.healthGrade === 'EXCELLENT'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : healthMetrics.healthGrade === 'INSUFFICIENT_DATA'
                  ? 'bg-slate-800 text-slate-400 border-slate-700'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}
            >
              {healthMetrics.healthGrade}
            </span>
          </div>
          <div className="text-[11px] text-slate-400 flex justify-between border-t border-slate-800 pt-2">
            <span>Data Quality: {healthMetrics.dataQuality}</span>
            <span>Success: {healthMetrics.successRatePercentage}%</span>
          </div>
        </div>

        {/* Operational Durations Card */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Average Durations</span>
            <Clock className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="grid grid-cols-3 gap-1.5 text-center pt-1 font-mono text-[11px]">
            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
              <div className="text-[9px] text-slate-400">Sync Avg</div>
              <div className="font-bold text-cyan-300 mt-0.5">{healthMetrics.avgSyncDurationMs} ms</div>
            </div>
            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
              <div className="text-[9px] text-slate-400">Retry Avg</div>
              <div className="font-bold text-amber-300 mt-0.5">{healthMetrics.avgRetryDurationMs} ms</div>
            </div>
            <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
              <div className="text-[9px] text-slate-400">Res Avg</div>
              <div className="font-bold text-emerald-300 mt-0.5">{healthMetrics.avgResolutionDurationMs} ms</div>
            </div>
          </div>
        </div>

        {/* Diagnostics Card */}
        <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Diagnostics</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="space-y-1 text-xs font-mono">
            <div className="flex justify-between items-center bg-slate-950 p-1.5 px-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-300">Pending</span>
              <span className="text-slate-200 font-bold">{healthMetrics.pendingCount}</span>
            </div>
            <div className="flex justify-between items-center bg-slate-950 p-1.5 px-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-300">Failed</span>
              <span className="text-rose-400 font-bold">{healthMetrics.failedCount}</span>
            </div>
            <div className="flex justify-between items-center bg-slate-950 p-1.5 px-2.5 rounded-lg border border-slate-800">
              <span className="text-slate-300">Conflicts</span>
              <span className="text-amber-400 font-bold">{healthMetrics.conflictCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Test Results Output */}
      {testResult && (
        <div className="bg-slate-950 border border-indigo-500/30 p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between text-xs font-bold text-indigo-300">
            <span>نتائج تشغيل اختبارات Audit Integrity &amp; State Policy (Phase 2G.1):</span>
            <span
              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold font-mono ${
                testResult.allPassed ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}
            >
              {testResult.allPassed ? `ALL PASSED (${testResult.results.length}/${testResult.results.length})` : 'SOME FAILED'}
            </span>
          </div>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {testResult.results.map((c, i) => (
              <div key={i} className="flex items-center justify-between text-xs bg-slate-900 p-2.5 rounded-xl border border-slate-800">
                <span className="text-slate-200 font-medium">{c.caseName}</span>
                <div className="flex items-center gap-3 font-mono">
                  <span className="text-[10px] text-slate-400">{c.details || c.actualStatus}</span>
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      c.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
                    }`}
                  >
                    {c.passed ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Audit Timeline Explorer */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Correlation ID Selector Sidebar */}
        <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-400" />
              <span>Correlation IDs ({correlationIds.length})</span>
            </h3>
          </div>

          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="تصفية Correlation ID..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            />
          </div>

          <div className="space-y-1.5 max-h-[450px] overflow-y-auto pr-1">
            {filteredCorrelationIds.length === 0 ? (
              <div className="text-xs text-slate-500 p-4 text-center">لا توجد Correlation IDs مسجلة</div>
            ) : (
              filteredCorrelationIds.map(corrId => {
                const events = getAuditTimelineByCorrelationId(corrId);
                const isSelected = corrId === selectedCorrelationId;
                const lastEvent = events[events.length - 1];

                return (
                  <button
                    key={corrId}
                    onClick={() => handleSelectCorrelation(corrId)}
                    className={`w-full text-left p-2.5 rounded-xl transition text-xs font-mono space-y-1 border ${
                      isSelected
                        ? 'bg-indigo-950/60 border-indigo-500/50 text-indigo-200 shadow-md'
                        : 'bg-slate-950 border-slate-800/80 hover:bg-slate-800 text-slate-400'
                    }`}
                  >
                    <div className="font-bold flex items-center justify-between">
                      <span className="truncate max-w-[170px]">{corrId}</span>
                      <span className="text-[10px] text-slate-500 font-normal">{events.length} events</span>
                    </div>
                    {lastEvent && (
                      <div className="text-[10px] text-slate-500 flex justify-between items-center">
                        <span className="text-indigo-400 font-semibold">{lastEvent.eventType}</span>
                        <span>{new Date(lastEvent.timestamp).toLocaleTimeString('ar-EG')}</span>
                      </div>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Timeline Event Details Stream */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>Lifecycle Audit Timeline</span>
                {selectedCorrelationId && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {selectedCorrelationId}
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                تتبع الأحداث المتسلسلة للدورة مع رموز Sequence Number و hashes الخاصة بالسلسلة
              </p>
            </div>
          </div>

          {timelineEvents.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              حدد Correlation ID من القائمة الجانبية لعرض شريط الأحداث الزمني.
            </div>
          ) : (
            <div className="relative border-l-2 border-indigo-500/30 pl-4 ml-2 space-y-4 max-h-[500px] overflow-y-auto pr-2">
              {timelineEvents.map((evt, idx) => (
                <div key={evt.eventId || idx} className="relative group">
                  <div
                    className={`absolute -left-[23px] top-1.5 w-3 h-3 rounded-full border-2 bg-slate-900 ${
                      evt.result === 'SUCCESS'
                        ? 'border-emerald-400 text-emerald-400'
                        : evt.result === 'FAILED'
                        ? 'border-rose-400 text-rose-400'
                        : 'border-amber-400 text-amber-400'
                    }`}
                  />

                  <div className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-1.5 py-0.5 bg-slate-800 text-slate-300 rounded">
                          #{evt.sequenceNumber}
                        </span>
                        <span className="font-bold font-mono text-indigo-300">{evt.eventType}</span>
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono ${
                            evt.result === 'SUCCESS'
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : evt.result === 'FAILED'
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-amber-500/20 text-amber-400'
                          }`}
                        >
                          {evt.result}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(evt.timestamp).toLocaleTimeString('ar-EG')}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-slate-400 font-mono bg-slate-900/60 p-2 rounded-lg">
                      <div>
                        QueueItem: <span className="text-slate-200">{evt.queueItemId}</span>
                      </div>
                      <div>
                        Entity: <span className="text-slate-200">{evt.entityType}:{evt.entityId}</span>
                      </div>
                      <div>
                        Op: <span className="text-amber-300">{evt.operation}</span>
                      </div>
                      <div>
                        Actor: <span className="text-slate-300">{evt.actor}</span>
                      </div>
                    </div>

                    {/* Hash Chain Details */}
                    <div className="text-[10px] font-mono bg-slate-900 p-2 rounded border border-slate-800 text-slate-400 space-y-0.5">
                      <div className="truncate">
                        <span className="text-indigo-400">Prev Hash:</span> {evt.previousEventHash}
                      </div>
                      <div className="truncate">
                        <span className="text-cyan-400">Event Hash:</span> {evt.eventHash}
                      </div>
                    </div>

                    {/* State Changes */}
                    {(evt.previousState || evt.newState) && (
                      <div className="flex items-center gap-2 text-[11px] font-mono bg-indigo-950/30 p-2 rounded border border-indigo-500/20">
                        <span className="text-slate-400">State Transition:</span>
                        <span className="text-slate-300 font-bold">{evt.previousState || 'NONE'}</span>
                        <ArrowRight className="w-3 h-3 text-indigo-400" />
                        <span className="text-emerald-300 font-bold">{evt.newState || 'NONE'}</span>
                      </div>
                    )}

                    {/* Metadata */}
                    {evt.metadata && Object.keys(evt.metadata).length > 0 && (
                      <div className="text-[10px] font-mono text-slate-400 bg-slate-900 p-2 rounded border border-slate-800">
                        <span className="text-indigo-400">Metadata:</span> {JSON.stringify(evt.metadata)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
