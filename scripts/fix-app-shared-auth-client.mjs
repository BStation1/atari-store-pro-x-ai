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

// Shared-auth OWNER bootstrap must win over any stale local browser user/login view.
// db.init()/legacy localStorage may still expose a local user, so owner existence in the
// shared Supabase database is the only authority for deciding whether setup is required.
const setupConditions = [
  'if (currentView === "setup" || (!hasOwner && !currentLoggedUser && currentView !== "login"))',
  'if (currentView === "setup" || (!hasOwner && !currentLoggedUser))'
];
for (const condition of setupConditions) {
  if (text.includes(condition)) {
    text = text.replace(condition, 'if (currentView === "setup" || !hasOwner)');
  }
}

fs.writeFileSync(path, text, 'utf8');
console.log('✅ App shared auth client and authoritative OWNER setup routing configured');
