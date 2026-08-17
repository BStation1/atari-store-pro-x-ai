-- Repair orders
DROP POLICY IF EXISTS "Authenticated users manage repair_orders" ON public.repair_orders;
DROP POLICY IF EXISTS "Repair roles view repair orders" ON public.repair_orders;
DROP POLICY IF EXISTS "Repair staff manage repair orders" ON public.repair_orders;
CREATE POLICY "Repair roles view repair orders" ON public.repair_orders FOR SELECT TO authenticated USING (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','RECEPTION','ENGINEER','CASHIER','VIEWER']));
CREATE POLICY "Repair staff manage repair orders" ON public.repair_orders FOR ALL TO authenticated USING (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','RECEPTION','ENGINEER'])) WITH CHECK (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','RECEPTION','ENGINEER']));

DROP POLICY IF EXISTS "Authenticated users manage repair_part_usages" ON public.repair_part_usages;
DROP POLICY IF EXISTS "Repair roles view part usages" ON public.repair_part_usages;
DROP POLICY IF EXISTS "Repair and inventory roles manage part usages" ON public.repair_part_usages;
CREATE POLICY "Repair roles view part usages" ON public.repair_part_usages FOR SELECT TO authenticated USING (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','RECEPTION','ENGINEER','INVENTORY','CASHIER']));
CREATE POLICY "Repair and inventory roles manage part usages" ON public.repair_part_usages FOR ALL TO authenticated USING (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','ENGINEER','INVENTORY'])) WITH CHECK (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','ENGINEER','INVENTORY']));

DROP POLICY IF EXISTS "Authenticated users manage repair_warranties" ON public.repair_warranties;
DROP POLICY IF EXISTS "Repair roles view warranties" ON public.repair_warranties;
DROP POLICY IF EXISTS "Repair staff manage warranties" ON public.repair_warranties;
CREATE POLICY "Repair roles view warranties" ON public.repair_warranties FOR SELECT TO authenticated USING (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','RECEPTION','ENGINEER','CASHIER','VIEWER']));
CREATE POLICY "Repair staff manage warranties" ON public.repair_warranties FOR ALL TO authenticated USING (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','RECEPTION','ENGINEER'])) WITH CHECK (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','RECEPTION','ENGINEER']));

DROP POLICY IF EXISTS "Authenticated users manage received_accessories" ON public.received_accessories;
DROP POLICY IF EXISTS "Repair roles manage received accessories" ON public.received_accessories;
CREATE POLICY "Repair roles manage received accessories" ON public.received_accessories FOR ALL TO authenticated USING (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','RECEPTION','ENGINEER'])) WITH CHECK (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','RECEPTION','ENGINEER']));

DROP POLICY IF EXISTS "Authenticated users manage repair_services" ON public.repair_services;
CREATE POLICY "Authenticated users view repair services" ON public.repair_services FOR SELECT TO authenticated USING (true);
CREATE POLICY "Technical roles manage repair services" ON public.repair_services FOR ALL TO authenticated USING (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','ENGINEER'])) WITH CHECK (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','ENGINEER']));

DROP POLICY IF EXISTS "Authenticated users manage repair_templates" ON public.repair_templates;
CREATE POLICY "Authenticated users view repair templates" ON public.repair_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "Technical roles manage repair templates" ON public.repair_templates FOR ALL TO authenticated USING (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','ENGINEER'])) WITH CHECK (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','ENGINEER']));

DROP POLICY IF EXISTS "Authenticated users manage common_faults" ON public.common_faults;
CREATE POLICY "Authenticated users view common faults" ON public.common_faults FOR SELECT TO authenticated USING (true);
CREATE POLICY "Technical roles manage common faults" ON public.common_faults FOR ALL TO authenticated USING (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','ENGINEER'])) WITH CHECK (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','ENGINEER']));

DROP POLICY IF EXISTS "Authenticated users manage audit_logs" ON public.audit_logs;
CREATE POLICY "Privileged roles view audit logs" ON public.audit_logs FOR SELECT TO authenticated USING (public.has_app_role(ARRAY['OWNER','ADMIN']));
CREATE POLICY "Authenticated users insert audit logs" ON public.audit_logs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage system_reset_security_logs" ON public.system_reset_security_logs;
CREATE POLICY "Owners view reset security logs" ON public.system_reset_security_logs FOR SELECT TO authenticated USING (public.has_app_role(ARRAY['OWNER','ADMIN']));
CREATE POLICY "Authenticated users insert reset security logs" ON public.system_reset_security_logs FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage activity_logs" ON public.activity_logs;
CREATE POLICY "Privileged roles view activity logs" ON public.activity_logs FOR SELECT TO authenticated USING (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER']));
CREATE POLICY "Authenticated users insert activity logs" ON public.activity_logs FOR INSERT TO authenticated WITH CHECK (true);
