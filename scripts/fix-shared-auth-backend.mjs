import fs from 'node:fs';

function patchFile(path, patches) {
  let text = fs.readFileSync(path, 'utf8');
  let changed = false;

  for (const { from, to, label } of patches) {
    if (text.includes(to)) continue;
    if (!text.includes(from)) {
      throw new Error(`shared-auth patch failed (${label}) in ${path}`);
    }
    text = text.replace(from, to);
    changed = true;
  }

  if (changed) fs.writeFileSync(path, text, 'utf8');
}

patchFile('src/lib/authStore.ts', [
  {
    label: 'auth client import',
    from: 'import { supabase } from "./supabaseClient";',
    to: 'import { authSupabase as supabase } from "./authSupabaseClient";'
  },
  {
    label: 'username lookup',
    from: `    // Determine target email for Supabase Auth\n    let targetEmail = cleanIdentifier;\n    if (!targetEmail.includes("@")) {\n      const users = this.getUsers();\n      const localMatch = users.find(\n        u => u.username.toLowerCase() === cleanIdentifier || u.email.toLowerCase() === cleanIdentifier\n      );\n      targetEmail = localMatch?.email || \`\${cleanIdentifier}@atari.com\`;\n    }`,
    to: `    // Resolve usernames centrally so login works from every browser/device.\n    let targetEmail = cleanIdentifier;\n    if (!targetEmail.includes("@")) {\n      const { data: remoteEmail, error: lookupError } = await supabase.rpc("lookup_login_email", {\n        p_username: cleanIdentifier\n      });\n      if (lookupError) {\n        console.warn("⚠️ Username lookup failed:", lookupError.message);\n      }\n      targetEmail = typeof remoteEmail === "string" && remoteEmail\n        ? remoteEmail\n        : \`\${cleanIdentifier}@atari.com\`;\n    }`
  },
  {
    label: 'profile username mapping',
    from: `            username: (p.email || "user").split("@")[0],\n            email: p.email || "",\n            phone: p.phone || "",\n            roleId: normRoleId,\n            role: normRoleId.toLowerCase(),\n            permissions: ALL_PERMISSIONS,\n            isActive: p.is_active !== false,`,
    to: `            username: p.username || (p.email || "user").split("@")[0],\n            email: p.email || "",\n            phone: p.phone || "",\n            branch: p.branch || "الفرع الرئيسي",\n            roleId: normRoleId,\n            role: normRoleId.toLowerCase(),\n            permissions: Array.isArray(p.permissions) && p.permissions.length > 0 ? p.permissions : ALL_PERMISSIONS,\n            isActive: p.is_active !== false,\n            mustChangePassword: p.must_change_password === true,`
  },
  {
    label: 'sync profile fields',
    from: `          email: user.email,\n          full_name: user.fullName,\n          role: targetRole`,
    to: `          email: user.email,\n          username: user.username,\n          full_name: user.fullName,\n          phone: user.phone || "",\n          branch: user.branch || "الفرع الرئيسي",\n          permissions: user.permissions || [],\n          must_change_password: user.mustChangePassword === true,\n          is_active: user.isActive !== false,\n          role: targetRole,\n          updated_at: new Date().toISOString()`
  },
  {
    label: 'owner check error fallback',
    from: `        return {\n          hasOwner: true, // Default to true so setup screen is NEVER exposed accidentally on error\n          error: "تعذر الاتصال بقاعدة البيانات للتحقق من وجود المالك. يرجى إعادة المحاولة."\n        };`,
    to: `        return {\n          hasOwner: false,\n          error: "تعذر الاتصال بقاعدة بيانات المستخدمين للتحقق من وجود المالك. يرجى إعادة المحاولة."\n        };`
  },
  {
    label: 'owner check catch fallback',
    from: `      return {\n        hasOwner: true,\n        error: "حدث خطأ غير متوقع أثناء الاتصال بـ Supabase. يرجى التحقق من اتصال الإنترنت."\n      };`,
    to: `      return {\n        hasOwner: false,\n        error: "حدث خطأ غير متوقع أثناء الاتصال بقاعدة بيانات المستخدمين. يرجى التحقق من اتصال الإنترنت."\n      };`
  }
]);

