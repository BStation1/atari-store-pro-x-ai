-- =============================================================================
-- ATARI STORE PRO X - FIX RLS FOR OPERATIONAL TABLES (PUBLIC MANAGE)
-- Allows frontend client operations for repair orders, part usages, products & movements
-- =============================================================================

DROP POLICY IF EXISTS "Authenticated users manage inventory_movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "Public manage inventory_movements" ON public.inventory_movements;

CREATE POLICY "Public manage inventory_movements"
ON public.inventory_movements FOR ALL TO public
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage repair_part_usages" ON public.repair_part_usages;
DROP POLICY IF EXISTS "Public manage repair_part_usages" ON public.repair_part_usages;

CREATE POLICY "Public manage repair_part_usages"
ON public.repair_part_usages FOR ALL TO public
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage repair_orders" ON public.repair_orders;
DROP POLICY IF EXISTS "Public manage repair_orders" ON public.repair_orders;

CREATE POLICY "Public manage repair_orders"
ON public.repair_orders FOR ALL TO public
USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage products" ON public.products;
DROP POLICY IF EXISTS "Public manage products" ON public.products;

CREATE POLICY "Public manage products"
ON public.products FOR ALL TO public
USING (true) WITH CHECK (true);
