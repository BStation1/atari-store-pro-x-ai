-- =============================================================================
-- ATARI STORE PRO X - SUPABASE POSTGRESQL PRODUCTION DATABASE SCHEMA
-- Version: 2.0.0 (Enterprise Production Standard)
-- Target Engine: Supabase PostgreSQL 15+
-- =============================================================================

-- Enable Required System Extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =============================================================================
-- 1. ENUMS DEFINITIONS
-- =============================================================================

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
        CREATE TYPE user_role_enum AS ENUM ('OWNER', 'RECEPTION', 'ENGINEER', 'CASHIER');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'customer_type_enum') THEN
        CREATE TYPE customer_type_enum AS ENUM ('REGULAR', 'WHOLESALE', 'VIP');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_type_enum') THEN
        CREATE TYPE invoice_type_enum AS ENUM ('sales', 'return', 'purchase', 'repair');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_method_enum') THEN
        CREATE TYPE payment_method_enum AS ENUM ('cash', 'card', 'transfer', 'credit');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'invoice_status_enum') THEN
        CREATE TYPE invoice_status_enum AS ENUM ('paid', 'partially_paid', 'unpaid', 'cancelled');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'repair_status_enum') THEN
        CREATE TYPE repair_status_enum AS ENUM ('RECEIVED', 'DIAGNOSING', 'IN_REPAIR', 'READY_FOR_DELIVERY', 'DELIVERED', 'REJECTED', 'CANCELLED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'warranty_status_enum') THEN
        CREATE TYPE warranty_status_enum AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED', 'CLAIMED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'settlement_status_enum') THEN
        CREATE TYPE settlement_status_enum AS ENUM ('OPEN', 'LOCKED', 'SETTLED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'notification_type_enum') THEN
        CREATE TYPE notification_type_enum AS ENUM ('INFO', 'WARNING', 'ALERT', 'SUCCESS');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'stock_ownership_enum') THEN
        CREATE TYPE stock_ownership_enum AS ENUM ('AHMED', 'ABDO', 'SHARED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'work_owner_enum') THEN
        CREATE TYPE work_owner_enum AS ENUM ('CLIENT', 'AHMED', 'ABDO');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'inventory_movement_type_enum') THEN
        CREATE TYPE inventory_movement_type_enum AS ENUM ('SALE', 'PURCHASE', 'RETURN', 'REPAIR_USAGE', 'ADJUSTMENT', 'DELETION_RESTORE');
    END IF;
END $$;

-- =============================================================================
-- 2. ATOMIC SEQUENCES FOR SECURE CONCURRENT DOCUMENT NUMBERS
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS public.invoice_number_seq START WITH 1001 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.repair_order_number_seq START WITH 10001 INCREMENT BY 1;
CREATE SEQUENCE IF NOT EXISTS public.warranty_code_seq START WITH 5001 INCREMENT BY 1;

