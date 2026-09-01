import fs from 'node:fs';

const file = 'src/components/CustomersList.tsx';
let source = fs.readFileSync(file, 'utf8');

const buttonMarker = 'onClick={() => handleSettleCustomerDebt(activeCustomer)}';
if (!source.includes(buttonMarker)) {
  const reminderNeedle = `              {getCustomerOutstandingBalance(activeCustomer.id) > 0 && (\n                <button\n                  type="button"\n                  onClick={() => handleDebtWhatsAppReminder(activeCustomer)}`;

  const paymentButton = `              {getCustomerOutstandingBalance(activeCustomer.id) > 0 && (\n                <button\n                  type="button"\n                  onClick={() => handleSettleCustomerDebt(activeCustomer)}\n                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-2 px-4 rounded-lg text-xs font-bold transition-all-custom cursor-pointer flex items-center justify-center gap-2"\n                >\n                  <DollarSign className="w-4 h-4" />\n                  تسديد مديونية\n                </button>\n              )}\n`;

  if (!source.includes(reminderNeedle)) {
    throw new Error('Could not locate customer debt WhatsApp reminder button');
  }
  source = source.replace(reminderNeedle, paymentButton + reminderNeedle);
}

fs.writeFileSync(file, source, 'utf8');
console.log('Customer debt settlement button verified.');
