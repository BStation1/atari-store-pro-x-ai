import { supabase } from './supabaseClient';
import { DBDeviceType, DBDeviceModel, RepairTemplateItem } from '../types';

const INITIALIZED_DEVICE_KEY = 'atari_device_mgr_initialized_sp';

// --- SEED DEFAULTS (ONLY USED IF SUPABASE TABLE IS COMPLETELY EMPTY ON FIRST PROVISIONING) ---
export const DEFAULT_SUPABASE_DEVICE_TYPES: DBDeviceType[] = [
  { id: "DT-001", nameAr: "بلاستيشن 5", nameEn: "PS5", brand: "Sony", sortOrder: 1, isActive: true, isArchived: false },
  { id: "DT-002", nameAr: "بلاستيشن 5 سليم", nameEn: "PS5 Slim", brand: "Sony", sortOrder: 2, isActive: true, isArchived: false },
  { id: "DT-003", nameAr: "بلاستيشن 5 برو", nameEn: "PS5 Pro", brand: "Sony", sortOrder: 3, isActive: true, isArchived: false },
  { id: "DT-004", nameAr: "بلاستيشن 4", nameEn: "PS4", brand: "Sony", sortOrder: 4, isActive: true, isArchived: false },
  { id: "DT-005", nameAr: "بلاستيشن 4 سليم", nameEn: "PS4 Slim", brand: "Sony", sortOrder: 5, isActive: true, isArchived: false },
  { id: "DT-006", nameAr: "بلاستيشن 4 برو", nameEn: "PS4 Pro", brand: "Sony", sortOrder: 6, isActive: true, isArchived: false },
  { id: "DT-007", nameAr: "إكس بوكس سيريس إكس", nameEn: "Xbox Series X", brand: "Microsoft", sortOrder: 7, isActive: true, isArchived: false },
  { id: "DT-008", nameAr: "إكس بوكس سيريس إس", nameEn: "Xbox Series S", brand: "Microsoft", sortOrder: 8, isActive: true, isArchived: false },
  { id: "DT-009", nameAr: "نينتندو سويتش", nameEn: "Nintendo Switch", brand: "Nintendo", sortOrder: 9, isActive: true, isArchived: false },
  { id: "DT-010", nameAr: "ستيم ديك", nameEn: "Steam Deck", brand: "Valve", sortOrder: 10, isActive: true, isArchived: false },
  { id: "DT-011", nameAr: "ذراع تحكم / يد تحكم", nameEn: "Controller", brand: "Sony/Microsoft/Nintendo", sortOrder: 11, isActive: true, isArchived: false },
  { id: "DT-012", nameAr: "اكسسوارات إضافية", nameEn: "Accessory", brand: "Other", sortOrder: 12, isActive: true, isArchived: false },
  { id: "DT-013", nameAr: "أجهزة أخرى", nameEn: "Other", brand: "Other", sortOrder: 13, isActive: true, isArchived: false }
];

