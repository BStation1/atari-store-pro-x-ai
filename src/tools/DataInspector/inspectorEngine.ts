/**
 * Read-Only Data Inspector Engine
 * Compares LocalStorage cache and Supabase records without performing any write/sync operations.
 * @license Apache-2.0
 */

import { supabase, isSupabaseConfigured } from '../../lib/supabaseClient';

export interface EntityInspectionResult {
  entityName: string;
  localKey: string;
  supabaseTable: string;
  localCount: number;
  cloudCount: number;
  missingLocal: number;
  missingCloud: number;
  conflicts: number;
  status: 'SYNCHRONIZED' | 'DESYNC' | 'LOCAL_ONLY' | 'CLOUD_ONLY' | 'OFFLINE';
  details?: string;
}

export interface SystemInspectionReport {
  timestamp: string;
  isSupabaseConnected: boolean;
  isLocalCacheEnabled: boolean;
  totalLocalRecords: number;
  totalCloudRecords: number;
  totalMissingCloud: number;
  totalMissingLocal: number;
  totalConflicts: number;
  entities: EntityInspectionResult[];
}

function safeGetLocalItems(key: string): any[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const raw = localStorage.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    }
  } catch (e) {
    console.error(`[DataInspector] Error reading local key ${key}:`, e);
  }
  return [];
}

async function inspectEntity(
  entityName: string,
  localKey: string,
  supabaseTable: string,
  isConnected: boolean
): Promise<EntityInspectionResult> {
  const localItems = safeGetLocalItems(localKey);
  const localCount = localItems.length;

  if (!isConnected) {
    return {
      entityName,
      localKey,
      supabaseTable,
      localCount,
      cloudCount: 0,
      missingLocal: 0,
      missingCloud: localCount,
      conflicts: 0,
      status: 'OFFLINE',
      details: 'Supabase disconnected or unconfigured'
    };
  }

  try {
    const { data: cloudItems, error } = await supabase
      .from(supabaseTable)
      .select('id, updated_at, created_at');

    if (error) {
      return {
        entityName,
        localKey,
        supabaseTable,
        localCount,
        cloudCount: 0,
        missingLocal: 0,
        missingCloud: localCount,
        conflicts: 0,
        status: 'DESYNC',
        details: `Query error: ${error.message}`
      };
    }

    const cloudRows = cloudItems || [];
    const cloudCount = cloudRows.length;

    const localMap = new Map<string, any>();
    localItems.forEach(item => {
      if (item && item.id) localMap.set(String(item.id), item);
    });

    const cloudMap = new Map<string, any>();
    cloudRows.forEach(row => {
      if (row && row.id) cloudMap.set(String(row.id), row);
    });

    let missingCloud = 0;
    localMap.forEach((_, id) => {
      if (!cloudMap.has(id)) missingCloud++;
    });

    let missingLocal = 0;
    cloudMap.forEach((_, id) => {
      if (!localMap.has(id)) missingLocal++;
    });

    let conflicts = 0;
    localMap.forEach((localItem, id) => {
      const cloudItem = cloudMap.get(id);
      if (cloudItem) {
        const localUpdated = localItem.updatedAt || localItem.created_at;
        const cloudUpdated = cloudItem.updated_at || cloudItem.created_at;
        if (localUpdated && cloudUpdated && localUpdated !== cloudUpdated) {
          conflicts++;
        }
      }
    });

    let status: EntityInspectionResult['status'] = 'SYNCHRONIZED';
    if (missingCloud > 0 || missingLocal > 0 || conflicts > 0) {
      status = 'DESYNC';
    } else if (localCount > 0 && cloudCount === 0) {
      status = 'LOCAL_ONLY';
    } else if (cloudCount > 0 && localCount === 0) {
      status = 'CLOUD_ONLY';
    }

    return {
      entityName,
      localKey,
      supabaseTable,
      localCount,
      cloudCount,
      missingLocal,
      missingCloud,
      conflicts,
      status
    };
  } catch (err: any) {
    return {
      entityName,
      localKey,
      supabaseTable,
      localCount,
      cloudCount: 0,
      missingLocal: 0,
      missingCloud: localCount,
      conflicts: 0,
      status: 'DESYNC',
      details: err.message || 'Inspection failed'
    };
  }
}

export async function runSystemDataInspection(): Promise<SystemInspectionReport> {
  const isConnected = isSupabaseConfigured;

  const entityConfigs = [
    { entityName: 'Customers (العملاء)', localKey: 'atari_customers', supabaseTable: 'customers' },
    { entityName: 'Repair Orders (أوامر الصيانة)', localKey: 'atari_repair_orders', supabaseTable: 'repair_orders' },
    { entityName: 'Invoices (الفواتير والمبيعات)', localKey: 'atari_invoices', supabaseTable: 'invoices' },
    { entityName: 'Products (المنتجات والمخزون)', localKey: 'atari_products', supabaseTable: 'products' },
    { entityName: 'Expenses (المصروفات)', localKey: 'atari_expenses', supabaseTable: 'expenses' },
    { entityName: 'Partners (الشركاء)', localKey: 'atari_partners', supabaseTable: 'partners' },
    { entityName: 'Suppliers (الموردون)', localKey: 'atari_suppliers', supabaseTable: 'suppliers' },
  ];

  const results: EntityInspectionResult[] = [];
  for (const config of entityConfigs) {
    const result = await inspectEntity(
      config.entityName,
      config.localKey,
      config.supabaseTable,
      isConnected
    );
    results.push(result);
  }

  let totalLocalRecords = 0;
  let totalCloudRecords = 0;
  let totalMissingCloud = 0;
  let totalMissingLocal = 0;
  let totalConflicts = 0;

  results.forEach(r => {
    totalLocalRecords += r.localCount;
    totalCloudRecords += r.cloudCount;
    totalMissingCloud += r.missingCloud;
    totalMissingLocal += r.missingLocal;
    totalConflicts += r.conflicts;
  });

  return {
    timestamp: new Date().toISOString(),
    isSupabaseConnected: isConnected,
    isLocalCacheEnabled: true,
    totalLocalRecords,
    totalCloudRecords,
    totalMissingCloud,
    totalMissingLocal,
    totalConflicts,
    entities: results,
  };
}
