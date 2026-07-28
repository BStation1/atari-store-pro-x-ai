/**
 * Unified Data Access Layer Types
 * @license Apache-2.0
 */

export interface IDataProvider<T> {
  get(id: string): Promise<T | null>;
  list(filters?: Record<string, any>): Promise<T[]>;
  insert(item: Partial<T>): Promise<T>;
  update(id: string, item: Partial<T>): Promise<T>;
  remove(id: string): Promise<boolean>;
}

export interface DataOperationResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  source: 'supabase' | 'local' | 'hybrid';
}
