-- Additive compatibility migration for the repair inventory/accounting core.
-- Existing rows and balances are preserved.
ALTER TABLE public.repair_part_usages
  ADD COLUMN IF NOT EXISTS part_name TEXT,
  ADD COLUMN IF NOT EXISTS sku TEXT,
  ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS total_cost NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS selling_total NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS ownership_type TEXT,
  ADD COLUMN IF NOT EXISTS responsible_partner_id TEXT,
  ADD COLUMN IF NOT EXISTS accounting_status TEXT NOT NULL DEFAULT 'CONSUMED',
  ADD COLUMN IF NOT EXISTS employee_name TEXT,
  ADD COLUMN IF NOT EXISTS warehouse TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE public.repair_part_usages
SET
  part_name = COALESCE(part_name, part_name_snapshot),
  unit_cost = COALESCE(unit_cost, cost_price_snapshot),
  total_cost = COALESCE(total_cost, quantity * cost_price_snapshot),
  selling_total = COALESCE(selling_total, quantity * selling_price_snapshot),
  ownership_type = COALESCE(ownership_type, 'CUSTOMER_SHARED'),
  responsible_partner_id = COALESCE(responsible_partner_id, 'SHOP')
WHERE
  part_name IS NULL OR unit_cost IS NULL OR total_cost IS NULL OR
  selling_total IS NULL OR ownership_type IS NULL OR responsible_partner_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_repair_part_usages_status
  ON public.repair_part_usages(accounting_status);

NOTIFY pgrst, 'reload schema';
