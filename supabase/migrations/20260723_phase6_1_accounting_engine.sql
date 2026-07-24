-- Phase 6.1 Accounting Engine Tables and RPC Function

ALTER TABLE public.invoices ADD COLUMN IF NOT EXISTS work_type TEXT DEFAULT 'CUSTOMER_WORK';
ALTER TABLE public.partner_ledger ADD COLUMN IF NOT EXISTS reference_type TEXT;
ALTER TABLE public.partner_ledger ADD COLUMN IF NOT EXISTS reference_id TEXT;
ALTER TABLE public.partner_ledger ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE;
ALTER TABLE public.partner_ledger ADD COLUMN IF NOT EXISTS work_type TEXT;

CREATE TABLE IF NOT EXISTS public.invoice_accounting_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID UNIQUE NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    invoice_number TEXT NOT NULL,
    work_type TEXT NOT NULL DEFAULT 'CUSTOMER_WORK',
    revenue NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cogs NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    gross_profit NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    ahmed_profit_share NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    abdou_profit_share NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    ahmed_cogs_recovery NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    abdou_settlement_obligation NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    replacement_fund_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    ahmed_inventory_cogs NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    abdou_inventory_cogs NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    shared_inventory_cogs NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    is_cancelled BOOLEAN NOT NULL DEFAULT false,
    created_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.invoice_accounting_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users view invoice accounting" ON public.invoice_accounting_ledger;
