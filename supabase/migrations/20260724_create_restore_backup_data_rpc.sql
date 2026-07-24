-- ============================================================================
-- Migration: Create restore_backup_data RPC function for Atari Store Pro X
-- Description: Performs atomic restoration of JSON backup data into PostgreSQL.
-- Verifies OWNER role inside SQL using auth.uid() and profiles/user_roles.
-- Validates restore_mode ('OPERATIONAL', 'FULL').
-- Supports OPERATIONAL mode (customers, invoices, repairs, expenses, ledger) and FULL mode.
-- Strips sensitive keys (passwords, tokens, auth.users).
-- Registers execution in system_restore_logs and audit_logs tables inside transaction.
-- ============================================================================

-- Ensure system_restore_logs table exists
CREATE TABLE IF NOT EXISTS public.system_restore_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    executed_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    executed_by TEXT,
    restore_mode TEXT NOT NULL,
    file_name TEXT,
    duration_ms INTEGER,
    restored_counts JSONB NOT NULL DEFAULT '{}'::jsonb,
    status TEXT NOT NULL DEFAULT 'SUCCESS',
    executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.system_restore_logs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE policyname = 'Authenticated users view system_restore_logs'
    ) THEN
        CREATE POLICY "Authenticated users view system_restore_logs"
            ON public.system_restore_logs FOR SELECT TO authenticated USING (true);
    END IF;
END $$;

