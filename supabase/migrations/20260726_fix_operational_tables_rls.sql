-- Fix RLS Policies and Enforce SECURITY DEFINER Reset RPC
-- 1. Restricts operational tables to authenticated users ONLY (reverts any public open policies).
-- 2. Enforces reset_operational_data SECURITY DEFINER RPC with internal OWNER check.

-- SECTION 1: RESTRICT OPERATIONAL TABLES TO AUTHENTICATED USERS ONLY (NO PUBLIC)

DROP POLICY IF EXISTS "Public manage inventory_movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "Authenticated users manage inventory_movements" ON public.inventory_movements;
CREATE POLICY "Authenticated users manage inventory_movements" 
    ON public.inventory_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public manage partner_ledger" ON public.partner_ledger;
DROP POLICY IF EXISTS "Authenticated users manage partner_ledger" ON public.partner_ledger;
CREATE POLICY "Authenticated users manage partner_ledger" 
    ON public.partner_ledger FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public manage expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users manage expenses" ON public.expenses;
CREATE POLICY "Authenticated users manage expenses" 
    ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users manage invoices" ON public.invoices;
CREATE POLICY "Authenticated users manage invoices" 
    ON public.invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public manage invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "Authenticated users manage invoice_items" ON public.invoice_items;
CREATE POLICY "Authenticated users manage invoice_items" 
    ON public.invoice_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public manage repair_part_usages" ON public.repair_part_usages;
DROP POLICY IF EXISTS "Authenticated users manage repair_part_usages" ON public.repair_part_usages;
CREATE POLICY "Authenticated users manage repair_part_usages" 
    ON public.repair_part_usages FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public manage suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users manage suppliers" ON public.suppliers;
CREATE POLICY "Authenticated users manage suppliers" 
    ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public manage activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Authenticated users manage activity_logs" ON public.activity_logs;
CREATE POLICY "Authenticated users manage activity_logs" 
    ON public.activity_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public manage audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Authenticated users manage audit_logs" ON public.audit_logs;
CREATE POLICY "Authenticated users manage audit_logs" 
    ON public.audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Public manage system_notifications" ON public.system_notifications;
DROP POLICY IF EXISTS "Authenticated users manage system_notifications" ON public.system_notifications;
CREATE POLICY "Authenticated users manage system_notifications" 
    ON public.system_notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- SECTION 2: SECURITY DEFINER OPERATIONAL RESET RPC FUNCTION

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

    -- Counters for deleted rows
    v_cnt_invoice_acct_ledger INTEGER := 0;
    v_cnt_partner_payments INTEGER := 0;
    v_cnt_partner_settlements INTEGER := 0;
    v_cnt_partner_trans INTEGER := 0;
    v_cnt_settlement_audit INTEGER := 0;
    v_cnt_partner_ledger INTEGER := 0;
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
        RAISE EXCEPTION 'Authentication required / يتطلب هذا الإجراء تسجيل الدخول أولاً';
    END IF;

    -- Check if authenticated user possesses OWNER role
    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        LEFT JOIN public.user_roles ur ON p.role_id = ur.id
        WHERE p.id = v_user_id
          AND UPPER(COALESCE(ur.name, p.role, '')) = 'OWNER'
    ) THEN
        RAISE EXCEPTION 'Only OWNER can reset operational data / عذراً، يجب التواجد بحساب المالك (OWNER) لتصفير البيانات';
    END IF;

    -- Fetch user profile details for security audit log
    SELECT COALESCE(p.role, 'OWNER'), COALESCE(p.full_name, p.username, 'OWNER'), COALESCE(p.email, '')
    INTO v_user_role, v_user_name, v_user_email
    FROM public.profiles p
    WHERE p.id = v_user_id;

    -- 2. Execute deletion sequence in strict FK dependency order
    IF to_regclass('public.invoice_accounting_ledger') IS NOT NULL THEN
        DELETE FROM public.invoice_accounting_ledger;
        GET DIAGNOSTICS v_cnt_invoice_acct_ledger = ROW_COUNT;
    END IF;

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

    -- Zero out stock quantities while preserving catalog items, barcodes, and SKUs
    IF to_regclass('public.products') IS NOT NULL THEN
        UPDATE public.products SET quantity = 0;
    END IF;

    -- 3. Controlled Rollback Test Hook
    IF force_failure THEN
        RAISE EXCEPTION 'فشل متعمد لاختبار التراجع (Rollback Test)';
    END IF;

    -- 4. Security Audit Logging inside system_reset_security_logs
    v_execution_time_ms := ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000)::INTEGER;

    v_deleted_counts := jsonb_build_object(
        'invoice_accounting_ledger', v_cnt_invoice_acct_ledger,
        'partner_settlement_payments', v_cnt_partner_payments,
        'partner_settlements', v_cnt_partner_settlements,
        'partner_transactions', v_cnt_partner_trans,
        'settlement_audit_logs', v_cnt_settlement_audit,
        'partner_ledger', v_cnt_partner_ledger,
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

    IF to_regclass('public.system_reset_security_logs') IS NOT NULL THEN
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
            COALESCE(v_user_name, 'OWNER'),
            COALESCE(v_user_email, ''),
            NOW(),
            ARRAY['invoices', 'repair_orders', 'expenses', 'partner_ledger', 'customers', 'suppliers', 'inventory_movements'],
            v_deleted_counts,
            'PRESERVED',
            'SUCCESS',
            'تم تنفيذ تصفير بيانات التشغيل بنجاح مع الاحتفاظ بالأصناف والإعدادات والمستخدمين.'
        );
    END IF;

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

-- SECTION 3: STRICT EXECUTION PERMISSIONS ON RPC FUNCTION
REVOKE ALL ON FUNCTION public.reset_operational_data(boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_operational_data(boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.reset_operational_data(boolean) TO authenticated;

REVOKE ALL ON FUNCTION public.reset_operational_data() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.reset_operational_data() FROM anon;
GRANT EXECUTE ON FUNCTION public.reset_operational_data() TO authenticated;
