-- =============================================================================
-- Migration: 20260724_create_reset_operational_data_rpc.sql
-- Description: Create permanent system_reset_security_logs table and atomic
--              reset_operational_data RPC for PostgreSQL / Supabase
-- =============================================================================

-- 1. Ensure permanent system_reset_security_logs table exists
CREATE TABLE IF NOT EXISTS public.system_reset_security_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    executed_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    executed_by_user_name TEXT NOT NULL,
    executed_by_user_email TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    wiped_sections TEXT[] NOT NULL DEFAULT '{}',
    record_counts_wiped JSONB NOT NULL DEFAULT '{}'::jsonb,
    inventory_mode TEXT NOT NULL DEFAULT 'PRESERVED',
    backup_file_name TEXT,
    status TEXT NOT NULL DEFAULT 'SUCCESS',
    details TEXT
);

-- Enable RLS on system_reset_security_logs
ALTER TABLE public.system_reset_security_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users view system_reset_security_logs'
    ) THEN
        CREATE POLICY "Authenticated users view system_reset_security_logs"
            ON public.system_reset_security_logs FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

-- 2. Atomic Operational Reset RPC Function
CREATE OR REPLACE FUNCTION public.reset_operational_data(force_failure boolean DEFAULT false)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_user_role TEXT;
    v_user_name TEXT;
    v_user_email TEXT;
    v_start_time TIMESTAMPTZ := clock_timestamp();
    v_execution_time_ms INTEGER;

    -- Row counts for deleted tables
    v_cnt_invoice_acct_ledger INTEGER := 0;
    v_cnt_partner_payments INTEGER := 0;
    v_cnt_partner_settlements INTEGER := 0;
    v_cnt_partner_trans INTEGER := 0;
    v_cnt_settlement_audit INTEGER := 0;
    v_cnt_partner_ledger INTEGER := 0;
    v_cnt_replacement_fund INTEGER := 0;
    v_cnt_invoice_items INTEGER := 0;
    v_cnt_repair_part_usages INTEGER := 0;
    v_cnt_repair_orders INTEGER := 0;
    v_cnt_inventory_movements INTEGER := 0;
    v_cnt_expenses INTEGER := 0;
    v_cnt_invoices INTEGER := 0;
    v_cnt_customers INTEGER := 0;
    v_cnt_suppliers INTEGER := 0;
    v_cnt_activity_logs INTEGER := 0;
    v_cnt_audit_logs INTEGER := 0;
    v_cnt_notifications INTEGER := 0;

    v_deleted_counts JSONB;
    v_retained_tables JSONB;
    v_result JSONB;
