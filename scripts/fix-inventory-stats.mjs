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