CREATE POLICY "Authenticated users view invoice accounting" ON public.invoice_accounting_ledger FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users manage invoice accounting" ON public.invoice_accounting_ledger;
CREATE POLICY "Authenticated users manage invoice accounting" ON public.invoice_accounting_ledger FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_invoice_acc_ledger_inv ON public.invoice_accounting_ledger(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_acc_ledger_work ON public.invoice_accounting_ledger(work_type);

CREATE OR REPLACE FUNCTION public.post_invoice_accounting(p_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_inv RECORD;
    v_item RECORD;
    v_work_type TEXT;
    v_is_cancelled BOOLEAN := false;
    v_raw_subtotal NUMERIC(12,2) := 0.00;
    v_discount NUMERIC(12,2) := 0.00;
    v_revenue NUMERIC(12,2) := 0.00;
    v_total_cogs NUMERIC(12,2) := 0.00;
    v_ahmed_cogs NUMERIC(12,2) := 0.00;
    v_abdo_cogs NUMERIC(12,2) := 0.00;
    v_shared_cogs NUMERIC(12,2) := 0.00;
    v_gross_profit NUMERIC(12,2) := 0.00;
    
    v_ahmed_profit_share NUMERIC(12,2) := 0.00;
    v_abdou_profit_share NUMERIC(12,2) := 0.00;
    v_ahmed_cogs_recovery NUMERIC(12,2) := 0.00;
    v_abdou_settlement_obligation NUMERIC(12,2) := 0.00;
    v_replacement_fund_amount NUMERIC(12,2) := 0.00;
    
    v_item_price NUMERIC(12,2);
    v_item_cost NUMERIC(12,2);
    v_item_total_price NUMERIC(12,2);
    v_item_total_cost NUMERIC(12,2);
    v_ownership TEXT;
    
    v_result JSONB;
BEGIN
    -- 1. Check Auth User
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول لتنفيذ المعالجة المحاسبية.';
    END IF;

    -- 2. Fetch Invoice
    SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id;
    IF v_inv.id IS NULL THEN
        RAISE EXCEPTION 'الفاتورة المطلوبة غير موجودة.';
    END IF;

    -- Normalize work type
    IF v_inv.work_type IS NOT NULL AND v_inv.work_type != '' THEN
        IF UPPER(v_inv.work_type) IN ('AHMED', 'AHMED_WORK') THEN
            v_work_type := 'AHMED_WORK';
        ELSIF UPPER(v_inv.work_type) IN ('ABDO', 'ABDO_WORK') THEN
            v_work_type := 'ABDO_WORK';
        ELSE
            v_work_type := 'CUSTOMER_WORK';
        END IF;
    ELSIF v_inv.work_owner IS NOT NULL THEN
        IF v_inv.work_owner = 'AHMED'::public.work_owner_enum THEN
            v_work_type := 'AHMED_WORK';
        ELSIF v_inv.work_owner = 'ABDO'::public.work_owner_enum THEN
            v_work_type := 'ABDO_WORK';
        ELSE
            v_work_type := 'CUSTOMER_WORK';
        END IF;
    ELSE
        v_work_type := 'CUSTOMER_WORK';
    END IF;

    -- Check if cancelled
    IF v_inv.status = 'cancelled'::public.invoice_status_enum THEN
        v_is_cancelled := true;
    END IF;

    -- 3. If not cancelled, calculate items
    IF NOT v_is_cancelled THEN
        FOR v_item IN SELECT * FROM public.invoice_items WHERE invoice_id = p_invoice_id LOOP
            v_item_price := COALESCE(v_item.unit_price_snapshot, 0.00);
            v_item_cost := COALESCE(v_item.unit_cost_snapshot, 0.00);
            v_item_total_price := COALESCE(v_item.total_price, v_item.quantity * v_item_price);
            v_item_total_cost := COALESCE(v_item.total_cost, v_item.quantity * v_item_cost);

            v_raw_subtotal := v_raw_subtotal + v_item_total_price;
            v_total_cogs := v_total_cogs + v_item_total_cost;

            v_ownership := COALESCE(v_item.stock_ownership_snapshot::TEXT, 'SHARED');
            IF UPPER(v_ownership) = 'AHMED' THEN
                v_ahmed_cogs := v_ahmed_cogs + v_item_total_cost;
            ELSIF UPPER(v_ownership) = 'ABDO' THEN
                v_abdo_cogs := v_abdo_cogs + v_item_total_cost;
            ELSE
                v_shared_cogs := v_shared_cogs + v_item_total_cost;
            END IF;
        END LOOP;

        v_discount := LEAST(GREATEST(0.00, COALESCE(v_inv.discount_amount, 0.00)), v_raw_subtotal);
        v_revenue := GREATEST(0.00, v_raw_subtotal - v_discount);
        v_gross_profit := v_revenue - v_total_cogs;

        -- Work Type breakdown
        IF v_work_type = 'CUSTOMER_WORK' THEN
            v_ahmed_profit_share := ROUND(v_gross_profit * 0.50, 2);
            v_abdou_profit_share := ROUND(v_gross_profit * 0.50, 2);
            v_replacement_fund_amount := v_total_cogs;
        ELSIF v_work_type = 'AHMED_WORK' THEN
            v_ahmed_cogs_recovery := v_total_cogs;
            v_ahmed_profit_share := v_gross_profit;
            v_abdou_profit_share := 0.00;
            v_replacement_fund_amount := 0.00;
        ELSIF v_work_type = 'ABDO_WORK' THEN
            v_ahmed_profit_share := ROUND(v_gross_profit * 0.25, 2);
            v_abdou_profit_share := ROUND(v_gross_profit * 0.75, 2);
            v_abdou_settlement_obligation := v_total_cogs + v_ahmed_profit_share;
            v_replacement_fund_amount := 0.00;
        END IF;
    END IF;

    -- 4. Transactional Upsert into invoice_accounting_ledger
    -- Delete previous ledger entries for this invoice to guarantee idempotency
    DELETE FROM public.invoice_accounting_ledger WHERE invoice_id = p_invoice_id;
    DELETE FROM public.partner_ledger WHERE reference_type = 'INVOICE' AND reference_id = p_invoice_id::text;

    INSERT INTO public.invoice_accounting_ledger (
        invoice_id,
        invoice_number,
        work_type,
        revenue,
        cogs,
        gross_profit,
        ahmed_profit_share,
        abdou_profit_share,
        ahmed_cogs_recovery,
        abdou_settlement_obligation,
        replacement_fund_amount,
        ahmed_inventory_cogs,
        abdou_inventory_cogs,
        shared_inventory_cogs,
        is_cancelled,
        created_by_user_id,
        metadata
    ) VALUES (
        p_invoice_id,
        v_inv.invoice_number,
        v_work_type,
        v_revenue,
        v_total_cogs,
        v_gross_profit,
        v_ahmed_profit_share,
        v_abdou_profit_share,
        v_ahmed_cogs_recovery,
        v_abdou_settlement_obligation,
        v_replacement_fund_amount,
        v_ahmed_cogs,
        v_abdo_cogs,
        v_shared_cogs,
        v_is_cancelled,
        v_user_id,
        jsonb_build_object(
            'posted_at', NOW(),
            'status', v_inv.status,
            'discount_amount', v_discount
        )
    );

    -- Insert audit entries into partner_ledger if active
    IF NOT v_is_cancelled THEN
        IF v_ahmed_profit_share != 0.00 OR v_ahmed_cogs_recovery != 0.00 THEN
            INSERT INTO public.partner_ledger (
                transaction_type,
                amount,
                description,
                created_by_user_id,
                reference_type,
                reference_id,
                invoice_id,
                work_type
            ) VALUES (
                'PROFIT_SHARE',
                v_ahmed_profit_share + v_ahmed_cogs_recovery,
                'استحقاق الفاتورة ' || v_inv.invoice_number || ' (' || v_work_type || ')',
                v_user_id,
                'INVOICE',
                p_invoice_id::text,
                p_invoice_id,
                v_work_type
            );
        END IF;

        IF v_abdou_profit_share != 0.00 THEN
            INSERT INTO public.partner_ledger (
                transaction_type,
                amount,
                description,
                created_by_user_id,
                reference_type,
                reference_id,
                invoice_id,
                work_type
            ) VALUES (
                'PROFIT_SHARE',
                v_abdou_profit_share,
                'نصيب أرباح الفاتورة ' || v_inv.invoice_number || ' (' || v_work_type || ')',
                v_user_id,
                'INVOICE',
                p_invoice_id::text,
                p_invoice_id,
                v_work_type
            );
        END IF;
    END IF;

    -- Return JSON Summary
    v_result := jsonb_build_object(
        'success', true,
        'invoice_id', p_invoice_id,
        'invoice_number', v_inv.invoice_number,
        'work_type', v_work_type,
        'is_cancelled', v_is_cancelled,
        'revenue', v_revenue,
        'cogs', v_total_cogs,
        'gross_profit', v_gross_profit,
        'ahmed_profit_share', v_ahmed_profit_share,
        'abdou_profit_share', v_abdou_profit_share,
        'ahmed_cogs_recovery', v_ahmed_cogs_recovery,
        'abdou_settlement_obligation', v_abdou_settlement_obligation,
        'replacement_fund_amount', v_replacement_fund_amount,
        'ahmed_inventory_cogs', v_ahmed_cogs,
        'abdou_inventory_cogs', v_abdo_cogs,
        'shared_inventory_cogs', v_shared_cogs
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_invoice_accounting(UUID) TO authenticated;