BEGIN
    -- 1. Security & Authentication Check inside Database
    v_user_id := auth.uid();

    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        LEFT JOIN public.user_roles ur ON p.role_id = ur.id
        WHERE p.id = v_user_id
          AND UPPER(COALESCE(ur.name, p.role, '')) = 'OWNER'
    ) THEN
        RAISE EXCEPTION 'Only OWNER can reset operational data';
    END IF;

    -- Fetch user profile details from DB for security log
    SELECT COALESCE(p.role, 'OWNER'), COALESCE(p.full_name, p.username, 'OWNER'), COALESCE(p.email, '')
    INTO v_user_role, v_user_name, v_user_email
    FROM public.profiles p
    WHERE p.id = v_user_id;

    -- 2. Execute deletion sequence in strict FK order safely checking table existence
    IF to_regclass('public.partner_settlement_payments') IS NOT NULL THEN
        DELETE FROM public.partner_settlement_payments;
        GET DIAGNOSTICS v_cnt_partner_payments = ROW_COUNT;
    END IF;

    IF to_regclass('public.partner_settlements') IS NOT NULL THEN
        DELETE FROM public.partner_settlements;
        GET DIAGNOSTICS v_cnt_partner_settlements = ROW_COUNT;
    END IF;

    IF to_regclass('public.partner_transactions') IS NOT NULL THEN
        DELETE FROM public.partner_transactions;
        GET DIAGNOSTICS v_cnt_partner_trans = ROW_COUNT;
    END IF;

    IF to_regclass('public.settlement_audit_logs') IS NOT NULL THEN
        DELETE FROM public.settlement_audit_logs;
        GET DIAGNOSTICS v_cnt_settlement_audit = ROW_COUNT;
    END IF;

    IF to_regclass('public.partner_ledger') IS NOT NULL THEN
        DELETE FROM public.partner_ledger;
        GET DIAGNOSTICS v_cnt_partner_ledger = ROW_COUNT;
    END IF;

    IF to_regclass('public.invoice_items') IS NOT NULL THEN
        DELETE FROM public.invoice_items;
        GET DIAGNOSTICS v_cnt_invoice_items = ROW_COUNT;
    END IF;

    IF to_regclass('public.repair_part_usages') IS NOT NULL THEN
        DELETE FROM public.repair_part_usages;
        GET DIAGNOSTICS v_cnt_repair_part_usages = ROW_COUNT;
    END IF;

    IF to_regclass('public.repair_orders') IS NOT NULL THEN
        DELETE FROM public.repair_orders;
        GET DIAGNOSTICS v_cnt_repair_orders = ROW_COUNT;
    END IF;

    IF to_regclass('public.inventory_movements') IS NOT NULL THEN
        DELETE FROM public.inventory_movements;
        GET DIAGNOSTICS v_cnt_inventory_movements = ROW_COUNT;
    END IF;

    -- Zero out product stock quantities if products table exists
    IF to_regclass('public.products') IS NOT NULL THEN
        UPDATE public.products SET quantity = 0;
    END IF;

    IF to_regclass('public.expenses') IS NOT NULL THEN
        DELETE FROM public.expenses;
        GET DIAGNOSTICS v_cnt_expenses = ROW_COUNT;
    END IF;

    IF to_regclass('public.invoices') IS NOT NULL THEN
        DELETE FROM public.invoices;
        GET DIAGNOSTICS v_cnt_invoices = ROW_COUNT;
    END IF;

    IF to_regclass('public.customers') IS NOT NULL THEN
        DELETE FROM public.customers;
        GET DIAGNOSTICS v_cnt_customers = ROW_COUNT;
    END IF;

    IF to_regclass('public.suppliers') IS NOT NULL THEN
        DELETE FROM public.suppliers;
        GET DIAGNOSTICS v_cnt_suppliers = ROW_COUNT;
    END IF;

    IF to_regclass('public.activity_logs') IS NOT NULL THEN
        DELETE FROM public.activity_logs;
        GET DIAGNOSTICS v_cnt_activity_logs = ROW_COUNT;
    END IF;

    IF to_regclass('public.audit_logs') IS NOT NULL THEN
        DELETE FROM public.audit_logs;
        GET DIAGNOSTICS v_cnt_audit_logs = ROW_COUNT;
    END IF;

    IF to_regclass('public.system_notifications') IS NOT NULL THEN
        DELETE FROM public.system_notifications;
        GET DIAGNOSTICS v_cnt_notifications = ROW_COUNT;
    END IF;

    -- 3. Controlled Rollback Test Hook (Development Only)
    IF force_failure THEN
        RAISE EXCEPTION 'فشل متعمد لاختبار التراجع (Rollback Test)';
    END IF;

    -- 4. Audit Log Entry within the same Transaction
    v_execution_time_ms := ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000)::INTEGER;

    v_deleted_counts := jsonb_build_object(
        'invoice_accounting_ledger', v_cnt_invoice_acct_ledger,
        'partner_settlement_payments', v_cnt_partner_payments,
        'partner_settlements', v_cnt_partner_settlements,
        'partner_transactions', v_cnt_partner_trans,
        'settlement_audit_logs', v_cnt_settlement_audit,
        'partner_ledger', v_cnt_partner_ledger,
        'replacement_fund_ledger', v_cnt_replacement_fund,
        'invoice_items', v_cnt_invoice_items,
        'repair_part_usages', v_cnt_repair_part_usages,
        'repair_orders', v_cnt_repair_orders,
        'inventory_movements', v_cnt_inventory_movements,
        'expenses', v_cnt_expenses,
        'invoices', v_cnt_invoices,
        'customers', v_cnt_customers,
        'suppliers', v_cnt_suppliers,
        'activity_logs', v_cnt_activity_logs,
        'audit_logs', v_cnt_audit_logs,
        'system_notifications', v_cnt_notifications
    );

    v_retained_tables := jsonb_build_array(
        jsonb_build_object('name', 'products', 'status', 'محفوظة بالكامل مع الاحتفاظ بالأسعار والبار كود وتصفير كمية المخزون (quantity = 0)'),
        jsonb_build_object('name', 'categories', 'status', 'محفوظة بالكامل'),
        jsonb_build_object('name', 'store_settings', 'status', 'محفوظة بالكامل'),
        jsonb_build_object('name', 'profiles', 'status', 'محفوظة بالكامل بنفس الصلاحيات والأدوار'),
        jsonb_build_object('name', 'system_reset_security_logs', 'status', 'محفوظ بسجل أمان غير قابل للتعديل')
    );

    INSERT INTO public.system_reset_security_logs (
        executed_by_user_id,
        executed_by_user_name,
        executed_by_user_email,
        timestamp,
        wiped_sections,
        record_counts_wiped,
        inventory_mode,
        status,
        details
    ) VALUES (
        v_user_id,
        v_user_name,
        v_user_email,
        NOW(),
        ARRAY['invoices', 'repair_orders', 'expenses', 'partner_ledger', 'customers', 'suppliers', 'inventory_movements'],
        v_deleted_counts,
        'PRESERVED',
        'SUCCESS',
        'تم تنفيذ تصفير بيانات التشغيل بنجاح مع الاحتفاظ بالأصناف والإعدادات والمستخدمين.'
    );

    -- 5. Construct Final Result Object
    v_result := jsonb_build_object(
        'success', true,
        'executed_by', v_user_name,
        'executed_at', NOW(),
        'duration_ms', v_execution_time_ms,
        'deleted_counts', v_deleted_counts,
        'retained_tables', v_retained_tables,
        'message', 'تم تصفير بيانات التشغيل بنجاح داخل Atomic PostgreSQL Transaction'
    );

    RETURN v_result;
END;
$$;

-- Overload for zero arguments PostgREST schema cache compatibility
CREATE OR REPLACE FUNCTION public.reset_operational_data()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.reset_operational_data(false);
END;
$$;

-- Strict Execution Permissions
REVOKE ALL ON FUNCTION public.reset_operational_data(boolean) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_operational_data(boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.reset_operational_data(boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.reset_operational_data() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.reset_operational_data() FROM anon;
GRANT EXECUTE ON FUNCTION public.reset_operational_data() TO authenticated;