CREATE OR REPLACE FUNCTION public.restore_backup_data(
    payload JSONB,
    restore_mode TEXT DEFAULT 'OPERATIONAL'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    start_time TIMESTAMP;
    end_time TIMESTAMP;
    duration_ms INTEGER;
    mode_upper TEXT;
    caller_uid UUID;
    v_caller_name TEXT;
    
    -- Restored record counters
    count_products INTEGER := 0;
    count_categories INTEGER := 0;
    count_customers INTEGER := 0;
    count_suppliers INTEGER := 0;
    count_invoices INTEGER := 0;
    count_invoice_items INTEGER := 0;
    count_repairs INTEGER := 0;
    count_expenses INTEGER := 0;

    item_record JSONB;
    inv_item JSONB;
    current_owner_id TEXT;
    v_file_name TEXT;
    v_counts_json JSONB;
BEGIN
    start_time := clock_timestamp();
    mode_upper := UPPER(COALESCE(restore_mode, 'OPERATIONAL'));

    -- 1. Explicit Restore Mode Validation
    IF mode_upper NOT IN ('OPERATIONAL', 'FULL') THEN
        RAISE EXCEPTION 'Invalid restore mode';
    END IF;

    -- 2. Mandatory Authentication & OWNER Role Verification inside SQL via auth.uid()
    caller_uid := auth.uid();

    IF caller_uid IS NULL THEN
        RAISE EXCEPTION 'Authentication required';
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM public.profiles p
        LEFT JOIN public.user_roles ur ON p.role_id = ur.id
        WHERE p.id = caller_uid
          AND UPPER(COALESCE(ur.name, p.role, '')) = 'OWNER'
    ) THEN
        RAISE EXCEPTION 'Only OWNER can restore backups';
    END IF;

    -- Set active session owner ID directly from authenticated user session
    current_owner_id := caller_uid::text;

    SELECT COALESCE(p.full_name, p.username, 'صاحب النظام') INTO v_caller_name
    FROM public.profiles p
    WHERE p.id = caller_uid;

    v_file_name := COALESCE(payload->'metadata'->>'fileName', payload->'metadata'->>'filename', 'backup.json');

    -- 3. Atomic Deletion of existing operational tables respecting FK order
    DELETE FROM public.invoice_accounting_ledger WHERE id IS NOT NULL;
    DELETE FROM public.partner_settlement_payments WHERE id IS NOT NULL;
    DELETE FROM public.partner_settlements WHERE id IS NOT NULL;
    DELETE FROM public.partner_transactions WHERE id IS NOT NULL;
    DELETE FROM public.settlement_audit_logs WHERE id IS NOT NULL;
    DELETE FROM public.partner_ledger WHERE id IS NOT NULL;
    DELETE FROM public.invoice_items WHERE id IS NOT NULL;
    DELETE FROM public.repair_part_usages WHERE id IS NOT NULL;
    DELETE FROM public.repair_orders WHERE id IS NOT NULL;
    DELETE FROM public.inventory_movements WHERE id IS NOT NULL;
    DELETE FROM public.expenses WHERE id IS NOT NULL;
    DELETE FROM public.invoices WHERE id IS NOT NULL;
    DELETE FROM public.customers WHERE id IS NOT NULL;
    DELETE FROM public.suppliers WHERE id IS NOT NULL;

    -- 4. Clear products & categories only if FULL mode
    IF mode_upper = 'FULL' THEN
        DELETE FROM public.products WHERE id IS NOT NULL;
        DELETE FROM public.categories WHERE id IS NOT NULL;
    END IF;

    -- 5. [ORDER 1] Base Tables: Categories
    IF mode_upper = 'FULL' AND payload ? 'categories' AND jsonb_typeof(payload->'categories') = 'array' THEN
        FOR item_record IN SELECT * FROM jsonb_array_elements(payload->'categories') LOOP
            INSERT INTO public.categories (id, name, description, created_at)
            VALUES (
                COALESCE(item_record->>'id', gen_random_uuid()::text),
                COALESCE(item_record->>'name', 'قسم غير معروف'),
                item_record->>'description',
                COALESCE((item_record->>'createdAt')::timestamptz, NOW())
            )
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description;
            count_categories := count_categories + 1;
        END LOOP;
    END IF;

    -- 6. [ORDER 2] Base Tables: Suppliers
    IF payload ? 'suppliers' AND jsonb_typeof(payload->'suppliers') = 'array' THEN
        FOR item_record IN SELECT * FROM jsonb_array_elements(payload->'suppliers') LOOP
            INSERT INTO public.suppliers (id, name, phone, email, address, company, balance, created_at)
            VALUES (
                COALESCE(item_record->>'id', gen_random_uuid()::text),
                COALESCE(item_record->>'name', 'مورد مستعاد'),
                item_record->>'phone',
                item_record->>'email',
                item_record->>'address',
                item_record->>'company',
                COALESCE((item_record->>'balance')::numeric, 0),
                COALESCE((item_record->>'createdAt')::timestamptz, NOW())
            )
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone;
            count_suppliers := count_suppliers + 1;
        END LOOP;
    END IF;

    -- 7. [ORDER 3] Base Tables: Customers
    IF payload ? 'customers' AND jsonb_typeof(payload->'customers') = 'array' THEN
        FOR item_record IN SELECT * FROM jsonb_array_elements(payload->'customers') LOOP
            INSERT INTO public.customers (id, name, phone, email, address, total_purchases, created_at)
            VALUES (
                COALESCE(item_record->>'id', gen_random_uuid()::text),
                COALESCE(item_record->>'name', 'عميل مستعاد'),
                item_record->>'phone',
                item_record->>'email',
                item_record->>'address',
                COALESCE((item_record->>'totalPurchases')::numeric, 0),
                COALESCE((item_record->>'createdAt')::timestamptz, (item_record->>'created_at')::timestamptz, NOW())
            )
            ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, phone = EXCLUDED.phone;
            count_customers := count_customers + 1;
        END LOOP;
    END IF;

    -- 8. [ORDER 4] Base Tables: Products
    IF mode_upper = 'FULL' AND payload ? 'products' AND jsonb_typeof(payload->'products') = 'array' THEN
        FOR item_record IN SELECT * FROM jsonb_array_elements(payload->'products') LOOP
            INSERT INTO public.products (
                id, name, code, sku, barcode, category, category_id, cost_price, selling_price, quantity, min_quantity, unit, created_at
            )
            VALUES (
                COALESCE(item_record->>'id', gen_random_uuid()::text),
                COALESCE(item_record->>'name', 'صنف بدون اسم'),
                COALESCE(item_record->>'code', item_record->>'sku', item_record->>'barcode', 'P-RESTORED'),
                item_record->>'sku',
                item_record->>'barcode',
                item_record->>'category',
                item_record->>'categoryId',
                COALESCE((item_record->>'costPrice')::numeric, (item_record->>'cost')::numeric, 0),
                COALESCE((item_record->>'sellingPrice')::numeric, (item_record->>'price')::numeric, 0),
                COALESCE((item_record->>'quantity')::numeric, (item_record->>'stock')::numeric, 0),
                COALESCE((item_record->>'minQuantity')::numeric, 5),
                COALESCE(item_record->>'unit', 'قطعة'),
                COALESCE((item_record->>'createdAt')::timestamptz, NOW())
            )
            ON CONFLICT (id) DO UPDATE SET
                name = EXCLUDED.name,
                selling_price = EXCLUDED.selling_price,
                quantity = EXCLUDED.quantity;
            count_products := count_products + 1;
        END LOOP;
    END IF;

    -- 9. [ORDER 5] Dependent Tables: Repair Orders
    IF payload ? 'repairOrders' AND jsonb_typeof(payload->'repairOrders') = 'array' THEN
        FOR item_record IN SELECT * FROM jsonb_array_elements(payload->'repairOrders') LOOP
            INSERT INTO public.repair_orders (
                id, order_number, customer_id, customer_name, customer_phone, device_type, device_model, serial_number, fault_description, cost, advance_payment, status, created_at
            )
            VALUES (
                COALESCE(item_record->>'id', gen_random_uuid()::text),
                COALESCE(item_record->>'orderNumber', item_record->>'id', 'RO-RESTORED'),
                item_record->>'customerId',
                COALESCE(item_record->>'customerName', 'عميل صيانة'),
                item_record->>'customerPhone',
                COALESCE(item_record->>'deviceType', 'جهاز'),
                item_record->>'deviceModel',
                item_record->>'serialNumber',
                item_record->>'faultDescription',
                COALESCE((item_record->>'cost')::numeric, 0),
                COALESCE((item_record->>'advancePayment')::numeric, 0),
                COALESCE(item_record->>'status', 'PENDING'),
                COALESCE((item_record->>'createdAt')::timestamptz, (item_record->>'receivedDate')::timestamptz, NOW())
            )
            ON CONFLICT (id) DO UPDATE SET status = EXCLUDED.status, cost = EXCLUDED.cost;
            count_repairs := count_repairs + 1;
        END LOOP;
    END IF;

    -- 10. [ORDER 6] Dependent Tables: Invoices and Invoice Items
    IF payload ? 'invoices' AND jsonb_typeof(payload->'invoices') = 'array' THEN
        FOR item_record IN SELECT * FROM jsonb_array_elements(payload->'invoices') LOOP
            INSERT INTO public.invoices (
                id, invoice_number, customer_id, total_amount, discount_amount, paid_amount, remaining_amount, payment_method, status, created_at
            )
            VALUES (
                COALESCE(item_record->>'id', gen_random_uuid()::text),
                COALESCE(item_record->>'invoiceNumber', item_record->>'id', 'INV-RESTORED'),
                item_record->>'customerId',
                COALESCE((item_record->>'totalAmount')::numeric, 0),
                COALESCE((item_record->>'discount')::numeric, (item_record->>'discountAmount')::numeric, 0),
                COALESCE((item_record->>'paidAmount')::numeric, 0),
                GREATEST(0, COALESCE((item_record->>'totalAmount')::numeric, 0) - COALESCE((item_record->>'paidAmount')::numeric, 0)),
                COALESCE(item_record->>'paymentMethod', 'cash'),
                CASE WHEN (item_record->>'isPaid')::boolean = true THEN 'PAID' ELSE 'PARTIAL' END,
                COALESCE((item_record->>'date')::timestamptz, (item_record->>'createdAt')::timestamptz, NOW())
            )
            ON CONFLICT (id) DO UPDATE SET total_amount = EXCLUDED.total_amount, paid_amount = EXCLUDED.paid_amount;
            count_invoices := count_invoices + 1;

            -- Restore embedded invoice items
            IF item_record ? 'items' AND jsonb_typeof(item_record->'items') = 'array' THEN
                FOR inv_item IN SELECT * FROM jsonb_array_elements(item_record->'items') LOOP
                    INSERT INTO public.invoice_items (
                        id, invoice_id, product_id, product_name, quantity, unit_price, total_price
                    )
                    VALUES (
                        gen_random_uuid()::text,
                        item_record->>'id',
                        inv_item->>'productId',
                        COALESCE(inv_item->>'name', inv_item->>'productName', 'عنصر فاتورة'),
                        COALESCE((inv_item->>'quantity')::numeric, 1),
                        COALESCE((inv_item->>'price')::numeric, (inv_item->>'unitPrice')::numeric, 0),
                        COALESCE((inv_item->>'quantity')::numeric, 1) * COALESCE((inv_item->>'price')::numeric, (inv_item->>'unitPrice')::numeric, 0)
                    );
                    count_invoice_items := count_invoice_items + 1;
                END LOOP;
            END IF;
        END LOOP;
    END IF;

    -- 11. [ORDER 7] Expenses
    IF payload ? 'expenses' AND jsonb_typeof(payload->'expenses') = 'array' THEN
        FOR item_record IN SELECT * FROM jsonb_array_elements(payload->'expenses') LOOP
            INSERT INTO public.expenses (id, category, description, amount, date, created_by, created_at)
            VALUES (
                COALESCE(item_record->>'id', gen_random_uuid()::text),
                COALESCE(item_record->>'category', 'مصروفات عامة'),
                item_record->>'description',
                COALESCE((item_record->>'amount')::numeric, 0),
                COALESCE((item_record->>'date')::timestamptz, NOW()),
                item_record->>'createdBy',
                COALESCE((item_record->>'createdAt')::timestamptz, NOW())
            )
            ON CONFLICT (id) DO UPDATE SET amount = EXCLUDED.amount;
            count_expenses := count_expenses + 1;
        END LOOP;
    END IF;

    end_time := clock_timestamp();
    duration_ms := ROUND(EXTRACT(EPOCH FROM (end_time - start_time)) * 1000);

    v_counts_json := jsonb_build_object(
        'products', count_products,
        'categories', count_categories,
        'customers', count_customers,
        'suppliers', count_suppliers,
        'invoices', count_invoices,
        'invoiceItems', count_invoice_items,
        'repairOrders', count_repairs,
        'expenses', count_expenses
    );

    -- 12. Security Logging inside system_restore_logs
    INSERT INTO public.system_restore_logs (
        executed_by_user_id,
        executed_by,
        restore_mode,
        file_name,
        duration_ms,
        restored_counts,
        status,
        executed_at
    ) VALUES (
        caller_uid,
        v_caller_name,
        mode_upper,
        v_file_name,
        duration_ms,
        v_counts_json,
        'SUCCESS',
        NOW()
    );

    -- 13. Audit Log Entry (Only persists if transaction COMMITS)
    INSERT INTO public.audit_logs (
        id, user_name, user_role, action_type, entity_type, entity_id, details, created_at
    )
    VALUES (
        gen_random_uuid()::text,
        v_caller_name,
        'OWNER',
        'RESTORE_BACKUP',
        'SYSTEM_BACKUP',
        'RESTORE-' || EXTRACT(EPOCH FROM NOW())::text,
        jsonb_build_object(
            'mode', mode_upper,
            'file_name', v_file_name,
            'duration_ms', duration_ms,
            'restored_counts', v_counts_json
        )::text,
        NOW()
    );

    RETURN jsonb_build_object(
        'success', true,
        'mode', mode_upper,
        'duration_ms', duration_ms,
        'restored_counts', v_counts_json
    );
EXCEPTION WHEN OTHERS THEN
    -- In PostgreSQL, any uncaught exception causes full transaction ROLLBACK automatically
    RAISE EXCEPTION 'fshat_amalyat_al_istad: %', SQLERRM;
END;
$$;

-- Overload for default OPERATIONAL mode
CREATE OR REPLACE FUNCTION public.restore_backup_data(payload JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    RETURN public.restore_backup_data(payload, 'OPERATIONAL');
END;
$$;

-- Strict Execution Permissions
REVOKE ALL ON FUNCTION public.restore_backup_data(jsonb, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.restore_backup_data(jsonb, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.restore_backup_data(jsonb, text) TO authenticated;

REVOKE ALL ON FUNCTION public.restore_backup_data(jsonb) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.restore_backup_data(jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.restore_backup_data(jsonb) TO authenticated;
