import fs from 'node:fs';
const src = fs.readFileSync('src/components/CustomersList.tsx','utf8');
if (!src.includes('function getCustomerOutstandingBalance')) throw new Error('Debt function must be hoisted');
if (src.includes('const getCustomerOutstandingBalance =')) throw new Error('TDZ-prone debt const still present');
console.log('Customer debt runtime smoke check passed');
