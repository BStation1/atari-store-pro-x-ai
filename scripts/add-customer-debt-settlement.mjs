import fs from 'node:fs';

function replaceOrThrow(source, needle, replacement, label) {
  if (!source.includes(needle)) throw new Error(`Could not patch ${label}`);
  return source.replace(needle, replacement);
}

// 1) Supabase invoice payment updater
{
  const file = 'src/lib/supabaseInvoices.ts';
  let source = fs.readFileSync(file, 'utf8');
  if (!source.includes('updateInvoicePaymentToSupabase')) {
    source += `\n\n/** Apply a later customer payment to an existing sales invoice. */\nexport async function updateInvoicePaymentToSupabase(\n  invoiceId: string,\n  paymentAmount: number,\n  paymentMethod: PaymentMethod | string,\n  currentUser?: User\n): Promise<Invoice> {\n  const amount = Number(paymentAmount || 0);\n  if (!Number.isFinite(amount) || amount <= 0) throw new Error('قيمة السداد غير صحيحة');\n\n  let query = supabase.from('invoices').select('*');\n  query = isUuid(invoiceId) ? query.eq('id', invoiceId) : query.eq('invoice_number', invoiceId);\n  const { data: row, error: fetchError } = await query.maybeSingle();\n  if (fetchError || !row) throw new Error(fetchError?.message || 'الفاتورة غير موجودة في قاعدة البيانات');\n\n  const netTotal = Math.max(0, Number(row.total_amount || 0) - Number(row.discount_amount || 0));\n  const oldPaid = Math.max(0, Number(row.paid_amount || 0));\n  const newPaid = Math.min(netTotal, oldPaid + amount);\n  const remaining = Math.max(0, netTotal - newPaid);\n  const status = remaining <= 0 ? 'paid' : newPaid > 0 ? 'partially_paid' : 'unpaid';\n\n  const { data: updatedRow, error: updateError } = await supabase\n    .from('invoices')\n    .update({\n      paid_amount: newPaid,\n      remaining_amount: remaining,\n      payment_method: mapPaymentMethodToEnum(paymentMethod),\n      status\n    })\n    .eq('id', row.id)\n    .select('*')\n    .single();\n  if (updateError || !updatedRow) throw new Error(updateError?.message || 'تعذر تسجيل سداد الفاتورة');\n\n  const { data: items } = await supabase.from('invoice_items').select('*').eq('invoice_id', row.id);\n  const updated = mapRowToInvoice(updatedRow, items || []);\n  const local = getLocalInvoicesBackup();\n  saveLocalInvoicesBackup(local.map(i => i.id === updated.id ? updated : i), false);\n  return updated;\n}\n`;
    fs.writeFileSync(file, source, 'utf8');
  }
}

// 2) Export updater from unified data layer
{
  const file = 'src/lib/data/invoices.ts';
  let source = fs.readFileSync(file, 'utf8');
  if (!source.includes('updateInvoicePaymentToSupabase')) {
    source = source.replace(
      '  cancelInvoiceInSupabase,\n  getLocalInvoicesBackup',
      '  cancelInvoiceInSupabase,\n  updateInvoicePaymentToSupabase,\n  getLocalInvoicesBackup'
    );
    source = source.replace(
      '  cancelInvoiceInSupabase,\n  getLocalInvoicesBackup,\n  runInvoicesTestSuite',
      '  cancelInvoiceInSupabase,\n  updateInvoicePaymentToSupabase,\n  getLocalInvoicesBackup,\n  runInvoicesTestSuite'
    );
    fs.writeFileSync(file, source, 'utf8');
  }
}

