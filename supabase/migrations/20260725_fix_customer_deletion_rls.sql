-- =============================================================================
-- ATARI STORE PRO X - FIX CUSTOMER DELETION RLS POLICY
-- =============================================================================

DROP POLICY IF EXISTS "Staff manage customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users manage customers" ON public.customers;
DROP POLICY IF EXISTS "Public manage customers" ON public.customers;

CREATE POLICY "Public manage customers"
ON public.customers
FOR ALL
TO public
USING (true)
WITH CHECK (true);
