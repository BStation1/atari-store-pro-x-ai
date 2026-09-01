import fs from 'node:fs';
import path from 'node:path';

const filePath = path.resolve('src/components/CustomersList.tsx');
let source = fs.readFileSync(filePath, 'utf8');

source = source.replace('  UserCheck\n} from "lucide-react";', '  UserCheck,\n  MessageCircle\n} from "lucide-react";');
source = source.replace('import { formatPhoneDisplay, normalizePhoneNumber } from "../utils/phone";', 'import { formatPhoneDisplay, normalizePhoneNumber } from "../utils/phone";\nimport { openWhatsAppMessage } from "../lib/whatsapp";');

const helperNeedle = `  const getCustomerInvoices = (custID: string): Invoice[] => {\n    return invoices.filter(inv => inv.customerId === custID);\n  };`;
const helperReplacement = `${helperNeedle}\n\n  // Keep this as a function declaration and read directly from hook data.\n  // totalBalance is evaluated earlier in the component, so this helper must not\n  // depend on const helpers declared later (that would trigger a runtime TDZ).\n  function getCustomerOutstandingBalance(custID: string): number {\n    const repairDebt = orders.filter(order => order.customerId === custID).reduce((sum, order) => {\n      const snapshotRemaining = Number(order.deliverySnapshot?.remainingBalance);\n      if (Number.isFinite(snapshotRemaining) && snapshotRemaining > 0) return sum + snapshotRemaining;\n\n      const legacyRemaining = Number((order as any).remainingBalance ?? (order as any).remainingDue ?? 0);\n      return sum + Math.max(0, legacyRemaining);\n    }, 0);\n\n    const salesDebt = invoices.filter(inv => inv.customerId === custID).reduce((sum, inv) => {\n      if (inv.isCancelled || inv.type === 'repair') return sum;\n      const net = Math.max(0, Number(inv.totalAmount || 0) - Number(inv.discount || 0));\n      const paid = Math.max(0, Number(inv.paidAmount || 0));\n      return sum + Math.max(0, net - paid);\n    }, 0);\n\n    return Math.round((repairDebt + salesDebt) * 100) / 100;\n  }\n\n  const handleDebtWhatsAppReminder = async (cust: Customer) => {\n    const debt = getCustomerOutstandingBalance(cust.id);\n    if (debt <= 0) {\n      await dialog.alert({ message: 'لا توجد مديونية مستحقة على هذا العميل حالياً.', variant: 'warning' });\n      return;\n    }\n\n    const message = \`مرحباً \${cust.name}، نذكرك بأن المتبقي المستحق على حسابك لدى Atari Store هو \${debt.toLocaleString('ar-EG')} ج.م. برجاء التواصل معنا لتسوية المبلغ. شكراً لتعاملك معنا.\`;\n    if (!openWhatsAppMessage(cust.phone, message)) {\n      await dialog.alert({ message: 'تعذر فتح واتساب. تأكد من رقم الهاتف واسمح بالنوافذ المنبثقة للموقع.', variant: 'error' });\n    }\n  };`;
if (!source.includes('getCustomerOutstandingBalance')) {
  if (!source.includes(helperNeedle)) throw new Error('Customer invoice helper not found');
  source = source.replace(helperNeedle, helperReplacement);
}

source = source.replace(
  '  const totalBalance = registeredCustomers.reduce((sum, c) => sum + (c.balance || 0), 0);',
  '  const totalBalance = registeredCustomers.reduce((sum, c) => sum + getCustomerOutstandingBalance(c.id), 0);'
);

source = source.replace(
  '                const customerOrders = getCustomerRepairs(cust.id);',
  '                const customerOrders = getCustomerRepairs(cust.id);\n                const outstandingBalance = getCustomerOutstandingBalance(cust.id);'
);
source = source.replace(
  '                    <td className={`py-3.5 px-4 font-bold ${cust.balance > 0 ? "text-red-400" : "text-green-400"}`}>\n                      {cust.balance > 0 ? `${cust.balance} ج.م` : "سليم"}\n                    </td>',
  '                    <td className={`py-3.5 px-4 font-bold ${outstandingBalance > 0 ? "text-red-400" : "text-green-400"}`}>\n                      {outstandingBalance > 0 ? `${outstandingBalance.toLocaleString("ar-EG")} ج.م` : "سليم"}\n                    </td>'
);

source = source.replace(
  '                      {activeCustomer.balance} ج.م',
  '                      {getCustomerOutstandingBalance(activeCustomer.id).toLocaleString("ar-EG")} ج.م'
);

const footerNeedle = `            <div className="pt-4 border-t border-[#2a2d42] flex gap-2">\n              <button\n                onClick={() => setActiveCustomer(null)}`;
const footerReplacement = `            <div className="pt-4 border-t border-[#2a2d42] flex gap-2">\n              {getCustomerOutstandingBalance(activeCustomer.id) > 0 && (\n                <button\n                  type="button"\n                  onClick={() => handleDebtWhatsAppReminder(activeCustomer)}\n                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-4 rounded-lg text-xs font-bold transition-all-custom cursor-pointer flex items-center justify-center gap-2"\n                >\n                  <MessageCircle className="w-4 h-4" />\n                  تذكير بالمديونية على واتساب\n                </button>\n              )}\n              <button\n                onClick={() => setActiveCustomer(null)}`;
if (!source.includes('تذكير بالمديونية على واتساب')) {
  if (!source.includes(footerNeedle)) throw new Error('Customer drawer footer not found');
  source = source.replace(footerNeedle, footerReplacement);
}

fs.writeFileSync(filePath, source, 'utf8');
console.log('Customer debt runtime fixed with direct orders/invoices data; WhatsApp reminder remains enabled.');
