import { supabase } from './supabaseClient';
import { SystemSettings } from '../types';

const SETTINGS_STORAGE_KEY = 'atari_settings';

const DEFAULT_SETTINGS: SystemSettings = {
  companyName: 'Atari Store Pro X',
  phone: '01002345678',
  address: 'شارع التحرير، وسط البلد، القاهرة',
  receiptHeader: 'Atari Store Pro X\nالمركز الاحترافي لصيانة وبيع أجهزة الألعاب',
  receiptFooter: 'شكراً لزيارتكم! يرجى الاحتفاظ بالفاتورة للصيانة والضمان.',
  whatsAppTemplateReceived: 'مرحباً {customer_name}، تم استلام جهازك {device_model} بنجاح تحت رقم الطلب {order_id}. يمكنك متابعة حالة طلبك عبر هذا الرابط: {tracking_link}',
  whatsAppTemplateReady: 'مرحباً {customer_name}، جهازك {device_model} (رقم الطلب {order_id}) جاهز للاستلام الآن! التكلفة الإجمالية: {total_cost} ج.م.',
  whatsAppTemplateInvoice: 'مرحباً {customer_name}، إليك تفاصيل فاتورة الشراء رقم {invoice_id} بقيمة إجمالية {total_amount} ج.م. شكراً لتعاملك معنا!',
  taxRate: 14,
  currency: 'ج.م.',
};

/**
 * Maps a Supabase row (snake_case or camelCase) to the TypeScript SystemSettings interface.
 */
export function mapRowToSettings(row: Record<string, any>): SystemSettings {
  return {
    companyName: row.company_name ?? row.companyName ?? row.company_title ?? row.title ?? DEFAULT_SETTINGS.companyName,
    phone: row.phone ?? row.company_phone ?? row.phone_number ?? DEFAULT_SETTINGS.phone,
    address: row.address ?? row.company_address ?? DEFAULT_SETTINGS.address,
    logoUrl: row.logo_url ?? row.logoUrl ?? '',
    receiptHeader: row.receipt_header ?? row.receiptHeader ?? DEFAULT_SETTINGS.receiptHeader,
    receiptFooter: row.receipt_footer ?? row.receiptFooter ?? DEFAULT_SETTINGS.receiptFooter,
    whatsAppTemplateReceived: row.whatsapp_template_received ?? row.whatsAppTemplateReceived ?? row.whatsapp_received ?? DEFAULT_SETTINGS.whatsAppTemplateReceived,
    whatsAppTemplateReady: row.whatsapp_template_ready ?? row.whatsAppTemplateReady ?? row.whatsapp_ready ?? DEFAULT_SETTINGS.whatsAppTemplateReady,
    whatsAppTemplateInvoice: row.whatsapp_template_invoice ?? row.whatsAppTemplateInvoice ?? row.whatsapp_invoice ?? DEFAULT_SETTINGS.whatsAppTemplateInvoice,
    taxRate: typeof row.tax_rate === 'number' ? row.tax_rate : typeof row.taxRate === 'number' ? row.taxRate : Number(row.tax_rate || row.taxRate || DEFAULT_SETTINGS.taxRate),
    currency: row.currency ?? DEFAULT_SETTINGS.currency,
  };
}

/**
 * Maps a SystemSettings object to a Supabase database row (snake_case).
 */
export function mapSettingsToRow(settings: SystemSettings, existingRow?: Record<string, any>): Record<string, any> {
  const row: Record<string, any> = {
    id: existingRow && existingRow.id !== undefined ? existingRow.id : 1,
    company_name: settings.companyName,
    phone: settings.phone,
    address: settings.address,
    receipt_header: settings.receiptHeader,
    receipt_footer: settings.receiptFooter,
    whatsapp_template_received: settings.whatsAppTemplateReceived,
    whatsapp_template_ready: settings.whatsAppTemplateReady,
    whatsapp_template_invoice: settings.whatsAppTemplateInvoice,
    tax_rate: Number(settings.taxRate) || 0,
    currency: settings.currency || 'ج.م.',
    updated_at: new Date().toISOString(),
  };

  return row;
}

/**
 * Helper to safely get local settings from localStorage without throwing.
 */
function getLocalSettings(): SystemSettings {
  try {
    if (typeof localStorage !== 'undefined') {
      const item = localStorage.getItem(SETTINGS_STORAGE_KEY);
      if (item) return JSON.parse(item);
    }
  } catch (e) {
    console.error('Error reading local settings:', e);
  }
  return DEFAULT_SETTINGS;
}

/**
 * Helper to update localStorage settings.
 */
function setLocalSettings(settings: SystemSettings, dispatchEvent = true) {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
      if (dispatchEvent) {
        window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: SETTINGS_STORAGE_KEY } }));
      }
    }
  } catch (e) {
    console.error('Error saving local settings:', e);
  }
}

/**
 * Step 1-4: Fetch store_settings from Supabase.
 * - If settings exist in Supabase, use them and sync to local storage.
 * - If not in Supabase, keep the safe local defaults until an authorized owner
 *   explicitly saves the settings.
 * - Leaves all other collections untouched.
 */
export async function fetchOrMigrateStoreSettings(): Promise<SystemSettings> {
  const localSettings = getLocalSettings();

  try {
    // Public pages use the local defaults. Avoid querying a protected table
    // anonymously and avoid the noisy, expected RLS rejection on every load.
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      return localSettings;
    }

    const { data, error } = await supabase.from('store_settings').select('*').limit(1);

    if (error) {
      console.warn('⚠️ Could not fetch store_settings from Supabase:', error.message);
      return localSettings;
    }

    if (data && data.length > 0) {
      // 2. Data exists in Supabase -> Use it!
      const supabaseRow = data[0];
      const settingsFromSupabase = mapRowToSettings(supabaseRow);

      // Save to localStorage so local state is synchronized
      setLocalSettings(settingsFromSupabase, false);
      console.log('✅ Loaded store_settings directly from Supabase');
      return settingsFromSupabase;
    }

    // Never write from the public tracking/login pages. Writing defaults here
    // caused an expected RLS rejection on every anonymous page load.
    return localSettings;
  } catch (err: any) {
    console.error('❌ Error during store_settings migration:', err);
    return localSettings;
  }
}

/**
 * Save / sync updated settings to Supabase table store_settings.
 */
export async function saveStoreSettingsToSupabase(newSettings: SystemSettings): Promise<void> {
  // Always update local storage first so the app is instantly responsive
  setLocalSettings(newSettings);

  try {
    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session?.user) {
      console.warn('⚠️ Skipping store_settings sync because no authenticated session is available.');
      return;
    }

    const { data } = await supabase.from('store_settings').select('*').limit(1);
    const existingRow = data && data.length > 0 ? data[0] : undefined;

    const rowToSave = mapSettingsToRow(newSettings, existingRow);

    const { error } = await supabase.from('store_settings').upsert([rowToSave]);

    if (error) {
      console.warn('⚠️ Failed to sync store_settings to Supabase:', error.message);
    } else {
      console.log('✅ store_settings updated in Supabase');
    }
  } catch (err: any) {
    console.error('❌ Error saving store_settings to Supabase:', err);
  }
}
