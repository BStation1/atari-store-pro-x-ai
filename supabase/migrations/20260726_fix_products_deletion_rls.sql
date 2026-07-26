-- =============================================================================
-- ATARI STORE PRO X - FIX PRODUCTS ARCHIVING & RLS POLICIES
-- =============================================================================

-- Ensure products table has is_archived column if not present
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT false;

-- Update old records where is_archived is null
UPDATE public.products
SET is_archived = false
WHERE is_archived IS NULL;

-- Update RLS policies on products table
DROP POLICY IF EXISTS "Authenticated users manage products" ON public.products;
DROP POLICY IF EXISTS "Anon users manage products" ON public.products;
DROP POLICY IF EXISTS "Public manage products" ON public.products;

CREATE POLICY "Public manage products"
ON public.products
FOR ALL
TO public
USING (true)
WITH CHECK (true);
