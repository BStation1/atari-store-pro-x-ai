import fs from 'node:fs';

const file = 'src/components/Users.tsx';
let src = fs.readFileSync(file, 'utf8');

if (!src.includes('Trash2')) {
  src = src.replace(
    '  ShieldCheck,\n  AlertCircle\n} from "lucide-react";',
    '  ShieldCheck,\n  AlertCircle,\n  Trash2\n} from "lucide-react";'
  );
}

if (!src.includes('const handleDeleteUser = async')) {
  const marker = '  // Filter users list\n';
  const handler = `  // Permanently delete a staff user (OWNER only)\n  const handleDeleteUser = async (targetUser: AuthUser) => {\n    setActionAlert(null);\n\n    if (!isUserOwnerSync(currentLoggedUser)) {\n      setActionAlert({ type: "error", msg: "حذف المستخدمين متاح لمالك النظام فقط." });\n      return;\n    }\n    if (targetUser.id === currentLoggedUser?.id) {\n      setActionAlert({ type: "error", msg: "لا يمكنك حذف حسابك الحالي." });\n      return;\n    }\n    if (targetUser.roleId === "OWNER") {\n      setActionAlert({ type: "error", msg: "لا يمكن حذف حساب OWNER من شاشة المستخدمين." });\n      return;\n    }\n\n    const confirmed = window.confirm(\n      \`هل أنت متأكد من حذف المستخدم "\${targetUser.fullName || targetUser.name || targetUser.username}" نهائياً؟\\n\\nسيتم حذف حساب تسجيل الدخول وملف المستخدم، ولن يتمكن من تسجيل الدخول مرة أخرى.\`\n    );\n    if (!confirmed) return;\n\n    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();\n    const accessToken = sessionData.session?.access_token;\n    if (sessionError || !accessToken) {\n      setActionAlert({ type: "error", msg: "انتهت جلسة المالك. سجل الدخول مرة أخرى ثم أعد المحاولة." });\n      return;\n    }\n\n    const { data: deleteResult, error: deleteError } = await supabase.functions.invoke("admin-delete-user", {\n      headers: { Authorization: \`Bearer \${accessToken}\` },\n      body: { userId: targetUser.id }\n    });\n\n    if (deleteError || !deleteResult?.success) {\n      setActionAlert({\n        type: "error",\n        msg: deleteResult?.error || deleteError?.message || "تعذر حذف المستخدم."\n      });\n      return;\n    }\n\n    authStore.logoutAllSessions(targetUser.id);\n    const remainingUsers = authStore.getUsers().filter(u => u.id !== targetUser.id);\n    authStore.saveUsers(remainingUsers);\n    setUsersList(remainingUsers);\n    setActionAlert({\n      type: "success",\n      msg: \`تم حذف المستخدم \${targetUser.fullName || targetUser.name || targetUser.username} نهائياً بنجاح.\`\n    });\n  };\n\n`;
  if (!src.includes(marker)) throw new Error('Users filter marker not found');
  src = src.replace(marker, handler + marker);
}

if (!src.includes('title="حذف المستخدم نهائياً"')) {
  const target = `                      <button\n                        onClick={() => handleTerminateSessions(emp)}\n                        className="bg-gray-800 hover:bg-gray-700 text-amber-400 text-[11px] p-1.5 rounded-lg border border-[#2a2d42] cursor-pointer"\n                        title="إنهاء جميع الجلسات المفتوحة"\n                      >\n                        <LogOut className="w-3.5 h-3.5" />\n                      </button>`;
  const replacement = `${target}\n\n                      {isUserOwnerSync(currentLoggedUser) && emp.roleId !== "OWNER" && emp.id !== currentLoggedUser?.id && (\n                        <button\n                          onClick={() => handleDeleteUser(emp)}\n                          className="bg-red-950/60 hover:bg-red-900 text-red-400 hover:text-red-300 text-[11px] p-1.5 rounded-lg border border-red-900/60 cursor-pointer"\n                          title="حذف المستخدم نهائياً"\n                        >\n                          <Trash2 className="w-3.5 h-3.5" />\n                        </button>\n                      )}`;
  if (!src.includes(target)) throw new Error('Terminate sessions button marker not found');
  src = src.replace(target, replacement);
}

fs.writeFileSync(file, src);
console.log('✅ Owner-only permanent user deletion button ensured');
