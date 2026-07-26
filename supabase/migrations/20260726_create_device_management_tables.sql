-- Migration: Create device_types, device_models, and repair_templates tables
-- Date: 2026-07-26

-- 1. Create device_types table
CREATE TABLE IF NOT EXISTS public.device_types (
    id TEXT PRIMARY KEY,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    brand TEXT DEFAULT 'Sony',
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create device_models table
CREATE TABLE IF NOT EXISTS public.device_models (
    id TEXT PRIMARY KEY,
    device_type_id TEXT REFERENCES public.device_types(id) ON DELETE CASCADE,
    category_id TEXT REFERENCES public.device_types(id) ON DELETE CASCADE,
    brand TEXT DEFAULT 'Sony',
    name_ar TEXT NOT NULL,
    name_en TEXT,
    model_code TEXT,
    storage_options TEXT,
    default_warranty_days INTEGER DEFAULT 30,
    default_inspection_price NUMERIC DEFAULT 0,
    default_repair_price NUMERIC DEFAULT 0,
    notes TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    is_archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_device_models_type ON public.device_models(device_type_id);
CREATE INDEX IF NOT EXISTS idx_device_models_category ON public.device_models(category_id);

-- 3. Create repair_templates table
CREATE TABLE IF NOT EXISTS public.repair_templates (
    id TEXT PRIMARY KEY,
    device_type_id TEXT REFERENCES public.device_types(id) ON DELETE CASCADE,
    category_id TEXT REFERENCES public.device_types(id) ON DELETE CASCADE,
    device_model_id TEXT REFERENCES public.device_models(id) ON DELETE CASCADE,
    model_id TEXT REFERENCES public.device_models(id) ON DELETE CASCADE,
    repair_item_id TEXT,
    product_id TEXT,
    name_ar TEXT NOT NULL,
    name_en TEXT,
    default_cost_price NUMERIC DEFAULT 0,
    cost_price NUMERIC DEFAULT 0,
    default_repair_price NUMERIC DEFAULT 0,
    sale_price NUMERIC DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_repair_templates_type ON public.repair_templates(device_type_id);
CREATE INDEX IF NOT EXISTS idx_repair_templates_model ON public.repair_templates(device_model_id);

-- Enable RLS
ALTER TABLE public.device_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.device_models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.repair_templates ENABLE ROW LEVEL SECURITY;

-- Allow policies
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on device_types') THEN
        CREATE POLICY "Allow all on device_types" ON public.device_types FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on device_models') THEN
        CREATE POLICY "Allow all on device_models" ON public.device_models FOR ALL USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Allow all on repair_templates') THEN
        CREATE POLICY "Allow all on repair_templates" ON public.repair_templates FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