export const DEFAULT_SUPABASE_DEVICE_MODELS: DBDeviceModel[] = [
  { id: "DM-001", deviceTypeId: "DT-001", brand: "Sony", nameAr: "إصدار الأقراص القياسي CFI-1216A", nameEn: "Standard Disc Edition CFI-1216A", modelCode: "CFI-1216A", storageOptions: "825GB, 1TB", defaultWarrantyDays: 90, defaultInspectionPrice: 200, defaultRepairPrice: 1500, notes: "الإصدار الأول السميك", isActive: true, isArchived: false, sortOrder: 1 },
  { id: "DM-002", deviceTypeId: "DT-001", brand: "Sony", nameAr: "الإصدار الرقمي CFI-1216B", nameEn: "Digital Edition CFI-1216B", modelCode: "CFI-1216B", storageOptions: "825GB", defaultWarrantyDays: 90, defaultInspectionPrice: 200, defaultRepairPrice: 1300, notes: "بدون قارئ أقراص", isActive: true, isArchived: false, sortOrder: 2 },
  { id: "DM-003", deviceTypeId: "DT-002", brand: "Sony", nameAr: "سليم إصدار الأقراص", nameEn: "Slim Disc Edition", modelCode: "CFI-2016A", storageOptions: "1TB", defaultWarrantyDays: 90, defaultInspectionPrice: 250, defaultRepairPrice: 1600, notes: "التصميم الجديد الأقل حجماً", isActive: true, isArchived: false, sortOrder: 3 },
  { id: "DM-004", deviceTypeId: "DT-011", brand: "Sony", nameAr: "يد التحكم DualSense PS5", nameEn: "DualSense PS5 Controller", modelCode: "CFI-ZCT1W", storageOptions: "N/A", defaultWarrantyDays: 30, defaultInspectionPrice: 50, defaultRepairPrice: 400, notes: "ذراع التحكم الأصلي للبلايستيشن 5", isActive: true, isArchived: false, sortOrder: 4 },
  { id: "DM-005", deviceTypeId: "DT-011", brand: "Sony", nameAr: "يد التحكم DualShock 4 PS4", nameEn: "DualShock 4 PS4 Controller", modelCode: "CUH-ZCT2E", storageOptions: "N/A", defaultWarrantyDays: 30, defaultInspectionPrice: 40, defaultRepairPrice: 300, notes: "ذراع التحكم الأصلي للبلايستيشن 4", isActive: true, isArchived: false, sortOrder: 5 }
];

export const DEFAULT_SUPABASE_REPAIR_TEMPLATES: RepairTemplateItem[] = [
  // PS5 Model specific (DM-001)
  { id: "RPT-001", deviceTypeId: "DT-001", deviceModelId: "DM-001", nameAr: "تغيير سوكت HDMI أصلي", defaultCostPrice: 150, defaultRepairPrice: 500, sortOrder: 1, isActive: true },
  { id: "RPT-002", deviceTypeId: "DT-001", deviceModelId: "DM-001", nameAr: "إصلاح منفذ USB", defaultCostPrice: 50, defaultRepairPrice: 300, sortOrder: 2, isActive: true },
  { id: "RPT-003", deviceTypeId: "DT-001", deviceModelId: "DM-001", nameAr: "تغيير مروحة التبريد", defaultCostPrice: 250, defaultRepairPrice: 600, sortOrder: 3, isActive: true },
  { id: "RPT-004", deviceTypeId: "DT-001", deviceModelId: "DM-001", nameAr: "تنظيف شامل + كولر معدن سائل", defaultCostPrice: 100, defaultRepairPrice: 350, sortOrder: 4, isActive: true },
  { id: "RPT-005", deviceTypeId: "DT-001", deviceModelId: "DM-001", nameAr: "إصلاح مزود الطاقة (الباور)", defaultCostPrice: 200, defaultRepairPrice: 700, sortOrder: 5, isActive: true },

  // Controller DualSense (DM-004)
  { id: "RPT-009", deviceTypeId: "DT-011", deviceModelId: "DM-004", nameAr: "استبدال مقاومة أنالوج (Drift)", defaultCostPrice: 40, defaultRepairPrice: 150, sortOrder: 1, isActive: true },
  { id: "RPT-010", deviceTypeId: "DT-011", deviceModelId: "DM-004", nameAr: "تغيير سوكت شحن Type-C", defaultCostPrice: 25, defaultRepairPrice: 120, sortOrder: 2, isActive: true },
  { id: "RPT-011", deviceTypeId: "DT-011", deviceModelId: "DM-004", nameAr: "تغيير بطارية أصلية", defaultCostPrice: 60, defaultRepairPrice: 180, sortOrder: 3, isActive: true },
  { id: "RPT-012", deviceTypeId: "DT-011", deviceModelId: "DM-004", nameAr: "استبدال ربر أزرار التوجيه", defaultCostPrice: 15, defaultRepairPrice: 70, sortOrder: 4, isActive: true },

  // Controller DualShock 4 (DM-005)
  { id: "RPT-016", deviceTypeId: "DT-011", deviceModelId: "DM-005", nameAr: "استبدال أنالوج يد PS4", defaultCostPrice: 30, defaultRepairPrice: 100, sortOrder: 1, isActive: true },
  { id: "RPT-017", deviceTypeId: "DT-011", deviceModelId: "DM-005", nameAr: "تغيير سوكت شحن Micro-USB", defaultCostPrice: 15, defaultRepairPrice: 80, sortOrder: 2, isActive: true },
  { id: "RPT-018", deviceTypeId: "DT-011", deviceModelId: "DM-005", nameAr: "تغيير بطارية يد PS4", defaultCostPrice: 40, defaultRepairPrice: 120, sortOrder: 3, isActive: true }
];

