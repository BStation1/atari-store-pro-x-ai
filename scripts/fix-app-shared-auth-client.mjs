import fs from 'node:fs';

const path = 'src/App.tsx';
let text = fs.readFileSync(path, 'utf8');

const oldImport = 'import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";';
const newImport = 'import { authSupabase as supabase } from "./lib/authSupabaseClient";\nconst isSupabaseConfigured = true;';

if (text.includes(oldImport)) {
  text = text.replace(oldImport, newImport);
} else if (!text.includes('import { authSupabase as supabase } from "./lib/authSupabaseClient";')) {
  throw new Error('Could not locate App.tsx Supabase auth import to patch');
}

// If the shared auth database has no OWNER, setup must win over the login view.
// The previous condition excluded setup whenever currentView had already become "login".
const oldSetupCondition = 'if (currentView === "setup" || (!hasOwner && !currentLoggedUser && currentView !== "login"))';
const newSetupCondition = 'if (currentView === "setup" || (!hasOwner && !currentLoggedUser))';
if (text.includes(oldSetupCondition)) {
  text = text.replace(oldSetupCondition, newSetupCondition);
}

fs.writeFileSync(path, text, 'utf8');
console.log('✅ App shared auth client and initial OWNER setup routing configured');