// 3) Expose updater through useInvoices
{
  const file = 'src/hooks/useData.ts';
  let source = fs.readFileSync(file, 'utf8');
  if (!source.includes('const updateInvoicePayment = async')) {
    source = source.replace(
      '  cancelInvoiceInSupabase,\n  getLocalInvoicesBackup,',
      '  cancelInvoiceInSupabase,\n  updateInvoicePaymentToSupabase,\n  getLocalInvoicesBackup,'
    );
    source = replaceOrThrow(
      source,
      `  const cancelInvoice = async (invoiceId: string, reason: string, currentUser?: User) => {\n    const res = await cancelInvoiceInSupabase(invoiceId, reason, currentUser);\n    if (res.success) {\n      setInvoices(prev => prev.map(i => i.id === invoiceId ? { ...i, status: 'cancelled', isPaid: false } : i));\n      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_invoices' } }));\n    }\n    return res;\n  };\n\n  return { invoices, loading, error, addInvoice, cancelInvoice };`,
      `  const cancelInvoice = async (invoiceId: string, reason: string, currentUser?: User) => {\n    const res = await cancelInvoiceInSupabase(invoiceId, reason, currentUser);\n    if (res.success) {\n      setInvoices(prev => prev.map(i => i.id === invoiceId ? { ...i, status: 'cancelled', isPaid: false } : i));\n      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_invoices' } }));\n    }\n    return res;\n  };\n\n  const updateInvoicePayment = async (invoiceId: string, amount: number, paymentMethod: PaymentMethod | string, currentUser?: User) => {\n    const updated = await updateInvoicePaymentToSupabase(invoiceId, amount, paymentMethod, currentUser);\n    setInvoices(prev => prev.map(i => i.id === updated.id ? updated : i));\n    window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_invoices' } }));\n    return updated;\n  };\n\n  return { invoices, loading, error, addInvoice, cancelInvoice, updateInvoicePayment };`,
      'useInvoices payment updater'
    );
    fs.writeFileSync(file, source, 'utf8');
  }
}

