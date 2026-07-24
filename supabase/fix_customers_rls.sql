-- =============================================================================
-- ATARI STORE PRO X - FIX CUSTOMERS RLS & SECURITY DEFINER FUNCTIONS
-- Run this script in Supabase SQL Editor to update RLS Policies and Functions
-- =============================================================================

-- 1. Create/Update Security Definer Helper Functions
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

-- 2. Grant Execute Permissions to Authenticated Role
GRANT EXECUTE ON FUNCTION public.get_auth_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;

-- 3. Drop existing policies on customers table
DROP POLICY IF EXISTS "Staff manage customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users manage customers" ON public.customers;

-- 4. Re-create "Staff manage customers" policy with explicit USING and WITH CHECK
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