// --- MAPPING HELPERS ---
export function mapRowToDeviceType(row: Record<string, any>): DBDeviceType {
  return {
    id: String(row.id || ''),
    nameAr: row.name_ar || row.nameAr || '',
    nameEn: row.name_en || row.nameEn || '',
    brand: row.brand || 'Sony',
    icon: row.icon || undefined,
    sortOrder: typeof row.sort_order === 'number' ? row.sort_order : row.sortOrder ?? 0,
    isActive: row.is_active !== undefined ? Boolean(row.is_active) : row.isActive !== false,
    isArchived: Boolean(row.is_archived || row.isArchived || false),
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  };
}

export function mapDeviceTypeToRow(dt: Partial<DBDeviceType>): Record<string, any> {
  const row: Record<string, any> = {
    name_ar: dt.nameAr,
    name_en: dt.nameEn || '',
    brand: dt.brand || 'Sony',
    icon: dt.icon || null,
    sort_order: dt.sortOrder ?? 0,
    is_active: dt.isActive !== false,
    is_archived: Boolean(dt.isArchived),
    updated_at: new Date().toISOString(),
  };
  if (dt.id) row.id = dt.id;
  return row;
}

export function mapRowToDeviceModel(row: Record<string, any>): DBDeviceModel {
  return {
    id: String(row.id || ''),
    deviceTypeId: String(row.device_type_id || row.category_id || row.deviceTypeId || ''),
    brand: row.brand || 'Sony',
    nameAr: row.name_ar || row.nameAr || '',
    nameEn: row.name_en || row.nameEn || '',
    modelCode: row.model_code || row.modelCode || '',
    storageOptions: row.storage_options || row.storageOptions || '',
    defaultWarrantyDays: typeof row.default_warranty_days === 'number' ? row.default_warranty_days : row.defaultWarrantyDays ?? 30,
    defaultInspectionPrice: typeof row.default_inspection_price === 'number' ? Number(row.default_inspection_price) : row.defaultInspectionPrice ?? 0,
    defaultRepairPrice: typeof row.default_repair_price === 'number' ? Number(row.default_repair_price) : row.defaultRepairPrice ?? 0,
    notes: row.notes || '',
    isActive: row.is_active !== undefined ? Boolean(row.is_active) : row.isActive !== false,
    isArchived: Boolean(row.is_archived || row.isArchived || false),
    sortOrder: typeof row.sort_order === 'number' ? row.sort_order : row.sortOrder ?? 0,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  };
}

export function mapDeviceModelToRow(m: Partial<DBDeviceModel>): Record<string, any> {
  const row: Record<string, any> = {
    device_type_id: m.deviceTypeId,
    category_id: m.deviceTypeId, // Alias for backward compatibility
    brand: m.brand || 'Sony',
    name_ar: m.nameAr,
    name_en: m.nameEn || '',
    model_code: m.modelCode || '',
    storage_options: m.storageOptions || '',
    default_warranty_days: m.defaultWarrantyDays ?? 30,
    default_inspection_price: m.defaultInspectionPrice ?? 0,
    default_repair_price: m.defaultRepairPrice ?? 0,
    notes: m.notes || '',
    sort_order: m.sortOrder ?? 0,
    is_active: m.isActive !== false,
    is_archived: Boolean(m.isArchived),
    updated_at: new Date().toISOString(),
  };
  if (m.id) row.id = m.id;
  return row;
}