// 4) Add debt settlement button + handler to customer account screen.
{
  const file = 'src/components/CustomersList.tsx';
  let source = fs.readFileSync(file, 'utf8');

  source = source.replace(
    'import { Customer, CustomerType, RepairOrder, Invoice } from "../types";',
    'import { Customer, CustomerType, RepairOrder, Invoice, PaymentMethod } from "../types";'
  );
  source = source.replace(
    '  const { orders } = useRepairOrders();',
    '  const { orders, updateRepairOrder } = useRepairOrders();'
  );
  source = source.replace(
    '  const { invoices } = useInvoices();',
    '  const { invoices, addInvoice, updateInvoicePayment } = useInvoices();'
  );

  if (!source.includes('handleSettleCustomerDebt')) {
    const whatsappHandler = '  const handleDebtWhatsAppReminder = async (cust: Customer) => {';
    const idx = source.indexOf(whatsappHandler);
    if (idx === -1) throw new Error('Debt WhatsApp handler missing; run debt reminder patch first');

    const handler = `  const handleSettleCustomerDebt = async (cust: Customer) => {\n    const totalDebt = getCustomerOutstandingBalance(cust.id);\n    if (totalDebt <= 0) {\n      await dialog.alert({ message: 'لا توجد مديونية مستحقة على هذا العميل.', variant: 'warning' });\n      return;\n    }\n\n    const amountText = await dialog.prompt({\n      title: 'تسديد مديونية العميل',\n      message: \`إجمالي المديونية الحالية: \${totalDebt.toLocaleString('ar-EG')} ج.م\\nأدخل المبلغ المستلم الآن (يمكن سداد جزء من المديونية):\`,\n      placeholder: String(totalDebt)\n    });\n    if (amountText == null) return;\n    const amount = Number(String(amountText).replace(/,/g, '').trim());\n    if (!Number.isFinite(amount) || amount <= 0 || amount > totalDebt) {\n      await dialog.alert({ message: 'قيمة السداد غير صحيحة أو أكبر من المديونية الحالية.', variant: 'error' });\n      return;\n    }\n\n    let method: PaymentMethod = PaymentMethod.Cash;\n    const isCash = await dialog.confirm({\n      title: 'طريقة السداد',\n      message: 'هل تم استلام المبلغ نقداً (كاش)؟',\n      confirmText: 'نعم - كاش',\n      cancelText: 'طريقة أخرى'\n    });\n    if (!isCash) {\n      const isInsta = await dialog.confirm({\n        title: 'طريقة السداد',\n        message: 'هل تم السداد عن طريق InstaPay؟',\n        confirmText: 'نعم - InstaPay',\n        cancelText: 'فيزا / بطاقة'\n      });\n      method = isInsta ? PaymentMethod.InstaPay : PaymentMethod.Visa;\n    }\n\n    const confirmed = await dialog.confirm({\n      title: 'تأكيد تسجيل التحصيل',\n      message: \`سيتم تسجيل تحصيل \${amount.toLocaleString('ar-EG')} ج.م من العميل \${cust.name}.\\nسيتم خصم المبلغ من أقدم مديونية أولاً.\`,\n      confirmText: 'تأكيد التحصيل',\n      cancelText: 'إلغاء'\n    });\n    if (!confirmed) return;\n\n    try {\n      let remainingPayment = amount;\n\n      const repairDebts = orders\n        .filter(o => o.customerId === cust.id && Number(o.deliverySnapshot?.remainingBalance || 0) > 0)\n        .sort((a, b) => new Date(a.deliveredAt || a.receivedDate || 0).getTime() - new Date(b.deliveredAt || b.receivedDate || 0).getTime());\n\n      for (const order of repairDebts) {\n        if (remainingPayment <= 0) break;\n        const oldSnapshot = order.deliverySnapshot!;\n        const debt = Math.max(0, Number(oldSnapshot.remainingBalance || 0));\n        const applied = Math.min(debt, remainingPayment);\n        if (applied <= 0) continue;\n        const newRemaining = Math.max(0, debt - applied);\n        const newSnapshot = {\n          ...oldSnapshot,\n          totalPaid: Number(oldSnapshot.totalPaid || 0) + applied,\n          remainingBalance: newRemaining,\n          paymentMethod: method\n        };\n        const history = (order.deliveryHistory || []).map(s =>\n          s.version === oldSnapshot.version ? newSnapshot : s\n        );\n        await updateRepairOrder({\n          ...order,\n          deliverySnapshot: newSnapshot,\n          deliveryHistory: history,\n          isPaid: newRemaining <= 0\n        });\n\n        await addInvoice({\n          customerId: cust.id,\n          orderId: order.id,\n          items: [{ name: \`تحصيل مديونية صيانة - \${order.id}\`, quantity: 1, price: applied }],\n          totalAmount: applied,\n          discount: 0,\n          paidAmount: applied,\n          paymentMethod: method,\n          type: 'repair',\n          isPaid: true\n        });\n        remainingPayment -= applied;\n      }\n\n      if (remainingPayment > 0) {\n        const salesDebts = invoices\n          .filter(inv => inv.customerId === cust.id && !inv.isCancelled && inv.type !== 'repair')\n          .map(inv => ({\n            inv,\n            debt: Math.max(0, Number(inv.totalAmount || 0) - Number(inv.discount || 0) - Number(inv.paidAmount || 0))\n          }))\n          .filter(x => x.debt > 0)\n          .sort((a, b) => new Date(a.inv.date || 0).getTime() - new Date(b.inv.date || 0).getTime());\n\n        for (const entry of salesDebts) {\n          if (remainingPayment <= 0) break;\n          const applied = Math.min(entry.debt, remainingPayment);\n          await updateInvoicePayment(entry.inv.id, applied, method);\n          remainingPayment -= applied;\n        }\n      }\n\n      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_repair_orders' } }));\n      window.dispatchEvent(new CustomEvent('atari_db_changed', { detail: { key: 'atari_invoices' } }));\n      await dialog.alert({\n        message: \`تم تسجيل تحصيل \${amount.toLocaleString('ar-EG')} ج.م بنجاح. المتبقي على العميل: \${Math.max(0, totalDebt - amount).toLocaleString('ar-EG')} ج.م.\`,\n        variant: 'success'\n      });\n    } catch (err: any) {\n      await dialog.alert({ message: err?.message || 'تعذر تسجيل سداد المديونية', variant: 'error' });\n    }\n  };\n\n`;
    source = source.slice(0, idx) + handler + source.slice(idx);
  }

  if (!source.includes('تسديد مديونية')) {
    const reminderButtonNeedle = `              {getCustomerOutstandingBalance(activeCustomer.id) > 0 && (\n                <button\n                  type="button"\n                  onClick={() => handleDebtWhatsAppReminder(activeCustomer)}`;
    const paymentButton = `              {getCustomerOutstandingBalance(activeCustomer.id) > 0 && (\n                <button\n                  type="button"\n                  onClick={() => handleSettleCustomerDebt(activeCustomer)}\n                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg text-xs font-bold transition-all-custom cursor-pointer flex items-center justify-center gap-2"\n                >\n                  <DollarSign className="w-4 h-4" />\n                  تسديد مديونية\n                </button>\n              )}\n`;
    if (!source.includes(reminderButtonNeedle)) throw new Error('Debt reminder button location not found');
    source = source.replace(reminderButtonNeedle, paymentButton + reminderButtonNeedle);
  }

  fs.writeFileSync(file, source, 'utf8');
}

console.log('Customer debt settlement flow installed.');
