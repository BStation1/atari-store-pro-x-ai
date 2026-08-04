/**
 * Remote Read-Only Lookup Service (Phase 2D0)
 * Performs strict SELECT operations on Supabase by entityId.
 * No writes, inserts, updates, or deletes permitted.
 * @license Apache-2.0
 */

import { supabase, isSupabaseConfigured } from '../../supabaseClient';
import { SyncEntityType } from '../syncTypes';

export interface RemoteLookupResponse {
  success: boolean;
  exists: boolean;
  data: any | null;
  error?: string;
}

export function getTableNameForEntity(entityType: SyncEntityType | string): string {
  switch (entityType) {
    case 'Customer':
      return 'customers';
    case 'RepairOrder':
      return 'repair_orders';
    case 'Invoice':
      return 'invoices';
    case 'Product':
      return 'products';
    case 'Expense':
      return 'expenses';
    default:
      return '';
  }
}

/**
 * Performs a strict SELECT query to check if a record exists in Supabase.
 */
export async function lookupRemoteRecord(entityType: SyncEntityType | string, entityId: string): Promise<RemoteLookupResponse> {
  if (!isSupabaseConfigured) {
    return {
      success: true,
      exists: false,
      data: null
    };
  }

  const tableName = getTableNameForEntity(entityType);
  if (!tableName) {
    return {
      success: false,
      exists: false,
      data: null,
      error: `Unsupported entity type: ${entityType}`
    };
  }

  try {
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .eq('id', entityId)
      .maybeSingle();

    if (error) {
      return {
        success: false,
        exists: false,
        data: null,
        error: error.message
      };
    }

    if (data) {
      return {
        success: true,
        exists: true,
        data
      };
    }

    return {
      success: true,
      exists: false,
      data: null
    };
  } catch (err: any) {
    return {
      success: false,
      exists: false,
      data: null,
      error: err?.message || 'Network or database lookup exception'
    };
  }
}
