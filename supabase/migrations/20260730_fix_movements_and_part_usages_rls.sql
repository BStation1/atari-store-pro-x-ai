-- =============================================================================
-- ATARI STORE PRO X - SAFE AUTHENTICATED RLS POLICIES FOR REPAIR & INVENTORY
-- Allows necessary frontend client operations for products, repair_part_usages,
-- inventory_movements, and repair_orders ONLY for authenticated users.
-- Unauthenticated (anon) users have READ-ONLY or NO write access.
-- =============================================================================

-- 1. public.products (SELECT for public, INSERT/UPDATE/DELETE for authenticated)
DROP POLICY IF EXISTS "Public manage products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users manage products" ON public.products;
DROP POLICY IF EXISTS "Enable products read" ON public.products;
DROP POLICY IF EXISTS "Enable products insert" ON public.products;
DROP POLICY IF EXISTS "Enable products update" ON public.products;
DROP POLICY IF EXISTS "Enable products delete" ON public.products;
DROP POLICY IF EXISTS "Enable products read for public" ON public.products;
DROP POLICY IF EXISTS "Enable products insert for authenticated" ON public.products;
DROP POLICY IF EXISTS "Enable products update for authenticated" ON public.products;
DROP POLICY IF EXISTS "Enable products delete for authenticated" ON public.products;

CREATE POLICY "Enable products read for public" ON public.products FOR SELECT TO public USING (true);
CREATE POLICY "Enable products insert for authenticated" ON public.products FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable products update for authenticated" ON public.products FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable products delete for authenticated" ON public.products FOR DELETE TO authenticated USING (true);

-- 2. public.repair_part_usages (SELECT for public, INSERT/UPDATE/DELETE for authenticated)
DROP POLICY IF EXISTS "Public manage repair_part_usages" ON public.repair_part_usages;
DROP POLICY IF EXISTS "Authenticated users manage repair_part_usages" ON public.repair_part_usages;
DROP POLICY IF EXISTS "Enable repair_part_usages read" ON public.repair_part_usages;
DROP POLICY IF EXISTS "Enable repair_part_usages insert" ON public.repair_part_usages;
DROP POLICY IF EXISTS "Enable repair_part_usages update" ON public.repair_part_usages;
DROP POLICY IF EXISTS "Enable repair_part_usages delete" ON public.repair_part_usages;
DROP POLICY IF EXISTS "Enable repair_part_usages read for public" ON public.repair_part_usages;
DROP POLICY IF EXISTS "Enable repair_part_usages insert for authenticated" ON public.repair_part_usages;
DROP POLICY IF EXISTS "Enable repair_part_usages update for authenticated" ON public.repair_part_usages;
DROP POLICY IF EXISTS "Enable repair_part_usages delete for authenticated" ON public.repair_part_usages;

CREATE POLICY "Enable repair_part_usages read for public" ON public.repair_part_usages FOR SELECT TO public USING (true);
CREATE POLICY "Enable repair_part_usages insert for authenticated" ON public.repair_part_usages FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable repair_part_usages update for authenticated" ON public.repair_part_usages FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable repair_part_usages delete for authenticated" ON public.repair_part_usages FOR DELETE TO authenticated USING (true);

-- 3. public.inventory_movements (SELECT for public, INSERT/UPDATE/DELETE for authenticated)
DROP POLICY IF EXISTS "Public manage inventory_movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "Authenticated users manage inventory_movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "Enable inventory_movements read" ON public.inventory_movements;
DROP POLICY IF EXISTS "Enable inventory_movements insert" ON public.inventory_movements;
DROP POLICY IF EXISTS "Enable inventory_movements delete" ON public.inventory_movements;
DROP POLICY IF EXISTS "Enable inventory_movements update" ON public.inventory_movements;
DROP POLICY IF EXISTS "Enable inventory_movements read for public" ON public.inventory_movements;
DROP POLICY IF EXISTS "Enable inventory_movements insert for authenticated" ON public.inventory_movements;
DROP POLICY IF EXISTS "Enable inventory_movements update for authenticated" ON public.inventory_movements;
DROP POLICY IF EXISTS "Enable inventory_movements delete for authenticated" ON public.inventory_movements;

CREATE POLICY "Enable inventory_movements read for public" ON public.inventory_movements FOR SELECT TO public USING (true);
CREATE POLICY "Enable inventory_movements insert for authenticated" ON public.inventory_movements FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable inventory_movements update for authenticated" ON public.inventory_movements FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable inventory_movements delete for authenticated" ON public.inventory_movements FOR DELETE TO authenticated USING (true);

-- 4. public.repair_orders (SELECT for public, INSERT/UPDATE/DELETE for authenticated)
DROP POLICY IF EXISTS "Public manage repair_orders" ON public.repair_orders;
DROP POLICY IF EXISTS "Authenticated users manage repair_orders" ON public.repair_orders;
DROP POLICY IF EXISTS "Enable repair_orders read" ON public.repair_orders;
DROP POLICY IF EXISTS "Enable repair_orders insert" ON public.repair_orders;
DROP POLICY IF EXISTS "Enable repair_orders update" ON public.repair_orders;
DROP POLICY IF EXISTS "Enable repair_orders delete" ON public.repair_orders;
DROP POLICY IF EXISTS "Enable repair_orders read for public" ON public.repair_orders;
DROP POLICY IF EXISTS "Enable repair_orders insert for authenticated" ON public.repair_orders;
DROP POLICY IF EXISTS "Enable repair_orders update for authenticated" ON public.repair_orders;
DROP POLICY IF EXISTS "Enable repair_orders delete for authenticated" ON public.repair_orders;

CREATE POLICY "Enable repair_orders read for public" ON public.repair_orders FOR SELECT TO public USING (true);
CREATE POLICY "Enable repair_orders insert for authenticated" ON public.repair_orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Enable repair_orders update for authenticated" ON public.repair_orders FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Enable repair_orders delete for authenticated" ON public.repair_orders FOR DELETE TO authenticated USING (true);


