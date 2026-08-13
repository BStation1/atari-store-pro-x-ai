import fs from 'node:fs';
import path from 'node:path';

const filePath = path.resolve('src/lib/supabaseProducts.ts');
let source = fs.readFileSync(filePath, 'utf8');

const oldLine = "    isArchived: Boolean(row.is_archived || meta.isArchived || false),";
const newLine = "    isArchived: typeof row.is_archived === 'boolean' ? row.is_archived : Boolean(meta.isArchived ?? false),";

if (source.includes(oldLine)) {
  source = source.replace(oldLine, newLine);
  fs.writeFileSync(filePath, source, 'utf8');
  console.log('Product archive mapping fixed: database is_archived now overrides stale metadata.');
} else if (source.includes(newLine)) {
  console.log('Product archive mapping patch already applied.');
} else {
  throw new Error('Could not find product isArchived mapping target.');
}
