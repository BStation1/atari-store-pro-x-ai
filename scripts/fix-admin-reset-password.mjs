import fs from 'node:fs';

const path = 'src/components/Users.tsx';
let src = fs.readFileSync(path, 'utf8');

const oldBlock = `  // Reset user password by Admin\n  const handleResetPasswordSubmit = (e: React.FormEvent) => {\n    e.preventDefault();\n    if (!resetPassUser || !newTempPass.trim()) return;\n\n    const res = authStore.resetPasswordByAdmin(resetPassUser.id, newTempPass.trim());\n    if (res.success) {\n      setActionAlert({\n        type: \"success\",\n        msg: \`تم إعادة تعيين كلمة مرور \${resetPassUser.fullName || resetPassUser.name} بنجاح لكلمة المرور المؤقتة الجديدة.\`\n      });\n      setResetPassUser(null);\n      setNewTempPass(\"\");\n      refreshUsersList();\n    } else {\n      setActionAlert({ type: \"error\", msg: res.error || \"تعذر إعادة تعيين كلمة المرور.\" });\n    }\n  };`;

const newBlock = `  // Reset user password securely through a privileged Edge Function.\n  const handleResetPasswordSubmit = async (e: React.FormEvent) => {\n    e.preventDefault();\n    if (!resetPassUser || !newTempPass.trim()) return;\n\n    setActionAlert(null);\n\n    if (!isUserOwnerSync(currentLoggedUser)) {\n      setActionAlert({ type: \"error\", msg: \"إعادة تعيين كلمات مرور الموظفين متاحة لمالك النظام فقط.\" });\n      return;\n    }\n\n    if (newTempPass.trim().length < 6) {\n      setActionAlert({ type: \"error\", msg: \"كلمة المرور المؤقتة يجب ألا تقل عن 6 أحرف.\" });\n      return;\n    }\n\n    try {\n      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();\n      const accessToken = sessionData.session?.access_token;\n      if (sessionError || !accessToken) {\n        setActionAlert({ type: \"error\", msg: \"انتهت جلسة المالك. سجل الدخول مرة أخرى ثم أعد المحاولة.\" });\n        return;\n      }\n\n      const { data: resetResult, error: resetError } = await supabase.functions.invoke(\"admin-reset-password\", {\n        headers: { Authorization: \`Bearer \${accessToken}\` },\n        body: {\n          userId: resetPassUser.id,\n          newPassword: newTempPass.trim()\n        }\n      });\n\n      if (resetError || !resetResult?.success) {\n        const message = resetResult?.error || resetError?.message || \"تعذر إعادة تعيين كلمة المرور.\";\n        setActionAlert({ type: \"error\", msg: message });\n        return;\n      }\n\n      await authStore.syncUsersFromSupabase();\n      refreshUsersList();\n      setActionAlert({\n        type: \"success\",\n        msg: \`تم إعادة تعيين كلمة مرور \${resetPassUser.fullName || resetPassUser.name} بنجاح، وسيُطلب منه تغييرها عند أول دخول.\`\n      });\n      setResetPassUser(null);\n      setNewTempPass(\"\");\n    } catch (err) {\n      setActionAlert({\n        type: \"error\",\n        msg: err instanceof Error ? err.message : \"تعذر إعادة تعيين كلمة المرور.\"\n      });\n    }\n  };`;

if (!src.includes('supabase.functions.invoke("admin-reset-password"')) {
  if (!src.includes(oldBlock)) {
    throw new Error('Users reset-password patch marker not found');
  }
  src = src.replace(oldBlock, newBlock);
}

fs.writeFileSync(path, src);
console.log('✓ Secure admin reset-password flow ensured');
