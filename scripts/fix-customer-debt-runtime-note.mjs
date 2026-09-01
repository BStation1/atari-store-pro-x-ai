import fs from 'node:fs';
const file = 'src/components/CustomersList.tsx';
const src = fs.readFileSync(file, 'utf8');
if (src.includes('const getCustomerOutstandingBalance =')) {
  throw new Error('Customer debt helper must be hoisted to avoid runtime TDZ');
}