export function mapRowToRepairTemplate(row: Record<string, any>): RepairTemplateItem {
  const typeId = String(row.device_type_id || row.category_id || row.deviceTypeId || row.categoryId || '');
  const rawModelId = row.device_model_id || row.model_id || row.deviceModelId || row.modelId || undefined;
  const modelId = (rawModelId && String(rawModelId).trim() !== '') ? String(rawModelId) : undefined;

  return {
    id: String(row.id || ''),
    deviceTypeId: typeId,
    categoryId: typeId,
    deviceModelId: modelId,
    modelId: modelId,
    nameAr: row.name_ar || row.nameAr || '',
    nameEn: row.name_en || row.nameEn || '',
    productId: row.product_id || row.productId || undefined,
    defaultCostPrice: Number(row.default_cost_price ?? row.cost_price ?? row.defaultCostPrice ?? 0),
    defaultRepairPrice: Number(row.default_repair_price ?? row.sale_price ?? row.defaultRepairPrice ?? 0),
    sortOrder: typeof row.sort_order === 'number' ? row.sort_order : row.sortOrder ?? 0,
    isActive: row.is_active !== undefined ? Boolean(row.is_active) : row.isActive !== false,
    createdAt: row.created_at || row.createdAt,
    updatedAt: row.updated_at || row.updatedAt,
  };
}

export function mapRepairTemplateToRow(item: Partial<RepairTemplateItem>): Record<string, any> {
  const typeId = item.deviceTypeId || item.categoryId || null;
  const rawModelId = item.deviceModelId || item.modelId || null;
  const modelId = (rawModelId && String(rawModelId).trim() !== '') ? String(rawModelId) : null;

  const row: Record<string, any> = {
    device_type_id: typeId,
    category_id: typeId,
    device_model_id: modelId,
    model_id: modelId,
    product_id: item.productId || null,
    name_ar: item.nameAr,
    name_en: item.nameEn || '',
    default_cost_price: item.defaultCostPrice ?? 0,
    cost_price: item.defaultCostPrice ?? 0,
    default_repair_price: item.defaultRepairPrice ?? 0,
    sale_price: item.defaultRepairPrice ?? 0,
    sort_order: item.sortOrder ?? 0,
    is_active: item.isActive !== false,
    updated_at: new Date().toISOString(),
  };
  if (item.id) row.id = item.id;
  return row;
}

// In-memory runtime state synced strictly from Supabase
let cachedDeviceTypes: DBDeviceType[] = [];
let cachedDeviceModels: DBDeviceModel[] = [];
let cachedRepairTemplates: RepairTemplateItem[] = [];
let isDeviceTypesFetched = false;
let isDeviceModelsFetched = false;
let isRepairTemplatesFetched = false;

function dispatchDbChanged(key: string) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key } }));
  }
}

function saveDeviceTypesToLocalStorage(items: DBDeviceType[]) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('atari_device_types', JSON.stringify(items));
    }
  } catch (e) {
    console.error('Error saving device types to localStorage:', e);
  }
}

function getDeviceTypesFromLocalStorage(): DBDeviceType[] {
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('atari_device_types');
      if (stored !== null) return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Error reading device types from localStorage:', e);
  }
  return [];
}

// ================= DEVICE TYPES SERVICES =================
export async function fetchDeviceTypesFromSupabase(): Promise<DBDeviceType[]> {
  try {
    const response = await supabase
      .from('device_types')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (!response.error && response.data) {
      cachedDeviceTypes = response.data.map(mapRowToDeviceType);
      saveDeviceTypesToLocalStorage(cachedDeviceTypes);
      isDeviceTypesFetched = true;
      return cachedDeviceTypes;
    } else if (response.error) {
      console.warn('⚠️ Supabase device_types notice:', response.error.message);
    }
  } catch (err) {
    console.warn('⚠️ Could not query Supabase device_types table:', err);
  }

  if (!isDeviceTypesFetched) {
    const local = getDeviceTypesFromLocalStorage();
    cachedDeviceTypes = local.length > 0 ? local : DEFAULT_SUPABASE_DEVICE_TYPES;
  }
  isDeviceTypesFetched = true;
  return cachedDeviceTypes;
}

