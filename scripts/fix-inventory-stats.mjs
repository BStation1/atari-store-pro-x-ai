import fs from 'node:fs';
import path from 'node:path';

const inventoryPath = path.resolve('src/components/Inventory.tsx');
let source = fs.readFileSync(inventoryPath, 'utf8');

const replacements = [
  ['{products.length} أصناف', '{filteredProducts.length} أصناف'],
  ['{products.filter(p => p.quantity <= p.minStock && p.quantity > 0).length} صنفاً', '{filteredProducts.filter(p => p.quantity <= p.minStock && p.quantity > 0).length} صنفاً'],
  ['{products.filter(p => p.quantity === 0).length} صنفاً', '{filteredProducts.filter(p => p.quantity === 0).length} صنفاً'],
  ['{products.reduce((acc, p) => acc + (p.purchasePrice * p.quantity), 0).toLocaleString()} ج.م', '{filteredProducts.reduce((acc, p) => acc + (p.purchasePrice * p.quantity), 0).toLocaleString()} ج.م'],
];

let changed = false;
for (const [from, to] of replacements) {
  if (source.includes(from)) {
    source = source.replace(from, to);
    changed = true;
  } else if (!source.includes(to)) {
    throw new Error(`Inventory stats patch target not found: ${from}`);
  }
}

if (changed) {
  fs.writeFileSync(inventoryPath, source, 'utf8');
  console.log('Inventory statistics now follow the exact filtered product list.');
} else {
  console.log('Inventory statistics patch already applied.');
}

// RP326 thermal receipt hardening.
// Keep the preview and physical receipt monochrome black, increase thermal
// legibility, and compensate for this printer/driver shifting output left.
const receiptPath = path.resolve('src/components/PrintReceiptModal.tsx');
let receipt = fs.readFileSync(receiptPath, 'utf8');
let receiptChanged = false;

const receiptReplacements = [
  ['text-[10px] text-gray-700 font-medium mt-1', 'text-[10px] text-black font-semibold mt-1'],
  ['text-[10px] text-gray-600 mt-0.5', 'text-[10px] text-black mt-0.5'],
  ['text-[10px] text-gray-600">\n                هاتف:', 'text-[10px] text-black">\n                هاتف:'],
  ['border-b border-gray-100', 'border-b border-black'],
  ['text-[9px] text-gray-700 leading-snug', 'text-[9px] text-black leading-snug'],
  ['text-[9px] text-indigo-900 mt-0.5', 'text-[9px] text-black mt-0.5'],
  ['flex justify-between text-gray-700', 'flex justify-between text-black'],
  ['flex justify-between text-green-700 font-medium', 'flex justify-between text-black font-bold'],
  ['flex justify-between text-red-700 font-bold', 'flex justify-between text-black font-bold'],
  ['text-[9px] text-gray-600 font-bold mb-1', 'text-[9px] text-black font-bold mb-1'],
  ['text-[8px] text-gray-500 mt-1 font-mono', 'text-[8px] text-black mt-1 font-mono'],
  ['text-center text-[9px] text-gray-700 border-t', 'text-center text-[9px] text-black border-t'],
  ['weight >= 600 ? "700" : "600"', '"700"'],
  ['printableReceipt.style.setProperty("margin-right", "auto", "important");\n    printableReceipt.style.setProperty("padding", "3mm", "important");', 'printableReceipt.style.setProperty("margin-right", "auto", "important");\n    printableReceipt.style.setProperty("transform", "translateX(2mm)", "important");\n    printableReceipt.style.setProperty("padding", "3mm", "important");'],
  ['margin-right: auto !important;\n              color: #000 !important;', 'margin-right: auto !important;\n              transform: translateX(2mm) !important;\n              color: #000 !important;'],
  ['font-family: Tahoma, Arial, sans-serif !important;\n            }\n            .rp326-receipt img', 'font-family: Tahoma, Arial, sans-serif !important;\n              font-weight: 700 !important;\n            }\n            .rp326-receipt img'],
];

for (const [from, to] of receiptReplacements) {
  if (receipt.includes(from)) {
    receipt = receipt.split(from).join(to);
    receiptChanged = true;
  } else if (!receipt.includes(to)) {
    throw new Error(`RP326 receipt patch target not found: ${from}`);
  }
}

if (receiptChanged) {
  fs.writeFileSync(receiptPath, receipt, 'utf8');
  console.log('RP326 receipt is monochrome black, bolder, and shifted 2mm right.');
} else {
  console.log('RP326 receipt patch already applied.');
}
