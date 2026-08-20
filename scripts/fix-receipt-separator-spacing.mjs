import fs from 'node:fs';

const file = 'scripts/fix-receipt-header-overlap.mjs';
let src = fs.readFileSync(file, 'utf8');

const from = '"padding:0 0 4mm 0"';
const to = '"padding:0 0 8mm 0"';

if (!src.includes(from) && !src.includes(to)) {
  throw new Error('Thermal header spacing marker not found');
}

if (src.includes(from)) {
  src = src.replace(from, to);
}

fs.writeFileSync(file, src);
console.log('✓ Lowered dashed separator below phone line to 8mm spacing');