export function getDeviceTypesSync(): DBDeviceType[] {
  if (cachedDeviceTypes.length === 0 && typeof localStorage !== 'undefined') {
    const local = getDeviceTypesFromLocalStorage();
    cachedDeviceTypes = local.length > 0 ? local : DEFAULT_SUPABASE_DEVICE_TYPES;
  }
  return cachedDeviceTypes;
}

export async function addDeviceTypeToSupabase(dt: Omit<DBDeviceType, 'id'>): Promise<DBDeviceType> {
  console.log("Saving device type...", dt);
  const newId = dt.nameAr ? `DT-${Date.now()}` : crypto.randomUUID();
  const fullDt: DBDeviceType = { ...dt, id: newId };
  const row = mapDeviceTypeToRow(fullDt);

  const response = await supabase
    .from('device_types')
    .insert([row])
    .select()
    .single();

  console.log("Supabase response", response);

  if (response.error) {
    console.warn("Supabase notice adding device type:", response.error.message);
    if (response.error.code === 'PGRST205') {
      // Table not present in Supabase schema yet; handle locally
      cachedDeviceTypes = [...cachedDeviceTypes.filter(d => d.id !== fullDt.id), fullDt];
      saveDeviceTypesToLocalStorage(cachedDeviceTypes);
      dispatchDbChanged('atari_device_types');
      return fullDt;
    }
    throw new Error(`تعذر إضافة نوع الجهاز إلى Supabase: [${response.error.code}] ${response.error.message}`);
  }

  const created = mapRowToDeviceType(response.data);
  await fetchDeviceTypesFromSupabase();
  dispatchDbChanged('atari_device_types');
  return created;
}

export async function updateDeviceTypeInSupabase(dt: DBDeviceType): Promise<void> {
  console.log("Saving device type...", dt);
  const row = mapDeviceTypeToRow(dt);

  const response = await supabase
    .from('device_types')
    .update(row)
    .eq('id', dt.id);

  console.log("Supabase response", response);

  if (response.error) {
    console.warn("Supabase notice updating device type:", response.error.message);
    if (response.error.code === 'PGRST205') {
      cachedDeviceTypes = cachedDeviceTypes.map(item => item.id === dt.id ? dt : item);
      saveDeviceTypesToLocalStorage(cachedDeviceTypes);
      dispatchDbChanged('atari_device_types');
      return;
    }
    throw new Error(`تعذر تعديل نوع الجهاز في Supabase: [${response.error.code}] ${response.error.message}`);
  }

  await fetchDeviceTypesFromSupabase();
  dispatchDbChanged('atari_device_types');
}

export async function deleteDeviceTypeInSupabase(id: string): Promise<{ success: boolean; isArchived?: boolean; error?: string }> {
  console.log("Deleting device type...", id);

  // Check for linked models or templates
  const linkedModels = cachedDeviceModels.filter(m => (m.deviceTypeId === id || m.id === id) && !m.isArchived);
  const linkedTemplates = cachedRepairTemplates.filter(t => (t.deviceTypeId === id) && t.isActive);

  let target = cachedDeviceTypes.find(dt => dt.id === id);

  if (linkedModels.length > 0 || linkedTemplates.length > 0) {
    if (target) {
      const archivedDt = { ...target, isArchived: true, isActive: false };
      await updateDeviceTypeInSupabase(archivedDt);
      return {
        success: true,
        isArchived: true,
        error: 'تم أرشفة نوع الجهاز بنجاح بدلاً من الحذف لتعلقه بموديلات أو قوالب صيانة مسجلة.'
      };
    }
  }

  const response = await supabase
    .from('device_types')
    .delete()
    .eq('id', id);

  console.log("Supabase response", response);

  if (response.error) {
    console.warn("Supabase notice deleting device type:", response.error.message);
    if (response.error.code === 'PGRST205') {
      cachedDeviceTypes = cachedDeviceTypes.filter(item => item.id !== id);
      saveDeviceTypesToLocalStorage(cachedDeviceTypes);
      dispatchDbChanged('atari_device_types');
      return { success: true };
    }
    return {
      success: false,
      error: `تعذر حذف نوع الجهاز من Supabase: [${response.error.code}] ${response.error.message}`,
    };
  }

  await fetchDeviceTypesFromSupabase();
  dispatchDbChanged('atari_device_types');
  return { success: true };
}


