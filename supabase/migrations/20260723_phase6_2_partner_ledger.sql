-- Phase 6.2 Partner Ledger & Partner Transactions Migration

ALTER TABLE public.partner_ledger ADD COLUMN IF NOT EXISTS account_owner TEXT DEFAULT 'AHMED';
ALTER TABLE public.partner_ledger ADD COLUMN IF NOT EXISTS signed_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.partner_ledger ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.partner_ledger ADD COLUMN IF NOT EXISTS accounting_ledger_id UUID REFERENCES public.invoice_accounting_ledger(id) ON DELETE CASCADE;
ALTER TABLE public.partner_ledger ADD COLUMN IF NOT EXISTS source_key TEXT;
ALTER TABLE public.partner_ledger ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ;
ALTER TABLE public.partner_ledger ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.partner_ledger ADD COLUMN IF NOT EXISTS reversal_of_id UUID REFERENCES public.partner_ledger(id) ON DELETE SET NULL;
ALTER TABLE public.partner_ledger ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Drop constraints if re-running
ALTER TABLE public.partner_ledger DROP CONSTRAINT IF EXISTS chk_partner_ledger_account_owner;
ALTER TABLE public.partner_ledger ADD CONSTRAINT chk_partner_ledger_account_owner
  CHECK (account_owner IN ('AHMED', 'ABDO', 'REPLACEMENT_FUND'));

ALTER TABLE public.partner_ledger DROP CONSTRAINT IF EXISTS chk_partner_ledger_trans_type;
ALTER TABLE public.partner_ledger ADD CONSTRAINT chk_partner_ledger_trans_type
  CHECK (transaction_type IN ('PROFIT_SHARE', 'COGS_RECOVERY', 'SETTLEMENT_OBLIGATION', 'REPLACEMENT_FUND_ALLOCATION', 'REVERSAL', 'MANUAL_ADJUSTMENT'));

-- Idempotency and search indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_ledger_source_key ON public.partner_ledger (source_key) WHERE source_key IS NOT NULL AND reversed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_partner_ledger_invoice ON public.partner_ledger (invoice_id);
CREATE INDEX IF NOT EXISTS idx_partner_ledger_owner ON public.partner_ledger (account_owner);
CREATE INDEX IF NOT EXISTS idx_partner_ledger_type ON public.partner_ledger (transaction_type);

-- Enable RLS
ALTER TABLE public.partner_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users view partner ledger" ON public.partner_ledger;
CREATE POLICY "Authenticated users view partner ledger" ON public.partner_ledger FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Authenticated users manage partner ledger" ON public.partner_ledger;
CREATE POLICY "Authenticated users manage partner ledger" ON public.partner_ledger FOR ALL TO authenticated USING (true) WITH CHECK (true);


