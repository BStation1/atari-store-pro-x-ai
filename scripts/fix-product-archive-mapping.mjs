import fs from 'node:fs';
import path from 'node:path';

function patchFile(relativePath, patcher) {
  const filePath = path.resolve(relativePath);
  const source = fs.readFileSync(filePath, 'utf8');
  const next = patcher(source);
  if (next !== source) {
    fs.writeFileSync(filePath, next, 'utf8');
    console.log(`Patched ${relativePath}`);
  } else {
    console.log(`No patch needed for ${relativePath}`);
  }
}

patchFile('src/lib/supabaseProducts.ts', source => {
  const oldLine = "    isArchived: Boolean(row.is_archived || meta.isArchived || false),";
  const newLine = "    isArchived: typeof row.is_archived === 'boolean' ? row.is_archived : Boolean(meta.isArchived ?? false),";
  if (source.includes(oldLine)) return source.replace(oldLine, newLine);
  if (source.includes(newLine)) return source;
  throw new Error('Could not find product isArchived mapping target.');
});

patchFile('src/components/RepairCenter.tsx', source => {
  const oldLine = '                const availableInventory = products.filter(p => !p.isArchived);';
  const newBlock = `                // Only hide products that are explicitly archived. Older/local rows can\n                // contain false as a string; treating that as truthy made valid stock disappear.\n                const availableInventory = products.filter(p => {\n                  const archived = (p as any).isArchived;\n                  return archived !== true && archived !== 1 && String(archived ?? '').toLowerCase() !== 'true';\n                });`;
  if (source.includes(oldLine)) return source.replace(oldLine, newBlock);
  if (source.includes(newBlock)) return source;
  throw new Error('Could not find RepairCenter availableInventory target.');
});

patchFile('src/components/PrintReceiptModal.tsx', source => {
  return source.replace('printDocument.write(\\`', 'printDocument.write(`');
});
