import fs from 'node:fs';

const path = 'src/App.tsx';
let text = fs.readFileSync(path, 'utf8');

const oldImport = 'import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";';
const newImport = 'import { authSupabase as supabase } from "./lib/authSupabaseClient";\nconst isSupabaseConfigured = true;';

if (text.includes(oldImport)) {
  text = text.replace(oldImport, newImport);
  fs.writeFileSync(path, text, 'utf8');
  console.log('✅ App authentication now uses the shared free Supabase project');
} else if (text.includes('import { authSupabase as supabase } from "./lib/authSupabaseClient";')) {
  console.log('✅ App shared auth client already configured');
} else {
  throw new Error('Could not locate App.tsx Supabase auth import to patch');
}
