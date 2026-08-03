-- Keep store settings private to authenticated staff while ensuring that only
-- an authenticated owner can create, change, or delete them.

ALTER TABLE public.store_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can view store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Authenticated users edit store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Anyone authenticated can view store settings" ON public.store_settings;
DROP POLICY IF EXISTS "OWNER can edit store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Public can view store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Authenticated users view store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Owners insert store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Owners update store settings" ON public.store_settings;
DROP POLICY IF EXISTS "Owners delete store settings" ON public.store_settings;

CREATE POLICY "Authenticated users view store settings"
ON public.store_settings
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Owners insert store settings"
ON public.store_settings
FOR INSERT
TO authenticated
WITH CHECK (public.is_owner());

CREATE POLICY "Owners update store settings"
ON public.store_settings
FOR UPDATE
TO authenticated
USING (public.is_owner())
WITH CHECK (public.is_owner());

CREATE POLICY "Owners delete store settings"
ON public.store_settings
FOR DELETE
TO authenticated
USING (public.is_owner());

-- SECURITY DEFINER helpers must not retain PostgreSQL's default PUBLIC execute
-- grant. Only signed-in users need these role checks.
REVOKE EXECUTE ON FUNCTION public.get_auth_user_role() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_owner() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_auth_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;