patchFile('src/components/Users.tsx', [
  {
    label: 'users auth client import',
    from: 'import { supabase } from "../lib/supabaseClient";',
    to: 'import { authSupabase as supabase } from "../lib/authSupabaseClient";'
  },
  {
    label: 'remote users initial sync',
    from: `  const [usersList, setUsersList] = useState<AuthUser[]>(() => authStore.getUsers());\n\n  const refreshUsersList = () => {\n    setUsersList(authStore.getUsers());\n  };`,
    to: `  const [usersList, setUsersList] = useState<AuthUser[]>(() => authStore.getUsers());\n\n  const refreshUsersList = () => {\n    setUsersList(authStore.getUsers());\n  };\n\n  React.useEffect(() => {\n    let mounted = true;\n    authStore.syncUsersFromSupabase().then(users => {\n      if (mounted) setUsersList(users);\n    }).catch(err => console.warn("⚠️ Failed to sync staff list:", err));\n    return () => { mounted = false; };\n  }, []);`
  },
  {
    label: 'central create user',
    from: `      // Attempt signup in Supabase Auth\n      let authUserId: string | undefined;\n      try {\n        const { data: spData } = await supabase.auth.signUp({\n          email: cleanEmail,\n          password: passToUse,\n          options: {\n            data: {\n              full_name: fullName,\n              username: username.toLowerCase().trim(),\n              role: roleId\n            }\n          }\n        });\n        if (spData?.user) {\n          authUserId = spData.user.id;\n        }\n      } catch (err) {\n        console.warn("⚠️ Supabase Auth register notice:", err);\n      }`,
    to: `      // Create the employee centrally with the protected admin Edge Function.\n      let authUserId: string | undefined;\n      try {\n        const { data: createData, error: createError } = await supabase.functions.invoke("admin-create-user", {\n          body: {\n            email: cleanEmail,\n            password: passToUse,\n            fullName,\n            username: username.toLowerCase().trim(),\n            phone,\n            branch,\n            roleId,\n            permissions: roleId === "OWNER" ? ALL_PERMISSIONS : customPermissions,\n            mustChangePassword\n          }\n        });\n        if (createError || createData?.error) {\n          throw new Error(createData?.error || createError?.message || "تعذر إنشاء المستخدم على الخادم");\n        }\n        authUserId = createData?.user?.id;\n        if (!authUserId) throw new Error("لم يرجع الخادم رقم المستخدم الجديد");\n      } catch (err: any) {\n        setActionAlert({ type: "error", msg: err?.message || "تعذر إنشاء المستخدم في قاعدة المستخدمين المركزية." });\n        return;\n      }`
  },
  {
    label: 'require remote id',
    from: '        id: authUserId || `U-${String(allUsers.length + 101).padStart(3, "0")}`,',
    to: '        id: authUserId,'
  }
]);

patchFile('src/App.tsx', [
  {
    label: 'shared auth import',
    from: 'import { isSupabaseConfigured, supabase } from "./lib/supabaseClient";',
    to: 'import { isSupabaseConfigured } from "./lib/supabaseClient";\nimport { authSupabase } from "./lib/authSupabaseClient";'
  },
  {
    label: 'auth state listener',
    from: '    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {',
    to: '    const { data: { subscription } } = authSupabase.auth.onAuthStateChange(async (event, session) => {'
  },
  {
    label: 'auth changed session lookup',
    from: '      supabase.auth.getSession().then(({ data }) => {',
    to: '      authSupabase.auth.getSession().then(({ data }) => {'
  },
  {
    label: 'force setup when no owner',
    from: '  if (currentView === "setup" || (!hasOwner && !currentLoggedUser && currentView !== "login")) {',
    to: '  if (currentView === "setup" || (!hasOwner && !currentLoggedUser)) {'
  }
]);

console.log('✅ Shared auth backend patch applied');