-- Functions to safely generate document numbers without collision
CREATE OR REPLACE FUNCTION public.gen_invoice_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(NEXTVAL('public.invoice_number_seq')::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.gen_repair_order_number()
RETURNS TEXT AS $$
BEGIN
    RETURN 'ATR-' || LPAD(NEXTVAL('public.repair_order_number_seq')::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.gen_warranty_code()
RETURNS TEXT AS $$
BEGIN
    RETURN 'WAR-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(NEXTVAL('public.warranty_code_seq')::TEXT, 5, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 3. TABLES DEFINITIONS
-- =============================================================================

-- 3.1 PROFILES (Connected to Supabase auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    role user_role_enum NOT NULL DEFAULT 'RECEPTION',
    phone TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    custom_permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.2 STORE SETTINGS (Singleton Configuration)
CREATE TABLE IF NOT EXISTS public.store_settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    company_name TEXT NOT NULL DEFAULT 'Atari Store Pro X',
    phone TEXT DEFAULT '01002345678',
    address TEXT DEFAULT 'شارع التحرير، وسط البلد، القاهرة',
    receipt_header TEXT DEFAULT 'Atari Store Pro X\nالمركز الاحترافي لصيانة وبيع أجهزة الألعاب',
    receipt_footer TEXT DEFAULT 'شكراً لزيارتكم! يرجى الاحتفاظ بالفاتورة للصيانة والضمان.',
    whatsapp_template_received TEXT DEFAULT 'مرحباً {customer_name}، تم استلام جهازك {device_model} بنجاح تحت رقم الطلب {order_id}. يمكنك متابعة حالة طلبك عبر الرابط.',
    whatsapp_template_ready TEXT DEFAULT 'مرحباً {customer_name}، جهازك {device_model} (رقم الطلب {order_id}) جاهز للاستلام الآن! التكلفة الإجمالية: {total_cost} ج.م.',
    whatsapp_template_invoice TEXT DEFAULT 'مرحباً {customer_name}، إليك تفاصيل فاتورة الشراء رقم {invoice_id} بقيمة إجمالية {total_amount} ج.م.',
    tax_rate NUMERIC(5, 2) DEFAULT 0.00 CHECK (tax_rate >= 0),
    currency TEXT DEFAULT 'ج.م.',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.3 CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    description TEXT,
    sort_order INT DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.4 PRODUCTS & SPARE PARTS
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    barcode TEXT,
    sku TEXT UNIQUE,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    category_name TEXT,
    description TEXT,
    cost_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (cost_price >= 0),
    selling_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (selling_price >= 0),
    quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    min_quantity INTEGER NOT NULL DEFAULT 5 CHECK (min_quantity >= 0),
    location TEXT,
    is_spare_part BOOLEAN NOT NULL DEFAULT false,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    stock_ownership stock_ownership_enum NOT NULL DEFAULT 'SHARED',
    compatible_models TEXT[] DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.5 INVENTORY MOVEMENTS (Movement Audit Log)
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
    movement_type inventory_movement_type_enum NOT NULL,
    quantity_change INTEGER NOT NULL,
    previous_quantity INTEGER NOT NULL,
    new_quantity INTEGER NOT NULL CHECK (new_quantity >= 0),
    cost_price_snapshot NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (cost_price_snapshot >= 0),
    selling_price_snapshot NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (selling_price_snapshot >= 0),
    reference_id TEXT,
    notes TEXT,
    created_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.6 CUSTOMERS
CREATE TABLE IF NOT EXISTS public.customers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE,
    email TEXT,
    address TEXT,
    notes TEXT,
    customer_type customer_type_enum NOT NULL DEFAULT 'REGULAR',
    balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.7 SUPPLIERS
CREATE TABLE IF NOT EXISTS public.suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT,
    company TEXT,
    address TEXT,
    balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.8 INVOICES (Sales, Returns, Purchases & Repair Billing)
CREATE TABLE IF NOT EXISTS public.invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number TEXT UNIQUE NOT NULL DEFAULT public.gen_invoice_number(),
    type invoice_type_enum NOT NULL DEFAULT 'sales',
    work_owner work_owner_enum NOT NULL DEFAULT 'CLIENT',
    customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL,
    supplier_id UUID REFERENCES public.suppliers(id) ON DELETE SET NULL,
    repair_order_id UUID, -- Will be foreign key after repair_orders table created
    created_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    subtotal NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (subtotal >= 0),
    discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount_amount >= 0),
    total_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_amount >= 0),
    total_cost_snapshot NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (total_cost_snapshot >= 0),
    paid_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (paid_amount >= 0),
    remaining_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    payment_method payment_method_enum NOT NULL DEFAULT 'cash',
    status invoice_status_enum NOT NULL DEFAULT 'paid',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.9 INVOICE ITEMS
CREATE TABLE IF NOT EXISTS public.invoice_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
    product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    product_name_snapshot TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price_snapshot NUMERIC(12, 2) NOT NULL CHECK (unit_price_snapshot >= 0),
    unit_cost_snapshot NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (unit_cost_snapshot >= 0),
    stock_ownership_snapshot stock_ownership_enum NOT NULL DEFAULT 'SHARED',
    total_price NUMERIC(12, 2) NOT NULL CHECK (total_price >= 0),
    total_cost NUMERIC(12, 2) NOT NULL CHECK (total_cost >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.10 REPAIR ORDERS
CREATE TABLE IF NOT EXISTS public.repair_orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number TEXT UNIQUE NOT NULL DEFAULT public.gen_repair_order_number(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT,
    work_owner work_owner_enum NOT NULL DEFAULT 'CLIENT',
    device_type TEXT NOT NULL,
    device_model TEXT NOT NULL,
    serial_number TEXT,
    passcode_or_pattern_encrypted TEXT, -- Passcode stored as encrypted string via pgcrypto
    received_accessories TEXT[] DEFAULT '{}',
    device_condition TEXT,
    reported_issue TEXT NOT NULL,
    technical_diagnosis TEXT,
    status repair_status_enum NOT NULL DEFAULT 'RECEIVED',
    assigned_engineer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    estimated_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (estimated_cost >= 0),
    parts_cost_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (parts_cost_total >= 0),
    labor_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (labor_cost >= 0),
    final_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (final_cost >= 0),
    discount NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (discount >= 0),
    paid_deposit NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (paid_deposit >= 0),
    final_paid NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (final_paid >= 0),
    remaining_balance NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    warranty_days INTEGER NOT NULL DEFAULT 30 CHECK (warranty_days >= 0),
    created_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    delivered_at TIMESTAMPTZ,
    reopened_at TIMESTAMPTZ,
    tracking_token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key back to invoices table
ALTER TABLE public.invoices
    ADD CONSTRAINT fk_invoices_repair_order
    FOREIGN KEY (repair_order_id) REFERENCES public.repair_orders(id) ON DELETE SET NULL;

-- 3.11 REPAIR PART USAGES
CREATE TABLE IF NOT EXISTS public.repair_part_usages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repair_order_id UUID NOT NULL REFERENCES public.repair_orders(id) ON DELETE CASCADE,
    inventory_item_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
    part_name_snapshot TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    cost_price_snapshot NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (cost_price_snapshot >= 0),
    selling_price_snapshot NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (selling_price_snapshot >= 0),
    stock_ownership_snapshot stock_ownership_enum NOT NULL DEFAULT 'SHARED',
    created_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.12 REPAIR WARRANTIES (Dedicated Warranties Record Table)
CREATE TABLE IF NOT EXISTS public.repair_warranties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    repair_order_id UUID NOT NULL REFERENCES public.repair_orders(id) ON DELETE CASCADE,
    warranty_code TEXT UNIQUE NOT NULL DEFAULT public.gen_warranty_code(),
    customer_id UUID REFERENCES public.customers(id) ON DELETE RESTRICT,
    warranty_days INTEGER NOT NULL CHECK (warranty_days >= 0),
    start_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    end_date TIMESTAMPTZ NOT NULL,
    status warranty_status_enum NOT NULL DEFAULT 'ACTIVE',
    cancellation_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    cancelled_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.13 META / CATALOG CONFIG TABLES
CREATE TABLE IF NOT EXISTS public.repair_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar TEXT NOT NULL,
    device_type_id TEXT,
    default_labor_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    min_price NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    estimated_hours NUMERIC(5, 2) DEFAULT 1.0,
    warranty_days INTEGER DEFAULT 30,
    suggested_parts TEXT,
    technician_instructions TEXT,
    customer_description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.common_faults (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar TEXT NOT NULL,
    name_en TEXT,
    device_type_id TEXT,
    fault_category TEXT,
    customer_description_ar TEXT,
    tech_diagnosis_template_ar TEXT,
    default_repair_notes_ar TEXT,
    default_inspection_price NUMERIC(12, 2) DEFAULT 0.00,
    default_repair_price NUMERIC(12, 2) DEFAULT 0.00,
    estimated_hours NUMERIC(5, 2) DEFAULT 1.0,
    suggested_parts TEXT,
    warranty_days INTEGER DEFAULT 30,
    priority TEXT DEFAULT 'medium',
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.received_accessories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar TEXT NOT NULL UNIQUE,
    name_en TEXT,
    is_common BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.device_conditions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name_ar TEXT NOT NULL UNIQUE,
    name_en TEXT,
    is_common BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.14 EXPENSES
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
    expense_owner TEXT NOT NULL DEFAULT 'SHARED', -- 'AHMED', 'ABDO', 'SHARED'
    paid_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- REPLACEMENT FUND LEDGER
CREATE TABLE IF NOT EXISTS public.replacement_fund_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_type TEXT NOT NULL, -- 'DEPOSIT_CUSTOMER_WORK', 'NEW_GOODS_PURCHASE', 'MANUAL_WITHDRAWAL', 'MANUAL_DEPOSIT'
    amount NUMERIC(12, 2) NOT NULL,
    signed_amount NUMERIC(12, 2) NOT NULL,
    reference_id TEXT,
    reference_type TEXT,
    description TEXT,
    created_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.15 PARTNER LEDGER & SETTLEMENTS
CREATE TABLE IF NOT EXISTS public.partner_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    description TEXT,
    created_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    transaction_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.partner_settlements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_month TEXT NOT NULL UNIQUE, -- e.g. "2026-07"
    gross_revenue NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_expenses NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_cost_of_goods NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    ahmed_stock_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    abdo_stock_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    shared_stock_cost NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    ahmed_profit_share NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    abdo_profit_share NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    status settlement_status_enum NOT NULL DEFAULT 'OPEN',
    settled_at TIMESTAMPTZ,
    created_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.partner_settlement_payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id UUID NOT NULL REFERENCES public.partner_settlements(id) ON DELETE CASCADE,
    partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    payment_method payment_method_enum NOT NULL DEFAULT 'cash',
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.partner_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    type TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.settlement_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    settlement_id UUID NOT NULL REFERENCES public.partner_settlements(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    performed_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3.16 SYSTEM LOGS & NOTIFICATIONS
CREATE TABLE IF NOT EXISTS public.activity_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action_type TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    table_name TEXT NOT NULL,
    record_id TEXT,
    old_values JSONB,
    new_values JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type notification_type_enum NOT NULL DEFAULT 'INFO',
    target_role user_role_enum,
    is_read BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.system_reset_security_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    executed_by_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    executed_by_user_name TEXT NOT NULL,
    executed_by_user_email TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    wiped_sections TEXT[] NOT NULL DEFAULT '{}',
    record_counts_wiped JSONB NOT NULL DEFAULT '{}'::jsonb,
    inventory_mode TEXT NOT NULL,
    backup_file_name TEXT,
    status TEXT NOT NULL,
    details TEXT
);

-- Initialize Singleton Settings Row
INSERT INTO public.store_settings (id, company_name)
VALUES (1, 'Atari Store Pro X')
ON CONFLICT (id) DO NOTHING;

-- =============================================================================
-- 4. PERFORMANCE INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_products_sku ON public.products(sku);
CREATE INDEX IF NOT EXISTS idx_products_barcode ON public.products(barcode);
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_prod ON public.inventory_movements(product_id);
CREATE UNIQUE INDEX IF NOT EXISTS inventory_movements_one_opening_balance_per_product
ON public.inventory_movements(product_id)
WHERE reference_id = 'OPENING_BALANCE';
CREATE INDEX IF NOT EXISTS idx_customers_phone ON public.customers(phone);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON public.invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_invoices_customer ON public.invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_invoices_type ON public.invoices(type);
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_repair_orders_number ON public.repair_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_repair_orders_customer ON public.repair_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_repair_orders_status ON public.repair_orders(status);
CREATE INDEX IF NOT EXISTS idx_repair_orders_engineer ON public.repair_orders(assigned_engineer_id);
CREATE INDEX IF NOT EXISTS idx_repair_part_usages_order ON public.repair_part_usages(repair_order_id);
CREATE INDEX IF NOT EXISTS idx_repair_warranties_code ON public.repair_warranties(warranty_code);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user ON public.activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created ON public.activity_logs(created_at DESC);

-- =============================================================================
-- 5. AUTOMATIC TIMESTAMPS & HELPER FUNCTIONS
-- =============================================================================

-- Timestamp updater
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach timestamp triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_store_settings_updated_at ON public.store_settings;
CREATE TRIGGER update_store_settings_updated_at BEFORE UPDATE ON public.store_settings FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_categories_updated_at ON public.categories;
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_customers_updated_at ON public.customers;
CREATE TRIGGER update_customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_suppliers_updated_at ON public.suppliers;
CREATE TRIGGER update_suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
CREATE TRIGGER update_invoices_updated_at BEFORE UPDATE ON public.invoices FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_repair_orders_updated_at ON public.repair_orders;
CREATE TRIGGER update_repair_orders_updated_at BEFORE UPDATE ON public.repair_orders FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS update_expenses_updated_at ON public.expenses;
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Auto Sync New Auth Users -> Profiles
CREATE OR REPLACE FUNCTION public.handle_new_user_signup()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', NEW.email),
        COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role_enum, 'RECEPTION')
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = EXCLUDED.full_name;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_signup();

-- SECURITY DEFINER Helper function for Role Checks (Prevents client-side forgery)
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS user_role_enum AS $$
DECLARE
    u_role user_role_enum;
BEGIN
    SELECT role INTO u_role FROM public.profiles WHERE id = auth.uid();
    RETURN COALESCE(u_role, 'RECEPTION'::user_role_enum);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (public.get_auth_user_role() = 'OWNER'::user_role_enum);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION public.owner_exists()
RETURNS BOOLEAN AS $$
DECLARE
    v_count INT;
BEGIN
    SELECT COUNT(*) INTO v_count
    FROM public.profiles
    WHERE role = 'OWNER'::public.user_role_enum OR role::text IN ('OWNER', 'ADMIN', 'owner', 'admin');

    RETURN COALESCE(v_count, 0) > 0;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.owner_exists() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.check_has_owner()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.owner_exists();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.check_has_owner() TO anon, authenticated, service_role;

CREATE UNIQUE INDEX IF NOT EXISTS idx_single_owner_profile 
ON public.profiles (role) 
WHERE role = 'OWNER'::public.user_role_enum;

-- =============================================================================
-- 6. BUSINESS LOGIC ATOMIC TRANSACTIONS & PARTNER PROFIT ENGINE
-- =============================================================================

-- Partner Monthly Breakdown & Profit Calculation Engine
CREATE OR REPLACE FUNCTION public.calculate_monthly_partner_breakdown(p_month TEXT)
RETURNS JSONB AS $$
DECLARE
    v_gross_revenue NUMERIC(12,2) := 0.00;
    v_total_expenses NUMERIC(12,2) := 0.00;
    v_total_cost_of_goods NUMERIC(12,2) := 0.00;
    
    v_ahmed_stock_cost NUMERIC(12,2) := 0.00;
    v_abdo_stock_cost NUMERIC(12,2) := 0.00;
    v_shared_stock_cost NUMERIC(12,2) := 0.00;
    
    v_ahmed_profit NUMERIC(12,2) := 0.00;
    v_abdo_profit NUMERIC(12,2) := 0.00;
    
    rec RECORD;
BEGIN
    -- 1. Calculate Expenses in this month
    SELECT COALESCE(SUM(amount), 0.00) INTO v_total_expenses
    FROM public.expenses
    WHERE TO_CHAR(expense_date, 'YYYY-MM') = p_month;

    -- 2. Iterate Invoices in month
    FOR rec IN 
        SELECT 
            i.id, i.work_owner, item.total_price, item.total_cost, item.stock_ownership_snapshot
        FROM public.invoices i
        JOIN public.invoice_items item ON item.invoice_id = i.id
        WHERE TO_CHAR(i.created_at, 'YYYY-MM') = p_month AND i.status != 'cancelled'
    LOOP
        v_gross_revenue := v_gross_revenue + rec.total_price;
        v_total_cost_of_goods := v_total_cost_of_goods + rec.total_cost;
        
        -- Stock Ownership Sourcing Costs
        IF rec.stock_ownership_snapshot = 'AHMED' THEN
            v_ahmed_stock_cost := v_ahmed_stock_cost + rec.total_cost;
        ELSIF rec.stock_ownership_snapshot = 'ABDO' THEN
            v_abdo_stock_cost := v_abdo_stock_cost + rec.total_cost;
        ELSE
            v_shared_stock_cost := v_shared_stock_cost + rec.total_cost;
        END IF;

        -- Work Type Profit Distribution Rule:
        -- CLIENT Work: Net Profit split 50% Ahmed, 50% Abdo
        -- AHMED Work: Cost refunded to pool, 100% remaining profit to Ahmed
        -- ABDO Work: Cost refunded to pool, 25% remaining profit to Ahmed, 75% to Abdo
        IF rec.work_owner = 'AHMED' THEN
            v_ahmed_profit := v_ahmed_profit + (rec.total_price - rec.total_cost);
        ELSIF rec.work_owner = 'ABDO' THEN
            v_ahmed_profit := v_ahmed_profit + ((rec.total_price - rec.total_cost) * 0.25);
            v_abdo_profit := v_abdo_profit + ((rec.total_price - rec.total_cost) * 0.75);
        ELSE -- CLIENT
            v_ahmed_profit := v_ahmed_profit + ((rec.total_price - rec.total_cost) * 0.50);
            v_abdo_profit := v_abdo_profit + ((rec.total_price - rec.total_cost) * 0.50);
        END IF;
    END LOOP;

    -- Subtract Expenses equally from net profits
    v_ahmed_profit := v_ahmed_profit - (v_total_expenses / 2.0);
    v_abdo_profit := v_abdo_profit - (v_total_expenses / 2.0);

    RETURN jsonb_build_object(
        'month', p_month,
        'gross_revenue', v_gross_revenue,
        'total_expenses', v_total_expenses,
        'goods_compensation_pool', v_total_cost_of_goods,
        'ahmed_stock_cost', v_ahmed_stock_cost,
        'abdo_stock_cost', v_abdo_stock_cost,
        'shared_stock_cost', v_shared_stock_cost,
        'ahmed_profit_share', v_ahmed_profit,
        'abdo_profit_share', v_abdo_profit
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Helper RLS Auth Functions
CREATE OR REPLACE FUNCTION public.get_auth_user_role()
RETURNS public.user_role_enum
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.role
  FROM public.profiles p
  WHERE p.id = auth.uid()
    AND p.is_active = true
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(public.get_auth_user_role() = 'OWNER'::public.user_role_enum, false);
$$;

GRANT EXECUTE ON FUNCTION public.get_auth_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;

-- =============================================================================
-- 7. ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_part_usages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_warranties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.common_faults ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.received_accessories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_settlement_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settlement_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_reset_security_logs ENABLE ROW LEVEL SECURITY;

-- Helper to drop legacy policies cleanly
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN
        SELECT policyname, tablename
        FROM pg_policies
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, pol.tablename);
    END LOOP;
END $$;

-- 7.1 PROFILES
CREATE POLICY "Authenticated users view profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated users manage profiles" ON public.profiles FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7.2 STORE SETTINGS
CREATE POLICY "Authenticated users view store settings" ON public.store_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Owners insert store settings" ON public.store_settings FOR INSERT TO authenticated WITH CHECK (public.is_owner());
CREATE POLICY "Owners update store settings" ON public.store_settings FOR UPDATE TO authenticated USING (public.is_owner()) WITH CHECK (public.is_owner());
CREATE POLICY "Owners delete store settings" ON public.store_settings FOR DELETE TO authenticated USING (public.is_owner());

-- 7.3 OPERATIONAL CATALOGS & PRODUCTS
CREATE POLICY "Authenticated users manage categories" ON public.categories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users manage products" ON public.products FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users manage inventory_movements" ON public.inventory_movements FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7.4 CUSTOMERS & SUPPLIERS
DROP POLICY IF EXISTS "Staff manage customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users manage customers" ON public.customers;

CREATE POLICY "Staff manage customers"
ON public.customers
FOR ALL
TO authenticated
USING (
  public.is_owner()
  OR public.get_auth_user_role() IN (
    'RECEPTION'::public.user_role_enum,
    'CASHIER'::public.user_role_enum
  )
)
WITH CHECK (
  public.is_owner()
  OR public.get_auth_user_role() IN (
    'RECEPTION'::public.user_role_enum,
    'CASHIER'::public.user_role_enum
  )
);

CREATE POLICY "Authenticated users manage suppliers" ON public.suppliers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7.5 INVOICES & REPAIRS
CREATE POLICY "Authenticated users manage invoices" ON public.invoices FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users manage invoice_items" ON public.invoice_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Public tracking view for customers + Authenticated full management for repair orders
CREATE POLICY "Public tracking view repair orders" ON public.repair_orders FOR SELECT TO public USING (true);
CREATE POLICY "Authenticated users manage repair_orders" ON public.repair_orders FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users manage repair_part_usages" ON public.repair_part_usages FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users manage repair_warranties" ON public.repair_warranties FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7.6 META TABLES (Services, Faults, Accessories, Conditions)
CREATE POLICY "Authenticated users manage repair_services" ON public.repair_services FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users manage common_faults" ON public.common_faults FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users manage received_accessories" ON public.received_accessories FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users manage device_conditions" ON public.device_conditions FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7.7 FINANCIAL & PARTNER TABLES
CREATE POLICY "Authenticated users manage expenses" ON public.expenses FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users manage partner_ledger" ON public.partner_ledger FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users manage partner_settlements" ON public.partner_settlements FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users manage partner_settlement_payments" ON public.partner_settlement_payments FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users manage partner_transactions" ON public.partner_transactions FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users manage settlement_audit_logs" ON public.settlement_audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 7.8 LOGS & NOTIFICATIONS
CREATE POLICY "Authenticated users manage activity_logs" ON public.activity_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users manage audit_logs" ON public.audit_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users manage system_notifications" ON public.system_notifications FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated users manage system_reset_security_logs" ON public.system_reset_security_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- =============================================================================
-- 8. PHASE 6.1 — ACCOUNTING PROFIT ENGINE TABLES & RPC
-- =============================================================================

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

-- Central Atomic RPC Function
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
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول لتنفيذ المعالجة المحاسبية.';
    END IF;

    SELECT * INTO v_inv FROM public.invoices WHERE id = p_invoice_id;
    IF v_inv.id IS NULL THEN
        RAISE EXCEPTION 'الفاتورة المطلوبة غير موجودة.';
    END IF;

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

    IF v_inv.status = 'cancelled'::public.invoice_status_enum THEN
        v_is_cancelled := true;
    END IF;

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

-- =============================================================================
-- 9. PHASE 6.2 — PARTNER LEDGER & TRANSACTIONS RPC & POLICIES
-- =============================================================================

ALTER TABLE public.partner_ledger ADD COLUMN IF NOT EXISTS account_owner TEXT DEFAULT 'AHMED';
ALTER TABLE public.partner_ledger ADD COLUMN IF NOT EXISTS signed_amount NUMERIC(12, 2) DEFAULT 0.00;
ALTER TABLE public.partner_ledger ADD COLUMN IF NOT EXISTS invoice_number TEXT;
ALTER TABLE public.partner_ledger ADD COLUMN IF NOT EXISTS accounting_ledger_id UUID REFERENCES public.invoice_accounting_ledger(id) ON DELETE CASCADE;
ALTER TABLE public.partner_ledger ADD COLUMN IF NOT EXISTS source_key TEXT;
ALTER TABLE public.partner_ledger ADD COLUMN IF NOT EXISTS reversed_at TIMESTAMPTZ;
ALTER TABLE public.partner_ledger ADD COLUMN IF NOT EXISTS reversed_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.partner_ledger ADD COLUMN IF NOT EXISTS reversal_of_id UUID REFERENCES public.partner_ledger(id) ON DELETE SET NULL;
ALTER TABLE public.partner_ledger ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

ALTER TABLE public.partner_ledger DROP CONSTRAINT IF EXISTS chk_partner_ledger_account_owner;
ALTER TABLE public.partner_ledger ADD CONSTRAINT chk_partner_ledger_account_owner
  CHECK (account_owner IN ('AHMED', 'ABDO', 'REPLACEMENT_FUND'));

ALTER TABLE public.partner_ledger DROP CONSTRAINT IF EXISTS chk_partner_ledger_trans_type;
ALTER TABLE public.partner_ledger ADD CONSTRAINT chk_partner_ledger_trans_type
  CHECK (transaction_type IN ('PROFIT_SHARE', 'COGS_RECOVERY', 'SETTLEMENT_OBLIGATION', 'REPLACEMENT_FUND_ALLOCATION', 'REVERSAL', 'MANUAL_ADJUSTMENT'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_partner_ledger_source_key ON public.partner_ledger (source_key) WHERE source_key IS NOT NULL AND reversed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_partner_ledger_invoice ON public.partner_ledger (invoice_id);
CREATE INDEX IF NOT EXISTS idx_partner_ledger_owner ON public.partner_ledger (account_owner);
CREATE INDEX IF NOT EXISTS idx_partner_ledger_type ON public.partner_ledger (transaction_type);

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
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'غير مصرح: يجب تسجيل الدخول لتنفيذ ترحيل دفتر الشركاء.';
    END IF;

    PERFORM public.post_invoice_accounting(p_invoice_id);

    SELECT * INTO v_acc FROM public.invoice_accounting_ledger WHERE invoice_id = p_invoice_id;
    IF v_acc.id IS NULL THEN
        RAISE EXCEPTION 'لم يتم العثور على القيود المحاسبية للفاتورة.';
    END IF;

    v_post_time := EXTRACT(EPOCH FROM NOW())::TEXT;

    FOR v_rec IN 
        SELECT * FROM public.partner_ledger 
        WHERE invoice_id = p_invoice_id 
          AND reversed_at IS NULL 
          AND transaction_type != 'REVERSAL'
    LOOP
        UPDATE public.partner_ledger 
        SET reversed_at = NOW(), reversed_by = v_user_id 
        WHERE id = v_rec.id;

        INSERT INTO public.partner_ledger (
            account_owner, transaction_type, amount, signed_amount,
            invoice_id, invoice_number, accounting_ledger_id, work_type,
            reference_type, reference_id, reversal_of_id, description,
            created_by_user_id, reversed_at, reversed_by, source_key, metadata
        ) VALUES (
            v_rec.account_owner, 'REVERSAL', v_rec.amount, -1 * v_rec.signed_amount,
            p_invoice_id, v_acc.invoice_number, v_acc.id, v_acc.work_type,
            'INVOICE_REVERSAL', v_rec.id::text, v_rec.id, 'عكس قيد سابق للفاتورة ' || v_acc.invoice_number,
            v_user_id, NOW(), v_user_id, p_invoice_id::text || '_REV_' || v_rec.id::text || '_' || v_post_time,
            jsonb_build_object('reversed_original_id', v_rec.id)
        );

        v_reversals_created := v_reversals_created + 1;
    END LOOP;

    IF NOT v_acc.is_cancelled THEN
        IF v_acc.work_type = 'CUSTOMER_WORK' THEN
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

        ELSIF v_acc.work_type = 'AHMED_WORK' THEN
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

        ELSIF v_acc.work_type = 'ABDO_WORK' THEN
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

-- =============================================================================
-- END OF SCHEMA SCRIPT
-- =============================================================================
