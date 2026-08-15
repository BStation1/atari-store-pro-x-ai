-- Keep the database role enum aligned with every role exposed by the staff UI.
-- OWNER remains the only role accepted by owner-only RLS and admin functions.
ALTER TYPE public.user_role_enum ADD VALUE IF NOT EXISTS 'ADMIN';
ALTER TYPE public.user_role_enum ADD VALUE IF NOT EXISTS 'MANAGER';
ALTER TYPE public.user_role_enum ADD VALUE IF NOT EXISTS 'INVENTORY';
ALTER TYPE public.user_role_enum ADD VALUE IF NOT EXISTS 'ACCOUNTANT';
ALTER TYPE public.user_role_enum ADD VALUE IF NOT EXISTS 'VIEWER';