-- RPC: Atomic Partner Ledger Posting for an Invoice
CREATE OR REPLACE FUNCTION public.post_partner_ledger_for_invoice(p_invoice_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_acc RECORD;
    v_rec RECORD;
    v_post_time TEXT;
    v_entries_created INT := 0;
    v_reversals_created INT := 0;
    v_result JSONB;
BEGIN
    -- 1. Check Auth User
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول لتنفيذ ترحيل دفتر الشركاء.';
    END IF;

    -- 2. Post or Retrieve Phase 6.1 Accounting
    PERFORM public.post_invoice_accounting(p_invoice_id);

    SELECT * INTO v_acc FROM public.invoice_accounting_ledger WHERE invoice_id = p_invoice_id;
    IF v_acc.id IS NULL THEN
        RAISE EXCEPTION 'لم يتم العثور على القيود المحاسبية للفاتورة.';
    END IF;

    v_post_time := EXTRACT(EPOCH FROM NOW())::TEXT;

    -- 3. Reverse previous active ledger entries for this invoice to preserve full audit history
    FOR v_rec IN 
        SELECT * FROM public.partner_ledger 
        WHERE invoice_id = p_invoice_id 
          AND reversed_at IS NULL 
          AND transaction_type != 'REVERSAL'
    LOOP
        -- Mark existing record as reversed
        UPDATE public.partner_ledger 
        SET reversed_at = NOW(), reversed_by = v_user_id 
        WHERE id = v_rec.id;

        -- Create explicit REVERSAL transaction record
        INSERT INTO public.partner_ledger (
            account_owner,
            transaction_type,
            amount,
            signed_amount,
            invoice_id,
            invoice_number,
            accounting_ledger_id,
            work_type,
            reference_type,
            reference_id,
            reversal_of_id,
            description,
            created_by_user_id,
            reversed_at,
            reversed_by,
            source_key,
            metadata
        ) VALUES (
            v_rec.account_owner,
            'REVERSAL',
            v_rec.amount,
            -1 * v_rec.signed_amount,
            p_invoice_id,
            v_acc.invoice_number,
            v_acc.id,
            v_acc.work_type,
            'INVOICE_REVERSAL',
            v_rec.id::text,
            v_rec.id,
            'عكس قيد سابق للفاتورة ' || v_acc.invoice_number,
            v_user_id,
            NOW(),
            v_user_id,
            p_invoice_id::text || '_REV_' || v_rec.id::text || '_' || v_post_time,
            jsonb_build_object('reversed_original_id', v_rec.id)
        );

        v_reversals_created := v_reversals_created + 1;
    END LOOP;

    -- 4. If Invoice is active (not cancelled), post new partner transactions
    IF NOT v_acc.is_cancelled THEN
        -- CUSTOMER_WORK
        IF v_acc.work_type = 'CUSTOMER_WORK' THEN
            -- Ahmed Profit Share
            IF v_acc.ahmed_profit_share != 0 THEN
                INSERT INTO public.partner_ledger (
                    account_owner, transaction_type, amount, signed_amount,
                    invoice_id, invoice_number, accounting_ledger_id, work_type,
                    reference_type, reference_id, description, created_by_user_id, source_key
                ) VALUES (
                    'AHMED', 'PROFIT_SHARE', ABS(v_acc.ahmed_profit_share), v_acc.ahmed_profit_share,
                    p_invoice_id, v_acc.invoice_number, v_acc.id, v_acc.work_type,
                    'INVOICE', p_invoice_id::text, 'نصيب أرباح فاتورة العملاء ' || v_acc.invoice_number,
                    v_user_id, p_invoice_id::text || '_AHMED_PROFIT_SHARE_' || v_post_time
                );
                v_entries_created := v_entries_created + 1;
            END IF;

            -- Abdo Profit Share
            IF v_acc.abdou_profit_share != 0 THEN
                INSERT INTO public.partner_ledger (
                    account_owner, transaction_type, amount, signed_amount,
                    invoice_id, invoice_number, accounting_ledger_id, work_type,
                    reference_type, reference_id, description, created_by_user_id, source_key
                ) VALUES (
                    'ABDO', 'PROFIT_SHARE', ABS(v_acc.abdou_profit_share), v_acc.abdou_profit_share,
                    p_invoice_id, v_acc.invoice_number, v_acc.id, v_acc.work_type,
                    'INVOICE', p_invoice_id::text, 'نصيب أرباح فاتورة العملاء ' || v_acc.invoice_number,
                    v_user_id, p_invoice_id::text || '_ABDO_PROFIT_SHARE_' || v_post_time
                );
                v_entries_created := v_entries_created + 1;
            END IF;

            -- Replacement Fund Allocation
            IF v_acc.replacement_fund_amount != 0 THEN
                INSERT INTO public.partner_ledger (
                    account_owner, transaction_type, amount, signed_amount,
                    invoice_id, invoice_number, accounting_ledger_id, work_type,
                    reference_type, reference_id, description, created_by_user_id, source_key
                ) VALUES (
                    'REPLACEMENT_FUND', 'REPLACEMENT_FUND_ALLOCATION', ABS(v_acc.replacement_fund_amount), v_acc.replacement_fund_amount,
                    p_invoice_id, v_acc.invoice_number, v_acc.id, v_acc.work_type,
                    'INVOICE', p_invoice_id::text, 'مخصص صندوق تعويض بضاعة الفاتورة ' || v_acc.invoice_number,
                    v_user_id, p_invoice_id::text || '_REPLACEMENT_FUND_' || v_post_time
                );
                v_entries_created := v_entries_created + 1;
            END IF;

        -- AHMED_WORK
        ELSIF v_acc.work_type = 'AHMED_WORK' THEN
            -- Ahmed COGS Recovery
            IF v_acc.ahmed_cogs_recovery != 0 THEN
                INSERT INTO public.partner_ledger (
                    account_owner, transaction_type, amount, signed_amount,
                    invoice_id, invoice_number, accounting_ledger_id, work_type,
                    reference_type, reference_id, description, created_by_user_id, source_key
                ) VALUES (
                    'AHMED', 'COGS_RECOVERY', ABS(v_acc.ahmed_cogs_recovery), v_acc.ahmed_cogs_recovery,
                    p_invoice_id, v_acc.invoice_number, v_acc.id, v_acc.work_type,
                    'INVOICE', p_invoice_id::text, 'استرداد تكلفة بضاعة أحمد للفاتورة ' || v_acc.invoice_number,
                    v_user_id, p_invoice_id::text || '_AHMED_COGS_RECOVERY_' || v_post_time
                );
                v_entries_created := v_entries_created + 1;
            END IF;

            -- Ahmed Profit Share
            IF v_acc.ahmed_profit_share != 0 THEN
                INSERT INTO public.partner_ledger (
                    account_owner, transaction_type, amount, signed_amount,
                    invoice_id, invoice_number, accounting_ledger_id, work_type,
                    reference_type, reference_id, description, created_by_user_id, source_key
                ) VALUES (
                    'AHMED', 'PROFIT_SHARE', ABS(v_acc.ahmed_profit_share), v_acc.ahmed_profit_share,
                    p_invoice_id, v_acc.invoice_number, v_acc.id, v_acc.work_type,
                    'INVOICE', p_invoice_id::text, 'أرباح شغل أحمد البنا للفاتورة ' || v_acc.invoice_number,
                    v_user_id, p_invoice_id::text || '_AHMED_PROFIT_SHARE_' || v_post_time
                );
                v_entries_created := v_entries_created + 1;
            END IF;

        -- ABDO_WORK
        ELSIF v_acc.work_type = 'ABDO_WORK' THEN
            -- Ahmed Profit Share (25%)
            IF v_acc.ahmed_profit_share != 0 THEN
                INSERT INTO public.partner_ledger (
                    account_owner, transaction_type, amount, signed_amount,
                    invoice_id, invoice_number, accounting_ledger_id, work_type,
                    reference_type, reference_id, description, created_by_user_id, source_key
                ) VALUES (
                    'AHMED', 'PROFIT_SHARE', ABS(v_acc.ahmed_profit_share), v_acc.ahmed_profit_share,
                    p_invoice_id, v_acc.invoice_number, v_acc.id, v_acc.work_type,
                    'INVOICE', p_invoice_id::text, 'نصيب أحمد من شغل عبده (25%) للفاتورة ' || v_acc.invoice_number,
                    v_user_id, p_invoice_id::text || '_AHMED_PROFIT_SHARE_' || v_post_time
                );
                v_entries_created := v_entries_created + 1;
            END IF;

            -- Abdo Profit Share (75%)
            IF v_acc.abdou_profit_share != 0 THEN
                INSERT INTO public.partner_ledger (
                    account_owner, transaction_type, amount, signed_amount,
                    invoice_id, invoice_number, accounting_ledger_id, work_type,
                    reference_type, reference_id, description, created_by_user_id, source_key
                ) VALUES (
                    'ABDO', 'PROFIT_SHARE', ABS(v_acc.abdou_profit_share), v_acc.abdou_profit_share,
                    p_invoice_id, v_acc.invoice_number, v_acc.id, v_acc.work_type,
                    'INVOICE', p_invoice_id::text, 'نصيب عبده من شغله الخارجي (75%) للفاتورة ' || v_acc.invoice_number,
                    v_user_id, p_invoice_id::text || '_ABDO_PROFIT_SHARE_' || v_post_time
                );
                v_entries_created := v_entries_created + 1;
            END IF;

            -- Abdo Settlement Obligation (Negative signed_amount = debt/obligation)
            IF v_acc.abdou_settlement_obligation != 0 THEN
                INSERT INTO public.partner_ledger (
                    account_owner, transaction_type, amount, signed_amount,
                    invoice_id, invoice_number, accounting_ledger_id, work_type,
                    reference_type, reference_id, description, created_by_user_id, source_key
                ) VALUES (
                    'ABDO', 'SETTLEMENT_OBLIGATION', ABS(v_acc.abdou_settlement_obligation), -1 * ABS(v_acc.abdou_settlement_obligation),
                    p_invoice_id, v_acc.invoice_number, v_acc.id, v_acc.work_type,
                    'INVOICE', p_invoice_id::text, 'التزام تسوية مستحق على عبده للفاتورة ' || v_acc.invoice_number,
                    v_user_id, p_invoice_id::text || '_ABDO_SETTLEMENT_OBLIGATION_' || v_post_time
                );
                v_entries_created := v_entries_created + 1;
            END IF;
        END IF;
    END IF;

    -- Return JSON Result
    v_result := jsonb_build_object(
        'success', true,
        'invoice_id', p_invoice_id,
        'invoice_number', v_acc.invoice_number,
        'work_type', v_acc.work_type,
        'is_cancelled', v_acc.is_cancelled,
        'reversals_created', v_reversals_created,
        'entries_created', v_entries_created
    );

    RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_partner_ledger_for_invoice(UUID) TO authenticated;


-- RPC: Partner Account Balances Query
CREATE OR REPLACE FUNCTION public.get_partner_account_balances(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
    p_work_type TEXT DEFAULT NULL,
    p_invoice_number TEXT DEFAULT NULL,
    p_transaction_type TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_ahmed_profit NUMERIC(12, 2) := 0.00;
    v_ahmed_cogs_recovery NUMERIC(12, 2) := 0.00;
    v_abdou_profit NUMERIC(12, 2) := 0.00;
    v_abdou_settlement_obligation NUMERIC(12, 2) := 0.00;
    v_replacement_fund NUMERIC(12, 2) := 0.00;
BEGIN
    IF auth.uid() IS NULL THEN
        RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول للاستعلام عن الأرصدة.';
    END IF;

    -- Ahmed Profit Share
    SELECT COALESCE(SUM(signed_amount), 0.00) INTO v_ahmed_profit
    FROM public.partner_ledger
    WHERE account_owner = 'AHMED'
      AND transaction_type = 'PROFIT_SHARE'
      AND reversed_at IS NULL
      AND (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
      AND (p_work_type IS NULL OR work_type = p_work_type)
      AND (p_invoice_number IS NULL OR invoice_number ILIKE '%' || p_invoice_number || '%')
      AND (p_transaction_type IS NULL OR transaction_type = p_transaction_type);

    -- Ahmed COGS Recovery
    SELECT COALESCE(SUM(signed_amount), 0.00) INTO v_ahmed_cogs_recovery
    FROM public.partner_ledger
    WHERE account_owner = 'AHMED'
      AND transaction_type = 'COGS_RECOVERY'
      AND reversed_at IS NULL
      AND (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
      AND (p_work_type IS NULL OR work_type = p_work_type)
      AND (p_invoice_number IS NULL OR invoice_number ILIKE '%' || p_invoice_number || '%')
      AND (p_transaction_type IS NULL OR transaction_type = p_transaction_type);

    -- Abdo Profit Share
    SELECT COALESCE(SUM(signed_amount), 0.00) INTO v_abdou_profit
    FROM public.partner_ledger
    WHERE account_owner = 'ABDO'
      AND transaction_type = 'PROFIT_SHARE'
      AND reversed_at IS NULL
      AND (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
      AND (p_work_type IS NULL OR work_type = p_work_type)
      AND (p_invoice_number IS NULL OR invoice_number ILIKE '%' || p_invoice_number || '%')
      AND (p_transaction_type IS NULL OR transaction_type = p_transaction_type);

    -- Abdo Settlement Obligation (represented as absolute positive obligation amount)
    SELECT COALESCE(SUM(amount), 0.00) INTO v_abdou_settlement_obligation
    FROM public.partner_ledger
    WHERE account_owner = 'ABDO'
      AND transaction_type = 'SETTLEMENT_OBLIGATION'
      AND reversed_at IS NULL
      AND (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
      AND (p_work_type IS NULL OR work_type = p_work_type)
      AND (p_invoice_number IS NULL OR invoice_number ILIKE '%' || p_invoice_number || '%')
      AND (p_transaction_type IS NULL OR transaction_type = p_transaction_type);

    -- Replacement Fund
    SELECT COALESCE(SUM(signed_amount), 0.00) INTO v_replacement_fund
    FROM public.partner_ledger
    WHERE account_owner = 'REPLACEMENT_FUND'
      AND transaction_type = 'REPLACEMENT_FUND_ALLOCATION'
      AND reversed_at IS NULL
      AND (p_start_date IS NULL OR created_at >= p_start_date)
      AND (p_end_date IS NULL OR created_at <= p_end_date)
      AND (p_work_type IS NULL OR work_type = p_work_type)
      AND (p_invoice_number IS NULL OR invoice_number ILIKE '%' || p_invoice_number || '%')
      AND (p_transaction_type IS NULL OR transaction_type = p_transaction_type);

    RETURN jsonb_build_object(
        'ahmed_profit_share', v_ahmed_profit,
        'ahmed_cogs_recovery', v_ahmed_cogs_recovery,
        'ahmed_total_entitlements', v_ahmed_profit + v_ahmed_cogs_recovery,
        'abdou_profit_share', v_abdou_profit,
        'abdou_settlement_obligation', v_abdou_settlement_obligation,
        'abdou_net_balance', v_abdou_profit - v_abdou_settlement_obligation,
        'replacement_fund_balance', v_replacement_fund
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_partner_account_balances TO authenticated;
