import fs from 'node:fs';

function patch(path, replacer) {
  const text = fs.readFileSync(path, 'utf8');
  const next = replacer(text);
  if (next !== text) fs.writeFileSync(path, next, 'utf8');
}

patch('src/lib/authStore.ts', text => {
  text = text.replace('import { supabase } from "./supabaseClient";', 'import { authSupabase as supabase } from "./authSupabaseClient";');
  text = text.replace('hasOwner: true, // Default to true so setup screen is NEVER exposed accidentally on error', 'hasOwner: false');
  text = text.replace('hasOwner: true,\n        error: "حدث خطأ غير متوقع أثناء الاتصال بـ Supabase. يرجى التحقق من اتصال الإنترنت."', 'hasOwner: false,\n        error: "حدث خطأ غير متوقع أثناء الاتصال بقاعدة بيانات المستخدمين. يرجى التحقق من اتصال الإنترنت."');
  return text;
});

patch('src/App.tsx', text => {
  text = text.replace('import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";', 'import { isSupabaseConfigured } from "./lib/supabaseClient";\nimport { authSupabase } from "./lib/authSupabaseClient";');
  text = text.replace('supabase.auth.onAuthStateChange', 'authSupabase.auth.onAuthStateChange');
  text = text.replace('supabase.auth.getSession()', 'authSupabase.auth.getSession()');
  text = text.replace('if (currentView === "setup" || (!hasOwner && !currentLoggedUser && currentView !== "login"))', 'if (currentView === "setup" || (!hasOwner && !currentLoggedUser))');
  return text;
});

console.log('✅ Shared auth bootstrap patch applied');
