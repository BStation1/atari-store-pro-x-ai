import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const headers = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers });

function databaseRole(role: unknown): string {
  const value = String(role || "").toUpperCase();
  if (["OWNER", "ADMIN", "MANAGER", "CASHIER", "INVENTORY", "ACCOUNTANT", "VIEWER"].includes(value)) return value;
  if (value === "TECHNICIAN" || value === "ENGINEER") return "ENGINEER";
  return "RECEPTION";
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const token = request.headers.get("Authorization") || "";
    if (!token.toLowerCase().startsWith("bearer ")) return reply({ success: false, error: "انتهت جلسة المالك. سجل الدخول مرة أخرى." }, 401);

    const callerClient = createClient(url, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: token } } });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) return reply({ success: false, error: "انتهت جلسة المالك. سجل الدخول مرة أخرى." }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: callerProfile } = await admin.from("profiles").select("role,is_active").eq("id", caller.id).maybeSingle();
    if (!callerProfile || callerProfile.is_active === false || String(callerProfile.role).toUpperCase() !== "OWNER") {
      return reply({ success: false, error: "Only OWNER can create users" }, 403);
    }

    const body = await request.json();
    const email = String(body.email || "").trim().toLowerCase();
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!email || !username || password.length < 6) return reply({ success: false, error: "أكمل البيانات وكلمة المرور 6 أحرف على الأقل" });

    const { data: duplicate } = await admin.from("profiles").select("id").or(`email.eq.${email},username.eq.${username}`).limit(1);
    if (duplicate?.length) return reply({ success: false, error: "اسم المستخدم أو البريد مسجل مسبقاً" });

    const role = databaseRole(body.roleId);
    if (role === "OWNER") return reply({ success: false, error: "لا يمكن إنشاء مالك نظام إضافي من شاشة إضافة الموظفين." }, 400);

    const { data: created, error: authError } = await admin.auth.admin.createUser({
      email, password, email_confirm: true,
      user_metadata: { full_name: String(body.fullName || username), username, role },
    });
    if (authError || !created.user) {
      let message = authError?.message || "تعذر إنشاء حساب الدخول";
      if (/weak|password|pwned|breach/i.test(message)) message = "كلمة المرور ضعيفة أو مرفوضة من Supabase. استخدم كلمة أقوى مثل Atari@123456";
      return reply({ success: false, error: message });
    }

    const { error: profileError } = await admin.from("profiles").upsert({
      id: created.user.id, email, full_name: String(body.fullName || username), username,
      phone: body.phone || null, role, is_active: true,
      custom_permissions: Array.isArray(body.permissions) ? body.permissions : [],
      branch: body.branch || "الفرع الرئيسي", must_change_password: Boolean(body.mustChangePassword),
      updated_at: new Date().toISOString(),
    });
    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      return reply({ success: false, error: `تعذر حفظ ملف المستخدم: ${profileError.message}` });
    }
    return reply({ success: true, user: { id: created.user.id, email, username } });
  } catch (error) {
    return reply({ success: false, error: error instanceof Error ? error.message : "Create failed" }, 500);
  }
});
