-- =============================================================================
-- ATARI STORE PRO X - FIX REPAIR ORDERS & CUSTOMERS RLS POLICIES
-- Ensures POS terminal frontend can freely INSERT, SELECT, UPDATE, DELETE 
-- repair orders and customer records in Supabase.
-- =============================================================================

-- 1. Repair Orders Table Policies
DROP POLICY IF EXISTS "Public tracking view repair orders" ON public.repair_orders;
DROP POLICY IF EXISTS "Authenticated users manage repair_orders" ON public.repair_orders;
DROP POLICY IF EXISTS "Public manage repair_orders" ON public.repair_orders;

CREATE POLICY "Public manage repair_orders"
ON public.repair_orders
FOR ALL
TO public
USING (true)
WITH CHECK (true);

-- 2. Customers Table Policies
DROP POLICY IF EXISTS "Staff manage customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users manage customers" ON public.customers;
DROP POLICY IF EXISTS "Public manage customers" ON public.customers;

CREATE POLICY "Public manage customers"
ON public.customers
FOR ALL
TO public
USING (true)
WITH CHECK (true);
