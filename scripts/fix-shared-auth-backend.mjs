import fs from 'node:fs';

function patch(path, replacer) {
  let text = fs.readFileSync(path, 'utf8');
  const next = replacer(text);
  if (next !== text) fs.writeFileSync(path, next, 'utf8');
}

patch('src/lib/authStore.ts', text => {
  text = text.replace('import { supabase } from "./supabaseClient";', 'import { authSupabase as supabase } from "./authSupabaseClient";');
  text = text.replace(/const users = this\.getUsers\(\);\s*const localMatch = users\.find\([\s\S]*?targetEmail = localMatch\?\.email \|\| `\$\{cleanIdentifier\}@atari\.com`;/, `const { data: remoteEmail, error: lookupError } = await supabase.rpc("lookup_login_email", { p_username: cleanIdentifier });\n      if (lookupError) console.warn("⚠️ Username lookup failed:", lookupError.message);\n      targetEmail = typeof remoteEmail === "string" && remoteEmail ? remoteEmail : \`\${cleanIdentifier}@atari.com\`;`);
  text = text.replace('username: (p.email || "user").split("@")[0],', 'username: p.username || (p.email || "user").split("@")[0],');
  text = text.replace('phone: p.phone || "",\n            roleId:', 'phone: p.phone || "",\n            branch: p.branch || "الفرع الرئيسي",\n            roleId:');
  text = text.replace('permissions: ALL_PERMISSIONS,\n            isActive: p.is_active !== false,', 'permissions: Array.isArray(p.permissions) && p.permissions.length > 0 ? p.permissions : ALL_PERMISSIONS,\n            isActive: p.is_active !== false,\n            mustChangePassword: p.must_change_password === true,');
  text = text.replace(/hasOwner: true, \/\/ Default to true so setup screen is NEVER exposed accidentally on error/, 'hasOwner: false');
  text = text.replace(/hasOwner: true,\n        error: "حدث خطأ غير متوقع أثناء الاتصال بـ Supabase\. يرجى التحقق من اتصال الإنترنت\."/, 'hasOwner: false,\n        error: "حدث خطأ غير متوقع أثناء الاتصال بقاعدة بيانات المستخدمين. يرجى التحقق من اتصال الإنترنت."');
  text = text.replace('email: user.email,\n          full_name: user.fullName,\n          role: targetRole', 'email: user.email,\n          username: user.username,\n          full_name: user.fullName,\n          phone: user.phone || "",\n          branch: user.branch || "الفرع الرئيسي",\n          permissions: user.permissions || [],\n          must_change_password: user.mustChangePassword === true,\n          is_active: user.isActive !== false,\n          role: targetRole,\n          updated_at: new Date().toISOString()');
  return text;
});

patch('src/components/Users.tsx', text => {
  text = text.replace('import { supabase } from "../lib/supabaseClient";', 'import { authSupabase as supabase } from "../lib/authSupabaseClient";');
  if (!text.includes('Failed to sync staff list')) {
    text = text.replace('  const refreshUsersList = () => {\n    setUsersList(authStore.getUsers());\n  };', '  const refreshUsersList = () => {\n    setUsersList(authStore.getUsers());\n  };\n\n  React.useEffect(() => {\n    let mounted = true;\n    authStore.syncUsersFromSupabase().then(users => { if (mounted) setUsersList(users); }).catch(err => console.warn("⚠️ Failed to sync staff list:", err));\n    return () => { mounted = false; };\n  }, []);');
  }
  text = text.replace(/\/\/ Attempt signup in Supabase Auth[\s\S]*?if \(spData\?\.user\) \{\s*authUserId = spData\.user\.id;\s*\}\s*\} catch \(err\) \{[\s\S]*?\}/, `// Create the employee centrally with the protected admin Edge Function.\n      let authUserId: string | undefined;\n      try {\n        const { data: createData, error: createError } = await supabase.functions.invoke("admin-create-user", { body: { email: cleanEmail, password: passToUse, fullName, username: username.toLowerCase().trim(), phone, branch, roleId, permissions: roleId === "OWNER" ? ALL_PERMISSIONS : customPermissions, mustChangePassword } });\n        if (createError || createData?.error) throw new Error(createData?.error || createError?.message || "تعذر إنشاء المستخدم على الخادم");\n        authUserId = createData?.user?.id;\n        if (!authUserId) throw new Error("لم يرجع الخادم رقم المستخدم الجديد");\n      } catch (err: any) {\n        setActionAlert({ type: "error", msg: err?.message || "تعذر إنشاء المستخدم في قاعدة المستخدمين المركزية." });\n        return;\n      }`);
  text = text.replace('id: authUserId || `U-${String(allUsers.length + 101).padStart(3, "0")}`,', 'id: authUserId,');
  return text;
});

patch('src/App.tsx', text => {
  text = text.replace('import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";', 'import { isSupabaseConfigured } from "./lib/supabaseClient";\nimport { authSupabase } from "./lib/authSupabaseClient";');
  text = text.replaceAll('supabase.auth.onAuthStateChange', 'authSupabase.auth.onAuthStateChange');
  text = text.replaceAll('supabase.auth.getSession()', 'authSupabase.auth.getSession()');
  text = text.replace('if (currentView === "setup" || (!hasOwner && !currentLoggedUser && currentView !== "login"))', 'if (currentView === "setup" || (!hasOwner && !currentLoggedUser))');
  return text;
});

console.log('✅ Shared auth backend patch applied');