// ================= DEVICE MODELS SERVICES =================
export async function fetchDeviceModelsFromSupabase(): Promise<DBDeviceModel[]> {
  try {
    const { data, error } = await supabase
      .from('device_models')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (!error && data) {
      cachedDeviceModels = data.map(mapRowToDeviceModel);
      isDeviceModelsFetched = true;
      return cachedDeviceModels;
    } else if (error) {
      console.warn('⚠️ Supabase device_models notice:', error.message);
    }
  } catch (err) {
    console.warn('⚠️ Could not query Supabase device_models table directly:', err);
  }

  if (!isDeviceModelsFetched && cachedDeviceModels.length === 0) {
    cachedDeviceModels = DEFAULT_SUPABASE_DEVICE_MODELS;
  }
  isDeviceModelsFetched = true;
  return cachedDeviceModels;
}

export function getDeviceModelsSync(): DBDeviceModel[] {
  if (cachedDeviceModels.length === 0) {
    cachedDeviceModels = DEFAULT_SUPABASE_DEVICE_MODELS;
  }
  return cachedDeviceModels;
}

export async function addDeviceModelToSupabase(m: Omit<DBDeviceModel, 'id'>): Promise<DBDeviceModel> {
  const newId = `DM-${Date.now()}`;
  const fullModel: DBDeviceModel = { ...m, id: newId };
  const row = mapDeviceModelToRow(fullModel);

  const response = await supabase
    .from('device_models')
    .insert([row])
    .select()
    .single();

  if (response.error) {
    console.warn("Supabase notice adding device model:", response.error.message);
    if (response.error.code === 'PGRST205') {
      cachedDeviceModels = [...cachedDeviceModels.filter(item => item.id !== fullModel.id), fullModel];
      dispatchDbChanged('atari_device_models');
      return fullModel;
    }
    throw new Error(`تعذر إضافة الموديل إلى Supabase: [${response.error.code}] ${response.error.message}`);
  }

  const created = mapRowToDeviceModel(response.data);
  await fetchDeviceModelsFromSupabase();
  dispatchDbChanged('atari_device_models');
  return created;
}

export async function updateDeviceModelInSupabase(m: DBDeviceModel): Promise<void> {
  const row = mapDeviceModelToRow(m);

  const response = await supabase
    .from('device_models')
    .update(row)
    .eq('id', m.id);

  if (response.error) {
    console.warn("Supabase notice updating device model:", response.error.message);
    if (response.error.code === 'PGRST205') {
      cachedDeviceModels = cachedDeviceModels.map(item => item.id === m.id ? m : item);
      dispatchDbChanged('atari_device_models');
      return;
    }
    throw new Error(`تعذر تعديل الموديل في Supabase: [${response.error.code}] ${response.error.message}`);
  }

  await fetchDeviceModelsFromSupabase();
  dispatchDbChanged('atari_device_models');
}

export async function deleteDeviceModelInSupabase(id: string): Promise<{ success: boolean; isArchived?: boolean; error?: string }> {
  const linkedTemplates = cachedRepairTemplates.filter(t => t.deviceModelId === id);
  const target = cachedDeviceModels.find(m => m.id === id);

  if (linkedTemplates.length > 0) {
    if (target) {
      const archived = { ...target, isArchived: true, isActive: false };
      await updateDeviceModelInSupabase(archived);
      return {
        success: true,
        isArchived: true,
        error: 'تم أرشفة الموديل بنجاح لتعلقه بقوالب صيانة سابقة.'
      };
    }
  }

  const response = await supabase
    .from('device_models')
    .delete()
    .eq('id', id);

  if (response.error) {
    console.warn("Supabase notice deleting device model:", response.error.message);
    if (response.error.code === 'PGRST205') {
      cachedDeviceModels = cachedDeviceModels.filter(item => item.id !== id);
      dispatchDbChanged('atari_device_models');
      return { success: true };
    }
    return {
      success: false,
      error: `تعذر حذف الموديل من Supabase: [${response.error.code}] ${response.error.message}`,
    };
  }

  await fetchDeviceModelsFromSupabase();
  dispatchDbChanged('atari_device_models');
  return { success: true };
}


