-- Fix RLS Policies for Operational Reset Tables to allow complete operational reset
-- Enables full access for inventory_movements and operational ledger tables

DROP POLICY IF EXISTS "Authenticated users manage inventory_movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "Public manage inventory_movements" ON public.inventory_movements;
CREATE POLICY "Public manage inventory_movements" ON public.inventory_movements FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage partner_ledger" ON public.partner_ledger;
DROP POLICY IF EXISTS "Public manage partner_ledger" ON public.partner_ledger;
CREATE POLICY "Public manage partner_ledger" ON public.partner_ledger FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage expenses" ON public.expenses;
DROP POLICY IF EXISTS "Public manage expenses" ON public.expenses;
CREATE POLICY "Public manage expenses" ON public.expenses FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "Public manage invoices" ON public.invoices;
CREATE POLICY "Public manage invoices" ON public.invoices FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "Public manage invoice_items" ON public.invoice_items;
CREATE POLICY "Public manage invoice_items" ON public.invoice_items FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage repair_part_usages" ON public.repair_part_usages;
DROP POLICY IF EXISTS "Public manage repair_part_usages" ON public.repair_part_usages;
CREATE POLICY "Public manage repair_part_usages" ON public.repair_part_usages FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Public manage suppliers" ON public.suppliers;
CREATE POLICY "Public manage suppliers" ON public.suppliers FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage activity_logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Public manage activity_logs" ON public.activity_logs;
CREATE POLICY "Public manage activity_logs" ON public.activity_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage audit_logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Public manage audit_logs" ON public.audit_logs;
CREATE POLICY "Public manage audit_logs" ON public.audit_logs FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Authenticated users manage system_notifications" ON public.system_notifications;
DROP POLICY IF EXISTS "Public manage system_notifications" ON public.system_notifications;
CREATE POLICY "Public manage system_notifications" ON public.system_notifications FOR ALL USING (true) WITH CHECK (true);
