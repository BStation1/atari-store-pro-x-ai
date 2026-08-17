-- Products
DROP POLICY IF EXISTS "Authenticated users manage products" ON public.products;
DROP POLICY IF EXISTS "Authenticated users view products" ON public.products;
DROP POLICY IF EXISTS "Inventory roles manage products" ON public.products;
CREATE POLICY "Authenticated users view products" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "Inventory roles manage products" ON public.products FOR ALL TO authenticated USING (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','INVENTORY'])) WITH CHECK (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','INVENTORY']));

-- Inventory movements
DROP POLICY IF EXISTS "Authenticated users manage inventory_movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "Operational roles view inventory movements" ON public.inventory_movements;
DROP POLICY IF EXISTS "Inventory roles manage inventory movements" ON public.inventory_movements;
CREATE POLICY "Operational roles view inventory movements" ON public.inventory_movements FOR SELECT TO authenticated USING (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','INVENTORY','ACCOUNTANT','CASHIER']));
CREATE POLICY "Inventory roles manage inventory movements" ON public.inventory_movements FOR ALL TO authenticated USING (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','INVENTORY'])) WITH CHECK (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','INVENTORY']));

-- Suppliers
DROP POLICY IF EXISTS "Authenticated users manage suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Operational roles view suppliers" ON public.suppliers;
DROP POLICY IF EXISTS "Inventory roles manage suppliers" ON public.suppliers;
CREATE POLICY "Operational roles view suppliers" ON public.suppliers FOR SELECT TO authenticated USING (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','INVENTORY','ACCOUNTANT']));
CREATE POLICY "Inventory roles manage suppliers" ON public.suppliers FOR ALL TO authenticated USING (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','INVENTORY'])) WITH CHECK (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','INVENTORY']));

-- Invoices
DROP POLICY IF EXISTS "Authenticated users manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "Finance roles view invoices" ON public.invoices;
DROP POLICY IF EXISTS "Sales roles manage invoices" ON public.invoices;
CREATE POLICY "Finance roles view invoices" ON public.invoices FOR SELECT TO authenticated USING (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','CASHIER','ACCOUNTANT','VIEWER']));
CREATE POLICY "Sales roles manage invoices" ON public.invoices FOR ALL TO authenticated USING (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','CASHIER'])) WITH CHECK (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','CASHIER']));

-- Invoice items
DROP POLICY IF EXISTS "Authenticated users manage invoice_items" ON public.invoice_items;
DROP POLICY IF EXISTS "Finance roles view invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Sales roles manage invoice items" ON public.invoice_items;
CREATE POLICY "Finance roles view invoice items" ON public.invoice_items FOR SELECT TO authenticated USING (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','CASHIER','ACCOUNTANT','VIEWER']));
CREATE POLICY "Sales roles manage invoice items" ON public.invoice_items FOR ALL TO authenticated USING (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','CASHIER'])) WITH CHECK (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','CASHIER']));

-- Expenses
DROP POLICY IF EXISTS "Authenticated users manage expenses" ON public.expenses;
DROP POLICY IF EXISTS "Finance roles view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Finance roles manage expenses" ON public.expenses;
CREATE POLICY "Finance roles view expenses" ON public.expenses FOR SELECT TO authenticated USING (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','ACCOUNTANT','CASHIER']));
CREATE POLICY "Finance roles manage expenses" ON public.expenses FOR ALL TO authenticated USING (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','ACCOUNTANT'])) WITH CHECK (public.has_app_role(ARRAY['OWNER','ADMIN','MANAGER','ACCOUNTANT']));

-- Invoice accounting
DROP POLICY IF EXISTS "Authenticated users manage invoice accounting" ON public.invoice_accounting_ledger;
DROP POLICY IF EXISTS "Authenticated users view invoice accounting" ON public.invoice_accounting_ledger;
DROP POLICY IF EXISTS "Accounting roles view invoice accounting" ON public.invoice_accounting_ledger;
DROP POLICY IF EXISTS "Accounting roles manage invoice accounting" ON public.invoice_accounting_ledger;
CREATE POLICY "Accounting roles view invoice accounting" ON public.invoice_accounting_ledger FOR SELECT TO authenticated USING (public.has_app_role(ARRAY['OWNER','ADMIN','ACCOUNTANT']));
CREATE POLICY "Accounting roles manage invoice accounting" ON public.invoice_accounting_ledger FOR ALL TO authenticated USING (public.has_app_role(ARRAY['OWNER','ADMIN','ACCOUNTANT'])) WITH CHECK (public.has_app_role(ARRAY['OWNER','ADMIN','ACCOUNTANT']));

-- Partner private accounting
DROP POLICY IF EXISTS "Authenticated users manage partner_ledger" ON public.partner_ledger;
DROP POLICY IF EXISTS "Accounting roles manage partner ledger" ON public.partner_ledger;
CREATE POLICY "Accounting roles manage partner ledger" ON public.partner_ledger FOR ALL TO authenticated USING (public.has_app_role(ARRAY['OWNER','ACCOUNTANT'])) WITH CHECK (public.has_app_role(ARRAY['OWNER','ACCOUNTANT']));

DROP POLICY IF EXISTS "Authenticated users manage partner_transactions" ON public.partner_transactions;
DROP POLICY IF EXISTS "Accounting roles manage partner transactions" ON public.partner_transactions;
CREATE POLICY "Accounting roles manage partner transactions" ON public.partner_transactions FOR ALL TO authenticated USING (public.has_app_role(ARRAY['OWNER','ACCOUNTANT'])) WITH CHECK (public.has_app_role(ARRAY['OWNER','ACCOUNTANT']));

DROP POLICY IF EXISTS "Authenticated users manage partner_settlements" ON public.partner_settlements;
DROP POLICY IF EXISTS "Accounting roles manage partner settlements" ON public.partner_settlements;
CREATE POLICY "Accounting roles manage partner settlements" ON public.partner_settlements FOR ALL TO authenticated USING (public.has_app_role(ARRAY['OWNER','ACCOUNTANT'])) WITH CHECK (public.has_app_role(ARRAY['OWNER','ACCOUNTANT']));

DROP POLICY IF EXISTS "Authenticated users manage partner_settlement_payments" ON public.partner_settlement_payments;
DROP POLICY IF EXISTS "Accounting roles manage partner settlement payments" ON public.partner_settlement_payments;
CREATE POLICY "Accounting roles manage partner settlement payments" ON public.partner_settlement_payments FOR ALL TO authenticated USING (public.has_app_role(ARRAY['OWNER','ACCOUNTANT'])) WITH CHECK (public.has_app_role(ARRAY['OWNER','ACCOUNTANT']));
