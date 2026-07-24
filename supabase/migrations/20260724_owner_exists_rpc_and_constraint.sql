-- Migration: Create owner_exists RPC function and enforce single owner constraint
-- Function is callable by unauthenticated (anon) and authenticated users safely without returning personal data.

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

-- Ensure check_has_owner points to owner_exists as alias
CREATE OR REPLACE FUNCTION public.check_has_owner()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN public.owner_exists();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

GRANT EXECUTE ON FUNCTION public.check_has_owner() TO anon, authenticated, service_role;

-- Enforce database-level constraint preventing creation of multiple OWNER records
CREATE UNIQUE INDEX IF NOT EXISTS idx_single_owner_profile 
ON public.profiles (role) 
WHERE role = 'OWNER'::public.user_role_enum;
