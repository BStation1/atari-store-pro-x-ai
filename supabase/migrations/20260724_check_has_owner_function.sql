-- Migration: Add check_has_owner RPC function for unauthenticated/authenticated owner verification
-- Prevents RLS blocking when checking if an owner account exists on startup across any device or browser.

CREATE OR REPLACE FUNCTION public.check_has_owner()
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

-- Grant execution permissions
GRANT EXECUTE ON FUNCTION public.check_has_owner() TO anon, authenticated, service_role;

-- Policy to allow anon to check owner profiles if direct query is used
DROP POLICY IF EXISTS "Allow anon check owner" ON public.profiles;
CREATE POLICY "Allow anon check owner" ON public.profiles 
    FOR SELECT TO anon 
    USING (role = 'OWNER'::public.user_role_enum OR role::text IN ('OWNER', 'ADMIN'));
