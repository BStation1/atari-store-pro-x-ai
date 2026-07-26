-- =============================================================================
-- ATARI STORE PRO X - FIX PRODUCTS DELETION AND ARCHIVING RLS POLICIES
-- =============================================================================

-- Ensure products table has is_active and is_archived columns if not present
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_active') THEN
        ALTER TABLE public.products ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT true;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='is_archived') THEN
        ALTER TABLE public.products ADD COLUMN is_archived BOOLEAN NOT NULL DEFAULT false;
    END IF;
END $$;

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
