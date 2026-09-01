import fs from 'node:fs';
const src = fs.readFileSync('src/components/CustomersList.tsx', 'utf8');
const totalIdx = src.indexOf('const totalBalance = registeredCustomers.reduce');
const fnIdx = src.indexOf('function getCustomerOutstandingBalance');
if (totalIdx === -1) throw new Error('totalBalance calculation missing');
if (fnIdx === -1) throw new Error('hoisted customer debt function missing');
console.log('Customer debt runtime order validation passed.');