// ================= REPAIR TEMPLATES SERVICES =================
export async function fetchRepairTemplatesFromSupabase(): Promise<RepairTemplateItem[]> {
  try {
    const { data, error } = await supabase
      .from('repair_templates')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });

    if (!error && data) {
      cachedRepairTemplates = data.map(mapRowToRepairTemplate);
      isRepairTemplatesFetched = true;
      return cachedRepairTemplates;
    } else if (error) {
      console.warn('⚠️ Supabase repair_templates notice:', error.message);
    }
  } catch (err) {
    console.warn('⚠️ Could not query Supabase repair_templates table directly:', err);
  }

  if (!isRepairTemplatesFetched && cachedRepairTemplates.length === 0) {
    cachedRepairTemplates = DEFAULT_SUPABASE_REPAIR_TEMPLATES;
  }
  isRepairTemplatesFetched = true;
  return cachedRepairTemplates;
}

export function getRepairTemplatesSync(): RepairTemplateItem[] {
  if (cachedRepairTemplates.length === 0) {
    cachedRepairTemplates = DEFAULT_SUPABASE_REPAIR_TEMPLATES;
  }
  return cachedRepairTemplates;
}

export async function addRepairTemplateToSupabase(item: Omit<RepairTemplateItem, 'id'>): Promise<RepairTemplateItem> {
  const newId = `RPT-${Date.now()}`;
  const fullItem: RepairTemplateItem = { ...item, id: newId };
  const row = mapRepairTemplateToRow(fullItem);

  const response = await supabase
    .from('repair_templates')
    .insert([row])
    .select()
    .single();

  if (response.error) {
    console.warn("Supabase notice adding repair template:", response.error.message);
    if (response.error.code === 'PGRST205') {
      cachedRepairTemplates = [...cachedRepairTemplates.filter(i => i.id !== fullItem.id), fullItem];
      dispatchDbChanged('atari_repair_templates');
      return fullItem;
    }
    throw new Error(`تعذر إضافة قالب الصيانة إلى Supabase: [${response.error.code}] ${response.error.message}`);
  }

  const created = mapRowToRepairTemplate(response.data);
  await fetchRepairTemplatesFromSupabase();
  dispatchDbChanged('atari_repair_templates');
  return created;
}

export async function updateRepairTemplateInSupabase(item: RepairTemplateItem): Promise<void> {
  const row = mapRepairTemplateToRow(item);

  const response = await supabase
    .from('repair_templates')
    .update(row)
    .eq('id', item.id);

  if (response.error) {
    console.warn("Supabase notice updating repair template:", response.error.message);
    if (response.error.code === 'PGRST205') {
      cachedRepairTemplates = cachedRepairTemplates.map(i => i.id === item.id ? item : i);
      dispatchDbChanged('atari_repair_templates');
      return;
    }
    throw new Error(`تعذر تعديل قالب الصيانة في Supabase: [${response.error.code}] ${response.error.message}`);
  }

  await fetchRepairTemplatesFromSupabase();
  dispatchDbChanged('atari_repair_templates');
}

export async function deleteRepairTemplateInSupabase(id: string): Promise<{ success: boolean; error?: string }> {
  const response = await supabase
    .from('repair_templates')
    .delete()
    .eq('id', id);

  if (response.error) {
    console.warn("Supabase notice deleting repair template:", response.error.message);
    if (response.error.code === 'PGRST205') {
      cachedRepairTemplates = cachedRepairTemplates.filter(i => i.id !== id);
      dispatchDbChanged('atari_repair_templates');
      return { success: true };
    }
    return {
      success: false,
      error: `تعذر حذف قالب الصيانة من Supabase: [${response.error.code}] ${response.error.message}`,
    };
  }

  await fetchRepairTemplatesFromSupabase();
  dispatchDbChanged('atari_repair_templates');
  return { success: true };
}

